import { useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'

import type { OrgMemberItem } from '../types'
import type { OrgContext } from './useOrgContext'

export function useOrgMembers(ctx: OrgContext) {
  const message = useMessage()
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
        await QueryGetAPI<OrgMemberItem[]>(`${ORG_API_URL}${ctx.orgId.value}/members`),
        '加载成员失败',
      )
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载成员失败')
    } finally {
      loading.value = false
    }
  }

  async function remove(userId: number) {
    if (!ctx.isOrgAdmin.value || userId <= 0) return
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/member/remove`, { targetUserId: userId }),
        '移除失败',
      )
      message.success('移除成功')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '移除失败')
    }
  }

  async function updateRole(userId: number, role: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/member/role`, { targetUserId: userId, role }),
        '更新角色失败',
      )
      message.success('已更新角色')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '更新角色失败')
    }
  }

  async function transferOwner(userId: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/transfer-owner`, { targetUserId: userId }),
        '移交失败',
      )
      message.success('已移交所有权')
      await load()
      await ctx.loadOrgInfo()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '移交失败')
    }
  }

  return { members, loading, search, filtered, load, remove, updateRole, transferOwner }
}
