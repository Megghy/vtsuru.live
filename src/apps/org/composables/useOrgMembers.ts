import { computed, ref } from 'vue'

import {
  getApiOrgOrgIdMembers,
  postApiOrgOrgIdMemberRemove,
  postApiOrgOrgIdMemberRole,
  postApiOrgOrgIdTransferOwner,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { toast } from '@/shared/utils'

import { postOrgMemberPermission } from '../api'
import type { OrgMemberItem } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgMembers(ctx: OrgContext) {
  const members = ref<OrgMemberItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const search = ref('')

  const filtered = computed(() => {
    if (!search.value) return members.value
    const q = search.value.toLowerCase()
    return members.value.filter((m) => m.user.name.toLowerCase().includes(q) || String(m.user.id).includes(q))
  })

  async function load() {
    if (!ctx.orgId.value) return
    loading.value = true
    error.value = null
    try {
      members.value = unwrapOk((await getApiOrgOrgIdMembers(ctx.orgId.value)) as any, '加载成员失败')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '加载成员失败'
      error.value = msg
      toast.error(msg)
    } finally {
      loading.value = false
    }
  }

  async function remove(userId: number) {
    if (!ctx.isOrgAdmin.value || userId <= 0) return
    try {
      unwrapOk((await postApiOrgOrgIdMemberRemove(ctx.orgId.value, { targetUserId: userId })) as any, '移除失败')
      toast.success('已移出成员')
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
      toast.success('角色已更新')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新角色失败')
    }
  }

  async function updateRevenuePermission(userId: number, canViewRevenue: boolean) {
    if (!ctx.isOrgAdmin.value || userId <= 0) return
    try {
      unwrapOk(await postOrgMemberPermission(ctx.orgId.value, { targetUserId: userId, canViewRevenue }), '更新权限失败')
      toast.success(canViewRevenue ? '已开启营收查看权限' : '已关闭营收查看权限')
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '更新权限失败')
    }
  }

  async function transferOwner(userId: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return false
    try {
      unwrapOk((await postApiOrgOrgIdTransferOwner(ctx.orgId.value, { targetUserId: userId })) as any, '移交失败')
      toast.success('已移交所有权')
      await Promise.all([load(), ctx.loadOrgInfo()])
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '移交失败')
      return false
    }
  }

  return { members, loading, error, search, filtered, load, remove, updateRole, updateRevenuePermission, transferOwner }
}
