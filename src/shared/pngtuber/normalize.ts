import { createExpression, DEFAULT_PNGTUBER_STATE, IMAGE_SLOTS } from './types'
import type { PngtuberExpression, PngtuberState } from './types'

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('立绘配置必须是对象')
  return value as Record<string, unknown>
}
function number(value: unknown, fallback: number, min: number, max: number) {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new Error(`数值必须在 ${min}–${max} 之间`)
  return value
}
function text(value: unknown, fallback = '') {
  if (value === undefined) return fallback
  if (typeof value !== 'string' || value.length > 4096) throw new Error('无效的文字字段')
  return value
}
function image(value: unknown) {
  const url = text(value)
  if (!url || /^(data|blob):/i.test(url)) return ''
  if (!/^https?:\/\//i.test(url)) throw new Error('立绘图片必须是 HTTP(S) 地址')
  return url
}
function choice<T extends string>(value: unknown, fallback: T, allowed: readonly T[]): T {
  if (value === undefined) return fallback
  if (!allowed.includes(value as T)) throw new Error(`不支持的配置值：${value}`)
  return value as T
}
function expression(value: unknown): PngtuberExpression {
  const raw = record(value)
  const result = createExpression(text(raw.name, '表情'), text(raw.id, 'default'))
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(result.id)) throw new Error('无效的表情 ID')
  for (const slot of IMAGE_SLOTS) result[slot] = image(raw[slot])
  result.hotkey = text(raw.hotkey)
  result.hotkeyMode = choice(raw.hotkeyMode, 'toggle', ['toggle', 'hold', 'timed'])
  result.durationMs = number(raw.durationMs, 5000, 100, 600000)
  result.playback = choice(raw.playback, 'continue', ['continue', 'restart', 'once'])
  if (raw.accessories !== undefined) {
    if (!Array.isArray(raw.accessories) || raw.accessories.length > 12) throw new Error('每个表情最多 12 个配件')
    result.accessories = raw.accessories.map((value) => {
      const a = record(value)
      return {
        id: text(a.id),
        name: text(a.name, '配件'),
        image: image(a.image),
        x: number(a.x, 0, -2000, 2000),
        y: number(a.y, 0, -2000, 2000),
        scale: number(a.scale, 1, 0.05, 10),
        rotation: number(a.rotation, 0, -360, 360),
        visible: choice(a.visible, 'always', ['always', 'speaking', 'idle']),
        front: a.front !== false,
      }
    })
  }
  return result
}
export function normalizePngtuberState(value: unknown): PngtuberState {
  const raw = record(value)
  const state = structuredClone(DEFAULT_PNGTUBER_STATE)
  const ranges = {
    threshold: [1, 100],
    closeThreshold: [0, 100],
    attackDelay: [0, 1000],
    gain: [0.5, 3],
    releaseDelay: [0, 2000],
    scale: [0.1, 3],
    blinkMin: [500, 60000],
    blinkMax: [500, 60000],
    blinkDuration: [50, 2000],
    canvasWidth: [100, 3840],
    canvasHeight: [100, 3840],
    padding: [0, 300],
    transitionMs: [0, 1000],
  } as const
  for (const key of Object.keys(ranges) as (keyof typeof ranges)[])
    state[key] = number(raw[key], state[key], ranges[key][0], ranges[key][1])
  for (const key of [
    'noiseSuppression',
    'flipH',
    'idleDim',
    'showGlow',
    'shadow',
    'blinkEnabled',
    'pixelated',
  ] as const) {
    if (raw[key] !== undefined && typeof raw[key] !== 'boolean') throw new Error(`无效的开关：${key}`)
    state[key] = (raw[key] ?? state[key]) as boolean
  }
  state.speakingAnimation = choice(raw.speakingAnimation, state.speakingAnimation, [
    'bounce',
    'jelly',
    'shake',
    'pulse',
    'float',
    'none',
  ])
  state.idleAnimation = choice(raw.idleAnimation, state.idleAnimation, ['none', 'breathe', 'sway', 'float'])
  state.intensity = choice(raw.intensity, state.intensity, ['subtle', 'normal', 'energetic'])
  state.motionMode = choice(raw.motionMode, state.motionMode, ['loop', 'onset', 'volume'])
  state.inputMode = choice(raw.inputMode, state.inputMode, ['microphone', 'controller', 'client', 'obs'])
  state.glowColor = text(raw.glowColor, state.glowColor)
  if (!/^#[\da-f]{6}$/i.test(state.glowColor)) throw new Error('发光颜色必须是六位十六进制颜色')
  if (raw.expressions !== undefined) {
    if (!Array.isArray(raw.expressions) || !raw.expressions.length || raw.expressions.length > 32)
      throw new Error('需要 1–32 个表情')
    state.expressions = raw.expressions.map(expression)
  } else
    state.expressions = [
      expression({ id: 'default', name: '默认', idleImage: raw.idleImage, speakingImage: raw.speakingImage }),
    ]
  if (new Set(state.expressions.map((e) => e.id)).size !== state.expressions.length) throw new Error('表情 ID 重复')
  state.defaultExpressionId = text(raw.defaultExpressionId, state.expressions[0].id)
  state.awayExpressionId = text(raw.awayExpressionId)
  for (const id of [state.defaultExpressionId, state.awayExpressionId].filter(Boolean))
    if (!state.expressions.some((e) => e.id === id)) throw new Error('所选表情不存在')
  if (state.blinkMax < state.blinkMin) throw new Error('眨眼最大间隔不能小于最小间隔')
  state.closeThreshold = Math.min(state.closeThreshold, state.threshold)
  return state
}
export const sanitizePngtuberState = normalizePngtuberState
