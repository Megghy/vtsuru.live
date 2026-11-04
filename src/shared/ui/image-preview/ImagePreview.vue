<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from 'vue'
import VueEasyLightbox from 'vue-easy-lightbox'
import { ImageOff, ZoomIn } from 'lucide-vue-next'
import { cn } from '@/shared/utils/cn'

interface GalleryItemLike {
  path?: string
  url?: string
  name?: string
}

type GallerySource = string | GalleryItemLike

const props = withDefaults(
  defineProps<{
    src: string
    alt?: string
    previewSrc?: string
    gallery?: GallerySource[]
    index?: number
    class?: HTMLAttributes['class']
    imageClass?: HTMLAttributes['class']
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
    imageClass: undefined,
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

function extractUrl(item: GallerySource): string {
  if (typeof item === 'string') {
    return item
  }
  return item?.path || item?.url || ''
}

const computedImgs = computed<string[]>(() => {
  if (props.gallery && props.gallery.length > 0) {
    return props.gallery.map(extractUrl).filter(Boolean)
  }
  const fallback = props.previewSrc || props.src
  return fallback ? [fallback] : []
})

function openLightbox() {
  if (!computedImgs.value.length) return
  if (props.gallery && props.gallery.length > 0) {
    currentIndex.value = Math.max(0, Math.min(props.index, computedImgs.value.length - 1))
  } else {
    currentIndex.value = 0
  }
  isVisible.value = true
}

function closeLightbox() {
  isVisible.value = false
}

function handleImageError() {
  hasError.value = true
}
</script>

<template>
  <div class="inline-flex">
    <!-- 默认缩略图或自定义插槽触发器 -->
    <slot
      :open="openLightbox"
      :has-error="hasError"
    >
      <button
        type="button"
        :class="
          cn(
            'group relative inline-flex h-20 w-24 overflow-hidden rounded border border-border/60 bg-muted/20 cursor-zoom-in transition-all hover:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary',
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
            :class="
              cn(
                'size-full object-cover transition-transform duration-200 group-hover:scale-105',
                imageClass,
              )
            "
            loading="lazy"
            @error="handleImageError"
          />
          <span
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

    <!-- 专业 Lightbox 弹窗 -->
    <VueEasyLightbox
      :visible="isVisible"
      :imgs="computedImgs"
      :index="currentIndex"
      :loop="loop"
      :rotate-disabled="rotateDisabled"
      :move-disabled="moveDisabled"
      :zoom-disabled="zoomDisabled"
      :mask-closable="maskClosable"
      teleport="body"
      @hide="closeLightbox"
    />
  </div>
</template>
