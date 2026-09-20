<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import { motionIntensity, playbackSource, selectExpression, selectImage } from '@/shared/pngtuber/renderer'
import type { PngtuberState } from '@/shared/pngtuber/types'
import { IMAGE_SLOTS } from '@/shared/pngtuber/types'

const props = defineProps<{
  state: PngtuberState
  isSpeaking?: boolean
  volume?: number
  expressionId?: string
  muted?: boolean
  away?: boolean
  inlineMode?: boolean
}>()
const emit = defineEmits<{ 'asset-error': [message: string] }>()
const viewState = computed(() => normalizePngtuberState(props.state))
const speaking = computed(() => !!props.isSpeaking && !props.muted && !props.away)
const expression = computed(() => selectExpression(viewState.value, props.expressionId, props.away))
const blinking = ref(false)
let blinkTimer: ReturnType<typeof setTimeout> | undefined
function scheduleBlink() {
  clearTimeout(blinkTimer)
  blinking.value = false
  if (!viewState.value.blinkEnabled) return
  const { blinkMin, blinkMax, blinkDuration } = viewState.value
  blinkTimer = setTimeout(
    () => {
      blinking.value = true
      blinkTimer = setTimeout(scheduleBlink, blinkDuration)
    },
    blinkMin + Math.random() * (blinkMax - blinkMin),
  )
}
watch(
  () => [
    viewState.value.blinkEnabled,
    viewState.value.blinkMin,
    viewState.value.blinkMax,
    viewState.value.blinkDuration,
  ],
  scheduleBlink,
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(blinkTimer))
const root = ref<HTMLElement>()
const { width, height } = useElementSize(root)
const fit = computed(
  () => Math.min(width.value / viewState.value.canvasWidth, height.value / viewState.value.canvasHeight) || 1,
)
const styles = computed(() => {
  const s = viewState.value
  // Even a tiny canvas retains a drawable area when importing large padding values.
  const padding = Math.min(s.padding, (Math.min(s.canvasWidth, s.canvasHeight) - 1) / 2)
  return {
    width: `${s.canvasWidth}px`,
    height: `${s.canvasHeight}px`,
    transform: `scale(${fit.value})`,
    '--padding': `${padding}px`,
    '--scale': s.scale,
    '--flip': s.flipH ? -1 : 1,
    '--intensity': motionIntensity(s, speaking.value, props.volume),
    '--glow': s.glowColor,
    '--transition': `${s.transitionMs}ms`,
  }
})
const sources = ref<Record<string, string>>({})
const failed = ref(new Set<string>())
const reported = ref(new Map<string, string>())
let activation = 0
let activeKeys = new Set<string>()
let playbackModes = new Map<string, string>()
function report(src: string, message: string) {
  reported.value = new Map(reported.value).set(src, message)
}
function imageLoaded(src: string) {
  if (!failed.value.has(src) && !reported.value.has(src)) return
  const next = new Set(failed.value)
  next.delete(src)
  failed.value = next
  const errors = new Map(reported.value)
  errors.delete(src)
  reported.value = errors
}
const layers = computed(() =>
  viewState.value.expressions.map((e) => ({
    expression: e,
    images: [...new Set(IMAGE_SLOTS.map((slot) => e[slot]).filter(Boolean))],
    selected: selectImage(e, speaking.value, blinking.value),
  })),
)
function key(id: string, src: string) {
  return JSON.stringify([id, src])
}
watch(
  () =>
    [
      expression.value.id,
      selectImage(expression.value, speaking.value, blinking.value),
      speaking.value,
      JSON.stringify(viewState.value.expressions),
    ] as const,
  () => {
    const active = expression.value
    const selected = selectImage(active, speaking.value, blinking.value)
    const next = { ...sources.value }
    const liveKeys = new Set<string>()
    const nextActive = new Set<string>()
    const nextModes = new Map<string, string>()
    for (const layer of layers.value) {
      for (const src of [...layer.images, ...layer.expression.accessories.map((a) => a.image).filter(Boolean)]) {
        const k = key(layer.expression.id, src)
        liveKeys.add(k)
        nextModes.set(k, layer.expression.playback)
        const visible =
          layer.expression.id === active.id &&
          (src === selected ||
            active.accessories.some(
              (a) =>
                a.image === src && (a.visible === 'always' || a.visible === (speaking.value ? 'speaking' : 'idle')),
            ))
        if (visible) nextActive.add(k)
        if (playbackModes.get(k) !== layer.expression.playback) delete next[k]
        if (layer.expression.playback === 'continue') next[k] = src
        else if (visible && (!activeKeys.has(k) || playbackModes.get(k) !== layer.expression.playback)) {
          try {
            next[k] = playbackSource(src, active.playback, `${Date.now()}-${++activation}`)
          } catch (error) {
            next[k] = ''
            report(src, (error as Error).message)
          }
        }
      }
    }
    for (const k of Object.keys(next)) if (!liveKeys.has(k)) delete next[k]
    sources.value = next
    activeKeys = nextActive
    playbackModes = nextModes
  },
  { immediate: true },
)
watch(
  () => {
    const activeSources = new Set([
      ...Object.values(sources.value),
      ...viewState.value.expressions.flatMap((e) => [
        ...IMAGE_SLOTS.map((slot) => e[slot]),
        ...e.accessories.map((a) => a.image),
      ]),
    ])
    return [...reported.value]
      .filter(([src]) => activeSources.has(src))
      .map(([, message]) => message)
      .join('\n')
  },
  (message) => emit('asset-error', message),
  { immediate: true },
)
function source(id: string, src: string) {
  return sources.value[key(id, src)] || ''
}
function imageError(src: string) {
  failed.value = new Set([...failed.value, src])
  report(src, `立绘素材加载失败：${src}`)
}
const empty = computed(() => {
  const src = source(expression.value.id, selectImage(expression.value, speaking.value, blinking.value))
  return !src || failed.value.has(src)
})
</script>

