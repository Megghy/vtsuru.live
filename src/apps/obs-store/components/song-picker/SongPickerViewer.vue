<script setup lang="ts">
import { Dices, History, Music2, RefreshCw, RotateCcw, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getApiSongListGet } from '@/api/generated/song-list/song-list'
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
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import SongPickerDisplay from './SongPickerDisplay.vue'
import {
  DEFAULT_SONG_PICKER_STATE,
  DEMO_SONGS,
  extractSongFacets,
  filterPickerSongs,
  normalizeSongModel,
  pickRandomSong,
} from './types'
import type { PickerSongItem, SongPickerAction, SongPickerMode, SongPickerState } from './types'

const ALL_VALUE = '__all__'

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
  useObsBridge<SongPickerState, SongPickerAction>({
    componentId: 'song-picker',
    channelId,
    defaultState: DEFAULT_SONG_PICKER_STATE,
    role: 'controller',
  })

const remoteSongs = ref<PickerSongItem[]>([])
const isLoadingSongs = ref(false)

async function fetchOwnSongs() {
  const uid = account.value.id
  if (!uid) return
  isLoadingSongs.value = true
  try {
    const res = await getApiSongListGet({ id: String(uid) })
    if (res.code === 200 && Array.isArray(res.data)) {
      remoteSongs.value = res.data.map(normalizeSongModel)
    }
  } catch {
    toast.error('加载站内歌单失败')
  } finally {
    isLoadingSongs.value = false
  }
}

watch(
  () => account.value.id,
  (uid) => {
    if (uid) void fetchOwnSongs()
  },
  { immediate: true },
)

const activeSourceSongs = computed(() => (state.value.useDemoSongs ? DEMO_SONGS : remoteSongs.value))

const facets = computed(() => extractSongFacets(activeSourceSongs.value))

const filteredPool = computed(() =>
  filterPickerSongs(activeSourceSongs.value, {
    selectedLanguage: state.value.selectedLanguage,
    selectedTag: state.value.selectedTag,
    skipDisabled: state.value.skipDisabled,
  }),
)

function handleModeChange(val: string) {
  if (!val) return
  updateState({ mode: val as SongPickerMode })
}

function handleLanguageChange(val: string) {
  updateState({ selectedLanguage: val === ALL_VALUE ? '' : val })
}

function handleTagChange(val: string) {
  updateState({ selectedTag: val === ALL_VALUE ? '' : val })
}

