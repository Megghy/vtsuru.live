<script setup lang="ts">
import { FastForward, Pause, Play, Radio, RefreshCw, Rewind, RotateCcw, Sparkles } from 'lucide-vue-next'
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { WaitingMusicModel } from '@/api/generated/model'
import { getApiMusicRequestGetWaiting } from '@/api/generated/music-request/music-request'
import { OBS_ACCENT_PRESETS, OBS_WIDGET_THEME_OPTIONS } from '@/apps/obs-store/components/shared/theme'
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
import { Slider } from '@/shared/ui/slider'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import NowPlayingDisplay from './NowPlayingDisplay.vue'
import { computeElapsedSec, DEFAULT_NOW_PLAYING_STATE, formatTrackTime, NOW_PLAYING_PRESETS } from './types'
import type { NowPlayingAction, NowPlayingLayout, NowPlayingSource, NowPlayingState } from './types'

const props = defineProps<{ channelId?: string }>()
const route = useRoute()
const account = useAccount()

const channelId = ref(resolveObsSyncChannel(props.channelId ?? route.query.channel))

watch(
  () => props.channelId,
  (val) => {
    if (val) channelId.value = resolveObsSyncChannel(val)
  },
)

watch(
  () => route.query.channel,
  (val) => {
    if (!props.channelId && val) {
      channelId.value = resolveObsSyncChannel(val)
    }
  },
)

const { state, updateState, sendAction, currentHash, isSyncing, lastSyncError, hasPendingChanges, retry } =
  useObsBridge<NowPlayingState, NowPlayingAction>({
    componentId: 'now-playing',
    channelId,
    defaultState: DEFAULT_NOW_PLAYING_STATE,
    role: 'controller',
  })

const nowMs = ref(Date.now())
const clockTimer = window.setInterval(() => {
  if (state.value.isPlaying) {
    nowMs.value = Date.now()
  }
}, 500)

onUnmounted(() => {
  window.clearInterval(clockTimer)
})

const currentElapsed = computed(() => computeElapsedSec(state.value, nowMs.value))

// 点歌机状态查看
const requestPlaying = ref<WaitingMusicModel | null>(null)
const isLoadingRequest = ref(false)

async function refreshMusicRequest() {
  if (!account.value.id) return
  isLoadingRequest.value = true
  try {
    const res = await getApiMusicRequestGetWaiting({ id: account.value.id })
    if (res.code === 200) {
      requestPlaying.value = res.data.playing ?? null
    }
  } catch {
    toast.error('获取点歌机状态失败')
  } finally {
    isLoadingRequest.value = false
  }
}

watch(
  () => state.value.source,
  (source) => {
    if (source === 'music_request') {
      void refreshMusicRequest()
    }
  },
  { immediate: true },
)

function handleSourceChange(value: string) {
  if (!value) return
  updateState({ source: value as NowPlayingSource })
}

function handleLayoutChange(value: string) {
  if (!value) return
  updateState({ layout: value as NowPlayingLayout })
}

function togglePlay() {
  const now = Date.now()
  const elapsed = computeElapsedSec(state.value, now)
  if (state.value.isPlaying) {
    updateState({ isPlaying: false, elapsedSec: elapsed, startedAt: 0 })
    sendAction({ type: 'PAUSE' })
  } else {
    const restart = !state.value.loopPlayback && elapsed >= state.value.durationSec
    updateState({ isPlaying: true, elapsedSec: restart ? 0 : elapsed, startedAt: now })
    sendAction({ type: 'PLAY' })
  }
  nowMs.value = now
}

function seekTo(sec: number) {
  const clamped = Math.max(0, Math.min(state.value.durationSec || 1, sec))
  const now = Date.now()
  updateState({
    elapsedSec: clamped,
    startedAt: state.value.isPlaying ? now : 0,
  })
  sendAction({ type: 'SEEK', elapsedSec: clamped })
  nowMs.value = now
}

function seekDelta(deltaSec: number) {
  seekTo(currentElapsed.value + deltaSec)
}

function applyPreset(preset: (typeof NOW_PLAYING_PRESETS)[number]) {
  const now = Date.now()
  updateState({
    source: 'manual',
    title: preset.title,
    artist: preset.artist,
    requester: preset.requester,
    durationSec: preset.durationSec,
    lyricsText: preset.lyricsText,
    elapsedSec: 0,
    startedAt: now,
    isPlaying: true,
  })
  nowMs.value = now
  toast.success(`已切换曲目：${preset.title}`)
}

