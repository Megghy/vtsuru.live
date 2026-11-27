<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  LayoutGrid,
  PlayCircle,
  Radio,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Trophy,
  User,
  Video,
} from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ReponseVideoCollectVideo, ResponseVideoCollectDetail } from '@/api/generated/model'
import { VideoStatus } from '@/api/generated/model'
import { getApiVideoCollectGet } from '@/api/generated/video-collect/video-collect'
import { setVideoCollectWatched } from '@/api/video-collect-extra'
import {
  DEFAULT_VIDEO_COLLECT_STATE,
  type VideoCollectAction,
  type VideoCollectState,
} from '@/apps/obs-store/components/video-collect/types'
import { useObsBridge } from '@/apps/obs-store/sync'
import BiliVideoPreviewDialog from '@/shared/components/BiliVideoPreviewDialog.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'
import {
  buildBiliVideoUrl,
  formatVideoDuration,
  getVideoCollectLifecycleLabel,
  getVideoCollectLifecycleState,
} from '@/shared/utils/videoCollect'

import VideoCollectDrawStage from './VideoCollectDrawStage.vue'
import VideoCollectPageShell from './VideoCollectPageShell.vue'
import VideoCollectResultCard from './VideoCollectResultCard.vue'
import VideoCollectSequenceStage from './VideoCollectSequenceStage.vue'

type ViewMode = 'list' | 'draw' | 'sequence' | 'flip'
type WatchFilter = 'all' | 'unwatched' | 'watched'
type SortOption = 'default' | 'duration-asc' | 'duration-desc' | 'senders-desc'

const route = useRoute()
const router = useRouter()
const account = useAccount()

const videoDetail = ref<ResponseVideoCollectDetail | null | undefined>()
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const mode = ref<ViewMode>('list')

// 过滤与排序状态
const searchQuery = ref('')
const debouncedSearch = refDebounced(searchQuery, 180)
const watchFilter = ref<WatchFilter>('all')
const sortBy = ref<SortOption>('default')

// 观看与交互状态
const watchedIds = ref<string[]>([])
const revealedIds = ref<string[]>([])
const sequenceIndex = ref(0)
const shuffledVideos = ref<ReponseVideoCollectVideo[]>([])

// 随机抽取状态
const drawnIds = ref<string[]>([])
const drawnHistory = ref<ReponseVideoCollectVideo[]>([])
const drawnVideo = ref<ReponseVideoCollectVideo>()
const drawPreview = ref<ReponseVideoCollectVideo>()
const isDrawing = ref(false)
let drawRunId = 0
let loadSeq = 0

// 站内播放器弹窗状态
const playerOpen = ref(false)
const playerItem = ref<ReponseVideoCollectVideo | null>(null)

// 主播 OBS 联动
const autoSyncObs = ref(false)
const obsBridge = useObsBridge<VideoCollectState, VideoCollectAction>({
  componentId: 'video-collect',
  channelId: ref('default'),
  defaultState: DEFAULT_VIDEO_COLLECT_STATE,
  role: 'controller',
})

const table = computed(() => videoDetail.value?.table)
const isOwner = computed(() => Boolean(account.value?.id && table.value && account.value.id === table.value.owner.id))
const lifecycle = computed(() => (table.value ? getVideoCollectLifecycleState(table.value) : 'finished'))
const isCollecting = computed(() => lifecycle.value === 'active')
const lifecycleLabel = computed(() => getVideoCollectLifecycleLabel(lifecycle.value))

const acceptedVideos = computed(() =>
  (videoDetail.value?.videos ?? []).filter((item) => item.info.status === VideoStatus.Accepted),
)
const totalDuration = computed(() => acceptedVideos.value.reduce((sum, item) => sum + item.video.length, 0))
const watchedVideos = computed(() =>
  acceptedVideos.value.filter((item) => watchedIds.value.includes(item.info.bvid ?? '')),
)
const watchedDuration = computed(() => watchedVideos.value.reduce((sum, item) => sum + item.video.length, 0))
const progressPercentage = computed(() =>
  totalDuration.value === 0 ? 0 : Math.round((watchedDuration.value / totalDuration.value) * 100),
)
const isAllWatched = computed(
  () => acceptedVideos.value.length > 0 && watchedVideos.value.length === acceptedVideos.value.length,
)

