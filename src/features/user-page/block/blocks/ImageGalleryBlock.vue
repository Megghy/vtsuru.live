<script setup lang="ts">
import { NCarousel } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

type GalleryLayout = 'grid' | 'masonry' | 'carousel'
type GalleryFit = 'cover' | 'contain'
type GalleryItem = { src: string, desc: string }

type CarouselEffect = 'slide' | 'fade' | 'card' | 'custom'
type CarouselDotType = 'dot' | 'line'
type CarouselDotPlacement = 'top' | 'bottom' | 'left' | 'right'
type CarouselTrigger = 'click' | 'hover'

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}

  const layout: GalleryLayout = (o.layout === 'masonry' || o.layout === 'carousel') ? o.layout : 'grid'
  const columns = (Number.isFinite(Number(o.columns)) && Number(o.columns) >= 1) ? Math.min(12, Math.max(1, Number(o.columns))) : 3
  const gap = (Number.isFinite(Number(o.gap)) && Number(o.gap) >= 0) ? Math.min(80, Math.max(0, Number(o.gap))) : 12
  const maxWidth = typeof o.maxWidth === 'string' ? o.maxWidth : ''
  const maxHeight = typeof o.maxHeight === 'string' ? o.maxHeight : ''
  const fit: GalleryFit = (o.fit === 'contain') ? 'contain' : 'cover'
  const autoplay = typeof o.autoplay === 'boolean' ? o.autoplay : false
  const interval = (() => {
    const v = Number(o.interval)
    if (Number.isFinite(v) && v >= 1000) return Math.min(20000, Math.max(1000, v))
    const legacy = Number(o.intervalMs)
    if (Number.isFinite(legacy) && legacy >= 1000) return Math.min(20000, Math.max(1000, legacy))
    return 5000
  })()

  const effect: CarouselEffect = (o.effect === 'fade' || o.effect === 'card' || o.effect === 'custom') ? o.effect : 'slide'
  const dotType: CarouselDotType = 'line'
  const dotPlacement: CarouselDotPlacement = (o.dotPlacement === 'top' || o.dotPlacement === 'left' || o.dotPlacement === 'right') ? o.dotPlacement : 'bottom'
  const showDots = typeof o.showDots === 'boolean' ? o.showDots : true
  const showArrow = true
  const loop = true
  const draggable = true
  const touchable = true
  const trigger: CarouselTrigger = 'click'

  const rawItems = Array.isArray(o.items) ? o.items : []
  const items: GalleryItem[] = rawItems
    .map((it: any) => {
      const obj = (it && typeof it === 'object' && !Array.isArray(it)) ? it : {}
      const file = (obj.imageFile && typeof obj.imageFile === 'object' && !Array.isArray(obj.imageFile)) ? obj.imageFile : null
      const src = (file && typeof file.path === 'string' && file.path) ? file.path : (typeof obj.url === 'string' ? obj.url : '')
      const desc = typeof obj.desc === 'string' ? obj.desc : (typeof obj.alt === 'string' ? obj.alt : '')
      return {
        src,
        desc,
      }
    })
    .filter(it => !!it.src)

  return {
    layout,
    columns,
    gap,
    maxWidth,
    maxHeight,
    fit,
    autoplay,
    interval,
    effect,
    dotType,
    dotPlacement,
    showArrow,
    showDots,
    loop,
    draggable,
    touchable,
    trigger,
    items,
  }
})

const containerStyle = computed(() => ({
  width: '100%',
  maxWidth: model.value.maxWidth?.trim() ? model.value.maxWidth.trim() : undefined,
  ['--vtsuru-gallery-cols' as any]: String(model.value.columns),
  ['--vtsuru-gallery-gap' as any]: `${model.value.gap}px`,
}))

const fixedCarousel = computed(() => {
  if (model.value.layout !== 'carousel') return false
  if (model.value.maxHeight?.trim()) return true
  return model.value.effect !== 'slide'
})

const carouselStyle = computed(() => {
  const style: Record<string, string> = { width: '100%' }
  const maxHeight = model.value.maxHeight?.trim()
  if (maxHeight) style.height = maxHeight
  else if (model.value.effect !== 'slide') style.aspectRatio = '16 / 9'
  return style
})

const imgStyle = computed(() => ({
  objectFit: model.value.fit,
  maxHeight: (model.value.layout !== 'masonry' && model.value.maxHeight?.trim()) ? model.value.maxHeight.trim() : undefined,
}))
</script>

<template>
  <div class="root" :style="containerStyle">
    <NCarousel
      v-if="model.layout === 'carousel'"
      class="carousel"
      :class="{ fixed: fixedCarousel }"
      :style="carouselStyle"
      :autoplay="model.autoplay"
      :interval="model.interval"
      :effect="model.effect"
      :show-arrow="model.showArrow"
      :show-dots="model.showDots"
      :dot-type="model.dotType"
      :dot-placement="model.dotPlacement"
      :loop="model.loop"
      :draggable="model.draggable"
      :touchable="model.touchable"
      :trigger="model.trigger"
    >
      <div v-for="(it, idx) in model.items" :key="idx" class="slide" :class="{ fixed: fixedCarousel }">
        <div class="media">
          <img
            :src="it.src"
            :alt="it.desc"
            referrerpolicy="no-referrer"
            class="img"
            :style="imgStyle"
          >
        </div>
        <div v-if="it.desc" class="caption">{{ it.desc }}</div>
      </div>
    </NCarousel>

    <div
      v-else
      class="list"
      :class="{ masonry: model.layout === 'masonry', grid: model.layout === 'grid' }"
    >
      <figure v-for="(it, idx) in model.items" :key="idx" class="item">
        <img
          :src="it.src"
          :alt="it.desc"
          referrerpolicy="no-referrer"
          class="img"
          :style="imgStyle"
        >
        <figcaption v-if="it.desc" class="caption">{{ it.desc }}</figcaption>
      </figure>
    </div>
  </div>
</template>

<style scoped>
.root {
  display: block;
  overflow: hidden;
}
.carousel.fixed :deep(.n-carousel__slides) {
  height: 100%;
}
.carousel.fixed :deep(.n-carousel__slide) {
  height: 100%;
}
.list.grid {
  display: grid;
  grid-template-columns: repeat(var(--vtsuru-gallery-cols), minmax(0, 1fr));
  gap: var(--vtsuru-gallery-gap);
}
.list.masonry {
  columns: var(--vtsuru-gallery-cols);
  column-gap: var(--vtsuru-gallery-gap);
}
.item {
  margin: 0;
}
.list.masonry .item {
  break-inside: avoid;
  margin-bottom: var(--vtsuru-gallery-gap);
}
.img {
  width: 100%;
  border-radius: var(--vtsuru-page-radius);
  display: block;
}
.caption {
  margin-top: 6px;
  font-size: 12px;
  opacity: 0.8;
}
.slide {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.slide.fixed {
  height: 100%;
}
.media {
  width: 100%;
}
.slide.fixed .media {
  flex: 1 1 auto;
  min-height: 0;
}
.slide.fixed .img {
  height: 100%;
}
</style>
