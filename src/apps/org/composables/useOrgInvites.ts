import { ref } from 'vue'
import { useMessage } from 'naive-ui'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'
import type { OrgContext } from './useOrgContext'
import type { OrgInviteMemberListItem, OrgInviteResponseModel, OrgInviteStreamerListItem } from '../types'

type InviteKind = 'member' | 'streamer'

interface CreateInvitePayload {
  role?: number
  targetUserId?: number | null
  targetStreamerUserId?: number | null
  expireDays?: number | null
}

/** 成员/主播邀请逻辑统一封装，kind 决定接口路径与字段 */
export function useOrgInvites<T extends OrgInviteMemberListItem | OrgInviteStreamerListItem>(
  ctx: OrgContext,
  kind: InviteKind,
) {
  const message = useMessage()
  const invites = ref<T[]>([])
  const loading = ref(false)
  const creating = ref(false)
  const lastUrl = ref('')

  async function load() {
    if (!ctx.isOrgAdmin.value || !ctx.orgId.value) return
    loading.value = true
    try {
      invites.value = unwrapOk(
        await QueryGetAPI<T[]>(`${ORG_API_URL}${ctx.orgId.value}/invites/${kind}`),
        '加载邀请失败',
      )
    } catch (err) {
      message.error(err instanceof Error ? err.message : '加载邀请失败')
    } finally {
      loading.value = false
    }
  }

  async function create(payload: CreateInvitePayload) {
    if (!ctx.isOrgAdmin.value || !ctx.orgId.value) return
    creating.value = true
    try {
      const data = unwrapOk(
        await QueryPostAPI<OrgInviteResponseModel>(`${ORG_API_URL}${ctx.orgId.value}/invite/${kind}`, payload),
        '生成邀请失败',
      )
      lastUrl.value = data.joinUrl
      await load()
      return data.joinUrl
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成邀请失败')
    } finally {
      creating.value = false
    }
  }

  return { invites, loading, creating, lastUrl, load, create }
}
