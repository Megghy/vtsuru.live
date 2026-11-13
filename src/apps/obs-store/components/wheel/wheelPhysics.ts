import type { WheelSegment } from './types'

export interface SectorArc {
  index: number
  segment: WheelSegment
  startDeg: number
  endDeg: number
  spanDeg: number
  centerDeg: number
}

/** 按权重加权抽取目标下标 */
export function pickWeightedIndex(segments: readonly WheelSegment[], randomValue = Math.random()): number {
  if (segments.length === 0) return -1
  const weights = segments.map((s) => Math.max(0.01, Number(s.weight) || 0))
  const total = weights.reduce((acc, w) => acc + w, 0)
  const clamped = Math.min(0.999999999, Math.max(0, randomValue))
  let target = clamped * total
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i]
    if (target <= 0) return i
  }
  return segments.length - 1
}

/** 计算每个扇区的起始与结束角度 (以 12 点钟方向为 0 度，顺时针递增) */
export function computeSectorArcs(segments: readonly WheelSegment[], proportional = true): SectorArc[] {
  if (segments.length === 0) return []
  const weights = segments.map((s) => (proportional ? Math.max(0.01, Number(s.weight) || 0) : 1))
  const total = weights.reduce((acc, w) => acc + w, 0)
  let cursor = 0
  return segments.map((segment, index) => {
    const spanDeg = (weights[index] / total) * 360
    const startDeg = cursor
    const endDeg = index === segments.length - 1 ? 360 : cursor + spanDeg
    cursor = endDeg
    return {
      index,
      segment,
      startDeg,
      endDeg,
      spanDeg: endDeg - startDeg,
      centerDeg: (startDeg + endDeg) / 2,
    }
  })
}

/**
 * 计算转盘顺时针旋转的目标总角度，使得停止时顶部指针 (0度) 精准落在目标扇区内部。
 * 规则：转盘顺时针旋转 R 度后，原本位于 A 度的点落在 (A + R) mod 360，
 * 故落在顶部 0 度指针处的原始圆周角为 (360 - (R mod 360)) mod 360。
 */
export function computeSpinTargetAngle(
  currentRotationDeg: number,
  segments: readonly WheelSegment[],
  targetIndex: number,
  proportional = true,
  extraTurns = 6,
  jitterRatio = 0.5,
): number {
  const arcs = computeSectorArcs(segments, proportional)
  const arc = arcs[targetIndex]
  if (!arc) return currentRotationDeg + extraTurns * 360

  // 安全边距，避免压线争议
  const margin = Math.min(arc.spanDeg * 0.15, 4)
  const safeSpan = Math.max(0.5, arc.spanDeg - margin * 2)
  const clampedJitter = Math.min(1, Math.max(0, jitterRatio))
  const desiredLocalDeg = arc.startDeg + margin + clampedJitter * safeSpan

  const desiredMod = (360 - (desiredLocalDeg % 360) + 360) % 360
  const currentMod = ((currentRotationDeg % 360) + 360) % 360
  const deltaMod = (desiredMod - currentMod + 360) % 360

  return currentRotationDeg + Math.max(1, extraTurns) * 360 + deltaMod
}

/** 根据当前旋转角度解析顶部指针所指扇区 */
export function resolveSectorAtRotation(
  segments: readonly WheelSegment[],
  rotationDeg: number,
  proportional = true,
): SectorArc | null {
  const arcs = computeSectorArcs(segments, proportional)
  if (arcs.length === 0) return null
  const normalizedRot = ((rotationDeg % 360) + 360) % 360
  const pointerAngle = (360 - normalizedRot) % 360
  return arcs.find((a) => pointerAngle >= a.startDeg && pointerAngle < a.endDeg) ?? arcs[arcs.length - 1]
}

/** 四次方缓出阻尼曲线 */
export function easeOutQuart(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - (1 - clamped) ** 4
}
