<script setup lang="ts">
import {
  BellRing,
  CalendarCheck,
  Crown,
  Gift,
  MessageSquareQuote,
  RotateCcw,
  ShoppingBag,
  Trash2,
  UserPlus,
} from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/client-types'
import { GuardLevel } from '@/api/generated/model'
import type { CheckInHubEvent } from '@/apps/client/store/autoAction/modules/checkin'
import type { PointOrderRedeemedHubEvent } from '@/apps/client/store/autoAction/modules/pointRedeem'
import { OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
import type { ObsWidgetTheme } from '@/apps/obs-store/components/shared/theme'
import ObsWidgetWorkbench from '@/apps/obs-store/components/store/ObsWidgetWorkbench.vue'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import { useRealtimeTopic } from '@/shared/realtime'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import AlertBoxDisplay from './AlertBoxDisplay.vue'
import {
  ALERT_KIND_LIST,
  DEFAULT_ALERT_BOX_STATE,
  DEFAULT_ALERT_RULES,
  createSampleAlertPayload,
  getAlertRule,
} from './types'
import type { AlertAnimation, AlertBoxAction, AlertBoxState, AlertEventKind, AlertPayload, AlertRuleConfig } from './types'

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
  useObsBridge<AlertBoxState, AlertBoxAction>({
    componentId: 'alert-box',
    channelId,
    defaultState: DEFAULT_ALERT_BOX_STATE,
    role: 'controller',
  })

const displayRef = ref<InstanceType<typeof AlertBoxDisplay> | null>(null)
const autoListen = ref(false)
const activeRuleKind = ref<AlertEventKind>('guard')
const seenEventKeys = new Set<string>()

const animationOptions: { label: string; value: AlertAnimation }[] = [
  { label: '弹出', value: 'pop' },
  { label: '滑入', value: 'slide' },
  { label: '缩放', value: 'scale' },
]

const kindIcons = {
  guard: Crown,
  sc: MessageSquareQuote,
  gift: Gift,
  point_redeem: ShoppingBag,
  checkin: CalendarCheck,
  follow: UserPlus,
} as const

const currentRule = computed(() => getAlertRule(state.value, activeRuleKind.value))

function patchRule(kind: AlertEventKind, patch: Partial<AlertRuleConfig>) {
  const merged = {
    ...DEFAULT_ALERT_RULES,
    ...state.value.rules,
    [kind]: {
      ...getAlertRule(state.value, kind),
      ...patch,
    },
  }
  void updateState({ rules: merged })
}

function resetCurrentRule() {
  patchRule(activeRuleKind.value, { ...DEFAULT_ALERT_RULES[activeRuleKind.value] })
  toast.success('已恢复该类事件的默认播报模板')
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

function dispatchAlert(payload: AlertPayload) {
  displayRef.value?.enqueueAlert(payload)
  if (account.value.id) {
    sendAction({ type: 'TRIGGER_ALERT', payload })
  }
}

function handleSimulate(kind: AlertEventKind) {
  const payload = createSampleAlertPayload(kind)
  dispatchAlert(payload)
}

function handleClearQueue() {
  displayRef.value?.clearQueue()
  if (account.value.id) {
    sendAction({ type: 'CLEAR_QUEUE' })
  }
  toast.info('已清空播报队列')
}

function guardName(level?: GuardLevel): string {
  if (level === GuardLevel.Zongdu) return '总督'
  if (level === GuardLevel.Tidu) return '提督'
  return '舰长'
}

function handleGuardEvent(event: EventModel) {
  if (!autoListen.value) return
  if (!getAlertRule(state.value, 'guard').enabled) return
  const key = event.eventId || `guard:${event.uid}:${event.time}:${event.guard_level}:${event.num}`
  if (!recordSeenKey(key)) return
  dispatchAlert({
    id: key,
    kind: 'guard',
    user: event.uname || '神秘舰长',
    avatar: event.uface || undefined,
    item: guardName(event.guard_level),
    count: event.num || 1,
    price: event.price || 0,
    extra: event.msg || '',
    timestamp: Date.now(),
  })
}

function handleScEvent(event: EventModel) {
  if (!autoListen.value) return
  if (!getAlertRule(state.value, 'sc').enabled) return
  const key = event.eventId || `sc:${event.uid}:${event.time}:${event.price}`
  if (!recordSeenKey(key)) return
  dispatchAlert({
    id: key,
    kind: 'sc',
    user: event.uname || '神秘观众',
    avatar: event.uface || undefined,
    item: '醒目留言',
    count: 1,
    price: event.price || 0,
    extra: event.msg || '',
    timestamp: Date.now(),
  })
}

function handleGiftEvent(event: EventModel) {
  if (!autoListen.value) return
  if (!getAlertRule(state.value, 'gift').enabled) return
  const price = event.price || 0
  if (price < (state.value.minGiftYuan ?? 0)) return
  const key = event.eventId || `gift:${event.uid}:${event.time}:${event.msg}:${event.num}:${price}`
  if (!recordSeenKey(key)) return
  dispatchAlert({
    id: key,
    kind: 'gift',
    user: event.uname || '神秘观众',
    avatar: event.uface || undefined,
    item: event.msg || '礼物',
    count: event.num || 1,
    price,
    extra: '',
    timestamp: Date.now(),
  })
}

function handleFollowEvent(event: EventModel) {
  if (!autoListen.value) return
  if (!getAlertRule(state.value, 'follow').enabled) return
  const key = event.eventId || `follow:${event.uid || event.ouid}:${event.time}`
  if (!recordSeenKey(key)) return
  dispatchAlert({
    id: key,
    kind: 'follow',
    user: event.uname || '新关注观众',
    avatar: event.uface || undefined,
    item: '关注',
    count: 1,
    price: 0,
    extra: '',
    timestamp: Date.now(),
  })
}

function pickField<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const val = source[key]
    if (val !== undefined && val !== null) return val as T
  }
  return undefined
}

