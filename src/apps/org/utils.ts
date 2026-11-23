import { OrgInviteStatuses } from '@/api/generated/model/orgInviteStatuses'

const DEFAULT_AVATAR = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
const DEFAULT_COVER = 'https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png'

export { DEFAULT_AVATAR, DEFAULT_COVER, OrgInviteStatuses }

/** 给 B 站头像/封面附加尺寸后缀，已带 `@` 的直接返回 */
export function withImageSize(url: string | null | undefined, suffix: string): string {
  if (!url) return ''
  return url.includes('@') ? url : `${url}${suffix}`
}

export function roleLabel(role: number): string {
  if (role === 0) return 'Owner'
  if (role === 1) return 'Admin'
  return 'Member'
}

export function streamerStatusLabel(status: number): string {
  if (status === 0) return '待确认'
  if (status === 1) return '已授权'
  if (status === 2) return '已拒绝'
  if (status === 3) return '已移除'
  return String(status)
}

export function streamerStatusBadgeClass(status: number): string {
  if (status === 1) return 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
  if (status === 0) return 'text-amber-600 border-amber-500/30 bg-amber-500/10'
  if (status === 2) return 'text-destructive border-destructive/30 bg-destructive/10'
  return 'text-muted-foreground border-border/60 bg-muted/40'
}

export function inviteStatusLabel(status: number): string {
  switch (status) {
    case OrgInviteStatuses.Active:
      return '有效'
    case OrgInviteStatuses.Used:
      return '已使用'
    case OrgInviteStatuses.Accepted:
      return '已接受'
    case OrgInviteStatuses.Rejected:
      return '已拒绝'
    case OrgInviteStatuses.Expired:
      return '已过期'
    case OrgInviteStatuses.Revoked:
      return '已撤销'
    default:
      return `未知(${status})`
  }
}

export function inviteStatusBadgeClass(status: number): string {
  switch (status) {
    case OrgInviteStatuses.Active:
      return 'text-emerald-600 border-emerald-500/30 bg-emerald-500/10'
    case OrgInviteStatuses.Accepted:
      return 'text-primary border-primary/30 bg-primary/10'
    case OrgInviteStatuses.Used:
      return 'text-sky-600 border-sky-500/30 bg-sky-500/10'
    case OrgInviteStatuses.Expired:
      return 'text-amber-600 border-amber-500/30 bg-amber-500/10'
    case OrgInviteStatuses.Rejected:
    case OrgInviteStatuses.Revoked:
      return 'text-destructive border-destructive/30 bg-destructive/10'
    default:
      return 'text-muted-foreground border-border/60'
  }
}

export function canRevokeInvite(status: number, isRevoked: boolean): boolean {
  if (isRevoked) return false
  return status === OrgInviteStatuses.Active || status === OrgInviteStatuses.Used
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

export function formatMinutes(minutes: number | null | undefined): string {
  const m = Math.max(0, Math.round(minutes ?? 0))
  if (m < 60) return `${m} 分钟`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest > 0 ? `${h}h ${rest}m` : `${h}h`
}

/** 导出 CSV，自动转义并加 BOM 以兼容 Excel 中文 */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const content = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
