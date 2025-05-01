import { useAccount } from '@/api/account'
import { Setting_LiveRequest, SongsInfo, UserInfo } from '@/api/api-models'
import { useBiliAuth } from '@/store/useBiliAuth';

/**
 * 获取点歌按钮的tooltip文本
 * @param song 歌曲信息
 * @param liveRequestSettings 直播点歌设置
 * @param isLoggedIn 用户是否已登录
 * @param isBiliAuthed B站是否已授权
 * @returns tooltip文本
 */
export function getSongRequestTooltip(
  song: SongsInfo,
  liveRequestSettings: Setting_LiveRequest | undefined
): string {
  const accountInfo = useAccount();
  const biliAuth = useBiliAuth();
  // 歌曲有特殊要求
  if (song.options) {
    return '点歌 | 此项目有特殊要求, 请在直播间内点歌, 点击后将复制点歌内容到剪切板'
  }

  // 主播不允许从网页点歌
  if (liveRequestSettings?.allowFromWeb === false) {
    return '点歌 | 主播不允许从网页点歌, 点击后将复制点歌内容到剪切板'
  }

  // 主播不允许匿名点歌且用户未登录
  if (liveRequestSettings?.allowFromWeb &&
      !liveRequestSettings.allowAnonymousFromWeb &&
      !accountInfo.value.id &&
      !biliAuth.isAuthed) {
    return '点歌 | 主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点击后将复制点歌内容到剪切板'
  }

  // 用户未登录
  if (!accountInfo.value.id && !biliAuth.isAuthed) {
    return '点歌 | 根据主播设置, 需要登录后才能点歌'
  }

  return '点歌'
}

/**
 * 获取点歌按钮的类型
 * @param song 歌曲信息
 * @param liveRequestSettings 直播点歌设置
 * @param isLoggedIn 用户是否已登录
 * @param isBiliAuthed B站是否已授权
 * @returns 按钮类型
 */
export function getSongRequestButtonType(
  song: SongsInfo,
  liveRequestSettings: Setting_LiveRequest | undefined,
  isLoggedIn: boolean = true,
  isBiliAuthed: boolean = false
): 'warning' | 'info' {
  if (song.options ||
      liveRequestSettings?.allowFromWeb === false ||
      (liveRequestSettings?.allowFromWeb &&
       !liveRequestSettings.allowAnonymousFromWeb &&
       !isLoggedIn &&
       !isBiliAuthed)) {
    return 'warning'
  }

  return 'info'
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
  isBiliAuthed: boolean = false,
  nextRequestTime?: Date
): { canRequest: boolean; reason?: string; shouldCopyOnly?: boolean } {
  // 检查主播信息
  if (!userInfo?.id) {
    return { canRequest: false, reason: '无法获取主播信息，无法完成点歌' }
  }

  // 判断是否应该只复制到剪贴板
  const shouldCopyOnly = song.options ||
    !liveRequestSettings?.allowFromWeb ||
    (liveRequestSettings?.allowFromWeb &&
     !liveRequestSettings.allowAnonymousFromWeb &&
     !isLoggedIn &&
     !isBiliAuthed)

  if (shouldCopyOnly) {
    let reason = ''

    if (song.options) {
      reason = '此项目有特殊要求, 请在直播间内点歌, 点歌弹幕已复制到剪切板'
    } else if (!liveRequestSettings?.allowAnonymousFromWeb && !isLoggedIn && !isBiliAuthed) {
      reason = '主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板'
    } else if (!liveRequestSettings?.allowFromWeb) {
      reason = '主播不允许从网页点歌, 点歌弹幕已复制到剪切板'
    }

    return { canRequest: false, reason, shouldCopyOnly: true }
  }

  // 检查点歌冷却时间
  if (!isLoggedIn && nextRequestTime && nextRequestTime > new Date()) {
    const remainingSeconds = Math.ceil((nextRequestTime.getTime() - new Date().getTime()) / 1000)
    return {
      canRequest: false,
      reason: `距离点歌冷却还有${remainingSeconds}秒`
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