<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  ArrowCounterclockwise24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Open24Regular,
  Pause24Regular,
  Play24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NCard,
  NColorPicker,
  NDivider,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSlider,
  NSpace,
  NTooltip,
  useMessage,
} from 'naive-ui'
import {
  computed,
  onMounted,
  ref,
} from 'vue'

import { useObsBridge } from '@/apps/obs-store/sync'
import {
  loadObsStoreFonts,
  OBS_CLOCK_FONTS,
} from '@/apps/obs-store/utils/fontLoader'

import ClockDisplay from './ClockDisplay.vue'
import {
  CLOCK_THEME_PRESETS,
  DEFAULT_CLOCK_STATE,
} from './types'
import type {
  ClockAction,
  ClockMode,
  ClockState,
} from './types'

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
} = useObsBridge<ClockState, ClockAction>({
  componentId: 'clock',
  channelId: channelId.value,
  defaultState: DEFAULT_CLOCK_STATE,
  role: 'controller',
})

onMounted(() => {
  loadObsStoreFonts(OBS_CLOCK_FONTS)
})

// 监视器背景
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

// OBS URL
const obsRelativeUrl = computed(() => {
  const p = new URLSearchParams()
  if (channelId.value && channelId.value !== 'default') {
    p.set('channel', channelId.value)
  }
  const queryStr = p.toString()
  return `/obs-store/clock${queryStr ? `?${queryStr}` : ''}`
})

const obsAbsoluteUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${obsRelativeUrl.value}`
  }
  return obsRelativeUrl.value
})

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

function openPopoutWindow() {
  if (typeof window === 'undefined') return
  window.open(
    `/obs-store/clock-manage`,
    'VtsuruClockPopout',
    'width=440,height=680,menubar=no,toolbar=no,location=no,status=no',
  )
}

// 计时器控制逻辑
function toggleTimer() {
  if (state.value.timerRunning) {
    const now = Date.now()
    const elapsed = state.value.timerElapsed + (state.value.timerStartTime > 0 ? (now - state.value.timerStartTime) : 0)
    updateState({
      timerRunning: false,
      timerStartTime: 0,
      timerElapsed: elapsed,
    })
    sendAction({ type: 'PAUSE_TIMER', elapsed })
  } else {
    const now = Date.now()
    updateState({
      timerRunning: true,
      timerStartTime: now,
    })
    sendAction({ type: 'START_TIMER', timestamp: now })
  }
}

function resetTimer() {
  updateState({
    timerRunning: false,
    timerStartTime: 0,
    timerElapsed: 0,
  })
  sendAction({ type: 'RESET_TIMER' })
}

function quickSetMinutes(mins: number) {
  const seconds = mins * 60
  updateState({
    countdownDuration: seconds,
    timerRunning: false,
    timerStartTime: 0,
    timerElapsed: 0,
  })
  sendAction({ type: 'SET_COUNTDOWN', seconds })
}
</script>

<template>
  <div class="clock-viewer-page">
    <NCard
      size="small"
      class="clock-viewer-card"
    >
      <!-- 头部状态与模式导航条 -->
      <NFlex
        justify="space-between"
        align="center"
        class="card-header-row"
      >
        <div class="header-left">
          <NFlex
            align="center"
            :size="8"
          >
            <span class="card-header-title">时钟与倒计时挂件</span>
            <span class="version-tag">形态驱动版</span>
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

        <!-- 模式切换控制器 -->
        <NRadioGroup
          :value="state.mode"
          size="small"
          class="mode-switch-radio"
          @update:value="updateState({ mode: $event as ClockMode })"
        >
          <NRadioButton value="clock">
            实时时钟
          </NRadioButton>
          <NRadioButton value="countdown">
            开播倒计时
          </NRadioButton>
          <NRadioButton value="stopwatch">
            正计时 / 速通
          </NRadioButton>
        </NRadioGroup>

        <!-- 快捷操作按钮 -->
        <NSpace :size="6">
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

      <!-- 主控制台与实时预览双栏布局 -->
      <NGrid
        cols="1 m:2"
        responsive="screen"
        :x-gap="12"
        :y-gap="12"
      >
        <!-- 左栏：控制与自定义操作区 -->
        <NGridItem>
          <div class="deck-col-container">
            <!-- 计时器运行控制区 (仅倒计时与正计时模式展示) -->
            <div
              v-if="state.mode === 'countdown' || state.mode === 'stopwatch'"
              class="operator-deck-box timer-deck-box"
            >
              <div class="deck-header-row">
                <span class="deck-label">计时器控制</span>
                <span class="status-tip">{{ state.timerRunning ? '计时进行中' : '已暂停' }}</span>
              </div>

              <!-- 倒计时快捷时长设置 -->
              <div
                v-if="state.mode === 'countdown'"
                class="quick-time-row"
              >
                <span class="quick-label">预设时长:</span>
                <button
                  type="button"
                  class="btn-quick"
                  @click="quickSetMinutes(3)"
                >
                  3分钟
                </button>
                <button
                  type="button"
                  class="btn-quick"
                  @click="quickSetMinutes(5)"
                >
                  5分钟
                </button>
                <button
                  type="button"
                  class="btn-quick"
                  @click="quickSetMinutes(10)"
                >
                  10分钟
                </button>
                <button
                  type="button"
                  class="btn-quick"
                  @click="quickSetMinutes(15)"
                >
                  15分钟
                </button>
                <button
                  type="button"
                  class="btn-quick"
                  @click="quickSetMinutes(30)"
                >
                  30分钟
                </button>
              </div>

              <!-- 开始 / 暂停 / 重置大按钮 -->
              <div class="action-button-grid">
                <button
                  type="button"
                  class="btn-action btn-main"
                  :class="{ 'is-running': state.timerRunning }"
                  @click="toggleTimer"
                >
                  <NIcon
                    :component="state.timerRunning ? Pause24Regular : Play24Regular"
                    class="btn-icon"
                  />
                  <span class="btn-text">{{ state.timerRunning ? '暂停计时' : '开始计时' }}</span>
                </button>

                <button
                  type="button"
                  class="btn-action btn-reset"
                  @click="resetTimer"
                >
                  <NIcon
                    :component="ArrowCounterclockwise24Regular"
                    class="btn-icon"
                  />
                  <span class="btn-text">重置归零</span>
                </button>
              </div>

              <!-- 自定义倒计时秒数 -->
              <div
                v-if="state.mode === 'countdown'"
                class="custom-duration-row"
              >
                <span class="quick-label">自定义倒计时 (秒):</span>
                <NInputNumber
                  :value="state.countdownDuration"
                  :min="5"
                  :step="30"
                  size="small"
                  style="width: 130px"
                  @update:value="updateState({ countdownDuration: $event || 300 })"
                />
              </div>
            </div>

            <!-- 外观形态选择器 -->
            <div class="operator-deck-box">
              <div class="deck-header-row">
                <span class="deck-label">时钟外观形态 ({{ CLOCK_THEME_PRESETS.length }} 款)</span>
              </div>

              <div class="theme-preset-grid">
                <button
                  v-for="preset in CLOCK_THEME_PRESETS"
                  :key="preset.id"
                  type="button"
                  class="theme-preset-card"
                  :class="{ active: state.theme === preset.id }"
                  @click="updateState({ theme: preset.id })"
                >
                  <div class="preset-card-top">
                    <span class="preset-name">{{ preset.name }}</span>
                    <span class="preset-tag">{{ preset.tag }}</span>
                  </div>
                  <span class="preset-archetype">{{ preset.archetype }}</span>
                </button>
              </div>
            </div>

            <!-- 色彩与细项开关配置卡 -->
            <div class="operator-deck-box">
              <div class="deck-header-row">
                <span class="deck-label">外观细节与显示项</span>
              </div>

              <div class="color-control-grid">
                <div class="color-item">
                  <span class="color-label">强调发光色</span>
                  <NColorPicker
                    :value="state.accentColor"
                    :modes="['hex']"
                    size="small"
                    :show-alpha="false"
                    @update:value="updateState({ accentColor: $event })"
                  />
                </div>

                <div class="color-item">
                  <span class="color-label">文字颜色</span>
                  <NInput
                    :value="state.textColor"
                    placeholder="默认或 #ffffff"
                    size="small"
                    @update:value="updateState({ textColor: $event })"
                  />
                </div>

                <div class="color-item">
                  <span class="color-label">外壳背景底色</span>
                  <NInput
                    :value="state.bgColor"
                    placeholder="默认或 #1e2024"
                    size="small"
                    @update:value="updateState({ bgColor: $event })"
                  />
                </div>

                <div class="color-item">
                  <div class="slider-header">
                    <span class="color-label">背景不透明度</span>
                    <span class="slider-val">{{ state.bgOpacity }}%</span>
                  </div>
                  <NSlider
                    :value="state.bgOpacity"
                    :min="0"
                    :max="100"
                    :step="5"
                    @update:value="updateState({ bgOpacity: $event })"
                  />
                </div>
              </div>

              <!-- 标题文本输入行 -->
              <div class="text-inputs-row">
                <NInput
                  :value="state.title"
                  placeholder="自定义副标 / 标题文本 (如 LIVE NOW)"
                  size="small"
                  @update:value="updateState({ title: $event })"
                />

                <NInput
                  v-if="state.mode === 'countdown'"
                  :value="state.timerEndText"
                  placeholder="倒计时结束提示 (如 LIVE STARTED)"
                  size="small"
                  @update:value="updateState({ timerEndText: $event })"
                />
              </div>

              <!-- 紧凑交互开关矩阵 -->
              <div class="compact-toggle-matrix">
                <!-- 时钟专有开关 -->
                <template v-if="state.mode === 'clock'">
                  <button
                    type="button"
                    class="toggle-chip"
                    :class="{ active: state.is24Hour }"
                    @click="updateState({ is24Hour: !state.is24Hour })"
                  >
                    <span class="chip-dot" />
                    24小时制
                  </button>

                  <button
                    type="button"
                    class="toggle-chip"
                    :class="{ active: state.showSeconds }"
                    @click="updateState({ showSeconds: !state.showSeconds })"
                  >
                    <span class="chip-dot" />
                    显示秒数
                  </button>

                  <button
                    type="button"
                    class="toggle-chip"
                    :class="{ active: state.showDate }"
                    @click="updateState({ showDate: !state.showDate })"
                  >
                    <span class="chip-dot" />
                    显示日期
                  </button>

                  <button
                    type="button"
                    class="toggle-chip"
                    :class="{ active: state.showDayOfWeek }"
                    @click="updateState({ showDayOfWeek: !state.showDayOfWeek })"
                  >
                    <span class="chip-dot" />
                    显示星期
                  </button>
                </template>

                <!-- 倒计时专有开关 -->
                <template v-if="state.mode === 'countdown'">
                  <button
                    type="button"
                    class="toggle-chip"
                    :class="{ active: state.showProgress }"
                    @click="updateState({ showProgress: !state.showProgress })"
                  >
                    <span class="chip-dot" />
                    进度条
                  </button>
                </template>

                <!-- 所有模式通用开关 -->
                <button
                  type="button"
                  class="toggle-chip"
                  :class="{ active: state.showMilliseconds }"
                  @click="updateState({ showMilliseconds: !state.showMilliseconds })"
                >
                  <span class="chip-dot" />
                  微秒/毫秒
                </button>
              </div>
            </div>
          </div>
        </NGridItem>

        <!-- 右栏：实时 OBS 监视器与链接管理 -->
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
              <ClockDisplay
                :key="`${state.theme}-${state.mode}-${state.accentColor}-${state.textColor}-${state.bgColor}-${state.bgOpacity}`"
                :channel-id="channelId"
                :inline-mode="true"
              />
            </div>

            <!-- OBS 挂件配置说明卡 -->
            <div class="obs-source-meta-card">
              <div class="meta-card-row">
                <span class="meta-label">OBS 源地址</span>
                <span class="meta-code">{{ obsRelativeUrl }}</span>
              </div>
              <div class="meta-card-row">
                <span class="meta-label">推荐分辨率</span>
                <span class="meta-val">420 × 160 px (支持自由缩放与透明背景)</span>
              </div>
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>
  </div>
</template>

<style scoped>
.clock-viewer-page {
  width: 100%;
}

.clock-viewer-card {
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
}

.card-header-row {
  margin-bottom: 2px;
  flex-wrap: wrap;
  gap: 8px;
}

.card-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--vtsuru-fg);
}

.version-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 6px;
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
  color: var(--vtsuru-fg-muted);
}

.sync-meta-text {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  margin-top: 3px;
}

.sync-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
}

.sync-indicator-dot.syncing {
  background: #38bdf8;
  animation: pulse 1s infinite;
}

.sync-indicator-dot.error {
  background: #ef4444;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.deck-col-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.operator-deck-box {
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 12px;
}

.deck-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.deck-label {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vtsuru-fg-muted);
}

.status-tip {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-brand);
}

/* 计时控制盘 */
.timer-deck-box {
  border-color: rgba(56, 189, 248, 0.3);
}

.quick-time-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}

.quick-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.btn-quick {
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  cursor: pointer;
  transition: all 0.15s;
}

.btn-quick:hover {
  background: var(--vtsuru-border);
  color: var(--vtsuru-brand);
}

.btn-quick:active {
  transform: scale(0.96);
}

.action-button-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.btn-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-action:active {
  transform: scale(0.97);
}

.btn-main {
  background: var(--vtsuru-brand);
  color: #ffffff;
}

.btn-main.is-running {
  background: #eab308;
  color: #000000;
}

.btn-reset {
  background: var(--vtsuru-bg-elevated);
  border-color: var(--vtsuru-border);
  color: var(--vtsuru-fg);
}

.btn-reset:hover {
  border-color: #ef4444;
  color: #ef4444;
}

.btn-icon {
  font-size: 16px;
}

.custom-duration-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 监视器面板 */
.monitor-panel-box {
  background: var(--vtsuru-bg);
  border: 1px solid var(--vtsuru-border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.monitor-stage-wrap {
  min-height: 220px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  position: relative;
  padding: 16px;
}

.monitor-stage-wrap.bg-checker {
  background-color: #18181b;
  background-image:
    linear-gradient(45deg, #27272a 25%, transparent 25%),
    linear-gradient(-45deg, #27272a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #27272a 75%),
    linear-gradient(-45deg, transparent 75%, #27272a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.monitor-stage-wrap.bg-dark {
  background: #09090b;
}

.monitor-stage-wrap.bg-transparent {
  background: transparent;
}

.obs-source-meta-card {
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.meta-card-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.meta-label {
  color: var(--vtsuru-fg-muted);
}

.meta-code {
  font-family: monospace;
  color: var(--vtsuru-brand);
}

.meta-val {
  color: var(--vtsuru-fg);
}

/* 预设形态网格 */
.theme-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 6px;
}

.theme-preset-card {
  display: flex;
  flex-direction: column;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  padding: 6px 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s;
}

.theme-preset-card:hover {
  border-color: var(--vtsuru-brand);
}

.theme-preset-card.active {
  border-color: var(--vtsuru-brand);
  background: rgba(56, 189, 248, 0.08);
}

.preset-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.preset-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-archetype {
  font-size: 9px;
  font-family: monospace;
  color: var(--vtsuru-brand);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preset-tag {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 3px;
  border-radius: 3px;
  background: var(--vtsuru-bg);
  color: var(--vtsuru-fg-muted);
  border: 1px solid var(--vtsuru-border);
}

.color-control-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px 10px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--vtsuru-brand);
  font-family: monospace;
}

.text-inputs-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.compact-toggle-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.toggle-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 5px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  cursor: pointer;
  transition: all 0.15s;
  user-select: none;
}

.toggle-chip:hover {
  border-color: var(--vtsuru-fg-muted);
  color: var(--vtsuru-fg);
}

.toggle-chip.active {
  background: rgba(56, 189, 248, 0.1);
  border-color: var(--vtsuru-brand);
  color: var(--vtsuru-fg);
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #71717a;
  transition: all 0.15s;
}

.toggle-chip.active .chip-dot {
  background: var(--vtsuru-brand);
  box-shadow: 0 0 5px var(--vtsuru-brand);
}
</style>