const recommendedSize = computed(() => {
  if (state.value.layout === 'lyric') return '460 × 170 px'
  if (state.value.layout === 'bar') return '520 × 84 px'
  return '420 × 120 px'
})
</script>

<template>
  <ObsWidgetWorkbench
    component-id="now-playing"
    title="正在播放音乐与歌词条"
    obs-path="/obs-store/now-playing"
    :recommended-size="recommendedSize"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="200"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <FormField label="数据源模式">
        <ToggleGroup
          type="single"
          :model-value="state.source"
          class="w-full grid grid-cols-2"
          @update:model-value="(val) => handleSourceChange(String(val || ''))"
        >
          <ToggleGroupItem value="music_request">点歌机联动</ToggleGroupItem>
          <ToggleGroupItem value="manual">手动歌曲 / 歌词</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <!-- 点歌机联动模式 -->
      <div
        v-if="state.source === 'music_request'"
        class="rounded-md border border-border bg-card p-3 space-y-2.5"
      >
        <div class="flex-between gap-2">
          <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Radio class="size-3.5 text-emerald-500" />
            <span>站内点歌机实时监听</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            :disabled="isLoadingRequest"
            class="gap-1"
            @click="refreshMusicRequest"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': isLoadingRequest }"
            />
            刷新
          </Button>
        </div>

        <div
          v-if="requestPlaying?.music"
          class="rounded-md bg-muted/50 px-2.5 py-2 space-y-0.5"
        >
          <div class="text-xs font-semibold text-foreground truncate">{{ requestPlaying.music.name }}</div>
          <div class="text-[11px] text-muted-foreground truncate">
            {{ requestPlaying.music.author?.join(' / ') || '未知歌手' }} · 点歌：{{
              requestPlaying.from?.name || '主播添加'
            }}
          </div>
        </div>
        <div
          v-else
          class="text-[11px] text-muted-foreground leading-relaxed"
        >
          当前点歌机暂无正在播放曲目。在点歌机控制台切歌后，OBS 组件会自动实时同步歌名、歌手、封面与点歌观众。
        </div>

        <div class="flex items-center gap-2 pt-1">
          <Button
            variant="secondary"
            class="flex-1 gap-1.5"
            @click="togglePlay"
          >
            <Pause
              v-if="state.isPlaying"
              class="size-3.5"
            />
            <Play
              v-else
              class="size-3.5"
            />
            {{ state.isPlaying ? '暂停动效' : '恢复动效' }}
          </Button>
        </div>
      </div>

      <!-- 手动控制模式 -->
      <template v-else>
        <!-- 播放进度与控制栏 -->
        <div class="rounded-md border border-border bg-card p-3 space-y-2.5">
          <div class="flex-between gap-2">
            <Badge
              :variant="state.isPlaying ? 'brand' : 'secondary'"
              size="sm"
            >
              {{ state.isPlaying ? '播放中' : '已暂停' }}
            </Badge>
            <span class="text-[11px] text-muted-foreground tabular-nums">
              {{ formatTrackTime(currentElapsed) }} / {{ formatTrackTime(state.durationSec) }}
            </span>
          </div>

          <Slider
            :model-value="[Math.floor(currentElapsed)]"
            :min="0"
            :max="Math.max(1, state.durationSec)"
            :step="1"
            @update:model-value="(val) => val && seekTo(val[0] ?? 0)"
          />

          <div class="grid grid-cols-4 gap-1.5">
            <Button
              variant="outline"
              @click="seekTo(0)"
            >
              <RotateCcw class="size-3.5" />
            </Button>
            <Button
              variant="outline"
              @click="seekDelta(-10)"
            >
              <Rewind class="size-3.5" />
            </Button>
            <Button
              class="gap-1"
              @click="togglePlay"
            >
              <Pause
                v-if="state.isPlaying"
                class="size-3.5"
              />
              <Play
                v-else
                class="size-3.5"
              />
            </Button>
            <Button
              variant="outline"
              @click="seekDelta(10)"
            >
              <FastForward class="size-3.5" />
            </Button>
          </div>
        </div>

        <!-- 示例曲目快捷填充 -->
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="text-[11px] text-muted-foreground inline-flex items-center gap-1">
            <Sparkles class="size-3" />
            快速示例:
          </span>
          <Button
            v-for="preset in NOW_PLAYING_PRESETS"
            :key="preset.label"
            variant="outline"
            size="xs"
            @click="applyPreset(preset)"
          >
            {{ preset.label }}
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <FormField
            label="曲目名称"
            class="min-w-0"
          >
            <Input
              :model-value="state.title"
              placeholder="输入歌名"
              @update:model-value="updateState({ title: String($event) })"
            />
          </FormField>
          <FormField
            label="歌手 / 创作者"
            class="min-w-0"
          >
            <Input
              :model-value="state.artist"
              placeholder="输入歌手"
              @update:model-value="updateState({ artist: String($event) })"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <FormField
            label="点歌人"
            class="min-w-0"
          >
            <Input
              :model-value="state.requester"
              placeholder="留空则不显示"
              @update:model-value="updateState({ requester: String($event) })"
            />
          </FormField>
          <FormField
            label="曲目时长 (秒)"
            class="min-w-0"
          >
            <NumberField
              :model-value="state.durationSec"
              :min="10"
              :max="3600"
              class="w-full"
              @update:model-value="updateState({ durationSec: Math.max(10, Number($event) || 180) })"
            />
          </FormField>
        </div>

        <FormField label="专辑封面 URL">
          <Input
            :model-value="state.coverUrl"
            placeholder="可选，支持 https:// 图片链接"
            @update:model-value="updateState({ coverUrl: String($event) })"
          />
        </FormField>

        <FormField
          label="LRC 或多行歌词"
          description="支持标准 [mm:ss.xx] 时间轴，或纯文本每行一句自动轮播"
        >
          <Textarea
            :model-value="state.lyricsText"
            :rows="4"
            placeholder="[00:00.00] 粘贴 LRC 歌词或逐行文本"
            class="font-mono scrollbar-thin"
            @update:model-value="updateState({ lyricsText: String($event) })"
          />
        </FormField>
      </template>
    </template>

    <template #preview>
      <NowPlayingDisplay
        :channel-id="channelId"
        :inline-mode="true"
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FormField
          label="展示布局"
          class="min-w-0"
        >
          <ToggleGroup
            type="single"
            :model-value="state.layout"
            class="w-full grid grid-cols-3"
            @update:model-value="(val) => handleLayoutChange(String(val || ''))"
          >
            <ToggleGroupItem value="vinyl">黑胶</ToggleGroupItem>
            <ToggleGroupItem value="bar">横条</ToggleGroupItem>
            <ToggleGroupItem value="lyric">歌词</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <FormField
          label="视觉主题"
          class="min-w-0"
        >
          <Select
            :model-value="state.theme"
            @update:model-value="updateState({ theme: $event as ObsWidgetTheme })"
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
          label="强调高亮色"
          class="min-w-0"
        >
          <ColorPicker
            :model-value="state.accentColor"
            :swatches="OBS_ACCENT_PRESETS"
            :show-alpha="false"
            @update:model-value="updateState({ accentColor: $event })"
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
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <SettingRow
          title="显示点歌人标签"
          description="展示点歌观众昵称胶囊"
          variant="compact"
          type="switch"
          :model-value="state.showRequester"
          @update:model-value="updateState({ showRequester: Boolean($event) })"
        />
        <SettingRow
          title="显示音律跳动条"
          description="播放时呈现动态频谱跳动"
          variant="compact"
          type="switch"
          :model-value="state.showVisualizer"
          @update:model-value="updateState({ showVisualizer: Boolean($event) })"
        />
        <SettingRow
          title="显示底部进度条"
          description="手动模式下渲染播放进度细线"
          variant="compact"
          type="switch"
          :model-value="state.showProgress"
          @update:model-value="updateState({ showProgress: Boolean($event) })"
        />
        <SettingRow
          title="自动循环播放"
          description="到达曲目结尾后自动从头循环"
          variant="compact"
          type="switch"
          :model-value="state.loopPlayback"
          @update:model-value="updateState({ loopPlayback: Boolean($event) })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
