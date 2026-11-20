import Konva from 'konva'

import { resolveFontFamilyCss } from '@/apps/user-page/googleFonts'

import type { ComputedKeyboardGeometry, ComputedKeyBox } from './keyboardLayouts'
import { resolveKeyAccentTokens, withAlpha } from './keycastTheme'
import type { KeycastCanvasPalette } from './keycastTheme'
import {
  MOUSE_BODY_PATH,
  MOUSE_BUTTON_LABELS,
  MOUSE_LEFT_BUTTON_PATH,
  MOUSE_MIDDLE_RECT,
  MOUSE_RADAR_CENTER,
  MOUSE_RIGHT_BUTTON_PATH,
  MOUSE_SIDE_BUTTONS,
  MOUSE_WHEEL_DOWN_ARROW_PATH,
  MOUSE_WHEEL_UP_ARROW_PATH,
  MOUSE_WHEEL_WELL_RECT,
} from './mouseGeometry'
import { resolveAfterglowMs, resolvePressEffect } from './types'
import type { KeycastState, MouseButtonName } from './types'

export const WHEEL_PULSE_DURATION_MS = 280
export const TRAIL_LIFETIME_MS = 560
export const RIPPLE_DURATION_MS = 420
export const BEAM_DURATION_MS = 480
export const SPARK_DURATION_MS = 440

const DEFAULT_MONO_FONT = 'ui-monospace, SFMono-Regular, Menlo, monospace'
const DEFAULT_SANS_FONT = 'ui-sans-serif, system-ui, sans-serif'
export const STAGE_MARGIN = 10

export interface PressEffectInstance {
  kind: 'ripple' | 'shockwave' | 'beam'
  x: number
  y: number
  width: number
  height: number
  cornerRadius: number
  maxRadius: number
  startTs: number
  color: string
  glowColor: string
}

export interface SparkParticle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  startTs: number
  color: string
  glowColor: string
}

export interface TrailPoint {
  x: number
  y: number
  ts: number
  color: string
}

export interface MouseLayoutRect {
  x: number
  y: number
  width: number
  height: number
  scale: number
}

export interface DynamicRenderContext {
  state: KeycastState
  palette: KeycastCanvasPalette
  keyboardGeom: ComputedKeyboardGeometry
  mouseLayout: MouseLayoutRect | null
  keyUnit: number
  pressedCodes: Set<string>
  pressedMouse: Set<MouseButtonName>
  keyCounts: Record<string, number>
  mouseCounts: Record<MouseButtonName, number>
  kps: number
  apm: number
  totalPresses: number
  keyReleaseTs: Map<string, number>
  mouseReleaseTs: Map<MouseButtonName, number>
  effects: PressEffectInstance[]
  sparks: SparkParticle[]
  mouseTrail: TrailPoint[]
  wheelUpTs: number
  wheelDownTs: number
  radarCursor: { x: number; y: number; lastMoveTs: number }
}

export interface StaticSceneCallbacks {
  onVirtualKeyDown: (code: string) => void
  onVirtualKeyUp: (code: string) => void
  onVirtualMouseDown: (btn: MouseButtonName) => void
  onVirtualMouseUp: (btn: MouseButtonName) => void
  setCursor: (cursor: string) => void
}

let cachedPaths: {
  left?: Path2D
  right?: Path2D
  upArrow?: Path2D
  downArrow?: Path2D
} = {}

function ensurePath2D() {
  if (typeof Path2D === 'undefined' || cachedPaths.left) return
  cachedPaths = {
    left: new Path2D(MOUSE_LEFT_BUTTON_PATH),
    right: new Path2D(MOUSE_RIGHT_BUTTON_PATH),
    upArrow: new Path2D(MOUSE_WHEEL_UP_ARROW_PATH),
    downArrow: new Path2D(MOUSE_WHEEL_DOWN_ARROW_PATH),
  }
}

function drawRoundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function decayRatio(isHeld: boolean, releaseMap: Map<any, number>, key: any, afterglowMs: number, now: number): number {
  if (isHeld) return 1
  if (afterglowMs <= 0) return 0
  const releasedAt = releaseMap.get(key)
  if (!releasedAt) return 0
  const elapsed = now - releasedAt
  if (elapsed >= afterglowMs) {
    releaseMap.delete(key)
    return 0
  }
  const t = 1 - elapsed / afterglowMs
  return t * t
}

