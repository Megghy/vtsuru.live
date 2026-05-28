import type { OpenLiveLotteryUserInfo } from '@/api/api-models'
import type { LotteryOption } from './lotteryTypes'

export function getRandomInt(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max
}

export function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr]
  for (let i = result.length - 1; i > 0; i--) {
    const j = getRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]]
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
