<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import BlockCard from '../BlockCard.vue'
import { isBlockPropertyAvailable } from '../propertyCapabilities'

type GalleryLayout = 'grid' | 'masonry' | 'carousel'
type GalleryFit = 'cover' | 'contain'
type CarouselEffect = 'slide' | 'fade' | 'card' | 'custom'
type CarouselDotType = 'dot' | 'line'
type CarouselDotPlacement = 'top' | 'bottom' | 'left' | 'right'
type CarouselTrigger = 'click' | 'hover'

interface GalleryItem {
  src: string
  desc: string
  alt: string
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const model = computed(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, unknown>)
      : {}
  const layout: GalleryLayout = o.layout === 'masonry' || o.layout === 'carousel' ? o.layout : 'grid'
  const columns = Number(o.columns)
  const gap = Number(o.gap)
  const interval = Number(o.interval)
  const rawItems = Array.isArray(o.items) ? o.items : []
  const items = rawItems.flatMap((item): GalleryItem[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const value = item as Record<string, unknown>
    const file =
      value.imageFile && typeof value.imageFile === 'object' && !Array.isArray(value.imageFile)
        ? (value.imageFile as Record<string, unknown>)
        : undefined
    const src = typeof file?.path === 'string' && file.path ? file.path : typeof value.url === 'string' ? value.url : ''
    if (!src) return []
    const desc = typeof value.desc === 'string' ? value.desc : ''
    const alt = typeof value.alt === 'string' ? value.alt : ''
    return [{ src, desc, alt }]
  })

  return {
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
    layout,
    columns:
      isBlockPropertyAvailable('imageGallery', o, 'columns') && Number.isInteger(columns)
        ? Math.min(12, Math.max(1, columns))
        : 1,
    gap:
      isBlockPropertyAvailable('imageGallery', o, 'gap') && Number.isFinite(gap) ? Math.min(80, Math.max(0, gap)) : 0,
    maxWidth: typeof o.maxWidth === 'string' ? o.maxWidth.trim() : '',
    maxHeight:
      isBlockPropertyAvailable('imageGallery', o, 'maxHeight') && typeof o.maxHeight === 'string'
        ? o.maxHeight.trim()
        : '',
    fit: (isBlockPropertyAvailable('imageGallery', o, 'fit') && o.fit === 'contain'
      ? 'contain'
      : 'cover') as GalleryFit,
    autoplay: isBlockPropertyAvailable('imageGallery', o, 'autoplay') && o.autoplay === true,
    interval:
      isBlockPropertyAvailable('imageGallery', o, 'interval') && Number.isFinite(interval)
        ? Math.min(20000, Math.max(1000, interval))
        : 5000,
    effect: (['fade', 'card', 'custom'].includes(String(o.effect)) ? o.effect : 'slide') as CarouselEffect,
    dotType: (o.dotType === 'dot' ? 'dot' : 'line') as CarouselDotType,
    dotPlacement: (['top', 'left', 'right'].includes(String(o.dotPlacement))
      ? o.dotPlacement
      : 'bottom') as CarouselDotPlacement,
    showArrow: typeof o.showArrow === 'boolean' ? o.showArrow : true,
    showDots: typeof o.showDots === 'boolean' ? o.showDots : true,
    loop: typeof o.loop === 'boolean' ? o.loop : true,
    draggable: typeof o.draggable === 'boolean' ? o.draggable : true,
    touchable: typeof o.touchable === 'boolean' ? o.touchable : true,
    trigger: (isBlockPropertyAvailable('imageGallery', o, 'trigger') && o.trigger === 'hover'
      ? 'hover'
      : 'click') as CarouselTrigger,
    items,
  }
})

const activeIndex = ref(0)
const failedSources = ref(new Set<string>())
const loadedSources = ref(new Set<string>())
const reducedMotion = ref(false)
let motionQuery: MediaQueryList | undefined

function updateMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion.value = event.matches
}

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference(motionQuery)
  motionQuery.addEventListener('change', updateMotionPreference)
})

onBeforeUnmount(() => motionQuery?.removeEventListener('change', updateMotionPreference))

function markLoaded(src: string) {
  loadedSources.value = new Set(loadedSources.value).add(src)
}

function markFailed(src: string) {
  failedSources.value = new Set(failedSources.value).add(src)
}

const containerStyle = computed(() => ({
  maxWidth: model.value.maxWidth || undefined,
  '--vtsuru-gallery-cols': String(model.value.columns),
  '--vtsuru-gallery-gap': `${model.value.gap}px`,
}))

const carouselStyle = computed(() => ({
  height: model.value.maxHeight || undefined,
  aspectRatio: model.value.maxHeight ? undefined : '16 / 9',
}))

const activeCaption = computed(() => model.value.items[activeIndex.value]?.desc ?? '')
</script>