function renderKeyLabel(
  ctx: CanvasRenderingContext2D,
  box: ComputedKeyBox,
  keyUnit: number,
  textColor: string,
  subTextColor: string,
  yOffset: number,
  fontFamily: string,
  countText?: string,
) {
  const baseFont = Math.max(9, Math.round(keyUnit * 0.32))
  const mainFont = box.isWide ? Math.max(9, Math.round(baseFont * 0.86)) : baseFont

  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (box.subLabel) {
    ctx.fillStyle = subTextColor
    ctx.font = `600 ${Math.max(8, Math.round(baseFont * 0.72))}px ${fontFamily}`
    ctx.fillText(box.subLabel, box.x + box.width / 2, box.y + yOffset + box.height * 0.3)

    ctx.fillStyle = textColor
    ctx.font = `700 ${mainFont}px ${fontFamily}`
    ctx.fillText(box.label, box.x + box.width / 2, box.y + yOffset + box.height * 0.64)
  } else {
    ctx.fillStyle = textColor
    ctx.font = `700 ${mainFont}px ${fontFamily}`
    ctx.fillText(box.label, box.x + box.width / 2, box.y + yOffset + box.height * 0.5)
  }

  if (countText) {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = subTextColor
    ctx.font = `600 8px ${fontFamily}`
    ctx.fillText(countText, box.x + box.width - 3, box.y + yOffset + box.height - 2)
  }
}

