<script setup lang="ts">
import { ImageOff, ZoomIn } from 'lucide-vue-next'
import { computed, ref, watch, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

import ImageLightbox from './ImageLightbox.vue'
import { resolvePreviewImages, type GallerySource } from './types'

const props = withDefaults(
  defineProps<{
    src: string
    alt?: string
    previewSrc?: string
    gallery?: GallerySource[]
    index?: number
    class?: HTMLAttributes['class']
    wrapperClass?: HTMLAttributes['class']
    imageClass?: HTMLAttributes['class']
    disabled?: boolean
    referrerpolicy?: ReferrerPolicy
    rotateDisabled?: boolean
    moveDisabled?: boolean
    zoomDisabled?: boolean
    maskClosable?: boolean
    loop?: boolean
  }>(),
  {
    alt: '图片预览',
    previewSrc: undefined,
    gallery: undefined,
    index: 0,
    class: undefined,
    wrapperClass: undefined,
    imageClass: undefined,
    disabled: false,
    referrerpolicy: 'no-referrer',
    rotateDisabled: false,
    moveDisabled: false,
    zoomDisabled: false,
    maskClosable: true,
    loop: true,
  },
)

const isVisible = ref(false)
const currentIndex = ref(props.index)
const hasError = ref(false)

watch(
  () => props.src,
  () => {
    hasError.value = false
  },
)

const computedImgs = computed<GallerySource[]>(() => {
  if (props.gallery && props.gallery.length > 0) {
    return resolvePreviewImages(props.gallery, props.alt)
  }
  const fallback = props.previewSrc || props.src
  return fallback ? [{ src: fallback, alt: props.alt }] : []
})

function openLightbox() {
  if (props.disabled || !computedImgs.value.length) return
  if (props.gallery && props.gallery.length > 0) {
    currentIndex.value = Math.max(0, Math.min(props.index, computedImgs.value.length - 1))
  } else {
    currentIndex.value = 0
  }
  isVisible.value = true
}
</script>

<template>
  <div :class="cn('inline-flex', wrapperClass)">
    <slot
      :open="openLightbox"
      :has-error="hasError"
      :disabled="disabled"
    >
      <button
        type="button"
        :disabled="disabled"
        :class="
          cn(
            'group relative inline-flex h-20 w-24 overflow-hidden rounded border border-border/60 bg-muted/20 transition-all focus:outline-none focus:ring-1 focus:ring-primary',
            disabled ? 'cursor-default' : 'cursor-zoom-in hover:border-primary/50',
            props.class,
          )
        "
        :aria-label="alt"
        :title="alt"
        @click="openLightbox"
      >
        <template v-if="!hasError && src">
          <img
            :src="src"
            :alt="alt"
            :referrerpolicy="referrerpolicy"
            :class="
              cn(
                'size-full object-cover transition-transform duration-200',
                !disabled && 'group-hover:scale-105',
                imageClass,
              )
            "
            loading="lazy"
            @error="hasError = true"
          />
          <span
            v-if="!disabled"
            class="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex-center opacity-0 group-hover:opacity-100"
          >
            <ZoomIn class="size-4 text-white drop-shadow" />
          </span>
        </template>
        <div
          v-else
          class="size-full flex-center flex-col gap-1 text-muted-foreground bg-muted/40 text-[10px]"
        >
          <ImageOff class="size-4 opacity-70" />
          <span>无法加载</span>
        </div>
      </button>
    </slot>

    <ImageLightbox
      v-model:open="isVisible"
      :imgs="computedImgs"
      :index="currentIndex"
      :alt="alt"
      :referrerpolicy="referrerpolicy"
      :loop="loop"
      :rotate-disabled="rotateDisabled"
      :move-disabled="moveDisabled"
      :zoom-disabled="zoomDisabled"
      :mask-closable="maskClosable"
    />
  </div>
</template>