const userEventsTopic = computed(() =>
  autoListen.value && account.value.id ? `user:events:${account.value.id}` : '',
)
const { on: onUserEvent } = useRealtimeTopic(userEventsTopic)

onUserEvent<PointOrderRedeemedHubEvent>('PointOrderRedeemed', (payload) => {
  if (!autoListen.value || !getAlertRule(state.value, 'point_redeem').enabled) return
  const raw = payload as unknown as Record<string, unknown>
  const orderId = Number(pickField<number>(raw, 'OrderId', 'orderId') ?? 0)
  const timestamp = Number(pickField<number>(raw, 'Timestamp', 'timestamp') ?? Date.now())
  const key = `point:${orderId || timestamp}`
  if (!recordSeenKey(key)) return

  const remark = String(pickField<string>(raw, 'Remark', 'remark') ?? '').trim()
  const subItems = pickField<string[]>(raw, 'SelectedSubItems', 'selectedSubItems') ?? []
  const extraParts = [subItems.length > 0 ? subItems.join(' / ') : '', remark ? `备注：${remark}` : ''].filter(Boolean)

  dispatchAlert({
    id: key,
    kind: 'point_redeem',
    user: String(pickField<string>(raw, 'BuyerName', 'buyerName') ?? '站内观众'),
    item: String(pickField<string>(raw, 'GoodsName', 'goodsName') ?? '积分商品'),
    count: Number(pickField<number>(raw, 'Count', 'count') ?? 1),
    price: Number(pickField<number>(raw, 'Point', 'point') ?? 0),
    extra: extraParts.join(' · '),
    timestamp,
  })
})

