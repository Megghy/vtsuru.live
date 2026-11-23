<script setup lang="ts">
import {
  Minus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { getApiHistoryFans, getApiHistoryGuardsStats } from '@/api/generated/history/history'
import { EventDataTypes, GuardLevel } from '@/api/generated/model'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { fetchOfficialLiveStats } from '@/shared/services/officialLiveStats'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import GoalDisplay from './GoalDisplay.vue'
import { computeGoalEventDelta, formatCountdownClock, getVisibleRemainingMs } from './goalEngine'
import { DEFAULT_GOAL_STATE } from './types'
import type { GoalAction, GoalMetric, GoalMilestone, GoalMode, GoalState, GoalTheme } from './types'

const route = useRoute()
const account = useAccount()
const danmakuClient = useDanmakuClient()

const props = defineProps<{ channelId?: string }>()
const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))
watch(
  () => props.channelId,
  (val) => {
    if (val) channelId.value = resolveObsSyncChannel(val)
  },
)

const autoTrackEvents = ref(false)
const isSyncingExternal = ref(false)
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

const modeOptions: { label: string; value: GoalMode }[] = [
  { label: '目标 + 耐久双显', value: 'combo' },
  { label: '仅目标进度条', value: 'goal' },
  { label: '仅耐久倒计时', value: 'subathon' },
]

const metricOptions: { label: string; value: GoalMetric; defaultUnit: string; defaultTitle: string }[] = [
  { label: '舰长人数', value: 'guard', defaultUnit: '舰', defaultTitle: '本月舰长目标' },
  { label: '礼物/SC/上舰金额 (元)', value: 'amount', defaultUnit: '元', defaultTitle: '本场营收目标' },
  { label: '指定单品礼物个数', value: 'gift_count', defaultUnit: '个', defaultTitle: '单品礼物收集目标' },
  { label: '粉丝数里程碑', value: 'fans', defaultUnit: '粉', defaultTitle: '粉丝里程碑目标' },
  { label: '本场点赞数', value: 'likes', defaultUnit: '赞', defaultTitle: '本场点赞目标' },
  { label: '仅手动增减', value: 'manual', defaultUnit: '', defaultTitle: '直播自定义目标' },
]

const clockDisplay = computed(() => formatCountdownClock(getVisibleRemainingMs(state.value, nowMs.value)))

function handleMetricChange(metric: GoalMetric) {
  const meta = metricOptions.find((m) => m.value === metric)
  updateState({
    metric,
    unit: meta?.defaultUnit ?? state.value.unit,
  })
}

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

