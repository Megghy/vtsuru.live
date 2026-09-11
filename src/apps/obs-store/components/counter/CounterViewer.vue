<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  Add24Regular,
  ArrowCounterclockwise24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Open24Regular,
  Subtract24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NCard,
  NColorPicker,
  NDivider,
  NFlex,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from 'vue'

import { useObsBridge } from '@/apps/obs-store/sync'

import CounterDisplay from './CounterDisplay.vue'
import { DEFAULT_COUNTER_STATE } from './types'
import type { CounterAction, CounterState, CounterTheme } from './types'

const message = useMessage()
const { copy, isSupported: isCopySupported } = useClipboard()

const channelId = ref<string>('default')
const copied = ref(false)

const {
  state,
  updateState,
  sendAction,
  currentHash,
  isSyncing,
  lastSyncError,
} = useObsBridge<CounterState, CounterAction>({
  componentId: 'counter',
  channelId: channelId.value,
  defaultState: DEFAULT_COUNTER_STATE,
  role: 'controller',
})

// 主题选项
const themeOptions = [
  { label: '悬浮卡片 (Card)', value: 'card' as CounterTheme },
  { label: '极简透明 (Minimal)', value: 'minimal' as CounterTheme },
  { label: '赛博霓虹 (Neon)', value: 'neon' as CounterTheme },
  { label: '玻璃拟态 (Glass)', value: 'glass' as CounterTheme },
]

// 预览背景切换
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

// OBS URL 计算
const obsRelativeUrl = computed(() => {
  const p = new URLSearchParams()
  if (channelId.value && channelId.value !== 'default') {
    p.set('channel', channelId.value)
  }
  const queryStr = p.toString()
  return `/obs-store/counter${queryStr ? `?${queryStr}` : ''}`
})

const obsAbsoluteUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${obsRelativeUrl.value}`
  }
  return obsRelativeUrl.value
})

function handleIncrement(amount = 1) {
  const newCount = state.value.count + amount
  updateState({ count: newCount })
  sendAction({ type: 'INCREMENT', amount })
}

function handleDecrement(amount = 1) {
  const newCount = Math.max(0, state.value.count - amount)
  updateState({ count: newCount })
  sendAction({ type: 'DECREMENT', amount })
}

function handleReset() {
  updateState({ count: 0 })
  sendAction({ type: 'RESET' })
}

async function copyObsUrl() {
  if (!isCopySupported) {
    message.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    message.success('OBS 浏览器源链接已复制到剪贴板！')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    message.error('复制失败，请手动复制')
  }
}

// 弹出独立控制小窗
function openPopoutWindow() {
  if (typeof window === 'undefined') return
  const url = `/obs-store/counter-manage`
  window.open(
    url,
    'VtsuruCounterPopout',
    'width=420,height=600,menubar=no,toolbar=no,location=no,status=no',
  )
}

// 快捷键支持（当未处于 input 输入框时按 +/=/- 直接增减）
function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
    return
  }

  if (e.key === '+' || e.key === '=' || e.key === ' ') {
    e.preventDefault()
    handleIncrement(1)
  } else if (e.key === '-' || e.key === '_') {
    e.preventDefault()
    handleDecrement(1)
  }
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown)
  }
})
</script>

<template>
  <div class="counter-viewer-page">
    <NCard
      size="small"
      class="counter-viewer-card"
    >
      <!-- 头部栏 -->
      <NFlex
        justify="space-between"
        align="center"
        class="card-header-row"
      >
        <div>
          <NFlex
            align="center"
            :size="8"
          >
            <span class="card-header-title">挑战与直播计数器</span>
            <span class="version-tag">v1.0</span>
          </NFlex>
          <div class="sync-meta-text">
            <span
              class="sync-indicator-dot"
              :class="{ syncing: isSyncing, error: lastSyncError }"
            />
            <span v-if="lastSyncError">同步连接异常，重试中...</span>
            <span v-else-if="isSyncing">正在同步状态...</span>
            <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
            <span v-else>就绪</span>
          </div>
        </div>

        <NSpace size="small">
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                size="small"
                secondary
                @click="openPopoutWindow"
              >
                <template #icon>
                  <NIcon :component="Open24Regular" />
                </template>
                独立小窗
              </NButton>
            </template>
            弹出一个紧凑独立的悬浮控制窗口，方便拖拽至副屏或 OBS 旁边
          </NTooltip>

          <NButton
            type="primary"
            size="small"
            @click="copyObsUrl"
          >
            <template #icon>
              <NIcon :component="copied ? Checkmark24Regular : Copy24Regular" />
            </template>
            复制 OBS 源链接
          </NButton>
        </NSpace>
      </NFlex>

      <NDivider style="margin: 10px 0" />

      <!-- 主控制台与实时预览 -->
      <NGrid
        cols="1 m:2"
        responsive="screen"
        :x-gap="14"
        :y-gap="14"
      >
        <!-- 左侧：快速操作盘 -->
        <NGridItem>
          <div class="operator-deck-box">
            <div class="deck-header-row">
              <span class="deck-label">实时操作盘</span>
              <span class="keyboard-tip">支持快捷键: [Space] / [+] 加一, [-] 减一</span>
            </div>

            <!-- 当前数值大字呈现 -->
            <div class="count-hero-block">
              <span class="hero-tag">{{ state.prefix || 'DEATHS' }}</span>
              <div class="hero-num-wrap">
                <span class="hero-number">{{ state.count }}</span>
                <span
                  v-if="state.target > 0"
                  class="hero-target-denom"
                >/ {{ state.target }}</span>
              </div>
            </div>

            <!-- 核心加减控制按钮群 -->
            <div class="action-button-grid">
              <button
                type="button"
                class="btn-action btn-main-plus"
                @click="handleIncrement(1)"
              >
                <NIcon
                  :component="Add24Regular"
                  class="btn-icon"
                />
                <span class="btn-text">+1 次</span>
              </button>

              <button
                type="button"
                class="btn-action btn-step-plus"
                @click="handleIncrement(5)"
              >
                +5
              </button>

              <button
                type="button"
                class="btn-action btn-minus"
                :disabled="state.count <= 0"
                @click="handleDecrement(1)"
              >
                <NIcon
                  :component="Subtract24Regular"
                  class="btn-icon"
                />
                <span class="btn-text">-1</span>
              </button>

              <button
                type="button"
                class="btn-action btn-reset"
                @click="handleReset"
              >
                <NIcon
                  :component="ArrowCounterclockwise24Regular"
                  class="btn-icon"
                />
                <span class="btn-text">归零</span>
              </button>
            </div>

            <!-- 直接设定数值 -->
            <NFlex
              align="center"
              :size="8"
              style="margin-top: 12px"
            >
              <NText
                depth="3"
                style="font-size: 12px"
              >
                直接设值:
              </NText>
              <NInputNumber
                :value="state.count"
                :min="0"
                size="small"
                style="width: 110px"
                @update:value="updateState({ count: $event || 0 })"
              />
            </NFlex>
          </div>
        </NGridItem>

        <!-- 右侧：实时 OBS 监视器 -->
        <NGridItem>
          <div class="monitor-panel-box">
            <NFlex
              justify="space-between"
              align="center"
              style="margin-bottom: 8px"
            >
              <span class="deck-label">OBS 画面实时监视器</span>
              <NSpace :size="6">
                <NButton
                  size="tiny"
                  :type="previewBg === 'checker' ? 'primary' : 'default'"
                  @click="previewBg = 'checker'"
                >
                  网格底
                </NButton>
                <NButton
                  size="tiny"
                  :type="previewBg === 'dark' ? 'primary' : 'default'"
                  @click="previewBg = 'dark'"
                >
                  暗黑底
                </NButton>
                <NButton
                  size="tiny"
                  :type="previewBg === 'transparent' ? 'primary' : 'default'"
                  @click="previewBg = 'transparent'"
                >
                  透明底
                </NButton>
              </NSpace>
            </NFlex>

            <!-- 舞台监视器 -->
            <div
              class="monitor-stage-wrap"
              :class="`bg-${previewBg}`"
            >
              <CounterDisplay
                :key="`${state.theme}-${state.accentColor}`"
                :channel-id="channelId"
                :inline-mode="true"
              />
            </div>

            <div class="monitor-tip">
              推荐 OBS 分辨率: <b>360 × 140 px</b> (浏览器源开启透明背景)
            </div>
          </div>
        </NGridItem>
      </NGrid>

      <NDivider style="margin: 14px 0 10px" />

      <!-- 参数与视觉配置 -->
      <div class="deck-label">
        配置与样式微调
      </div>

      <NGrid
        cols="1 s:2 m:3"
        responsive="screen"
        :x-gap="14"
        :y-gap="10"
      >
        <NGridItem>
          <NFormItem
            label="标题文本"
            size="small"
          >
            <NInput
              :value="state.title"
              placeholder="例如：艾尔登法环 死亡挑战"
              @update:value="updateState({ title: $event })"
            />
          </NFormItem>
        </NGridItem>

        <NGridItem>
          <NFormItem
            label="前缀小标"
            size="small"
          >
            <NInput
              :value="state.prefix"
              placeholder="例如：DEATHS / WINS"
              @update:value="updateState({ prefix: $event })"
            />
          </NFormItem>
        </NGridItem>

        <NGridItem>
          <NFormItem
            label="目标数值 (0 为不设限)"
            size="small"
          >
            <NInputNumber
              :value="state.target"
              :min="0"
              style="width: 100%"
              @update:value="updateState({ target: $event || 0 })"
            />
          </NFormItem>
        </NGridItem>

        <NGridItem>
          <NFormItem
            label="视觉主题风格"
            size="small"
          >
            <NSelect
              :value="state.theme"
              :options="themeOptions"
              @update:value="updateState({ theme: $event })"
            />
          </NFormItem>
        </NGridItem>

        <NGridItem>
          <NFormItem
            label="强调高亮色"
            size="small"
          >
            <NColorPicker
              :value="state.accentColor"
              :show-alpha="false"
              @update:value="updateState({ accentColor: $event })"
            />
          </NFormItem>
        </NGridItem>

        <NGridItem>
          <NFormItem
            label="显示目标进度条"
            size="small"
          >
            <NSwitch
              :value="state.showProgress"
              @update:value="updateState({ showProgress: $event })"
            />
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NCard>
  </div>
</template>

<style scoped>
.counter-viewer-page {
  box-sizing: border-box;
}

.counter-viewer-card {
  border-radius: var(--vtsuru-radius);
  border: 1px solid var(--vtsuru-border);
}

.card-header-row {
  margin-bottom: 2px;
}

.card-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--vtsuru-fg);
}

.version-tag {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  background: var(--vtsuru-bg-muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.sync-meta-text {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  margin-top: 2px;
}

.sync-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10b981;
}

.sync-indicator-dot.syncing {
  background: #3b82f6;
  animation: pulse 1s infinite;
}

.sync-indicator-dot.error {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.deck-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 8px;
}

/* 操作盘 */
.operator-deck-box {
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 14px;
  height: 100%;
  box-sizing: border-box;
}

.deck-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.keyboard-tip {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
}

.count-hero-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 12px 16px;
  margin: 8px 0 12px;
}

.hero-tag {
  font-size: 11px;
  font-weight: 700;
  color: var(--vtsuru-brand);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-num-wrap {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.hero-number {
  font-size: 52px;
  font-weight: 900;
  color: var(--vtsuru-fg);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.hero-target-denom {
  font-size: 15px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
}

/* 物理按键群 */
.action-button-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 8px;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-fg);
  padding: 10px 0;
  transition: all 0.1s cubic-bezier(0.4, 0, 0.2, 1);
  user-select: none;
}

.btn-action:hover:not(:disabled) {
  border-color: var(--vtsuru-brand);
  background: var(--vtsuru-bg-muted);
}

.btn-action:active:not(:disabled) {
  transform: scale(0.96);
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-main-plus {
  background: var(--vtsuru-brand);
  border-color: var(--vtsuru-brand);
  color: #ffffff;
}

.btn-main-plus:hover:not(:disabled) {
  background: var(--vtsuru-brand-tint, var(--vtsuru-brand));
  border-color: var(--vtsuru-brand);
}

.btn-icon {
  font-size: 18px;
}

/* 监视器 */
.monitor-panel-box {
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 14px;
  height: 100%;
  box-sizing: border-box;
}

.monitor-stage-wrap {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  overflow: hidden;
  border: 1px dashed var(--vtsuru-border);
}

.monitor-stage-wrap.bg-checker {
  background-image: linear-gradient(45deg, #18181b 25%, transparent 25%),
    linear-gradient(-45deg, #18181b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #18181b 75%),
    linear-gradient(-45deg, transparent 75%, #18181b 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
  background-color: #09090b;
}

.monitor-stage-wrap.bg-dark {
  background-color: #09090b;
}

.monitor-stage-wrap.bg-transparent {
  background-color: transparent;
}

.monitor-tip {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
  margin-top: 8px;
}
</style>
