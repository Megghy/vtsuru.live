<script setup lang="ts">
import { NIcon } from 'naive-ui'
import { computed, nextTick, ref, watch } from 'vue'
import { MegaphoneOutline } from '@vicons/ionicons5'
import { Vue3Marquee } from 'vue3-marquee'
import { useResizeObserver } from '@vueuse/core'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  text?: string
  direction?: 'left' | 'right'
  durationSec?: number
  pauseOnHover?: boolean
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const durationSec = Number(o.durationSec)
  return {
    text: typeof o.text === 'string' ? o.text : '',
    direction: (o.direction === 'left' || o.direction === 'right') ? o.direction : 'left',
    durationSec: Number.isFinite(durationSec) ? Math.min(120, Math.max(4, durationSec)) : 18,
    pauseOnHover: typeof o.pauseOnHover === 'boolean' ? o.pauseOnHover : true,
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
  }
})

const displayText = computed(() => cfg.value.text || '公告内容未设置')
const direction = computed(() => (cfg.value.direction === 'left' ? 'normal' : 'reverse'))

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
  const hostWidth = host.clientWidth
  const contentWidth = measure.scrollWidth
  shouldAnimate.value = hostWidth > 0 && contentWidth > hostWidth + 1
}

useResizeObserver(hostRef, () => recomputeOverflow())
useResizeObserver(measureRef, () => recomputeOverflow())
watch(displayText, async () => {
  await nextTick()
  recomputeOverflow()
}, { immediate: true })
</script>

<template>
  <BlockCard :framed="cfg.framed" :backgrounded="cfg.backgrounded">
    <div class="row">
      <NIcon size="18" depth="2" class="icon">
        <MegaphoneOutline />
      </NIcon>
      <div ref="hostRef" class="marquee-host">
        <span ref="measureRef" class="text measure" aria-hidden="true">
          {{ displayText }}
        </span>
        <Vue3Marquee
          v-if="shouldAnimate"
          class="marquee"
          :direction="direction"
          :duration="cfg.durationSec"
          :pause-on-hover="cfg.pauseOnHover"
          clone
        >
          <span class="text">{{ displayText }}</span>
        </Vue3Marquee>
        <span v-else class="text">{{ displayText }}</span>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.icon {
  flex-shrink: 0;
}

.marquee-host {
  flex: 1;
  min-width: 0;
  position: relative;
}

.marquee {
  width: 100%;
}

.text {
  font-size: 15px;
  white-space: nowrap;
}

.measure {
  position: absolute;
  left: 0;
  top: 0;
  visibility: hidden;
  pointer-events: none;
  height: 0;
  overflow: hidden;
}
</style>
