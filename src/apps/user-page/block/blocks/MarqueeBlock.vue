<script setup lang="ts">
import { NCard, NText } from 'naive-ui'
import { computed } from 'vue'

interface BlockConfig {
  text?: string
  direction?: 'left' | 'right'
  durationSec?: number
  pauseOnHover?: boolean
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
  }
})
</script>

<template>
  <NCard size="small">
    <div
      class="marquee"
      :class="{ hoverPause: cfg.pauseOnHover }"
      :style="{
        '--duration': `${cfg.durationSec}s`,
        '--dir': cfg.direction === 'left' ? '-1' : '1',
      }"
    >
      <div class="track">
        <NText class="text">
          {{ cfg.text || '公告内容未设置' }}
        </NText>
        <span class="gap" />
        <NText class="text">
          {{ cfg.text || '公告内容未设置' }}
        </NText>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.marquee {
  position: relative;
  overflow: hidden;
  border-radius: var(--vtsuru-page-radius);
  border: 1px solid var(--n-border-color);
  padding: 10px 0;
  background: rgba(255, 255, 255, 0.04);
}
.track {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
  will-change: transform;
  animation: marquee var(--duration) linear infinite;
}
.text {
  font-weight: 700;
  padding: 0 14px;
}
.gap {
  width: 40px;
}
.hoverPause:hover .track {
  animation-play-state: paused;
}
@keyframes marquee {
  from { transform: translateX(0); }
  to { transform: translateX(calc(var(--dir) * 50%)); }
}
</style>
