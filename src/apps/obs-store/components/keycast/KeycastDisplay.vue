<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_KEYCAST_STATE, formatKeyboardEvent, mapMouseButton } from './types'
import type { KeycastAction, KeycastState, KeyPressPayload, MouseButtonName, MouseWheelDirection } from './types'

const KeycastCanvasOverlay = defineAsyncComponent(() => import('./KeycastCanvasOverlay.vue'))

interface KeycastStreamItem {
  id: number
  signature: string
  parts: string[]
  count: number
  ts: number
}

const props = withDefaults(
  defineProps<{
    channelId?: string
    userId?: number
    inlineMode?: boolean
    interactive?: boolean
    noShadow?: boolean
  }>(),
  {
    inlineMode: false,
    interactive: false,
    noShadow: false,
  },
)

const emit = defineEmits<{
  virtualKeyDown: [code: string]
  virtualKeyUp: [code: string]
  virtualMouseDown: [button: MouseButtonName]
  virtualMouseUp: [button: MouseButtonName]
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<KeycastState, KeycastAction>({
  componentId: 'keycast',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_KEYCAST_STATE,
  role: 'viewer',
})

const canvasOverlayRef = ref<InstanceType<typeof KeycastCanvasOverlay> | null>(null)

const items = ref<KeycastStreamItem[]>([])
const pressTimestamps = ref<number[]>([])
const nowTs = ref(Date.now())
const pressedCodes = ref<Set<string>>(new Set())
const pressedMouse = ref<Set<MouseButtonName>>(new Set())
const keyCounts = ref<Record<string, number>>({})
const mouseCounts = ref<Record<MouseButtonName, number>>({
  left: 0,
  middle: 0,
  right: 0,
  back: 0,
  forward: 0,
})
const totalPresses = ref(0)

let nextId = 1
let tickTimer: ReturnType<typeof setInterval> | null = null
const activePressTimers = new Map<string, ReturnType<typeof setTimeout>>()

const kps = computed(() => {
  const cutoff = nowTs.value - 1000
  return pressTimestamps.value.filter((t) => t >= cutoff).length
})

const apm = computed(() => {
  const windowMs = 15000
  const cutoff = nowTs.value - windowMs
  const recent = pressTimestamps.value.filter((t) => t >= cutoff)
  return Math.round((recent.length * 60000) / windowMs)
})

function recordTimestamp(ts = Date.now()) {
  pressTimestamps.value = [...pressTimestamps.value.filter((t) => ts - t < 15000), ts]
}

function pushStreamKeyPress(payload: KeyPressPayload) {
  const parts =
    state.value.showCombos && payload.modifiers.length > 0 ? [...payload.modifiers, payload.label] : [payload.label]
  const signature = parts.join('+')
  const ts = payload.ts || Date.now()

  const last = items.value[items.value.length - 1]
  if (last && last.signature === signature && ts - last.ts < Math.min(1200, state.value.fadeDelayMs)) {
    last.count += 1
    last.ts = ts
    items.value = [...items.value]
    return
  }

  const nextList = [
    ...items.value,
    {
      id: nextId++,
      signature,
      parts,
      count: 1,
      ts,
    },
  ]
  const limit = Math.max(1, state.value.maxKeys || 6)
  items.value = nextList.slice(-limit)
}

function triggerKeyDown(code: string, payload?: KeyPressPayload) {
  const isFresh = !pressedCodes.value.has(code)
  if (isFresh) {
    const next = new Set(pressedCodes.value)
    next.add(code)
    pressedCodes.value = next

    const ts = payload?.ts || Date.now()
    recordTimestamp(ts)
    totalPresses.value += 1
    keyCounts.value = {
      ...keyCounts.value,
      [code]: (keyCounts.value[code] ?? 0) + 1,
    }
    canvasOverlayRef.value?.notifyKeyTriggered(code)
  }

  if (payload && state.value.displayMode === 'stream') {
    pushStreamKeyPress(payload)
  }
}

function triggerKeyUp(code: string) {
  if (!pressedCodes.value.has(code)) return
  const next = new Set(pressedCodes.value)
  next.delete(code)
  pressedCodes.value = next
  canvasOverlayRef.value?.notifyKeyReleased(code)
}

function triggerOneShotPress(payload: KeyPressPayload) {
  const code = payload.code
  const prevTimer = activePressTimers.get(code)
  if (prevTimer) clearTimeout(prevTimer)

  triggerKeyDown(code, payload)
  const timer = setTimeout(() => {
    activePressTimers.delete(code)
    triggerKeyUp(code)
  }, 150)
  activePressTimers.set(code, timer)
}

function triggerMouseDown(btn: MouseButtonName) {
  if (!pressedMouse.value.has(btn)) {
    const next = new Set(pressedMouse.value)
    next.add(btn)
    pressedMouse.value = next

    recordTimestamp()
    totalPresses.value += 1
    mouseCounts.value = {
      ...mouseCounts.value,
      [btn]: (mouseCounts.value[btn] ?? 0) + 1,
    }
    canvasOverlayRef.value?.notifyMouseTriggered(btn)
  }
}

function triggerMouseUp(btn: MouseButtonName) {
  if (!pressedMouse.value.has(btn)) return
  const next = new Set(pressedMouse.value)
  next.delete(btn)
  pressedMouse.value = next
  canvasOverlayRef.value?.notifyMouseReleased(btn)
}

function triggerWheel(dir: MouseWheelDirection) {
  recordTimestamp()
  canvasOverlayRef.value?.notifyWheel(dir)
}

function triggerMouseMove(dx: number, dy: number) {
  canvasOverlayRef.value?.notifyMouseMove(dx, dy)
}

function clearAll() {
  for (const timer of activePressTimers.values()) clearTimeout(timer)
  activePressTimers.clear()
  items.value = []
  pressTimestamps.value = []
  pressedCodes.value = new Set()
  pressedMouse.value = new Set()
  keyCounts.value = {}
  mouseCounts.value = { left: 0, middle: 0, right: 0, back: 0, forward: 0 }
  totalPresses.value = 0
  canvasOverlayRef.value?.clearVisualEffects()
}

function releaseAllHeldInputs() {
  for (const code of pressedCodes.value) {
    canvasOverlayRef.value?.notifyKeyReleased(code)
  }
  for (const btn of pressedMouse.value) {
    canvasOverlayRef.value?.notifyMouseReleased(btn)
  }
  pressedCodes.value = new Set()
  pressedMouse.value = new Set()
}

// OBS 独立浏览源非内联模式下直接监听页面级键鼠事件
function handleWindowKeydown(event: KeyboardEvent) {
  if (props.inlineMode) return
  const payload = formatKeyboardEvent(event)
  if (!payload) return
  triggerKeyDown(payload.code, payload)
}

function handleWindowKeyup(event: KeyboardEvent) {
  if (props.inlineMode) return
  const code = event.code || event.key
  if (code) triggerKeyUp(code)
}

function handleWindowMousedown(event: MouseEvent) {
  if (props.inlineMode) return
  const btn = mapMouseButton(event.button)
  if (btn) triggerMouseDown(btn)
}

function handleWindowMouseup(event: MouseEvent) {
  if (props.inlineMode) return
  const btn = mapMouseButton(event.button)
  if (btn) triggerMouseUp(btn)
}

function handleWindowWheel(event: WheelEvent) {
  if (props.inlineMode || event.deltaY === 0) return
  triggerWheel(event.deltaY < 0 ? 'up' : 'down')
}

function handleWindowMousemove(event: MouseEvent) {
  if (props.inlineMode) return
  if (event.movementX !== 0 || event.movementY !== 0) {
    triggerMouseMove(event.movementX, event.movementY)
  }
}

let stopActionListener: (() => void) | undefined

onMounted(() => {
  stopActionListener = onAction((action) => {
    switch (action.type) {
      case 'KEY_PRESS':
        triggerOneShotPress(action.payload)
        break
      case 'KEY_DOWN':
        triggerKeyDown(action.code, action.payload)
        break
      case 'KEY_UP':
        triggerKeyUp(action.code)
        break
      case 'MOUSE_DOWN':
        triggerMouseDown(action.button)
        break
      case 'MOUSE_UP':
        triggerMouseUp(action.button)
        break
      case 'MOUSE_WHEEL':
        triggerWheel(action.direction)
        break
      case 'MOUSE_MOVE':
        triggerMouseMove(action.dx, action.dy)
        break
      case 'CLEAR':
        clearAll()
        break
    }
  })

  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('keyup', handleWindowKeyup)
  window.addEventListener('mousedown', handleWindowMousedown)
  window.addEventListener('mouseup', handleWindowMouseup)
  window.addEventListener('wheel', handleWindowWheel, { passive: true })
  window.addEventListener('mousemove', handleWindowMousemove, { passive: true })
  window.addEventListener('blur', releaseAllHeldInputs)

  tickTimer = setInterval(() => {
    const now = Date.now()
    nowTs.value = now
    const ttl = Math.max(400, state.value.fadeDelayMs || 2200)
    if (items.value.some((it) => now - it.ts > ttl)) {
      items.value = items.value.filter((it) => now - it.ts <= ttl)
    }
    if (pressTimestamps.value.some((t) => now - t > 15000)) {
      pressTimestamps.value = pressTimestamps.value.filter((t) => now - t <= 15000)
    }
  }, 150)
})

onBeforeUnmount(() => {
  stopActionListener?.()
  for (const timer of activePressTimers.values()) clearTimeout(timer)
  activePressTimers.clear()
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('keyup', handleWindowKeyup)
  window.removeEventListener('mousedown', handleWindowMousedown)
  window.removeEventListener('mouseup', handleWindowMouseup)
  window.removeEventListener('wheel', handleWindowWheel)
  window.removeEventListener('mousemove', handleWindowMousemove)
  window.removeEventListener('blur', releaseAllHeldInputs)
  if (tickTimer) clearInterval(tickTimer)
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))
</script>

<template>
  <KeycastCanvasOverlay
    v-if="state.displayMode !== 'stream'"
    ref="canvasOverlayRef"
    :state="state"
    :pressed-codes="pressedCodes"
    :pressed-mouse="pressedMouse"
    :key-counts="keyCounts"
    :mouse-counts="mouseCounts"
    :kps="kps"
    :apm="apm"
    :total-presses="totalPresses"
    :interactive="interactive"
    :no-shadow="noShadow"
    @virtual-key-down="(code) => emit('virtualKeyDown', code)"
    @virtual-key-up="(code) => emit('virtualKeyUp', code)"
    @virtual-mouse-down="(btn) => emit('virtualMouseDown', btn)"
    @virtual-mouse-up="(btn) => emit('virtualMouseUp', btn)"
  />

  <div
    v-else
    class="keycast-obs-root"
    :class="[`theme-${state.theme}`, `dir-${state.direction}`, { 'is-inline': props.inlineMode }]"
    :style="{
      '--keycast-accent': state.accentColor,
      '--keycast-font-size': `${state.fontSize}px`,
      '--keycast-font': customFontCss,
      opacity: Math.max(0.3, Math.min(1, (state.opacity ?? 100) / 100)),
    }"
  >
    <div
      v-if="state.showApm"
      class="keycast-apm-pill"
    >
      <span class="apm-dot" />
      <span>KPS</span>
      <strong>{{ kps }}</strong>
      <span class="opacity-40">·</span>
      <span>APM</span>
      <strong>{{ apm }}</strong>
    </div>

    <TransitionGroup
      name="keycap-pop"
      tag="div"
      class="keycast-stream"
      :class="{ 'is-column': state.direction === 'column' }"
    >
      <div
        v-for="item in items"
        :key="item.id"
        class="keycap-combo"
      >
        <template
          v-for="(part, idx) in item.parts"
          :key="`${item.id}-${idx}`"
        >
          <span
            v-if="idx > 0"
            class="keycap-plus"
          >
            +
          </span>
          <kbd class="keycap-chip">{{ part }}</kbd>
        </template>
        <span
          v-if="item.count > 1"
          class="keycap-repeat"
        >
          ×{{ item.count }}
        </span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.keycast-obs-root {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  font-family: var(--keycast-font, ui-sans-serif, system-ui, -apple-system, sans-serif);
  user-select: none;
}

