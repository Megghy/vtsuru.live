<script setup lang="ts">
import { Flame, Sparkles, Zap } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_EMOTE_HYPE_STATE } from './types'
import type { EmoteHypeAction, EmoteHypeState, FountainBurstItem } from './types'

interface CanvasParticle {
  kind: 'text' | 'image' | 'spark'
  content: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  gravity: number
  rotation: number
  vr: number
  scale: number
  age: number
  life: number
  size: number
}

interface CachedImageEntry {
  img: HTMLImageElement
  ready: boolean
  failed: boolean
}

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state, onAction } = useObsBridge<EmoteHypeState, EmoteHypeAction>({
  componentId: 'emote-hype',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_EMOTE_HYPE_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const rootRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const heat = ref(0)
const feverActive = ref(false)
const pulseTick = ref(0)

const showMeter = computed(() => state.value.mode === 'combo' || state.value.mode === 'meter')
const showFountain = computed(() => state.value.mode === 'combo' || state.value.mode === 'fountain')
const displayPercent = computed(() => Math.min(100, Math.max(0, Math.round(heat.value))))

const particles: CanvasParticle[] = []
const imageCache = new Map<string, CachedImageEntry>()
let canvasWidth = 540
let canvasHeight = 240
let rafId: number | undefined
let lastFrameTime = 0
let feverUntil = 0
let resizeObserver: ResizeObserver | undefined
let disposeAction: (() => void) | undefined

function getCachedImage(url: string): CachedImageEntry {
  const existing = imageCache.get(url)
  if (existing) return existing
  if (imageCache.size > 48) {
    const firstKey = imageCache.keys().next().value
    if (firstKey) imageCache.delete(firstKey)
  }
  const img = new Image()
  img.crossOrigin = 'anonymous'
  const entry: CachedImageEntry = { img, ready: false, failed: false }
  img.onload = () => {
    entry.ready = true
  }
  img.onerror = () => {
    entry.failed = true
  }
  img.src = url
  imageCache.set(url, entry)
  return entry
}

function syncCanvasSize() {
  const canvas = canvasRef.value
  const root = rootRef.value
  if (!canvas || !root) return
  const rect = root.getBoundingClientRect()
  const w = Math.max(120, Math.round(rect.width))
  const h = Math.max(100, Math.round(rect.height))
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvasWidth = w
  canvasHeight = h
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}

function pushParticle(particle: CanvasParticle) {
  const cap = Math.max(12, Math.min(160, state.value.maxParticles || 64))
  if (particles.length >= cap) {
    particles.splice(0, particles.length - cap + 1)
  }
  particles.push(particle)
}

function spawnFountainItems(items: FountainBurstItem[]) {
  if (!showFountain.value || !items.length) return
  const baseScale = Math.max(0.6, Math.min(1.8, state.value.particleScale || 1))
  const originY = state.value.mode === 'combo' ? canvasHeight - 54 : canvasHeight - 16
  for (const item of items) {
    if (item.kind === 'image') {
      getCachedImage(item.content)
    }
    const spreadX = canvasWidth * (0.14 + Math.random() * 0.72)
    const upward = 230 + Math.random() * 140
    pushParticle({
      kind: item.kind,
      content: item.content,
      color: item.color || state.value.accentColor || '#f43f5e',
      x: spreadX,
      y: originY,
      vx: (Math.random() - 0.5) * 140,
      vy: -upward,
      gravity: 340 + Math.random() * 90,
      rotation: (Math.random() - 0.5) * 0.24,
      vr: (Math.random() - 0.5) * 0.9,
      scale: (item.scale ?? 1) * baseScale,
      age: 0,
      life: 1.5 + Math.random() * 0.75,
      size: item.kind === 'image' ? 38 : 14,
    })
  }
}

function spawnFeverSparks(count = 26) {
  const originY = showMeter.value ? canvasHeight - 46 : canvasHeight - 20
  const palette = [state.value.accentColor || '#f43f5e', '#fbbf24', '#38bdf8', '#f8fafc']
  for (let i = 0; i < count; i++) {
    pushParticle({
      kind: 'spark',
      content: '',
      color: palette[i % palette.length],
      x: canvasWidth * (0.1 + Math.random() * 0.8),
      y: originY,
      vx: (Math.random() - 0.5) * 260,
      vy: -(220 + Math.random() * 210),
      gravity: 360,
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 5,
      scale: 0.7 + Math.random() * 0.8,
      age: 0,
      life: 0.9 + Math.random() * 0.7,
      size: 6 + Math.random() * 5,
    })
  }
}

function activateFever(extraParticles?: FountainBurstItem[]) {
  heat.value = 100
  feverActive.value = true
  feverUntil = performance.now() + 4500
  spawnFeverSparks(28)
  if (extraParticles?.length) {
    spawnFountainItems(extraParticles)
  }
}

function handleAction(action: EmoteHypeAction) {
  if (action.type === 'RESET_HYPE') {
    heat.value = 0
    feverActive.value = false
    feverUntil = 0
    particles.length = 0
    return
  }

  if (action.type === 'FOUNTAIN_BURST') {
    spawnFountainItems(action.particles)
    return
  }

  if (action.type === 'TRIGGER_FEVER') {
    activateFever(action.particles)
    return
  }

  if (action.type === 'HYPE_ADD') {
    const prev = heat.value
    const next = Math.min(100, Math.max(0, prev + action.delta))
    heat.value = next
    pulseTick.value++
    if (action.particles?.length) {
      spawnFountainItems(action.particles)
    }
    if (next >= 100 && (!feverActive.value || prev < 100)) {
      activateFever()
    } else if (action.isHot) {
      spawnFeverSparks(6)
    }
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function renderLoop(now: number) {
  if (!lastFrameTime) lastFrameTime = now
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) / 1000))
  lastFrameTime = now

  // 热度自然衰减（FEVER 前 2.2 秒保持满槽高燃状态）
  if (feverActive.value) {
    if (now >= feverUntil) {
      feverActive.value = false
    } else if (now > feverUntil - 1600) {
      const decay = Math.max(0, state.value.decayPerSec || 3.5)
      heat.value = Math.max(0, heat.value - decay * dt)
    }
  } else if (heat.value > 0) {
    const decay = Math.max(0, state.value.decayPerSec || 3.5)
    heat.value = Math.max(0, heat.value - decay * dt)
  }

  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)

    const fontStack = customFontCss.value || '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      if (p.age >= p.life) {
        particles.splice(i, 1)
        continue
      }

      p.vy += p.gravity * dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.rotation += p.vr * dt

      const progress = p.age / p.life
      const popIn = Math.min(1, p.age / 0.14)
      const fadeOut = progress > 0.65 ? Math.max(0, 1 - (progress - 0.65) / 0.35) : 1
      const alpha = popIn * fadeOut
      const drawScale = p.scale * (0.72 + 0.28 * popIn)

      ctx.save()
      ctx.globalAlpha = alpha
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.scale(drawScale, drawScale)

      if (p.kind === 'spark') {
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.moveTo(0, -p.size)
        ctx.lineTo(p.size * 0.65, 0)
        ctx.lineTo(0, p.size)
        ctx.lineTo(-p.size * 0.65, 0)
        ctx.closePath()
        ctx.fill()
      } else if (p.kind === 'image') {
        const entry = imageCache.get(p.content)
        if (entry?.ready && !entry.failed) {
          const half = p.size / 2
          drawRoundedRect(ctx, -half, -half, p.size, p.size, 9)
          ctx.clip()
          ctx.drawImage(entry.img, -half, -half, p.size, p.size)
        } else {
          // 图片未加载完成时的轻量占位圆点
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(0, 0, 8, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        ctx.font = `700 ${p.size}px ${fontStack}`
        const metrics = ctx.measureText(p.content)
        const padX = 10
        const boxW = Math.min(180, metrics.width + padX * 2)
        const boxH = p.size + 12

        drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, boxH / 2)
        ctx.fillStyle = 'rgba(15, 18, 28, 0.84)'
        ctx.fill()
        ctx.lineWidth = 1.5
        ctx.strokeStyle = p.color
        ctx.stroke()

        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(p.content, 0, 0.5, boxW - padX)
      }

      ctx.restore()
    }
  }

  rafId = requestAnimationFrame(renderLoop)
}

