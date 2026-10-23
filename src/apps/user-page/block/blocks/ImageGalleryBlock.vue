<script setup lang="ts">
import { ChevronBackOutline, ChevronForwardOutline } from '@vicons/ionicons5'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import { Empty } from '@/shared/ui/empty'

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
let autoplayTimer: number | undefined

function updateMotionPreference(event: MediaQueryListEvent | MediaQueryList) {
  reducedMotion.value = event.matches
}

function nextSlide() {
  if (model.value.items.length <= 1) return
  if (activeIndex.value < model.value.items.length - 1) {
    activeIndex.value++
  } else if (model.value.loop) {
    activeIndex.value = 0
  }
}

function prevSlide() {
  if (model.value.items.length <= 1) return
  if (activeIndex.value > 0) {
    activeIndex.value--
  } else if (model.value.loop) {
    activeIndex.value = model.value.items.length - 1
  }
}

function goToSlide(index: number) {
  activeIndex.value = index
  resetAutoplay()
}

function startAutoplay() {
  stopAutoplay()
  if (model.value.autoplay && !reducedMotion.value && model.value.items.length > 1) {
    autoplayTimer = window.setInterval(() => {
      nextSlide()
    }, model.value.interval)
  }
}

function stopAutoplay() {
  if (autoplayTimer !== undefined) {
    window.clearInterval(autoplayTimer)
    autoplayTimer = undefined
  }
}

function resetAutoplay() {
  stopAutoplay()
  startAutoplay()
}

watch(
  () => [model.value.autoplay, model.value.interval, model.value.items.length, reducedMotion.value],
  () => {
    startAutoplay()
  },
)

onMounted(() => {
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  updateMotionPreference(motionQuery)
  motionQuery.addEventListener('change', updateMotionPreference)
  startAutoplay()
})

