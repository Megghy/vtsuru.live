<script setup lang="ts">
import { ChevronLeft, ChevronRight, Clapperboard, Film, RefreshCw } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { VideoStatus } from '@/api/generated/model'
import type { ReponseVideoCollectVideo, ResponseVideoCollectModel } from '@/api/generated/model'
import { getApiVideoCollectGet, getApiVideoCollectGetAll } from '@/api/generated/video-collect/video-collect'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { getVideoCollectLifecycleLabel, getVideoCollectLifecycleState } from '@/shared/utils/videoCollect'

import {
  createSampleVideoCollectItems,
  DEFAULT_VIDEO_COLLECT_STATE,
  formatVideoDuration,
  normalizeBiliCoverUrl,
  VIDEO_COLLECT_MODE_OPTIONS,
} from './types'
import type { VideoCollectAction, VideoCollectMode, VideoCollectState } from './types'
import VideoCollectDisplay from './VideoCollectDisplay.vue'

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
  useObsBridge<VideoCollectState, VideoCollectAction>({
    componentId: 'video-collect',
    channelId,
    defaultState: DEFAULT_VIDEO_COLLECT_STATE,
    role: 'controller',
  })

const tables = ref<ResponseVideoCollectModel[]>([])
const acceptedVideos = ref<ReponseVideoCollectVideo[]>([])
const loadingData = ref(false)
const sampleVideos = createSampleVideoCollectItems()
let tableSeq = 0
let detailSeq = 0

async function loadTableDetail(tableId: string) {
  const seq = ++detailSeq
  if (!tableId) {
    acceptedVideos.value = []
    return
  }
  try {
    const res = await getApiVideoCollectGet({ id: tableId })
    if (seq !== detailSeq) return
    if (res.code === 200 && res.data) {
      acceptedVideos.value = (res.data.videos ?? []).filter((v) => v.info.status === VideoStatus.Accepted)
    } else {
      acceptedVideos.value = []
    }
  } catch {
    if (seq !== detailSeq) return
    acceptedVideos.value = []
  }
}

async function loadTables(notify = false) {
  const seq = ++tableSeq
  if (!account.value.id) {
    tables.value = []
    acceptedVideos.value = []
    return
  }
  loadingData.value = true
  try {
    const res = await getApiVideoCollectGetAll()
    if (seq !== tableSeq) return
    const raw = res.code === 200 && Array.isArray(res.data) ? res.data : []
    tables.value = [...raw].sort(
      (a, b) =>
        Number(getVideoCollectLifecycleState(a) === 'finished') -
          Number(getVideoCollectLifecycleState(b) === 'finished') || b.createAt - a.createAt,
    )

    const selectedExists = tables.value.some((t) => t.id === state.value.selectedTableId)
    const targetId = selectedExists ? state.value.selectedTableId : (tables.value[0]?.id ?? '')
    if (targetId && targetId !== state.value.selectedTableId && account.value.id) {
      updateState({ selectedTableId: targetId, currentIndex: 0, currentBvid: '' })
    }
    if (targetId) {
      await loadTableDetail(targetId)
    } else {
      acceptedVideos.value = []
    }
    if (notify) {
      sendAction({ type: 'REFRESH' })
      toast.success('已刷新视频征集列表与投稿')
    }
  } catch {
    if (notify && seq === tableSeq) toast.error('拉取视频征集数据失败，请稍后重试')
  } finally {
    if (seq === tableSeq) loadingData.value = false
  }
}

watch(
  () => account.value.id,
  () => {
    void loadTables(false)
  },
  { immediate: true },
)

const activeList = computed(() => (state.value.useSampleData ? sampleVideos : acceptedVideos.value))

const activeIndex = computed(() => {
  const list = activeList.value
  if (!list.length) return 0
  if (state.value.currentBvid) {
    const idx = list.findIndex((item) => item.info.bvid === state.value.currentBvid)
    if (idx >= 0) return idx
  }
  return Math.max(0, Math.min(list.length - 1, state.value.currentIndex || 0))
})

function handleSelectTable(tableId: string) {
  updateState({ selectedTableId: tableId, currentIndex: 0, currentBvid: '' })
  void loadTableDetail(tableId)
}