export function buildStaticKonvaScene(
  staticLayer: Konva.Layer,
  geom: ComputedKeyboardGeometry,
  mouseLayout: MouseLayoutRect | null,
  pal: KeycastCanvasPalette,
  keyUnit: number,
  interactive: boolean,
  callbacks: StaticSceneCallbacks,
  fontFamily?: string,
) {
  staticLayer.destroyChildren()
  const keyFont = fontFamily || DEFAULT_MONO_FONT

  const activeVirtualKeys = new Set<string>()
  const activeVirtualMouse = new Set<MouseButtonName>()

  if (pal.shellFill !== 'transparent' || pal.shellStrokeWidth > 0) {
    staticLayer.add(
      new Konva.Rect({
        x: STAGE_MARGIN,
        y: geom.keys[0] ? geom.keys[0].y - geom.padding : STAGE_MARGIN,
        width: geom.width,
        height: geom.height,
        cornerRadius: 14,
        fill: pal.shellFill,
        stroke: pal.shellStroke,
        strokeWidth: pal.shellStrokeWidth,
        shadowColor: pal.shellShadowColor,
        shadowBlur: pal.shellShadowBlur,
        listening: false,
      }),
    )
  }

  const keyStrokeWidth = pal.keyStroke === 'transparent' ? 0 : 1
  const textShadowProps = pal.textShadowColor
    ? { shadowColor: pal.textShadowColor, shadowBlur: 4, shadowOffsetY: 1 }
    : {}

  for (const box of geom.keys) {
    if (pal.keyPressOffset > 0 && pal.keyBottomFill !== 'transparent') {
      staticLayer.add(
        new Konva.Rect({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          cornerRadius: pal.keyCornerRadius,
          fill: pal.keyBottomFill,
          listening: false,
        }),
      )
    }

    const surfaceHeight = Math.max(8, box.height - pal.keyPressOffset)
    const keyTop = new Konva.Rect({
      x: box.x,
      y: box.y,
      width: box.width,
      height: surfaceHeight,
      cornerRadius: pal.keyCornerRadius,
      fill: pal.keyFill,
      stroke: pal.keyStroke,
      strokeWidth: keyStrokeWidth,
      listening: interactive,
    })

    if (interactive) {
      keyTop.on('mouseenter', () => callbacks.setCursor('pointer'))
      keyTop.on('mouseleave', () => {
        callbacks.setCursor('default')
        if (activeVirtualKeys.delete(box.code)) callbacks.onVirtualKeyUp(box.code)
      })
      keyTop.on('pointerdown', (evt) => {
        evt.cancelBubble = true
        activeVirtualKeys.add(box.code)
        callbacks.onVirtualKeyDown(box.code)
      })
      keyTop.on('pointerup', () => {
        if (activeVirtualKeys.delete(box.code)) callbacks.onVirtualKeyUp(box.code)
      })
    }
    staticLayer.add(keyTop)

    const baseFont = Math.max(9, Math.round(keyUnit * 0.32))
    const mainFont = box.isWide ? Math.max(9, Math.round(baseFont * 0.86)) : baseFont
    if (box.subLabel) {
      staticLayer.add(
        new Konva.Text({
          x: box.x,
          y: box.y + box.height * 0.14,
          width: box.width,
          align: 'center',
          text: box.subLabel,
          fontSize: Math.max(8, Math.round(baseFont * 0.72)),
          fontStyle: '600',
          fontFamily: keyFont,
          fill: pal.keySubText,
          listening: false,
          ...textShadowProps,
        }),
      )
      staticLayer.add(
        new Konva.Text({
          x: box.x,
          y: box.y + box.height * 0.44,
          width: box.width,
          align: 'center',
          text: box.label,
          fontSize: mainFont,
          fontStyle: '700',
          fontFamily: keyFont,
          fill: pal.keyText,
          listening: false,
          ...textShadowProps,
        }),
      )
    } else {
      staticLayer.add(
        new Konva.Text({
          x: box.x,
          y: box.y,
          width: box.width,
          height: surfaceHeight,
          align: 'center',
          verticalAlign: 'middle',
          text: box.label,
          fontSize: mainFont,
          fontStyle: '700',
          fontFamily: keyFont,
          fill: pal.keyText,
          listening: false,
          ...textShadowProps,
        }),
      )
    }
  }

  if (mouseLayout) {
    const mGroup = new Konva.Group({
      x: mouseLayout.x,
      y: mouseLayout.y,
      scaleX: mouseLayout.scale,
      scaleY: mouseLayout.scale,
    })

    const hasMouseBody = pal.mouseBodyFill !== 'transparent' || pal.mouseBodyStroke !== 'transparent'
    const mousePartStrokeWidth = pal.mousePartStroke === 'transparent' ? 0 : 1.2

    if (hasMouseBody) {
      mGroup.add(
        new Konva.Path({
          data: MOUSE_BODY_PATH,
          fill: pal.mouseBodyFill,
          stroke: pal.mouseBodyStroke,
          strokeWidth: pal.mouseBodyStroke === 'transparent' ? 0 : 1.5,
          shadowColor: pal.shellShadowColor,
          shadowBlur: pal.shellShadowBlur,
          listening: false,
        }),
      )
    }

    const bindInteractiveMouse = (node: Konva.Shape, btn: MouseButtonName) => {
      if (!interactive) return
      node.on('mouseenter', () => callbacks.setCursor('pointer'))
      node.on('mouseleave', () => {
        callbacks.setCursor('default')
        if (activeVirtualMouse.delete(btn)) callbacks.onVirtualMouseUp(btn)
      })
      node.on('pointerdown', (evt) => {
        evt.cancelBubble = true
        activeVirtualMouse.add(btn)
        callbacks.onVirtualMouseDown(btn)
      })
      node.on('pointerup', () => {
        if (activeVirtualMouse.delete(btn)) callbacks.onVirtualMouseUp(btn)
      })
    }

    for (const [btn, pathData] of [
      ['left', MOUSE_LEFT_BUTTON_PATH],
      ['right', MOUSE_RIGHT_BUTTON_PATH],
    ] as const) {
      const part = new Konva.Path({
        data: pathData,
        fill: pal.mousePartFill,
        stroke: pal.mousePartStroke,
        strokeWidth: mousePartStrokeWidth,
        listening: interactive,
      })
      bindInteractiveMouse(part, btn)
      mGroup.add(part)

      const meta = MOUSE_BUTTON_LABELS[btn]
      mGroup.add(
        new Konva.Text({
          x: meta.x - 12,
          y: meta.y - 7,
          width: 24,
          align: 'center',
          text: meta.text,
          fontSize: 12,
          fontStyle: '700',
          fontFamily: keyFont,
          fill: pal.mouseText,
          listening: false,
          ...textShadowProps,
        }),
      )
    }

    if (pal.mouseSeamStroke !== 'transparent') {
      mGroup.add(
        new Konva.Line({
          points: [31, 89, 109, 89],
          stroke: pal.mouseSeamStroke,
          strokeWidth: 1.4,
          listening: false,
        }),
      )
    }
    if (hasMouseBody) {
      mGroup.add(
        new Konva.Rect({
          x: MOUSE_WHEEL_WELL_RECT.x,
          y: MOUSE_WHEEL_WELL_RECT.y,
          width: MOUSE_WHEEL_WELL_RECT.width,
          height: MOUSE_WHEEL_WELL_RECT.height,
          cornerRadius: MOUSE_WHEEL_WELL_RECT.radius,
          fill: 'rgba(9, 9, 11, 0.72)',
          listening: false,
        }),
      )
    }
    mGroup.add(new Konva.Path({ data: MOUSE_WHEEL_UP_ARROW_PATH, fill: 'rgba(255, 255, 255, 0.22)', listening: false }))
    mGroup.add(
      new Konva.Path({ data: MOUSE_WHEEL_DOWN_ARROW_PATH, fill: 'rgba(255, 255, 255, 0.22)', listening: false }),
    )

    const middleWheel = new Konva.Rect({
      x: MOUSE_MIDDLE_RECT.x,
      y: MOUSE_MIDDLE_RECT.y,
      width: MOUSE_MIDDLE_RECT.width,
      height: MOUSE_MIDDLE_RECT.height,
      cornerRadius: MOUSE_MIDDLE_RECT.radius,
      fill: pal.mousePartFill,
      stroke: pal.mousePartStroke,
      strokeWidth: mousePartStrokeWidth,
      listening: interactive,
    })
    bindInteractiveMouse(middleWheel, 'middle')
    mGroup.add(middleWheel)

    for (const sideKey of ['forward', 'back'] as const) {
      const rect = MOUSE_SIDE_BUTTONS[sideKey]
      const sideNode = new Konva.Rect({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        cornerRadius: rect.radius,
        fill: pal.mousePartFill,
        stroke: pal.mousePartStroke,
        strokeWidth: mousePartStrokeWidth,
        listening: interactive,
      })
      bindInteractiveMouse(sideNode, sideKey)
      mGroup.add(sideNode)

      if (rect.label) {
        mGroup.add(
          new Konva.Text({
            x: (rect.labelX ?? 0) - 10,
            y: (rect.labelY ?? 0) - 5,
            width: 20,
            align: 'center',
            text: rect.label,
            fontSize: 8,
            fontStyle: '700',
            fontFamily: keyFont,
            fill: withAlpha(pal.mouseText, 0.65),
            listening: false,
            ...textShadowProps,
          }),
        )
      }
    }

    if (hasMouseBody) {
      mGroup.add(
        new Konva.Circle({
          x: MOUSE_RADAR_CENTER.x,
          y: MOUSE_RADAR_CENTER.y,
          radius: MOUSE_RADAR_CENTER.radius,
          stroke: 'rgba(255, 255, 255, 0.14)',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        }),
      )
    }

    staticLayer.add(mGroup)
  }

  staticLayer.batchDraw()
}

