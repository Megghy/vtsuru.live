<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, RotateCcw, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import { DialogContent, DialogPortal, DialogRoot, DialogTitle, VisuallyHidden } from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { resolvePreviewImages, type GallerySource } from './types'

const MIN_SCALE = 0.25
const MAX_SCALE = 5
const SCALE_STEP = 0.25

const props = withDefaults(
  defineProps<{
    imgs: GallerySource[]
    index?: number
    alt?: string
    referrerpolicy?: ReferrerPolicy
    loop?: boolean
    zoomDisabled?: boolean
    rotateDisabled?: boolean
    moveDisabled?: boolean
    maskClosable?: boolean
  }>(),
  {
    index: 0,
    alt: '图片预览',
    referrerpolicy: 'no-referrer',
    loop: true,
    zoomDisabled: false,
    rotateDisabled: false,
    moveDisabled: false,
    maskClosable: true,
  },
)

const open = defineModel<boolean>('open', { default: false })

const resolvedImgs = computed(() => resolvePreviewImages(props.imgs, props.alt))
const currentIndex = ref(0)
const scale = ref(1)
const rotate = ref(0)
const offsetX = ref(0)
const offsetY = ref(0)
const isDragging = ref(false)
const isError = ref(false)

let activePointerId: number | null = null
let dragStartX = 0
let dragStartY = 0
let dragOriginX = 0
let dragOriginY = 0
let didDrag = false
let suppressMaskClick = false

function clampIndex(idx: number): number {
  const len = resolvedImgs.value.length
  if (len === 0) return 0
  return Math.max(0, Math.min(idx, len - 1))
}

function resetTransform() {
  scale.value = 1
  rotate.value = 0
  offsetX.value = 0
  offsetY.value = 0
  isDragging.value = false
  activePointerId = null
  didDrag = false
  suppressMaskClick = false
}

const currentImage = computed(() => resolvedImgs.value[currentIndex.value])
const hasMultiple = computed(() => resolvedImgs.value.length > 1)
const canPrev = computed(() => hasMultiple.value && (props.loop || currentIndex.value > 0))
const canNext = computed(() => hasMultiple.value && (props.loop || currentIndex.value < resolvedImgs.value.length - 1))

watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    currentIndex.value = clampIndex(props.index)
    resetTransform()
    isError.value = false
  },
  { immediate: true },
)

watch(
  () => props.index,
  (idx) => {
    if (!open.value) return
    currentIndex.value = clampIndex(idx)
    resetTransform()
  },
)

watch(
  () => currentImage.value?.src,
  () => {
    isError.value = false
  },
)

function close() {
  open.value = false
}

function goTo(targetIndex: number) {
  const len = resolvedImgs.value.length
  if (len <= 1) return
  if (props.loop) {
    currentIndex.value = ((targetIndex % len) + len) % len
  } else {
    currentIndex.value = clampIndex(targetIndex)
  }
  resetTransform()
}

function prev() {
  if (!canPrev.value) return
  goTo(currentIndex.value - 1)
}

function next() {
  if (!canNext.value) return
  goTo(currentIndex.value + 1)
}

function zoomBy(delta: number) {
  if (props.zoomDisabled) return
  const nextScale = Math.round((scale.value + delta) * 100) / 100
  scale.value = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
}

function rotateBy(deg: number) {
  if (props.rotateDisabled) return
  rotate.value += deg
}

function toggleDoubleClickZoom() {
  if (props.zoomDisabled) return
  if (scale.value !== 1) {
    resetTransform()
  } else {
    scale.value = 2
  }
}

function onWheel(event: WheelEvent) {
  if (props.zoomDisabled) return
  zoomBy(event.deltaY < 0 ? SCALE_STEP : -SCALE_STEP)
}

function onPointerDown(event: PointerEvent) {
  if (props.moveDisabled || event.button !== 0) return
  const target = event.currentTarget as HTMLElement | null
  activePointerId = event.pointerId
  dragStartX = event.clientX
  dragStartY = event.clientY
  dragOriginX = offsetX.value
  dragOriginY = offsetY.value
  didDrag = false
  isDragging.value = true
  target?.setPointerCapture?.(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!isDragging.value || activePointerId !== event.pointerId) return
  const dx = event.clientX - dragStartX
  const dy = event.clientY - dragStartY
  if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
    didDrag = true
  }
  offsetX.value = dragOriginX + dx
  offsetY.value = dragOriginY + dy
}

function onPointerUp(event: PointerEvent) {
  if (activePointerId !== event.pointerId) return
  const target = event.currentTarget as HTMLElement | null
  if (target?.hasPointerCapture?.(event.pointerId)) {
    target.releasePointerCapture(event.pointerId)
  }
  if (didDrag) {
    suppressMaskClick = true
  }
  isDragging.value = false
  activePointerId = null
}

function onMaskClick() {
  if (suppressMaskClick) {
    suppressMaskClick = false
    return
  }
  if (props.maskClosable) close()
}

useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (!open.value) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    prev()
  } else if (event.key === 'ArrowRight') {
    event.preventDefault()
    next()
  } else if (event.key === '+' || event.key === '=') {
    event.preventDefault()
    zoomBy(SCALE_STEP)
  } else if (event.key === '-') {
    event.preventDefault()
    zoomBy(-SCALE_STEP)
  } else if (event.key === '0') {
    event.preventDefault()
    resetTransform()
  }
})

