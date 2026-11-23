<script setup lang="ts">
import { Download, Gift, Sparkles, Trash2 } from 'lucide-vue-next'
import { onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import type { EventModel } from '@/api/client-types'
import { getApiLiveCurrent, getApiLiveRanking } from '@/api/generated/live/live'
import { GuardLevel } from '@/api/generated/model'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import GiftBoardDisplay from './GiftBoardDisplay.vue'
import {
  DEFAULT_GIFT_BOARD_STATE,
  SAMPLE_GIFT_BOARD_GUARDS,
  SAMPLE_GIFT_BOARD_RANKING,
  SAMPLE_GIFT_BOARD_THANKS,
} from './types'
import type {
  GiftBoardAction,
  GiftBoardGuardItem,
  GiftBoardRankingItem,
  GiftBoardState,
  GiftBoardThanksItem,
  GiftBoardViewMode,
} from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const danmakuClient = useDanmakuClient()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))
watch(
  () => props.channelId ?? route.query.channel,
  (val) => {
    if (!val) return
    channelId.value = resolveObsSyncChannel(val)
  },
)

const { state, updateState, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<GiftBoardState, GiftBoardAction>({
    componentId: 'gift-board',
    channelId,
    defaultState: DEFAULT_GIFT_BOARD_STATE,
    role: 'controller',
  })

const autoTrack = ref(false)
const isLoadingRanking = ref(false)
const seenEventKeys = new Set<string>()

const viewModeOptions: { label: string; value: GiftBoardViewMode }[] = [
  { label: '投喂榜', value: 'ranking' },
  { label: '感谢流', value: 'thanks' },
  { label: '舰长墙', value: 'guards' },
  { label: '轮播', value: 'auto_cycle' },
]

function guardTitle(level?: number): string {
  if (level === GuardLevel.Zongdu) return '总督'
  if (level === GuardLevel.Tidu) return '提督'
  return '舰长'
}

function recordSeenKey(key: string): boolean {
  if (seenEventKeys.has(key)) return false
  seenEventKeys.add(key)
  if (seenEventKeys.size > 400) {
    const first = seenEventKeys.values().next().value
    if (first) seenEventKeys.delete(first)
  }
  return true
}

function mergeIncomingContribution(input: {
  userKey: string
  uname: string
  uface?: string
  kind: 'gift' | 'sc' | 'guard'
  itemName: string
  count: number
  price: number
  guardLevel?: number
}) {
  const now = Date.now()

  // 1. 合并实时感谢流（同用户 + 同类型 + 同名称合并计数与金额并置顶）
  const nextThanks: GiftBoardThanksItem[] = [...(state.value.thanks ?? [])]
  const thanksKey = `${input.userKey}:${input.kind}:${input.itemName}`
  const existingThanksIdx = nextThanks.findIndex((item) => item.id === thanksKey)
  if (existingThanksIdx >= 0) {
    const prev = nextThanks[existingThanksIdx]
    nextThanks.splice(existingThanksIdx, 1)
    nextThanks.unshift({
      ...prev,
      uname: input.uname,
      uface: input.uface || prev.uface,
      count: prev.count + input.count,
      totalPrice: Number((prev.totalPrice + input.price).toFixed(2)),
      guardLevel: input.guardLevel || prev.guardLevel,
      updatedAt: now,
    })
  } else {
    nextThanks.unshift({
      id: thanksKey,
      uname: input.uname,
      uface: input.uface,
      kind: input.kind,
      itemName: input.itemName,
      count: input.count,
      totalPrice: Number(input.price.toFixed(2)),
      guardLevel: input.guardLevel,
      updatedAt: now,
    })
  }

  // 2. 合并付费排行
  const nextRanking: GiftBoardRankingItem[] = [...(state.value.ranking ?? [])]
  if (input.price > 0) {
    const idx = nextRanking.findIndex(
      (item) => item.id === input.userKey || item.uname === input.uname,
    )
    if (idx >= 0) {
      const prev = nextRanking[idx]
      nextRanking[idx] = {
        ...prev,
        uname: input.uname,
        uface: input.uface || prev.uface,
        totalPaid: Number((prev.totalPaid + input.price).toFixed(2)),
        guardLevel: input.guardLevel || prev.guardLevel,
      }
    } else {
      nextRanking.push({
        id: input.userKey,
        uname: input.uname,
        uface: input.uface,
        totalPaid: Number(input.price.toFixed(2)),
        guardLevel: input.guardLevel,
      })
    }
    nextRanking.sort((a, b) => b.totalPaid - a.totalPaid)
  }

  // 3. 合并本场舰长墙
  const nextGuards: GiftBoardGuardItem[] = [...(state.value.guards ?? [])]
  if (input.kind === 'guard') {
    const level = input.guardLevel || GuardLevel.Jianzhang
    const gIdx = nextGuards.findIndex(
      (item) => item.id === input.userKey || item.uname === input.uname,
    )
    if (gIdx >= 0) {
      const prev = nextGuards[gIdx]
      nextGuards[gIdx] = {
        ...prev,
        uname: input.uname,
        uface: input.uface || prev.uface,
        guardLevel: Math.min(prev.guardLevel || 3, level),
        count: prev.count + input.count,
        price: Number((prev.price + input.price).toFixed(2)),
        updatedAt: now,
      }
    } else {
      nextGuards.unshift({
        id: input.userKey,
        uname: input.uname,
        uface: input.uface,
        guardLevel: level,
        count: input.count,
        price: Number(input.price.toFixed(2)),
        updatedAt: now,
      })
    }
  }

  void updateState({
    thanks: nextThanks.slice(0, 30),
    ranking: nextRanking.slice(0, 20),
    guards: nextGuards.slice(0, 30),
  })
}

function handleGiftEvent(event: EventModel) {
  if (!autoTrack.value) return
  const key = event.eventId || `gift:${event.uid || event.ouid}:${event.time}:${event.msg}:${event.num}`
  if (!recordSeenKey(key)) return
  mergeIncomingContribution({
    userKey: event.ouid || String(event.uid || event.uname),
    uname: event.uname || '神秘观众',
    uface: event.uface || undefined,
    kind: 'gift',
    itemName: event.msg || '礼物',
    count: event.num || 1,
    price: event.price || 0,
    guardLevel: event.guard_level > 0 ? event.guard_level : undefined,
  })
}

function handleScEvent(event: EventModel) {
  if (!autoTrack.value) return
  const key = event.eventId || `sc:${event.uid || event.ouid}:${event.time}:${event.price}`
  if (!recordSeenKey(key)) return
  mergeIncomingContribution({
    userKey: event.ouid || String(event.uid || event.uname),
    uname: event.uname || '神秘观众',
    uface: event.uface || undefined,
    kind: 'sc',
    itemName: event.msg || '醒目留言',
    count: 1,
    price: event.price || 0,
    guardLevel: event.guard_level > 0 ? event.guard_level : undefined,
  })
}

function handleGuardEvent(event: EventModel) {
  if (!autoTrack.value) return
  const key = event.eventId || `guard:${event.uid || event.ouid}:${event.time}:${event.guard_level}`
  if (!recordSeenKey(key)) return
  const level = event.guard_level > 0 ? event.guard_level : GuardLevel.Jianzhang
  mergeIncomingContribution({
    userKey: event.ouid || String(event.uid || event.uname),
    uname: event.uname || '神秘舰长',
    uface: event.uface || undefined,
    kind: 'guard',
    itemName: guardTitle(level),
    count: event.num || 1,
    price: event.price || 198,
    guardLevel: level,
  })
}

async function fetchLiveRanking() {
  if (isLoadingRanking.value) return
  isLoadingRanking.value = true
  try {
    let liveId: string | undefined
    const currentRes = await getApiLiveCurrent()
    if (currentRes.code === 200 && currentRes.data?.live?.liveId) {
      liveId = currentRes.data.live.liveId
    }

    const rankingRes = await getApiLiveRanking({ liveId, limit: 20 })
    if (rankingRes.code !== 200) {
      toast.error(rankingRes.message || '拉取本场排行失败')
      return
    }

    const items: GiftBoardRankingItem[] = (rankingRes.data ?? []).map((entry, index) => ({
      id: entry.ouId || `rank-${index}-${entry.uName}`,
      uname: entry.uName,
      uface: entry.uFace || undefined,
      totalPaid: entry.totalPaid,
    }))

    await updateState({ ranking: items })
    if (items.length === 0) {
      toast.info(liveId ? '当前场次暂无付费投喂记录' : '当前未开播或暂无本场排行数据')
    } else {
      toast.success(`已拉取本场前 ${items.length} 名投喂排行`)
    }
  } finally {
    isLoadingRanking.value = false
  }
}

function injectSampleData() {
  void updateState({
    ranking: structuredClone(SAMPLE_GIFT_BOARD_RANKING),
    thanks: structuredClone(SAMPLE_GIFT_BOARD_THANKS),
    guards: structuredClone(SAMPLE_GIFT_BOARD_GUARDS),
  })
  toast.success('已注入示例榜单、感谢流与舰长名单')
}

let simSeq = 0
function simulateOneContribution() {
  const pool = [
    { uname: '星海巡航官', kind: 'gift' as const, itemName: '璀璨星河', count: 1, price: 52, guardLevel: 2 },
    { uname: '早安打call机', kind: 'sc' as const, itemName: '主播加油，声音超治愈！', count: 1, price: 30, guardLevel: 3 },
    { uname: '新登船水手', kind: 'guard' as const, itemName: '舰长', count: 1, price: 198, guardLevel: 3 },
    { uname: '魔法少女酱', kind: 'gift' as const, itemName: '心动盲盒', count: 2, price: 30 },
  ]
  const pick = pool[simSeq % pool.length]
  simSeq++
  mergeIncomingContribution({
    userKey: `sim-${pick.uname}`,
    ...pick,
  })
  toast.success(`已模拟 ${pick.uname} 的${pick.kind === 'guard' ? '上舰' : pick.kind === 'sc' ? 'SC' : '礼物'}投喂`)
}

function clearRecords() {
  void updateState({
    ranking: [],
    thanks: [],
    guards: [],
  })
  toast.info('已清空本场榜单、感谢流与舰长记录')
}

function unbindDanmaku() {
  danmakuClient.offEvent('gift', handleGiftEvent)
  danmakuClient.offEvent('sc', handleScEvent)
  danmakuClient.offEvent('guard', handleGuardEvent)
}

watch(autoTrack, async (enabled) => {
  if (enabled) {
    danmakuClient.onEvent('gift', handleGiftEvent)
    danmakuClient.onEvent('sc', handleScEvent)
    danmakuClient.onEvent('guard', handleGuardEvent)
    try {
      await danmakuClient.ensureOpenlive()
      toast.success('已开启本场礼物 / SC / 上舰自动追踪')
    } catch {
      toast.warning('直播事件追踪已挂起（请先在弹幕姬或中控台连接直播间）')
    }
  } else {
    unbindDanmaku()
  }
})

onUnmounted(() => {
  unbindDanmaku()
})
</script>

<template>
  <ObsWidgetWorkbench
    component-id="gift-board"
    title="本场感谢榜与舰长墙 (Gift Board)"
    obs-path="/obs-store/gift-board"
    recommended-size="360 × 440 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="420"
    @update:channel-id="(val) => (channelId = val)"
    @retry="retry"
  >
    <template #controls>
      <FormField label="展示视图模式">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-4"
          :model-value="state.viewMode"
          @update:model-value="(val) => val && updateState({ viewMode: val as GiftBoardViewMode })"
        >
          <ToggleGroupItem
            v-for="opt in viewModeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <SettingRow
        v-model="autoTrack"
        type="switch"
        variant="card"
        title="自动追踪直播间礼物 / SC / 上舰"
        description="实时合并感谢记录、更新本场付费排行与新上舰名单"
      />

      <div class="grid grid-cols-2 gap-1.5">
        <Button
          variant="outline"
          class="gap-1.5"
          :disabled="isLoadingRanking"
          @click="fetchLiveRanking"
        >
          <Download class="size-3.5" />
          拉取本场排行
        </Button>
        <Button
          variant="outline"
          class="gap-1.5"
          @click="simulateOneContribution"
        >
          <Gift class="size-3.5" />
          模拟一条投喂
        </Button>
        <Button
          variant="secondary"
          class="gap-1.5"
          @click="injectSampleData"
        >
          <Sparkles class="size-3.5" />
          注入示例数据
        </Button>
        <Button
          variant="ghost"
          class="gap-1.5 text-muted-foreground"
          @click="clearRecords"
        >
          <Trash2 class="size-3.5" />
          清空本场记录
        </Button>
      </div>

      <SettingRow
        type="switch"
        variant="compact"
        title="空数据时显示示例占位"
        description="仅在列表为空时显示演示排版，收到真实数据后自动切换"
        :model-value="state.showEmptySample"
        @change="(val: boolean) => updateState({ showEmptySample: val })"
      />

      <Separator />

      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="rounded-md border border-border bg-card py-2 px-1">
          <div class="text-sm font-bold tabular-nums text-foreground">{{ state.ranking?.length ?? 0 }}</div>
          <div class="text-[11px] text-muted-foreground">榜单人数</div>
        </div>
        <div class="rounded-md border border-border bg-card py-2 px-1">
          <div class="text-sm font-bold tabular-nums text-foreground">{{ state.thanks?.length ?? 0 }}</div>
          <div class="text-[11px] text-muted-foreground">感谢条目</div>
        </div>
        <div class="rounded-md border border-border bg-card py-2 px-1">
          <div class="text-sm font-bold tabular-nums text-foreground">{{ state.guards?.length ?? 0 }}</div>
          <div class="text-[11px] text-muted-foreground">本场舰长</div>
        </div>
      </div>
    </template>

    <template #stage-actions>
      <Button
        variant="outline"
        size="xs"
        class="gap-1"
        @click="simulateOneContribution"
      >
        <Gift class="size-3.5" />
        模拟投喂
      </Button>
    </template>

    <template #preview>
      <GiftBoardDisplay
        :channel-id="channelId"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
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

        <FormField label="投喂榜标题" class="min-w-0">
          <Input
            :model-value="state.titleRanking"
            @update:model-value="(val) => updateState({ titleRanking: String(val) })"
          />
        </FormField>

        <FormField label="感谢流标题" class="min-w-0">
          <Input
            :model-value="state.titleThanks"
            @update:model-value="(val) => updateState({ titleThanks: String(val) })"
          />
        </FormField>

        <FormField label="舰长墙标题" class="min-w-0">
          <Input
            :model-value="state.titleGuards"
            @update:model-value="(val) => updateState({ titleGuards: String(val) })"
          />
        </FormField>

        <FormField
          label="最大显示条数"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.maxItems"
            :min="3"
            :max="30"
            @update:model-value="(val) => updateState({ maxItems: val ?? 8 })"
          />
        </FormField>

        <FormField
          label="轮播切换间隔 (秒)"
          description="仅「轮播」模式生效"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.cycleIntervalSec"
            :min="3"
            :max="60"
            @update:model-value="(val) => updateState({ cycleIntervalSec: val ?? 10 })"
          />
        </FormField>

        <div class="space-y-1.5 min-w-0">
          <SettingRow
            type="switch"
            variant="compact"
            title="列表平滑滚动"
            :model-value="state.autoScroll"
            @change="(val: boolean) => updateState({ autoScroll: val })"
          />
          <div class="grid grid-cols-2 gap-1.5">
            <SettingRow
              type="switch"
              variant="compact"
              title="显示头像"
              :model-value="state.showAvatar"
              @change="(val: boolean) => updateState({ showAvatar: val })"
            />
            <SettingRow
              type="switch"
              variant="compact"
              title="显示金额"
              :model-value="state.showPrice"
              @change="(val: boolean) => updateState({ showPrice: val })"
            />
          </div>
        </div>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