function handleDrawSong() {
  const picked = pickRandomSong(filteredPool.value, state.value.recentDrawKeys, state.value.avoidRecentCount)
  if (!picked) {
    toast.warning('当前筛选池为空，请调整筛选条件或开启示例歌单')
    return
  }

  const drawId = `draw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const drawnAt = Date.now()
  const nextKeys = [picked.song.key, ...state.value.recentDrawKeys.filter((k) => k !== picked.song.key)].slice(0, 20)
  const nextHistory = [
    {
      key: picked.song.key,
      name: picked.song.name,
      author: picked.song.author.join(' / '),
      drawnAt,
    },
    ...state.value.recentHistory,
  ].slice(0, 8)

  const payload = {
    drawId,
    song: picked.song,
    candidates: picked.candidates,
    drawnAt,
  }

  updateState({
    mode: 'gacha',
    lastDraw: payload,
    recentDrawKeys: nextKeys,
    recentHistory: nextHistory,
  })
  sendAction({
    type: 'DRAW_SONG',
    ...payload,
  })
  toast.success(`已盲抽曲目：${picked.song.name}`)
}

function handleClearDraw() {
  updateState({ lastDraw: null })
  sendAction({ type: 'CLEAR_DRAW' })
}

function handleClearHistory() {
  updateState({ recentDrawKeys: [], recentHistory: [] })
  toast.success('已清空最近抽中记录')
}
</script>

<template>
  <ObsWidgetWorkbench
    component-id="song-picker"
    title="曲库展示与盲抽翻牌"
    obs-path="/obs-store/song-picker"
    recommended-size="420 × 340 px"
    :channel-id="channelId"
    :is-syncing="isSyncing"
    :last-sync-error="lastSyncError"
    :has-pending-changes="hasPendingChanges"
    :current-hash="currentHash"
    :stage-min-height="340"
    @update:channel-id="channelId = $event"
    @retry="retry"
  >
    <template #controls>
      <FormField label="展示模式">
        <ToggleGroup
          type="single"
          :model-value="state.mode"
          class="w-full grid grid-cols-2"
          @update:model-value="(val) => handleModeChange(String(val || ''))"
        >
          <ToggleGroupItem value="marquee">歌单滚动</ToggleGroupItem>
          <ToggleGroupItem value="gacha">盲抽翻牌</ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <!-- 曲库状态与池子筛选 -->
      <div class="rounded-md border border-border bg-card p-3 space-y-2.5">
        <div class="flex-between gap-2">
          <div class="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Music2 class="size-3.5 text-brand" />
            <span>{{ state.useDemoSongs ? '示例歌单池' : '站内歌单池' }}</span>
            <Badge
              variant="brand"
              size="sm"
              class="tabular-nums"
            >
              候选 {{ filteredPool.length }} 首
            </Badge>
          </div>

          <Button
            variant="outline"
            size="xs"
            :disabled="isLoadingSongs || state.useDemoSongs"
            class="gap-1"
            @click="fetchOwnSongs"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': isLoadingSongs }"
            />
            刷新
          </Button>
        </div>

        <div
          v-if="!state.useDemoSongs && remoteSongs.length === 0 && !isLoadingSongs"
          class="rounded-md border border-dashed border-border p-2.5 flex-between gap-2 text-[11px] text-muted-foreground"
        >
          <span>尚未检测到站内歌单，可先开启示例歌单预览效果</span>
          <Button
            variant="secondary"
            size="xs"
            class="shrink-0"
            @click="updateState({ useDemoSongs: true })"
          >
            启用示例
          </Button>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <FormField
            label="按语种筛选"
            class="min-w-0"
          >
            <Select
              :model-value="state.selectedLanguage || ALL_VALUE"
              @update:model-value="handleLanguageChange(String($event))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="全部语种" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="ALL_VALUE">全部语种</SelectItem>
                <SelectItem
                  v-for="lang in facets.languages"
                  :key="lang"
                  :value="lang"
                >
                  {{ lang }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="按标签筛选"
            class="min-w-0"
          >
            <Select
              :model-value="state.selectedTag || ALL_VALUE"
              @update:model-value="handleTagChange(String($event))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="全部标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem :value="ALL_VALUE">全部标签</SelectItem>
                <SelectItem
                  v-for="tag in facets.tags"
                  :key="tag"
                  :value="tag"
                >
                  {{ tag }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <!-- 盲抽控制区 -->
      <div class="rounded-md border border-border bg-card p-3 space-y-2.5">
        <div class="flex items-center gap-2">
          <Button
            class="flex-1 gap-1.5"
            :disabled="filteredPool.length === 0"
            @click="handleDrawSong"
          >
            <Dices class="size-3.5" />
            随机盲抽一首
          </Button>

          <Button
            variant="outline"
            :disabled="!state.lastDraw"
            class="gap-1 shrink-0"
            @click="handleClearDraw"
          >
            <RotateCcw class="size-3.5" />
            复原卡背
          </Button>
        </div>

        <!-- 最近抽中去重记录 -->
        <div class="space-y-1.5">
          <div class="flex-between gap-2 text-[11px] text-muted-foreground">
            <span class="inline-flex items-center gap-1">
              <History class="size-3" />
              最近抽中记录 (防短期重复)
            </span>
            <Button
              v-if="state.recentHistory.length > 0"
              variant="ghost"
              size="xs"
              class="gap-1 text-muted-foreground hover:text-destructive"
              @click="handleClearHistory"
            >
              <Trash2 class="size-3" />
              清空
            </Button>
          </div>

          <div
            v-if="state.recentHistory.length > 0"
            class="space-y-1 max-h-[120px] overflow-y-auto scrollbar-thin"
          >
            <div
              v-for="(item, idx) in state.recentHistory"
              :key="`${item.key}-${item.drawnAt}`"
              class="flex-between gap-2 rounded-sm bg-muted/50 px-2 py-1 text-xs"
            >
              <span class="truncate font-medium text-foreground">
                <span class="text-muted-foreground tabular-nums mr-1">#{{ idx + 1 }}</span>
                {{ item.name }}
              </span>
              <span class="text-[11px] text-muted-foreground truncate shrink-0 max-w-[110px]">
                {{ item.author || '未知歌手' }}
              </span>
            </div>
          </div>

          <div
            v-else
            class="text-[11px] text-muted-foreground py-1"
          >
            暂无抽取记录
          </div>
        </div>
      </div>
    </template>

    <template #preview>
      <SongPickerDisplay
        :channel-id="channelId"
        :inline-mode="true"
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <FormField
          label="挂件标题"
          class="min-w-0"
        >
          <Input
            :model-value="state.title"
            placeholder="例如：歌单曲库"
            @update:model-value="updateState({ title: String($event) })"
          />
        </FormField>

        <FormField
          label="滚动速度倍率"
          extra="0.5x ~ 3x"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.scrollSpeed"
            :min="0.5"
            :max="3"
            :step="0.25"
            class="w-full"
            @update:model-value="updateState({ scrollSpeed: Math.min(3, Math.max(0.5, Number($event) || 1)) })"
          />
        </FormField>

        <FormField
          label="短期防重复曲数"
          extra="0 为不限制"
          class="min-w-0"
        >
          <NumberField
            :model-value="state.avoidRecentCount"
            :min="0"
            :max="20"
            class="w-full"
            @update:model-value="updateState({ avoidRecentCount: Math.min(20, Math.max(0, Number($event) || 0)) })"
          />
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
          title="跳过已禁用歌曲"
          description="自动过滤歌单中标记为暂不可点的曲目"
          variant="compact"
          type="switch"
          :model-value="state.skipDisabled"
          @update:model-value="updateState({ skipDisabled: Boolean($event) })"
        />
        <SettingRow
          title="使用示例歌单预览"
          description="未上传站内歌单时使用内置曲目体验滚动与盲抽"
          variant="compact"
          type="switch"
          :model-value="state.useDemoSongs"
          @update:model-value="updateState({ useDemoSongs: Boolean($event) })"
        />
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
