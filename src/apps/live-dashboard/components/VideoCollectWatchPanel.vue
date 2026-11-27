<script setup lang="ts">
import { CheckCircle2, Circle, Copy, ExternalLink, Film, Play, Radio, RefreshCw, RotateCcw } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { type ReponseVideoCollectVideo, type ResponseVideoCollectModel, VideoStatus } from '@/api/generated/model'
import { getApiVideoCollectGet, getApiVideoCollectGetAll } from '@/api/generated/video-collect/video-collect'
import { setVideoCollectWatched } from '@/api/video-collect-extra'
import {
  DEFAULT_VIDEO_COLLECT_STATE,
  type VideoCollectAction,
  type VideoCollectState,
} from '@/apps/obs-store/components/video-collect/types'
import { useObsBridge } from '@/apps/obs-store/sync'
import { CURRENT_HOST, isTauri } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { buildBiliVideoUrl, normalizeBiliCoverUrl } from '@/shared/utils/videoCollect'

import IconAction from './IconAction.vue'
import PanelShell from './PanelShell.vue'

defineProps<{ blurred?: boolean }>()

const tables = ref<ResponseVideoCollectModel[]>([])
const videos = ref<ReponseVideoCollectVideo[]>([])
const loading = ref(false)
const filterMode = ref<'unwatched' | 'accepted' | 'all'>('unwatched')

const selectedTableId = usePersistedStorage<string>('vtsuru:settings:live-dashboard:vc-table-id', '')

let videosReqSeq = 0
let suppressWatchLoad = false

const obsBridge = useObsBridge<VideoCollectState, VideoCollectAction>({
  componentId: 'video-collect',
  channelId: ref('default'),
  defaultState: DEFAULT_VIDEO_COLLECT_STATE,
  role: 'controller',
})

const acceptedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Accepted))

const displayVideos = computed(() => {
  if (filterMode.value === 'all') return videos.value
  if (filterMode.value === 'accepted') return acceptedVideos.value
  return acceptedVideos.value.filter((item) => !item.info.watched)
})

const watchedCount = computed(() => acceptedVideos.value.filter((item) => item.info.watched).length)

