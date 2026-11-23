<script setup lang="ts">
import { Dices, Plus, RotateCcw } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { EventDataTypes } from '@/api/generated/model'
import { OBS_ACCENT_PRESETS, OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import MysteryBoxDisplay from './MysteryBoxDisplay.vue'
import { applyMysteryBoxPull, DEFAULT_MYSTERY_BOX_STATE, formatYuan, roundYuan } from './types'
import type { MysteryBoxAction, MysteryBoxState, MysteryBoxViewMode } from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const account = useAccount()
const danmakuClient = useDanmakuClient()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))

watch(
  () => props.channelId ?? route.query.channel,
  (val) => {
    if (!val) return
    channelId.value = resolveObsSyncChannel(val)
  },
)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<MysteryBoxState, MysteryBoxAction>({
    componentId: 'mystery-box',
    channelId,
    defaultState: DEFAULT_MYSTERY_BOX_STATE,
    role: 'controller',
  })

const autoTrackEvents = ref(false)
const seenEventIds = new Set<string>()

// 手动记一笔表单状态
const manualUname = ref('热心观众')
const manualBoxName = ref('心动盲盒')
const manualGiftName = ref('告白气球')
const manualNum = ref(1)
const manualBoxUnitCost = ref(15)
const manualTotalValue = ref(52)

const parsedKeywords = computed(() =>
  state.value.boxKeywords
    .split(/[,，\n]/)
    .map((k) => k.trim().toLowerCase())
    .filter(Boolean),
)

const netProfit = computed(() => roundYuan(state.value.totalValue - state.value.totalCost))

function recordPull(input: {
  userKey: string
  uname: string
  uface?: string
  boxName: string
  giftName: string
  num: number
  cost: number
  value: number
}) {
  const { patch, pull } = applyMysteryBoxPull(state.value, input)
  updateState(patch)
  sendAction({ type: 'PULL_FLASH', pull })
  return pull
}

function handleIncomingEvent(event: EventModel) {
  if (!autoTrackEvents.value || event.type !== EventDataTypes.Gift) return

  const key = event.eventId || `${event.type}:${event.uid}:${event.time}:${event.msg}:${event.price}:${event.num}`
  if (seenEventIds.has(key)) return
  seenEventIds.add(key)
  if (seenEventIds.size > 500) {
    const first = seenEventIds.values().next().value
    if (first) seenEventIds.delete(first)
  }

  const rawBoxName = event.mystery_box_name?.trim() || ''
  const rawGiftName = event.msg?.trim() || ''
  const keywords = parsedKeywords.value

  const matchedByBoxField =
    rawBoxName.length > 0 && (keywords.length === 0 || keywords.some((kw) => rawBoxName.toLowerCase().includes(kw)))
  const matchedByKeyword = !matchedByBoxField && keywords.some((kw) => rawGiftName.toLowerCase().includes(kw))

  if (!matchedByBoxField && !matchedByKeyword) return

  const num = Math.max(1, Math.trunc(event.num || 1))
  const unitCost =
    typeof event.mystery_box_price === 'number' && event.mystery_box_price > 0
      ? event.mystery_box_price
      : state.value.fallbackBoxPrice
  const cost = roundYuan(unitCost * num)
  const value = roundYuan(Math.max(0, event.price || 0))

  recordPull({
    userKey: event.ouid || String(event.uid || event.uname),
    uname: event.uname || '神秘观众',
    uface: event.uface,
    boxName: rawBoxName || rawGiftName || '盲盒',
    giftName: rawGiftName || '盲盒礼物',
    num,
    cost,
    value,
  })
}

watch(autoTrackEvents, async (enabled) => {
  if (enabled) {
    danmakuClient.onEvent('all', handleIncomingEvent)
    try {
      await danmakuClient.ensureOpenlive()
      toast.success('已开启盲盒礼物自动追踪')
    } catch {
      toast.warning('盲盒监听已挂起（请先在弹幕姬或中控台连接直播间）')
    }
  } else {
    danmakuClient.offEvent('all', handleIncomingEvent)
  }
})