onUserEvent<CheckInHubEvent>('CheckInResult', (payload) => {
  if (!autoListen.value || !getAlertRule(state.value, 'checkin').enabled) return
  const success = payload.Success ?? payload.success ?? false
  if (!success) return

  const rawEvent = (payload.Event ?? payload.event) as unknown as Record<string, unknown> | undefined
  const uname = rawEvent ? String(pickField<string>(rawEvent, 'uname', 'uName', 'UName') ?? '签到观众') : '签到观众'
  const uface = rawEvent ? String(pickField<string>(rawEvent, 'uface', 'uFace', 'UFace') ?? '') : ''
  const points = payload.Points ?? payload.points ?? 0
  const consecutiveDays = payload.ConsecutiveDays ?? payload.consecutiveDays ?? 1
  const todayRank = payload.TodayRank ?? payload.todayRank ?? 0
  const timestamp = payload.Timestamp ?? payload.timestamp ?? Date.now()
  const key = `checkin:${uname}:${timestamp}`
  if (!recordSeenKey(key)) return

  const extra = todayRank > 0
    ? `连续签到 ${consecutiveDays} 天 · 今日第 ${todayRank} 名`
    : `连续签到 ${consecutiveDays} 天`

  dispatchAlert({
    id: key,
    kind: 'checkin',
    user: uname,
    avatar: uface || undefined,
    item: '弹幕签到',
    count: 1,
    price: points,
    extra,
    timestamp,
  })
})

function unbindDanmaku() {
  danmakuClient.offEvent('guard', handleGuardEvent)
  danmakuClient.offEvent('sc', handleScEvent)
  danmakuClient.offEvent('gift', handleGiftEvent)
  danmakuClient.offEvent('follow', handleFollowEvent)
}