onMounted(() => {
  syncCanvasSize()
  if (typeof ResizeObserver !== 'undefined' && rootRef.value) {
    resizeObserver = new ResizeObserver(syncCanvasSize)
    resizeObserver.observe(rootRef.value)
  }
  disposeAction = onAction(handleAction)
  rafId = requestAnimationFrame(renderLoop)
})

onUnmounted(() => {
  if (rafId !== undefined) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  disposeAction?.()
})
</script>

<template>
  <div
    ref="rootRef"
    class="hype-obs-root"
    :class="[
      `theme-${state.theme}`,
      `mode-${state.mode}`,
      { 'is-inline': props.inlineMode, 'is-fever': feverActive, 'no-shadow': props.noShadow },
    ]"
    :style="{ '--hype-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <!-- 零 DOM 负担 Canvas 2D 喷泉与粒子层 -->
    <canvas
      ref="canvasRef"
      class="hype-canvas"
    />

    <!-- 热度能量槽 -->
    <div
      v-if="showMeter"
      class="hype-meter-card"
    >
      <div class="hype-header">
        <div class="hype-title-row">
          <Flame
            class="hype-flame-icon"
            :class="{ 'is-burning': feverActive || displayPercent >= 70 }"
          />
          <span class="hype-title">{{ state.title || '直播间氛围热度' }}</span>
        </div>

        <div class="hype-right-group">
          <Transition name="fever-pop">
            <span
              v-if="feverActive"
              class="hype-fever-badge"
            >
              <Sparkles class="hype-badge-icon" />
              {{ state.feverText || 'FEVER 高能满槽' }}
            </span>
          </Transition>
          <span class="hype-percent">{{ displayPercent }}%</span>
        </div>
      </div>

      <div class="hype-bar-track">
        <div
          class="hype-bar-fill"
          :style="{ transform: `scaleX(${displayPercent / 100})` }"
        />
        <div
          class="hype-bar-ticks"
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
        </div>
      </div>

      <div class="hype-footer">
        <span class="hype-status-label">
          <Zap class="hype-mini-icon" />
          {{
            feverActive
              ? 'MAX OVERDRIVE'
              : displayPercent >= 70
                ? '氛围高涨'
                : displayPercent > 0
                  ? '持续充能中'
                  : '等待弹幕互动'
          }}
        </span>
        <span class="hype-scale-hint">100% 触发高能</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hype-obs-root {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.hype-obs-root.mode-meter {
  justify-content: center;
}

.hype-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 2;
}

