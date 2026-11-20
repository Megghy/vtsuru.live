import type { ResponseSongModel, ResponseUserInfo, SettingSongRequest, SongRequestOption } from '@/api/generated/model'

interface SongRequestAuthState {
  isLoggedIn: boolean
  isBiliAuthed: boolean
}

export interface SongRequestCheckResult {
  canRequest: boolean
  reason?: string
  shouldCopyOnly?: boolean
}

const COPY_REASONS = {
  webDisabled: '主播不允许从网页点歌, 点歌弹幕已复制到剪切板',
  anonymousDisabled: '主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板',
  biliAuthRequired: '此歌曲有大航海或粉丝牌要求, 请先绑定 B 站账号后再网页点歌, 点歌弹幕已复制到剪切板',
} as const

const TOOLTIP_REASONS = {
  webDisabled: '点歌 | 主播不允许从网页点歌, 点击后将复制点歌内容到剪切板',
  anonymousDisabled: '点歌 | 主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点击后将复制点歌内容到剪切板',
  biliAuthRequired: '点歌 | 此歌曲有大航海或粉丝牌要求, 需先绑定 B 站账号验证身份, 点击将复制弹幕到剪切板',
} as const

function describeGuardTiers(options?: SongRequestOption): string {
  if (!options) return ''
  const tiers: string[] = []
  if (options.needJianzhang) tiers.push('舰长')
  if (options.needTidu) tiers.push('提督')
  if (options.needZongdu) tiers.push('总督')
  return tiers.join('/')
}

function hasGuardOrMedalRequirement(options?: SongRequestOption): boolean {
  if (!options) return false
  return Boolean(options.needJianzhang || options.needTidu || options.needZongdu || (options.fanMedalMinLevel ?? 0) > 0)
}

function hasScRequirement(options?: SongRequestOption): boolean {
  return (options?.scMinPrice ?? 0) > 0
}

function formatRequirementSummary(options?: SongRequestOption): string {
  if (!options) return ''
  const parts: string[] = []
  const guardLabel = describeGuardTiers(options)
  if (guardLabel) parts.push(guardLabel)
  if ((options.fanMedalMinLevel ?? 0) > 0) parts.push(`粉丝牌≥${options.fanMedalMinLevel}级`)
  if ((options.scMinPrice ?? 0) > 0) parts.push(`SC≥¥${options.scMinPrice}`)
  return parts.join(' · ')
}

function isAnonymousWebRequestBlocked(
  liveRequestSettings: SettingSongRequest | undefined,
  { isLoggedIn, isBiliAuthed }: SongRequestAuthState,
) {
  return (
    !!liveRequestSettings?.allowFromWeb && !liveRequestSettings.allowAnonymousFromWeb && !isLoggedIn && !isBiliAuthed
  )
}

function getCopyOnlyReason(
  song: ResponseSongModel,
  liveRequestSettings: SettingSongRequest | undefined,
  authState: SongRequestAuthState,
) {
  if (hasScRequirement(song.options)) {
    return `此歌曲要求在直播间发送至少 ¥${song.options?.scMinPrice} 的 SC 醒目留言, 点歌弹幕已复制到剪切板`
  }
  if (!liveRequestSettings?.allowFromWeb) return COPY_REASONS.webDisabled
  if (hasGuardOrMedalRequirement(song.options) && !authState.isBiliAuthed) {
    return COPY_REASONS.biliAuthRequired
  }
  if (isAnonymousWebRequestBlocked(liveRequestSettings, authState)) return COPY_REASONS.anonymousDisabled
  return undefined
}

/**
 * 获取点歌按钮的tooltip文本
 */
export function getSongRequestTooltip(
  song: ResponseSongModel,
  liveRequestSettings: SettingSongRequest | undefined,
  authState: SongRequestAuthState,
): string {
  if (hasScRequirement(song.options)) {
    return `点歌 | 需直播间 SC ≥ ¥${song.options?.scMinPrice}, 点击后将复制点歌内容到剪切板`
  }
  if (liveRequestSettings?.allowFromWeb === false) return TOOLTIP_REASONS.webDisabled
  if (hasGuardOrMedalRequirement(song.options) && !authState.isBiliAuthed) {
    return TOOLTIP_REASONS.biliAuthRequired
  }
  if (isAnonymousWebRequestBlocked(liveRequestSettings, authState)) return TOOLTIP_REASONS.anonymousDisabled

  const extras: string[] = []
  const reqSummary = formatRequirementSummary(song.options)
  if (reqSummary) extras.push(`要求 ${reqSummary}`)

  const pointCost = liveRequestSettings?.enablePointRequest ? (liveRequestSettings.pointRequestCost ?? 0) : 0
  if (pointCost > 0) extras.push(`消耗 ${pointCost} 积分`)
  if (liveRequestSettings?.allowPointPriority) extras.push('可积分插队')

  return extras.length > 0 ? `点歌 (${extras.join(' · ')})` : '点歌'
}

/**
 * 获取点歌按钮的类型
 */
export function getSongRequestButtonType(
  song: ResponseSongModel,
  liveRequestSettings: SettingSongRequest | undefined,
  authState: SongRequestAuthState,
): 'warning' | 'info' {
  return getCopyOnlyReason(song, liveRequestSettings, authState) ? 'warning' : 'info'
}

/**
 * 判断用户是否可以点歌
 */
export function canRequestSong(
  song: ResponseSongModel,
  userInfo: ResponseUserInfo | undefined,
  liveRequestSettings: SettingSongRequest | undefined,
  isLoggedIn: boolean,
  isBiliAuthed: boolean,
  nextRequestTime?: Date,
): SongRequestCheckResult {
  const reason = getCopyOnlyReason(song, liveRequestSettings, { isLoggedIn, isBiliAuthed })
  if (reason) {
    return { canRequest: false, reason, shouldCopyOnly: true }
  }

  if (!userInfo?.id) {
    return { canRequest: false, reason: '无法获取主播信息，无法完成点歌' }
  }

  if (!isLoggedIn && nextRequestTime && nextRequestTime > new Date()) {
    const remainingSeconds = Math.ceil((nextRequestTime.getTime() - new Date().getTime()) / 1000)
    return {
      canRequest: false,
      reason: `距离点歌冷却还有${remainingSeconds}秒`,
    }
  }

  return { canRequest: true }
}

/**
 * 生成点歌的提示文本
 */
export function getSongRequestConfirmText(song: ResponseSongModel): string {
  return `确定要点 ${song.name} 么`
}
