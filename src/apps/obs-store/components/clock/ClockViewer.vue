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
  computed,
  onMounted,
  ref,
} from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import {
  loadObsStoreFonts,
  OBS_CLOCK_FONTS,
} from '@/apps/obs-store/utils/fontLoader'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Slider } from '@/shared/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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

const { copy, isSupported: isCopySupported } = useClipboard()

const route = useRoute()
const channelId = ref(resolveObsSyncChannel(route.query.channel))
const channelDraft = ref(channelId.value)
const copied = ref(false)

const {
  state,
  updateState,
  sendAction,
  currentHash,
  isSyncing,
  lastSyncError,
  hasPendingChanges,
  retry,
} = useObsBridge<ClockState, ClockAction>({
  componentId: 'clock',
  channelId,
  defaultState: DEFAULT_CLOCK_STATE,
  role: 'controller',
})

onMounted(() => loadObsStoreFonts(OBS_CLOCK_FONTS))

// 监视器背景
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

// OBS URL
const account = useAccount()
const obsAbsoluteUrl = computed(() => buildObsSourceUrl({
  path: '/obs-store/clock', host: window.location.origin, credential: 'public-id',
  userId: account.value.id, params: { channel: channelId.value },
}))
const obsRelativeUrl = obsAbsoluteUrl

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持直接写入剪贴板，请手动复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    toast.success('OBS 浏览器源链接已复制到剪贴板！')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}

function changeChannel() {
  const next = parseObsSyncChannel(channelDraft.value)
  if (!next) {
    toast.error(OBS_SYNC_CHANNEL_HINT)
    return
  }
  channelId.value = next
  channelDraft.value = next
}

function openPopoutWindow() {
  if (typeof window === 'undefined') return
  window.open(
    `/manage/obs-store?component=clock&channel=${encodeURIComponent(channelId.value)}`,
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

const modeOptions: { label: string; value: ClockMode }[] = [
  { label: '实时时钟', value: 'clock' },
  { label: '开播倒计时', value: 'countdown' },
  { label: '正计时 / 速通', value: 'stopwatch' },
]
</script>

<template>
  <div class="clock-viewer-page">
    <Card class="clock-viewer-card p-4">
      <CardContent class="p-0 space-y-3">
        <!-- 头部状态与模式导航条 -->
        <div class="card-header-row flex flex-wrap items-center justify-between gap-3">
          <div class="header-left">
            <div class="flex items-center gap-2">
              <span class="card-header-title">时钟与倒计时挂件</span>
              <span class="version-tag">形态驱动版</span>
            </div>
            <div class="sync-meta-text">
              <span
                class="sync-indicator-dot"
                :class="{ syncing: isSyncing, error: lastSyncError }"
              />
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步状态...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
              <span v-else>就绪</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <Input v-model="channelDraft" class="w-[120px]" placeholder="频道" maxlength="64" @keyup.enter="changeChannel" />
            <Button variant="secondary" @click="changeChannel">
              切换频道
            </Button>
          </div>

          <!-- 模式切换控制器 -->
          <div class="inline-flex rounded-md border border-input p-0.5 bg-background text-muted-foreground">
            <button
              v-for="opt in modeOptions"
              :key="opt.value"
              type="button"
              class="px-2.5 py-1 text-xs font-medium rounded-sm transition-all"
              :class="state.mode === opt.value ? 'bg-primary text-primary-foreground shadow-sm' : 'hover:text-foreground'"
              @click="updateState({ mode: opt.value })"
            >
              {{ opt.label }}
            </button>
          </div>

          <!-- 快捷操作按钮 -->
          <div class="flex items-center gap-1.5">
            <Button v-if="lastSyncError" variant="secondary" :disabled="isSyncing" @click="retry">
              重试同步
            </Button>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button variant="secondary" class="gap-1.5" @click="openPopoutWindow">
                    <Open24Regular class="size-4" />
                    独立小窗
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  弹出一个紧凑独立的悬浮控制窗口，方便拖拽至副屏或 OBS 旁边
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button class="gap-1.5" @click="copyObsUrl">
              <Checkmark24Regular v-if="copied" class="size-4" />
              <Copy24Regular v-else class="size-4" />
              复制 OBS 源链接
            </Button>
          </div>
        </div>

        <div class="h-px bg-border my-2.5" />

        <!-- 主控制台与实时预览双栏布局 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- 左栏：控制与自定义操作区 -->
          <div class="deck-col-container flex flex-col gap-3">
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
                  <Pause24Regular v-if="state.timerRunning" class="btn-icon" />
                  <Play24Regular v-else class="btn-icon" />
                  <span class="btn-text">{{ state.timerRunning ? '暂停计时' : '开始计时' }}</span>
                </button>

                <button
                  type="button"
                  class="btn-action btn-reset"
                  @click="resetTimer"
                >
                  <ArrowCounterclockwise24Regular class="btn-icon" />
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
                  class="w-[130px]"
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
                  <ColorPicker
                    :model-value="state.accentColor"
                    @update:model-value="updateState({ accentColor: $event })"
                  />
                </div>

                <div class="color-item">
                  <span class="color-label">文字颜色</span>
                  <Input :value="state.textColor" placeholder="默认或 #ffffff" @input="updateState({ textColor: ($event.target as HTMLInputElement).value })" />
                </div>

                <div class="color-item">
                  <span class="color-label">外壳背景底色</span>
                  <Input :value="state.bgColor" placeholder="默认或 #1e2024" @input="updateState({ bgColor: ($event.target as HTMLInputElement).value })" />
                </div>

                <div class="color-item">
                  <div class="slider-header">
                    <span class="color-label">背景不透明度</span>
                    <span class="slider-val">{{ state.bgOpacity }}%</span>
                  </div>
                  <Slider
                    :model-value="[state.bgOpacity]"
                    :min="0"
                    :max="100"
                    :step="5"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) updateState({ bgOpacity: val[0] }) }"
                  />
                </div>
              </div>

              <!-- 标题文本输入行 -->
              <div class="text-inputs-row">
                <Input :value="state.title" placeholder="自定义副标 / 标题文本 (如 LIVE NOW)" class="flex-1" @input="updateState({ title: ($event.target as HTMLInputElement).value })" />

                <Input v-if="state.mode === 'countdown'" :value="state.timerEndText" placeholder="倒计时结束提示 (如 LIVE STARTED)" class="flex-1" @input="updateState({ timerEndText: ($event.target as HTMLInputElement).value })" />
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

          <!-- 右栏：实时 OBS 监视器与链接管理 -->
          <div>
            <div class="monitor-panel-box">
              <div class="flex items-center justify-between mb-2">
                <span class="deck-label">OBS 画面实时监视器</span>
                <div class="flex items-center gap-1.5">
                  <Button size="xs" class="h-6 text-[11px] px-2" :variant="previewBg === 'checker' ? 'default' : 'outline'" @click="previewBg = 'checker'">
                    网格底
                  </Button>
                  <Button size="xs" class="h-6 text-[11px] px-2" :variant="previewBg === 'dark' ? 'default' : 'outline'" @click="previewBg = 'dark'">
                    暗黑底
                  </Button>
                  <Button size="xs" class="h-6 text-[11px] px-2" :variant="previewBg === 'transparent' ? 'default' : 'outline'" @click="previewBg = 'transparent'">
                    透明底
                  </Button>
                </div>
              </div>

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
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.clock-viewer-page {
  width: 100%;
}