onUnmounted(() => {
  danmakuClient.offEvent('all', handleIncomingEvent)
})

const SIM_USERS = ['星野梦', '摸鱼舰长', '北极小企鹅', '欧气满满', '晚风起', '奶茶三分糖']
const SIM_POOL = [
  { boxName: '心动盲盒', unitCost: 15, giftName: '小花花', value: 1 },
  { boxName: '心动盲盒', unitCost: 15, giftName: '粉丝团灯牌', value: 6 },
  { boxName: '心动盲盒', unitCost: 15, giftName: '奶茶', value: 10 },
  { boxName: '心动盲盒', unitCost: 15, giftName: '告白气球', value: 52 },
  { boxName: '星光盲盒', unitCost: 5, giftName: '棒棒糖', value: 2 },
  { boxName: '星光盲盒', unitCost: 5, giftName: '牛哇牛哇', value: 10 },
  { boxName: '至尊盲盒', unitCost: 100, giftName: '浪漫城堡', value: 288 },
  { boxName: '至尊盲盒', unitCost: 100, giftName: '星愿水晶球', value: 52 },
]

function simulatePull() {
  const uname = SIM_USERS[Math.floor(Math.random() * SIM_USERS.length)]
  const sample = SIM_POOL[Math.floor(Math.random() * SIM_POOL.length)]
  const pull = recordPull({
    userKey: `sim:${uname}`,
    uname,
    boxName: sample.boxName,
    giftName: sample.giftName,
    num: 1,
    cost: sample.unitCost,
    value: sample.value,
  })
  toast.success(`${pull.uname} 开出 ${pull.giftName} (${formatYuan(pull.profit, true)})`)
}

function submitManualPull() {
  const num = Math.max(1, Math.trunc(Number(manualNum.value) || 1))
  const unitCost = Math.max(0, Number(manualBoxUnitCost.value) || 0)
  const value = Math.max(0, Number(manualTotalValue.value) || 0)
  const uname = manualUname.value.trim() || '热心观众'
  const pull = recordPull({
    userKey: `manual:${uname}`,
    uname,
    boxName: manualBoxName.value.trim() || '盲盒',
    giftName: manualGiftName.value.trim() || '未知礼物',
    num,
    cost: roundYuan(unitCost * num),
    value,
  })
  toast.success(`已记录：${pull.uname} ${formatYuan(pull.profit, true)}`)
}

function resetStats() {
  updateState({
    totalOpens: 0,
    totalCost: 0,
    totalValue: 0,
    giftStats: [],
    userStats: [],
    lastPull: null,
  })
  sendAction({ type: 'RESET' })
  toast.success('已清空盲盒盈亏统计')
}
</script>

