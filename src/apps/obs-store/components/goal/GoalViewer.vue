<script setup lang="ts">
import Add24Regular from '@vicons/fluent/es/Add24Regular'
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import Checkmark24Regular from '@vicons/fluent/es/Checkmark24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Pause24Regular from '@vicons/fluent/es/Pause24Regular'
import Play24Regular from '@vicons/fluent/es/Play24Regular'
import Subtract24Regular from '@vicons/fluent/es/Subtract24Regular'
import { useClipboard } from '@vueuse/core'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import { OBS_SYNC_CHANNEL_HINT, parseObsSyncChannel, resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import GoalDisplay from './GoalDisplay.vue'
import { computeGoalEventDelta, formatCountdownClock, getVisibleRemainingMs } from './goalEngine'
import { DEFAULT_GOAL_STATE } from './types'
import type { GoalAction, GoalMetric, GoalMode, GoalState, GoalTheme } from './types'

const { copy, isSupported: isCopySupported } = useClipboard()
const route = useRoute()
const account = useAccount()
const danmakuClient = useDanmakuClient()

const channelId = ref(resolveObsSyncChannel(route.query.channel))
const channelDraft = ref(channelId.value)
const copied = ref(false)
const previewBg = ref<'checker' | 'dark' | 'transparent'>('checker')
const autoTrackEvents = ref(false)
const seenEventIds = new Set<string>()
const nowMs = ref(Date.now())
const clockTimer = setInterval(() => {
  nowMs.value = Date.now()
}, 500)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<GoalState, GoalAction>({
    componentId: 'goal',
    channelId,
    defaultState: DEFAULT_GOAL_STATE,
    role: 'controller',
  })

const themeOptions: { label: string; value: GoalTheme }[] = [
  { label: '悬浮卡片 (Card)', value: 'card' },
  { label: '极简透明 (Minimal)', value: 'minimal' },
  { label: '赛博霓虹 (Neon)', value: 'neon' },
  { label: '玻璃拟态 (Glass)', value: 'glass' },
]

const modeOptions: { label: string; value: GoalMode }[] = [
  { label: '目标 + 耐久双显', value: 'combo' },
  { label: '仅目标进度条', value: 'goal' },
  { label: '仅耐久倒计时', value: 'subathon' },
]

const metricOptions: { label: string; value: GoalMetric }[] = [
  { label: '舰长人数', value: 'guard' },
  { label: '礼物/SC/上舰金额 (元)', value: 'amount' },
  { label: '仅手动增减', value: 'manual' },
]

const obsAbsoluteUrl = computed(() =>
  buildObsSourceUrl({
    path: '/obs-store/goal',
    host: window.location.origin,
    credential: 'public-id',
    userId: account.value.id,
    params: { channel: channelId.value },
  }),
)

const clockDisplay = computed(() => formatCountdownClock(getVisibleRemainingMs(state.value, nowMs.value)))

function handleProgressDelta(amount: number) {
  const next = Math.max(0, Number((state.value.current + amount).toFixed(2)))
  const label = amount > 0 ? `+${amount}${state.value.unit}` : `${amount}${state.value.unit}`
  updateState({
    current: next,
    lastDeltaTick: Date.now(),
    lastDeltaText: label,
  })
  sendAction({ type: 'DELTA_PROGRESS', amount, label })
}

function handleTimeDelta(seconds: number) {
  const addMs = seconds * 1000
  const now = Date.now()
  const label = seconds >= 0 ? `+${Math.round(seconds / 60)}m` : `${Math.round(seconds / 60)}m`
  if (state.value.countdownPaused) {
    const nextMs = Math.max(0, state.value.pausedRemainingMs + addMs)
    updateState({ pausedRemainingMs: nextMs, lastDeltaTick: now, lastDeltaText: label })
  } else {
    const baseEnd = Math.max(now, state.value.countdownEndAt || now)
    updateState({ countdownEndAt: Math.max(now, baseEnd + addMs), lastDeltaTick: now, lastDeltaText: label })
  }
  sendAction({ type: 'DELTA_TIME', seconds, label })
}

function toggleCountdown() {
  const now = Date.now()
  if (state.value.countdownPaused) {
    const remaining = Math.max(0, state.value.pausedRemainingMs)
    updateState({
      countdownPaused: false,
      countdownEndAt: now + remaining,
    })
  } else {
    const remaining = Math.max(0, state.value.countdownEndAt - now)
    updateState({
      countdownPaused: true,
      pausedRemainingMs: remaining,
    })
  }
}

function resetCountdown(minutes = 60) {
  const ms = minutes * 60 * 1000
  updateState({
    countdownPaused: true,
    pausedRemainingMs: ms,
    countdownEndAt: 0,
  })
}

function handleIncomingEvent(event: EventModel) {
  if (!autoTrackEvents.value) return
  if (
    event.type !== EventDataTypes.Guard &&
    event.type !== EventDataTypes.Gift &&
    event.type !== EventDataTypes.SC
  ) {
    return
  }
  const key = event.eventId || `${event.type}:${event.uid}:${event.time}:${event.price}`
  if (seenEventIds.has(key)) return
  seenEventIds.add(key)
  if (seenEventIds.size > 500) {
    const first = seenEventIds.values().next().value
    if (first) seenEventIds.delete(first)
  }

  const res = computeGoalEventDelta(state.value, {
    type: event.type,
    priceYuan: event.price ?? 0,
    guardLevel: event.guard_level,
    num: event.num ?? 1,
  })
  if (!res) return
  updateState(res.patch)
  if (res.addedSeconds > 0) {
    sendAction({ type: 'DELTA_TIME', seconds: res.addedSeconds, label: res.deltaText })
  } else {
    sendAction({ type: 'DELTA_PROGRESS', amount: res.addedProgress, label: res.deltaText })
  }
}

function simulateEvent(kind: 'guard' | 'sc') {
  const res = computeGoalEventDelta(
    state.value,
    kind === 'guard'
      ? { type: EventDataTypes.Guard, priceYuan: 198, guardLevel: GuardLevel.Jianzhang, num: 1 }
      : { type: EventDataTypes.SC, priceYuan: 30, num: 1 },
  )
  if (!res) {
    toast.info('当前模式下此事件不触发目标或加钟')
    return
  }
  updateState(res.patch)
  sendAction({ type: 'DELTA_TIME', seconds: res.addedSeconds, label: res.deltaText })
  toast.success(`已模拟触发: ${res.deltaText}`)
}

watch(autoTrackEvents, async (enabled) => {
  if (enabled) {
    danmakuClient.onEvent('all', handleIncomingEvent)
    try {
      await danmakuClient.ensureOpenlive()
      toast.success('已开启直播间事件自动追踪')
    } catch {
      toast.warning('直播事件监听已挂起（请在弹幕姬或中控台先连接直播间）')
    }
  } else {
    danmakuClient.offEvent('all', handleIncomingEvent)
  }
})

onUnmounted(() => {
  clearInterval(clockTimer)
  danmakuClient.offEvent('all', handleIncomingEvent)
})

async function copyObsUrl() {
  if (!isCopySupported.value) {
    toast.warning('当前环境不支持剪贴板，请手动复制')
    return
  }
  await copy(obsAbsoluteUrl.value)
  copied.value = true
  toast.success('OBS 浏览器源链接已复制')
  setTimeout(() => {
    copied.value = false
  }, 2000)
}

function openPopoutWindow() {
  const url = `/manage/obs-store?component=goal&channel=${encodeURIComponent(channelId.value)}`
  window.open(url, 'VtsuruGoalPopout', 'width=460,height=660,menubar=no,toolbar=no,location=no,status=no')
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
</script>

<template>
  <div class="space-y-4">
    <Card class="p-4">
      <CardContent class="p-0 space-y-3">
        <!-- 头部控制栏 -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-sm">目标进度与耐久加钟</span>
              <Badge
                variant="secondary"
                size="xs"
              >
                v1.0
              </Badge>
            </div>
            <div class="text-xs text-muted-foreground mt-0.5">
              <span v-if="lastSyncError">同步失败，请重试</span>
              <span v-else-if="isSyncing">正在同步状态...</span>
              <span v-else-if="hasPendingChanges">有修改尚未保存</span>
              <span v-else-if="currentHash">已同步 (Hash: {{ currentHash.slice(0, 8) }})</span>
              <span v-else>就绪</span>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
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
            <Button
              v-if="lastSyncError"
              variant="secondary"
              :disabled="isSyncing"
              @click="retry"
            >
              重试
            </Button>
            <Button
              variant="secondary"
              class="gap-1.5"
              @click="openPopoutWindow"
            >
              <Open24Regular class="size-4" />
              独立小窗
            </Button>
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

        <Separator />

        <!-- 操作盘 + 实时监视器 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-lg border bg-muted/30 p-3.5 space-y-3">
            <div class="flex-between">
              <span class="text-xs font-medium text-muted-foreground">实时控制台</span>
              <label class="flex items-center gap-2 text-xs cursor-pointer">
                <span>自动追踪上舰/SC/礼物</span>
                <Switch
                  :model-value="autoTrackEvents"
                  @update:model-value="(val: boolean) => (autoTrackEvents = val)"
                />
              </label>
            </div>

            <!-- 进度快捷控制 -->
            <div
              v-if="state.mode !== 'subathon'"
              class="space-y-2 rounded-md border bg-background p-3"
            >
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">当前进度</span>
                <span class="font-mono font-semibold">{{ state.current }} / {{ state.target }} {{ state.unit }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Button
                  variant="brand"
                  class="gap-1"
                  @click="handleProgressDelta(1)"
                >
                  <Add24Regular class="size-4" />
                  +1
                </Button>
                <Button
                  variant="outline"
                  @click="handleProgressDelta(5)"
                >
                  +5
                </Button>
                <Button
                  variant="outline"
                  :disabled="state.current <= 0"
                  @click="handleProgressDelta(-1)"
                >
                  <Subtract24Regular class="size-4" />
                  -1
                </Button>
                <Button
                  variant="outline"
                  @click="updateState({ current: 0 })"
                >
                  <ArrowClockwise24Regular class="size-4 mr-1" />
                  清零
                </Button>
              </div>
            </div>

            <!-- 耐久倒计时控制 -->
            <div
              v-if="state.mode !== 'goal'"
              class="space-y-2 rounded-md border bg-background p-3"
            >
              <div class="flex-between text-xs">
                <span class="text-muted-foreground">耐久倒计时</span>
                <span class="font-mono font-bold text-base">{{ clockDisplay }}</span>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <Button
                  :variant="state.countdownPaused ? 'brand' : 'secondary'"
                  class="gap-1"
                  @click="toggleCountdown"
                >
                  <Play24Regular
                    v-if="state.countdownPaused"
                    class="size-4"
                  />
                  <Pause24Regular
                    v-else
                    class="size-4"
                  />
                  {{ state.countdownPaused ? '开始计时' : '暂停计时' }}
                </Button>
                <Button
                  variant="outline"
                  @click="handleTimeDelta(300)"
                >
                  +5分
                </Button>
                <Button
                  variant="outline"
                  @click="handleTimeDelta(600)"
                >
                  +10分
                </Button>
                <Button
                  variant="outline"
                  @click="handleTimeDelta(-300)"
                >
                  -5分
                </Button>
                <Button
                  variant="outline"
                  @click="resetCountdown(60)"
                >
                  重置1h
                </Button>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-1">
              <span class="text-xs text-muted-foreground">测试事件:</span>
              <Button
                size="xs"
                variant="outline"
                @click="simulateEvent('guard')"
              >
                模拟 +1 舰长
              </Button>
              <Button
                size="xs"
                variant="outline"
                @click="simulateEvent('sc')"
              >
                模拟 ￥30 SC
              </Button>
            </div>
          </div>

          <!-- 右侧预览舞台 -->
          <div class="rounded-lg border bg-muted/30 p-3.5 flex flex-col">
            <div class="flex-between mb-2">
              <span class="text-xs font-medium text-muted-foreground">OBS 画面实时预览</span>
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="previewBg"
                @update:model-value="(v) => v && (previewBg = v as any)"
              >
                <ToggleGroupItem value="checker">网格底</ToggleGroupItem>
                <ToggleGroupItem value="dark">暗黑底</ToggleGroupItem>
                <ToggleGroupItem value="transparent">透明底</ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div
              class="flex-1 min-h-[160px] rounded-md border flex-center overflow-hidden p-3"
              :class="{
                'bg-zinc-900': previewBg === 'dark',
                'bg-transparent': previewBg === 'transparent',
                'checker-bg': previewBg === 'checker',
              }"
            >
              <GoalDisplay
                :channel-id="channelId"
                inline-mode
              />
            </div>
          </div>
        </div>

        <Separator />

        <!-- 详细配置 -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div class="space-y-1.5">
            <span class="text-muted-foreground">显示模式</span>
            <Select
              :model-value="state.mode"
              @update:model-value="(v) => updateState({ mode: v as GoalMode })"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in modeOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">进度追踪维度</span>
            <Select
              :model-value="state.metric"
              @update:model-value="(v) => updateState({ metric: v as GoalMetric })"
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in metricOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">视觉主题</span>
            <Select
              :model-value="state.theme"
              @update:model-value="(v) => updateState({ theme: v as GoalTheme })"
            >
              <SelectTrigger>
                <SelectValue />
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
            <span class="text-muted-foreground">主标题</span>
            <Input
              :model-value="state.title"
              @update:model-value="(v) => updateState({ title: String(v) })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">副标题</span>
            <Input
              :model-value="state.subtitle"
              @update:model-value="(v) => updateState({ subtitle: String(v) })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">强调色</span>
            <ColorPicker
              :model-value="state.accentColor"
              @update:model-value="(v) => updateState({ accentColor: v })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">目标值</span>
            <NumberField
              :model-value="state.target"
              :min="1"
              @update:model-value="(v) => updateState({ target: v ?? 1 })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">单位文案 (如 舰 / 元)</span>
            <Input
              :model-value="state.unit"
              @update:model-value="(v) => updateState({ unit: String(v) })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">每 1 元礼物/SC 加钟 (秒)</span>
            <NumberField
              :model-value="state.secondsPerYuan"
              :min="0"
              @update:model-value="(v) => updateState({ secondsPerYuan: v ?? 0 })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">舰长加钟 (秒)</span>
            <NumberField
              :model-value="state.secondsPerJianzhang"
              :min="0"
              @update:model-value="(v) => updateState({ secondsPerJianzhang: v ?? 0 })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">提督加钟 (秒)</span>
            <NumberField
              :model-value="state.secondsPerTidu"
              :min="0"
              @update:model-value="(v) => updateState({ secondsPerTidu: v ?? 0 })"
            />
          </div>

          <div class="space-y-1.5">
            <span class="text-muted-foreground">总督加钟 (秒)</span>
            <NumberField
              :model-value="state.secondsPerZongdu"
              :min="0"
              @update:model-value="(v) => updateState({ secondsPerZongdu: v ?? 0 })"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.checker-bg {
  background-color: #202026;
  background-image:
    linear-gradient(45deg, #2b2b33 25%, transparent 25%),
    linear-gradient(-45deg, #2b2b33 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2b2b33 75%),
    linear-gradient(-45deg, transparent 75%, #2b2b33 75%);
  background-size: 16px 16px;
  background-position:
    0 0,
    0 8px,
    8px -8px,
    -8px 0;
}
</style>