const filteredVideos = computed(() => {
  let list = [...acceptedVideos.value]

  const query = debouncedSearch.value.trim().toLowerCase()
  if (query) {
    list = list.filter((item) => {
      const titleMatch = item.video.title.toLowerCase().includes(query)
      const ownerMatch = item.video.ownerName.toLowerCase().includes(query)
      const bvidMatch = (item.info.bvid ?? '').toLowerCase().includes(query)
      const partitionMatch = (item.video.partitionName ?? '').toLowerCase().includes(query)
      const senderMatch = item.info.senders.some(
        (s) =>
          (s.sender && s.sender.toLowerCase().includes(query)) ||
          (s.description && s.description.toLowerCase().includes(query)),
      )
      return titleMatch || ownerMatch || bvidMatch || partitionMatch || senderMatch
    })
  }

  if (watchFilter.value === 'unwatched') {
    list = list.filter((item) => !watchedIds.value.includes(item.info.bvid ?? ''))
  } else if (watchFilter.value === 'watched') {
    list = list.filter((item) => watchedIds.value.includes(item.info.bvid ?? ''))
  }

  if (sortBy.value === 'duration-asc') {
    list.sort((a, b) => a.video.length - b.video.length)
  } else if (sortBy.value === 'duration-desc') {
    list.sort((a, b) => b.video.length - a.video.length)
  } else if (sortBy.value === 'senders-desc') {
    list.sort((a, b) => b.info.senders.length - a.info.senders.length)
  }

  return list
})

const sequenceVideo = computed(() => acceptedVideos.value[sequenceIndex.value])
const drawDisplayVideo = computed(() => drawnVideo.value ?? drawPreview.value)

const sortOptions = [
  { label: '默认投稿顺序', value: 'default' },
  { label: '时长：从短到长', value: 'duration-asc' },
  { label: '时长：从长到短', value: 'duration-desc' },
  { label: '推荐人数：由多到少', value: 'senders-desc' },
]

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

function progressStorageKey() {
  return `video-collect-result:${table.value?.id ?? currentId()}`
}

function loadLocalProgress(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(progressStorageKey()) ?? '[]')
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    localStorage.removeItem(progressStorageKey())
    return []
  }
}

function saveLocalProgress() {
  localStorage.setItem(progressStorageKey(), JSON.stringify(watchedIds.value))
}

function syncInitialWatched() {
  const serverWatched = acceptedVideos.value
    .filter((item) => item.info.watched && item.info.bvid)
    .map((item) => item.info.bvid as string)
  const localWatched = loadLocalProgress()

  if (isOwner.value) {
    watchedIds.value = serverWatched
    saveLocalProgress()
  } else {
    watchedIds.value = [...new Set([...serverWatched, ...localWatched])]
  }
}

async function persistWatchedChange(bvids: string[], watched: boolean) {
  saveLocalProgress()
  if (!isOwner.value || !table.value || bvids.length === 0) return
  try {
    await setVideoCollectWatched({ id: table.value.id, bvids, watched })
    for (const item of acceptedVideos.value) {
      if (item.info.bvid && bvids.includes(item.info.bvid)) {
        item.info.watched = watched
      }
    }
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '同步已看状态到服务端失败')
  }
}

async function loadData() {
  const seq = ++loadSeq
  isLoading.value = true
  loadError.value = null
  try {
    const response = await getApiVideoCollectGet({ id: currentId() })
    if (seq !== loadSeq) return
    if (response.code === 200) {
      videoDetail.value = response.data
      syncInitialWatched()
    } else if (response.code === 404) {
      videoDetail.value = null
    } else {
      throw new Error(response.message || '加载征集数据失败')
    }
  } catch (error) {
    if (seq !== loadSeq) return
    console.error('获取视频征集结果失败', error)
    loadError.value = error instanceof Error ? error.message : '网络异常，加载失败'
    toast.error(loadError.value)
  } finally {
    if (seq === loadSeq) isLoading.value = false
  }
}

