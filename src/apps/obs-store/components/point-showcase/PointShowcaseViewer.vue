<script setup lang="ts">
import { Gift, RefreshCw, SkipForward } from 'lucide-vue-next'
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiCheckinRanking } from '@/api/generated/check-in/check-in'
import { GoodsStatus } from '@/api/generated/model'
import { getApiPointGetGoods } from '@/api/generated/point/point'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
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

import PointShowcaseDisplay from './PointShowcaseDisplay.vue'
import { DEFAULT_POINT_SHOWCASE_STATE, POINT_SHOWCASE_MODE_OPTIONS } from './types'
import type { PointShowcaseAction, PointShowcaseMode, PointShowcaseState } from './types'

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
  useObsBridge<PointShowcaseState, PointShowcaseAction>({
    componentId: 'point-showcase',
    channelId,
    defaultState: DEFAULT_POINT_SHOWCASE_STATE,
    role: 'controller',
  })

const goodsCount = ref(0)
const rankingCount = ref(0)
const loadingData = ref(false)

async function loadSummary(notify = false) {
  if (!account.value.id) {
    goodsCount.value = 0
    rankingCount.value = 0
    return
  }
  loadingData.value = true
  try {
    const [goodsRes, rankRes] = await Promise.allSettled([
      getApiPointGetGoods({ id: String(account.value.id) }),
      getApiCheckinRanking({ vId: account.value.id, count: 10 }),
    ])
    if (goodsRes.status === 'fulfilled' && goodsRes.value.code === 200 && Array.isArray(goodsRes.value.data)) {
      goodsCount.value = goodsRes.value.data.filter((item) => item.status === GoodsStatus.Normal).length
    } else {
      goodsCount.value = 0
    }
    if (rankRes.status === 'fulfilled' && rankRes.value.code === 200 && Array.isArray(rankRes.value.data)) {
      rankingCount.value = rankRes.value.data.length
    } else {
      rankingCount.value = 0
    }
    if (notify) {
      sendAction({ type: 'REFRESH' })
      toast.success('已刷新积分商品与签到榜数据')
    }
  } finally {
    loadingData.value = false
  }
}

watch(
  () => account.value.id,
  () => {
    void loadSummary(false)
  },
  { immediate: true },
)

function triggerNextSlide() {
  sendAction({ type: 'NEXT_SLIDE' })
}
</script>

<template>
  <ObsWidgetWorkbench
    component-id="point-showcase"
    title="积分商城与签到榜"
    version="v1.0"
    obs-path="/obs-store/point-showcase"
    recommended-size="380 × 320 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="310"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <div class="flex-between gap-2">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Gift class="size-3.5 text-brand" />
          <span>积分与签到状态</span>
        </div>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="xs"
            class="gap-1"
            @click="triggerNextSlide"
          >
            <SkipForward class="size-3.5" />
            切下一屏
          </Button>
          <Button
            variant="outline"
            size="xs"
            class="gap-1"
            :disabled="loadingData"
            @click="loadSummary(true)"
          >
            <RefreshCw
              class="size-3.5"
              :class="{ 'animate-spin': loadingData }"
            />
            刷新
          </Button>
        </div>
      </div>

      <div class="rounded-md border border-border bg-card p-2.5 space-y-1.5 text-xs">
        <div class="flex-between gap-2">
          <span class="text-muted-foreground">在售积分商品</span>
          <Badge
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ goodsCount }} 件
          </Badge>
        </div>
        <div class="flex-between gap-2">
          <span class="text-muted-foreground">签到榜上榜人数</span>
          <Badge
            variant="secondary"
            size="xs"
            class="tabular-nums"
          >
            {{ rankingCount }} 人
          </Badge>
        </div>
      </div>

      <FormField label="展示模式">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-3"
          :model-value="state.mode"
          @update:model-value="(val) => val && updateState({ mode: val as PointShowcaseMode })"
        >
          <ToggleGroupItem
            v-for="opt in POINT_SHOWCASE_MODE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <div class="grid grid-cols-2 gap-2.5">
        <FormField
          label="轮播间隔 (秒)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.rotateIntervalSeconds"
            :min="3"
            :max="60"
            class="w-full"
            @update:model-value="
              (val) => updateState({ rotateIntervalSeconds: Math.max(3, Math.min(60, Number(val) || 8)) })
            "
          />
        </FormField>

        <FormField
          label="展示条数 (3~10)"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.maxItems"
            :min="3"
            :max="10"
            class="w-full"
            @update:model-value="(val) => updateState({ maxItems: Math.max(3, Math.min(10, Number(val) || 5)) })"
          />
        </FormField>
      </div>

      <SettingRow
        title="示例数据预览"
        description="商品或签到榜为空时使用虚拟内容预览样式"
        variant="compact"
        type="switch"
        :model-value="state.useSampleData"
        @update:model-value="(val) => updateState({ useSampleData: Boolean(val) })"
      />
    </template>

    <template #preview>
      <PointShowcaseDisplay
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
            placeholder="例如：积分商城 · 签到榜"
            @update:model-value="(val) => updateState({ title: String(val ?? '') })"
          />
        </FormField>

        <FormField
          label="底部引导标语"
          class="min-w-0 sm:col-span-2"
        >
          <Input
            :model-value="state.ctaText"
            placeholder="例如：直播间发送「签到」领积分兑换好礼"
            @update:model-value="(val) => updateState({ ctaText: String(val ?? '') })"
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
            @update:model-value="(val) => updateState({ accentColor: String(val || '#f59e0b') })"
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
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