const imageTransformStyle = computed(() => ({
  transform: `translate3d(${offsetX.value}px, ${offsetY.value}px, 0) scale(${scale.value}) rotate(${rotate.value}deg)`,
}))
</script>

<template>
  <DialogRoot
    :open="open"
    @update:open="(val) => { if (!val) close() }"
  >
    <DialogPortal>
      <DialogContent
        data-testid="image-lightbox"
        class="fixed inset-0 z-[9998] bg-black/80 backdrop-blur-xs select-none outline-none flex-center"
        :aria-describedby="undefined"
        @open-auto-focus.prevent
        @close-auto-focus.prevent
        @wheel.prevent="onWheel"
        @click.self="onMaskClick"
      >
        <VisuallyHidden as-child>
          <DialogTitle>{{ currentImage?.alt || alt }}</DialogTitle>
        </VisuallyHidden>

        <!-- 顶部计数与关闭按钮 -->
        <div
          v-if="hasMultiple"
          class="pointer-events-none fixed top-4 left-1/2 -translate-x-1/2 z-20 rounded-full bg-black/65 text-white border border-white/10 px-3 py-1 text-xs font-mono tabular-nums"
        >
          {{ currentIndex + 1 }} / {{ resolvedImgs.length }}
        </div>

        <button
          type="button"
          aria-label="关闭预览"
          title="关闭 (Esc)"
          class="fixed top-4 right-4 z-20 size-9 rounded-full bg-black/65 text-white/85 hover:text-white hover:bg-black/85 border border-white/10 flex-center transition-colors cursor-pointer"
          @click="close"
        >
          <X class="size-5" />
        </button>

        <!-- 左右切换 -->
        <button
          v-if="hasMultiple"
          type="button"
          aria-label="上一张"
          title="上一张 (←)"
          :disabled="!canPrev"
          class="fixed left-4 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full bg-black/65 text-white/85 hover:text-white hover:bg-black/85 border border-white/10 flex-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          @click="prev"
        >
          <ChevronLeft class="size-5" />
        </button>

        <button
          v-if="hasMultiple"
          type="button"
          aria-label="下一张"
          title="下一张 (→)"
          :disabled="!canNext"
          class="fixed right-4 top-1/2 -translate-y-1/2 z-20 size-10 rounded-full bg-black/65 text-white/85 hover:text-white hover:bg-black/85 border border-white/10 flex-center transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          @click="next"
        >
          <ChevronRight class="size-5" />
        </button>

        <!-- 图片画布 -->
        <div
          v-if="currentImage && !isError"
          class="relative flex-center max-w-[90vw] max-h-[85vh]"
          :class="[
            !moveDisabled && (isDragging ? 'cursor-grabbing' : 'cursor-grab'),
            !isDragging && 'transition-transform duration-150 ease-out',
          ]"
          :style="imageTransformStyle"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @pointercancel="onPointerUp"
          @dblclick="toggleDoubleClickZoom"
        >
          <img
            :src="currentImage.src"
            :alt="currentImage.alt || alt"
            :referrerpolicy="referrerpolicy"
            draggable="false"
            class="max-w-[90vw] max-h-[85vh] object-contain rounded shadow-2xl"
            @error="isError = true"
          />
        </div>

        <div
          v-else
          class="flex-col-center gap-2 rounded-lg border border-white/10 bg-black/70 px-6 py-5 text-white/80 text-xs"
        >
          <ImageOff class="size-7 opacity-75" />
          <span>无法加载图片</span>
        </div>

        <!-- 底部工具栏 -->
        <div
          v-if="!zoomDisabled || !rotateDisabled"
          class="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 bg-black/70 text-white border border-white/10 rounded-full px-2 py-1 flex items-center gap-1"
        >
          <template v-if="!zoomDisabled">
            <button
              type="button"
              aria-label="缩小"
              title="缩小 (-)"
              :disabled="scale <= MIN_SCALE"
              class="size-7 rounded-full hover:bg-white/15 flex-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
              @click="zoomBy(-SCALE_STEP)"
            >
              <ZoomOut class="size-4" />
            </button>
            <span class="min-w-11 text-center text-[11px] font-mono tabular-nums text-white/85">
              {{ Math.round(scale * 100) }}%
            </span>
            <button
              type="button"
              aria-label="放大"
              title="放大 (+)"
              :disabled="scale >= MAX_SCALE"
              class="size-7 rounded-full hover:bg-white/15 flex-center transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
              @click="zoomBy(SCALE_STEP)"
            >
              <ZoomIn class="size-4" />
            </button>
            <button
              type="button"
              aria-label="重置缩放"
              title="重置 (0)"
              class="size-7 rounded-full hover:bg-white/15 flex-center transition-colors cursor-pointer"
              @click="resetTransform"
            >
              <Maximize2 class="size-3.5" />
            </button>
          </template>
          <template v-if="!rotateDisabled">
            <span
              v-if="!zoomDisabled"
              class="mx-0.5 h-3.5 w-px bg-white/15"
            />
            <button
              type="button"
              aria-label="向左旋转"
              title="向左旋转 90°"
              class="size-7 rounded-full hover:bg-white/15 flex-center transition-colors cursor-pointer"
              @click="rotateBy(-90)"
            >
              <RotateCcw class="size-3.5" />
            </button>
            <button
              type="button"
              aria-label="向右旋转"
              title="向右旋转 90°"
              class="size-7 rounded-full hover:bg-white/15 flex-center transition-colors cursor-pointer"
              @click="rotateBy(90)"
            >
              <RotateCw class="size-3.5" />
            </button>
          </template>
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