<template>
  <ObsWidgetWorkbench
    component-id="mystery-box"
    title="盲盒拆盒与盈亏统计"
    obs-path="/obs-store/mystery-box"
    recommended-size="380×360 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="360"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <SettingRow
        v-model="autoTrackEvents"
        title="自动追踪盲盒礼物"
        description="订阅直播间礼物事件，自动识别盲盒并累计投入与盈亏"
        :badge="danmakuClient.connected ? '已连线' : undefined"
        type="switch"
        variant="card"
      />

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-md border border-border bg-card p-2 text-center">
          <div class="text-[11px] text-muted-foreground">拆盒数</div>
          <div class="text-sm font-semibold tabular-nums text-foreground">{{ state.totalOpens }}</div>
        </div>
        <div class="rounded-md border border-border bg-card p-2 text-center">
          <div class="text-[11px] text-muted-foreground">总投入</div>
          <div class="text-sm font-semibold tabular-nums text-foreground">{{ formatYuan(state.totalCost) }}</div>
        </div>
        <div class="rounded-md border border-border bg-card p-2 text-center">
          <div class="text-[11px] text-muted-foreground">净盈亏</div>
          <div
            class="text-sm font-semibold tabular-nums"
            :class="netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'"
          >
            {{ formatYuan(netProfit, true) }}
          </div>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          class="flex-1 gap-1.5"
          @click="simulatePull"
        >
          <Dices class="size-3.5" />
          模拟拆一发
        </Button>
        <Button
          variant="outline"
          class="gap-1.5"
          @click="resetStats"
        >
          <RotateCcw class="size-3.5" />
          清空统计
        </Button>
      </div>

      <Separator />

      <div class="space-y-2.5">
        <div class="text-xs font-semibold text-foreground">手动记一笔</div>
        <div class="grid grid-cols-2 gap-2">
          <FormField
            v-model="manualUname"
            label="观众昵称"
            placeholder="例如：星野梦"
            class="min-w-0"
          />
          <FormField
            v-model="manualBoxName"
            label="盲盒名称"
            placeholder="例如：心动盲盒"
            class="min-w-0"
          />
          <FormField
            v-model="manualGiftName"
            label="开出礼物"
            placeholder="例如：告白气球"
            class="min-w-0"
          />
          <FormField
            label="数量"
            class="min-w-0"
          >
            <NumberField
              v-model="manualNum"
              :min="1"
              :max="999"
            />
          </FormField>
          <FormField
            label="单盒成本 (元)"
            class="min-w-0"
          >
            <NumberField
              v-model="manualBoxUnitCost"
              :min="0"
              :step="1"
            />
          </FormField>
          <FormField
            label="开出总价 (元)"
            class="min-w-0"
          >
            <NumberField
              v-model="manualTotalValue"
              :min="0"
              :step="1"
            />
          </FormField>
        </div>
        <Button
          variant="secondary"
          class="w-full gap-1.5"
          @click="submitManualPull"
        >
          <Plus class="size-3.5" />
          记入统计并触发飘字
        </Button>
      </div>
    </template>

    <template #preview>
      <MysteryBoxDisplay
        :channel-id="channelId"
        :user-id="account.id"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          label="组件标题"
          :model-value="state.title"
          placeholder="盲盒盈亏统计"
          class="min-w-0"
          @update:model-value="(val) => updateState({ title: String(val ?? '') })"
        />

        <FormField
          label="显示视图"
          class="min-w-0"
        >
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-2"
            :model-value="state.viewMode"
            @update:model-value="(val) => val && updateState({ viewMode: val as MysteryBoxViewMode })"
          >
            <ToggleGroupItem value="full">完整视图</ToggleGroupItem>
            <ToggleGroupItem value="compact">紧凑视图</ToggleGroupItem>
          </ToggleGroup>
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
          label="强调色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="state.accentColor"
            :show-alpha="false"
            :swatches="OBS_ACCENT_PRESETS"
            @update:model-value="(val) => updateState({ accentColor: val })"
          />
        </FormField>

        <FormField
          label="显示字体"
          class="min-w-0"
        >
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            @update:model-value="(val) => updateState({ fontFamily: val || '' })"
          />
        </FormField>

        <FormField
          label="回退单盒价格 (元)"
          description="当礼物未携带盲盒原价字段时使用此单价计算投入"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.fallbackBoxPrice"
            :min="0"
            :step="1"
            @update:model-value="(val) => updateState({ fallbackBoxPrice: Math.max(0, Number(val) || 0) })"
          />
        </FormField>

        <FormField
          label="盲盒名关键词过滤"
          description="多个关键词用逗号分隔；留空则自动匹配所有带盲盒字段的礼物"
          :model-value="state.boxKeywords"
          placeholder="留空匹配全部，或填：心动盲盒,星光盲盒"
          class="min-w-0 md:col-span-2"
          @update:model-value="(val) => updateState({ boxKeywords: String(val ?? '') })"
        />

        <SettingRow
          title="显示欧皇榜 / 非酋榜"
          description="按个人累计净盈亏展示前 2 名欧皇与非酋"
          type="switch"
          variant="compact"
          :model-value="state.showRankings"
          @update:model-value="(val) => updateState({ showRankings: Boolean(val) })"
        />

        <SettingRow
          title="显示出货礼物统计"
          description="展示开出总价值最高的 4 种礼物数量与总额"
          type="switch"
          variant="compact"
          :model-value="state.showGiftStats"
          @update:model-value="(val) => updateState({ showGiftStats: Boolean(val) })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