<template>
  <BlockCard
    :framed="model.framed"
    :backgrounded="model.backgrounded"
  >
    <div
      class="gallery"
      :style="containerStyle"
    >
      <UEmpty
        v-if="model.items.length === 0"
        size="sm"
        description="暂无图片"
        class="public-empty"
      />

      <template v-else-if="model.layout === 'carousel'">
        <UCarousel
          class="public-carousel carousel"
          :style="carouselStyle"
          :items="model.items"
          :autoplay="model.autoplay && !reducedMotion ? { delay: model.interval } : false"
          :fade="model.effect === 'fade'"
          :arrows="model.showArrow"
          :dots="model.showDots"
          :loop="model.loop"
          :watch-drag="model.draggable && model.touchable"
          @select="activeIndex = $event"
        >
          <template #default="{ item, index }">
            <div class="slide">
              <div
                class="image-state"
                :class="{ hidden: loadedSources.has(item.src) && !failedSources.has(item.src) }"
                role="status"
              >
                {{ failedSources.has(item.src) ? '图片加载失败' : loadedSources.has(item.src) ? '' : '图片加载中' }}
              </div>
              <img
                :src="item.src"
                :alt="item.alt"
                :loading="index === 0 ? 'eager' : 'lazy'"
                decoding="async"
                referrerpolicy="no-referrer"
                class="image"
                :class="{ loaded: loadedSources.has(item.src), failed: failedSources.has(item.src) }"
                :style="{ objectFit: model.fit }"
                @load="markLoaded(item.src)"
                @error="markFailed(item.src)"
              />
            </div>
          </template>
        </UCarousel>
        <p
          v-if="activeCaption"
          class="carousel-caption"
        >
          {{ activeCaption }}
        </p>
      </template>

      <div
        v-else
        class="list"
        :class="model.layout"
      >
        <figure
          v-for="(item, index) in model.items"
          :key="`${item.src}-${index}`"
          class="item"
        >
          <div
            class="media"
            :class="{ masonry: model.layout === 'masonry' }"
          >
            <div
              class="image-state"
              :class="{ hidden: loadedSources.has(item.src) && !failedSources.has(item.src) }"
              role="status"
            >
              {{ failedSources.has(item.src) ? '图片加载失败' : loadedSources.has(item.src) ? '' : '图片加载中' }}
            </div>
            <img
              :src="item.src"
              :alt="item.alt"
              :loading="index === 0 ? 'eager' : 'lazy'"
              decoding="async"
              referrerpolicy="no-referrer"
              class="image"
              :class="{ loaded: loadedSources.has(item.src), failed: failedSources.has(item.src) }"
              :style="{ objectFit: model.fit, maxHeight: model.maxHeight || undefined }"
              @load="markLoaded(item.src)"
              @error="markFailed(item.src)"
            />
          </div>
          <figcaption
            v-if="item.desc"
            class="caption"
          >
            {{ item.desc }}
          </figcaption>
        </figure>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.gallery {
  container-type: inline-size;
  width: 100%;
}
.carousel {
  width: 100%;
  min-height: 180px;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
}
.slide {
  position: relative;
  width: 100%;
  height: 100%;
  background: var(--vtsuru-bg-muted);
}
.image {
  display: block;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 180ms ease;
}
.image.loaded {
  opacity: 1;
}
.image.failed {
  visibility: hidden;
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
  min-width: 0;
  margin: 0;
}
.list.masonry .item {
  break-inside: avoid;
  margin-bottom: var(--vtsuru-gallery-gap);
}
.media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  border-radius: var(--vtsuru-page-radius);
  background: var(--vtsuru-bg-muted);
}
.media.masonry {
  aspect-ratio: auto;
  min-height: 120px;
}
.media.masonry .image {
  height: auto;
  min-height: 120px;
}
.image-state {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: grid;
  place-items: center;
  min-height: 120px;
  padding: 16px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  font-size: 13px;
  text-align: center;
}
.image-state.hidden {
  visibility: hidden;
}
.caption,
.carousel-caption {
  margin: 8px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  overflow-wrap: anywhere;
}
.carousel-caption {
  min-height: 20px;
  padding-inline: 8px;
}
.carousel :deep(button) {
  color: var(--vtsuru-fg);
  background: var(--vtsuru-bg-elevated);
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
}
.carousel :deep(button:focus-visible) {
  outline: 2px solid var(--vtsuru-page-primary, var(--vtsuru-brand));
  outline-offset: 2px;
}

@container (max-width: 640px) {
  .list.grid {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 140px), 1fr));
  }
  .list.masonry {
    columns: min(var(--vtsuru-gallery-cols), 2);
  }
  .carousel {
    min-height: 160px;
  }
}

@container (max-width: 380px) {
  .list.masonry {
    columns: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .image {
    transition: none;
  }
}
</style>
