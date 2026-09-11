import { OpenLiveLotteryType, type OpenLiveLotteryUserInfo } from '@/api/api-models'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'

import type { LotteryOption } from './lotteryTypes'

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

export function getAvatarUrl(avatar: string): string {
  if (!avatar || avatar === 'https://i2.hdslb.com/bfs/face/member/noface.jpg') {
    return 'https://i2.hdslb.com/bfs/face/member/noface.jpg'
  }
  if (avatar.includes('@')) {
    return avatar.replace(/@\w+/, '@96w_96h')
  }
  return `${avatar}@96w_96h`
}

/** 幻星 H5 身份码优先，管理端回退到已绑定的 B 站身份码 */
export function resolveLotteryIdentityCode(propCode?: string, biliAuthCode?: string): string {
  return propCode?.trim() || biliAuthCode?.trim() || ''
}

export function buildLotteryObsUrl(host: string, userId?: number | string | null, code?: string): string {
  const idUrl = buildObsSourceUrl({
    path: 'obs/live-lottery',
    host,
    credential: 'public-id',
    userId,
  })
  if (idUrl) return idUrl
  const trimmed = code?.trim()
  if (!trimmed) return ''
  return buildObsSourceUrl({
    path: 'obs/live-lottery',
    host,
    credential: 'none',
    params: { code: trimmed },
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
