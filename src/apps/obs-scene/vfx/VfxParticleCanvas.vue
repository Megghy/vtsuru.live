<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import type { VfxPresetConfig } from './types'

const props = defineProps<{
  preset: VfxPresetConfig
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  angle: number
  spin: number
  phase: number
  colorIdx: 0 | 1
}

let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let resizeObserver: ResizeObserver | null = null
let particles: Particle[] = []
let width = 640
let height = 360
let lastNow = performance.now()
let elapsed = 0

function targetParticleCount(): number {
  const id = props.preset.id
  const density = props.preset.density
  if (id === 'sakura') return Math.round(36 * density)
  if (id === 'snow') return Math.round(80 * density)
  if (id === 'rain') return Math.round(110 * density)
  if (id === 'sparkles') return Math.round(55 * density)
  if (id === 'bokeh') return Math.round(24 * density)
  if (id === 'speed-lines') return Math.round(64 * density)
  return 0
}

function createParticle(randomY = true): Particle {
  const id = props.preset.id
  const baseSize = props.preset.size
  if (id === 'sakura') {
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -20,
      vx: (Math.random() - 0.35) * 40,
      vy: 45 + Math.random() * 55,
      size: (8 + Math.random() * 10) * baseSize,
      alpha: 0.55 + Math.random() * 0.4,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      phase: Math.random() * Math.PI * 2,
      colorIdx: Math.random() > 0.5 ? 0 : 1,
    }
  }
  if (id === 'snow') {
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : -12,
      vx: (Math.random() - 0.5) * 22,
      vy: 30 + Math.random() * 55,
      size: (2.2 + Math.random() * 5.2) * baseSize,
      alpha: 0.35 + Math.random() * 0.65,
      angle: 0,
      spin: 0,
      phase: Math.random() * Math.PI * 2,
      colorIdx: 0,
    }
  }
  if (id === 'rain') {
    return {
      x: Math.random() * (width + 200) - 100,
      y: randomY ? Math.random() * height : -60,
      vx: 0,
      vy: 620 + Math.random() * 480,
      size: (18 + Math.random() * 26) * baseSize,
      alpha: 0.25 + Math.random() * 0.55,
      angle: 0,
      spin: 0,
      phase: 0,
      colorIdx: 0,
    }
  }
  if (id === 'sparkles') {
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : height + 12,
      vx: (Math.random() - 0.5) * 20,
      vy: -(18 + Math.random() * 36),
      size: (2.5 + Math.random() * 4.5) * baseSize,
      alpha: 0.4 + Math.random() * 0.6,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 1.4,
      phase: Math.random() * Math.PI * 2,
      colorIdx: Math.random() > 0.5 ? 0 : 1,
    }
  }
  if (id === 'bokeh') {
    return {
      x: Math.random() * width,
      y: randomY ? Math.random() * height : height + 60,
      vx: (Math.random() - 0.5) * 14,
      vy: -(10 + Math.random() * 18),
      size: (26 + Math.random() * 54) * baseSize,
      alpha: 0.12 + Math.random() * 0.28,
      angle: 0,
      spin: 0,
      phase: Math.random() * Math.PI * 2,
      colorIdx: Math.random() > 0.5 ? 0 : 1,
    }
  }
  // speed-lines
  return {
    x: Math.random() * Math.PI * 2,
    y: 0.28 + Math.random() * 0.28,
    vx: 0.5 + Math.random() * 1.5,
    vy: (1.2 + Math.random() * 2.8) * baseSize,
    size: 0.015 + Math.random() * 0.035,
    alpha: 0.35 + Math.random() * 0.65,
    angle: Math.random() * Math.PI * 2,
    spin: 0,
    phase: Math.random() * 10,
    colorIdx: 0,
  }
}

function resetParticles() {
  const count = targetParticleCount()
  particles = Array.from({ length: count }, () => createParticle(true))
}

function syncSize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  const nextW = Math.max(4, Math.round(rect.width))
  const nextH = Math.max(4, Math.round(rect.height))
  if (canvas.width !== nextW || canvas.height !== nextH) {
    canvas.width = nextW
    canvas.height = nextH
    width = nextW
    height = nextH
  }
}

