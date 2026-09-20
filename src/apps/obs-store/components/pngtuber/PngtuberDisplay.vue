<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { PngtuberState } from './types'
import { sanitizePngtuberState } from './types'

const props = defineProps<{
  state: PngtuberState
  isSpeaking?: boolean
  inlineMode?: boolean
}>()

const viewState = computed(() => sanitizePngtuberState(props.state))
const isSpeaking = computed(() => !!props.isSpeaking)

const idleSrc = computed(() => viewState.value.idleImage)
const speakingSrc = computed(() => viewState.value.speakingImage || viewState.value.idleImage)
const hasCustomAvatar = computed(() => !!(idleSrc.value || speakingSrc.value))
const hasDistinctSpeaking = computed(() => {
  return !!viewState.value.speakingImage && viewState.value.speakingImage !== viewState.value.idleImage
})

const failedSrc = ref('')
watch([idleSrc, speakingSrc], () => {
  failedSrc.value = ''
})

const intensityFactor = computed(() => {
  switch (viewState.value.intensity) {
    case 'subtle':
      return '0.6'
    case 'energetic':
      return '1.4'
    default:
      return '1.0'
  }
})

const rootStyles = computed(() => ({
  '--pngtuber-scale': viewState.value.scale || 1.0,
  '--pngtuber-intensity': intensityFactor.value,
  '--pngtuber-glow-color': viewState.value.glowColor || '#38bdf8',
}))

function onImageError(event: Event) {
  const el = event.target as HTMLImageElement
  failedSrc.value = el.src
}
</script>