function selectVideoByIndex(index: number) {
  const list = activeList.value
  if (!list.length) return
  const clamped = (index + list.length) % list.length
  const target = list[clamped]
  updateState({
    currentIndex: clamped,
    currentBvid: target?.info.bvid || '',
  })
}

function formatTableOption(table: ResponseVideoCollectModel) {
  const label = getVideoCollectLifecycleLabel(getVideoCollectLifecycleState(table))
  return `${table.name} · ${label} (${table.videoCount}/${table.maxVideoCount})`
}
</script>

<template>
  <ObsWidgetWorkbench
    component-id="video-collect"
    title="视频征集投稿角标"
    version="v1.1"
    obs-path="/obs-store/video-collect"
    recommended-size="440 × 150 px"
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
      <div class="flex-between gap-2">
        <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Clapperboard class="size-3.5 text-brand" />
          <span>茶话会导播台</span>
        </div>
        <Button
          variant="outline"
          size="xs"
          class="gap-1"
          :disabled="loadingData"
          @click="loadTables(true)"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': loadingData }"
          />
          刷新投稿
        </Button>
      </div>

      <FormField label="展示模式">
        <ToggleGroup
          type="single"
          class="w-full grid grid-cols-3"
          :model-value="state.mode"
          @update:model-value="(val) => val && updateState({ mode: val as VideoCollectMode })"
        >
          <ToggleGroupItem
            v-for="opt in VIDEO_COLLECT_MODE_OPTIONS"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </ToggleGroupItem>
        </ToggleGroup>
      </FormField>

      <!-- 征集表选择（支持进行中与已结束表） -->
      <template v-if="state.mode !== 'manual'">
        <FormField
          v-if="!state.useSampleData"
          label="当前征集活动"
          description="支持选择进行中与已结束的征集活动进行茶话会鉴赏"
        >
          <Select
            :model-value="state.selectedTableId || tables[0]?.id || ''"
            :disabled="tables.length === 0"
            @update:model-value="(val) => handleSelectTable(String(val || ''))"
          >
            <SelectTrigger class="w-full">
              <SelectValue :placeholder="tables.length ? '选择视频征集活动' : '暂无视频征集活动'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="table in tables"
                :key="table.id"
                :value="table.id"
              >
                {{ formatTableOption(table) }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <!-- 鉴赏切换器与投稿列表 -->
        <div
          v-if="state.mode === 'watch'"
          class="space-y-2"
        >
          <div class="flex-between gap-2">
            <span class="text-xs font-medium text-foreground">
              已通过投稿
              <Badge
                variant="secondary"
                size="xs"
                class="ml-1 tabular-nums"
              >
                {{ activeList.length ? `${activeIndex + 1} / ${activeList.length}` : '0' }}
              </Badge>
            </span>
            <div class="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="xs"
                class="gap-1"
                :disabled="activeList.length <= 1"
                @click="selectVideoByIndex(activeIndex - 1)"
              >
                <ChevronLeft class="size-3.5" />
                上一个
              </Button>
              <Button
                variant="outline"
                size="xs"
                class="gap-1"
                :disabled="activeList.length <= 1"
                @click="selectVideoByIndex(activeIndex + 1)"
              >
                下一个
                <ChevronRight class="size-3.5" />
              </Button>
            </div>
          </div>

          <div
            v-if="activeList.length > 0"
            class="max-h-48 overflow-y-auto scrollbar-thin rounded-md border border-border bg-card p-1 space-y-1"
          >
            <Button
              v-for="(item, idx) in activeList"
              :key="item.info.bvid || item.video.id || idx"
              variant="ghost"
              size="none"
              class="w-full text-left justify-start flex items-center gap-2 p-1.5 rounded-md border transition-colors font-normal"
              :class="
                idx === activeIndex
                  ? 'border-brand bg-brand-soft/60 text-foreground'
                  : 'border-transparent hover:bg-accent/40 text-muted-foreground'
              "
              @click="selectVideoByIndex(idx)"
            >
              <div class="w-12 aspect-video rounded-sm overflow-hidden bg-muted shrink-0 flex-center">
                <img
                  v-if="item.video.cover"
                  :src="normalizeBiliCoverUrl(item.video.cover)"
                  :alt="item.video.title"
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover"
                />
                <Film
                  v-else
                  class="size-3.5 text-muted-foreground"
                />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-xs font-medium text-foreground truncate">{{ idx + 1 }}. {{ item.video.title }}</div>
                <div class="text-[11px] text-muted-foreground truncate tabular-nums">
                  投稿: {{ item.info.senders[0]?.sender || '匿名观众' }} · {{ formatVideoDuration(item.video.length) }}
                </div>
              </div>
            </Button>
          </div>

          <div
            v-else
            class="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
          >
            当前活动暂无已通过审核的视频，可先开启「示例数据预览」或切换至「手动编辑」
          </div>
        </div>

        <SettingRow
          title="示例数据预览"
          description="无征集表时展示模拟投稿方便排版"
          variant="compact"
          type="switch"
          :model-value="state.useSampleData"
          @update:model-value="(val) => updateState({ useSampleData: Boolean(val) })"
        />
      </template>

      <!-- 手动编辑模式表单 -->
      <div
        v-else
        class="space-y-2.5"
      >
        <FormField label="视频标题">
          <Input
            :model-value="state.manualTitle"
            placeholder="输入正在播放的视频标题"
            @update:model-value="(val) => updateState({ manualTitle: String(val ?? '') })"
          />
        </FormField>

        <div class="grid grid-cols-2 gap-2">
          <FormField
            label="投稿人"
            class="min-w-0"
          >
            <Input
              :model-value="state.manualSender"
              placeholder="观众昵称"
              @update:model-value="(val) => updateState({ manualSender: String(val ?? '') })"
            />
          </FormField>
          <FormField
            label="视频 UP 主"
            class="min-w-0"
          >
            <Input
              :model-value="state.manualUpName"
              placeholder="原作者昵称"
              @update:model-value="(val) => updateState({ manualUpName: String(val ?? '') })"
            />
          </FormField>
        </div>

        <FormField label="投稿留言">
          <Input
            :model-value="state.manualMessage"
            placeholder="可选：观众推荐语"
            @update:model-value="(val) => updateState({ manualMessage: String(val ?? '') })"
          />
        </FormField>

        <div class="grid grid-cols-2 gap-2">
          <FormField
            label="进度序号"
            class="min-w-0"
          >
            <Input
              :model-value="state.manualIndexLabel"
              placeholder="例如：3 / 24"
              @update:model-value="(val) => updateState({ manualIndexLabel: String(val ?? '') })"
            />
          </FormField>
          <FormField
            label="时长标签"
            class="min-w-0"
          >
            <Input
              :model-value="state.manualDuration"
              placeholder="例如：03:42"
              @update:model-value="(val) => updateState({ manualDuration: String(val ?? '') })"
            />
          </FormField>
        </div>

        <FormField label="封面图 URL（可选）">
          <Input
            :model-value="state.manualCover"
            placeholder="https://..."
            @update:model-value="(val) => updateState({ manualCover: String(val ?? '') })"
          />
        </FormField>
      </div>
    </template>

    <template #preview>
      <VideoCollectDisplay
        :channel-id="channelId"
        :user-id="account.id"
        :inline-mode="true"
      />
    </template>

    <template #settings>
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <FormField
          label="角标状态文案"
          class="min-w-0"
        >
          <Input
            :model-value="state.badgeLabel"
            placeholder="例如：正在鉴赏 / 茶话会"
            @update:model-value="(val) => updateState({ badgeLabel: String(val ?? '') })"
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
            @update:model-value="(val) => updateState({ accentColor: String(val || '#ec4899') })"
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

        <div class="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-end">
          <SettingRow
            title="显示投稿人留言"
            variant="compact"
            type="switch"
            :model-value="state.showMessage"
            @update:model-value="(val) => updateState({ showMessage: Boolean(val) })"
          />
          <SettingRow
            title="显示原作者 UP 主"
            variant="compact"
            type="switch"
            :model-value="state.showUpName"
            @update:model-value="(val) => updateState({ showUpName: Boolean(val) })"
          />
        </div>
      </div>
    </template>
  </ObsWidgetWorkbench>
</template>