void loadData()
watch(() => route.params.id, () => void loadData())
watch(
  () => acceptedVideos.value.map((item) => item.info.bvid).join(','),
  () => shuffleDeck(),
  { immediate: true },
)
watch(mode, (newMode) => {
  drawRunId++
  isDrawing.value = false
  drawPreview.value = undefined
  if (newMode === 'flip') {
    shuffleDeck()
  }
})

function pushToObs(item: ReponseVideoCollectVideo, silent = false) {
  if (!isOwner.value || !table.value || !item.info.bvid) return
  const index = Math.max(
    0,
    acceptedVideos.value.findIndex((v) => v.info.bvid === item.info.bvid),
  )
  obsBridge.updateState({
    mode: 'watch',
    selectedTableId: table.value.id,
    currentIndex: index,
    currentBvid: item.info.bvid,
    useSampleData: false,
  })
  if (!silent) {
    toast.success(`已推送至 OBS 角标：${item.video.title}`)
  }
}

function toggleWatched(bvid: string) {
  if (!bvid) return
  const nextWatched = !watchedIds.value.includes(bvid)
  if (nextWatched) {
    watchedIds.value = [...watchedIds.value, bvid]
  } else {
    watchedIds.value = watchedIds.value.filter((id) => id !== bvid)
  }
  void persistWatchedChange([bvid], nextWatched)
}

function markWatched(item: ReponseVideoCollectVideo) {
  const bvid = item.info.bvid
  if (!bvid || watchedIds.value.includes(bvid)) return
  watchedIds.value = [...watchedIds.value, bvid]
  void persistWatchedChange([bvid], true)
}

function openVideo(item: ReponseVideoCollectVideo) {
  markWatched(item)
  if (autoSyncObs.value) pushToObs(item, true)
  window.open(buildBiliVideoUrl(item.info.bvid, item.info.page), '_blank', 'noopener,noreferrer')
}

function playVideoInline(item: ReponseVideoCollectVideo) {
  markWatched(item)
  if (autoSyncObs.value) pushToObs(item, true)
  playerItem.value = item
  playerOpen.value = true
}

// 翻牌
function toggleReveal(bvid: string) {
  if (!bvid) return
  if (revealedIds.value.includes(bvid)) {
    revealedIds.value = revealedIds.value.filter((id) => id !== bvid)
  } else {
    revealedIds.value = [...revealedIds.value, bvid]
  }
}

function revealAll() {
  revealedIds.value = shuffledVideos.value.map((v) => v.info.bvid).filter((b): b is string => Boolean(b))
}

function hideAll() {
  revealedIds.value = []
}

function shuffleDeck() {
  const deck = [...acceptedVideos.value]
  for (let index = deck.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[deck[index], deck[target]] = [deck[target], deck[index]]
  }
  shuffledVideos.value = deck
  revealedIds.value = []
}

// 随机抽取
function randomVideo(videos: ReponseVideoCollectVideo[]) {
  return videos[Math.floor(Math.random() * videos.length)]
}

