import type { SongRequestOption } from '@/api/api-models'
import { GetGuardColor } from '@/shared/utils'

export type SongOptionBadgeTone = 'default' | 'info' | 'success' | 'warning' | 'error'

export interface SongOptionBadge {
  key: string
  label: string
  type: SongOptionBadgeTone
  /** 舰长/提督/总督的色值，用于 guard 风格 */
  color?: string
}

export function getSongOptionBadges(options?: SongRequestOption | null): SongOptionBadge[] {
  if (!options) return []

  const badges: SongOptionBadge[] = []
  if (options.needJianzhang) {
    badges.push({ key: 'captain', label: '舰长', type: 'info', color: GetGuardColor(1) })
  }
  if (options.needTidu) {
    badges.push({ key: 'admiral', label: '提督', type: 'warning', color: GetGuardColor(2) })
  }
  if (options.needZongdu) {
    badges.push({ key: 'governor', label: '总督', type: 'error', color: GetGuardColor(3) })
  }
  if ((options.fanMedalMinLevel ?? 0) > 0) {
    badges.push({
      key: 'medal',
      label: `粉丝牌 Lv${options.fanMedalMinLevel}`,
      type: 'success',
    })
  }
  if ((options.scMinPrice ?? 0) > 0) {
    badges.push({
      key: 'sc',
      label: `SC ¥${options.scMinPrice}`,
      type: 'error',
    })
  }
  return badges
}
