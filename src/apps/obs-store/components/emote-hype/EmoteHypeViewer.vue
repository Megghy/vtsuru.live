<script setup lang="ts">
import { Flame, RotateCcw, Sparkles, Zap } from 'lucide-vue-next'
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
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useDanmakuClient } from '@/store/useDanmakuClient'

import EmoteHypeDisplay from './EmoteHypeDisplay.vue'
import { DEFAULT_EMOTE_HYPE_STATE, parseCustomEmoteUrls, parseHotWords } from './types'
import type { EmoteHypeAction, EmoteHypeMode, EmoteHypeState, FountainBurstItem } from './types'

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
  useObsBridge<EmoteHypeState, EmoteHypeAction>({
    componentId: 'emote-hype',
    channelId,
    defaultState: DEFAULT_EMOTE_HYPE_STATE,
    role: 'controller',
  })

const autoTrackEvents = ref(false)
const seenEventIds = new Set<string>()
const burstTimers = new Set<ReturnType<typeof setTimeout>>()

const hotWordList = computed(() => parseHotWords(state.value.hotWords))
const customEmoteList = computed(() => parseCustomEmoteUrls(state.value.customEmoteUrls))

function buildSampleParticles(count: number): FountainBurstItem[] {
  const words = hotWordList.value.length ? hotWordList.value : ['草', '666', '哈哈哈', '打call', '牛']
  const images = customEmoteList.value
  const colors = [state.value.accentColor, '#38bdf8', '#fbbf24', '#10b981', '#a855f7']
  const result: FountainBurstItem[] = []

  for (let i = 0; i < count; i++) {
    const useImage = images.length > 0 && Math.random() < 0.45
    if (useImage) {
      result.push({
        kind: 'image',
        content: images[Math.floor(Math.random() * images.length)],
        scale: 0.9 + Math.random() * 0.35,
      })
    } else {
      result.push({
        kind: 'text',
        content: words[Math.floor(Math.random() * words.length)],
        color: colors[i % colors.length],
        scale: 0.92 + Math.random() * 0.3,
      })
    }
  }
  return result
}

function handleIncomingEvent(event: EventModel) {
  if (!autoTrackEvents.value) return

  const key = event.eventId || `${event.type}:${event.uid}:${event.time}:${event.msg}:${event.price}`
  if (seenEventIds.has(key)) return
  seenEventIds.add(key)
  if (seenEventIds.size > 500) {
    const first = seenEventIds.values().next().value
    if (first) seenEventIds.delete(first)
  }

  if (event.type === EventDataTypes.Message) {
    const msg = event.msg?.trim() || ''
    const lower = msg.toLowerCase()
    const matchedHot = hotWordList.value.find((kw) => lower.includes(kw.toLowerCase()))
    const particles: FountainBurstItem[] = []

    if (event.emoji && /^https?:\/\//i.test(event.emoji)) {
      particles.push({ kind: 'image', content: event.emoji, scale: 1.05 })
    } else if (matchedHot) {
      particles.push({ kind: 'text', content: matchedHot, color: state.value.accentColor, scale: 1.05 })
    }

    const baseGain = Math.max(0.5, Number(state.value.danmakuGain) || 4)
    const delta = matchedHot ? baseGain * 2 : baseGain
    sendAction({ type: 'HYPE_ADD', delta, particles, isHot: Boolean(matchedHot) })
    return
  }

  if (event.type === EventDataTypes.Gift) {
    const baseGift = Math.max(2, Number(state.value.giftGain) || 18)
    const delta = Math.min(48, Math.max(baseGift, Math.round((event.price || 0) * 1.4)))
    const particles: FountainBurstItem[] = []
    if (event.gift_icon && /^https?:\/\//i.test(event.gift_icon)) {
      particles.push({ kind: 'image', content: event.gift_icon, scale: 1.15 })
    } else if (event.msg) {
      particles.push({ kind: 'text', content: event.msg, color: '#fbbf24', scale: 1.1 })
    }
    sendAction({ type: 'HYPE_ADD', delta, particles, isHot: true })
    return
  }

  if (event.type === EventDataTypes.SC) {
    const baseGift = Math.max(4, Number(state.value.giftGain) || 18)
    const delta = Math.min(60, Math.max(baseGift * 1.5, Math.round((event.price || 0) * 1.2)))
    sendAction({
      type: 'HYPE_ADD',
      delta,
      particles: [{ kind: 'text', content: `SC ¥${event.price || 30}`, color: '#f59e0b', scale: 1.18 }],
      isHot: true,
    })
    return
  }

  if (event.type === EventDataTypes.Like) {
    const delta = Math.max(1, (Number(state.value.danmakuGain) || 4) * 0.6)
    sendAction({ type: 'HYPE_ADD', delta })
  }
}

watch(autoTrackEvents, async (enabled) => {
  if (enabled) {
    danmakuClient.onEvent('all', handleIncomingEvent)
    try {
      await danmakuClient.ensureOpenlive()
      toast.success('已开启直播间氛围热度追踪')
    } catch {
      toast.warning('互动监听已挂起（请先在弹幕姬或中控台连接直播间）')
    }
  } else {
    danmakuClient.offEvent('all', handleIncomingEvent)
  }
})

