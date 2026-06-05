const DEFAULT_AVATAR = 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'
const DEFAULT_COVER = 'https://cube.elemecdn.com/e/fd/0fc7d20532fdaf769a25683617711png.png'

export { DEFAULT_AVATAR, DEFAULT_COVER }

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

export function roleTagType(role: number): 'success' | 'info' | 'default' {
  if (role === 0) return 'success'
  if (role === 1) return 'info'
  return 'default'
}

export function streamerStatusLabel(status: number): string {
  if (status === 0) return 'Pending'
  if (status === 1) return 'Active'
  if (status === 2) return 'Rejected'
  if (status === 3) return 'Removed'
  return String(status)
}

export function streamerStatusTagType(status: number): 'default' | 'success' | 'warning' | 'error' | 'info' {
  if (status === 1) return 'success'
  if (status === 0) return 'warning'
  if (status === 2) return 'error'
  return 'default'
}

export function inviteStatusLabel(status: number): string {
  const map: Record<number, string> = {
    0: '有效', 1: '已过期', 2: '已撤销', 3: '已使用', 4: '已接受', 5: '已拒绝',
  }
  return map[status] ?? `未知(${status})`
}

export function inviteStatusTagType(status: number): 'success' | 'info' | 'warning' | 'error' | 'default' {
  const map: Record<number, 'success' | 'info' | 'warning' | 'error' | 'default'> = {
    0: 'success', 4: 'success', 1: 'warning', 2: 'error', 5: 'error', 3: 'info',
  }
  return map[status] ?? 'default'
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp > 1e10 ? timestamp : timestamp * 1000)
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** 导出 CSV，自动转义并加 BOM 以兼容 Excel 中文 */
export function exportCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const content = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n')
  const blob = new Blob([`﻿${content}`], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