.hype-meter-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  transition:
    transform 0.18s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.is-fever .hype-meter-card {
  animation: hype-fever-pulse 0.7s ease-in-out infinite alternate;
}

@keyframes hype-fever-pulse {
  from {
    transform: scale(1);
  }
  to {
    transform: scale(1.018);
  }
}

.hype-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.hype-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.hype-flame-icon {
  width: 18px;
  height: 18px;
  color: var(--hype-accent, #f43f5e);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.hype-flame-icon.is-burning {
  transform: scale(1.16);
}

.hype-title {
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hype-right-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.hype-fever-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--hype-accent, #f43f5e);
  color: #ffffff;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.03em;
}

.hype-badge-icon {
  width: 12px;
  height: 12px;
}

.fever-pop-enter-active,
.fever-pop-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.fever-pop-enter-from,
.fever-pop-leave-to {
  opacity: 0;
  transform: scale(0.85);
}

.hype-percent {
  font-size: 20px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--hype-accent, #f43f5e);
}

.hype-bar-track {
  position: relative;
  width: 100%;
  height: 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.hype-bar-fill {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--hype-accent, #f43f5e) 82%, #fbbf24),
    var(--hype-accent, #f43f5e)
  );
  transform-origin: left center;
  transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1);
}

.is-fever .hype-bar-fill {
  background: linear-gradient(90deg, #fbbf24, var(--hype-accent, #f43f5e), #38bdf8);
}

.hype-bar-ticks {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: space-evenly;
  pointer-events: none;
}

.hype-bar-ticks span {
  width: 1px;
  height: 100%;
  background: rgba(255, 255, 255, 0.2);
}

.hype-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  opacity: 0.78;
}

.hype-status-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.hype-mini-icon {
  width: 12px;
  height: 12px;
  color: var(--hype-accent, #f43f5e);
}

/* 4 套主题 */
.theme-card .hype-meter-card {
  background: rgba(17, 17, 22, 0.88);
  color: #f8fafc;
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  padding: 13px 16px;
  border-radius: 14px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

.theme-minimal .hype-meter-card {
  color: #ffffff;
  text-shadow: 0 2px 6px rgba(0, 0, 0, 0.85);
  padding: 6px 10px;
}

.theme-minimal .hype-bar-track {
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.theme-neon .hype-meter-card {
  background: rgba(8, 10, 18, 0.92);
  color: #f8fafc;
  border: 1.5px solid var(--hype-accent, #f43f5e);
  box-shadow: 0 0 20px color-mix(in srgb, var(--hype-accent, #f43f5e) 36%, transparent);
  padding: 13px 16px;
  border-radius: 12px;
}

.theme-neon.is-fever .hype-meter-card {
  box-shadow: 0 0 28px color-mix(in srgb, var(--hype-accent, #f43f5e) 68%, transparent);
}

.theme-glass .hype-meter-card {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0.06));
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(16px);
  padding: 13px 16px;
  border-radius: 16px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.25);
}

.no-shadow .hype-meter-card {
  box-shadow: none !important;
  text-shadow: none !important;
}
</style>
