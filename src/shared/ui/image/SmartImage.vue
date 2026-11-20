<script setup lang="ts">
import { computed, ref, type HTMLAttributes } from 'vue'

import { stripImageTransformFromUrl, type ImageTransformInput } from '@/shared/services/imageTransform'
import { useAutoImageSrc } from '@/shared/services/useAutoImageSrc'
import ImageLightbox from '@/shared/ui/image-preview/ImageLightbox.vue'
import { cn } from '@/shared/utils/cn'

const props = withDefaults(
  defineProps<{
    src: string | null | undefined
    alt?: string
    previewSrc?: string
    preview?: boolean
    transform?: ImageTransformInput | 'auto' | false
    fallbackTransform?: ImageTransformInput
    crop?: boolean
    fileId?: number
    isPublic?: boolean
    class?: HTMLAttributes['class']
    loading?: 'lazy' | 'eager'
    decoding?: 'async' | 'sync' | 'auto'
    referrerpolicy?: ReferrerPolicy
  }>(),
  {
    alt: '',
    previewSrc: undefined,
    preview: false,
    transform: 'auto',
    fallbackTransform: 'card',
    crop: undefined,
    fileId: undefined,
    isPublic: undefined,
    class: undefined,
    loading: 'lazy',
    decoding: 'async',
    referrerpolicy: 'no-referrer',
  },
)

const emit = defineEmits<{
  load: [event: Event]
  error: [event: Event]
}>()

const imgRef = ref<HTMLImageElement | null>(null)
const lightboxOpen = ref(false)

const shouldCrop = computed(() => {
  if (props.crop !== undefined) return props.crop
  return typeof props.class === 'string' && props.class.includes('object-cover')
})

const { src: resolvedSrc, handleError } = useAutoImageSrc(
  imgRef,
  () => props.src,
  () => ({
    transform: props.transform,
    fallbackTransform: props.fallbackTransform,
    crop: shouldCrop.value,
    fileId: props.fileId,
    isPublic: props.isPublic,
  }),
)

function onImgError(event: Event) {
  if (handleError()) return
  emit('error', event)
}

const rawPreviewSrc = computed(() => props.previewSrc || stripImageTransformFromUrl(props.src) || props.src || '')

function onImgClick() {
  if (!props.preview) return
  if (rawPreviewSrc.value) lightboxOpen.value = true
}
</script>

<template>
  <img
    v-if="src"
    ref="imgRef"
    :src="resolvedSrc || undefined"
    :alt="alt"
    :loading="loading"
    :decoding="decoding"
    :referrerpolicy="referrerpolicy"
    :class="cn(preview && 'cursor-zoom-in', props.class)"
    @load="emit('load', $event)"
    @error="onImgError"
    @click="onImgClick"
  />
  <ImageLightbox
    v-if="preview && rawPreviewSrc"
    v-model:open="lightboxOpen"
    :imgs="[{ src: rawPreviewSrc, alt }]"
    :alt="alt"
    :referrerpolicy="referrerpolicy"
  />
</template>
