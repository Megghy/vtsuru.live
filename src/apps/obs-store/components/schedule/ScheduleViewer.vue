<script setup lang="ts">
import { CalendarDays, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { ResponseScheduleModel } from '@/api/generated/model'
import { getApiScheduleGet } from '@/api/generated/schedule/schedule'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import {
  buildScheduleDays,
  getCurrentWeekOrder,
  getWeekDateRange,
  getWeekOrder,
} from '@/apps/user/pages/scheduleTemplate/scheduleTemplateUtils'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import ScheduleDisplay from './ScheduleDisplay.vue'
import { DEFAULT_SCHEDULE_STATE, SCHEDULE_LAYOUT_OPTIONS } from './types'
import type { ScheduleLayout, ScheduleWidgetAction, ScheduleWidgetState } from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))

watch(
  () => [props.channelId, route.query.channel] as const,
  ([propVal, queryVal]) => {
    channelId.value = resolveObsSyncChannel(propVal ?? queryVal)
  },
)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<ScheduleWidgetState, ScheduleWidgetAction>({
    componentId: 'schedule',
    channelId,
    defaultState: DEFAULT_SCHEDULE_STATE,
    role: 'controller',
  })

const weeks = ref<ResponseScheduleModel[]>([])
const loadingData = ref(false)

async function loadScheduleSummary(notify = false) {
  if (!account.value.id) {
    weeks.value = []
    return
  }
  loadingData.value = true
  try {
    const res = await getApiScheduleGet({ id: String(account.value.id) })
    weeks.value = res.code === 200 && Array.isArray(res.data) ? res.data : []
    if (notify) {
      sendAction({ type: 'REFRESH' })
      toast.success('已刷新本周直播日程并通知 OBS 画面')
    }
  } catch {
    if (notify) toast.error('拉取直播日程失败，请稍后重试')
  } finally {
    loadingData.value = false
  }
}

watch(
  () => account.value.id,
  () => {
    void loadScheduleSummary(false)
  },
  { immediate: true },
)

const activeWeekSummary = computed(() => {
  if (!weeks.value.length) return null
  const now = new Date()
  const order = getCurrentWeekOrder(now)
  const target = weeks.value.find((w) => getWeekOrder(w.year, w.week) === order) ?? weeks.value[0]
  if (!target) return null
  const days = buildScheduleDays(target, now)
  const eventCount = days.reduce((sum, d) => sum + d.items.length, 0)
  return {
    range: getWeekDateRange(target.year, target.week),
    eventCount,
    activeDays: days.filter((d) => d.items.length > 0).length,
  }
})

const recommendedSize = computed(() => (state.value.layout === 'strip' ? '960 × 160 px' : '420 × 480 px'))
const stageMinHeight = computed(() => (state.value.layout === 'strip' ? 210 : 380))
</script>

<template>
  <ObsWidgetWorkbench
    component-id="schedule"
    title="直播日程表挂件"
    version="v1.0"
    obs-path="/obs-store/schedule"
    :recommended-size="recommendedSize"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="stageMinHeight"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <div class="flex-between gap-2">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <CalendarDays class="size-3.5 text-brand" />
          <span>日程数据源</span>
        </div>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          :disabled="loadingData"
          @click="loadScheduleSummary(true)"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': loadingData }"
          />
          立即刷新
        </Button>
      </div>

      <div class="rounded-md border border-border bg-card p-2.5 space-y-1.5 text-xs">
        <div class="flex-between gap-2">
          <span class="text-muted-foreground">当前同步周</span>
          <Badge
            v-if="activeWeekSummary"
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ activeWeekSummary.range }}
          </Badge>
          <Badge
            v-else
            variant="outline"
            size="xs"
          >
            暂无数据
          </Badge>
        </div>
        <div class="flex-between gap-2">
          <span class="text-muted-foreground">本周安排统计</span>
          <span
            v-if="activeWeekSummary"
            class="font-medium text-foreground tabular-nums"
          >
            {{ activeWeekSummary.activeDays }} 天 · {{ activeWeekSummary.eventCount }} 场活动
          </span>
          <span
            v-else
            class="text-[11px] text-muted-foreground"
          >
            可先开启下方示例预览
          </span>
        </div>
      </div>

      <FormField label="排版布局">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-3"
          :model-value="state.layout"
          @update:model-value="(val) => val && updateState({ layout: val as ScheduleLayout })"
        >
          <ToggleGroupItem
            v-for="opt in SCHEDULE_LAYOUT_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <div class="space-y-2">
        <SettingRow
          title="自动高亮今日"
          description="为当天日程添加强调边框与 TODAY 标记"
          variant="compact"
          type="switch"
          :model-value="state.highlightToday"
          @update:model-value="(val) => updateState({ highlightToday: Boolean(val) })"
        />

        <SettingRow
          title="隐藏无安排日期"
          description="开启后仅显示有直播计划的日期"
          variant="compact"
          type="switch"
          :model-value="state.hideEmptyDays"
          @update:model-value="(val) => updateState({ hideEmptyDays: Boolean(val) })"
        />

        <SettingRow
          title="示例数据预览"
          description="后台未配置日程时使用虚拟日程预览排版"
          variant="compact"
          type="switch"
          :model-value="state.useSampleData"
          @update:model-value="(val) => updateState({ useSampleData: Boolean(val) })"
        />
      </div>
    </template>

    <template #preview>
      <ScheduleDisplay
        :channel-id="channelId"
        :user-id="account.id"
        :inline-mode="true"
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <FormField
          label="主标题"
          class="min-w-0"
        >
          <Input
            :model-value="state.title"
            placeholder="例如：本周直播日程"
            @update:model-value="(val) => updateState({ title: String(val ?? '') })"
          />
        </FormField>

        <FormField
          label="副标题（留空显示日期区间）"
          class="min-w-0"
        >
          <Input
            :model-value="state.subtitle"
            placeholder="例如：每晚 20:00 不见不散"
            @update:model-value="(val) => updateState({ subtitle: String(val ?? '') })"
          />
        </FormField>

        <FormField
          label="休息日文案"
          class="min-w-0"
        >
          <Input
            :model-value="state.restDayText"
            placeholder="例如：休息日 / 自由摸鱼"
            :disabled="state.hideEmptyDays"
            @update:model-value="(val) => updateState({ restDayText: String(val ?? '') })"
          />
        </FormField>

        <FormField
          label="视觉主题"
          class="min-w-0"
        >
          <Select
            :model-value="state.theme"
            @update:model-value="(val) => updateState({ theme: val as ObsWidgetTheme })"
          >
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择主题" />
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
          label="强调色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="state.accentColor"
            @update:model-value="(val) => updateState({ accentColor: String(val || '#38bdf8') })"
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
            @update:model-value="(val) => updateState({ fontFamily: val || '' })"
          />
        </FormField>

        <FormField
          label="自动刷新间隔 (分钟)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.refreshIntervalMinutes"
            :min="1"
            :max="60"
            class="w-full"
            @update:model-value="
              (val) => updateState({ refreshIntervalMinutes: Math.max(1, Math.min(60, Number(val) || 10)) })
            "
          />
        </FormField>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
