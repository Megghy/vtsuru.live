<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, useTemplateRef } from 'vue'

import BilibiliIcon from '@/svgs/social/bilibili.svg?component'

const props = withDefaults(
  defineProps<{
    variant?: 'emoji' | 'bilibili'
  }>(),
  {
    variant: 'emoji',
  },
)

const emojiDecorations = [
  { symbol: '🎤', size: '58px', blur: '3px', opacity: 0.14 },
  { symbol: '😵‍💫', size: '42px', blur: '2px', opacity: 0.12 },
  { symbol: '🎵', size: '34px', blur: '2px', opacity: 0.13 },
  { symbol: '🫠', size: '46px', blur: '4px', opacity: 0.16 },
  { symbol: '💬', size: '52px', blur: '3px', opacity: 0.12 },
  { symbol: '🤪', size: '44px', blur: '3px', opacity: 0.13 },
  { symbol: '⭐', size: '32px', blur: '2px', opacity: 0.15 },
  { symbol: '😎', size: '46px', blur: '3px', opacity: 0.11 },
  { symbol: '🥳', size: '38px', blur: '3px', opacity: 0.12 },
  { symbol: '🤔', size: '54px', blur: '4px', opacity: 0.1 },
  { symbol: '🫡', size: '40px', blur: '2px', opacity: 0.13 },
  { symbol: '🤯', size: '56px', blur: '4px', opacity: 0.12 },
  { symbol: '🎶', size: '36px', blur: '2px', opacity: 0.14 },
  { symbol: '💫', size: '50px', blur: '4px', opacity: 0.11 },
  { symbol: '📺', size: '44px', blur: '3px', opacity: 0.11 },
  { symbol: '🎀', size: '38px', blur: '2px', opacity: 0.12 },
  { symbol: '😶‍🌫️', size: '48px', blur: '4px', opacity: 0.1 },
  { symbol: '🙃', size: '34px', blur: '2px', opacity: 0.13 },
  { symbol: '🥸', size: '42px', blur: '3px', opacity: 0.11 },
  { symbol: '😴', size: '40px', blur: '3px', opacity: 0.12 },
]

const bilibiliDecorations = [
  { size: '82px', blur: '2px', opacity: 0.1, color: '#fb7299' },
  { size: '54px', blur: '3px', opacity: 0.08, color: '#00aeec' },
  { size: '68px', blur: '1px', opacity: 0.09, color: '#fb7299' },
  { size: '44px', blur: '3px', opacity: 0.09, color: '#7a8b99' },
  { size: '92px', blur: '4px', opacity: 0.08, color: '#00aeec' },
  { size: '58px', blur: '2px', opacity: 0.11, color: '#fb7299' },
  { size: '48px', blur: '2px', opacity: 0.08, color: '#7a8b99' },
  { size: '76px', blur: '3px', opacity: 0.1, color: '#fb7299' },
  { size: '62px', blur: '2px', opacity: 0.07, color: '#00aeec' },
  { size: '42px', blur: '1px', opacity: 0.1, color: '#fb7299' },
  { size: '86px', blur: '4px', opacity: 0.07, color: '#7a8b99' },
  { size: '52px', blur: '2px', opacity: 0.1, color: '#00aeec' },
  { size: '70px', blur: '3px', opacity: 0.09, color: '#fb7299' },
  { size: '46px', blur: '2px', opacity: 0.08, color: '#7a8b99' },
]

const floatVariants = ['bob', 'sway', 'pulse'] as const
const animatedDecorations = computed(() => {
  const decorations = props.variant === 'bilibili' ? bilibiliDecorations : emojiDecorations
  return decorations.map((decoration) => ({
    ...decoration,
    floatVariant: floatVariants[Math.floor(Math.random() * floatVariants.length)],
    floatDuration: `${randomBetween(5.5, 9).toFixed(2)}s`,
    floatDelay: `-${randomBetween(0, 8).toFixed(2)}s`,
  }))
})

interface ParticleState {
  element: HTMLElement
  x: number
  y: number
  heading: number
  speed: number
  targetSpeed: number
  turnRate: number
  targetTurnRate: number
  rotation: number
  rotationSpeed: number
  targetRotationSpeed: number
  nextChangeAt: number
}

const backdrop = useTemplateRef<HTMLElement>('backdrop')
const emojiElements = useTemplateRef<HTMLElement[]>('emojiElements')
const bounds = { width: 0, height: 0 }
let particles: ParticleState[] = []
let animationFrame = 0
let lastFrameAt = 0

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function updateBounds() {
  bounds.width = backdrop.value?.clientWidth ?? window.innerWidth
  bounds.height = backdrop.value?.clientHeight ?? window.innerHeight
}

function changeMotion(particle: ParticleState, now: number) {
  particle.targetSpeed = randomBetween(40, 62)
  particle.targetTurnRate = randomBetween(-0.11, 0.11)
  particle.targetRotationSpeed = randomBetween(-12, 12)
  particle.nextChangeAt = now + randomBetween(4500, 8500)
}

