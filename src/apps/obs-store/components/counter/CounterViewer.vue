<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowCounterclockwise24Regular from '@vicons/fluent/es/ArrowCounterclockwise24Regular'
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Subtract24Regular from '@vicons/fluent/es/Subtract24Regular'
import { useClipboard } from '@vueuse/core'
import { computed, onActivated, onDeactivated, ref } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import CounterDisplay from './CounterDisplay.vue'
import { DEFAULT_COUNTER_STATE } from './types'
import type { CounterAction, CounterState, CounterTheme } from './types'

const { copy, isSupported: isCopySupported } = useClipboard()

const route = useRoute()
const channelId = ref(resolveObsSyncChannel(route.query.channel))
const channelDraft = ref(channelId.value)
const copied = ref(false)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<CounterState, CounterAction>({
    componentId: 'counter',
    channelId,
    defaultState: DEFAULT_COUNTER_STATE,
    role: 'controller',
  })

// 主题选项
const themeOptions: { label: string; value: CounterTheme }[] = [
  { label: '悬浮卡片 (Card)', value: 'card' },
  { label: '极简透明 (Minimal)', value: 'minimal' },
  { label: '赛博霓虹 (Neon)', value: 'neon' },
  { label: '玻璃拟态 (Glass)', value: 'glass' },
]

// 预览背景切换
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')

// OBS URL 计算
const account = useAccount()
const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/counter',
    host: window.location.origin,
    credential: 'public-id',
    userId: account.value.id,
    params: { channel: channelId.value },
  }),
)

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

// 弹出独立控制小窗
function openPopoutWindow() {
  if (typeof window === 'undefined') return
  const url = `/manage/obs-store?component=counter&channel=${encodeURIComponent(channelId.value)}`
  window.open(url, 'VtsuruCounterPopout', 'width=420,height=600,menubar=no,toolbar=no,location=no,status=no')
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

function changeChannel() {
  const next = parseObsSyncChannel(channelDraft.value)
  if (!next) {
    toast.error(OBS_SYNC_CHANNEL_HINT)
    return
  }
  channelId.value = next
  channelDraft.value = next
}

function activateKeyboard() {
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleKeyDown)
  }
}

function deactivateKeyboard() {
  if (typeof window !== 'undefined') {
    window.removeEventListener('keydown', handleKeyDown)
  }
}

onActivated(activateKeyboard)
onDeactivated(deactivateKeyboard)
activateKeyboard()
</script>

