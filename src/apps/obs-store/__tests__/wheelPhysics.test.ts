import { describe, expect, it } from 'vitest'

import type { WheelSegment } from '../components/wheel/types'
import { computeSpinTargetAngle, pickWeightedIndex, resolveSectorAtRotation } from '../components/wheel/wheelPhysics'

const segments: WheelSegment[] = [
  { id: 'a', label: '一等奖', color: '#f00', weight: 1 },
  { id: 'b', label: '二等奖', color: '#0f0', weight: 3 },
  { id: 'c', label: '参与奖', color: '#00f', weight: 6 },
]

describe('wheelPhysics', () => {
  it('能按权重精准分配随机区间', () => {
    expect(pickWeightedIndex(segments, 0.05)).toBe(0) // 0~0.1
    expect(pickWeightedIndex(segments, 0.25)).toBe(1) // 0.1~0.4
    expect(pickWeightedIndex(segments, 0.85)).toBe(2) // 0.4~1.0
  })

  it('按目标下标计算的目标旋转角，停止后反推必命中同一扇区', () => {
    let rotation = 37
    for (let target = 0; target < segments.length; target++) {
      for (const jitter of [0.1, 0.5, 0.9]) {
        const nextRotation = computeSpinTargetAngle(rotation, segments, target, true, 5, jitter)
        expect(nextRotation).toBeGreaterThan(rotation + 5 * 360 - 1)
        const resolved = resolveSectorAtRotation(segments, nextRotation, true)
        expect(resolved?.index).toBe(target)
        rotation = nextRotation
      }
    }
  })

  it('等分模式下也能保证落点与反推 100% 一致', () => {
    const nextRotation = computeSpinTargetAngle(120, segments, 1, false, 6, 0.5)
    const resolved = resolveSectorAtRotation(segments, nextRotation, false)
    expect(resolved?.segment.id).toBe('b')
  })
})