.clock-viewer-card {
  background: var(--popover);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.card-header-row {
  margin-bottom: 2px;
}

.card-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--foreground);
}

.version-tag {
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 1px 6px;
  border-radius: 4px;
}

.sync-meta-text {
  font-size: 12px;
  color: var(--muted-foreground);
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
}

.sync-indicator-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background-color: #10b981;
  display: inline-block;
}

.sync-indicator-dot.syncing {
  background-color: #f59e0b;
  animation: pulse-dot 1s infinite alternate;
}

.sync-indicator-dot.error {
  background-color: #ef4444;
}

@keyframes pulse-dot {
  from { opacity: 0.4; }
  to { opacity: 1; }
}

.operator-deck-box {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
}

.deck-header-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.deck-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.status-tip {
  font-size: 11px;
  color: var(--muted-foreground);
}

.quick-time-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.quick-label {
  font-size: 12px;
  color: var(--muted-foreground);
}

.btn-quick {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 3px 8px;
  font-size: 12px;
  color: var(--foreground);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-quick:hover {
  background: var(--popover);
  border-color: var(--brand);
  color: var(--brand);
}

.action-button-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 8px;
  margin-bottom: 10px;
}

.btn-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--background);
  color: var(--foreground);
  user-select: none;
}

.btn-action:hover {
  background: var(--popover);
  border-color: var(--brand);
  color: var(--brand);
}

.btn-action.btn-main {
  background: var(--brand);
  color: #fff;
  border-color: var(--brand);
}

.btn-action.btn-main.is-running {
  background: #f59e0b;
  border-color: #f59e0b;
}

.btn-icon {
  width: 16px;
  height: 16px;
}

.custom-duration-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.theme-preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 6px;
}

.theme-preset-card {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.theme-preset-card:hover {
  border-color: var(--brand);
}

.theme-preset-card.active {
  border-color: var(--brand);
  background: var(--brand-soft);
}

.preset-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preset-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
}

.preset-tag {
  font-size: 9px;
  background: var(--muted);
  color: var(--muted-foreground);
  padding: 0 4px;
  border-radius: 3px;
}

.preset-archetype {
  font-size: 10px;
  color: var(--muted-foreground);
}

.color-control-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.color-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.color-label {
  font-size: 11px;
  color: var(--muted-foreground);
}

.slider-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.slider-val {
  font-size: 11px;
  color: var(--muted-foreground);
  font-family: monospace;
}

.text-inputs-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.compact-toggle-matrix {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.toggle-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 11px;
  color: var(--muted-foreground);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.toggle-chip:hover {
  border-color: var(--brand);
  color: var(--foreground);
}

.toggle-chip.active {
  background: var(--brand-soft);
  border-color: var(--brand);
  color: var(--brand);
  font-weight: 600;
}

.chip-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}

.monitor-panel-box {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
}

.monitor-stage-wrap {
  width: 100%;
  height: 180px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px dashed var(--border);
  margin-bottom: 10px;
}

.bg-checker {
  background-color: #1e1e24;
  background-image:
    linear-gradient(45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(-45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b36 75%),
    linear-gradient(-45deg, transparent 75%, #2b2b36 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.bg-dark {
  background: #09090b;
}

.bg-transparent {
  background: transparent;
}

.obs-source-meta-card {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 8px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
}

.meta-card-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.meta-label {
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.meta-code {
  font-family: monospace;
  color: var(--brand);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-val {
  color: var(--foreground);
}
</style>