<template>
  <div class="counter-viewer-page">
    <Card class="counter-viewer-card p-4">
      <CardContent class="p-0 space-y-3">
        <!-- 头部栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="card-header-title">挑战与直播计数器</span>
              <span class="version-tag">v1.0</span>
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
            <Input
              v-model="channelDraft"
              class="w-[120px]"
              placeholder="频道"
              maxlength="64"
              @keyup.enter="changeChannel"
            />
            <Button
              variant="secondary"
              @click="changeChannel"
            >
              切换频道
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Button
              v-if="lastSyncError"
              variant="secondary"
              :disabled="isSyncing"
              @click="retry"
            >
              重试同步
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="secondary"
                    class="gap-1.5"
                    @click="openPopoutWindow"
                  >
                    <Open24Regular class="size-4" />
                    独立小窗
                  </Button>
                </TooltipTrigger>
                <TooltipContent> 弹出一个紧凑独立的悬浮控制窗口，方便拖拽至副屏或 OBS 旁边 </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Button
              class="gap-1.5"
              @click="copyObsUrl"
            >
              <Checkmark24Regular
                v-if="copied"
                class="size-4"
              />
              <Copy24Regular
                v-else
                class="size-4"
              />
              复制 OBS 源链接
            </Button>
          </div>
        </div>

        <Separator class="my-2.5" />

        <!-- 主控制台与实时预览 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          <!-- 左侧：快速操作盘 -->
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
                  >/ {{ state.target }}</span
                >
              </div>
            </div>

            <!-- 核心加减控制按钮群 -->
            <div class="action-button-grid">
              <Button
                variant="brand"
                size="lg"
                class="h-11 font-semibold gap-1.5"
                @click="handleIncrement(1)"
              >
                <Add24Regular class="size-4.5" />
                <span>+1 次</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                class="h-11 font-semibold"
                @click="handleIncrement(5)"
              >
                +5
              </Button>

              <Button
                variant="outline"
                size="lg"
                class="h-11 font-semibold gap-1.5"
                :disabled="state.count <= 0"
                @click="handleDecrement(1)"
              >
                <Subtract24Regular class="size-4.5" />
                <span>-1</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                class="h-11 font-semibold gap-1.5"
                @click="handleReset"
              >
                <ArrowCounterclockwise24Regular class="size-4.5" />
                <span>归零</span>
              </Button>
            </div>

            <!-- 直接设定数值 -->
            <div class="flex items-center gap-2 mt-3">
              <span class="text-xs text-muted-foreground">直接设值:</span>
              <NumberField
                :model-value="state.count"
                :min="0"
                class="w-[110px]"
                @update:model-value="updateState({ count: $event || 0 })"
              />
            </div>
          </div>

          <!-- 右侧：实时 OBS 监视器 -->
          <div class="monitor-panel-box">
            <div class="flex-between mb-2">
              <span class="deck-label">OBS 画面实时监视器</span>
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="previewBg"
                @update:model-value="
                  (val) => {
                    if (val) previewBg = val as any
                  }
                "
              >
                <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
                <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
                <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
              </ToggleGroup>
            </div>

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

            <div class="monitor-tip">推荐 OBS 分辨率: <b>360 × 140 px</b> (浏览器源开启透明背景)</div>
          </div>
        </div>

        <Separator class="my-3.5" />

        <!-- 参数与视觉配置 -->
        <div class="deck-label mb-2">配置与样式微调</div>

        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">标题文本</label>
            <Input
              :value="state.title"
              placeholder="例如：艾尔登法环 死亡挑战"
              @input="updateState({ title: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">前缀小标</label>
            <Input
              :value="state.prefix"
              placeholder="例如：DEATHS / WINS"
              @input="updateState({ prefix: ($event.target as HTMLInputElement).value })"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">目标数值 (0 为不设限)</label>
            <NumberField
              :model-value="state.target"
              :min="0"
              class="w-full"
              @update:model-value="updateState({ target: $event || 0 })"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">视觉主题风格</label>
            <Select
              :model-value="state.theme"
              @update:model-value="updateState({ theme: $event as CounterTheme })"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择风格" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in themeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">强调高亮色</label>
            <ColorPicker
              :model-value="state.accentColor"
              @update:model-value="updateState({ accentColor: $event })"
            />
          </div>

          <div class="space-y-1.5">
            <label class="text-xs font-medium text-foreground">显示目标进度条</label>
            <div class="pt-1">
              <Switch
                :checked="state.showProgress"
                @update:checked="updateState({ showProgress: $event })"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.counter-viewer-page {
  box-sizing: border-box;
}

.counter-viewer-card {
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.card-header-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--foreground);
}

.version-tag {
  font-size: 10px;
  color: var(--muted-foreground);
  background: var(--muted);
  padding: 1px 5px;
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
  from {
    opacity: 0.4;
  }
  to {
    opacity: 1;
  }
}

.deck-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--foreground);
}

.keyboard-tip {
  font-size: 11px;
  color: var(--muted-foreground);
}

.operator-deck-box {
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
}

.deck-header-row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 10px;
}

.count-hero-block {
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.hero-tag {
  font-size: 12px;
  font-weight: 700;
  color: var(--muted-foreground);
  letter-spacing: 1px;
  text-transform: uppercase;
}

.hero-num-wrap {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hero-number {
  font-size: 38px;
  font-weight: 900;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: var(--brand);
  line-height: 1;
}

.hero-target-denom {
  font-size: 18px;
  font-weight: 600;
  color: var(--muted-foreground);
}

.action-button-grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: 8px;
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
  height: 140px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  border: 1px dashed var(--border);
}

.bg-checker {
  background-color: #1e1e24;
  background-image:
    linear-gradient(45deg, #2b2b36 25%, transparent 25%), linear-gradient(-45deg, #2b2b36 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b36 75%), linear-gradient(-45deg, transparent 75%, #2b2b36 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}

.bg-dark {
  background: #09090b;
}

.bg-transparent {
  background: transparent;
}

.monitor-tip {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 8px;
  text-align: center;
}
</style>
