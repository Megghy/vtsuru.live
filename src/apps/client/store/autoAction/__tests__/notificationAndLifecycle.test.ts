import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  sendNotificationMock,
  isPermissionGrantedMock,
  toastInfoMock,
  toastErrorMock,
  toastWarningMock,
  obsPublishMock,
  speakTextMock,
} = vi.hoisted(() => ({
  sendNotificationMock: vi.fn(),
  isPermissionGrantedMock: vi.fn(async () => true),
  toastInfoMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastWarningMock: vi.fn(),
  obsPublishMock: vi.fn(async () => {}),
  speakTextMock: vi.fn(async () => {}),
}))

vi.mock('@tauri-apps/plugin-notification', () => ({
  isPermissionGranted: isPermissionGrantedMock,
  sendNotification: sendNotificationMock,
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    isVisible: async () => true,
    isFocused: async () => true,
  }),
}))

vi.mock('@/shared/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared/config')>()
  return {
    ...actual,
    isTauri: () => true,
  }
})

vi.mock('vue-sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: toastInfoMock,
    warning: toastWarningMock,
    error: toastErrorMock,
  },
}))

vi.mock('@/store/useOBSNotification', () => ({
  useOBSNotification: () => ({
    publish: obsPublishMock,
  }),
}))

vi.mock('@/store/useSpeechService', () => ({
  useSpeechService: () => ({
    speakText: speakTextMock,
  }),
}))

vi.mock('@/apps/client/data/notificationSound', () => ({
  playNotificationTone: vi.fn(async () => {}),
}))

import { onGoodsBuy, onReceivedQuestion, trySendNotification } from '@/apps/client/data/notification'
import {
  executeObsNotifyAction,
  executeSendNotificationAction,
  executeSendWebhookAction,
  executeSpeakTtsAction,
} from '@/apps/client/store/autoAction/modules/notificationActions'
import { ActionType, LIFECYCLE_TRIGGER_TYPES, TriggerType } from '@/apps/client/store/autoAction/types'
import { buildExecutionContext, createDefaultAutoAction, createDefaultRuntimeState } from '@/apps/client/store/autoAction/utils'
import { useSettings } from '@/apps/client/store/useSettings'

describe('Client 通知校验与 AutoAction 通知扩展', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    sendNotificationMock.mockClear()
    toastInfoMock.mockClear()
    toastErrorMock.mockClear()
    toastWarningMock.mockClear()
    obsPublishMock.mockClear()
    speakTextMock.mockClear()
    isPermissionGrantedMock.mockResolvedValue(true)
  })

  it('关闭桌面通知总开关时，提问箱与礼物兑换不应再弹出系统通知或 toast', async () => {
    const settingsStore = useSettings()
    settingsStore.settings.enableNotification = false
    settingsStore.settings.notificationSettings.enableTypes = ['question-box', 'goods-buy']

    await onReceivedQuestion({ sender: { name: '提问观众' } } as any)
    onGoodsBuy({
      data: { count: 1, point: 100, customer: { name: '兑换观众' } } as any,
      goods: { name: '钥匙扣' } as any,
    })

    expect(sendNotificationMock).not.toHaveBeenCalled()
    expect(toastInfoMock).not.toHaveBeenCalled()
  })

  it('开启 onlyWhenHidden 且主窗前台聚焦时跳过系统通知', async () => {
    const settingsStore = useSettings()
    settingsStore.settings.enableNotification = true
    settingsStore.settings.notificationSettings.onlyWhenHidden = true
    settingsStore.settings.notificationSettings.enableTypes = ['danmaku']

    const sent = await trySendNotification({ title: '测试', body: '内容' }, { type: 'danmaku' })
    expect(sent).toBe(false)
    expect(sendNotificationMock).not.toHaveBeenCalled()
  })

  it('生命周期触发器默认启用 SEND_NOTIFICATION 且 onlyDuringLive 为 false', () => {
    for (const tt of LIFECYCLE_TRIGGER_TYPES) {
      const rule = createDefaultAutoAction(tt)
      expect(rule.actionType).toBe(ActionType.SEND_NOTIFICATION)
      expect(rule.triggerConfig.onlyDuringLive).toBe(false)
    }
  })

  it('SEND_NOTIFICATION 支持标题与正文模板插值及绕过总开关', async () => {
    const settingsStore = useSettings()
    settingsStore.settings.enableNotification = false

    const action = createDefaultAutoAction(TriggerType.LIVE_START)
    action.actionConfig.notificationTitle = '开播了: {{live.title}}'
    action.actionConfig.notificationBypassGlobalSwitch = true
    action.template = '房间 {{live.roomId}} 准备就绪'

    const runtime = createDefaultRuntimeState()
    const ctx = buildExecutionContext(null, 12345, TriggerType.LIVE_START, {
      live: { title: '杂谈回', roomId: 12345 },
    })

    const summary = await executeSendNotificationAction(action, ctx, runtime)
    expect(summary).toContain('[开播了: 杂谈回] 房间 12345 准备就绪')
    expect(sendNotificationMock).toHaveBeenCalledTimes(1)
    expect(sendNotificationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '开播了: 杂谈回',
        body: '房间 12345 准备就绪',
      }),
    )
  })

  it('OBS_NOTIFY 与 SPEAK_TTS 正确调用对应服务', async () => {
    const runtime = createDefaultRuntimeState()
    const ctx = buildExecutionContext({ uname: '老板', uid: 1, msg: '测试' }, 123, TriggerType.DANMAKU)

    const obsAction = createDefaultAutoAction(TriggerType.DANMAKU)
    obsAction.actionType = ActionType.OBS_NOTIFY
    obsAction.actionConfig.obsNotifyTitle = '新触发'
    obsAction.template = '来自 {{user.name}} 的触发'
    await executeObsNotifyAction(obsAction, ctx, runtime)
    expect(obsPublishMock).toHaveBeenCalledWith(
      expect.objectContaining({
        Title: '新触发',
        Message: '来自 老板 的触发',
        Source: 'auto-action',
      }),
    )

    const ttsAction = createDefaultAutoAction(TriggerType.DANMAKU)
    ttsAction.actionType = ActionType.SPEAK_TTS
    ttsAction.template = '感谢 {{user.name}}'
    await executeSpeakTtsAction(ttsAction, ctx, runtime)
    expect(speakTextMock).toHaveBeenCalledWith('感谢 老板')
  })

  it('SEND_WEBHOOK 校验协议并拒绝非法地址', async () => {
    const runtime = createDefaultRuntimeState()
    const ctx = buildExecutionContext(null, 123, TriggerType.LIVE_START)
    const webhookAction = createDefaultAutoAction(TriggerType.LIVE_START)
    webhookAction.actionType = ActionType.SEND_WEBHOOK
    webhookAction.actionConfig.webhookUrl = 'ftp://invalid.local/hook'

    await expect(executeSendWebhookAction(webhookAction, ctx, runtime)).rejects.toThrow('仅支持 http/https 协议')
  })
})
