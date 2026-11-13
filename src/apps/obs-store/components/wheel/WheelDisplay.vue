<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'

import { DEFAULT_WHEEL_STATE } from './types'
import type { WheelAction, WheelSpinRecord, WheelState } from './types'
import { computeSectorArcs, easeOutQuart, resolveSectorAtRotation } from './wheelPhysics'

const props = defineProps<{
  channelId?: string
  inlineMode?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<WheelState, WheelAction>({
  componentId: 'wheel',
  channelId: targetChannel,
  defaultState: DEFAULT_WHEEL_STATE,
  role: 'viewer',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const rotationDeg = ref(0)
const isSpinning = ref(false)
const pointerKick = ref(false)
const winnerToast = ref<string | null>(null)

let animFrameId: number | null = null
let lastPlayedSpinId = ''
let lastTickSectorIdx = -1
let audioCtx: AudioContext | null = null
let winnerTimer: ReturnType<typeof setTimeout> | undefined

function playTickSound(isWin = false) {
  if (!state.value.soundEnabled) return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    audioCtx ??= new AudioCtx()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = isWin ? 'triangle' : 'sine'
    osc.frequency.setValueAtTime(isWin ? 880 : 620, audioCtx.currentTime)
    if (isWin) {
      osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.14)
    }

    gain.gain.setValueAtTime(isWin ? 0.14 : 0.05, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + (isWin ? 0.28 : 0.035))

    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + (isWin ? 0.3 : 0.04))
  } catch {
    // 浏览器未交互或音频策略阻止时静默忽略
  }
}