function drawFilmGrain(c: CanvasRenderingContext2D, dt: number) {
  const p = props.preset
  const tile = Math.max(64, Math.round(160 / Math.max(0.4, p.size)))
  const img = c.createImageData(tile, tile)
  const data = img.data
  const alphaMax = Math.round(255 * Math.min(1, p.intensity * 0.55))
  const densityGate = Math.min(1, 0.35 + p.density * 0.45)
  const seedStep = Math.floor(elapsed * (12 + p.speed * 18) + dt)
  let s = (seedStep * 2654435761) >>> 0
  for (let i = 0; i < data.length; i += 4) {
    s = (s * 1664525 + 1013904223) >>> 0
    const r = (s >>> 24) / 255
    if (r < densityGate) {
      const lum = ((s >>> 16) & 255) > 128 ? 255 : 0
      data[i] = lum
      data[i + 1] = lum
      data[i + 2] = lum
      data[i + 3] = Math.round(alphaMax * ((s >>> 8) & 255) / 255)
    }
  }
  const off = document.createElement('canvas')
  off.width = tile
  off.height = tile
  off.getContext('2d')?.putImageData(img, 0, 0)
  const pattern = c.createPattern(off, 'repeat')
  if (pattern) {
    c.fillStyle = pattern
    c.fillRect(0, 0, width, height)
  }
}

function drawVhsGlitch(c: CanvasRenderingContext2D) {
  const p = props.preset
  const t = elapsed * (2 + p.speed * 4)
  const barCount = Math.max(2, Math.round(8 * p.density))
  for (let i = 0; i < barCount; i++) {
    const hash = Math.sin(Math.floor(t * 6) * 19.3 + i * 73.1) * 43758.5453
    const frac = hash - Math.floor(hash)
    if (frac > 0.38 + p.intensity * 0.4) continue
    const y = ((Math.sin(i * 12.7 + Math.floor(t * 4)) * 0.5 + 0.5) * height) | 0
    const h = 2 + ((frac * 18) | 0)
    const x = ((Math.cos(i * 9.1 + Math.floor(t * 8)) * 0.5 + 0.5) * width * 0.4) | 0
    const w = Math.max(80, width * (0.35 + frac * 0.65))
    c.globalAlpha = (0.15 + frac * 0.5) * p.intensity
    c.fillStyle = i % 2 === 0 ? p.color1 : p.color2
    c.fillRect(x, y, w, h)
  }
  // 慢速扫描亮带
  const scanY = ((elapsed * (65 + p.speed * 110)) % (height + 120)) - 60
  const grad = c.createLinearGradient(0, scanY - 40, 0, scanY + 40)
  grad.addColorStop(0, 'transparent')
  grad.addColorStop(0.5, p.color1)
  grad.addColorStop(1, 'transparent')
  c.globalAlpha = 0.16 * p.intensity
  c.fillStyle = grad
  c.fillRect(0, scanY - 40, width, 80)
  c.globalAlpha = 1
}

