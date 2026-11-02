import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePngtuberDebugger } from '../usePngtuberDebugger'

describe('usePngtuberDebugger', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('controls single simulation state properly', () => {
    const dbg = usePngtuberDebugger()
    expect(dbg.isSimulating.value).toBe(false)

    dbg.startSingleSimulation()
    expect(dbg.isSimulating.value).toBe(true)
    expect(dbg.simulatedSpeaking.value).toBe(false)
    expect(dbg.simulatedVolume.value).toBe(0)

    dbg.setSimulatedSpeaking(true)
    expect(dbg.simulatedSpeaking.value).toBe(true)
    expect(dbg.simulatedVolume.value).toBe(75)

    dbg.setSimulatedVolume(90)
    expect(dbg.simulatedVolume.value).toBe(90)
    expect(dbg.simulatedSpeaking.value).toBe(true)

    dbg.setSimulatedVolume(5)
    expect(dbg.simulatedVolume.value).toBe(5)
    expect(dbg.simulatedSpeaking.value).toBe(false)

    dbg.stopSingleSimulation()
    expect(dbg.isSimulating.value).toBe(false)
    expect(dbg.simulatedSpeaking.value).toBe(false)
    expect(dbg.simulatedVolume.value).toBe(0)
  })

  it('runs auto wave generator for smooth speaking demonstration', () => {
    const dbg = usePngtuberDebugger()
    dbg.toggleAutoWave()
    expect(dbg.isSimulating.value).toBe(true)
    expect(dbg.autoSpeakingWave.value).toBe(true)

    // 前进 120ms，音量应该被驱动更新
    vi.advanceTimersByTime(120)
    expect(dbg.simulatedVolume.value).toBeGreaterThan(0)

    dbg.toggleAutoWave()
    expect(dbg.autoSpeakingWave.value).toBe(false)
    expect(dbg.simulatedSpeaking.value).toBe(false)
  })

  it('manages mock collab room members and speaker cycling', () => {
    const dbg = usePngtuberDebugger()
    dbg.startMockCollab()
    expect(dbg.isMockCollab.value).toBe(true)
    expect(dbg.mockMembers.value.length).toBe(3)
    expect(dbg.mockMembers.value[0].isSpeaking).toBe(true)
    expect(dbg.mockMembers.value[0].config.expressions[0].idleImage).toMatch(/^data:image\/svg\+xml/)

    // 切换下一个发言者
    dbg.cycleCollabSpeaker()
    expect(dbg.mockMembers.value[0].isSpeaking).toBe(false)
    expect(dbg.mockMembers.value[1].isSpeaking).toBe(true)

    // 动态添加成员
    dbg.addMockMember()
    expect(dbg.mockMembers.value.length).toBe(4)
    expect(dbg.mockMembers.value.map((m) => m.userId)).toEqual([90000, 90001, 90002, 90003])

    // 动态移除成员
    dbg.removeMockMember(dbg.mockMembers.value[1].userId)
    expect(dbg.mockMembers.value.length).toBe(3)
    dbg.addMockMember()
    const ids = dbg.mockMembers.value.map((m) => m.userId)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toContain(90001)

    dbg.stopMockCollab()
    expect(dbg.isMockCollab.value).toBe(false)
    expect(dbg.mockMembers.value.length).toBe(0)
  })
})