async function drawRandomVideo() {
  if (isDrawing.value || acceptedVideos.value.length === 0) return

  const runId = ++drawRunId
  let pool = acceptedVideos.value.filter((item) => !drawnIds.value.includes(item.info.bvid ?? ''))
  if (pool.length === 0) {
    drawnIds.value = []
    pool = acceptedVideos.value
    toast.info('本轮已抽完所有视频，已重新开启新一轮')
  }

  isDrawing.value = true
  drawnVideo.value = undefined

  const intervals = [40, 40, 40, 45, 45, 50, 50, 60, 70, 90, 120, 160, 220, 300, 420]
  for (const interval of intervals) {
    if (runId !== drawRunId) return
    drawPreview.value = randomVideo(acceptedVideos.value)
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
  if (runId !== drawRunId) return

  const selected = randomVideo(pool)
  drawnVideo.value = selected
  drawPreview.value = undefined
  if (selected.info.bvid) {
    drawnIds.value = [...drawnIds.value, selected.info.bvid]
  }
  drawnHistory.value = [selected, ...drawnHistory.value.filter((v) => v.info.bvid !== selected.info.bvid)]
  isDrawing.value = false
  if (autoSyncObs.value) pushToObs(selected, true)
}

// 逐个观看
function openSequenceVideo() {
  if (!sequenceVideo.value) return
  openVideo(sequenceVideo.value)
  if (sequenceIndex.value < acceptedVideos.value.length) {
    sequenceIndex.value++
  }
}

function playSequenceVideo() {
  if (!sequenceVideo.value) return
  playVideoInline(sequenceVideo.value)
}

function skipSequenceVideo() {
  if (sequenceIndex.value < acceptedVideos.value.length) {
    sequenceIndex.value++
    if (autoSyncObs.value && sequenceVideo.value) {
      pushToObs(sequenceVideo.value, true)
    }
  }
}

function prevSequenceVideo() {
  if (sequenceIndex.value > 0) {
    sequenceIndex.value--
    if (autoSyncObs.value && sequenceVideo.value) {
      pushToObs(sequenceVideo.value, true)
    }
  }
}

function setSequenceIndex(idx: number) {
  if (idx >= 0 && idx < acceptedVideos.value.length) {
    sequenceIndex.value = idx
    if (autoSyncObs.value && sequenceVideo.value) {
      pushToObs(sequenceVideo.value, true)
    }
  }
}

function restartSequence() {
  sequenceIndex.value = 0
}

function resetProgress() {
  const prevWatched = [...watchedIds.value]
  watchedIds.value = []
  revealedIds.value = []
  sequenceIndex.value = 0
  drawnIds.value = []
  drawnHistory.value = []
  drawnVideo.value = undefined
  drawPreview.value = undefined
  void persistWatchedChange(prevWatched, false)
  toast.success('已重置所有进度')
}

function resetFilter() {
  searchQuery.value = ''
  watchFilter.value = 'all'
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement | null
  if (playerOpen.value || (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'))) return

  if (mode.value === 'draw' && e.code === 'Space') {
    e.preventDefault()
    void drawRandomVideo()
  } else if (mode.value === 'sequence') {
    if (e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault()
      if (sequenceVideo.value) openSequenceVideo()
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault()
      prevSequenceVideo()
    }
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <VideoCollectPageShell :table="table">
    <main
      class="w-[min(calc(100%-32px),1200px)] max-w-[var(--vtsuru-page-max-width,1200px)] min-w-0 min-h-screen min-h-[100svh] mx-auto pt-8 pb-16 box-border"
    >
      <div
        v-if="isLoading && videoDetail === undefined"
        class="py-24 flex justify-center"
      >
        <Spin />
      </div>

      <!-- 404 状态 -->
      <div
        v-else-if="videoDetail === null && !isLoading && !loadError"
        class="text-center py-24 space-y-3"
      >
        <h2 class="text-2xl font-bold">视频征集不存在</h2>
        <p class="text-sm text-muted-foreground">链接可能有误，或该征集已被删除。</p>
        <Button
          variant="outline"
          class="mt-2"
          @click="router.push({ name: 'index' })"
        >
          返回首页
        </Button>
      </div>

      <!-- 网络加载异常重试状态 -->
      <div
        v-else-if="loadError && !isLoading"
        class="text-center py-24 space-y-3"
      >
        <h2 class="text-2xl font-bold text-destructive">加载结果失败</h2>
        <p class="text-sm text-muted-foreground">{{ loadError }}</p>
        <Button
          class="mt-2 gap-1.5 mx-auto"
          @click="loadData"
        >
          <RotateCcw class="size-3.5" />
          重新加载
        </Button>
      </div>

      <!-- 正常内容展示 -->
      <template v-else-if="videoDetail && table">
        <!-- 头部信息 -->
        <header class="result-header flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div class="result-heading space-y-1.5 min-w-0 flex-1">
            <Button
              variant="link"
              size="xs"
              class="owner-link h-auto p-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-normal"
              @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
            >
              <User class="size-3.5" />
              <span>{{ table.owner.name }}</span>
              <span class="owner-suffix opacity-75">的视频征集</span>
            </Button>
            <div class="title-row flex items-center flex-wrap gap-2.5">
              <h1 class="text-2xl font-bold tracking-tight min-w-0 break-words">{{ table.name }}</h1>
              <Badge :variant="isCollecting ? 'default' : 'secondary'">
                {{ lifecycleLabel }}
              </Badge>
            </div>
            <p
              v-if="table.description"
              class="table-description text-xs text-muted-foreground leading-relaxed max-w-2xl break-words"
            >
              {{ table.description }}
            </p>
          </div>

          <div class="header-actions flex items-center flex-wrap gap-2 shrink-0">
            <SimpleTooltip
              v-if="isOwner"
              content="开启后，切播、播放或抽中视频时自动同步到 OBS 视频征集角标"
            >
              <Button
                :variant="autoSyncObs ? 'default' : 'outline'"
                class="gap-1.5"
                @click="autoSyncObs = !autoSyncObs"
              >
                <Radio class="size-3.5" />
                {{ autoSyncObs ? 'OBS 联动已开启' : 'OBS 角标联动' }}
              </Button>
            </SimpleTooltip>

            <Button
              v-if="isCollecting"
              variant="default"
              class="gap-1.5"
              @click="router.push({ name: 'video-collect', params: { id: table.shortId } })"
            >
              推荐视频
              <ArrowRight class="size-3.5" />
            </Button>
          </div>
        </header>

        <!-- Bento 统计与进度看板 -->
        <section
          class="result-summary-grid my-6 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
          aria-label="征集统计与观看进度"
        >
          <div class="summary-card p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3 min-w-0">
            <div class="size-9 rounded-lg bg-primary/10 text-primary flex-center shrink-0">
              <Video class="size-4" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-muted-foreground">通过视频</span>
              <strong class="text-base font-bold font-mono tabular-nums">{{ acceptedVideos.length }}</strong>
            </div>
          </div>

          <div class="summary-card p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3 min-w-0">
            <div class="size-9 rounded-lg bg-sky-500/10 text-sky-500 flex-center shrink-0">
              <Clock class="size-4" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-muted-foreground">总时长</span>
              <strong class="text-base font-bold font-mono tabular-nums truncate">
                {{ formatVideoDuration(totalDuration) }}
              </strong>
            </div>
          </div>

          <div class="summary-card p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3 min-w-0">
            <div class="size-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex-center shrink-0">
              <CheckCircle2 class="size-4" />
            </div>
            <div class="flex flex-col min-w-0">
              <span class="text-muted-foreground">已观看</span>
              <strong class="text-base font-bold font-mono tabular-nums">
                {{ watchedVideos.length }} / {{ acceptedVideos.length }}
              </strong>
            </div>
          </div>

          <div
            class="summary-card p-3.5 rounded-xl border border-border/80 bg-card flex flex-col justify-between min-w-0"
            :class="{ 'border-emerald-500/50 bg-emerald-500/5': isAllWatched }"
          >
            <div class="flex-between gap-2">
              <div class="flex items-center gap-1.5 font-medium min-w-0">
                <Trophy
                  v-if="isAllWatched"
                  class="size-4 text-primary shrink-0"
                />
                <Sparkles
                  v-else
                  class="size-4 text-primary shrink-0"
                />
                <span class="truncate">观看进度</span>
              </div>
              <strong class="font-mono tabular-nums font-bold">{{ progressPercentage }}%</strong>
            </div>
            <Progress
              :model-value="progressPercentage"
              class="mt-2"
            />
          </div>
        </section>

        <!-- 工作台区域 -->
        <section class="result-workspace space-y-4">
          <!-- 模式切换与工具栏 -->
          <div class="workspace-toolbar flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border border-border/80 bg-muted/20">
            <ToggleGroup
              type="single"
              class="w-full sm:w-auto grid grid-cols-2 sm:inline-flex !h-auto"
              :model-value="mode"
              @update:model-value="
                (val) => {
                  if (val) mode = val as ViewMode
                }
              "
            >
              <ToggleGroupItem
                value="list"
                class="gap-1.5"
              >
                <LayoutGrid class="size-3.5" />
                全部视频
              </ToggleGroupItem>
              <ToggleGroupItem
                value="draw"
                class="gap-1.5"
              >
                <Shuffle class="size-3.5" />
                随机抽取
              </ToggleGroupItem>
              <ToggleGroupItem
                value="sequence"
                class="gap-1.5"
              >
                <PlayCircle class="size-3.5" />
                逐个观看
              </ToggleGroupItem>
              <ToggleGroupItem
                value="flip"
                class="gap-1.5"
              >
                <Sparkles class="size-3.5" />
                随机翻牌
              </ToggleGroupItem>
            </ToggleGroup>

            <!-- 各模式快捷操作区 -->
            <div class="toolbar-actions flex items-center gap-2 flex-wrap text-xs w-full sm:w-auto">
              <template v-if="mode === 'list'">
                <div class="relative flex-1 sm:flex-none sm:w-48">
                  <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    v-model="searchQuery"
                    placeholder="搜索标题、UP 主、分区..."
                    class="pl-8"
                  />
                </div>

                <ToggleGroup
                  type="single"
                  size="xs"
                  :model-value="watchFilter"
                  @update:model-value="
                    (val) => {
                      if (val) watchFilter = val as WatchFilter
                    }
                  "
                >
                  <ToggleGroupItem value="all">全部</ToggleGroupItem>
                  <ToggleGroupItem value="unwatched">未看</ToggleGroupItem>
                  <ToggleGroupItem value="watched">已看</ToggleGroupItem>
                </ToggleGroup>

                <div class="w-36">
                  <Select v-model="sortBy">
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in sortOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </template>

              <template v-if="mode === 'flip'">
                <span class="text-muted-foreground text-xs font-mono tabular-nums">
                  已揭晓 {{ revealedIds.length }} / {{ shuffledVideos.length }}
                </span>
                <Button
                  variant="outline"
                  class="gap-1"
                  @click="shuffleDeck"
                >
                  <Shuffle class="size-3.5" />
                  重新洗牌
                </Button>
                <Button
                  variant="outline"
                  class="gap-1"
                  @click="revealAll"
                >
                  <Eye class="size-3.5" />
                  全部翻开
                </Button>
                <Button
                  variant="outline"
                  class="gap-1"
                  @click="hideAll"
                >
                  <EyeOff class="size-3.5" />
                  全部盖上
                </Button>
              </template>

              <Popconfirm
                v-if="watchedIds.length > 0 || drawnIds.length > 0"
                title="确定重置进度？"
                positive-text="重置"
                negative-text="取消"
                @positive-click="resetProgress"
              >
                <template #trigger>
                  <Button
                    variant="ghost"
                    class="text-muted-foreground hover:text-destructive gap-1"
                  >
                    <RotateCcw class="size-3.5" />
                    重置进度
                  </Button>
                </template>
                确定要重置所有已观看与抽取记录吗？此操作无法撤销。
              </Popconfirm>
            </div>
          </div>

          <!-- 模式内容区 -->
          <div class="mode-stage-wrapper">
            <div
              v-if="acceptedVideos.length === 0"
              class="text-center py-16 space-y-2"
            >
              <h3 class="text-base font-semibold">暂无通过的视频</h3>
              <p class="text-xs text-muted-foreground">
                {{ isCollecting ? '征集进行中，主播审核通过后会显示在这里。' : '审核通过后，视频会显示在这里。' }}
              </p>
            </div>

            <!-- 模式 1：全部视频列表 -->
            <template v-else-if="mode === 'list'">
              <div
                v-if="filteredVideos.length === 0"
                class="empty-filter-state text-center py-16 space-y-3"
              >
                <h3 class="text-base font-semibold">未找到匹配的视频</h3>
                <p class="text-xs text-muted-foreground">可以尝试调整搜索关键词或筛选条件</p>
                <Button
                  variant="outline"
                  @click="resetFilter"
                >
                  清除筛选
                </Button>
              </div>

              <div
                v-else
                class="result-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                <VideoCollectResultCard
                  v-for="(item, index) in filteredVideos"
                  :key="`list-${item.info.bvid}`"
                  :item="item"
                  :index="index"
                  presentation="plain"
                  :revealed="true"
                  :watched="watchedIds.includes(item.info.bvid ?? '')"
                  :can-push-obs="isOwner"
                  @select="openVideo(item)"
                  @play="playVideoInline(item)"
                  @push-to-obs="pushToObs(item)"
                  @toggle-watched="item.info.bvid && toggleWatched(item.info.bvid)"
                />
              </div>
            </template>

            <!-- 模式 2：随机抽取 -->
            <VideoCollectDrawStage
              v-else-if="mode === 'draw'"
              :accepted-videos="acceptedVideos"
              :drawn-ids="drawnIds"
              :drawn-history="drawnHistory"
              :drawn-video="drawnVideo"
              :draw-display-video="drawDisplayVideo"
              :is-drawing="isDrawing"
              :watched-ids="watchedIds"
              :can-push-obs="isOwner"
              @draw="drawRandomVideo"
              @select-video="openVideo"
              @play-video="playVideoInline"
              @push-to-obs="pushToObs"
              @toggle-watched="toggleWatched"
              @select-history="(item) => (drawnVideo = item)"
            />

            <!-- 模式 3：逐个观看 -->
            <VideoCollectSequenceStage
              v-else-if="mode === 'sequence'"
              :accepted-videos="acceptedVideos"
              :sequence-video="sequenceVideo"
              :sequence-index="sequenceIndex"
              :watched-ids="watchedIds"
              :watched-count="watchedVideos.length"
              :watched-duration="watchedDuration"
              :can-push-obs="isOwner"
              @prev="prevSequenceVideo"
              @skip="skipSequenceVideo"
              @open-current="openSequenceVideo"
              @play-current="playSequenceVideo"
              @push-to-obs="pushToObs"
              @toggle-watched="toggleWatched"
              @set-index="setSequenceIndex"
              @restart="restartSequence"
            />

            <!-- 模式 4：随机翻牌盲盒 -->
            <div
              v-else-if="mode === 'flip'"
              class="result-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
            >
              <VideoCollectResultCard
                v-for="(item, index) in shuffledVideos"
                :key="`flip-${item.info.bvid}`"
                :item="item"
                :index="index"
                presentation="flip"
                :revealed="revealedIds.includes(item.info.bvid ?? '')"
                :watched="watchedIds.includes(item.info.bvid ?? '')"
                :can-push-obs="isOwner"
                @select="openVideo(item)"
                @play="playVideoInline(item)"
                @push-to-obs="pushToObs(item)"
                @toggle-reveal="item.info.bvid && toggleReveal(item.info.bvid)"
                @toggle-watched="item.info.bvid && toggleWatched(item.info.bvid)"
              />
            </div>
          </div>
        </section>
      </template>

      <!-- 站内播放弹窗 -->
      <BiliVideoPreviewDialog
        v-model:open="playerOpen"
        :bvid="playerItem?.info.bvid ?? ''"
        :title="playerItem?.video.title ?? ''"
        :page="playerItem?.info.page ?? 1"
        :subtitle="playerItem?.info.senders[0]?.sender ? `推荐人：${playerItem.info.senders[0].sender}` : ''"
      >
        <template
          v-if="isOwner && playerItem"
          #footer-extra
        >
          <Button
            variant="outline"
            @click="pushToObs(playerItem)"
          >
            <Radio class="size-3.5 mr-1" />
            同步到 OBS 角标
          </Button>
        </template>
      </BiliVideoPreviewDialog>
    </main>
  </VideoCollectPageShell>
</template>
