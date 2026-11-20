<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { normalizePngtuberState } from '@/shared/pngtuber/normalize'
import {
  motionIntensity,
  playbackSource,
  resolveExpressionAnimations,
  selectExpression,
  selectImage,
} from '@/shared/pngtuber/renderer'
import type { PngtuberAccessory, PngtuberState } from '@/shared/pngtuber/types'
import { IMAGE_SLOTS } from '@/shared/pngtuber/types'

const props = defineProps<{
  state: PngtuberState
  isSpeaking?: boolean
  volume?: number
  expressionId?: string
  muted?: boolean
  away?: boolean
  inlineMode?: boolean
  editableAccessories?: boolean
  selectedAccessoryId?: string
  showGuides?: boolean
  noShadow?: boolean
}>()

const emit = defineEmits<{
  'asset-error': [message: string]
  'select-accessory': [id: string]
  'update-accessory': [payload: { id: string; x?: number; y?: number; scale?: number }]
}>()

const viewState = computed(() => normalizePngtuberState(props.state, { allowInlineImages: true }))
const speaking = computed(() => !!props.isSpeaking && !props.muted && !props.away)
const expression = computed(() => selectExpression(viewState.value, props.expressionId, props.away))
const activeAnimations = computed(() => resolveExpressionAnimations(viewState.value, expression.value))

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
    selected: selectImage(e, speaking.value, blinking.value, props.volume, viewState.value.shoutThreshold),
    baseSelected: selectImage(e, speaking.value, false, props.volume, viewState.value.shoutThreshold),
  })),
)

function key(id: string, src: string) {
  return `${id}\0${src}`
}

// Compute a lightweight signature of expression playback & asset URLs instead of full JSON.stringify.
const assetSignature = computed(() =>
  viewState.value.expressions
    .map(
      (e) =>
        `${e.id}:${e.playback}:${IMAGE_SLOTS.map((s) => e[s]).join('|')}:${e.accessories.map((a) => `${a.id}=${a.image}:${a.visible}`).join('|')}`,
    )
    .join(';'),
)

