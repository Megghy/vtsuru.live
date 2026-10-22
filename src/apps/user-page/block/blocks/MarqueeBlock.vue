<script setup lang="ts">
import { MegaphoneOutline } from '@vicons/ionicons5'
import { useResizeObserver } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'
import { Vue3Marquee } from 'vue3-marquee'

import BlockCard from '../BlockCard.vue'

type ScrollDirection = 'left' | 'right' | 'up' | 'down'

interface BlockConfig {
  text?: string
  direction?: ScrollDirection
  durationSec?: number
  pauseOnHover?: boolean
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  const durationSec = Number(o.durationSec)
  return {
    text: typeof o.text === 'string' ? o.text : '',
    direction: (['left', 'right', 'up', 'down'] as const).includes(o.direction) ? o.direction : 'left',
    durationSec: Number.isFinite(durationSec) ? Math.min(120, Math.max(4, durationSec)) : 18,
    pauseOnHover: typeof o.pauseOnHover === 'boolean' ? o.pauseOnHover : true,
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
  }
})

const displayText = computed(() => cfg.value.text || '公告内容未设置')
const vertical = computed(() => cfg.value.direction === 'up' || cfg.value.direction === 'down')
const animationDirection = computed(() =>
  cfg.value.direction === 'left' || cfg.value.direction === 'up' ? 'normal' : 'reverse',
)

const hostRef = ref<HTMLElement | null>(null)
const measureRef = ref<HTMLElement | null>(null)
const shouldAnimate = ref(false)

function recomputeOverflow() {
  const host = hostRef.value
  const measure = measureRef.value
  if (!host || !measure) {
    shouldAnimate.value = false
    return
  }
  const viewportSize = vertical.value ? host.clientHeight : host.clientWidth
  const contentSize = vertical.value ? measure.scrollHeight : measure.scrollWidth
  shouldAnimate.value = viewportSize > 0 && contentSize > viewportSize + 1
}

useResizeObserver(hostRef, () => recomputeOverflow())
useResizeObserver(measureRef, () => recomputeOverflow())
watch(
  [displayText, vertical],
  async () => {
    await nextTick()
    recomputeOverflow()
  },
  { immediate: true },
)
</script>

<template>
  <BlockCard
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <div
      class="flex items-center gap-2.5 text-card-foreground"
      :class="{
        '-my-1 -mx-2 px-2 py-1 rounded-[var(--radius)] bg-card/62 backdrop-blur-sm': !cfg.backgrounded,
      }"
    >
      <component
        :is="MegaphoneOutline"
        class="shrink-0 text-muted-foreground size-4.5"
      />
      <div
        ref="hostRef"
        class="flex-1 min-w-0 relative overflow-hidden"
        :class="{ 'h-6': vertical }"
      >
        <span
          ref="measureRef"
          class="absolute left-0 top-0 invisible pointer-events-none block text-[15px] leading-6"
          :class="vertical ? 'w-full break-words whitespace-normal' : 'w-max whitespace-nowrap'"
          aria-hidden="true"
        >
          {{ displayText }}
        </span>
        <Vue3Marquee
          v-if="shouldAnimate"
          :key="`${cfg.direction}:${displayText}`"
          class="w-full"
          :vertical="vertical"
          :direction="animationDirection"
          :duration="cfg.durationSec"
          :pause-on-hover="cfg.pauseOnHover"
          :style="vertical ? { width: '100%', height: '100%' } : undefined"
          clone
        >
          <span
            class="block text-[15px] leading-6"
            :class="vertical ? 'w-full break-words whitespace-normal' : 'whitespace-nowrap'"
            >{{ displayText }}</span
          >
        </Vue3Marquee>
        <span
          v-else
          class="block text-[15px] leading-6"
          :class="vertical ? 'w-full break-words whitespace-normal' : 'whitespace-nowrap'"
          >{{ displayText }}</span
        >
      </div>
    </div>
  </BlockCard>
</template>
