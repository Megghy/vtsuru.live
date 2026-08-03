import { computed, ref } from 'vue'

import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

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
        await QueryGetAPI<OrgMemberItem[]>(`${ORG_API_URL}${ctx.orgId.value}/members`),
        '加载成员失败',
      )
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : '加载成员失败')
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
      showSuccessToast('移除成功')
      await load()
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : '移除失败')
    }
  }

  async function updateRole(userId: number, role: number) {
    if (ctx.myRole.value !== 0 || userId <= 0) return
    try {
      unwrapOk(
        await QueryPostAPI(`${ORG_API_URL}${ctx.orgId.value}/member/role`, { targetUserId: userId, role }),
        '更新角色失败',
      )
      showSuccessToast('已更新角色')
      await load()
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : '更新角色失败')
    }
  }

  return { members, loading, search, filtered, load, remove, updateRole }
}