function simulateWave() {
  for (let i = 0; i < 5; i++) {
    const timer = setTimeout(() => {
      burstTimers.delete(timer)
      sendAction({
        type: 'HYPE_ADD',
        delta: Math.max(4, (Number(state.value.danmakuGain) || 4) * 1.8),
        particles: buildSampleParticles(2),
        isHot: i % 2 === 0,
      })
    }, i * 110)
    burstTimers.add(timer)
  }
}

function simulateFever() {
  sendAction({
    type: 'TRIGGER_FEVER',
    particles: buildSampleParticles(10),
  })
}

function fireFountain() {
  sendAction({
    type: 'FOUNTAIN_BURST',
    particles: buildSampleParticles(8),
  })
}

function resetHype() {
  sendAction({ type: 'RESET_HYPE' })
  toast.success('已重置热度槽')
}

onUnmounted(() => {
  danmakuClient.offEvent('all', handleIncomingEvent)
  for (const timer of burstTimers) clearTimeout(timer)
  burstTimers.clear()
})
</script>

<template>
  <ObsWidgetWorkbench
    component-id="emote-hype"
    title="氛围热度槽与表情喷泉"
    obs-path="/obs-store/emote-hype"
    recommended-size="540×240 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="240"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <SettingRow
        v-model="autoTrackEvents"
        title="自动监听弹幕 / 礼物 / SC / 点赞"
        description="命中热词获得双倍充能并自动触发表情/词条喷泉"
        :badge="danmakuClient.connected ? '已连线' : undefined"
        type="switch"
        variant="card"
      />

      <FormField label="显示模式">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-3"
          :model-value="state.mode"
          @update:model-value="(val) => val && updateState({ mode: val as EmoteHypeMode })"
        >
          <ToggleGroupItem value="combo">热度+喷泉</ToggleGroupItem>
          <ToggleGroupItem value="meter">仅热度槽</ToggleGroupItem>
          <ToggleGroupItem value="fountain">仅喷泉</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <div class="space-y-2">
        <div class="text-xs font-semibold text-foreground">互动演示与即时触发</div>
        <div class="grid grid-cols-2 gap-2">
          <Button
            class="gap-1.5"
            @click="simulateWave"
          >
            <Zap class="size-3.5" />
            模拟弹幕热潮
          </Button>
          <Button
            variant="secondary"
            class="gap-1.5"
            @click="simulateFever"
          >
            <Flame class="size-3.5" />
            模拟满槽高能
          </Button>
          <Button
            variant="outline"
            class="gap-1.5"
            @click="fireFountain"
          >
            <Sparkles class="size-3.5" />
            发射一轮喷泉
          </Button>
          <Button
            variant="ghost"
            class="gap-1.5"
            @click="resetHype"
          >
            <RotateCcw class="size-3.5" />
            重置热度
          </Button>
        </div>
      </div>
    </template>

    <template #preview>
      <EmoteHypeDisplay
        :channel-id="channelId"
        :user-id="account.id"
        inline-mode
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FormField
          label="热度槽标题"
          :model-value="state.title"
          placeholder="直播间氛围热度"
          class="min-w-0"
          @update:model-value="(val) => updateState({ title: String(val ?? '') })"
        />

        <FormField
          label="满槽高能文案"
          :model-value="state.feverText"
          placeholder="FEVER 高能满槽"
          class="min-w-0"
          @update:model-value="(val) => updateState({ feverText: String(val ?? '') })"
        />

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
          label="高频热词（逗号分隔）"
          description="弹幕命中任意热词将获得 2× 充能并向上喷射词条"
          :model-value="state.hotWords"
          placeholder="草,666,哈哈哈,打call,牛"
          class="min-w-0"
          @update:model-value="(val) => updateState({ hotWords: String(val ?? '') })"
        />

        <FormField
          label="普通弹幕充能"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.danmakuGain"
            :min="1"
            :max="30"
            :step="0.5"
            @update:model-value="(val) => updateState({ danmakuGain: Math.max(0.5, Number(val) || 1) })"
          />
        </FormField>

        <FormField
          label="礼物 / SC 基础充能"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.giftGain"
            :min="2"
            :max="60"
            :step="1"
            @update:model-value="(val) => updateState({ giftGain: Math.max(2, Number(val) || 10) })"
          />
        </FormField>

        <FormField
          label="每秒自然衰减"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.decayPerSec"
            :min="0.5"
            :max="25"
            :step="0.5"
            @update:model-value="(val) => updateState({ decayPerSec: Math.max(0.5, Number(val) || 2) })"
          />
        </FormField>

        <FormField
          label="喷泉粒子缩放"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.particleScale"
            :min="0.6"
            :max="1.8"
            :step="0.1"
            @update:model-value="
              (val) => updateState({ particleScale: Math.max(0.6, Math.min(1.8, Number(val) || 1)) })
            "
          />
        </FormField>

        <FormField
          type="textarea"
          label="自定义表情图片 URL（可选）"
          description="每行填写一个以 https:// 开头的图片链接，用于喷泉发射自定义表情"
          :rows="2"
          :model-value="state.customEmoteUrls"
          placeholder="https://example.com/emote.png"
          class="min-w-0 md:col-span-2"
          @update:model-value="(val) => updateState({ customEmoteUrls: String(val ?? '') })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
