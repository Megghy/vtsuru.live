<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'

import { createTypingCatEngine } from './catEngine'
import type { TypingCatEngine } from './catEngine'
import { DEFAULT_TYPING_CAT_STATE } from './types'
import type { TypingCatAction, TypingCatState } from './types'

const props = withDefaults(
  defineProps<{
    channelId?: string
    userId?: number
    inlineMode?: boolean
    interactive?: boolean
    noShadow?: boolean
    /** 控制台内联预览直接传入响应式状态，实现零延迟预览 */
    previewState?: TypingCatState
  }>(),
  {
    inlineMode: false,
    interactive: false,
    noShadow: false,
  },
)

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state: syncedState, onAction } = useObsBridge<TypingCatState, TypingCatAction>({
  componentId: 'typing-cat',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_TYPING_CAT_STATE,
  role: 'viewer',
})

const state = computed(() => props.previewState ?? syncedState.value)

const stageRef = ref<HTMLElement | null>(null)
const webglUnavailable = ref(false)

let engine: TypingCatEngine | null = null
let stopActionListener: (() => void) | undefined

const effectiveOutline = computed(() => Boolean(state.value.showOutline) && !props.noShadow)

const stageTransformStyle = computed(() => {
  const scaleRatio = Math.max(0.5, Math.min(1.5, (state.value.scale ?? 100) / 100))
  const opacity = Math.max(0.3, Math.min(1, (state.value.opacity ?? 100) / 100))
  const mirrorX = state.value.mirror ? -1 : 1
  return {
    transform: `scale(${scaleRatio * mirrorX}, ${scaleRatio})`,
    opacity,
  }
})

function buildEngineOptions() {
  return {
    coat: state.value.coat,
    deskTheme: state.value.deskTheme,
    showKeyboard: state.value.showKeyboard,
    showMouse: state.value.showMouse,
    leftMouse: state.value.leftMouse,
    followKeys: state.value.followKeys,
    showKeyChips: state.value.showKeyChips,
    showSpeedBadge: state.value.showSpeedBadge,
    showOutline: effectiveOutline.value,
    cameraYaw: state.value.cameraYaw,
    sleepMinutes: state.value.sleepMinutes,
    autoTyping: state.value.autoTyping,
    idleActivity: state.value.idleActivity,
    loafOnIdle: state.value.loafOnIdle,
    allowPetting: state.value.allowPetting,
    turboTailTyping: state.value.turboTailTyping,
    turboSensitivity: state.value.turboSensitivity,
    accessories: state.value.accessories,
    colors: state.value.colors,
    shape: state.value.shape,
  }
}

function syncEngineOptions() {
  if (!engine) return
  engine.setOptions(buildEngineOptions())
}

watch(
  () => [state.value, effectiveOutline.value],
  () => {
    syncEngineOptions()
  },
  { deep: true },
)

function mapMouseButton(button: number): string {
  if (button === 0) return 'left'
  if (button === 1) return 'middle'
  if (button === 2) return 'right'
  return `btn${button}`
}

// 独立 OBS 浏览器源模式下直接监听页面级键鼠事件
function handleWindowKeydown(event: KeyboardEvent) {
  if (props.inlineMode || event.repeat) return
  if (event.code) engine?.keyDown(event.code)
}

function handleWindowKeyup(event: KeyboardEvent) {
  if (props.inlineMode) return
  if (event.code) engine?.keyUp(event.code)
}

function handleWindowMousedown(event: MouseEvent) {
  if (props.inlineMode) return
  engine?.mouseDown(mapMouseButton(event.button))
}

function handleWindowMouseup(event: MouseEvent) {
  if (props.inlineMode) return
  engine?.mouseUp(mapMouseButton(event.button))
}

function handleWindowMousemove(event: MouseEvent) {
  if (props.inlineMode) return
  if (event.movementX !== 0 || event.movementY !== 0) {
    engine?.mouseMoved(event.movementX, event.movementY)
  }
}

function handleWindowBlur() {
  if (props.inlineMode) return
  engine?.clear()
}

function applyAction(action: TypingCatAction) {
  if (!engine) return
  switch (action.type) {
    case 'KEY_DOWN':
      engine.keyDown(action.code)
      break
    case 'KEY_UP':
      engine.keyUp(action.code)
      break
    case 'KEY_TAP':
      engine.tapKey(action.code)
      break
    case 'MOUSE_DOWN':
      engine.mouseDown(action.button)
      break
    case 'MOUSE_UP':
      engine.mouseUp(action.button)
      break
    case 'MOUSE_MOVE':
      engine.mouseMoved(action.dx, action.dy)
      break
    case 'PET':
      engine.pet()
      break
    case 'SPIN':
      engine.spin()
      break
    case 'SLEEP':
      engine.sleep()
      break
    case 'WAKE':
      engine.wake()
      break
    case 'STRETCH':
      engine.stretch()
      break
    case 'YAWN':
      engine.yawn()
      break
    case 'LICK':
      engine.lick()
      break
    case 'POUNCE':
      engine.pounce()
      break
    case 'LOAF':
      engine.loaf()
      break
    case 'BURST':
      engine.burst()
      break
    case 'CLEAR':
      engine.clear()
      break
  }
}