function drawWheel() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const size = Math.max(220, state.value.sizePx || 420)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const targetPx = Math.round(size * dpr)
  if (canvas.width !== targetPx || canvas.height !== targetPx) {
    canvas.width = targetPx
    canvas.height = targetPx
  }

  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.clearRect(0, 0, size, size)

  const cx = size / 2
  const cy = size / 2
  const outerRadius = size * 0.45
  const arcs = computeSectorArcs(state.value.segments, state.value.proportionalAngles)
  const rotRad = (rotationDeg.value * Math.PI) / 180

  // 外环阴影与装饰边框
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, outerRadius + 8, 0, Math.PI * 2)
  ctx.fillStyle = state.value.theme === 'neon' ? '#090d16' : 'rgba(18, 18, 24, 0.92)'
  ctx.fill()
  if (state.value.theme === 'neon') {
    ctx.strokeStyle = state.value.pointerColor || '#f43f5e'
    ctx.lineWidth = 3
    ctx.stroke()
  }
  ctx.restore()

  // 绘制扇区（12 点钟为 0 度 -> Canvas 坐标系需减 PI/2）
  for (const arc of arcs) {
    const startRad = (arc.startDeg * Math.PI) / 180 + rotRad - Math.PI / 2
    const endRad = (arc.endDeg * Math.PI) / 180 + rotRad - Math.PI / 2

    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, outerRadius, startRad, endRad)
    ctx.closePath()
    ctx.fillStyle = arc.segment.color || '#3b82f6'
    ctx.fill()

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // 扇区文字
    if (arc.spanDeg >= 8) {
      const midRad = (startRad + endRad) / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(midRad)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      const fontSize = Math.max(11, Math.min(16, Math.round(size * 0.036)))
      ctx.font = `700 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.shadowColor = 'rgba(0,0,0,0.65)'
      ctx.shadowBlur = 4

      const label = arc.segment.label.length > 10 ? `${arc.segment.label.slice(0, 9)}…` : arc.segment.label
      ctx.fillText(label, outerRadius - 18, 0)
      ctx.restore()
    }
  }

  // 外圈灯泡装饰点
  const bulbCount = 16
  for (let i = 0; i < bulbCount; i++) {
    const angle = (i / bulbCount) * Math.PI * 2 + rotRad * 0.25
    const bx = cx + Math.cos(angle) * (outerRadius + 4)
    const by = cy + Math.sin(angle) * (outerRadius + 4)
    ctx.beginPath()
    ctx.arc(bx, by, 2.3, 0, Math.PI * 2)
    ctx.fillStyle = i % 2 === 0 ? '#fef08a' : '#ffffff'
    ctx.fill()
  }

  // 中心轴圆盘
  ctx.beginPath()
  ctx.arc(cx, cy, size * 0.065, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = state.value.pointerColor || '#f43f5e'
  ctx.stroke()

  ctx.restore()
}

function startSpinAnimation(spin: WheelSpinRecord) {
  if (lastPlayedSpinId === spin.spinId) return
  lastPlayedSpinId = spin.spinId

  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  if (winnerTimer) clearTimeout(winnerTimer)

  const elapsed = Date.now() - spin.startedAt
  // 若加载的是历史陈旧记录，直接停留在结果角而不重放动画
  if (elapsed > spin.durationMs + 2500) {
    rotationDeg.value = spin.targetAngleDeg
    isSpinning.value = false
    drawWheel()
    return
  }

  winnerToast.value = null
  isSpinning.value = true
  const startRotation = rotationDeg.value
  const totalDelta = spin.targetAngleDeg - startRotation
  const duration = Math.max(1000, spin.durationMs)
  const startTime = performance.now()
  lastTickSectorIdx = -1

  function step(now: number) {
    const progress = Math.min(1, (now - startTime) / duration)
    const eased = easeOutQuart(progress)
    rotationDeg.value = startRotation + totalDelta * eased

    const currentSector = resolveSectorAtRotation(
      state.value.segments,
      rotationDeg.value,
      state.value.proportionalAngles,
    )
    if (currentSector && currentSector.index !== lastTickSectorIdx) {
      lastTickSectorIdx = currentSector.index
      pointerKick.value = true
      setTimeout(() => {
        pointerKick.value = false
      }, 70)
      playTickSound(false)
    }

    drawWheel()

    if (progress < 1) {
      animFrameId = requestAnimationFrame(step)
    } else {
      animFrameId = null
      isSpinning.value = false
      rotationDeg.value = spin.targetAngleDeg
      drawWheel()
      playTickSound(true)
      winnerToast.value = spin.winnerLabel
      winnerTimer = setTimeout(() => {
        winnerToast.value = null
      }, 4500)
    }
  }

  animFrameId = requestAnimationFrame(step)
}

watch(
  () => [state.value.segments, state.value.proportionalAngles, state.value.theme, state.value.pointerColor, state.value.sizePx],
  () => {
    drawWheel()
  },
  { deep: true },
)

watch(
  () => state.value.lastSpin?.spinId,
  (spinId) => {
    if (spinId && state.value.lastSpin) {
      startSpinAnimation(state.value.lastSpin)
    }
  },
  { immediate: true },
)

onMounted(() => {
  drawWheel()
  onAction((action) => {
    if (action.type === 'SPIN') {
      startSpinAnimation(action.spin)
    } else if (action.type === 'RESET_ROTATION') {
      if (animFrameId !== null) cancelAnimationFrame(animFrameId)
      isSpinning.value = false
      winnerToast.value = null
      rotationDeg.value = 0
      drawWheel()
    }
  })
})

onUnmounted(() => {
  if (animFrameId !== null) cancelAnimationFrame(animFrameId)
  if (winnerTimer) clearTimeout(winnerTimer)
  if (audioCtx) {
    void audioCtx.close().catch(() => {})
    audioCtx = null
  }
})
</script>

<template>
  <div
    class="wheel-obs-root"
    :class="{ 'is-inline': props.inlineMode }"
  >
    <div
      v-if="state.title"
      class="wheel-title-pill"
      :style="{ borderColor: state.pointerColor }"
    >
      {{ state.title }}
    </div>

    <div
      class="wheel-stage"
      :style="{
        width: `${state.sizePx}px`,
        height: `${state.sizePx}px`,
      }"
    >
      <!-- 顶部指针 -->
      <div
        class="wheel-pointer"
        :class="{ 'is-kicked': pointerKick }"
        :style="{ borderTopColor: state.pointerColor }"
      />

      <canvas
        ref="canvasRef"
        class="wheel-canvas"
        :style="{
          width: `${state.sizePx}px`,
          height: `${state.sizePx}px`,
        }"
      />

      <Transition name="winner-pop">
        <div
          v-if="winnerToast"
          class="wheel-winner-banner"
          :style="{ borderColor: state.pointerColor }"
        >
          <span class="winner-kicker">抽中结果</span>
          <strong class="winner-label">{{ winnerToast }}</strong>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.wheel-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  user-select: none;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}

.wheel-title-pill {
  padding: 6px 18px;
  border-radius: 999px;
  background: rgba(15, 18, 28, 0.88);
  color: #ffffff;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 0.04em;
  border: 2px solid #f43f5e;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.wheel-stage {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wheel-pointer {
  position: absolute;
  top: -4px;
  left: 50%;
  transform: translateX(-50%);
  transform-origin: 50% 0%;
  width: 0;
  height: 0;
  border-left: 13px solid transparent;
  border-right: 13px solid transparent;
  border-top: 26px solid #f43f5e;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.55));
  z-index: 10;
  transition: transform 0.07s ease-out;
}

.wheel-pointer.is-kicked {
  transform: translateX(-50%) rotate(-14deg);
}

.wheel-canvas {
  display: block;
}

.wheel-winner-banner {
  position: absolute;
  inset: auto 12%;
  bottom: 18%;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 12px 20px;
  border-radius: 14px;
  background: rgba(12, 14, 22, 0.94);
  border: 2px solid #f43f5e;
  color: #fff;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55);
  text-align: center;
}

.winner-kicker {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.72;
  letter-spacing: 0.08em;
}

.winner-label {
  font-size: 20px;
  font-weight: 800;
}

.winner-pop-enter-active,
.winner-pop-leave-active {
  transition: opacity 0.22s ease, transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}

.winner-pop-enter-from,
.winner-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.92);
}
</style>
