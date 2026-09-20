import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import type { EventModel } from '@/api/api-models'
const mocks = vi.hoisted(() => ({ switchExpression: vi.fn(), history: vi.fn() }))
vi.mock('../../usePngtuberDriver', () => ({ usePngtuberDriver: () => ({ switchExpression: mocks.switchExpression }) }))
vi.mock('../../useBiliCookie', () => ({ useBiliCookie: () => ({ isCookieValid: false }) }))
vi.mock('../../useVtsStore', () => ({ useVtsStore: () => ({}) }))
vi.mock('@/shared/config', () => ({ isTauri: () => false }))
vi.mock('../utils/historyLogger', () => ({
  logCommandHistory: mocks.history,
  logDanmakuHistory: vi.fn(),
  logPrivateMsgHistory: vi.fn(),
}))
import { executeActions } from '../actionUtils'
import { useAutoReply } from '../modules/autoReply'
import { useEntryWelcome } from '../modules/entryWelcome'
import { useFollowThank } from '../modules/followThank'
import { useGiftThank } from '../modules/giftThank'
import { useGuardPm } from '../modules/guardPm'
import { useSuperChatThank } from '../modules/superChatThank'
import { ActionType, TriggerType } from '../types'
import { createDefaultAutoAction, createDefaultRuntimeState } from '../utils'

const event = { uid: 123, uname: 'test', msg: 'hello', price: 100, num: 1, guard_level: 3 } as EventModel
const send = vi.fn(async () => true)
function action(type: TriggerType) {
  const value = createDefaultAutoAction(type)
  value.enabled = true
  value.actionType = ActionType.PNGTUBER_EXPRESSION
  value.triggerConfig = { keywords: ['hello'] }
  value.actionConfig = {
    pngtuberExpressionId: 'happy',
    pngtuberDurationMs: 1200,
    pngtuberChannel: 'main',
    cooldownSeconds: 10,
  }
  value.ignoreCooldown = false
  return value
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  mocks.switchExpression.mockResolvedValue(undefined)
  mocks.history.mockResolvedValue(undefined)
})
afterEach(() => vi.useRealTimers())

describe('PNGtuber existing event engine integration', () => {
  it.each([TriggerType.DANMAKU, TriggerType.GIFT, TriggerType.GUARD, TriggerType.SUPER_CHAT, TriggerType.FOLLOW, TriggerType.ENTER, TriggerType.SCHEDULED])(
    'executes %s with channel/duration and records history without Bili cookie',
    async (type) => {
      const item = action(type),
        state = createDefaultRuntimeState(),
        room = ref(100)
      if (type === TriggerType.DANMAKU) useAutoReply(ref(true), room, send).onDanmaku(event, [item], state)
      if (type === TriggerType.GIFT) useGiftThank(ref(true), room, ref(false), send).processGift(event, [item], state)
      if (type === TriggerType.GUARD) useGuardPm(room, send, send).handleGuardBuy([item], event, state)
      if (type === TriggerType.SUPER_CHAT)
        useSuperChatThank(ref(true), room, ref(false), send).processSuperChat(event, [item], state)
      if (type === TriggerType.FOLLOW) useFollowThank(ref(true), room, ref(false), send).processFollow(event, [item], state)
      if (type === TriggerType.ENTER) useEntryWelcome(ref(true), room, ref(false), send).processEnter(event, [item], state)
      if (type === TriggerType.SCHEDULED) executeActions([item], null, type, room.value, state, {})
      await vi.dynamicImportSettled()
      expect(mocks.switchExpression).toHaveBeenCalledWith('happy', 1200, 'main')
      expect(mocks.history).toHaveBeenCalledWith(
        item.id,
        expect.any(String),
        expect.stringContaining('main'),
        true,
        undefined,
        ActionType.PNGTUBER_EXPRESSION,
      )
      expect(send).not.toHaveBeenCalled()
    },
  )
  it('applies conditions and reserves cooldown during delay', async () => {
    const item = action(TriggerType.GIFT),
      state = createDefaultRuntimeState()
    item.logicalExpression = 'false'
    executeActions([item], event, item.triggerType, 100, state, {})
    await vi.dynamicImportSettled()
    expect(mocks.switchExpression).not.toHaveBeenCalled()
    item.logicalExpression = ''
    item.actionConfig.delaySeconds = 1
    executeActions([item], event, item.triggerType, 100, state, {})
    executeActions([item], event, item.triggerType, 100, state, {})
    await vi.advanceTimersByTimeAsync(1000)
    await vi.dynamicImportSettled()
    expect(mocks.switchExpression).toHaveBeenCalledTimes(1)
  })
  it('test execution bypasses conditions and records driver failures', async () => {
    const item = action(TriggerType.GIFT),
      onError = vi.fn()
    item.logicalExpression = 'false'
    mocks.switchExpression.mockRejectedValue(new Error('驱动未启动'))
    executeActions([item], null, item.triggerType, 1, createDefaultRuntimeState(), {}, { isTest: true, onError })
    await vi.dynamicImportSettled()
    expect(onError).toHaveBeenCalledOnce()
    expect(mocks.history).toHaveBeenCalledWith(
      item.id,
      expect.any(String),
      expect.any(String),
      false,
      expect.stringContaining('驱动未启动'),
      ActionType.PNGTUBER_EXPRESSION,
    )
  })
})
