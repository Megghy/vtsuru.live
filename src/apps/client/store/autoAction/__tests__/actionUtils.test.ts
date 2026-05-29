import type { AutoActionItem, RuntimeState } from '../types'
import type { EventModel } from '@/api/api-models'
import { ref } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/apps/client/store/useBiliCookie', () => ({
  useBiliCookie: () => ({ isCookieValid: true }),
}))
vi.mock('@/apps/client/store/useVtsStore', () => ({
  useVtsStore: () => ({ canOperate: false }),
}))
vi.mock('@/shared/config', () => ({ isTauri: () => false }))

const { checkCooldown, checkUserFilters, filterValidActions, processTemplate } = await import('../actionUtils')
const { ActionType, KeywordMatchType, Priority, TriggerType } = await import('../types')
const { buildExecutionContext } = await import('../utils')

function makeAction(overrides: Partial<AutoActionItem> = {}): AutoActionItem {
  return {
    id: 'test-id',
    name: 'test action',
    enabled: true,
    triggerType: TriggerType.DANMAKU,
    actionType: ActionType.SEND_DANMAKU,
    template: 'reply',
    ignoreCooldown: false,
    priority: Priority.NORMAL,
    triggerConfig: {
      onlyDuringLive: false,
      userFilterEnabled: false,
      requireMedal: false,
      requireCaptain: false,
      ignoreTianXuan: false,
      keywordMatchType: KeywordMatchType.Contains,
      blockwordMatchType: KeywordMatchType.Contains,
    } as any,
    actionConfig: { delaySeconds: 0, cooldownSeconds: 0 } as any,
    logicalExpression: '',
    executeCommand: '',
    ...overrides,
  }
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
    fans_medal_name: '',
    ...overrides,
  } as EventModel
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

describe('filterValidActions', () => {
  const isLive = ref(true)

  it('filters by triggerType and enabled', () => {
    const actions = [
      makeAction({ id: '1', triggerType: TriggerType.DANMAKU, enabled: true }),
      makeAction({ id: '2', triggerType: TriggerType.GIFT, enabled: true }),
      makeAction({ id: '3', triggerType: TriggerType.DANMAKU, enabled: false }),
    ]
    const result = filterValidActions(actions, TriggerType.DANMAKU, isLive)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe('1')
  })

  it('excludes onlyDuringLive actions when not live', () => {
    const notLive = ref(false)
    const actions = [
      makeAction({ id: 'a', triggerConfig: { onlyDuringLive: true } as any }),
      makeAction({ id: 'b', triggerConfig: { onlyDuringLive: false } as any }),
    ]
    const result = filterValidActions(actions, TriggerType.DANMAKU, notLive)
    expect(result.map(a => a.id)).toEqual(['b'])
  })

  it('excludes ignoreTianXuan actions when tianxuan is active', () => {
    const tx = ref(true)
    const actions = [
      makeAction({ id: 'a', triggerConfig: { ignoreTianXuan: true } as any }),
      makeAction({ id: 'b', triggerConfig: { ignoreTianXuan: false } as any }),
    ]
    const result = filterValidActions(actions, TriggerType.DANMAKU, isLive, tx)
    expect(result.map(a => a.id)).toEqual(['b'])
  })

  it('respects enabledTriggerTypes option', () => {
    const enabled = ref({ [TriggerType.DANMAKU]: false } as any)
    const actions = [makeAction({ id: 'a' })]
    const result = filterValidActions(actions, TriggerType.DANMAKU, isLive, undefined, {
      enabledTriggerTypes: enabled,
    })
    expect(result).toEqual([])
  })

  it('applies customFilter', () => {
    const actions = [
      makeAction({ id: 'keep', name: 'keep' }),
      makeAction({ id: 'drop', name: 'drop' }),
    ]
    const result = filterValidActions(actions, TriggerType.DANMAKU, isLive, undefined, {
      customFilter: a => a.name === 'keep',
    })
    expect(result.map(a => a.id)).toEqual(['keep'])
  })

  it('filters by specific actionType', () => {
    const actions = [
      makeAction({ id: 'a', actionType: ActionType.SEND_DANMAKU }),
      makeAction({ id: 'b', actionType: ActionType.SEND_PRIVATE_MSG }),
    ]
    const result = filterValidActions(actions, TriggerType.DANMAKU, isLive, undefined, {
      actionType: ActionType.SEND_PRIVATE_MSG,
    })
    expect(result.map(a => a.id)).toEqual(['b'])
  })
})