function renderPressEffectsAndSparks(ctx: CanvasRenderingContext2D, rc: DynamicRenderContext, now: number): boolean {
  let hasActive = false

  for (let i = rc.effects.length - 1; i >= 0; i--) {
    const fx = rc.effects[i]
    const duration = fx.kind === 'beam' ? BEAM_DURATION_MS : RIPPLE_DURATION_MS
    const elapsed = now - fx.startTs
    if (elapsed >= duration) {
      rc.effects.splice(i, 1)
      continue
    }
    hasActive = true
    const progress = elapsed / duration
    const eased = 1 - Math.pow(1 - progress, 3)

    ctx.save()
    if (fx.kind === 'ripple') {
      ctx.beginPath()
      ctx.arc(fx.x, fx.y, fx.maxRadius * (0.35 + 0.65 * eased), 0, Math.PI * 2)
      ctx.strokeStyle = withAlpha(fx.color, (1 - progress) * 0.65)
      ctx.shadowColor = fx.glowColor
      ctx.shadowBlur = 8 * (1 - progress)
      ctx.lineWidth = 2 * (1 - progress * 0.45)
      ctx.stroke()
    } else if (fx.kind === 'shockwave') {
      const expand = eased * 14
      drawRoundedRectPath(
        ctx,
        fx.x - fx.width / 2 - expand / 2,
        fx.y - fx.height / 2 - expand / 2,
        fx.width + expand,
        fx.height + expand,
        fx.cornerRadius + expand * 0.35,
      )
      ctx.strokeStyle = withAlpha(fx.color, (1 - progress) * 0.78)
      ctx.shadowColor = fx.glowColor
      ctx.shadowBlur = 10 * (1 - progress)
      ctx.lineWidth = 2.2 * (1 - progress * 0.5)
      ctx.stroke()
    } else if (fx.kind === 'beam') {
      const beamH = 38
      const travelY = fx.y - fx.height / 2 - eased * 32
      const grad = ctx.createLinearGradient(0, travelY + beamH, 0, travelY)
      grad.addColorStop(0, withAlpha(fx.color, (1 - progress) * 0.58))
      grad.addColorStop(1, withAlpha(fx.color, 0))
      drawRoundedRectPath(ctx, fx.x - fx.width / 2 + 2, travelY, Math.max(8, fx.width - 4), beamH, 4)
      ctx.fillStyle = grad
      ctx.fill()
    }
    ctx.restore()
  }

  for (let i = rc.sparks.length - 1; i >= 0; i--) {
    const sp = rc.sparks[i]
    const elapsed = now - sp.startTs
    if (elapsed >= SPARK_DURATION_MS) {
      rc.sparks.splice(i, 1)
      continue
    }
    hasActive = true
    const t = elapsed / SPARK_DURATION_MS
    const dt = elapsed / 16
    const px = sp.x + sp.vx * dt * (1 - t * 0.35)
    const py = sp.y + sp.vy * dt * (1 - t * 0.35) + 0.045 * dt * dt
    const alpha = Math.max(0, 1 - t * t)

    ctx.save()
    ctx.beginPath()
    ctx.arc(px, py, sp.size * (1 - t * 0.4), 0, Math.PI * 2)
    ctx.fillStyle = withAlpha(sp.color, alpha)
    ctx.shadowColor = sp.glowColor
    ctx.shadowBlur = 8 * alpha
    ctx.fill()
    ctx.restore()
  }

  return hasActive
}