watch(autoListen, async (enabled) => {
  if (enabled) {
    danmakuClient.onEvent('guard', handleGuardEvent)
    danmakuClient.onEvent('sc', handleScEvent)
    danmakuClient.onEvent('gift', handleGiftEvent)
    danmakuClient.onEvent('follow', handleFollowEvent)
    try {
      await danmakuClient.ensureOpenlive()
      toast.success('已开启直播间与站内事件自动播报')
    } catch {
      toast.warning('站内事件监听已开启（直播间事件需先在弹幕姬或中控台连接）')
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
    component-id="alert-box"
    title="事件播报弹窗 (Alert Box)"
    obs-path="/obs-store/alert-box"
    recommended-size="520 × 220 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="230"
    @update:channel-id="(val) => (channelId = val)"
    @retry="retry"
  >
    <template #controls>
      <SettingRow
        v-model="autoListen"
        type="switch"
        variant="card"
        title="自动监听直播间与站内事件"
        description="订阅上舰、SC、礼物、关注以及积分兑换、弹幕签到并推送至 OBS"
      />

      <div class="space-y-2">
        <div class="flex-between">
          <span class="text-xs font-semibold text-foreground">一键模拟播报</span>
          <Button
            variant="ghost"
            size="xs"
            class="gap-1 text-muted-foreground"
            @click="handleClearQueue"
          >
            <Trash2 class="size-3.5" />
            清空队列
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-1.5">
          <Button
            v-for="item in ALERT_KIND_LIST"
            :key="item.kind"
            variant="outline"
            class="justify-start gap-1.5"
            @click="handleSimulate(item.kind)"
          >
            <component
              :is="kindIcons[item.kind]"
              class="size-3.5 shrink-0"
              :style="{ color: getAlertRule(state, item.kind).accentColor }"
            />
            <span class="truncate">{{ item.shortLabel }}</span>
          </Button>
        </div>
      </div>

      <Separator />

      <div class="space-y-2.5">
        <div class="flex-between">
          <span class="text-xs font-semibold text-foreground">分事件规则配置</span>
          <Button
            variant="ghost"
            size="xs"
            class="gap-1 text-muted-foreground"
            @click="resetCurrentRule"
          >
            <RotateCcw class="size-3" />
            重置当前类
          </Button>
        </div>

        <div class="grid grid-cols-3 gap-1">
          <Button
            v-for="item in ALERT_KIND_LIST"
            :key="item.kind"
            size="xs"
            :variant="activeRuleKind === item.kind ? 'default' : 'outline'"
            class="justify-center gap-1 px-1.5"
            @click="activeRuleKind = item.kind"
          >
            <span
              class="size-1.5 rounded-full shrink-0"
              :class="getAlertRule(state, item.kind).enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'"
            />
            <span class="truncate">{{ item.badge }}</span>
          </Button>
        </div>

        <div class="rounded-md border border-border bg-card p-2.5 space-y-2.5">
          <SettingRow
            type="switch"
            variant="none"
            :model-value="currentRule.enabled"
            :title="`启用「${ALERT_KIND_LIST.find((i) => i.kind === activeRuleKind)?.label}」播报`"
            @change="(val: boolean) => patchRule(activeRuleKind, { enabled: val })"
          />

          <div class="grid grid-cols-2 gap-2">
            <FormField label="弹窗标题" class="min-w-0">
              <Input
                :model-value="currentRule.title"
                @update:model-value="(val) => patchRule(activeRuleKind, { title: String(val) })"
              />
            </FormField>

            <FormField label="事件强调色" class="min-w-0">
              <ColorPicker
                :model-value="currentRule.accentColor"
                :show-alpha="false"
                @update:model-value="(val) => patchRule(activeRuleKind, { accentColor: val })"
              />
            </FormField>
          </div>

          <FormField
            label="播报文案模板"
            description="可用变量：{user}、{item}、{count}、{price}、{extra}"
          >
            <Input
              :model-value="currentRule.template"
              @update:model-value="(val) => patchRule(activeRuleKind, { template: String(val) })"
            />
          </FormField>

          <FormField
            label="自定义配图 / GIF 地址（可选）"
            description="留空时显示头像或事件图标徽章"
          >
            <Input
              :model-value="currentRule.mediaUrl"
              placeholder="https://example.com/alert.gif"
              @update:model-value="(val) => patchRule(activeRuleKind, { mediaUrl: String(val) })"
            />
          </FormField>

          <FormField
            v-if="activeRuleKind === 'gift'"
            label="最低礼物金额阈值 (元)"
            description="低于该金额的免费/小额礼物不触发弹窗"
          >
            <NumberField
              :model-value="state.minGiftYuan"
              :min="0"
              :step="1"
              @update:model-value="(val) => updateState({ minGiftYuan: val ?? 0 })"
            />
          </FormField>
        </div>
      </div>
    </template>

    <template #stage-actions>
      <Button
        variant="outline"
        size="xs"
        class="gap-1"
        @click="handleSimulate(activeRuleKind)"
      >
        <BellRing class="size-3.5" />
        测试当前类
      </Button>
    </template>

    <template #preview>
      <AlertBoxDisplay
        ref="displayRef"
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

        <FormField label="入场动效" class="min-w-0">
          <ToggleGroup
            type="single"
            class="w-full grid grid-cols-3"
            :model-value="state.animation"
            @update:model-value="(val) => val && updateState({ animation: val as AlertAnimation })"
          >
            <ToggleGroupItem
              v-for="opt in animationOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField
          label="停留时长 (毫秒)"
          :extra="`${(state.durationMs / 1000).toFixed(1)}s`"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.durationMs"
            :min="1500"
            :max="20000"
            :step="500"
            @update:model-value="(val) => updateState({ durationMs: val ?? 4500 })"
          />
        </FormField>

        <FormField label="字体" class="min-w-0">
          <GoogleFontPicker
            :model-value="state.fontFamily || null"
            :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
            :show-preview="false"
            @update:model-value="(val) => updateState({ fontFamily: val || '' })"
          />
        </FormField>

        <FormField
          label="提示音音量"
          :extra="`${state.soundVolume}%`"
          class="min-w-0"
        >
          <Slider
            :model-value="[state.soundVolume]"
            :min="0"
            :max="100"
            :step="5"
            :disabled="!state.playSound"
            @update:model-value="(val) => val?.[0] !== undefined && updateState({ soundVolume: val[0] })"
          />
        </FormField>

        <div class="space-y-2 min-w-0">
          <SettingRow
            type="switch"
            variant="compact"
            title="播放轻快提示音"
            :model-value="state.playSound"
            @change="(val: boolean) => updateState({ playSound: val })"
          />
          <div class="grid grid-cols-2 gap-2">
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
              title="底部倒计时条"
              :model-value="state.showProgressBar"
              @change="(val: boolean) => updateState({ showProgressBar: val })"
            />
          </div>
        </div>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
