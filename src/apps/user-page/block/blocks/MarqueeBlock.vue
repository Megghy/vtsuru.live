<script setup lang="ts">
import { MegaphoneOutline } from '@vicons/ionicons5'
import { useResizeObserver } from '@vueuse/core'
import { NIcon } from 'naive-ui'
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
      class="row"
      :class="{ 'row--bare': !cfg.backgrounded }"
    >
      <NIcon
        size="18"
        depth="2"
        class="icon"
      >
        <MegaphoneOutline />
      </NIcon>
      <div
        ref="hostRef"
        class="marquee-host"
        :class="{ 'marquee-host--vertical': vertical }"
      >
        <span
          ref="measureRef"
          class="text measure"
          :class="{ 'text--vertical': vertical }"
          aria-hidden="true"
        >
          {{ displayText }}
        </span>
        <Vue3Marquee
          v-if="shouldAnimate"
          :key="`${cfg.direction}:${displayText}`"
          class="marquee"
          :vertical="vertical"
          :direction="animationDirection"
          :duration="cfg.durationSec"
          :pause-on-hover="cfg.pauseOnHover"
          :style="vertical ? { width: '100%', height: '100%' } : undefined"
          clone
        >
          <span
            class="text"
            :class="{ 'text--vertical': vertical }"
            >{{ displayText }}</span
          >
        </Vue3Marquee>
        <span
          v-else
          class="text"
          :class="{ 'text--vertical': vertical }"
          >{{ displayText }}</span
        >
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.row {
  --marquee-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --marquee-fg-muted: var(
    --vtsuru-block-fg-muted,
    var(--vtsuru-surface-fg-muted, var(--vtsuru-page-text-muted, var(--vtsuru-fg-muted)))
  );
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--marquee-fg);
}

.row--bare {
  --marquee-fg: var(--vtsuru-surface-fg, var(--vtsuru-block-fg));
  --marquee-fg-muted: var(--vtsuru-surface-fg-muted, var(--vtsuru-block-fg-muted));
  --marquee-surface: color-mix(
    in srgb,
    var(--vtsuru-page-content-color, var(--user-page-ui-surface-bg)) 62%,
    transparent
  );
  margin: -4px -8px;
  padding: 4px 8px;
  border-radius: var(--vtsuru-page-radius);
  background: var(--marquee-surface);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.icon {
  flex-shrink: 0;
  color: var(--marquee-fg-muted);
}

.marquee-host {
  flex: 1;
  min-width: 0;
  position: relative;
  overflow: hidden;
}

.marquee-host--vertical {
  height: 24px;
}

.marquee {
  width: 100%;
}

.text {
  display: block;
  font-size: 15px;
  line-height: 24px;
  white-space: nowrap;
}

.text--vertical {
  width: 100%;
  overflow-wrap: anywhere;
  white-space: normal;
}

.measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  width: max-content;
}

.measure.text--vertical {
  width: 100%;
}
</style>