export function renderDynamicKonvaFrame(
  ctx: CanvasRenderingContext2D,
  rc: DynamicRenderContext,
): {
  keepAnimating: boolean
  wheelUpExpired: boolean
  wheelDownExpired: boolean
} {
  ensurePath2D()
  const now = performance.now()
  const pal = rc.palette
  const afterglowMs = resolveAfterglowMs(rc.state)
  const pressEffect = resolvePressEffect(rc.state)
  const colorMode = rc.state.colorMode || 'solid'
  const customFont = resolveFontFamilyCss(rc.state.fontFamily)
  const keyFont = customFont || DEFAULT_MONO_FONT
  const hudFont = customFont || DEFAULT_SANS_FONT
  const wallNow = Date.now()
  let keepAnimating = false
  let wheelUpExpired = false
  let wheelDownExpired = false

  // 1. HUD 状态条
  if (rc.state.showApm) {
    const hudText = `KPS ${rc.kps}  ·  APM ${rc.apm}  ·  KEYS ${rc.totalPresses}`
    ctx.font = `700 11px ${hudFont}`
    const pillW = Math.round(ctx.measureText(hudText).width + 34)
    const pillH = 24
    const pillX = STAGE_MARGIN
    const pillY = STAGE_MARGIN + 2
    const hudToken = resolveKeyAccentTokens(pal, rc.state.theme, rc.state.accentColor, colorMode, 0.1, 'hud', wallNow)

    ctx.save()
    if (pal.hudFill !== 'transparent' || pal.hudStroke !== 'transparent') {
      drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, 12)
      ctx.fillStyle = pal.hudFill
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = pal.hudStroke
      ctx.stroke()
    }

    ctx.beginPath()
    ctx.arc(pillX + 12, pillY + pillH / 2, 3.5, 0, Math.PI * 2)
    ctx.fillStyle = hudToken.stroke
    ctx.shadowColor = hudToken.glow
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.shadowBlur = 0

    ctx.fillStyle = pal.hudText
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    if (pal.textShadowColor) {
      ctx.shadowColor = pal.textShadowColor
      ctx.shadowBlur = 4
    }
    ctx.fillText(hudText, pillX + 21, pillY + pillH / 2 + 0.5)
    ctx.restore()
  }

  // 2. 键盘动态层
  let maxKeyCount = 0
  if (rc.state.enableHeatmap) {
    for (const box of rc.keyboardGeom.keys) {
      const c = rc.keyCounts[box.code] ?? 0
      if (c > maxKeyCount) maxKeyCount = c
    }
  }

  const showKeyCount = rc.state.showKeyCount
  const kbSpanW = Math.max(1, rc.keyboardGeom.width)
  for (const box of rc.keyboardGeom.keys) {
    const isHeld = rc.pressedCodes.has(box.code)
    const activeRatio = decayRatio(isHeld, rc.keyReleaseTs, box.code, afterglowMs, now)
    const count = rc.keyCounts[box.code] ?? 0
    const heatRatio = rc.state.enableHeatmap && maxKeyCount > 0 ? Math.min(1, count / maxKeyCount) : 0

    if ((activeRatio > 0 && activeRatio < 1) || (isHeld && colorMode === 'rainbow')) {
      keepAnimating = true
    }
    if (activeRatio <= 0 && heatRatio <= 0 && !(showKeyCount && count > 0)) continue

    const normX = Math.max(0, Math.min(1, (box.x - STAGE_MARGIN) / kbSpanW))
    const token = resolveKeyAccentTokens(pal, rc.state.theme, rc.state.accentColor, colorMode, normX, box.code, wallNow)

    ctx.save()
    if (activeRatio > 0) {
      const pressOffset = pal.keyPressOffset * activeRatio
      if (pal.keyPressOffset > 0 && pal.keyBottomFill !== 'transparent') {
        drawRoundedRectPath(ctx, box.x, box.y, box.width, box.height, pal.keyCornerRadius)
        ctx.fillStyle = pal.keyBottomFill
        ctx.fill()
      }

      const surfaceH =
        pal.keyPressOffset > 0
          ? Math.max(8, box.height - Math.max(2, pal.keyPressOffset) + pressOffset * 0.45)
          : box.height
      drawRoundedRectPath(ctx, box.x, box.y + pressOffset, box.width, surfaceH, pal.keyCornerRadius)
      ctx.fillStyle = withAlpha(token.fill, 0.2 + 0.8 * activeRatio)
      ctx.shadowColor = token.glow
      ctx.shadowBlur = 14 * activeRatio
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.lineWidth = 1.4
      ctx.strokeStyle = withAlpha(token.stroke, 0.35 + 0.65 * activeRatio)
      ctx.stroke()

      // 长按音游光柱持续微光
      if (isHeld && pressEffect === 'beam') {
        const beamH = 22
        const grad = ctx.createLinearGradient(0, box.y, 0, box.y - beamH)
        grad.addColorStop(0, withAlpha(token.stroke, 0.42))
        grad.addColorStop(1, withAlpha(token.stroke, 0))
        drawRoundedRectPath(ctx, box.x + 2, box.y - beamH, Math.max(8, box.width - 4), beamH + 4, 4)
        ctx.fillStyle = grad
        ctx.fill()
      }

      const labelColor = activeRatio > 0.45 ? token.activeText : pal.keyText
      const subColor = activeRatio > 0.45 ? withAlpha(token.activeText, 0.72) : pal.keySubText
      renderKeyLabel(
        ctx,
        box,
        rc.keyUnit,
        labelColor,
        subColor,
        pressOffset,
        keyFont,
        showKeyCount && count > 0 ? String(count) : undefined,
      )
    } else {
      const surfaceH = Math.max(8, box.height - pal.keyPressOffset)
      if (heatRatio > 0) {
        drawRoundedRectPath(ctx, box.x, box.y, box.width, surfaceH, pal.keyCornerRadius)
        ctx.fillStyle = withAlpha(token.fill, 0.1 + heatRatio * 0.35)
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = withAlpha(token.stroke, 0.16 + heatRatio * 0.4)
        ctx.stroke()
      }
      if (showKeyCount && count > 0) {
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = pal.keySubText
        ctx.font = `600 8px ${keyFont}`
        ctx.fillText(String(count), box.x + box.width - 3, box.y + box.height - 2)
      }
    }
    ctx.restore()
  }

  // 3. 敲击特效（波纹 / 脉冲框 / 火花粒子 / 上飘光柱）
  if (pressEffect === 'none') {
    rc.effects.length = 0
    rc.sparks.length = 0
  } else if (renderPressEffectsAndSparks(ctx, rc, now)) {
    keepAnimating = true
  }

  // 4. 鼠标交互高亮、滚轮脉冲与光轨
  if (rc.mouseLayout) {
    ctx.save()
    ctx.translate(rc.mouseLayout.x, rc.mouseLayout.y)
    ctx.scale(rc.mouseLayout.scale, rc.mouseLayout.scale)

    const mouseRatio = (btn: MouseButtonName) =>
      decayRatio(rc.pressedMouse.has(btn), rc.mouseReleaseTs, btn, afterglowMs, now)

    const ratios: Record<MouseButtonName, number> = {
      left: mouseRatio('left'),
      right: mouseRatio('right'),
      middle: mouseRatio('middle'),
      back: mouseRatio('back'),
      forward: mouseRatio('forward'),
    }
    if (Object.values(ratios).some((r) => r > 0 && r < 1)) keepAnimating = true

    const mouseToken = (btn: string) =>
      resolveKeyAccentTokens(pal, rc.state.theme, rc.state.accentColor, colorMode, 0.92, btn, wallNow)

    for (const [btn, path] of [
      ['left', cachedPaths.left],
      ['right', cachedPaths.right],
    ] as const) {
      const ratio = ratios[btn]
      const count = rc.mouseCounts[btn] ?? 0
      if (!path || (ratio <= 0 && !(showKeyCount && count > 0))) continue
      const token = mouseToken(btn)
      if (ratio > 0) {
        ctx.save()
        ctx.fillStyle = withAlpha(token.fill, 0.25 + 0.75 * ratio)
        ctx.shadowColor = token.glow
        ctx.shadowBlur = 12 * ratio
        ctx.fill(path)
        ctx.shadowBlur = 0
        ctx.lineWidth = 1.4
        ctx.strokeStyle = withAlpha(token.stroke, 0.4 + 0.6 * ratio)
        ctx.stroke(path)
        ctx.restore()
      }
      const meta = MOUSE_BUTTON_LABELS[btn]
      ctx.fillStyle = ratio > 0.45 ? token.activeText : pal.mouseText
      ctx.font = `700 12px ${keyFont}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(showKeyCount && count > 0 ? String(count) : meta.text, meta.x, meta.y)
    }

    if (ratios.middle > 0) {
      const token = mouseToken('middle')
      ctx.save()
      drawRoundedRectPath(
        ctx,
        MOUSE_MIDDLE_RECT.x,
        MOUSE_MIDDLE_RECT.y,
        MOUSE_MIDDLE_RECT.width,
        MOUSE_MIDDLE_RECT.height,
        MOUSE_MIDDLE_RECT.radius,
      )
      ctx.fillStyle = withAlpha(token.fill, 0.3 + 0.7 * ratios.middle)
      ctx.shadowColor = token.glow
      ctx.shadowBlur = 10 * ratios.middle
      ctx.fill()
      ctx.strokeStyle = token.stroke
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }

    for (const sideKey of ['forward', 'back'] as const) {
      const ratio = ratios[sideKey]
      if (ratio <= 0) continue
      const token = mouseToken(sideKey)
      const rect = MOUSE_SIDE_BUTTONS[sideKey]
      ctx.save()
      drawRoundedRectPath(ctx, rect.x, rect.y, rect.width, rect.height, rect.radius)
      ctx.fillStyle = withAlpha(token.fill, 0.3 + 0.7 * ratio)
      ctx.shadowColor = token.glow
      ctx.shadowBlur = 10 * ratio
      ctx.fill()
      ctx.strokeStyle = token.stroke
      ctx.lineWidth = 1.2
      ctx.stroke()
      ctx.restore()
    }

    const wheelToken = mouseToken('middle')
    for (const [ts, path, isUp] of [
      [rc.wheelUpTs, cachedPaths.upArrow, true],
      [rc.wheelDownTs, cachedPaths.downArrow, false],
    ] as const) {
      if (ts <= 0 || !path) continue
      const elapsed = now - ts
      if (elapsed < WHEEL_PULSE_DURATION_MS) {
        keepAnimating = true
        const alpha = 1 - elapsed / WHEEL_PULSE_DURATION_MS
        ctx.save()
        ctx.fillStyle = withAlpha(wheelToken.stroke, alpha)
        ctx.shadowColor = wheelToken.glow
        ctx.shadowBlur = 8 * alpha
        ctx.fill(path)
        ctx.restore()
      } else if (isUp) {
        wheelUpExpired = true
      } else {
        wheelDownExpired = true
      }
    }

    if (rc.state.enableMouseTrail) {
      while (rc.mouseTrail.length > 0 && now - rc.mouseTrail[0].ts > TRAIL_LIFETIME_MS) {
        rc.mouseTrail.shift()
      }
      if (rc.mouseTrail.length > 1) {
        keepAnimating = true
        for (let i = 1; i < rc.mouseTrail.length; i++) {
          const p0 = rc.mouseTrail[i - 1]
          const p1 = rc.mouseTrail[i]
          const life = 1 - (now - p1.ts) / TRAIL_LIFETIME_MS
          ctx.beginPath()
          ctx.moveTo(MOUSE_RADAR_CENTER.x + p0.x, MOUSE_RADAR_CENTER.y + p0.y)
          ctx.lineTo(MOUSE_RADAR_CENTER.x + p1.x, MOUSE_RADAR_CENTER.y + p1.y)
          ctx.strokeStyle = withAlpha(p1.color, Math.max(0, life * 0.78))
          ctx.lineWidth = Math.max(1.2, 3.2 * life)
          ctx.lineCap = 'round'
          ctx.stroke()
        }
      }

      if (rc.radarCursor.lastMoveTs > 0) {
        const idleMs = now - rc.radarCursor.lastMoveTs
        if (idleMs > 90 && (Math.abs(rc.radarCursor.x) > 0.3 || Math.abs(rc.radarCursor.y) > 0.3)) {
          rc.radarCursor.x *= 0.85
          rc.radarCursor.y *= 0.85
          keepAnimating = true
        } else if (idleMs > 90) {
          rc.radarCursor.x = 0
          rc.radarCursor.y = 0
          rc.radarCursor.lastMoveTs = 0
        } else {
          keepAnimating = true
        }
      }

      const cx = MOUSE_RADAR_CENTER.x + radarCursorCoord(rc.radarCursor.x)
      const cy = MOUSE_RADAR_CENTER.y + radarCursorCoord(rc.radarCursor.y)
      const isMoved = Math.abs(rc.radarCursor.x) > 0.4 || Math.abs(rc.radarCursor.y) > 0.4
      const cursorToken = mouseToken('left')
      ctx.beginPath()
      ctx.arc(cx, cy, isMoved ? 4.5 : 3.5, 0, Math.PI * 2)
      ctx.fillStyle = isMoved ? cursorToken.stroke : withAlpha(pal.mouseText, 0.35)
      if (isMoved) {
        ctx.shadowColor = cursorToken.glow
        ctx.shadowBlur = 10
      }
      ctx.fill()
      ctx.shadowBlur = 0
    }

    ctx.restore()
  }

  return { keepAnimating, wheelUpExpired, wheelDownExpired }
}

function radarCursorCoord(val: number): number {
  return Number.isFinite(val) ? val : 0
}
