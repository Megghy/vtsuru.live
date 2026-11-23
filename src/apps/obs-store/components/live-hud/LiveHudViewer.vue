<script setup lang="ts">
import { RefreshCw, Sparkles } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiHistoryFans, getApiHistoryGuardsStats } from '@/api/generated/history/history'
import { getApiLiveCurrent } from '@/api/generated/live/live'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
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
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import LiveHudDisplay from './LiveHudDisplay.vue'
import {
  DEFAULT_LIVE_HUD_STATE,
  LIVE_HUD_METRIC_LIST,
  SAMPLE_LIVE_HUD_METRICS,
  normalizeEpochMs,
} from './types'
import type { LiveHudAction, LiveHudLayout, LiveHudMetricKey, LiveHudMetrics, LiveHudSize, LiveHudState } from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))
watch(
  () => props.channelId ?? route.query.channel,
  (val) => {
    if (!val) return
    channelId.value = resolveObsSyncChannel(val)
  },
)

const { state, updateState, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<LiveHudState, LiveHudAction>({
    componentId: 'live-hud',
    channelId,
    defaultState: DEFAULT_LIVE_HUD_STATE,
    role: 'controller',
  })

const autoSync = ref(false)
const isFetchingMetrics = ref(false)
let syncTimer: ReturnType<typeof setInterval> | undefined

const layoutOptions: { label: string; value: LiveHudLayout }[] = [
  { label: '单行胶囊', value: 'pill' },
  { label: '分块卡片', value: 'card' },
  { label: '竖排侧栏', value: 'vertical' },
]

const sizeOptions: { label: string; value: LiveHudSize }[] = [
  { label: '标准', value: 'standard' },
  { label: '紧凑', value: 'compact' },
]

const lastUpdatedLabel = computed(() => {
  const ts = state.value.metrics?.updatedAt
  if (!ts) return '尚未同步真实数据'
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `上次同步：${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
})

function toggleMetric(key: LiveHudMetricKey, enabled: boolean) {
  void updateState({
    visibleMetrics: {
      ...DEFAULT_LIVE_HUD_STATE.visibleMetrics,
      ...state.value.visibleMetrics,
      [key]: enabled,
    },
  })
}

function patchMetrics(patch: Partial<LiveHudMetrics>) {
  void updateState({
    useSampleData: false,
    metrics: {
      ...DEFAULT_LIVE_HUD_STATE.metrics,
      ...state.value.metrics,
      ...patch,
    },
  })
}

function fillSampleIntoMetrics() {
  const startAt = Date.now() - (1 * 3600 + 25 * 60) * 1000
  void updateState({
    useSampleData: false,
    metrics: {
      ...SAMPLE_LIVE_HUD_METRICS,
      liveStartAt: startAt,
      updatedAt: Date.now(),
    },
  })
  toast.success('已填充示例数值到指标区')
}

async function syncRealMetrics(silent = false) {
  if (isFetchingMetrics.value) return
  isFetchingMetrics.value = true
  try {
    const roomId = account.value.biliRoomId ?? 0
    const biliUid = account.value.biliId ?? undefined

    const [officialRes, liveRes, fansRes, guardsRes] = await Promise.allSettled([
      roomId > 0 ? fetchOfficialLiveStats(roomId, biliUid) : Promise.resolve(null),
      getApiLiveCurrent(),
      getApiHistoryFans(),
      getApiHistoryGuardsStats(),
    ])

    const current = state.value.metrics ?? DEFAULT_LIVE_HUD_STATE.metrics
    const next: LiveHudMetrics = {
      ...current,
      updatedAt: Date.now(),
    }

    let okCount = 0

    if (officialRes.status === 'fulfilled' && officialRes.value) {
      const stats = officialRes.value
      if (stats.onlineRank !== null) next.onlineRank = stats.onlineRank
      if (stats.totalLikes !== null) next.totalLikes = stats.totalLikes
      if (stats.watchedCount !== null) next.watchedCount = stats.watchedCount
      okCount++
    }

    if (liveRes.status === 'fulfilled' && liveRes.value.code === 200) {
      const live = liveRes.value.data?.live
      if (live && !live.isFinish) {
        next.isLive = true
        next.liveStartAt = normalizeEpochMs(live.startAt)
        next.danmakuCount = live.danmakusCount ?? next.danmakuCount
        if (next.totalLikes === 0 && live.likeCount > 0) {
          next.totalLikes = live.likeCount
        }
      } else {
        next.isLive = false
        next.liveStartAt = 0
      }
      okCount++
    }

    if (fansRes.status === 'fulfilled' && fansRes.value.code === 200) {
      const list = fansRes.value.data ?? []
      if (list.length > 0) {
        const latest = list.reduce((acc, item) => (item.time >= acc.time ? item : acc), list[0])
        next.fansCount = latest.count
      }
      okCount++
    }

    if (guardsRes.status === 'fulfilled' && guardsRes.value.code === 200 && guardsRes.value.data) {
      next.guardCount = guardsRes.value.data.totalCount
      okCount++
    }

    if (okCount === 0) {
      if (!silent) toast.error('同步失败，请检查登录状态或房间绑定')
      return
    }

    await updateState({
      useSampleData: false,
      metrics: next,
    })

    if (!silent) {
      toast.success(next.isLive ? '已同步最新直播间实时数据' : '已同步站内粉丝与舰长数据（当前未开播）')
    }
  } finally {
    isFetchingMetrics.value = false
  }
}

function stopAutoSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = undefined
  }
}

watch(autoSync, (enabled) => {
  stopAutoSync()
  if (enabled) {
    void syncRealMetrics(true)
    syncTimer = setInterval(() => {
      void syncRealMetrics(true)
    }, 20_000)
    toast.success('已开启自动同步（每 20 秒刷新真实数据）')
  }
})

onUnmounted(() => {
  stopAutoSync()
})
</script>

<template>
  <ObsWidgetWorkbench
    component-id="live-hud"
    title="直播间状态看板 (Live HUD)"
    obs-path="/obs-store/live-hud"
    recommended-size="620 × 84 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="200"
    @update:channel-id="(val) => (channelId = val)"
    @retry="retry"
  >
    <template #controls>
      <SettingRow
        v-model="autoSync"
        type="switch"
        variant="card"
        title="自动同步真实数据（每 20 秒）"
        :description="lastUpdatedLabel"
      />

      <div class="flex flex-wrap gap-2">
        <Button
          variant="outline"
          class="flex-1 gap-1.5"
          :disabled="isFetchingMetrics"
          @click="syncRealMetrics(false)"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': isFetchingMetrics }"
          />
          立即刷新真实数据
        </Button>
        <Button
          variant="secondary"
          class="gap-1.5"
          @click="fillSampleIntoMetrics"
        >
          <Sparkles class="size-3.5" />
          写入示例值
        </Button>
      </div>

      <SettingRow
        type="switch"
        variant="compact"
        title="示例数据预览"
        description="未开播时开启此项可在 OBS 与场景编辑器中预览真实排版"
        :model-value="state.useSampleData"
        @change="(val: boolean) => updateState({ useSampleData: val })"
      />

      <Separator />

      <div class="space-y-2">
        <div class="text-xs font-semibold text-foreground">展示指标勾选</div>
        <div class="grid grid-cols-2 gap-1.5">
          <SettingRow
            v-for="item in LIVE_HUD_METRIC_LIST"
            :key="item.key"
            type="switch"
            variant="compact"
            :title="item.label"
            :model-value="Boolean(state.visibleMetrics?.[item.key])"
            @change="(val: boolean) => toggleMetric(item.key, val)"
          />
        </div>
      </div>
    </template>

    <template #stage-actions>
      <Button
        variant="outline"
        size="xs"
        class="gap-1"
        :disabled="isFetchingMetrics"
        @click="syncRealMetrics(false)"
      >
        <RefreshCw
          class="size-3.5"
          :class="{ 'animate-spin': isFetchingMetrics }"
        />
        刷新
      </Button>
    </template>

    <template #preview>
      <LiveHudDisplay
        :channel-id="channelId"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <FormField label="布局形态" class="min-w-0">
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-3"
            :model-value="state.layout"
            @update:model-value="(val) => val && updateState({ layout: val as LiveHudLayout })"
          >
            <ToggleGroupItem
              v-for="opt in layoutOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField label="视觉主题" class="min-w-0">
          <Select
            :model-value="state.theme"
            @update:model-value="(val) => updateState({ theme: val as ObsWidgetTheme })"
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

        <FormField label="尺寸密度" class="min-w-0">
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-2"
            :model-value="state.size"
            @update:model-value="(val) => val && updateState({ size: val as LiveHudSize })"
          >
            <ToggleGroupItem
              v-for="opt in sizeOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField label="强调色" class="min-w-0">
          <ColorPicker
            :model-value="state.accentColor"
            :show-alpha="false"
            @update:model-value="(val) => updateState({ accentColor: val })"
          />
        </FormField>

        <FormField label="自定义字体" class="min-w-0">
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            @update:model-value="(val) => updateState({ fontFamily: val || '' })"
          />
        </FormField>

        <FormField label="LIVE 状态文案" class="min-w-0">
          <div class="flex items-center gap-2">
            <Input
              :model-value="state.liveLabel"
              class="flex-1 min-w-0"
              placeholder="LIVE"
              @update:model-value="(val) => updateState({ liveLabel: String(val) })"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="红点"
              :model-value="state.showLiveDot"
              @change="(val: boolean) => updateState({ showLiveDot: val })"
            />
          </div>
        </FormField>
      </div>

      <Separator />

      <div class="space-y-2.5">
        <div class="flex-between">
          <span class="text-xs font-semibold text-foreground">手动数值覆盖（关闭示例预览后生效）</span>
          <SettingRow
            type="switch"
            variant="none"
            title="当前处于直播中"
            :model-value="Boolean(state.metrics?.isLive)"
            @change="(val: boolean) => patchMetrics({ isLive: val, liveStartAt: val ? (state.metrics?.liveStartAt || Date.now()) : 0 })"
          />
        </div>

        <div class="grid grid-cols-2 md:grid-cols-6 gap-2.5">
          <FormField label="高能在线" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.onlineRank ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ onlineRank: val ?? 0 })"
            />
          </FormField>
          <FormField label="本场点赞" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.totalLikes ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ totalLikes: val ?? 0 })"
            />
          </FormField>
          <FormField label="累计看过" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.watchedCount ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ watchedCount: val ?? 0 })"
            />
          </FormField>
          <FormField label="粉丝数" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.fansCount ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ fansCount: val ?? 0 })"
            />
          </FormField>
          <FormField label="当前总舰长" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.guardCount ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ guardCount: val ?? 0 })"
            />
          </FormField>
          <FormField label="本场弹幕" class="min-w-0">
            <NumberField
              :model-value="state.metrics?.danmakuCount ?? 0"
              :min="0"
              @update:model-value="(val) => patchMetrics({ danmakuCount: val ?? 0 })"
            />
          </FormField>
        </div>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
