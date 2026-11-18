<script setup lang="ts">
import Konva from 'konva'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { computeKeyboardGeometry } from './keyboardLayouts'
import { buildStaticKonvaScene, renderDynamicKonvaFrame, STAGE_MARGIN } from './keycastCanvasRenderer'
import type { MouseLayoutRect, PressEffectInstance, SparkParticle, TrailPoint } from './keycastCanvasRenderer'
import { buildKeycastCanvasPalette, resolveKeyAccentTokens } from './keycastTheme'
import { MOUSE_BUTTON_LABELS, MOUSE_RADAR_CENTER, MOUSE_VIEWBOX_HEIGHT, MOUSE_VIEWBOX_WIDTH } from './mouseGeometry'
import { resolvePressEffect } from './types'
import type { KeycastState, MouseButtonName, MouseWheelDirection } from './types'

const props = withDefaults(
  defineProps<{
    state: KeycastState
    pressedCodes: Set<string>
    pressedMouse: Set<MouseButtonName>
    keyCounts: Record<string, number>
    mouseCounts: Record<MouseButtonName, number>
    kps: number
    apm: number
    totalPresses: number
    interactive?: boolean
  }>(),
  {
    interactive: false,
  },
)

const emit = defineEmits<{
  virtualKeyDown: [code: string]
  virtualKeyUp: [code: string]
  virtualMouseDown: [button: MouseButtonName]
  virtualMouseUp: [button: MouseButtonName]
}>()

const containerRef = ref<HTMLDivElement | null>(null)

const keyUnit = computed(() => Math.max(26, Math.min(52, Math.round((props.state.fontSize || 15) * 2.5))))
const keyGap = computed(() => Math.max(3, Math.round(keyUnit.value * 0.11)))
const hudHeight = computed(() => (props.state.showApm ? 28 : 0))
const hudGap = computed(() => (props.state.showApm ? 8 : 0))

const keyboardGeom = computed(() =>
  computeKeyboardGeometry(
    props.state.keyboardLayout,
    keyUnit.value,
    keyGap.value,
    STAGE_MARGIN,
    STAGE_MARGIN + hudHeight.value + hudGap.value,
  ),
)

const mouseLayout = computed<MouseLayoutRect | null>(() => {
  if (!props.state.showMouse) return null
  const height = keyboardGeom.value.height
  const scale = height / MOUSE_VIEWBOX_HEIGHT
  return {
    x: keyboardGeom.value.width + STAGE_MARGIN + 14,
    y: STAGE_MARGIN + hudHeight.value + hudGap.value,
    width: Math.round(MOUSE_VIEWBOX_WIDTH * scale),
    height,
    scale,
  }
})

const stageWidth = computed(() => {
  const rightEdge = mouseLayout.value
    ? mouseLayout.value.x + mouseLayout.value.width
    : STAGE_MARGIN + keyboardGeom.value.width
  return Math.max(rightEdge + STAGE_MARGIN, props.state.showApm ? 240 : 0)
})

const stageHeight = computed(() => STAGE_MARGIN * 2 + hudHeight.value + hudGap.value + keyboardGeom.value.height)
const palette = computed(() => buildKeycastCanvasPalette(props.state.theme, props.state.accentColor))

let stage: Konva.Stage | null = null
let staticLayer: Konva.Layer | null = null
let dynamicLayer: Konva.Layer | null = null
let dynamicShape: Konva.Shape | null = null
let rafId: number | null = null

const keyReleaseTs = new Map<string, number>()
const mouseReleaseTs = new Map<MouseButtonName, number>()
const effects: PressEffectInstance[] = []
const sparks: SparkParticle[] = []
const mouseTrail: TrailPoint[] = []
let wheelUpTs = 0
let wheelDownTs = 0
let radarCursor = { x: 0, y: 0, lastMoveTs: 0 }

function scheduleFrame() {
  if (rafId !== null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    dynamicLayer?.batchDraw()
  })
}

