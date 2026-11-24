import { getCurrentWindow } from '@tauri-apps/api/window'
import type { Options } from '@tauri-apps/plugin-notification'
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'
import { h } from 'vue'
import { toast } from 'vue-sonner'

import type { ResponsePointGoodModel } from '@/api/client-types'
import type { ResponsePointOrder2OwnerModel, ResponseQAInfoToTarget } from '@/api/generated/model'
import QuestionItem from '@/components/QuestionItem.vue'
import { CN_HOST, isTauri } from '@/shared/config'
import { dialog } from '@/shared/utils'

import type { NotificationType } from '../store/useSettings'
import { useSettings } from '../store/useSettings'
import type { NotificationTonePreset } from './notificationSound'
import { playNotificationTone } from './notificationSound'

export interface NotificationDispatchOptions {
  /** 关联的通知开关类别；不传时仅受总开关 enableNotification 控制 */
  type?: NotificationType
  /** 绕过“仅在后台/最小化时通知”限制（例如关键系统告警） */
  ignoreOnlyWhenHidden?: boolean
  /** 绕过全局总开关（仅用于系统关键自启状态提示等极少数场景） */
  bypassGlobalSwitch?: boolean
  /** 覆盖提示音设置 */
  playSound?: boolean
  /** 提示音预设 */
  soundPreset?: NotificationTonePreset
}

export interface CustomNotificationOptions {
  title: string
  body: string
  showDesktop?: boolean
  showToast?: boolean
  toastLevel?: 'info' | 'success' | 'warning' | 'error'
  toastDuration?: number
  playSound?: boolean
  soundPreset?: NotificationTonePreset
  bypassGlobalSwitch?: boolean
  extra?: Record<string, unknown>
}

const dedupTimestamps = new Map<string, number>()

function shouldEmitWithCooldown(key: string, cooldownMs: number): boolean {
  const now = Date.now()
  const prev = dedupTimestamps.get(key) ?? 0
  if (now - prev < cooldownMs) return false
  dedupTimestamps.set(key, now)
  return true
}

async function isMainWindowForeground(): Promise<boolean> {
  if (!isTauri()) return false
  try {
    const win = getCurrentWindow()
    const [visible, focused] = await Promise.all([win.isVisible(), win.isFocused()])
    return visible && focused
  } catch {
    return false
  }
}

export async function trySendNotification(
  option: Options,
  dispatchOptions?: NotificationDispatchOptions,
): Promise<boolean> {
  const settingStore = useSettings()
  const cfg = settingStore.settings
  const notifCfg = cfg.notificationSettings

  if (!dispatchOptions?.bypassGlobalSwitch && !cfg.enableNotification) {
    return false
  }
  if (dispatchOptions?.type && !notifCfg?.enableTypes?.includes(dispatchOptions.type)) {
    return false
  }

  const shouldPlaySound = dispatchOptions?.playSound ?? Boolean(notifCfg?.enableSound)
  const soundVolume = notifCfg?.soundVolume ?? 0.5

  if (notifCfg?.onlyWhenHidden && !dispatchOptions?.ignoreOnlyWhenHidden) {
    if (await isMainWindowForeground()) {
      return false
    }
  }

  if (shouldPlaySound) {
    void playNotificationTone(dispatchOptions?.soundPreset ?? 'chime', soundVolume)
  }

  if (!isTauri()) {
    return false
  }

  const permissionGranted = await isPermissionGranted()
  if (!permissionGranted) {
    return false
  }

  sendNotification(option)
  return true
}

/**
 * 统一自定义通知分发（供 AutoAction SEND_NOTIFICATION 等复用）
 */
export async function sendCustomClientNotification(options: CustomNotificationOptions): Promise<boolean> {
  const title = options.title.trim() || 'VTsuru 提醒'
  const body = options.body.trim()
  let sent = false

  if (options.showToast !== false) {
    const level = options.toastLevel ?? 'info'
    const toastFn = toast[level] ?? toast.info
    toastFn(title, {
      description: body || undefined,
      duration: options.toastDuration ?? 6000,
    })
    sent = true
  }

  if (options.showDesktop !== false) {
    const desktopSent = await trySendNotification(
      {
        title,
        body: body || title,
        extra: options.extra ?? { type: 'auto-action' },
      },
      {
        bypassGlobalSwitch: options.bypassGlobalSwitch,
        ignoreOnlyWhenHidden: true,
        playSound: options.playSound,
        soundPreset: options.soundPreset ?? 'chime',
      },
    )
    sent = sent || desktopSent
  } else if (options.playSound) {
    const volume = useSettings().settings.notificationSettings?.soundVolume ?? 0.5
    void playNotificationTone(options.soundPreset ?? 'chime', volume)
    sent = true
  }

  return sent
}

export function onReceivedNotification(type: string, json: string) {
  console.log(`接收到通知: ${type}`, json)
  const data = JSON.parse(json)
  switch (type) {
    case 'question-box':
      void onReceivedQuestion(data)
      break
    case 'goods-buy':
      onGoodsBuy(data)
      break
    default:
      console.warn(`Unhandled notification type: ${type}`)
  }
}

