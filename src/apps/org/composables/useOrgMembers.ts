import { computed, ref } from 'vue'

import {
  getApiOrgOrgIdMembers,
  postApiOrgOrgIdMemberRemove,
  postApiOrgOrgIdMemberRole,
  postApiOrgOrgIdTransferOwner,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import type { OrgMemberItem } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgMembers(ctx: OrgContext) {
  const members = ref<OrgMemberItem[]>([])
  const loading = ref(false)
  const search = ref('')

  const filtered = computed(() => {
    if (!search.value) return members.value
    const q = search.value.toLowerCase()
    return members.value.filter((m) => m.user.name.toLowerCase().includes(q) || String(m.user.id).includes(q))
  })

  async function load() {
    if (!ctx.orgId.value) return
    loading.value = true
    try {
      members.value = unwrapOk(
        (await getApiOrgOrgIdMembers(ctx.orgId.value)) as any,
        '加载成员失败',
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载成员失败')
    } finally {
      loading.value = false
    }
  }

  async function remove(userId: number) {
    if (!ctx.isOrgAdmin.value || userId <= 0) return
    try {
      unwrapOk(
        (await postApiOrgOrgIdMemberRemove(ctx.orgId.value, { targetUserId: userId })) as any,
        '移除失败',
      )
      toast.success('移除成功')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移除失败')
    }
  }

  async function updateRole(userId: number, role: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return
    try {
      unwrapOk(
        (await postApiOrgOrgIdMemberRole(ctx.orgId.value, { targetUserId: userId, role: role as never })) as any,
        '更新角色失败',
      )
      toast.success('已更新角色')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新角色失败')
    }
  }

  async function transferOwner(userId: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return
    try {
      unwrapOk(
        (await postApiOrgOrgIdTransferOwner(ctx.orgId.value, { targetUserId: userId })) as any,
        '移交失败',
      )
      toast.success('已移交所有权')
      await load()
      await ctx.loadOrgInfo()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移交失败')
    }
  }

  return { members, loading, search, filtered, load, remove, updateRole, transferOwner }
}
