import { OpenLiveLotteryType, type OpenLiveLotteryUserInfo } from '@/api/api-models'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'

import type { LotteryOption } from './lotteryTypes'

export type LotteryObsStyle = 'slate' | 'transparent' | 'champagne' | 'classic'
export type LotteryObsMode = 'card' | 'banner' | 'compact' | 'grid'

export function getRandomInt(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function isUserValid(
  u: OpenLiveLotteryUserInfo,
  danmu: { cmd: string; data: any },
  option: LotteryOption,
): boolean {
  const { cmd, data } = danmu
  if (option.needWearFanMedal && !u.fans_medal_wearing_status) return false
  if (option.needFanMedal && u.fans_medal_level === 0) return false
  if (option.needGuard && u.guard_level === 0) return false

  if (option.danmakuKeyword && cmd === 'LIVE_OPEN_PLATFORM_DM') {
    if (option.danmakuFilterType === 'contains') {
      if (!data.msg.includes(option.danmakuKeyword)) return false
    } else if (option.danmakuFilterType === 'regex') {
      if (!data.msg.match(option.danmakuKeyword)) return false
    } else {
      if (data.msg !== option.danmakuKeyword) return false
    }
  }

  if ((option.giftMinPrice ?? 0) > 0 && cmd === 'LIVE_OPEN_PLATFORM_SEND_GIFT') {
    if ((data.price * data.gift_num) / 1000 < (option.giftMinPrice ?? 0)) return false
  }
  if (option.giftName && cmd === 'LIVE_OPEN_PLATFORM_SEND_GIFT') {
    if (data.gift_name !== option.giftName) return false
  }
  return true
}

export const DEFAULT_LOTTERY_AVATAR =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="%2364748b"><circle cx="24" cy="24" r="24" fill="%23334155"/><path d="M24 23a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm0 4c-6.67 0-14 3.34-14 8v1a2 2 0 0 0 2 2h24a2 2 0 0 0 2-2v-1c0-4.66-7.33-8-14-8Z" fill="%2394a3b8"/></svg>'

/** 幻星 H5 身份码优先，管理端回退到已绑定的 B 站身份码 */
export function resolveLotteryIdentityCode(propCode?: string, biliAuthCode?: string): string {
  return propCode?.trim() || biliAuthCode?.trim() || ''
}

export function formatLotteryAvatar(avatar?: string, size = 48): string {
  if (!avatar || typeof avatar !== 'string') {
    return DEFAULT_LOTTERY_AVATAR
  }
  const trimmed = avatar.trim()
  if (
    !trimmed ||
    trimmed.includes('noface') ||
    (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('data:image/'))
  ) {
    return DEFAULT_LOTTERY_AVATAR
  }
  if ((trimmed.includes('hdslb.com') || trimmed.includes('biliimg.com')) && !trimmed.includes('@')) {
    return `${trimmed}@${size}w_${size}h`
  }
  return trimmed
}

export function getAvatarUrl(avatar?: string): string {
  if (!avatar) return DEFAULT_LOTTERY_AVATAR
  const trimmed = avatar.trim()
  if (!trimmed || trimmed.includes('noface')) {
    return DEFAULT_LOTTERY_AVATAR
  }
  if (trimmed.includes('@')) {
    return trimmed.replace(/@\w+/, '@96w_96h')
  }
  if (trimmed.includes('hdslb.com') || trimmed.includes('biliimg.com')) {
    return `${trimmed}@96w_96h`
  }
  return trimmed
}

export function buildLotteryObsUrl(
  host: string,
  userId?: number | string | null,
  code?: string,
  style?: LotteryObsStyle | string,
  mode?: LotteryObsMode | string,
): string {
  const extraParams: Record<string, string> = {}
  if (style && style !== 'slate') {
    extraParams.style = style
  }
  if (mode && mode !== 'card') {
    extraParams.mode = mode
  }
  const idUrl = buildObsSourceUrl({
    path: 'obs/live-lottery',
    host,
    credential: 'public-id',
    userId,
    params: extraParams,
  })
  if (idUrl) return idUrl
  const trimmed = code?.trim()
  if (!trimmed) return ''
  return buildObsSourceUrl({
    path: 'obs/live-lottery',
    host,
    credential: 'none',
    params: { code: trimmed, ...extraParams },
  })
}

export function shouldSyncLiveLottery(state: {
  originCount: number
  resultCount: number
  drawing: boolean
  finished: boolean
}): boolean {
  return state.originCount > 0 || state.resultCount > 0 || state.drawing || state.finished
}

export function buildLiveLotterySyncBody(options: {
  code?: string
  users: OpenLiveLotteryUserInfo[]
  resultUsers: OpenLiveLotteryUserInfo[]
  drawing: boolean
  finished: boolean
}) {
  const code = options.code?.trim()
  return {
    ...(code ? { code } : {}),
    users: options.users,
    resultUsers: options.resultUsers,
    type: options.finished
      ? OpenLiveLotteryType.Result
      : options.drawing
        ? OpenLiveLotteryType.Drawing
        : OpenLiveLotteryType.Waiting,
  }
}