export async function onReceivedQuestion(question: ResponseQAInfoToTarget) {
  const setting = useSettings()
  if (!setting.settings.enableNotification) return
  if (!setting.settings.notificationSettings.enableTypes.includes('question-box')) return

  const senderName = question.sender?.name || question.anonymousName || '匿名用户'
  toast.info('提问箱', {
    description: `收到来自 [${senderName}] 的提问`,
    duration: Infinity,
    action: {
      label: '快速查看',
      onClick: () => {
        dialog.create({
          title: '快速查看',
          content: () => h(QuestionItem, { item: question }),
          class: 'sm:max-w-lg',
          positiveText: '关闭',
        })
      },
    },
    cancel: {
      label: '查看详情',
      onClick: () => {
        void openUrl(`${CN_HOST}manage/question-box`)
      },
    },
  })

  await trySendNotification(
    {
      title: '提问箱',
      body: `收到来自 [${senderName}] 的提问`,
      extra: { type: 'question-box' },
    },
    { type: 'question-box', soundPreset: 'chime' },
  )
}

export function onGoodsBuy(info: { data?: ResponsePointOrder2OwnerModel; goods?: ResponsePointGoodModel }) {
  const setting = useSettings()
  if (!setting.settings.enableNotification) return
  if (!setting.settings.notificationSettings.enableTypes.includes('goods-buy')) return

  const order = info.data
  const goods = info.goods
  if (!order || !goods) return

  const customerName = order.customer?.name || '观众'
  const goodsName = goods.name || '积分商品'
  const desc = `${customerName} 兑换了你的 [${goodsName}]，数量: ${order.count}，总价: ${order.point} 元`

  toast.info('礼物兑换', {
    description: desc,
    duration: Infinity,
    action: {
      label: '查看详情',
      onClick: () => {
        void openUrl(`${CN_HOST}manage/goods-buy`)
      },
    },
  })

  void trySendNotification(
    {
      title: '礼物兑换',
      body: desc,
      extra: { type: 'goods-buy' },
    },
    { type: 'goods-buy', soundPreset: 'chime' },
  )
}

export function onSendPrivateMessageFailed(receiverId: number, _message: string, error: unknown) {
  const errorMsg = error instanceof Error ? error.message : String(error)
  toast.error('私信发送失败', {
    description: `向用户 ${receiverId} 发送私信失败: ${errorMsg}`,
    duration: 8000,
  })

  void trySendNotification(
    {
      title: '私信发送失败',
      body: `向用户 ${receiverId} 发送私信失败`,
      extra: { type: 'message-failed' },
    },
    { type: 'message-failed', soundPreset: 'alert' },
  )
}

export function onSendLiveDanmakuFailed(roomId: number, message: string, error: unknown) {
  if (!shouldEmitWithCooldown(`live-danmaku-failed:${roomId}`, 8_000)) return
  const errorMsg = error instanceof Error ? error.message : String(error)
  void trySendNotification(
    {
      title: '直播弹幕发送失败',
      body: `房间 ${roomId} 发送「${message.slice(0, 20)}」失败: ${errorMsg}`,
      extra: { type: 'live-danmaku-failed' },
    },
    { type: 'live-danmaku-failed', soundPreset: 'alert' },
  )
}

export function onDanmakuConnectionAlert(title: string, reason: string) {
  if (!shouldEmitWithCooldown(`danmaku-alert:${title}`, 15_000)) return
  void trySendNotification(
    {
      title,
      body: reason,
      extra: { type: 'danmaku' },
    },
    { type: 'danmaku', soundPreset: 'alert' },
  )
}

export function onBiliCookieInvalid(accountLabel: string, reason?: string) {
  if (!shouldEmitWithCooldown(`cookie-invalid:${accountLabel}`, 5 * 60_000)) return
  const body = reason
    ? `账号「${accountLabel}」Cookie 已失效：${reason}`
    : `账号「${accountLabel}」B 站 Cookie 已失效，请重新登录`
  toast.warning('B 站 Cookie 已失效', {
    description: body,
    duration: 8000,
  })
  void trySendNotification(
    {
      title: 'B 站 Cookie 已失效',
      body,
      extra: { type: 'cookie-invalid' },
    },
    { type: 'cookie-invalid', soundPreset: 'alert' },
  )
}

export function onLiveStatusChanged(isLive: boolean, roomTitle?: string) {
  const title = isLive ? '直播已开始' : '直播已结束'
  const body = isLive
    ? roomTitle
      ? `正在直播：${roomTitle}`
      : '检测到直播间已开播'
    : '检测到直播间已下播'

  void trySendNotification(
    {
      title,
      body,
      extra: { type: 'live-status', isLive },
    },
    { type: 'live-status', soundPreset: isLive ? 'chime' : 'soft' },
  )
}

export function notifyClientUpdate(version: string) {
  void trySendNotification(
    {
      title: 'VTsuru.Client 更新可用',
      body: `发现新版本 ${version}，点击打开客户端可立即更新`,
      extra: { type: 'update', version },
    },
    { type: 'update', soundPreset: 'chime' },
  )
}

export function notifyBootMinimized() {
  void trySendNotification(
    {
      title: 'VTsuru.Client',
      body: '已随系统启动并最小化到托盘',
      extra: { type: 'boot-minimized' },
    },
    { ignoreOnlyWhenHidden: true, playSound: false },
  )
}