.keycast-obs-root.dir-column {
  flex-direction: column;
  align-items: flex-start;
}

.keycast-apm-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(8px);
}

.apm-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--keycast-accent, #38bdf8);
  box-shadow: 0 0 8px var(--keycast-accent, #38bdf8);
}

.keycast-stream {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.keycast-stream.is-column {
  flex-direction: column;
  align-items: flex-start;
}

.keycap-combo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.keycap-plus {
  font-size: calc(var(--keycast-font-size, 16px) * 0.78);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.72);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
}

.keycap-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: calc(var(--keycast-font-size, 16px) * 2.1);
  padding: 0.32em 0.65em;
  font-size: var(--keycast-font-size, 16px);
  font-weight: 700;
  line-height: 1.1;
  border-radius: 8px;
  font-family: var(--keycast-font, ui-monospace, SFMono-Regular, Menlo, monospace);
}

.keycap-repeat {
  margin-left: 2px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: var(--keycast-accent, #38bdf8);
  color: #09090b;
}

/* 主题样式 */
.theme-mechanical .keycap-chip {
  color: #f8fafc;
  background: linear-gradient(180deg, #27272a 0%, #18181b 100%);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-bottom-width: 4px;
  border-bottom-color: color-mix(in srgb, var(--keycast-accent, #38bdf8) 55%, #09090b);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
}

.theme-minimal .keycap-chip {
  color: #ffffff;
  background: rgba(15, 23, 42, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.theme-neon .keycap-chip {
  color: var(--keycast-accent, #38bdf8);
  background: rgba(9, 9, 11, 0.86);
  border: 1.5px solid var(--keycast-accent, #38bdf8);
  box-shadow: 0 0 14px color-mix(in srgb, var(--keycast-accent, #38bdf8) 45%, transparent);
}

.theme-glass .keycap-chip {
  color: #ffffff;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(12px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.22);
}

.theme-immersive .keycast-apm-pill {
  background: transparent;
  border-color: transparent;
  backdrop-filter: none;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.theme-immersive .keycap-chip {
  color: #ffffff;
  background: rgba(9, 9, 11, 0.28);
  border: none;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.82);
}

.keycap-pop-enter-active,
.keycap-pop-leave-active {
  transition: all 0.18s ease;
}

.keycap-pop-enter-from {
  opacity: 0;
  transform: translateY(6px) scale(0.92);
}

.keycap-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.92);
}
</style>