<template>
  <div
    class="pngtuber-obs-root"
    :class="[
      { 'is-inline': props.inlineMode },
      { 'is-speaking': isSpeaking },
      { 'is-idle': !isSpeaking },
      { 'is-flipped': viewState.flipH },
      { 'is-dimmed': !isSpeaking && viewState.idleDim },
      { 'has-glow': isSpeaking && viewState.showGlow },
      { 'has-shadow': viewState.shadow },
    ]"
    :style="rootStyles"
  >
    <div
      v-if="hasCustomAvatar && failedSrc !== (isSpeaking ? speakingSrc : idleSrc)"
      class="avatar-stage"
    >
      <div
        v-if="viewState.shadow"
        class="avatar-ground-shadow"
      />
      <div
        class="avatar-motion-wrapper"
        :class="[
          isSpeaking ? `anim-${viewState.speakingAnimation || 'bounce'}` : `idle-${viewState.idleAnimation || 'breathe'}`,
        ]"
      >
        <div class="avatar-stack">
          <img
            v-if="idleSrc"
            :src="idleSrc"
            alt=""
            class="avatar-image"
            :class="{ 'is-active': !isSpeaking || !hasDistinctSpeaking }"
            draggable="false"
            @error="onImageError"
          >
          <img
            v-if="hasDistinctSpeaking"
            :src="speakingSrc"
            alt=""
            class="avatar-image"
            :class="{ 'is-active': isSpeaking }"
            draggable="false"
            @error="onImageError"
          >
        </div>
      </div>
    </div>

    <div
      v-else-if="props.inlineMode"
      class="avatar-stage"
    >
      <div
        class="avatar-motion-wrapper avatar-placeholder-box"
        :class="[
          isSpeaking ? `anim-${viewState.speakingAnimation || 'bounce'}` : `idle-${viewState.idleAnimation || 'breathe'}`,
        ]"
      >
        <div class="placeholder-chibi-figure">
          <svg
            viewBox="0 0 160 200"
            width="160"
            height="200"
            class="placeholder-svg"
          >
            <circle
              cx="80"
              cy="70"
              r="44"
              fill="color-mix(in srgb, var(--vtsuru-fg-muted) 12%, transparent)"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 40%, transparent)"
              stroke-width="2.5"
            />
            <ellipse
              v-if="!isSpeaking"
              cx="64"
              cy="68"
              rx="4"
              ry="5"
              fill="color-mix(in srgb, var(--vtsuru-fg-muted) 60%, transparent)"
            />
            <ellipse
              v-if="!isSpeaking"
              cx="96"
              cy="68"
              rx="4"
              ry="5"
              fill="color-mix(in srgb, var(--vtsuru-fg-muted) 60%, transparent)"
            />
            <path
              v-if="isSpeaking"
              d="M 58 68 Q 64 62 70 68"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 80%, transparent)"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
            />
            <path
              v-if="isSpeaking"
              d="M 90 68 Q 96 62 102 68"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 80%, transparent)"
              stroke-width="2.5"
              fill="none"
              stroke-linecap="round"
            />
            <path
              v-if="!isSpeaking"
              d="M 74 84 Q 80 88 86 84"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 60%, transparent)"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
            />
            <ellipse
              v-if="isSpeaking"
              cx="80"
              cy="86"
              rx="7"
              ry="9"
              fill="color-mix(in srgb, var(--vtsuru-brand) 55%, transparent)"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 60%, transparent)"
              stroke-width="2"
            />
            <path
              d="M 50 120 C 50 120 40 180 80 180 C 120 180 110 120 110 120 Z"
              fill="color-mix(in srgb, var(--vtsuru-fg-muted) 8%, transparent)"
              stroke="color-mix(in srgb, var(--vtsuru-fg-muted) 35%, transparent)"
              stroke-width="2.5"
            />
          </svg>
          <div class="placeholder-caption">
            {{ isSpeaking ? '说话中' : '上传静止 / 说话立绘' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pngtuber-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  overflow: visible;
  user-select: none;
  pointer-events: none;
  position: relative;
  box-sizing: border-box;
}

.pngtuber-obs-root.is-inline {
  min-width: 240px;
  min-height: 280px;
}

.avatar-stage {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  transform-origin: bottom center;
  transform: scale(var(--pngtuber-scale, 1));
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.pngtuber-obs-root.is-flipped .avatar-stage {
  transform: scale(var(--pngtuber-scale, 1)) scaleX(-1);
}

.avatar-ground-shadow {
  position: absolute;
  bottom: -10px;
  width: 180px;
  height: 22px;
  background: radial-gradient(ellipse at center, rgba(15, 23, 42, 0.35) 0%, rgba(15, 23, 42, 0.08) 55%, transparent 75%);
  border-radius: 50%;
  filter: blur(2px);
  transform-origin: center center;
  transition: transform 0.22s ease-out, opacity 0.22s ease-out;
  pointer-events: none;
  z-index: 1;
}

.pngtuber-obs-root.is-speaking .avatar-ground-shadow {
  transform: scale(0.82);
  opacity: 0.55;
}

.avatar-motion-wrapper {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: bottom center;
  will-change: transform, filter;
}

.avatar-stack {
  display: grid;
}

.avatar-image {
  grid-area: 1 / 1;
  display: block;
  max-width: 100%;
  max-height: 480px;
  width: auto;
  height: auto;
  object-fit: contain;
  opacity: 0;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.1));
  transition: filter 0.18s ease-out, opacity 0.12s linear;
}

.avatar-image.is-active {
  opacity: 1;
}

.pngtuber-obs-root.is-dimmed .avatar-image.is-active {
  filter: brightness(0.88) saturate(0.92) drop-shadow(0 4px 12px rgba(0, 0, 0, 0.12));
}