async function loadTables() {
  loading.value = true
  try {
    const res = await getApiVideoCollectGetAll()
    const list = res.data ?? []
    tables.value = [...list].sort((a, b) => Number(a.isFinish) - Number(b.isFinish) || b.createAt - a.createAt)
    if (tables.value.length > 0 && !tables.value.some((t) => t.id === selectedTableId.value)) {
      suppressWatchLoad = true
      selectedTableId.value = tables.value[0].id
      suppressWatchLoad = false
    }
    if (selectedTableId.value) {
      await loadVideos(selectedTableId.value)
    } else {
      videos.value = []
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取视频征集列表失败')
  } finally {
    loading.value = false
  }
}

async function loadVideos(tableId: string) {
  const seq = ++videosReqSeq
  if (!tableId) {
    videos.value = []
    return
  }
  loading.value = true
  try {
    const res = await getApiVideoCollectGet({ id: tableId })
    if (seq !== videosReqSeq) return
    videos.value = res.data?.videos ?? []
  } catch (err) {
    if (seq !== videosReqSeq) return
    toast.error(err instanceof Error ? err.message : '获取征集投稿失败')
  } finally {
    if (seq === videosReqSeq) loading.value = false
  }
}

watch(selectedTableId, (id) => {
  if (suppressWatchLoad || !id) return
  void loadVideos(id)
})

async function toggleWatched(item: ReponseVideoCollectVideo) {
  const bvid = item.info.bvid
  if (!bvid || !selectedTableId.value) return
  const next = !item.info.watched
  item.info.watched = next
  try {
    await setVideoCollectWatched({ id: selectedTableId.value, bvids: [bvid], watched: next })
  } catch (err) {
    item.info.watched = !next
    toast.error(err instanceof Error ? err.message : '同步已看状态失败')
  }
}

async function resetWatched() {
  if (!selectedTableId.value) return
  const watchedItems = acceptedVideos.value.filter((v) => v.info.watched && v.info.bvid)
  if (watchedItems.length === 0) return
  const bvids = watchedItems.map((v) => v.info.bvid as string)
  for (const item of watchedItems) item.info.watched = false
  try {
    await setVideoCollectWatched({ id: selectedTableId.value, bvids, watched: false })
    toast.success('已重置本表观看进度')
  } catch (err) {
    for (const item of watchedItems) item.info.watched = true
    toast.error(err instanceof Error ? err.message : '重置失败')
  }
}

function pushToObs(item: ReponseVideoCollectVideo) {
  const bvid = item.info.bvid
  if (!bvid || !selectedTableId.value) return
  const index = Math.max(
    0,
    acceptedVideos.value.findIndex((v) => v.info.bvid === bvid),
  )
  obsBridge.updateState({
    mode: 'watch',
    selectedTableId: selectedTableId.value,
    currentIndex: index,
    currentBvid: bvid,
    useSampleData: false,
  })
  toast.success(`已同步到 OBS 角标：${item.video.title}`)
}

async function openVideo(item: ReponseVideoCollectVideo) {
  const bvid = item.info.bvid
  if (!bvid) return
  const url = buildBiliVideoUrl(bvid, item.info.page)
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

async function copyBvid(bvid?: string | null) {
  if (!bvid) return
  await navigator.clipboard.writeText(bvid)
  toast.success(`已复制 ${bvid}`)
}

async function openManage() {
  const url = selectedTableId.value
    ? `${CURRENT_HOST}manage/video-collect/${selectedTableId.value}`
    : `${CURRENT_HOST}manage/video-collect`
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

onMounted(() => {
  void loadTables()
})
</script>

<template>
  <PanelShell
    title="视频征集"
    panel-id="video_collect"
    :count="displayVideos.length"
    :blurred="blurred"
  >
    <template #actions>
      <Badge
        v-if="acceptedVideos.length > 0"
        variant="secondary"
        size="xs"
        class="tabular-nums"
      >
        已看 {{ watchedCount }}/{{ acceptedVideos.length }}
      </Badge>
      <IconAction
        :icon="RefreshCw"
        tip="刷新视频列表"
        :class="loading ? 'animate-spin' : ''"
        @click="selectedTableId ? loadVideos(selectedTableId) : loadTables()"
      />
      <IconAction
        :icon="ExternalLink"
        tip="打开视频征集管理页"
        @click="openManage"
      />
    </template>

    <div class="flex flex-col h-full min-h-0 p-2 gap-2 text-xs">
      <div class="flex items-center gap-1.5 shrink-0">
        <Select v-model="selectedTableId">
          <SelectTrigger class="flex-1 min-w-0">
            <SelectValue placeholder="选择征集活动表" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="table in tables"
              :key="table.id"
              :value="table.id"
            >
              {{ table.name }}{{ table.isFinish ? '（已结束）' : '' }}
            </SelectItem>
          </SelectContent>
        </Select>
        <SimpleTooltip
          v-if="watchedCount > 0"
          content="清空已观看标记"
        >
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label="清空已观看标记"
            @click="resetWatched"
          >
            <RotateCcw class="size-3.5 text-muted-foreground" />
          </Button>
        </SimpleTooltip>
      </div>

      <ToggleGroup
        v-model="filterMode"
        type="single"
        size="xs"
        class="w-full grid grid-cols-3 shrink-0"
      >
        <ToggleGroupItem value="unwatched">未看 ({{ acceptedVideos.length - watchedCount }})</ToggleGroupItem>
        <ToggleGroupItem value="accepted">已通过 ({{ acceptedVideos.length }})</ToggleGroupItem>
        <ToggleGroupItem value="all">全部 ({{ videos.length }})</ToggleGroupItem>
      </ToggleGroup>

      <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin space-y-1.5">
        <div
          v-for="(item, idx) in displayVideos"
          :key="item.info.bvid || idx"
          class="flex gap-2 rounded-md border border-border bg-card/70 p-1.5 transition-opacity"
          :class="{ 'opacity-55': item.info.watched }"
        >
          <SimpleTooltip content="在 B 站打开观看">
            <Button
              variant="ghost"
              size="none"
              class="relative w-20 h-12 rounded overflow-hidden bg-muted shrink-0 group"
              aria-label="在 B 站打开观看"
              @click="openVideo(item)"
            >
              <img
                v-if="item.video.cover"
                :src="normalizeBiliCoverUrl(item.video.cover)"
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover"
              />
              <span class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex-center transition-opacity">
                <Play class="size-4 text-white fill-white" />
              </span>
            </Button>
          </SimpleTooltip>

          <div class="min-w-0 flex-1 flex flex-col justify-between">
            <div class="font-medium text-foreground line-clamp-2 leading-snug">
              {{ item.video.title || item.info.bvid }}
            </div>
            <div class="text-[11px] text-muted-foreground truncate">
              UP：{{ item.video.ownerName || '-' }}
              <template v-if="item.info.senders?.[0]?.sender">
                · 推荐：{{ item.info.senders[0].sender }}
              </template>
            </div>
            <div
              v-if="item.info.senders?.[0]?.description"
              class="text-[11px] text-muted-foreground/90 truncate"
            >
              「{{ item.info.senders[0].description }}」
            </div>
          </div>

          <div class="flex flex-col items-center justify-between shrink-0 gap-0.5">
            <SimpleTooltip :content="item.info.watched ? '标为未观看' : '标为已观看'">
              <Button
                size="icon-xs"
                variant="ghost"
                :aria-label="item.info.watched ? '标为未观看' : '标为已观看'"
                @click="toggleWatched(item)"
              >
                <CheckCircle2
                  v-if="item.info.watched"
                  class="size-3.5 text-emerald-500"
                />
                <Circle
                  v-else
                  class="size-3.5 text-muted-foreground"
                />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip
              v-if="item.info.status === VideoStatus.Accepted"
              content="同步到 OBS 鉴赏角标"
            >
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="同步到 OBS 鉴赏角标"
                @click="pushToObs(item)"
              >
                <Radio class="size-3 text-primary" />
              </Button>
            </SimpleTooltip>
            <SimpleTooltip content="复制 BV 号">
              <Button
                size="icon-xs"
                variant="ghost"
                aria-label="复制 BV 号"
                @click="copyBvid(item.info.bvid)"
              >
                <Copy class="size-3 text-muted-foreground" />
              </Button>
            </SimpleTooltip>
          </div>
        </div>

        <div
          v-if="!displayVideos.length && !loading"
          class="flex-col-center py-8 text-muted-foreground gap-1.5"
        >
          <Film class="size-5 opacity-40" />
          <span>{{ tables.length ? '当前筛选下暂无投稿视频' : '暂无视频征集活动表' }}</span>
        </div>
      </div>
    </div>
  </PanelShell>
</template>
