import type { Options } from '@tauri-apps/plugin-notification'
import { isPermissionGranted, sendNotification } from '@tauri-apps/plugin-notification'
import { openUrl } from '@tauri-apps/plugin-opener'

import type { QAInfo, ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { CN_HOST } from '@/shared/config'

import { useSettings } from '../store/useSettings'

export async function trySendNotification(option: Options) {
  const permissionGranted = await isPermissionGranted()
  if (permissionGranted) {
    sendNotification(option)
  }
}

export function onReceivedNotification(type: string, json: string) {
  console.log(`接收到通知: ${type}`, json)
  const data = JSON.parse(json)
  switch (type) {
    case 'question-box':
      onReceivedQuestion(data)
      break
    case 'goods-buy':
      onGoodsBuy(data)
      break
    default:
      console.warn(`Unhandled notification type: ${type}`)
  }
}

export async function onReceivedQuestion(question: QAInfo) {
  const setting = useSettings()
  if (setting.settings.notificationSettings.enableTypes.includes('question-box')) {
    useToast().add({
      color: 'info',
      title: '提问箱',
      description: `收到来自 [${question.sender?.name || question.anonymousName || '匿名用户'}] 的提问`,
      duration: 0,
      actions: [
        { label: '快速查看', color: 'primary', onClick: () => openUrl(`${CN_HOST}manage/question-box`) },
        { label: '查看详情', color: 'neutral', onClick: () => openUrl(`${CN_HOST}manage/question-box`) },
      ],
    })
    trySendNotification({
      title: '提问箱',
      body: `收到来自 [${question.sender?.name || question.anonymousName || '匿名用户'}] 的提问`,
      extra: { type: 'question-box' },
    })
  }
}

export function onGoodsBuy(info: { data: ResponsePointOrder2OwnerModel; goods: ResponsePointGoodModel }) {
  const setting = useSettings()
  const order = info.data
  const goods = info.goods
  if (setting.settings.notificationSettings.enableTypes.includes('goods-buy')) {
    useToast().add({
      color: 'info',
      title: '礼物兑换',
      description: `${order.customer.name} 兑换了你的 [${goods.name}]，数量: ${order.count}，总价: ${order.point} 元`,
      duration: 0,
      actions: [{ label: '查看详情', color: 'primary', onClick: () => openUrl(`${CN_HOST}manage/goods-buy`) }],
    })
    trySendNotification({
      title: '礼物兑换',
      body: `${order.customer.name} 兑换了你的 [${goods.name}]，数量: ${order.count}，总价: ${order.point} 元`,
      extra: { type: 'goods-buy' },
    })
  }
}

// 私信发送失败通知
export function onSendPrivateMessageFailed(receiverId: number, message: string, error: any) {
  const setting = useSettings()
  if (setting.settings.notificationSettings.enableTypes.includes('message-failed')) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    useToast().add({
      color: 'error',
      title: '私信发送失败',
      description: `向用户 ${receiverId} 发送私信失败: ${errorMsg}`,
      duration: 8000,
    })
    trySendNotification({
      title: '私信发送失败',
      body: `向用户 ${receiverId} 发送私信失败`,
      extra: { type: 'message-failed' },
    })
  }
}