.pngtuber-obs-root.has-glow.is-speaking .avatar-image.is-active {
  filter: drop-shadow(0 0 18px var(--pngtuber-glow-color, #38bdf8))
    drop-shadow(0 8px 24px rgba(0, 0, 0, 0.2));
}

.avatar-placeholder-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.placeholder-chibi-figure {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 20px;
  background: color-mix(in srgb, var(--vtsuru-bg-muted) 72%, transparent);
  backdrop-filter: blur(8px);
  border: 2px dashed var(--vtsuru-border);
  border-radius: 16px;
}

.placeholder-caption {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}

.avatar-motion-wrapper.anim-bounce {
  animation: pngtuber-bounce 0.28s cubic-bezier(0.175, 0.885, 0.32, 1.275) infinite alternate;
}

@keyframes pngtuber-bounce {
  0% { transform: translateY(0) scale(1, 1); }
  100% {
    transform: translateY(calc(-20px * var(--pngtuber-intensity, 1)))
      scale(calc(1 - 0.03 * var(--pngtuber-intensity, 1)), calc(1 + 0.04 * var(--pngtuber-intensity, 1)));
  }
}

.avatar-motion-wrapper.anim-jelly {
  animation: pngtuber-jelly 0.38s ease-in-out infinite alternate;
}

@keyframes pngtuber-jelly {
  0% {
    transform: translateY(0) scale(calc(1 + 0.08 * var(--pngtuber-intensity, 1)), calc(1 - 0.08 * var(--pngtuber-intensity, 1)));
  }
  50% {
    transform: translateY(calc(-14px * var(--pngtuber-intensity, 1)))
      scale(calc(1 - 0.06 * var(--pngtuber-intensity, 1)), calc(1 + 0.08 * var(--pngtuber-intensity, 1)));
  }
  100% {
    transform: translateY(calc(-6px * var(--pngtuber-intensity, 1)))
      scale(calc(1 + 0.03 * var(--pngtuber-intensity, 1)), calc(1 - 0.03 * var(--pngtuber-intensity, 1)));
  }
}

.avatar-motion-wrapper.anim-shake {
  animation: pngtuber-shake 0.18s ease-in-out infinite alternate;
}

@keyframes pngtuber-shake {
  0% {
    transform: translateY(calc(-6px * var(--pngtuber-intensity, 1)))
      rotate(calc(-3.5deg * var(--pngtuber-intensity, 1)));
  }
  100% {
    transform: translateY(calc(-6px * var(--pngtuber-intensity, 1)))
      rotate(calc(3.5deg * var(--pngtuber-intensity, 1)));
  }
}

.avatar-motion-wrapper.anim-pulse {
  animation: pngtuber-pulse 0.24s ease-out infinite alternate;
}

@keyframes pngtuber-pulse {
  0% { transform: scale(1); }
  100% { transform: scale(calc(1 + 0.08 * var(--pngtuber-intensity, 1))); }
}

.avatar-motion-wrapper.anim-float {
  animation: pngtuber-speaking-float 0.45s ease-in-out infinite alternate;
}

@keyframes pngtuber-speaking-float {
  0% { transform: translateY(calc(-8px * var(--pngtuber-intensity, 1))); }
  100% { transform: translateY(calc(-22px * var(--pngtuber-intensity, 1))); }
}

.avatar-motion-wrapper.anim-none {
  transform: translateY(0);
}

.avatar-motion-wrapper.idle-breathe {
  animation: pngtuber-idle-breathe 2.4s ease-in-out infinite;
}

@keyframes pngtuber-idle-breathe {
  0%, 100% { transform: translateY(0) scale(1, 1); }
  50% { transform: translateY(-4px) scale(0.99, 1.02); }
}

.avatar-motion-wrapper.idle-sway {
  animation: pngtuber-idle-sway 3.2s ease-in-out infinite;
}

@keyframes pngtuber-idle-sway {
  0%, 100% { transform: rotate(0deg) translateY(0); }
  25% { transform: rotate(-1.5deg) translateY(-2px); }
  75% { transform: rotate(1.5deg) translateY(-2px); }
}

.avatar-motion-wrapper.idle-float {
  animation: pngtuber-idle-float 2.8s ease-in-out infinite;
}

@keyframes pngtuber-idle-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

.avatar-motion-wrapper.idle-none {
  transform: none;
}
</style>
