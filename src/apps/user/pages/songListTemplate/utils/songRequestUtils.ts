import type { Setting_LiveRequest, SongsInfo, UserInfo } from '@/api/api-models'

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
  special: '此项目有特殊要求, 请在直播间内点歌, 点歌弹幕已复制到剪切板',
  webDisabled: '主播不允许从网页点歌, 点歌弹幕已复制到剪切板',
  anonymousDisabled: '主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板',
} as const

const TOOLTIP_REASONS = {
  special: '点歌 | 此项目有特殊要求, 请在直播间内点歌, 点击后将复制点歌内容到剪切板',
  webDisabled: '点歌 | 主播不允许从网页点歌, 点击后将复制点歌内容到剪切板',
  anonymousDisabled: '点歌 | 主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点击后将复制点歌内容到剪切板',
} as const

function isAnonymousWebRequestBlocked(
  liveRequestSettings: Setting_LiveRequest | undefined,
  { isLoggedIn, isBiliAuthed }: SongRequestAuthState,
) {
  return !!liveRequestSettings?.allowFromWeb
    && !liveRequestSettings.allowAnonymousFromWeb
    && !isLoggedIn
    && !isBiliAuthed
}

function getCopyOnlyReason(
  song: SongsInfo,
  liveRequestSettings: Setting_LiveRequest | undefined,
  authState: SongRequestAuthState,
) {
  if (song.options) return COPY_REASONS.special
  if (isAnonymousWebRequestBlocked(liveRequestSettings, authState)) return COPY_REASONS.anonymousDisabled
  if (!liveRequestSettings?.allowFromWeb) return COPY_REASONS.webDisabled
}

/**
 * 获取点歌按钮的tooltip文本
 * @param song 歌曲信息
 * @param liveRequestSettings 直播点歌设置
 * @returns tooltip文本
 */
export function getSongRequestTooltip(
  song: SongsInfo,
  liveRequestSettings: Setting_LiveRequest | undefined,
  authState: SongRequestAuthState,
): string {
  if (song.options) return TOOLTIP_REASONS.special
  if (isAnonymousWebRequestBlocked(liveRequestSettings, authState)) return TOOLTIP_REASONS.anonymousDisabled
  if (liveRequestSettings?.allowFromWeb === false) return TOOLTIP_REASONS.webDisabled
  return '点歌'
}

/**
 * 获取点歌按钮的类型
 * @param song 歌曲信息
 * @param liveRequestSettings 直播点歌设置
 * @param authState 当前用户登录和B站授权状态
 * @returns 按钮类型
 */
export function getSongRequestButtonType(
  song: SongsInfo,
  liveRequestSettings: Setting_LiveRequest | undefined,
  authState: SongRequestAuthState,
): 'warning' | 'info' {
  return getCopyOnlyReason(song, liveRequestSettings, authState) ? 'warning' : 'info'
}

/**
 * 判断用户是否可以点歌
 * @param song 歌曲信息
 * @param userInfo 主播信息
 * @param liveRequestSettings 直播点歌设置
 * @param isLoggedIn 用户是否已登录
 * @param isBiliAuthed B站是否已授权
 * @param nextRequestTime 下次点歌时间
 * @returns 是否可以点歌和原因
 */
export function canRequestSong(
  song: SongsInfo,
  userInfo: UserInfo | undefined,
  liveRequestSettings: Setting_LiveRequest | undefined,
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
 * @param song 歌曲信息
 * @returns 点歌提示文本
 */
export function getSongRequestConfirmText(song: SongsInfo): string {
  return `确定要点 ${song.name} 么`
}