/** 一键从后端/B站同步当前真实基数（总舰长/粉丝数/本场点赞） */
async function syncRealMetricBaseline() {
  isSyncingExternal.value = true
  try {
    if (state.value.metric === 'guard') {
      const res = await getApiHistoryGuardsStats()
      if (res.code === 200 && res.data) {
        updateState({ current: res.data.totalCount ?? 0 })
        toast.success(`已同步当前总舰长数：${res.data.totalCount ?? 0}`)
      } else {
        toast.warning('未能获取到舰长统计数据')
      }
    } else if (state.value.metric === 'fans') {
      const res = await getApiHistoryFans()
      const list = res.code === 200 && Array.isArray(res.data) ? res.data : []
      const latest = list.length ? list[list.length - 1] : null
      if (latest) {
        updateState({ current: latest.count })
        toast.success(`已同步最新粉丝数：${latest.count}`)
      } else {
        toast.warning('暂无粉丝历史数据')
      }
    } else if (state.value.metric === 'likes') {
      const roomId = account.value.biliRoomId ?? 0
      const uid = account.value.biliId ?? 0
      if (!roomId) {
        toast.warning('请先在账号中绑定 B 站直播间')
        return
      }
      const stats = await fetchOfficialLiveStats(roomId, uid)
      if (stats.totalLikes !== null) {
        updateState({ current: stats.totalLikes })
        toast.success(`已同步本场累计点赞：${stats.totalLikes}`)
      } else {
        toast.warning('当前未获取到本场点赞数据')
      }
    }
  } catch (err) {
    toast.error(`同步失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSyncingExternal.value = false
  }
}

const canSyncBaseline = computed(
  () => state.value.metric === 'guard' || state.value.metric === 'fans' || state.value.metric === 'likes',
)

// 里程碑编辑
function addMilestone() {
  const list = [...(state.value.milestones ?? [])]
  const nextTarget = list.length > 0 ? Math.max(...list.map((m) => m.target)) + 10 : Math.max(10, Math.round(state.value.target / 2))
  list.push({
    id: `ms-${Date.now()}`,
    target: nextTarget,
    label: '解锁新福利',
  })
  updateState({ milestones: list })
}

function updateMilestone(index: number, patch: Partial<GoalMilestone>) {
  const list = [...(state.value.milestones ?? [])]
  if (!list[index]) return
  list[index] = { ...list[index], ...patch }
  updateState({ milestones: list })
}

function removeMilestone(index: number) {
  const list = [...(state.value.milestones ?? [])]
  list.splice(index, 1)
  updateState({ milestones: list })
}

function handleIncomingEvent(event: EventModel) {
  if (!autoTrackEvents.value) return
  if (
    event.type !== EventDataTypes.Guard &&
    event.type !== EventDataTypes.Gift &&
    event.type !== EventDataTypes.SC &&
    event.type !== EventDataTypes.Like &&
    event.type !== EventDataTypes.Follow
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
    giftName: event.msg,
  })
  if (!res) return
  updateState(res.patch)
  if (res.addedSeconds > 0) {
    sendAction({ type: 'DELTA_TIME', seconds: res.addedSeconds, label: res.deltaText })
  } else {
    sendAction({ type: 'DELTA_PROGRESS', amount: res.addedProgress, label: res.deltaText })
  }
}

function simulateEvent(kind: 'guard' | 'sc' | 'gift' | 'like') {
  const payload =
    kind === 'guard'
      ? { type: EventDataTypes.Guard, priceYuan: 198, guardLevel: GuardLevel.Jianzhang, num: 1 }
      : kind === 'sc'
        ? { type: EventDataTypes.SC, priceYuan: 30, num: 1 }
        : kind === 'gift'
          ? { type: EventDataTypes.Gift, priceYuan: 5.2, num: 5, giftName: state.value.targetGiftName || '小花花' }
          : { type: EventDataTypes.Like, priceYuan: 0, num: 10 }

  const res = computeGoalEventDelta(state.value, payload)
  if (!res) {
    toast.info('当前模式与追踪维度下此事件不触发推进')
    return
  }
  updateState(res.patch)
  if (res.addedSeconds > 0) {
    sendAction({ type: 'DELTA_TIME', seconds: res.addedSeconds, label: res.deltaText })
  } else {
    sendAction({ type: 'DELTA_PROGRESS', amount: res.addedProgress, label: res.deltaText })
  }
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
</script>

<template>
  <ObsWidgetWorkbench
    component-id="goal"
    title="目标进度与耐久加钟"
    version="v1.1"
    obs-path="/obs-store/goal"
    recommended-size="460 × 170 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="180"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <SettingRow
        title="自动追踪直播间事件"
        description="实时响应上舰 / 礼物 / SC / 点赞 / 关注"
        variant="none"
      >
        <Switch
          :model-value="autoTrackEvents"
          @update:model-value="(val: boolean) => (autoTrackEvents = val)"
        />
      </SettingRow>

      <!-- 进度快捷控制 -->
      <div
        v-if="state.mode !== 'subathon'"
        class="space-y-2 rounded-md border border-border bg-background p-3"
      >
        <div class="flex-between text-xs">
          <span class="text-muted-foreground">当前进度</span>
          <span class="font-mono font-semibold tabular-nums">
            {{ state.current }} / {{ state.target }} {{ state.unit }}
          </span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Button
            variant="brand"
            size="xs"
            class="gap-1"
            @click="handleProgressDelta(1)"
          >
            <Plus class="size-3.5" />
            +1
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="handleProgressDelta(5)"
          >
            +5
          </Button>
          <Button
            size="xs"
            variant="outline"
            :disabled="state.current <= 0"
            class="gap-1"
            @click="handleProgressDelta(-1)"
          >
            <Minus class="size-3.5" />
            -1
          </Button>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            @click="updateState({ current: 0 })"
          >
            <RotateCcw class="size-3.5" />
            清零
          </Button>
          <Button
            v-if="canSyncBaseline"
            size="xs"
            variant="secondary"
            :disabled="isSyncingExternal"
            class="gap-1 ml-auto"
            @click="syncRealMetricBaseline"
          >
            <RefreshCw
              class="size-3.5"
              :class="{ 'animate-spin': isSyncingExternal }"
            />
            同步当前真实值
          </Button>
        </div>
      </div>

      <!-- 耐久倒计时控制 -->
      <div
        v-if="state.mode !== 'goal'"
        class="space-y-2 rounded-md border border-border bg-background p-3"
      >
        <div class="flex-between text-xs">
          <span class="text-muted-foreground">耐久倒计时</span>
          <span class="font-mono font-bold text-sm tabular-nums">{{ clockDisplay }}</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          <Button
            size="xs"
            :variant="state.countdownPaused ? 'brand' : 'secondary'"
            class="gap-1"
            @click="toggleCountdown"
          >
            <Play
              v-if="state.countdownPaused"
              class="size-3.5"
            />
            <Pause
              v-else
              class="size-3.5"
            />
            {{ state.countdownPaused ? '开始' : '暂停' }}
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="handleTimeDelta(300)"
          >
            +5分
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="handleTimeDelta(600)"
          >
            +10分
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="handleTimeDelta(-300)"
          >
            -5分
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="resetCountdown(60)"
          >
            重置1h
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-1.5 pt-1">
        <span class="text-[11px] text-muted-foreground">模拟测试:</span>
        <Button
          size="xs"
          variant="outline"
          @click="simulateEvent('guard')"
        >
          +1 舰长
        </Button>
        <Button
          size="xs"
          variant="outline"
          @click="simulateEvent('sc')"
        >
          ￥30 SC
        </Button>
        <Button
          size="xs"
          variant="outline"
          @click="simulateEvent('gift')"
        >
          单品礼物×5
        </Button>
        <Button
          size="xs"
          variant="outline"
          @click="simulateEvent('like')"
        >
          +10 赞
        </Button>
      </div>
    </template>

    <template #preview>
      <GoalDisplay
        :channel-id="channelId"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField
          label="显示模式"
          class="min-w-0"
        >
          <Select
            :model-value="state.mode"
            @update:model-value="(v) => updateState({ mode: v as GoalMode })"
          >
            <SelectTrigger class="w-full">
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
        </FormField>

        <FormField
          label="进度追踪维度"
          class="min-w-0"
        >
          <Select
            :model-value="state.metric"
            @update:model-value="(v) => handleMetricChange(v as GoalMetric)"
          >
            <SelectTrigger class="w-full">
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
        </FormField>

        <FormField
          label="视觉主题"
          class="min-w-0"
        >
          <Select
            :model-value="state.theme"
            @update:model-value="(v) => updateState({ theme: v as GoalTheme })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in OBS_WIDGET_THEME_OPTIONS"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField
          label="主标题"
          class="min-w-0"
        >
          <Input
            :model-value="state.title"
            @update:model-value="(v) => updateState({ title: String(v) })"
          />
        </FormField>

        <FormField
          label="副标题"
          class="min-w-0"
        >
          <Input
            :model-value="state.subtitle"
            @update:model-value="(v) => updateState({ subtitle: String(v) })"
          />
        </FormField>

        <FormField
          label="强调色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="state.accentColor"
            @update:model-value="(v) => updateState({ accentColor: v })"
          />
        </FormField>

        <FormField
          v-if="state.metric === 'gift_count'"
          label="目标礼物名称关键词"
          description="留空则统计所有礼物个数"
          class="min-w-0"
        >
          <Input
            :model-value="state.targetGiftName"
            placeholder="例如：小花花"
            @update:model-value="(v) => updateState({ targetGiftName: String(v) })"
          />
        </FormField>

        <FormField
          label="目标值"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.target"
            :min="1"
            @update:model-value="(v) => updateState({ target: v ?? 1 })"
          />
        </FormField>

        <FormField
          label="单位文案 (如 舰 / 元 / 个)"
          class="min-w-0"
        >
          <Input
            :model-value="state.unit"
            @update:model-value="(v) => updateState({ unit: String(v) })"
          />
        </FormField>

        <FormField
          label="字体"
          class="min-w-0"
        >
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            @update:model-value="updateState({ fontFamily: $event || '' })"
          />
        </FormField>

        <FormField
          label="每 1 元礼物/SC 加钟 (秒)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.secondsPerYuan"
            :min="0"
            @update:model-value="(v) => updateState({ secondsPerYuan: v ?? 0 })"
          />
        </FormField>

        <FormField
          label="舰长加钟 (秒)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.secondsPerJianzhang"
            :min="0"
            @update:model-value="(v) => updateState({ secondsPerJianzhang: v ?? 0 })"
          />
        </FormField>

        <FormField
          label="提督加钟 (秒)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.secondsPerTidu"
            :min="0"
            @update:model-value="(v) => updateState({ secondsPerTidu: v ?? 0 })"
          />
        </FormField>

        <FormField
          label="总督加钟 (秒)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.secondsPerZongdu"
            :min="0"
            @update:model-value="(v) => updateState({ secondsPerZongdu: v ?? 0 })"
          />
        </FormField>
      </div>

      <Separator />

      <!-- 阶段里程碑配置 -->
      <div class="space-y-3">
        <div class="flex-between gap-2">
          <div>
            <div class="text-xs font-semibold text-foreground">阶段里程碑节点</div>
            <div class="text-[11px] text-muted-foreground">在进度条上标记阶段福利，自动预告下一个待解锁节点</div>
          </div>
          <div class="flex items-center gap-2">
            <Switch
              :model-value="state.showMilestones"
              @update:model-value="(v: boolean) => updateState({ showMilestones: v })"
            />
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              @click="addMilestone"
            >
              <Plus class="size-3.5" />
              添加阶段
            </Button>
          </div>
        </div>

        <div
          v-if="state.showMilestones && state.milestones?.length"
          class="space-y-2"
        >
          <div
            v-for="(ms, idx) in state.milestones"
            :key="ms.id"
            class="grid grid-cols-12 gap-2 items-center"
          >
            <div class="col-span-3 min-w-0">
              <NumberField
                :model-value="ms.target"
                :min="1"
                @update:model-value="(v) => updateMilestone(idx, { target: v ?? 1 })"
              />
            </div>
            <div class="col-span-8 min-w-0">
              <Input
                :model-value="ms.label"
                placeholder="阶段解锁福利文案"
                @update:model-value="(v) => updateMilestone(idx, { label: String(v) })"
              />
            </div>
            <div class="col-span-1 flex justify-end">
              <Button
                size="icon-xs"
                variant="ghost"
                @click="removeMilestone(idx)"
              >
                <Trash2 class="size-3.5 text-muted-foreground" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingRow
          title="显示完成百分比"
          variant="card"
        >
          <Switch
            :model-value="state.showPercent"
            @update:model-value="(v: boolean) => updateState({ showPercent: v })"
          />
        </SettingRow>

        <SettingRow
          title="OBS 端携带登录态时本地直连保活"
          description="关闭管理页后，已登录的 OBS 源仍可实时增量响应"
          variant="card"
        >
          <Switch
            :model-value="state.directTrackOnObs"
            @update:model-value="(v: boolean) => updateState({ directTrackOnObs: v })"
          />
        </SettingRow>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