function spawnPressEffect(cx: number, cy: number, width: number, height: number, normX: number, keyOrBtn: string) {
  const kind = resolvePressEffect(props.state)
  if (kind === 'none') return

  const now = performance.now()
  const token = resolveKeyAccentTokens(
    palette.value,
    props.state.theme,
    props.state.accentColor,
    props.state.colorMode || 'solid',
    normX,
    keyOrBtn,
    Date.now(),
  )

  if (kind === 'spark') {
    const count = 7
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.45
      const speed = 1.4 + Math.random() * 1.9
      sparks.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 0.8,
        size: 1.8 + Math.random() * 1.6,
        startTs: now,
        color: token.stroke,
        glowColor: token.glow,
      })
    }
    return
  }

  effects.push({
    kind,
    x: cx,
    y: cy,
    width,
    height,
    cornerRadius: palette.value.keyCornerRadius,
    maxRadius: Math.max(width, height) * 0.85,
    startTs: now,
    color: token.stroke,
    glowColor: token.glow,
  })
}

function rebuildStaticScene() {
  if (!stage || !staticLayer) return
  stage.size({ width: stageWidth.value, height: stageHeight.value })
  buildStaticKonvaScene(
    staticLayer,
    keyboardGeom.value,
    mouseLayout.value,
    palette.value,
    keyUnit.value,
    props.interactive,
    {
      onVirtualKeyDown: (code) => emit('virtualKeyDown', code),
      onVirtualKeyUp: (code) => emit('virtualKeyUp', code),
      onVirtualMouseDown: (btn) => emit('virtualMouseDown', btn),
      onVirtualMouseUp: (btn) => emit('virtualMouseUp', btn),
      setCursor: (cursor) => {
        if (stage) stage.container().style.cursor = cursor
      },
    },
  )
  scheduleFrame()
}

function notifyKeyTriggered(code: string) {
  keyReleaseTs.delete(code)
  const box = keyboardGeom.value.keys.find((k) => k.code === code)
  if (box) {
    const normX = Math.max(0, Math.min(1, (box.x - STAGE_MARGIN) / Math.max(1, keyboardGeom.value.width)))
    spawnPressEffect(box.x + box.width / 2, box.y + box.height / 2, box.width, box.height, normX, code)
  }
  scheduleFrame()
}

function notifyKeyReleased(code: string) {
  keyReleaseTs.set(code, performance.now())
  scheduleFrame()
}

function notifyMouseTriggered(btn: MouseButtonName) {
  mouseReleaseTs.delete(btn)
  const mLayout = mouseLayout.value
  if (mLayout) {
    const meta = MOUSE_BUTTON_LABELS[btn]
    const size = 28 * mLayout.scale
    spawnPressEffect(mLayout.x + meta.x * mLayout.scale, mLayout.y + meta.y * mLayout.scale, size, size, 0.92, btn)
  }
  scheduleFrame()
}

function notifyMouseReleased(btn: MouseButtonName) {
  mouseReleaseTs.set(btn, performance.now())
  scheduleFrame()
}

function notifyWheel(direction: MouseWheelDirection) {
  const now = performance.now()
  if (direction === 'up') wheelUpTs = now
  else wheelDownTs = now
  scheduleFrame()
}

function notifyMouseMove(dx: number, dy: number) {
  if (!props.state.enableMouseTrail) return
  const now = performance.now()
  const maxR = MOUSE_RADAR_CENTER.radius - 3
  const nextX = Math.max(-maxR, Math.min(maxR, radarCursor.x + dx * 0.25))
  const nextY = Math.max(-maxR, Math.min(maxR, radarCursor.y + dy * 0.25))
  const len = Math.hypot(nextX, nextY)
  if (len > maxR) {
    radarCursor.x = (nextX / len) * maxR
    radarCursor.y = (nextY / len) * maxR
  } else {
    radarCursor.x = nextX
    radarCursor.y = nextY
  }
  radarCursor.lastMoveTs = now
  const token = resolveKeyAccentTokens(
    palette.value,
    props.state.theme,
    props.state.accentColor,
    props.state.colorMode || 'solid',
    0.92,
    'left',
    Date.now(),
  )
  mouseTrail.push({ x: radarCursor.x, y: radarCursor.y, ts: now, color: token.stroke })
  if (mouseTrail.length > 26) mouseTrail.shift()
  scheduleFrame()
}

