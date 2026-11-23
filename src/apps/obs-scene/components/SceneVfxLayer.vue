<script setup lang="ts">
import { computed } from 'vue'

import type { VfxLayer } from '../types'
import VfxMediaPlayer from '../vfx/VfxMediaPlayer.vue'
import VfxParticleCanvas from '../vfx/VfxParticleCanvas.vue'
import WebglShaderCanvas from '../vfx/WebglShaderCanvas.vue'

const props = defineProps<{
  layer: VfxLayer
  mode: 'edit' | 'preview' | 'live'
}>()

const vfx = computed(() => props.layer.vfx)
const preset = computed(() => vfx.value.preset)

const isCanvasPreset = computed(() => {
  const id = preset.value.id
  return (
    id === 'film-grain' ||
    id === 'vhs-glitch' ||
    id === 'sakura' ||
    id === 'snow' ||
    id === 'rain' ||
    id === 'sparkles' ||
    id === 'bokeh' ||
    id === 'speed-lines'
  )
})

const wrapperStyle = computed(() => ({
  mixBlendMode: vfx.value.blendMode === 'normal' ? undefined : vfx.value.blendMode,
}))

const vignetteStyle = computed(() => {
  const p = preset.value
  const innerStop = Math.round(Math.max(15, 72 - p.size * 24))
  return {
    background: `radial-gradient(ellipse at center, transparent ${innerStop}%, ${p.color1} 100%)`,
    opacity: p.intensity,
  }
})

const scanlineStyle = computed(() => {
  const p = preset.value
  const gap = Math.max(2, Math.round(3 * p.size))
  const stripe = Math.max(1, Math.round(1.5 * p.size))
  const dur = p.speed > 0.05 ? `${(6 / p.speed).toFixed(2)}s` : '0s'
  return {
    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0px, transparent ${gap}px, ${p.color1} ${gap}px, ${p.color1} ${gap + stripe}px)`,
    opacity: p.intensity * 0.75,
    '--crt-duration': dur,
  } as Record<string, string | number>
})

const lightLeakStyle = computed(() => {
  const p = preset.value
  const dur = p.speed > 0.05 ? `${(10 / p.speed).toFixed(2)}s` : '0s'
  return {
    background: `radial-gradient(circle at 14% 22%, ${p.color1} 0%, transparent 48%), radial-gradient(circle at 86% 78%, ${p.color2} 0%, transparent 52%)`,
    opacity: p.intensity * 0.85,
    transform: `rotate(${p.angle}deg) scale(1.25)`,
    '--leak-duration': dur,
  } as Record<string, string | number>
})

const letterboxBarHeight = computed(() => {
  const pct = Math.min(35, Math.max(2, 11.5 * preset.value.size))
  return `${pct.toFixed(2)}%`
})

const colorTintStyle = computed(() => {
  const p = preset.value
  return {
    background: `linear-gradient(${p.angle}deg, ${p.color1} 0%, ${p.color2} 100%)`,
    opacity: p.intensity,
  }
})

const backdropFilterStyle = computed(() => {
  const p = preset.value
  const parts: string[] = []
  if (p.backdropBlur > 0) parts.push(`blur(${p.backdropBlur}px)`)
  if (p.backdropBrightness !== 100) parts.push(`brightness(${p.backdropBrightness}%)`)
  if (p.backdropContrast !== 100) parts.push(`contrast(${p.backdropContrast}%)`)
  if (p.backdropSaturate !== 100) parts.push(`saturate(${p.backdropSaturate}%)`)
  if (p.backdropHueRotate !== 0) parts.push(`hue-rotate(${p.backdropHueRotate}deg)`)
  if (p.backdropGrayscale > 0) parts.push(`grayscale(${p.backdropGrayscale}%)`)
  if (p.backdropSepia > 0) parts.push(`sepia(${p.backdropSepia}%)`)
  const value = parts.length > 0 ? parts.join(' ') : 'none'
  return {
    backdropFilter: value,
    WebkitBackdropFilter: value,
  }
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden pointer-events-none" :style="wrapperStyle">
    <!-- 模式 1：预置画面滤镜 / 动态粒子 / Web 局部后处理 -->
    <template v-if="vfx.mode === 'preset'">
      <VfxParticleCanvas v-if="isCanvasPreset" :preset="preset" />

      <div v-else-if="preset.id === 'vignette'" class="w-full h-full" :style="vignetteStyle" />

      <div
        v-else-if="preset.id === 'crt-scanlines'"
        class="w-full h-full vfx-crt-scanlines"
        :style="scanlineStyle"
      />

      <div
        v-else-if="preset.id === 'light-leak'"
        class="w-full h-full vfx-light-leak"
        :style="lightLeakStyle"
      />

      <div v-else-if="preset.id === 'letterbox'" class="relative w-full h-full" :style="{ opacity: preset.intensity }">
        <div class="absolute top-0 inset-x-0" :style="{ height: letterboxBarHeight, backgroundColor: preset.color1 }" />
        <div class="absolute bottom-0 inset-x-0" :style="{ height: letterboxBarHeight, backgroundColor: preset.color1 }" />
      </div>

      <div v-else-if="preset.id === 'color-tint'" class="w-full h-full" :style="colorTintStyle" />

      <div
        v-else-if="preset.id === 'backdrop-filter'"
        class="w-full h-full"
        :style="backdropFilterStyle"
      />
    </template>

    <!-- 模式 2：自定义 GLSL Fragment Shader -->
    <WebglShaderCanvas
      v-else-if="vfx.mode === 'shader'"
      :fragment-code="vfx.shader.fragmentCode"
      :speed="vfx.shader.speed"
      :intensity="vfx.shader.intensity"
      :color1="vfx.shader.color1"
      :color2="vfx.shader.color2"
      :params="vfx.shader.params"
    />

    <!-- 模式 3：外部 VFX 素材（透明 WebM / 黑底去黑 / APNG / Lottie / Rive / SVGA / PAG） -->
    <VfxMediaPlayer
      v-else-if="vfx.mode === 'media'"
      :media="vfx.media"
      :mode="mode"
    />
  </div>
</template>

<style scoped>
@keyframes vfx-crt-scroll {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 0 40px;
  }
}

.vfx-crt-scanlines {
  animation: vfx-crt-scroll var(--crt-duration, 6s) linear infinite;
}

@keyframes vfx-leak-breathe {
  0%,
  100% {
    filter: brightness(0.95);
  }
  50% {
    filter: brightness(1.18);
  }
}

.vfx-light-leak {
  animation: vfx-leak-breathe var(--leak-duration, 10s) ease-in-out infinite;
}
</style>