describe('checkUserFilters', () => {
  it('passes when user filter is disabled', () => {
    const action = makeAction({
      triggerConfig: { userFilterEnabled: false, requireMedal: true } as any,
    })
    const event = makeEvent({ fans_medal_wearing_status: false })
    expect(checkUserFilters(action, event)).toBe(true)
  })

  it('rejects when requireMedal but user has none', () => {
    const action = makeAction({
      triggerConfig: { userFilterEnabled: true, requireMedal: true } as any,
    })
    const event = makeEvent({ fans_medal_wearing_status: false })
    expect(checkUserFilters(action, event)).toBe(false)
  })

  it('accepts when requireMedal and user wears one', () => {
    const action = makeAction({
      triggerConfig: { userFilterEnabled: true, requireMedal: true } as any,
    })
    const event = makeEvent({ fans_medal_wearing_status: true })
    expect(checkUserFilters(action, event)).toBe(true)
  })

  it('rejects when requireCaptain but guard_level is 0', () => {
    const action = makeAction({
      triggerConfig: { userFilterEnabled: true, requireCaptain: true } as any,
    })
    const event = makeEvent({ guard_level: 0 })
    expect(checkUserFilters(action, event)).toBe(false)
  })

  it('accepts when requireCaptain and guard_level > 0', () => {
    const action = makeAction({
      triggerConfig: { userFilterEnabled: true, requireCaptain: true } as any,
    })
    const event = makeEvent({ guard_level: 1 })
    expect(checkUserFilters(action, event)).toBe(true)
  })
})

describe('checkCooldown', () => {
  it('always passes when ignoreCooldown is true', () => {
    const action = makeAction({
      ignoreCooldown: true,
      actionConfig: { cooldownSeconds: 60 } as any,
    })
    const state = makeRuntimeState()
    state.lastExecutionTime[action.id] = Date.now()
    expect(checkCooldown(action, state)).toBe(true)
  })

  it('passes when no previous execution', () => {
    const action = makeAction({
      actionConfig: { cooldownSeconds: 60 } as any,
    })
    expect(checkCooldown(action, makeRuntimeState())).toBe(true)
  })

  it('rejects when within cooldown window', () => {
    const action = makeAction({
      actionConfig: { cooldownSeconds: 60 } as any,
    })
    const state = makeRuntimeState()
    state.lastExecutionTime[action.id] = Date.now() - 30_000
    expect(checkCooldown(action, state)).toBe(false)
  })

  it('passes after cooldown expires', () => {
    const action = makeAction({
      actionConfig: { cooldownSeconds: 60 } as any,
    })
    const state = makeRuntimeState()
    state.lastExecutionTime[action.id] = Date.now() - 70_000
    expect(checkCooldown(action, state)).toBe(true)
  })

  it('cooldownSeconds=0 means always allowed', () => {
    const action = makeAction({
      actionConfig: { cooldownSeconds: 0 } as any,
    })
    const state = makeRuntimeState()
    state.lastExecutionTime[action.id] = Date.now()
    expect(checkCooldown(action, state)).toBe(true)
  })
})

describe('processTemplate', () => {
  it('returns null for empty template', () => {
    const action = makeAction({ template: '' })
    const ctx = buildExecutionContext(null, 0)
    expect(processTemplate(action, ctx)).toBeNull()
  })

  it('returns defaultValue when template is empty', () => {
    const action = makeAction({ template: '' })
    const ctx = buildExecutionContext(null, 0)
    expect(processTemplate(action, ctx, { defaultValue: '默认' })).toBe('默认')
  })

  it('returns formatted template content', () => {
    const action = makeAction({ template: 'Hello {{user.name}}' })
    const event = makeEvent({ uname: 'Alice' })
    const ctx = buildExecutionContext(event, 0, TriggerType.DANMAKU)
    expect(processTemplate(action, ctx, { useRandomTemplate: false })).toBe('Hello Alice')
  })

  it('selects from multi-line template randomly', () => {
    const action = makeAction({ template: 'option1\noption2\noption3' })
    const ctx = buildExecutionContext(null, 0)
    const result = processTemplate(action, ctx)
    expect(['option1', 'option2', 'option3']).toContain(result)
  })
})