function clearVisualEffects() {
  keyReleaseTs.clear()
  mouseReleaseTs.clear()
  effects.length = 0
  sparks.length = 0
  mouseTrail.length = 0
  wheelUpTs = 0
  wheelDownTs = 0
  radarCursor = { x: 0, y: 0, lastMoveTs: 0 }
  scheduleFrame()
}

defineExpose({
  notifyKeyTriggered,
  notifyKeyReleased,
  notifyMouseTriggered,
  notifyMouseReleased,
  notifyWheel,
  notifyMouseMove,
  clearVisualEffects,
})

onMounted(() => {
  if (!containerRef.value) return
  Konva.pixelRatio = Math.max(window.devicePixelRatio || 1, 2)

  stage = new Konva.Stage({
    container: containerRef.value,
    width: stageWidth.value,
    height: stageHeight.value,
  })
  staticLayer = new Konva.Layer({ listening: props.interactive })
  dynamicLayer = new Konva.Layer({ listening: false })

  dynamicShape = new Konva.Shape({
    listening: false,
    sceneFunc: (ctx) => {
      const nativeCtx = (ctx as unknown as { _context: CanvasRenderingContext2D })._context
      const res = renderDynamicKonvaFrame(nativeCtx, {
        state: props.state,
        palette: palette.value,
        keyboardGeom: keyboardGeom.value,
        mouseLayout: mouseLayout.value,
        keyUnit: keyUnit.value,
        pressedCodes: props.pressedCodes,
        pressedMouse: props.pressedMouse,
        keyCounts: props.keyCounts,
        mouseCounts: props.mouseCounts,
        kps: props.kps,
        apm: props.apm,
        totalPresses: props.totalPresses,
        keyReleaseTs,
        mouseReleaseTs,
        effects,
        sparks,
        mouseTrail,
        wheelUpTs,
        wheelDownTs,
        radarCursor,
      })
      if (res.wheelUpExpired) wheelUpTs = 0
      if (res.wheelDownExpired) wheelDownTs = 0
      if (res.keepAnimating) scheduleFrame()
    },
  })

  dynamicLayer.add(dynamicShape)
  stage.add(staticLayer)
  stage.add(dynamicLayer)
  rebuildStaticScene()
})

watch(
  [
    () => props.state.keyboardLayout,
    () => props.state.showMouse,
    () => props.state.showApm,
    () => props.state.theme,
    () => props.state.accentColor,
    () => props.state.fontSize,
    () => props.interactive,
  ],
  rebuildStaticScene,
)

watch(
  [
    () => props.state.showKeyCount,
    () => props.state.enableHeatmap,
    () => props.state.pressEffect,
    () => props.state.colorMode,
    () => props.state.afterglowMs,
    () => props.state.enableAfterglow,
    () => props.state.enableRipple,
    () => props.state.enableMouseTrail,
    () => props.kps,
    () => props.apm,
    () => props.totalPresses,
    () => props.pressedCodes.size,
    () => props.pressedMouse.size,
  ],
  scheduleFrame,
)

onBeforeUnmount(() => {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  stage?.destroy()
  stage = null
  staticLayer = null
  dynamicLayer = null
  dynamicShape = null
})
</script>

<template>
  <div
    ref="containerRef"
    class="inline-block select-none"
    :style="{
      width: `${stageWidth}px`,
      height: `${stageHeight}px`,
      opacity: Math.max(0.3, Math.min(1, (state.opacity ?? 100) / 100)),
    }"
    @contextmenu.prevent
  />
</template>