defineExpose({ applyAction })

onMounted(() => {
  if (stageRef.value) {
    engine = createTypingCatEngine(stageRef.value, buildEngineOptions())
    if (!engine) {
      webglUnavailable.value = true
    }
  }

  stopActionListener = onAction((action) => {
    if (props.previewState) return
    applyAction(action)
  })

  window.addEventListener('keydown', handleWindowKeydown)
  window.addEventListener('keyup', handleWindowKeyup)
  window.addEventListener('mousedown', handleWindowMousedown)
  window.addEventListener('mouseup', handleWindowMouseup)
  window.addEventListener('mousemove', handleWindowMousemove, { passive: true })
  window.addEventListener('blur', handleWindowBlur)
})

onBeforeUnmount(() => {
  stopActionListener?.()
  window.removeEventListener('keydown', handleWindowKeydown)
  window.removeEventListener('keyup', handleWindowKeyup)
  window.removeEventListener('mousedown', handleWindowMousedown)
  window.removeEventListener('mouseup', handleWindowMouseup)
  window.removeEventListener('mousemove', handleWindowMousemove)
  window.removeEventListener('blur', handleWindowBlur)
  engine?.destroy()
  engine = null
})
</script>

<template>
  <div
    class="typing-cat-root"
    :class="{ 'is-inline': inlineMode, 'is-mirrored': state.mirror }"
  >
    <div
      v-if="webglUnavailable"
      class="typing-cat-fallback"
    >
      当前环境不支持 WebGL，无法渲染 3D 小猫组件
    </div>
    <div
      v-else
      ref="stageRef"
      class="typing-cat-stage"
      :class="{ 'cursor-grab': state.allowPetting }"
      :style="stageTransformStyle"
    />
  </div>
</template>

<style scoped>
.typing-cat-root {
  position: relative;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  user-select: none;
  touch-action: none;
}

.typing-cat-root.is-inline {
  width: 100%;
  height: 100%;
}

.typing-cat-stage {
  position: relative;
  width: 100%;
  height: 100%;
  transform-origin: center center;
  transition: opacity 0.18s ease;
}

.typing-cat-fallback {
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.16);
}

.typing-cat-stage :deep(.typing-cat-chip) {
  position: absolute;
  transform: translate(-50%, -100%);
  padding: 1px 6px;
  border-radius: 6px;
  background: #fffdf4;
  border: 1.5px solid #17171b;
  color: #17171b;
  font-family: ui-rounded, 'SF Pro Rounded', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.35;
  pointer-events: none;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.typing-cat-root.is-mirrored .typing-cat-stage :deep(.typing-cat-chip) {
  transform: translate(-50%, -100%) scaleX(-1);
}

.typing-cat-stage :deep(.typing-cat-zzz) {
  position: absolute;
  pointer-events: none;
  display: none;
  font-family: ui-rounded, 'SF Pro Rounded', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  font-weight: 700;
  color: #17171b;
  text-shadow:
    1px 0 0 #fffdf4,
    -1px 0 0 #fffdf4,
    0 1px 0 #fffdf4,
    0 -1px 0 #fffdf4;
}

.typing-cat-root.is-mirrored .typing-cat-stage :deep(.typing-cat-zzz) {
  transform: scaleX(-1);
}

.typing-cat-stage :deep(.typing-cat-speed) {
  position: absolute;
  left: 10px;
  bottom: 10px;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 253, 244, 0.9);
  border: 1.5px solid #17171b;
  color: #17171b;
  font-family: ui-monospace, 'SFMono-Regular', Menlo, monospace;
  font-size: 11px;
  font-weight: 700;
  line-height: 1.4;
  pointer-events: none;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.typing-cat-root.is-mirrored .typing-cat-stage :deep(.typing-cat-speed) {
  transform: scaleX(-1);
}

.typing-cat-stage :deep(.typing-cat-zzz span) {
  position: absolute;
  left: 0;
  top: 0;
  opacity: 0;
  font-size: 1em;
  line-height: 1;
  transform-origin: 0 100%;
  animation: typing-cat-zfloat 3.3s linear infinite;
}

.typing-cat-stage :deep(.typing-cat-zzz span:nth-child(2)) {
  animation-delay: 1.1s;
}

.typing-cat-stage :deep(.typing-cat-zzz span:nth-child(3)) {
  animation-delay: 2.2s;
}

@keyframes typing-cat-zfloat {
  0% {
    opacity: 0;
    transform: translate(0, 0) scale(0.28);
  }
  12% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(1.4em, -2.6em) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .typing-cat-stage :deep(.typing-cat-zzz span) {
    animation: none;
    opacity: 1;
  }
}
</style>
