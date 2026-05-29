import type { AutoActionItem, RuntimeState } from '../types'
import type { EventModel } from '@/api/api-models'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/apps/client/store/useBiliCookie', () => ({
  useBiliCookie: () => ({ isCookieValid: true }),
}))
vi.mock('@/apps/client/store/useVtsStore', () => ({
  useVtsStore: () => ({ canOperate: false }),
}))
vi.mock('@/shared/config', () => ({ isTauri: () => false }))
vi.mock('../utils/historyLogger', () => ({
  logCommandHistory: vi.fn(async () => {}),
  logDanmakuHistory: vi.fn(async () => {}),
  logPrivateMsgHistory: vi.fn(async () => {}),
  HistoryType: { DANMAKU: 'danmaku', PRIVATE_MSG: 'private_msg', COMMAND: 'command' },
}))

const { executeActions } = await import('../actionUtils')
const { ActionType, Priority, TriggerType } = await import('../types')

function makeAction(overrides: Partial<AutoActionItem> = {}): AutoActionItem {
  return {
    id: `action-${Math.random()}`,
    name: 'rate-limit test',
    enabled: true,
    triggerType: TriggerType.DANMAKU,
    actionType: ActionType.SEND_DANMAKU,
    template: 'msg',
    ignoreCooldown: true,
    priority: Priority.NORMAL,
    triggerConfig: {} as any,
    actionConfig: { delaySeconds: 0, cooldownSeconds: 0 } as any,
    logicalExpression: '',
    executeCommand: '',
    ...overrides,
  }
}

function makeRuntimeState(): RuntimeState {
  return {
    lastExecutionTime: {},
    scheduledTimers: {},
    timerStartTimes: {},
    globalTimerStartTime: null,
    aggregatedEvents: {},
    sentGuardPms: {},
  } as RuntimeState
}

function makeEvent(): EventModel {
  return { uid: 1, uname: 'test', msg: 'hi', num: 1, price: 0 } as EventModel
}

describe('rate limiter (via executeActions)', () => {
  let sendCount = 0
  const sendHandler = vi.fn(async () => {
    sendCount++
    return true
  })

  beforeEach(() => {
    sendCount = 0
    sendHandler.mockClear()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('limits to 12 sends per minute and resets after window slides', async () => {
    const state = makeRuntimeState()

    for (let i = 0; i < 15; i++) {
      executeActions(
        [makeAction({ id: `a-${i}` })],
        makeEvent(),
        TriggerType.DANMAKU,
        100,
        state,
        { sendLiveDanmaku: sendHandler },
      )
      await vi.advanceTimersByTimeAsync(0)
    }
    expect(sendCount).toBe(12)

    await vi.advanceTimersByTimeAsync(61_000)

    executeActions(
      [makeAction({ id: 'after' })],
      makeEvent(),
      TriggerType.DANMAKU,
      100,
      state,
      { sendLiveDanmaku: sendHandler },
    )
    await vi.advanceTimersByTimeAsync(0)
    expect(sendCount).toBe(13)
  })
})