<template>
  <div
    ref="root"
    class="pngtuber-obs-root"
    :class="{ 'is-inline': inlineMode }"
  >
    <div
      class="pngtuber-canvas"
      :style="styles"
      :class="{
        'is-speaking': speaking,
        'is-dimmed': !speaking && viewState.idleDim,
        'has-glow': speaking && viewState.showGlow,
        'is-pixelated': viewState.pixelated,
        'motion-onset': viewState.motionMode === 'onset',
      }"
    >
      <div class="avatar-stage">
        <div
          v-if="viewState.shadow && !empty"
          class="avatar-ground-shadow"
        />
        <div
          class="avatar-motion-wrapper"
          :class="speaking ? `anim-${viewState.speakingAnimation}` : `idle-${viewState.idleAnimation}`"
        >
          <div
            v-for="layer in layers"
            :key="layer.expression.id"
            class="expression-layer"
            :class="{ 'is-current': layer.expression.id === expression.id }"
          >
            <img
              v-for="src in layer.images"
              :key="src"
              :src="source(layer.expression.id, src) || undefined"
              class="avatar-image"
              :class="{ 'is-active': src === layer.selected && !!source(layer.expression.id, src) }"
              alt=""
              draggable="false"
              @load="imageLoaded(source(layer.expression.id, src))"
              @error="imageError(source(layer.expression.id, src))"
            />
            <img
              v-for="accessory in layer.expression.accessories"
              :key="`accessory-${accessory.id}`"
              :src="source(layer.expression.id, accessory.image) || undefined"
              class="accessory-image"
              :class="{
                'is-active':
                  !!source(layer.expression.id, accessory.image) &&
                  (accessory.visible === 'always' || accessory.visible === (speaking ? 'speaking' : 'idle')),
              }"
              :style="{
                zIndex: accessory.front ? 3 : 1,
                transform: `translate(${accessory.x}px, ${accessory.y}px) rotate(${accessory.rotation}deg) scale(${accessory.scale})`,
              }"
              alt=""
              draggable="false"
              @load="imageLoaded(source(layer.expression.id, accessory.image))"
              @error="imageError(source(layer.expression.id, accessory.image))"
            />
          </div>
        </div>
      </div>
      <div
        v-if="inlineMode && empty"
        class="placeholder-caption"
      >
        {{
          expression.idleImage || expression.speakingImage
            ? '素材不可用，请检查图片地址或先上传素材'
            : '上传立绘后显示预览'
        }}
      </div>
    </div>
  </div>
</template>

<style scoped src="./PngtuberDisplay.css"></style>