function drawFrame(now: number) {
  const c = ctx
  if (!c) return
  const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
  lastNow = now
  const speed = props.preset.speed
  elapsed += dt * Math.max(0.05, speed)

  c.clearRect(0, 0, width, height)

  const id = props.preset.id
  const intensity = props.preset.intensity

  if (id === 'film-grain') {
    drawFilmGrain(c, dt)
    rafId = requestAnimationFrame(drawFrame)
    return
  }

  if (id === 'vhs-glitch') {
    drawVhsGlitch(c)
    rafId = requestAnimationFrame(drawFrame)
    return
  }

  const desired = targetParticleCount()
  if (particles.length !== desired) {
    resetParticles()
  }

  if (id === 'speed-lines') {
    const cx = width / 2
    const cy = height / 2
    const maxR = Math.hypot(cx, cy) * 1.08
    c.fillStyle = props.preset.color1
    const tick = Math.floor(elapsed * 16)
    for (let i = 0; i < particles.length; i++) {
      const pt = particles[i]
      const jitter = Math.sin(tick * 1.9 + pt.phase) * 0.04
      const a = pt.x + jitter
      const innerR = maxR * (pt.y + Math.sin(tick * 1.3 + i) * 0.08)
      const spread = pt.size * props.preset.size * 0.55
      c.globalAlpha = pt.alpha * intensity
      c.beginPath()
      c.moveTo(cx + Math.cos(a) * innerR, cy + Math.sin(a) * innerR)
      c.lineTo(cx + Math.cos(a - spread) * maxR, cy + Math.sin(a - spread) * maxR)
      c.lineTo(cx + Math.cos(a + spread) * maxR, cy + Math.sin(a + spread) * maxR)
      c.closePath()
      c.fill()
    }
    c.globalAlpha = 1
    rafId = requestAnimationFrame(drawFrame)
    return
  }

  const rainRad = ((props.preset.angle - 90) * Math.PI) / 180
  const rainCos = Math.cos(rainRad)
  const rainSin = Math.sin(rainRad)

  for (let i = 0; i < particles.length; i++) {
    const pt = particles[i]
    const col = pt.colorIdx === 0 ? props.preset.color1 : props.preset.color2

    if (id === 'sakura') {
      pt.x += (pt.vx + Math.sin(elapsed * 1.4 + pt.phase) * 28) * dt * speed
      pt.y += pt.vy * dt * speed
      pt.angle += pt.spin * dt * speed
      if (pt.y > height + 30 || pt.x < -40 || pt.x > width + 40) {
        particles[i] = createParticle(false)
        continue
      }
      c.save()
      c.translate(pt.x, pt.y)
      c.rotate(pt.angle)
      c.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(elapsed * 2 + pt.phase)))
      c.globalAlpha = pt.alpha * intensity
      c.fillStyle = col
      c.beginPath()
      c.moveTo(0, -pt.size * 0.5)
      c.bezierCurveTo(pt.size * 0.6, -pt.size * 0.4, pt.size * 0.5, pt.size * 0.6, 0, pt.size * 0.55)
      c.bezierCurveTo(-pt.size * 0.5, pt.size * 0.6, -pt.size * 0.6, -pt.size * 0.4, 0, -pt.size * 0.5)
      c.fill()
      c.restore()
    } else if (id === 'snow') {
      pt.x += (pt.vx + Math.sin(elapsed + pt.phase) * 18) * dt * speed
      pt.y += pt.vy * dt * speed
      if (pt.y > height + 16) {
        particles[i] = createParticle(false)
        continue
      }
      c.globalAlpha = pt.alpha * intensity
      c.fillStyle = col
      c.beginPath()
      c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
      c.fill()
    } else if (id === 'rain') {
      const dist = pt.vy * dt * speed
      pt.x -= rainCos * dist
      pt.y -= rainSin * dist
      if (pt.y > height + 60 || pt.x < -120 || pt.x > width + 120) {
        particles[i] = createParticle(false)
        continue
      }
      c.globalAlpha = pt.alpha * intensity
      c.strokeStyle = col
      c.lineWidth = Math.max(1, 1.4 * props.preset.size)
      c.beginPath()
      c.moveTo(pt.x, pt.y)
      c.lineTo(pt.x + rainCos * pt.size, pt.y + rainSin * pt.size)
      c.stroke()
    } else if (id === 'sparkles') {
      pt.x += (pt.vx + Math.sin(elapsed * 1.2 + pt.phase) * 14) * dt * speed
      pt.y += pt.vy * dt * speed
      pt.angle += pt.spin * dt * speed
      if (pt.y < -20) {
        particles[i] = createParticle(false)
        continue
      }
      const twinkle = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(elapsed * 3.5 + pt.phase))
      c.save()
      c.translate(pt.x, pt.y)
      c.rotate(pt.angle)
      c.globalAlpha = pt.alpha * twinkle * intensity
      c.fillStyle = col
      const r = pt.size
      c.beginPath()
      c.moveTo(0, -r * 1.6)
      c.quadraticCurveTo(r * 0.25, -r * 0.25, r * 1.6, 0)
      c.quadraticCurveTo(r * 0.25, r * 0.25, 0, r * 1.6)
      c.quadraticCurveTo(-r * 0.25, r * 0.25, -r * 1.6, 0)
      c.quadraticCurveTo(-r * 0.25, -r * 0.25, 0, -r * 1.6)
      c.fill()
      c.restore()
    } else if (id === 'bokeh') {
      pt.x += (pt.vx + Math.sin(elapsed * 0.5 + pt.phase) * 10) * dt * speed
      pt.y += pt.vy * dt * speed
      if (pt.y < -pt.size * 2) {
        particles[i] = createParticle(false)
        continue
      }
      const breathe = 0.7 + 0.3 * Math.sin(elapsed * 1.3 + pt.phase)
      const grad = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, pt.size)
      grad.addColorStop(0, col)
      grad.addColorStop(0.6, col)
      grad.addColorStop(1, 'transparent')
      c.globalAlpha = pt.alpha * breathe * intensity
      c.fillStyle = grad
      c.beginPath()
      c.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2)
      c.fill()
    }
  }
  c.globalAlpha = 1
  rafId = requestAnimationFrame(drawFrame)
}

watch(
  () => [props.preset.id, props.preset.density, props.preset.size],
  () => {
    resetParticles()
  },
)

onMounted(() => {
  const canvas = canvasRef.value
  if (!canvas) return
  ctx = canvas.getContext('2d')
  syncSize()
  resetParticles()
  lastNow = performance.now()
  rafId = requestAnimationFrame(drawFrame)
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => syncSize())
    resizeObserver.observe(canvas)
  }
})

onBeforeUnmount(() => {
  if (rafId) cancelAnimationFrame(rafId)
  resizeObserver?.disconnect()
  resizeObserver = null
  ctx = null
})
</script>

<template>
  <canvas ref="canvasRef" class="block w-full h-full pointer-events-none" />
</template>
