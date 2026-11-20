import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

const mockStore = {
  cooldownMap: ref<Record<string, number>>({}),
  cooldownNames: ref<Record<string, string>>({}),
  settings: ref({ orderCooldown: 30 }),
}

vi.mock('@/store/useMusicRequest', () => ({
  useMusicRequestProvider: () => ({
    get cooldownMap() {
      return mockStore.cooldownMap.value
    },
    set cooldownMap(v) {
      mockStore.cooldownMap.value = v
    },
    get cooldownNames() {
      return mockStore.cooldownNames.value
    },
    get settings() {
      return mockStore.settings.value
    },
  }),
}))

vi.mock('worker-timers', () => ({
  setInterval: (fn: () => void, ms: number) => globalThis.setInterval(fn, ms),
  clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id),
}))

import { useActiveMusicCooldowns } from '../useActiveMusicCooldowns'

describe('useActiveMusicCooldowns', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'))
    mockStore.cooldownMap.value = {}
    mockStore.cooldownNames.value = {}
    mockStore.settings.value = { orderCooldown: 30 }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('idle 后新增冷却记录时立即刷新 nowTick，不因旧时间戳得出夸大的剩余秒数', async () => {
    let cooldowns!: ReturnType<typeof useActiveMusicCooldowns>
    const Host = defineComponent({
      setup() {
        cooldowns = useActiveMusicCooldowns()
        return () => null
      },
    })
    const wrapper = mount(Host)
    expect(cooldowns.value).toEqual([])

    // 模拟组件闲置 100 秒后再有观众点歌触发冷却
    vi.setSystemTime(Date.now() + 100_000)
    mockStore.cooldownNames.value = { '1001': '观众A' }
    mockStore.cooldownMap.value = { '1001': Date.now() }
    await wrapper.vm.$nextTick()

    expect(cooldowns.value).toEqual([{ userKey: '1001', name: '观众A', remain: 30 }])

    // 已有激活冷却时于定时器周期内 (500ms) 新增第 2 名观众，也应立即刷新 nowTick 避免出现 31s
    vi.advanceTimersByTime(500)
    mockStore.cooldownNames.value = { '1001': '观众A', '1002': '观众B' }
    mockStore.cooldownMap.value = { '1001': Date.now() - 500, '1002': Date.now() }
    await wrapper.vm.$nextTick()

    expect(cooldowns.value.find((c) => c.userKey === '1002')?.remain).toBe(30)
    wrapper.unmount()
  })
})
