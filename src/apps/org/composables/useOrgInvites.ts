import { useMessage } from 'naive-ui'
import { ref } from 'vue'

import {
  getApiOrgOrgIdInvitesMember,
  getApiOrgOrgIdInvitesStreamer,
  postApiOrgOrgIdInvitesMember,
  postApiOrgOrgIdInvitesRevoke,
  postApiOrgOrgIdInvitesStreamer,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'

import type { OrgInviteMemberListItem, OrgInviteResponseModel, OrgInviteStreamerListItem } from '../types'
import type { OrgContext } from './useOrgContext'

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
        (await (kind === 'member'
          ? getApiOrgOrgIdInvitesMember(ctx.orgId.value)
          : getApiOrgOrgIdInvitesStreamer(ctx.orgId.value))) as any,
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
      const resp =
        kind === 'member'
          ? await postApiOrgOrgIdInvitesMember(ctx.orgId.value, payload as never)
          : await postApiOrgOrgIdInvitesStreamer(ctx.orgId.value, payload as never)
      const data = unwrapOk(resp, '生成邀请失败')
      lastUrl.value = data.joinUrl
      await load()
      return data.joinUrl
    } catch (err) {
      message.error(err instanceof Error ? err.message : '生成邀请失败')
    } finally {
      creating.value = false
    }
  }

  async function revoke(token: string) {
    if (!ctx.isOrgAdmin.value || !ctx.orgId.value || !token) return
    try {
      unwrapOk(
        (await postApiOrgOrgIdInvitesRevoke(ctx.orgId.value, {
          type: kind as any,
          token,
        })) as any,
        '撤销失败',
      )
      message.success('已撤销邀请')
      await load()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '撤销失败')
    }
  }

  return { invites, loading, creating, lastUrl, load, create, revoke }
}
