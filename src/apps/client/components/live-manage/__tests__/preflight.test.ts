import { describe, expect, it } from 'vitest'

import { buildPreflightChecks, type PreflightState } from '../preflight'

const ready: PreflightState = {
  cookieValid: true,
  roomId: 123,
  areaId: 9,
  title: '测试直播',
  hasStreamKey: false,
  fetcherEnabled: true,
  fetcherConnected: true,
  danmakuConnected: true,
  obsEnabled: true,
  obsConnected: true,
  obsStreamReady: true,
  autoSwitch: true,
  startScene: '直播',
  scenes: ['直播'],
}
const checks = (patch: Partial<PreflightState>) => buildPreflightChecks({ ...ready, ...patch })

describe('开播前检查', () => {
  it('does not require a stream key obtained only after starting live', () => {
    expect(checks({}).filter((c) => c.status === 'error' || c.status === 'warning')).toEqual([])
    expect(checks({}).find((c) => c.id === 'key')?.status).toBe('info')
  })
  it('identifies login and room/area prerequisites with repair targets', () => {
    expect(
      checks({ cookieValid: false, roomId: 0, areaId: 0 })
        .filter((c) => c.status === 'error')
        .map((c) => [c.id, c.target]),
    ).toEqual([
      ['login', 'fetcher'],
      ['room', 'account'],
      ['area', 'control'],
    ])
  })
  it('skips disabled integrations even when disconnected', () => {
    const result = checks({
      fetcherEnabled: false,
      fetcherConnected: false,
      danmakuConnected: false,
      obsEnabled: false,
      obsConnected: false,
    })
    expect(result.filter((c) => c.status === 'error' || c.status === 'warning')).toEqual([])
    expect(result.some((c) => c.id === 'danmaku' || c.id === 'scene' || c.id === 'obs-stream')).toBe(false)
  })
  it('shows lost danmaku independently of the upload connection', () => {
    const result = checks({ danmakuConnected: false })
    expect(result.find((c) => c.id === 'fetcher')?.status).toBe('success')
    expect(result.find((c) => c.id === 'danmaku')?.status).toBe('warning')
  })
  it('does not claim OBS configuration is valid while disconnected or unread', () => {
    expect(checks({ obsConnected: false }).some((c) => c.id === 'obs-stream')).toBe(false)
    expect(checks({ obsStreamReady: undefined, scenes: undefined }).find((c) => c.id === 'obs-stream')?.status).toBe(
      'info',
    )
    expect(checks({ scenes: undefined }).find((c) => c.id === 'scene')?.status).toBe('info')
  })
  it('reports missing OBS settings and removed scenes, then clears after repair', () => {
    expect(
      checks({ obsStreamReady: false, scenes: [] })
        .filter((c) => c.status === 'warning')
        .map((c) => c.id),
    ).toEqual(['obs-stream', 'scene'])
    expect(checks({}).filter((c) => c.status === 'warning')).toEqual([])
    expect(checks({ autoSwitch: false, scenes: [] }).some((c) => c.id === 'scene')).toBe(false)
  })
})