onBeforeUnmount(() => {
  motionQuery?.removeEventListener('change', updateMotionPreference)
  stopAutoplay()
})

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
      class="@container w-full"
      :style="containerStyle"
    >
      <Empty
        v-if="model.items.length === 0"
        description="暂无图片"
        class="py-4 text-xs"
      />

      <template v-else-if="model.layout === 'carousel'">
        <div
          class="relative w-full overflow-hidden rounded-[var(--radius)] bg-muted/40 group select-none"
          :style="carouselStyle"
          @mouseenter="stopAutoplay"
          @mouseleave="startAutoplay"
        >
          <div
            v-for="(item, index) in model.items"
            :key="`${item.src}-${index}`"
            class="absolute inset-0 transition-opacity duration-300 ease-in-out"
            :class="{
              'opacity-100 z-10': activeIndex === index,
              'opacity-0 z-0 pointer-events-none': activeIndex !== index,
            }"
          >
            <div
              class="absolute inset-0 z-[1] grid place-items-center min-h-[120px] p-4 text-muted-foreground bg-muted text-[13px] text-center"
              :class="{ invisible: loadedSources.has(item.src) && !failedSources.has(item.src) }"
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
              class="block size-full motion-reduce:transition-none transition-opacity duration-180"
              :class="
                failedSources.has(item.src) ? 'invisible' : loadedSources.has(item.src) ? 'opacity-100' : 'opacity-0'
              "
              :style="{ objectFit: model.fit }"
              @load="markLoaded(item.src)"
              @error="markFailed(item.src)"
            />
          </div>

          <!-- Arrows -->
          <template v-if="model.showArrow && model.items.length > 1">
            <button
              type="button"
              class="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition shadow-sm"
              aria-label="上一张"
              @click.stop="prevSlide"
            >
              <component
                :is="ChevronBackOutline"
                class="size-4"
              />
            </button>
            <button
              type="button"
              class="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 size-8 rounded-full bg-background/80 hover:bg-background border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition shadow-sm"
              aria-label="下一张"
              @click.stop="nextSlide"
            >
              <component
                :is="ChevronForwardOutline"
                class="size-4"
              />
            </button>
          </template>

          <!-- Dots -->
          <div
            v-if="model.showDots && model.items.length > 1"
            class="absolute z-20 flex gap-1.5 p-2"
            :class="{
              'bottom-1.5 left-1/2 -translate-x-1/2 flex-row': model.dotPlacement === 'bottom',
              'top-1.5 left-1/2 -translate-x-1/2 flex-row': model.dotPlacement === 'top',
              'left-1.5 top-1/2 -translate-y-1/2 flex-col': model.dotPlacement === 'left',
              'right-1.5 top-1/2 -translate-y-1/2 flex-col': model.dotPlacement === 'right',
            }"
          >
            <button
              v-for="(_, idx) in model.items"
              :key="idx"
              type="button"
              class="transition-all duration-200"
              :class="[
                model.dotType === 'line'
                  ? 'h-1 rounded-full ' + (activeIndex === idx ? 'w-5 bg-white' : 'w-2.5 bg-white/50')
                  : 'size-2 rounded-full ' + (activeIndex === idx ? 'bg-white scale-125' : 'bg-white/50'),
              ]"
              :aria-label="`切换到第 ${idx + 1} 张图片`"
              @click.stop="goToSlide(idx)"
              @mouseenter="model.trigger === 'hover' && goToSlide(idx)"
            />
          </div>
        </div>
        <p
          v-if="activeCaption"
          class="mt-2 min-h-5 px-2 text-muted-foreground text-[13px] leading-normal text-center break-words"
        >
          {{ activeCaption }}
        </p>
      </template>

      <div
        v-else
        :class="
          model.layout === 'masonry'
            ? 'gallery-masonry'
            : 'grid grid-cols-[repeat(var(--vtsuru-gallery-cols),minmax(0,1fr))] gap-[var(--vtsuru-gallery-gap)] @max-[640px]:grid-cols-[repeat(auto-fit,minmax(min(100%,140px),1fr))]'
        "
      >
        <figure
          v-for="(item, index) in model.items"
          :key="`${item.src}-${index}`"
          class="min-w-0 m-0"
          :class="model.layout === 'masonry' ? 'gallery-masonry-item' : ''"
        >
          <div
            class="relative overflow-hidden border border-border rounded-[var(--radius)] bg-muted"
            :class="model.layout === 'masonry' ? 'aspect-auto min-h-[120px]' : 'aspect-[4/3]'"
          >
            <div
              class="absolute inset-0 z-[1] grid place-items-center min-h-[120px] p-4 text-muted-foreground bg-muted text-[13px] text-center"
              :class="{ invisible: loadedSources.has(item.src) && !failedSources.has(item.src) }"
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
              class="block w-full motion-reduce:transition-none transition-opacity duration-180"
              :class="[
                failedSources.has(item.src) ? 'invisible' : loadedSources.has(item.src) ? 'opacity-100' : 'opacity-0',
                model.layout === 'masonry' ? 'h-auto min-h-[120px]' : 'h-full',
              ]"
              :style="{ objectFit: model.fit, maxHeight: model.maxHeight || undefined }"
              @load="markLoaded(item.src)"
              @error="markFailed(item.src)"
            />
          </div>
          <figcaption
            v-if="item.desc"
            class="mt-2 text-muted-foreground text-[13px] leading-normal text-center break-words"
          >
            {{ item.desc }}
          </figcaption>
        </figure>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.gallery-masonry {
  columns: var(--vtsuru-gallery-cols);
  column-gap: var(--vtsuru-gallery-gap);
}
.gallery-masonry-item {
  break-inside: avoid;
  margin-bottom: var(--vtsuru-gallery-gap);
}
@container (max-width: 640px) {
  .gallery-masonry {
    columns: min(var(--vtsuru-gallery-cols), 2);
  }
}
@container (max-width: 380px) {
  .gallery-masonry {
    columns: 1;
  }
}
</style>
