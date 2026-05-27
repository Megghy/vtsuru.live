import type { AutoActionItem, RuntimeState } from '../types'
import type { EventModel } from '@/api/api-models'
import { ref } from 'vue'
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

const { useAutoReply } = await import('../modules/autoReply')
const { useGiftThank } = await import('../modules/giftThank')
const { useFollowThank } = await import('../modules/followThank')
const { useEntryWelcome } = await import('../modules/entryWelcome')
const { useSuperChatThank } = await import('../modules/superChatThank')
const { ActionType, KeywordMatchType, Priority, TriggerType } = await import('../types')

function makeAction(overrides: Partial<AutoActionItem> = {}): AutoActionItem {
  return {
    id: `action-${Math.random().toString(36).slice(2)}`,
    name: 'test action',
    enabled: true,
    triggerType: TriggerType.DANMAKU,
    actionType: ActionType.SEND_DANMAKU,
    template: 'reply',
    ignoreCooldown: true,
    priority: Priority.Normal,
    triggerConfig: {
      keywordMatchType: KeywordMatchType.Contains,
      blockwordMatchType: KeywordMatchType.Contains,
    } as any,
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

function makeEvent(overrides: Partial<EventModel> = {}): EventModel {
  return {
    uid: 1,
    uname: 'tester',
    msg: '',
    num: 1,
    price: 0,
    guard_level: 0,
    fans_medal_wearing_status: false,
    fans_medal_level: 0,
    ...overrides,
  } as EventModel
}

const isLive = ref(true)
const roomId = ref<number | undefined>(100)
const isTianXuan = ref(false)

describe('useAutoReply onDanmaku', () => {
  let sentMessages: string[]
  const sendDanmaku = vi.fn(async (_room: number, msg: string) => {
    sentMessages.push(msg)
    return true
  })

  beforeEach(() => {
    sentMessages = []
    sendDanmaku.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 1, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('triggers when keyword matches (Contains)', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: '收到！{{user.name}}',
      triggerConfig: {
        keywords: ['你好'],
        keywordMatchType: KeywordMatchType.Contains,
      } as any,
    })
    reply.onDanmaku(makeEvent({ msg: '你好啊', uname: 'Alice' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual(['收到！Alice'])
  })

  it('does not trigger when no keyword matches', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'hi',
      triggerConfig: { keywords: ['特定词'], keywordMatchType: KeywordMatchType.Contains } as any,
    })
    reply.onDanmaku(makeEvent({ msg: '随便聊聊' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])
  })

  it('matches Full keyword type only on exact match', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'ok',
      triggerConfig: { keywords: ['hi'], keywordMatchType: KeywordMatchType.Full } as any,
    })
    reply.onDanmaku(makeEvent({ msg: 'hi there' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])

    reply.onDanmaku(makeEvent({ msg: 'hi' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual(['ok'])
  })

  it('matches Regex keyword type', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'matched',
      triggerConfig: { keywords: ['^早.*好$'], keywordMatchType: KeywordMatchType.Regex } as any,
    })
    reply.onDanmaku(makeEvent({ msg: '早上好' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual(['matched'])
  })

  it('blocks message when blockword matches', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'reply',
      triggerConfig: {
        keywords: ['hello'],
        blockwords: ['ban'],
        keywordMatchType: KeywordMatchType.Contains,
        blockwordMatchType: KeywordMatchType.Contains,
      } as any,
    })
    reply.onDanmaku(makeEvent({ msg: 'hello ban' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])
  })

  it('skips when user filter requires medal but user has none', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'medal-only',
      triggerConfig: {
        keywords: ['x'],
        userFilterEnabled: true,
        requireMedal: true,
        keywordMatchType: KeywordMatchType.Contains,
      } as any,
    })
    reply.onDanmaku(
      makeEvent({ msg: 'x', fans_medal_wearing_status: false }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])
  })

  it('respects cooldown', async () => {
    const reply = useAutoReply(isLive, roomId, sendDanmaku)
    const action = makeAction({
      template: 'reply',
      ignoreCooldown: false,
      actionConfig: { delaySeconds: 0, cooldownSeconds: 60 } as any,
      triggerConfig: { keywords: ['x'], keywordMatchType: KeywordMatchType.Contains } as any,
    })
    const state = makeRuntimeState()

    reply.onDanmaku(makeEvent({ msg: 'x' }), [action], state)
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages.length).toBe(1)

    reply.onDanmaku(makeEvent({ msg: 'x' }), [action], state)
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages.length).toBe(1)

    await vi.advanceTimersByTimeAsync(61_000)
    reply.onDanmaku(makeEvent({ msg: 'x' }), [action], state)
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages.length).toBe(2)
  })

  it('skips when not live and onlyDuringLive is true', async () => {
    const offline = ref(false)
    const reply = useAutoReply(offline, roomId, sendDanmaku)
    const action = makeAction({
      template: 'live-only',
      triggerConfig: {
        keywords: ['x'],
        keywordMatchType: KeywordMatchType.Contains,
        onlyDuringLive: true,
      } as any,
    })
    reply.onDanmaku(makeEvent({ msg: 'x' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])
  })

  it('does nothing when roomId is undefined', async () => {
    const noRoom = ref<number | undefined>(undefined)
    const reply = useAutoReply(isLive, noRoom, sendDanmaku)
    const action = makeAction({
      template: 'reply',
      triggerConfig: { keywords: ['x'], keywordMatchType: KeywordMatchType.Contains } as any,
    })
    reply.onDanmaku(makeEvent({ msg: 'x' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sentMessages).toEqual([])
  })
})

describe('useFollowThank', () => {
  let sent: string[]
  const sendDanmaku = vi.fn(async (_r: number, m: string) => { sent.push(m); return true })

  beforeEach(() => {
    sent = []
    sendDanmaku.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 2, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('replies on follow event with user variable', async () => {
    const mod = useFollowThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.FOLLOW,
      template: '感谢{{user.name}}的关注',
    })
    mod.processFollow(makeEvent({ uname: 'Bob' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual(['感谢Bob的关注'])
  })
})

describe('useSuperChatThank', () => {
  let sent: string[]
  const sendDanmaku = vi.fn(async (_r: number, m: string) => { sent.push(m); return true })

  beforeEach(() => {
    sent = []
    sendDanmaku.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 3, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('replies when SC price meets minimum', async () => {
    const mod = useSuperChatThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.SUPER_CHAT,
      template: '感谢{{user.name}}的{{sc.price}}元SC',
      triggerConfig: { scFilterMode: 'price', scMinPrice: 30 } as any,
    })
    mod.processSuperChat(
      makeEvent({ uname: 'Carol', price: 50, msg: 'hello' }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual(['感谢Carol的50元SC'])
  })

  it('skips when SC price below minimum', async () => {
    const mod = useSuperChatThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.SUPER_CHAT,
      template: 'thanks',
      triggerConfig: { scFilterMode: 'price', scMinPrice: 100 } as any,
    })
    mod.processSuperChat(
      makeEvent({ price: 30, msg: 'hi' }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual([])
  })
})

describe('useEntryWelcome', () => {
  let sent: string[]
  const sendDanmaku = vi.fn(async (_r: number, m: string) => { sent.push(m); return true })

  beforeEach(() => {
    sent = []
    sendDanmaku.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 4, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('welcomes entering user', async () => {
    const mod = useEntryWelcome(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.ENTER,
      template: '欢迎{{user.name}}',
    })
    mod.processEnter(makeEvent({ uname: 'Dave' }), [action], makeRuntimeState())
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual(['欢迎Dave'])
  })
})

describe('useGiftThank', () => {
  let sent: string[]
  const sendDanmaku = vi.fn(async (_r: number, m: string) => { sent.push(m); return true })

  beforeEach(() => {
    sent = []
    sendDanmaku.mockClear()
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2030, 0, 5, 12))
  })
  afterEach(() => { vi.useRealTimers() })

  it('thanks for gift with summary template', async () => {
    const mod = useGiftThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.GIFT,
      template: '感谢{{user.name}}的{{gift.summary}}',
    })
    mod.processGift(
      makeEvent({ uname: 'Eve', msg: '小心心', num: 3, price: 0 }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual(['感谢Eve的3个小心心'])
  })

  it('respects minValue filter', async () => {
    const mod = useGiftThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.GIFT,
      template: 'thanks',
      triggerConfig: { minValue: 50 } as any,
    })
    mod.processGift(
      makeEvent({ msg: '小心心', num: 1, price: 10 }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual([])
  })

  it('respects whitelist filter', async () => {
    const mod = useGiftThank(isLive, roomId, isTianXuan, sendDanmaku)
    const allowedAction = makeAction({
      id: 'wl',
      triggerType: TriggerType.GIFT,
      template: 'allowed',
      triggerConfig: { filterMode: 'whitelist', filterGiftNames: ['辣条'] } as any,
    })
    mod.processGift(
      makeEvent({ msg: '小心心' }),
      [allowedAction],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual([])

    mod.processGift(
      makeEvent({ msg: '辣条' }),
      [allowedAction],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual(['allowed'])
  })

  it('respects blacklist filter', async () => {
    const mod = useGiftThank(isLive, roomId, isTianXuan, sendDanmaku)
    const action = makeAction({
      triggerType: TriggerType.GIFT,
      template: 'thanks',
      triggerConfig: { filterMode: 'blacklist', filterGiftNames: ['小心心'] } as any,
    })
    mod.processGift(
      makeEvent({ msg: '小心心' }),
      [action],
      makeRuntimeState(),
    )
    await vi.advanceTimersByTimeAsync(10)
    expect(sent).toEqual([])
  })
})