function renderParticle(particle: ParticleState) {
  particle.element.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0) rotate(${particle.rotation}deg)`
}

function animate(now: number) {
  const delta = Math.min((now - lastFrameAt) / 1000, 0.05)
  lastFrameAt = now
  const motionBlend = 1 - Math.exp(-0.7 * delta)
  const rotationBlend = 1 - Math.exp(-0.9 * delta)
  const edgeMargin = 96

  particles.forEach((particle) => {
    if (now >= particle.nextChangeAt) changeMotion(particle, now)

    particle.speed += (particle.targetSpeed - particle.speed) * motionBlend
    particle.turnRate += (particle.targetTurnRate - particle.turnRate) * motionBlend
    particle.rotationSpeed += (particle.targetRotationSpeed - particle.rotationSpeed) * rotationBlend
    particle.heading += particle.turnRate * delta
    particle.x += Math.cos(particle.heading) * particle.speed * delta
    particle.y += Math.sin(particle.heading) * particle.speed * delta
    particle.rotation += particle.rotationSpeed * delta

    if (particle.x < -edgeMargin) particle.x = bounds.width + edgeMargin
    if (particle.x > bounds.width + edgeMargin) particle.x = -edgeMargin
    if (particle.y < -edgeMargin) particle.y = bounds.height + edgeMargin
    if (particle.y > bounds.height + edgeMargin) particle.y = -edgeMargin

    renderParticle(particle)
  })

  animationFrame = requestAnimationFrame(animate)
}

onMounted(() => {
  updateBounds()
  window.addEventListener('resize', updateBounds)

  const now = performance.now()
  particles = (emojiElements.value ?? []).map((element) => {
    const particle: ParticleState = {
      element,
      x: randomBetween(0, bounds.width),
      y: randomBetween(0, bounds.height),
      heading: randomBetween(0, Math.PI * 2),
      speed: randomBetween(40, 62),
      targetSpeed: 0,
      turnRate: randomBetween(-0.04, 0.04),
      targetTurnRate: 0,
      rotation: randomBetween(-180, 180),
      rotationSpeed: randomBetween(-8, 8),
      targetRotationSpeed: 0,
      nextChangeAt: 0,
    }
    changeMotion(particle, now)
    renderParticle(particle)
    return particle
  })

  lastFrameAt = now
  animationFrame = requestAnimationFrame(animate)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame)
  window.removeEventListener('resize', updateBounds)
  particles = []
})
</script>

<template>
  <div
    ref="backdrop"
    class="emoji-backdrop"
    :class="`emoji-backdrop--${variant}`"
    aria-hidden="true"
  >
    <span
      v-for="(decoration, index) in animatedDecorations"
      :key="`${decoration.symbol}-${index}`"
      ref="emojiElements"
      class="emoji-decoration"
      :style="{
        '--emoji-size': decoration.size,
        '--emoji-blur': decoration.blur,
        '--emoji-opacity': decoration.opacity,
        '--emoji-color': decoration.color,
      }"
    >
      <span
        class="emoji-glyph"
        :class="`emoji-glyph--${decoration.floatVariant}`"
        :style="{
          '--float-duration': decoration.floatDuration,
          '--float-delay': decoration.floatDelay,
        }"
      >
        <BilibiliIcon
          v-if="variant === 'bilibili'"
          class="bilibili-glyph"
        />
        <template v-else>{{ decoration.symbol }}</template>
      </span>
    </span>
  </div>
</template>

<style lang="stylus" scoped>
.emoji-backdrop
    position: fixed;
    inset: -64px;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    user-select: none;

.emoji-decoration
    position: absolute;
    opacity: var(--emoji-opacity);
    filter: blur(var(--emoji-blur)) saturate(0.88);
    transform-origin: center;
    will-change: transform;

.emoji-glyph
    display: block;
    font-family: 'Segoe UI Emoji', 'Apple Color Emoji', 'Noto Color Emoji', sans-serif;
    font-size: var(--emoji-size);
    line-height: 1;
    animation-duration: var(--float-duration);
    animation-delay: var(--float-delay);
    animation-timing-function: ease-in-out;
    animation-iteration-count: infinite;
    will-change: transform;

.emoji-backdrop--bilibili .emoji-glyph
    color: var(--emoji-color);

.bilibili-glyph
    display: block;
    width: 1em;
    height: 1em;
    fill: currentColor;

.emoji-glyph--bob
    animation-name: emoji-float-bob;

.emoji-glyph--sway
    animation-name: emoji-float-sway;

.emoji-glyph--pulse
    animation-name: emoji-float-pulse;

@keyframes emoji-float-bob
    0%, 100%
        transform: translate3d(-8px, 8px, 0) rotate(-4deg);
    35%
        transform: translate3d(6px, -12px, 0) rotate(3deg);
    70%
        transform: translate3d(11px, 3px, 0) rotate(6deg);

@keyframes emoji-float-sway
    0%, 100%
        transform: translate3d(-14px, -3px, 0) rotate(-7deg);
    45%
        transform: translate3d(13px, 6px, 0) rotate(7deg);
    75%
        transform: translate3d(2px, -10px, 0) rotate(1deg);

@keyframes emoji-float-pulse
    0%, 100%
        transform: translate3d(0, 9px, 0) scale(0.94) rotate(-3deg);
    50%
        transform: translate3d(0, -10px, 0) scale(1.07) rotate(4deg);

@media (max-width: 700px)
    .emoji-decoration:nth-child(n + 11)
        display: none;

    .emoji-decoration
        opacity: calc(var(--emoji-opacity) * 0.78);

@media (prefers-reduced-motion: reduce)
    .emoji-glyph
        animation: none;
</style>
