<script setup lang="ts">
import { Check, ListChecks } from 'lucide-vue-next'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import { DEFAULT_CHECKLIST_STATE } from './types'
import type { ChecklistAction, ChecklistItem, ChecklistState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const { state } = useObsBridge<ChecklistState, ChecklistAction>({
  componentId: 'checklist',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_CHECKLIST_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const totalCount = computed(() => state.value.items.length)
const doneCount = computed(() => state.value.items.filter((item) => item.status === 'done').length)
const progressRatio = computed(() => (totalCount.value > 0 ? doneCount.value / totalCount.value : 0))

const filteredItems = computed<ChecklistItem[]>(() => {
  if (state.value.hideCompleted) {
    return state.value.items.filter((item) => item.status !== 'done')
  }
  return state.value.items
})

/**
 * 智能截断窗口：始终确保当前 active 项在可见范围内。
 */
const visibleItems = computed<ChecklistItem[]>(() => {
  const list = filteredItems.value
  const limit = Math.max(1, state.value.maxVisible || 6)
  if (list.length <= limit) return list

  const activeIdx = list.findIndex((item) => item.status === 'active')
  if (activeIdx < 0 || activeIdx < limit) {
    return list.slice(0, limit)
  }

  const start = Math.min(list.length - limit, Math.max(0, activeIdx - Math.floor(limit / 2)))
  return list.slice(start, start + limit)
})

const hiddenOverflowCount = computed(() => Math.max(0, filteredItems.value.length - visibleItems.value.length))
</script>

<template>
  <div
    class="chk-root"
    :class="[`theme-${state.theme}`, { 'is-inline': props.inlineMode, 'is-no-shadow': props.noShadow }]"
    :style="{ '--chk-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <div class="chk-card">
      <!-- 顶部标题与进度 -->
      <div class="chk-header">
        <div class="chk-header-left">
          <div
            v-if="state.subtitle"
            class="chk-subtitle"
          >
            {{ state.subtitle }}
          </div>
          <div class="chk-title-row">
            <ListChecks class="chk-title-icon" />
            <span class="chk-title">{{ state.title || '今日清单' }}</span>
          </div>
        </div>

        <div class="chk-counter tabular-nums">
          <span class="chk-counter-done">{{ doneCount }}</span>
          <span class="chk-counter-sep">/</span>
          <span class="chk-counter-total">{{ totalCount }}</span>
        </div>
      </div>

      <!-- 细进度条 -->
      <div
        v-if="state.showProgress"
        class="chk-progress-track"
      >
        <div
          class="chk-progress-fill"
          :style="{ transform: `scaleX(${progressRatio})` }"
        />
      </div>

      <!-- 清单列表 -->
      <TransitionGroup
        v-if="visibleItems.length > 0"
        name="chk-item"
        tag="ul"
        class="chk-list"
      >
        <li
          v-for="item in visibleItems"
          :key="item.id"
          class="chk-item"
          :class="`status-${item.status}`"
        >
          <span
            v-if="item.status === 'active'"
            class="chk-active-bar"
            aria-hidden="true"
          />

          <span
            class="chk-indicator"
            :class="`indicator-${item.status}`"
            aria-hidden="true"
          >
            <Check
              v-if="item.status === 'done'"
              class="size-3"
            />
            <span
              v-else-if="item.status === 'active'"
              class="chk-pulse-dot"
            />
          </span>

          <span class="chk-item-text">{{ item.text }}</span>

          <span
            v-if="item.status === 'active'"
            class="chk-live-tag"
          >
            进行中
          </span>
        </li>
      </TransitionGroup>

      <div
        v-else
        class="chk-empty"
      >
        {{ totalCount > 0 && state.hideCompleted ? '全部事项已完成' : '暂无待办事项' }}
      </div>

      <div
        v-if="hiddenOverflowCount > 0"
        class="chk-overflow"
      >
        还有 {{ hiddenOverflowCount }} 项未展开
      </div>
    </div>
  </div>
</template>

<style scoped>
.chk-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  user-select: none;
}

.chk-card {
  width: 100%;
  max-width: 360px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

/* 4 套主题 */
.theme-card .chk-card {
  background: rgba(16, 18, 24, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  color: #f8fafc;
}

.theme-minimal .chk-card {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 14px;
  color: #ffffff;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.92);
}

.theme-neon .chk-card {
  background: rgba(9, 10, 18, 0.94);
  border: 1px solid var(--chk-accent);
  border-radius: 14px;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--chk-accent) 42%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--chk-accent) 12%, transparent);
  color: #ffffff;
}

.theme-glass .chk-card {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 18px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  color: #ffffff;
}

.is-no-shadow .chk-card {
  box-shadow: none !important;
}

/* 头部 */
.chk-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
}

.chk-header-left {
  min-width: 0;
  flex: 1;
}

.chk-subtitle {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--chk-accent);
  margin-bottom: 2px;
}

.chk-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chk-title-icon {
  width: 16px;
  height: 16px;
  color: var(--chk-accent);
  flex-shrink: 0;
}

.chk-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chk-counter {
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 2px 9px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.09);
  border: 1px solid rgba(255, 255, 255, 0.14);
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}

.chk-counter-done {
  color: var(--chk-accent);
}

.chk-counter-sep {
  opacity: 0.45;
}

.chk-counter-total {
  opacity: 0.78;
}

/* 进度条 */
.chk-progress-track {
  width: 100%;
  height: 4px;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.chk-progress-fill {
  width: 100%;
  height: 100%;
  border-radius: 9999px;
  background: var(--chk-accent);
  transform-origin: left;
  transition: transform 200ms cubic-bezier(0.22, 1, 0.36, 1);
}

/* 清单列表 */
.chk-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chk-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.07);
  overflow: hidden;
  transition:
    opacity 180ms ease,
    transform 180ms ease,
    background-color 180ms ease,
    border-color 180ms ease;
}

.theme-minimal .chk-item {
  background: rgba(0, 0, 0, 0.28);
  border-color: rgba(255, 255, 255, 0.12);
}

.chk-item.status-active {
  background: color-mix(in srgb, var(--chk-accent) 18%, rgba(255, 255, 255, 0.06));
  border-color: color-mix(in srgb, var(--chk-accent) 55%, transparent);
  transform: translateX(2px);
}

.chk-item.status-done {
  opacity: 0.48;
  background: rgba(255, 255, 255, 0.02);
  border-color: rgba(255, 255, 255, 0.05);
}

.chk-active-bar {
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--chk-accent);
  box-shadow: 0 0 10px var(--chk-accent);
}

.chk-indicator {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.indicator-pending {
  border: 1.5px solid rgba(255, 255, 255, 0.35);
}

.indicator-active {
  border: 1.5px solid var(--chk-accent);
  background: color-mix(in srgb, var(--chk-accent) 22%, transparent);
}

.indicator-done {
  background: var(--chk-accent);
  color: #0b1120;
}

.chk-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--chk-accent);
  animation: chk-pulse 1.4s ease-in-out infinite;
}

.chk-item-text {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  word-break: break-word;
}

.chk-item.status-active .chk-item-text {
  font-weight: 700;
  color: #ffffff;
}

.chk-item.status-done .chk-item-text {
  text-decoration: line-through;
}

.chk-live-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--chk-accent) 28%, transparent);
  color: #ffffff;
  flex-shrink: 0;
}

.chk-empty {
  text-align: center;
  padding: 18px 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.chk-overflow {
  text-align: center;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
}

@keyframes chk-pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.45;
    transform: scale(0.75);
  }
}

.chk-item-enter-active,
.chk-item-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.chk-item-enter-from,
.chk-item-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
