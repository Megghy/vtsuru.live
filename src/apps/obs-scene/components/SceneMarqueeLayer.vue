<script setup lang="ts">
import { useElementSize } from '@vueuse/core'
import { computed, ref } from 'vue'

import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import type { MarqueeLayer } from '../types'

const props = defineProps<{
  layer: MarqueeLayer
  mode: 'edit' | 'preview' | 'live'
}>()

const mq = computed(() => props.layer.marquee)
useGoogleFont(computed(() => (mq.value.mode === 'text' ? mq.value.fontFamily : undefined)))
const isVertical = computed(() => mq.value.direction === 'up' || mq.value.direction === 'down')
const isReverse = computed(() => mq.value.direction === 'right' || mq.value.direction === 'down')

const trackItemRef = ref<HTMLElement | null>(null)
const { width: trackW, height: trackH } = useElementSize(trackItemRef)

const textEntries = computed(() => {
  const list = mq.value.items.map((item) => item.trim()).filter(Boolean)
  return list.length > 0 ? list : ['欢迎来到直播间，在右侧编辑走马灯文字内容']
})

const validImages = computed(() => mq.value.images.filter((img) => Boolean(img.url?.trim())))

const durationSec = computed(() => {
  const speed = Math.max(10, Math.min(600, mq.value.speed || 80))
  const span = isVertical.value
    ? Math.max(120, trackH.value || props.layer.height)
    : Math.max(200, trackW.value || props.layer.width)
  return Number((span / speed).toFixed(2))
})

const containerStyle = computed(() => ({
  backgroundColor: mq.value.backgroundColor || 'transparent',
  padding: `${mq.value.padding ?? 0}px`,
}))

const textStyle = computed(() => ({
  fontFamily: resolveFontFamilyCss(mq.value.fontFamily) || 'system-ui, -apple-system, sans-serif',
  fontSize: `${mq.value.fontSize || 28}px`,
  fontWeight: mq.value.fontWeight || 700,
  color: mq.value.color || '#ffffff',
  textShadow: props.layer.disableShadow ? 'none' : mq.value.shadow || undefined,
  WebkitTextStroke: mq.value.strokeWidth > 0 ? `${mq.value.strokeWidth}px ${mq.value.strokeColor}` : undefined,
}))

const trackStyle = computed(() => ({
  animationDuration: `${durationSec.value}s`,
  animationDirection: isReverse.value ? ('reverse' as const) : ('normal' as const),
}))

const groupStyle = computed(() => ({
  gap: `${Math.max(8, mq.value.gap ?? 32)}px`,
  paddingRight: isVertical.value ? '0px' : `${Math.max(8, mq.value.gap ?? 32)}px`,
  paddingBottom: isVertical.value ? `${Math.max(8, mq.value.gap ?? 32)}px` : '0px',
}))
</script>

<template>
  <div
    class="obs-marquee-root w-full h-full overflow-hidden relative flex"
    :class="isVertical ? 'flex-col justify-start items-stretch' : 'flex-row items-center'"
    :style="containerStyle"
  >
    <!-- 图片模式空占位 -->
    <div
      v-if="mq.mode === 'image' && validImages.length === 0"
      class="w-full h-full flex-center bg-muted/40 border border-dashed border-border text-muted-foreground text-sm px-4 text-center"
    >
      图片走马灯：请在右侧上传或添加滚动图片
    </div>

    <!-- 双轨无缝 GPU 滚动 -->
    <div
      v-else
      class="obs-marquee-track"
      :class="isVertical ? 'is-vertical' : 'is-horizontal'"
      :style="trackStyle"
    >
      <div
        v-for="copyIdx in 2"
        :key="copyIdx"
        :ref="copyIdx === 1 ? (el) => (trackItemRef = el as HTMLElement | null) : undefined"
        class="obs-marquee-group"
        :class="isVertical ? 'flex-col items-center' : 'flex-row items-center'"
        :style="groupStyle"
      >
        <template v-if="mq.mode === 'text'">
          <template v-for="(entry, idx) in textEntries" :key="`${copyIdx}-${idx}`">
            <span class="whitespace-nowrap leading-none select-none" :style="textStyle">
              {{ entry }}
            </span>
            <span
              v-if="mq.separator && !isVertical"
              class="whitespace-nowrap opacity-65 select-none leading-none"
              :style="textStyle"
            >
              {{ mq.separator }}
            </span>
          </template>
        </template>

        <template v-else>
          <img
            v-for="img in validImages"
            :key="`${copyIdx}-${img.id}`"
            :src="img.url"
            :alt="img.label || 'marquee-item'"
            draggable="false"
            class="block shrink-0 object-contain"
            :style="{
              height: `${Math.max(24, mq.imageHeight || 120)}px`,
              width: 'auto',
              borderRadius: `${Math.max(0, mq.imageRadius || 0)}px`,
            }"
          />
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.obs-marquee-track {
  display: flex;
  flex-shrink: 0;
  will-change: transform;
}

.obs-marquee-track.is-horizontal {
  flex-direction: row;
  align-items: center;
  width: max-content;
  animation-name: obs-marquee-x;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.obs-marquee-track.is-vertical {
  flex-direction: column;
  align-items: stretch;
  height: max-content;
  width: 100%;
  animation-name: obs-marquee-y;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}

.obs-marquee-group {
  display: flex;
  flex-shrink: 0;
}

@keyframes obs-marquee-x {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(-50%, 0, 0);
  }
}

@keyframes obs-marquee-y {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(0, -50%, 0);
  }
}
</style>
