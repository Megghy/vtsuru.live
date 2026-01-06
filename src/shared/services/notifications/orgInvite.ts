export type OrgInviteType = 'member' | 'streamer'

export interface OrgInviteNotification {
  id: string
  isReaded: boolean
  extra: Record<string, string>
}

export function isOrgInviteNotification(item: any): item is OrgInviteNotification {
  const action = item?.extra?.action
  return action === 'org-invite-member' || action === 'org-invite-streamer'
}

export function getOrgInviteType(item: any): OrgInviteType {
  const type = item?.extra?.type
  if (type === 'member') return 'member'
  if (type === 'streamer') return 'streamer'
  throw new Error('无效的邀请类型')
}

export function getOrgInviteToken(item: any): string {
  const token = item?.extra?.token
  if (typeof token === 'string' && token.trim()) return token
  throw new Error('无效的邀请 token')
}
