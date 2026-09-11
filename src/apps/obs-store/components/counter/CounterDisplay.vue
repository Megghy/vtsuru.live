<script setup lang="ts">
import {
  computed,
  onMounted,
  ref,
  watch,
} from 'vue'
import { useRoute } from 'vue-router'

import { useObsBridge } from '@/apps/obs-store/sync'

import { DEFAULT_COUNTER_STATE } from './types'
import type { CounterAction, CounterState } from './types'

const props = defineProps<{
  channelId?: string
  inlineMode?: boolean
}>()

const route = useRoute()
const targetChannel = computed(
  () => props.channelId || (route.query.channel as string) || 'default',
)

const { state, onAction } = useObsBridge<CounterState, CounterAction>({
  componentId: 'counter',
  channelId: targetChannel.value,
  defaultState: DEFAULT_COUNTER_STATE,
  role: 'viewer',
})

// 数字跳动动画状态
const bumpState = ref<'up' | 'down' | null>(null)
let bumpTimer: any = null

function triggerBump(direction: 'up' | 'down') {
  bumpState.value = direction
  clearTimeout(bumpTimer)
  bumpTimer = setTimeout(() => {
    bumpState.value = null
  }, 220)
}

// 监听动作广播
onMounted(() => {
  onAction((action) => {
    if (action.type === 'INCREMENT') {
      triggerBump('up')
    } else if (action.type === 'DECREMENT') {
      triggerBump('down')
    } else if (action.type === 'RESET') {
      triggerBump('down')
    }
  })
})

// 监听数值变化
watch(
  () => state.value.count,
  (newVal, oldVal) => {
    if (oldVal !== undefined && newVal !== oldVal) {
      triggerBump(newVal > oldVal ? 'up' : 'down')
    }
  },
)

const progressPercent = computed(() => {
  if (!state.value.target || state.value.target <= 0) return 0
  return Math.min(100, Math.max(0, (state.value.count / state.value.target) * 100))
})
</script>

<template>
  <div
    class="counter-obs-root"
    :class="[
      `theme-${state.theme}`,
      { 'is-inline': props.inlineMode },
    ]"
    :style="{ '--counter-accent': state.accentColor }"
  >
    <div class="counter-container">
      <!-- 头部：标题与前缀 -->
      <div
        v-if="state.title || state.prefix"
        class="counter-header"
      >
        <span
          v-if="state.prefix"
          class="counter-prefix"
        >{{ state.prefix }}</span>
        <span
          v-if="state.title"
          class="counter-title"
        >{{ state.title }}</span>
      </div>

      <!-- 主数值展示区 -->
      <div class="counter-body">
        <div
          class="counter-number-wrap"
          :class="{
            'bump-up': bumpState === 'up',
            'bump-down': bumpState === 'down',
          }"
        >
          <span class="counter-value">{{ state.count }}</span>
          <span
            v-if="state.target > 0"
            class="counter-target"
          >/ {{ state.target }}</span>
          <span
            v-if="state.suffix"
            class="counter-suffix"
          >{{ state.suffix }}</span>
        </div>
      </div>

      <!-- 目标进度条 -->
      <div
        v-if="state.showProgress && state.target > 0"
        class="counter-progress-bar"
      >
        <div
          class="counter-progress-fill"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.counter-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.counter-container {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

/* 主题 1: card (卡片微光) */
.theme-card .counter-container {
  background: rgba(18, 18, 22, 0.88);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  padding: 14px 28px;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.theme-card .counter-prefix {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--counter-accent);
  margin-right: 6px;
}

.theme-card .counter-title {
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}

.theme-card .counter-value {
  font-size: 42px;
  font-weight: 800;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

/* 主题 2: minimal (极简透明) */
.theme-minimal .counter-container {
  background: transparent;
  padding: 8px 16px;
}

.theme-minimal .counter-prefix {
  font-size: 12px;
  font-weight: 700;
  color: var(--counter-accent);
  margin-right: 6px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.theme-minimal .counter-title {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

.theme-minimal .counter-value {
  font-size: 48px;
  font-weight: 800;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 1);
  line-height: 1.1;
}

/* 主题 3: neon (霓虹发光) */
.theme-neon .counter-container {
  background: rgba(10, 10, 15, 0.95);
  border: 1px solid var(--counter-accent);
  padding: 14px 28px;
  border-radius: 8px;
  box-shadow: 0 0 16px var(--counter-accent), inset 0 0 8px rgba(0, 0, 0, 0.5);
}

.theme-neon .counter-prefix {
  font-size: 11px;
  font-weight: 700;
  color: var(--counter-accent);
  letter-spacing: 0.15em;
  margin-right: 6px;
}

.theme-neon .counter-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
}

.theme-neon .counter-value {
  font-size: 44px;
  font-weight: 900;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  text-shadow: 0 0 12px var(--counter-accent);
  line-height: 1.1;
}

/* 主题 4: glass (玻璃质感) */
.theme-glass .counter-container {
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  padding: 14px 26px;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.theme-glass .counter-prefix {
  font-size: 11px;
  font-weight: 700;
  color: var(--counter-accent);
  margin-right: 6px;
}

.theme-glass .counter-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.theme-glass .counter-value {
  font-size: 42px;
  font-weight: 800;
  color: #ffffff;
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
}

/* 通用部件 */
.counter-header {
  display: flex;
  align-items: center;
  margin-bottom: 2px;
}

.counter-body {
  display: flex;
  align-items: baseline;
}

.counter-number-wrap {
  display: inline-flex;
  align-items: baseline;
  transition: transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.counter-number-wrap.bump-up {
  transform: scale(1.15) translateY(-2px);
}

.counter-number-wrap.bump-down {
  transform: scale(0.92) translateY(2px);
}

.counter-target {
  font-size: 18px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  margin-left: 6px;
}

.counter-suffix {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin-left: 4px;
}

/* 进度条 */
.counter-progress-bar {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  margin-top: 8px;
  overflow: hidden;
}

.counter-progress-fill {
  height: 100%;
  background: var(--counter-accent);
  border-radius: 9999px;
  transition: width 0.25s ease;
}
</style>