watch(
  () =>
    [
      expression.value.id,
      selectImage(expression.value, speaking.value, blinking.value, props.volume, viewState.value.shoutThreshold),
      speaking.value,
      assetSignature.value,
    ] as const,
  () => {
    const active = expression.value
    const selected = selectImage(active, speaking.value, blinking.value, props.volume, viewState.value.shoutThreshold)
    const baseSelected = selectImage(active, speaking.value, false, props.volume, viewState.value.shoutThreshold)
    const next = { ...sources.value }
    const liveKeys = new Set<string>()
    const nextActive = new Set<string>()
    const nextModes = new Map<string, string>()

    for (const layer of layers.value) {
      for (const src of [...layer.images, ...layer.expression.accessories.map((a) => a.image).filter(Boolean)]) {
        const k = key(layer.expression.id, src)
        liveKeys.add(k)
        nextModes.set(k, layer.expression.playback)
        const isCurrentExpr = layer.expression.id === active.id
        const isSelectedImage = src === selected
        const isVisibleAccessory = active.accessories.some(
          (a) => a.image === src && (a.visible === 'always' || a.visible === (speaking.value ? 'speaking' : 'idle')),
        )
        const visible = isCurrentExpr && (isSelectedImage || isVisibleAccessory)
        // Keep base (non-blink) speaking/idle image in activeKeys while blinking so a 130ms blink won't restart animations.
        const keepActiveThroughBlink = isCurrentExpr && blinking.value && src === baseSelected && activeKeys.has(k)
        if (visible || keepActiveThroughBlink) nextActive.add(k)

        if (playbackModes.get(k) !== layer.expression.playback) delete next[k]
        if (layer.expression.playback === 'continue') {
          next[k] = src
        } else if (visible && (!activeKeys.has(k) || playbackModes.get(k) !== layer.expression.playback)) {
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

    // Prune stale error entries for old _play URLs so Maps/Sets don't grow unbounded.
    const liveUrls = new Set(Object.values(next).filter(Boolean))
    if (failed.value.size > 0) {
      const prunedFailed = new Set([...failed.value].filter((u) => liveUrls.has(u)))
      if (prunedFailed.size !== failed.value.size) failed.value = prunedFailed
    }
    if (reported.value.size > 0) {
      const allRawUrls = new Set(
        viewState.value.expressions.flatMap((e) => [
          ...IMAGE_SLOTS.map((slot) => e[slot]),
          ...e.accessories.map((a) => a.image),
        ]),
      )
      const prunedReported = new Map([...reported.value].filter(([u]) => liveUrls.has(u) || allRawUrls.has(u)))
      if (prunedReported.size !== reported.value.size) reported.value = prunedReported
    }
  },
  { immediate: true },
)

watch(
  () => [...reported.value.values()].join('\n'),
  (message) => emit('asset-error', message),
  { immediate: true },
)

function source(id: string, src: string) {
  return sources.value[key(id, src)] || ''
}
function imageError(src: string) {
  if (!src) return
  failed.value = new Set([...failed.value, src])
  report(src, `立绘素材加载失败：${src}`)
}

const empty = computed(() => {
  const src = source(
    expression.value.id,
    selectImage(expression.value, speaking.value, blinking.value, props.volume, viewState.value.shoutThreshold),
  )
  return !src || failed.value.has(src)
})

// Visual accessory dragging & wheel scaling inside preview canvas
const dragState = ref<{
  id: string
  startClientX: number
  startClientY: number
  originX: number
  originY: number
  currentX: number
  currentY: number
} | null>(null)

function accessoryTransform(accessory: PngtuberAccessory) {
  const isDragging = dragState.value?.id === accessory.id
  const x = isDragging ? dragState.value!.currentX : accessory.x
  const y = isDragging ? dragState.value!.currentY : accessory.y
  return `translate(${x}px, ${y}px) rotate(${accessory.rotation}deg) scale(${accessory.scale})`
}

function onAccessoryPointerDown(event: PointerEvent, accessory: PngtuberAccessory) {
  if (!props.editableAccessories) return
  event.preventDefault()
  event.stopPropagation()
  emit('select-accessory', accessory.id)

  const target = event.currentTarget as HTMLElement
  target.setPointerCapture?.(event.pointerId)

  dragState.value = {
    id: accessory.id,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originX: accessory.x,
    originY: accessory.y,
    currentX: accessory.x,
    currentY: accessory.y,
  }

  const totalScale = Math.max(0.05, fit.value * viewState.value.scale)
  const flipSign = viewState.value.flipH ? -1 : 1

  const onMove = (e: PointerEvent) => {
    if (!dragState.value) return
    const dx = ((e.clientX - dragState.value.startClientX) / totalScale) * flipSign
    const dy = (e.clientY - dragState.value.startClientY) / totalScale
    const nextX = Math.max(-2000, Math.min(2000, Math.round(dragState.value.originX + dx)))
    const nextY = Math.max(-2000, Math.min(2000, Math.round(dragState.value.originY + dy)))
    dragState.value.currentX = nextX
    dragState.value.currentY = nextY
  }

  const onUp = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onUp)
    if (dragState.value) {
      const { id, currentX, currentY, originX, originY } = dragState.value
      dragState.value = null
      if (currentX !== originX || currentY !== originY) {
        emit('update-accessory', { id, x: currentX, y: currentY })
      }
    }
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}

function onAccessoryWheel(event: WheelEvent, accessory: PngtuberAccessory) {
  if (!props.editableAccessories) return
  event.preventDefault()
  event.stopPropagation()
  emit('select-accessory', accessory.id)
  const step = event.shiftKey ? 0.02 : 0.05
  const delta = event.deltaY < 0 ? step : -step
  const nextScale = Number(Math.max(0.05, Math.min(10, accessory.scale + delta)).toFixed(2))
  if (nextScale !== accessory.scale) {
    emit('update-accessory', { id: accessory.id, scale: nextScale })
  }
}
</script>

<template>
  <div
    ref="root"
    class="pngtuber-obs-root"
    :class="{ 'is-inline': inlineMode, 'is-editable': editableAccessories }"
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
      <div
        v-if="showGuides || editableAccessories"
        class="canvas-guides"
      >
        <div class="guide-v" />
        <div class="guide-h" />
      </div>

      <div class="avatar-stage">
        <div
          v-if="viewState.shadow && !empty && !noShadow"
          class="avatar-ground-shadow"
        />
        <div
          class="avatar-motion-wrapper"
          :class="speaking ? `anim-${activeAnimations.speaking}` : `idle-${activeAnimations.idle}`"
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
                  (editableAccessories ||
                    accessory.visible === 'always' ||
                    accessory.visible === (speaking ? 'speaking' : 'idle')),
                'is-draggable': editableAccessories && layer.expression.id === expression.id,
                'is-selected': editableAccessories && selectedAccessoryId === accessory.id,
              }"
              :style="{
                zIndex: accessory.front ? 3 : 1,
                transform: accessoryTransform(accessory),
              }"
              alt=""
              draggable="false"
              @pointerdown="onAccessoryPointerDown($event, accessory)"
              @wheel="onAccessoryWheel($event, accessory)"
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
