<script setup lang="ts">
import {
  Apps24Regular,
  ArrowClockwise24Regular,
  ArrowLeft24Regular,
  ArrowRight24Regular,
  ArrowSwap24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Eye24Regular,
  EyeOff24Regular,
  Grid24Regular,
  History24Regular,
  Person24Regular,
  PlayCircle24Regular,
  Search24Regular,
  Sparkle24Regular,
  Trophy24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectDetail, VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'
import { getApiVideoCollectGet } from '@/api/generated/video-collect/video-collect'
import { formatDuration } from '@/apps/manage/composables/formatters'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

import VideoCollectPageShell from './VideoCollectPageShell.vue'
import VideoCollectResultCard from './VideoCollectResultCard.vue'

type ResultVideo = { info: VideoInfo; video: VideoCollectVideo }
type ViewMode = 'list' | 'draw' | 'sequence' | 'flip'
type WatchFilter = 'all' | 'unwatched' | 'watched'
type SortOption = 'default' | 'duration-asc' | 'duration-desc' | 'senders-desc'

const route = useRoute()
const router = useRouter()

const videoDetail = ref<VideoCollectDetail | null | undefined>()
const isLoading = ref(false)
const loadError = ref<string | null>(null)
const mode = ref<ViewMode>('list')

// 过滤与排序状态
const searchQuery = ref('')
const watchFilter = ref<WatchFilter>('all')
const sortBy = ref<SortOption>('default')

// 观看与交互状态
const watchedIds = ref<string[]>([])
const revealedIds = ref<string[]>([])
const sequenceIndex = ref(0)
const shuffledVideos = ref<ResultVideo[]>([])

// 随机抽取状态
const drawnIds = ref<string[]>([])
const drawnHistory = ref<ResultVideo[]>([])
const drawnVideo = ref<ResultVideo>()
const drawPreview = ref<ResultVideo>()
const isDrawing = ref(false)
let drawRunId = 0

const table = computed(() => videoDetail.value?.table)

const acceptedVideos = computed(() =>
  (videoDetail.value?.videos ?? []).filter((item) => item.info.status === VideoStatus.Accepted),
)
const totalDuration = computed(() => acceptedVideos.value.reduce((sum, item) => sum + item.video.length, 0))
const watchedVideos = computed(() => acceptedVideos.value.filter((item) => watchedIds.value.includes(item.info.bvid)))
const watchedDuration = computed(() => watchedVideos.value.reduce((sum, item) => sum + item.video.length, 0))
const progressPercentage = computed(() =>
  totalDuration.value === 0 ? 0 : Math.round((watchedDuration.value / totalDuration.value) * 100),
)
const isAllWatched = computed(
  () => acceptedVideos.value.length > 0 && watchedVideos.value.length === acceptedVideos.value.length,
)

// 列表模式下的筛选与排序
const filteredVideos = computed(() => {
  let list = [...acceptedVideos.value]

  // 搜索关键字（标题、UP主、推荐人、推荐理由、BV号）
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    list = list.filter((item) => {
      const titleMatch = item.video.title.toLowerCase().includes(query)
      const ownerMatch = item.video.ownerName.toLowerCase().includes(query)
      const bvidMatch = item.info.bvid.toLowerCase().includes(query)
      const senderMatch = item.info.senders.some(
        (s) =>
          (s.sender && s.sender.toLowerCase().includes(query)) ||
          (s.description && s.description.toLowerCase().includes(query)),
      )
      return titleMatch || ownerMatch || bvidMatch || senderMatch
    })
  }

  // 观看状态过滤
  if (watchFilter.value === 'unwatched') {
    list = list.filter((item) => !watchedIds.value.includes(item.info.bvid))
  } else if (watchFilter.value === 'watched') {
    list = list.filter((item) => watchedIds.value.includes(item.info.bvid))
  }

  // 排序
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
const isCollecting = computed(() => Boolean(table.value && !table.value.isFinish && table.value.endAt > Date.now()))

const sortOptions = [
  { label: '默认投稿顺序', value: 'default' },
  { label: '时长：从短到长', value: 'duration-asc' },
  { label: '时长：从长到短', value: 'duration-desc' },
  { label: '推荐人数：由多到少', value: 'senders-desc' },
]

await loadData()
watch(() => route.params.id, loadData)
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

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

function progressStorageKey() {
  return `video-collect-result:${currentId()}`
}

function loadProgress() {
  try {
    const value = JSON.parse(localStorage.getItem(progressStorageKey()) ?? '[]')
    watchedIds.value = Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
  } catch {
    watchedIds.value = []
    localStorage.removeItem(progressStorageKey())
  }
}

function saveProgress() {
  localStorage.setItem(progressStorageKey(), JSON.stringify(watchedIds.value))
}

async function loadData() {
  isLoading.value = true
  loadError.value = null
  try {
    const response = (await getApiVideoCollectGet({
      id: currentId(),
    })) as unknown as {
      code: number
      message?: string
      data: VideoCollectDetail
    }
    if (response.code === 200) {
      videoDetail.value = response.data
      loadProgress()
    } else if (response.code === 404) {
      videoDetail.value = null
    } else {
      throw new Error(response.message || '加载征集数据失败')
    }
  } catch (error) {
    console.error('获取视频征集结果失败', error)
    loadError.value = error instanceof Error ? error.message : '网络异常，加载失败'
    toast.error(loadError.value)
  } finally {
    isLoading.value = false
  }
}

function toggleWatched(bvid: string) {
  if (watchedIds.value.includes(bvid)) {
    watchedIds.value = watchedIds.value.filter((id) => id !== bvid)
  } else {
    watchedIds.value = [...watchedIds.value, bvid]
  }
  saveProgress()
}

function markWatched(item: ResultVideo) {
  if (watchedIds.value.includes(item.info.bvid)) return
  watchedIds.value = [...watchedIds.value, item.info.bvid]
  saveProgress()
}

function openVideo(item: ResultVideo) {
  markWatched(item)
  window.open(`https://www.bilibili.com/video/${item.info.bvid}`, '_blank', 'noopener,noreferrer')
}

// 翻牌相关
function toggleReveal(bvid: string) {
  if (revealedIds.value.includes(bvid)) {
    revealedIds.value = revealedIds.value.filter((id) => id !== bvid)
  } else {
    revealedIds.value = [...revealedIds.value, bvid]
  }
}

function revealAll() {
  revealedIds.value = shuffledVideos.value.map((v) => v.info.bvid)
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

// 随机抽取算法
function randomVideo(videos: ResultVideo[]) {
  return videos[Math.floor(Math.random() * videos.length)]
}

async function drawRandomVideo() {
  if (isDrawing.value || acceptedVideos.value.length === 0) return

  const runId = ++drawRunId
  let pool = acceptedVideos.value.filter((item) => !drawnIds.value.includes(item.info.bvid))
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
  drawnIds.value = [...drawnIds.value, selected.info.bvid]
  drawnHistory.value = [selected, ...drawnHistory.value.filter((v) => v.info.bvid !== selected.info.bvid)]
  isDrawing.value = false
}

// 逐个观看相关
function openSequenceVideo() {
  if (!sequenceVideo.value) return
  openVideo(sequenceVideo.value)
  if (sequenceIndex.value < acceptedVideos.value.length) {
    sequenceIndex.value++
  }
}

function skipSequenceVideo() {
  if (sequenceIndex.value < acceptedVideos.value.length) {
    sequenceIndex.value++
  }
}

function prevSequenceVideo() {
  if (sequenceIndex.value > 0) {
    sequenceIndex.value--
  }
}

function setSequenceIndex(idx: number) {
  if (idx >= 0 && idx < acceptedVideos.value.length) {
    sequenceIndex.value = idx
  }
}

function restartSequence() {
  sequenceIndex.value = 0
}

function resetProgress() {
  watchedIds.value = []
  revealedIds.value = []
  sequenceIndex.value = 0
  drawnIds.value = []
  drawnHistory.value = []
  drawnVideo.value = undefined
  drawPreview.value = undefined
  saveProgress()
  toast.success('已重置所有进度')
}

function resetFilter() {
  searchQuery.value = ''
  watchFilter.value = 'all'
}

function handleKeydown(e: KeyboardEvent) {
  const target = e.target as HTMLElement
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return

  if (mode.value === 'draw' && e.code === 'Space') {
    e.preventDefault()
    drawRandomVideo()
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
    <main class="w-[min(calc(100%-32px),1200px)] max-w-[var(--vtsuru-page-max-width,1200px)] min-w-0 min-h-screen min-h-[100svh] mx-auto pt-9 pb-16 box-border">
      <div
        v-if="isLoading && !videoDetail"
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
          @click="router.push({ name: 'home' })"
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
          class="mt-2 flex items-center gap-1.5 mx-auto"
          @click="loadData"
        >
          <component
            :is="ArrowClockwise24Regular"
            class="size-4"
          />
          重新加载
        </Button>
      </div>

      <!-- 正常内容展示 -->
      <template v-else-if="videoDetail && table">
        <!-- 头部信息 -->
        <header class="result-header flex items-start justify-between gap-4">
          <div
            class="result-heading space-y-1.5"
            :style="{
              color: 'var(--vtsuru-page-text)',
              '--foreground': 'var(--vtsuru-page-text)',
              '--muted-foreground': 'var(--vtsuru-page-text-muted)',
            }"
          >
            <button
              type="button"
              class="owner-link flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition cursor-pointer"
              @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
            >
              <component
                :is="Person24Regular"
                class="size-3.5"
              />
              <span>{{ table.owner.name }}</span>
              <span class="owner-suffix opacity-75">的视频征集</span>
            </button>
            <div class="title-row flex items-center gap-2.5">
              <h1 class="text-2xl font-bold tracking-tight min-w-0">{{ table.name }}</h1>
              <Badge
                :variant="isCollecting ? 'default' : 'secondary'"
                class="text-xs"
              >
                {{ isCollecting ? '征集中' : '已结束' }}
              </Badge>
            </div>
            <p
              v-if="table.description"
              class="table-description text-xs text-muted-foreground leading-relaxed max-w-2xl"
            >
              {{ table.description }}
            </p>
          </div>
          <div class="header-actions">
            <Button
              v-if="isCollecting"
              variant="default"
              class="flex items-center gap-1.5"
              @click="router.push({ name: 'video-collect', params: { id: table.shortId } })"
            >
              推荐视频
              <component
                :is="ArrowRight24Regular"
                class="size-4"
              />
            </Button>
          </div>
        </header>

        <!-- Bento 统计与进度看板 -->
        <section
          class="result-summary-grid my-6 grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
          aria-label="征集统计与观看进度"
        >
          <div
            class="summary-card stat-videos p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3"
          >
            <div
              class="stat-icon-wrapper size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"
            >
              <component
                :is="Video24Regular"
                class="size-5"
              />
            </div>
            <div class="stat-content flex flex-col">
              <span class="stat-label text-muted-foreground">通过视频</span>
              <strong class="stat-value text-base font-bold">{{ acceptedVideos.length }}</strong>
            </div>
          </div>

          <div
            class="summary-card stat-duration p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3"
          >
            <div
              class="stat-icon-wrapper size-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0"
            >
              <component
                :is="Clock24Regular"
                class="size-5"
              />
            </div>
            <div class="stat-content flex flex-col">
              <span class="stat-label text-muted-foreground">总时长</span>
              <strong class="stat-value text-base font-bold font-mono">{{ formatDuration(totalDuration) }}</strong>
            </div>
          </div>

          <div
            class="summary-card stat-watched p-3.5 rounded-xl border border-border/80 bg-card flex items-center gap-3"
          >
            <div
              class="stat-icon-wrapper size-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"
            >
              <component
                :is="CheckmarkCircle24Regular"
                class="size-5"
              />
            </div>
            <div class="stat-content flex flex-col">
              <span class="stat-label text-muted-foreground">已观看</span>
              <strong class="stat-value text-base font-bold"
                >{{ watchedVideos.length }} / {{ acceptedVideos.length }}</strong
              >
            </div>
          </div>

          <div
            class="summary-card progress-card p-3.5 rounded-xl border border-border/80 bg-card flex flex-col justify-between"
            :class="{ 'border-emerald-500/50 bg-emerald-500/5': isAllWatched }"
          >
            <div class="progress-info flex items-center justify-between">
              <div class="progress-title flex items-center gap-1.5 font-medium">
                <component
                  :is="isAllWatched ? Trophy24Regular : Sparkle24Regular"
                  class="size-4 text-primary"
                />
                <span>观看进度</span>
              </div>
              <strong class="progress-value font-mono font-bold">{{ progressPercentage }}%</strong>
            </div>
            <Progress
              :model-value="progressPercentage"
              class="h-2 mt-2"
            />
          </div>
        </section>

        <!-- 工作台区域 -->
        <section class="result-workspace space-y-4">
          <!-- 模式切换与工具栏 -->
          <div
            class="workspace-toolbar flex flex-wrap items-center justify-between gap-3 p-2.5 rounded-xl border border-border/80 bg-muted/20"
          >
            <!-- 模式 Segmented 选择器 -->
            <div class="mode-segmented-control flex items-center bg-muted/60 p-1 rounded-lg gap-1">
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5"
                :class="
                  mode === 'list'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="mode = 'list'"
              >
                <component
                  :is="Grid24Regular"
                  class="size-3.5"
                />
                全部视频
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5"
                :class="
                  mode === 'draw'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="mode = 'draw'"
              >
                <component
                  :is="ArrowSwap24Regular"
                  class="size-3.5"
                />
                随机抽取
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5"
                :class="
                  mode === 'sequence'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="mode = 'sequence'"
              >
                <component
                  :is="PlayCircle24Regular"
                  class="size-3.5"
                />
                逐个观看
              </button>
              <button
                type="button"
                class="px-2.5 py-1 text-xs rounded-md font-medium transition flex items-center gap-1.5"
                :class="
                  mode === 'flip'
                    ? 'bg-background shadow-xs text-foreground font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="mode = 'flip'"
              >
                <component
                  :is="Apps24Regular"
                  class="size-3.5"
                />
                随机翻牌
              </button>
            </div>

            <!-- 各模式对应的快捷操作区 -->
            <div class="toolbar-actions flex items-center gap-2 flex-wrap text-xs">
              <!-- 列表模式：搜索、筛选、排序 -->
              <template v-if="mode === 'list'">
                <div class="relative w-44">
                  <component
                    :is="Search24Regular"
                    class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    v-model="searchQuery"
                    placeholder="搜索标题、UP 主..."
                    class="pl-8"
                  />
                </div>

                <div class="flex items-center bg-muted/60 p-0.5 rounded-md">
                  <button
                    type="button"
                    class="px-2 py-0.5 text-xs rounded transition"
                    :class="
                      watchFilter === 'all'
                        ? 'bg-background shadow-xs text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="watchFilter = 'all'"
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 text-xs rounded transition"
                    :class="
                      watchFilter === 'unwatched'
                        ? 'bg-background shadow-xs text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="watchFilter = 'unwatched'"
                  >
                    未看
                  </button>
                  <button
                    type="button"
                    class="px-2 py-0.5 text-xs rounded transition"
                    :class="
                      watchFilter === 'watched'
                        ? 'bg-background shadow-xs text-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    "
                    @click="watchFilter = 'watched'"
                  >
                    已看
                  </button>
                </div>

                <div class="w-36">
                  <Select v-model="sortBy">
                    <SelectTrigger>
                      <SelectValue placeholder="排序方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in sortOptions"
                        :key="opt.value"
                        :value="opt.value"
                        class="text-xs"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </template>

              <!-- 翻牌模式快捷动作 -->
              <template v-if="mode === 'flip'">
                <span class="text-muted-foreground text-xs font-mono">
                  已揭晓 {{ revealedIds.length }} / {{ shuffledVideos.length }}
                </span>
                <Button
                  variant="outline"
                  class="flex items-center gap-1"
                  @click="shuffleDeck"
                >
                  <component
                    :is="ArrowSwap24Regular"
                    class="size-3.5"
                  />
                  重新洗牌
                </Button>
                <Button
                  variant="outline"
                  class="flex items-center gap-1"
                  @click="revealAll"
                >
                  <component
                    :is="Eye24Regular"
                    class="size-3.5"
                  />
                  全部翻开
                </Button>
                <Button
                  variant="outline"
                  class="flex items-center gap-1"
                  @click="hideAll"
                >
                  <component
                    :is="EyeOff24Regular"
                    class="size-3.5"
                  />
                  全部盖上
                </Button>
              </template>

              <!-- 重置观看进度 -->
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
                    class="text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <component
                      :is="ArrowClockwise24Regular"
                      class="size-3.5"
                    />
                    重置进度
                  </Button>
                </template>
                确定要重置所有已观看与抽取记录吗？此操作无法撤销。
              </Popconfirm>
            </div>
          </div>

          <!-- 模式内容切换区 -->
          <div class="mode-stage-wrapper">
            <!-- 空数据状态 -->
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
                  :watched="watchedIds.includes(item.info.bvid)"
                  @select="openVideo(item)"
                  @toggle-watched="toggleWatched(item.info.bvid)"
                />
              </div>
            </template>

            <!-- 模式 2：随机抽取 -->
            <template v-else-if="mode === 'draw'">
              <div class="draw-stage max-w-xl mx-auto space-y-4">
                <div class="draw-stage-header flex items-center justify-between text-xs text-muted-foreground">
                  <div class="draw-round-info flex items-center gap-1.5 font-mono">
                    <component
                      :is="ArrowSwap24Regular"
                      class="size-3.5"
                    />
                    <span>本轮已抽取</span>
                    <strong class="text-foreground">{{ drawnIds.length }} / {{ acceptedVideos.length }}</strong>
                  </div>
                  <span class="draw-shortcut-tip text-[11px]">提示：可按空格键快捷抽取</span>
                </div>

                <div
                  class="draw-display-box"
                  :class="{ 'opacity-80 scale-[0.99]': isDrawing }"
                >
                  <VideoCollectResultCard
                    v-if="drawDisplayVideo"
                    :key="`draw-${drawDisplayVideo.info.bvid}`"
                    :item="drawDisplayVideo"
                    :index="acceptedVideos.indexOf(drawDisplayVideo)"
                    presentation="plain"
                    :featured="true"
                    :revealed="true"
                    :watched="watchedIds.includes(drawDisplayVideo.info.bvid)"
                    @select="drawnVideo && openVideo(drawnVideo)"
                    @toggle-watched="drawnVideo && toggleWatched(drawnVideo.info.bvid)"
                  />
                  <button
                    v-else
                    type="button"
                    class="draw-trigger-placeholder w-full aspect-video rounded-xl border-2 border-dashed border-border/80 hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground cursor-pointer"
                    @click="drawRandomVideo"
                  >
                    <div
                      class="placeholder-icon size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center"
                    >
                      <component
                        :is="Sparkle24Regular"
                        class="size-6"
                      />
                    </div>
                    <strong class="text-sm">点击开始随机抽取</strong>
                    <span class="text-xs text-muted-foreground">或按键盘空格键</span>
                  </button>
                </div>

                <div class="draw-actions-row flex items-center justify-center gap-3 pt-2">
                  <Button
                    v-if="drawnVideo"
                    variant="outline"
                    size="lg"
                    class="flex items-center gap-1.5"
                    @click="openVideo(drawnVideo)"
                  >
                    在哔哩哔哩打开
                    <component
                      :is="ArrowRight24Regular"
                      class="size-4"
                    />
                  </Button>
                  <Button
                    size="lg"
                    :disabled="isDrawing"
                    class="main-draw-btn flex items-center gap-1.5 px-8"
                    @click="drawRandomVideo"
                  >
                    <component
                      :is="Sparkle24Regular"
                      class="size-4"
                    />
                    {{ drawnVideo ? '继续抽取下一个' : '开始抽取' }}
                  </Button>
                </div>

                <!-- 历史抽取记录流 -->
                <div
                  v-if="drawnHistory.length > 0"
                  class="drawn-history-stream space-y-2 pt-4 border-t border-border/60"
                >
                  <div class="history-title flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                    <component
                      :is="History24Regular"
                      class="size-3.5"
                    />
                    <span>抽取历史 ({{ drawnHistory.length }})</span>
                  </div>
                  <div class="history-scroll-track flex gap-2.5 overflow-x-auto pb-2">
                    <div
                      v-for="histItem in drawnHistory"
                      :key="`hist-${histItem.info.bvid}`"
                      class="history-item-pill flex items-center gap-2 p-1.5 pr-3 rounded-lg border border-border/80 bg-card hover:border-primary/50 cursor-pointer shrink-0 transition"
                      :class="{ 'border-primary bg-primary/5': drawnVideo?.info.bvid === histItem.info.bvid }"
                      @click="drawnVideo = histItem"
                    >
                      <img
                        :src="histItem.video.cover.replace('http://', 'https://')"
                        :alt="histItem.video.title"
                        class="hist-thumb size-9 rounded object-cover"
                      />
                      <div class="hist-info flex flex-col text-xs max-w-36">
                        <span class="hist-name font-medium truncate">{{ histItem.video.title }}</span>
                        <span class="hist-sender text-[11px] text-muted-foreground truncate">{{
                          histItem.info.senders[0]?.sender || histItem.video.ownerName
                        }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- 模式 3：逐个观看 -->
            <template v-else-if="mode === 'sequence'">
              <div
                v-if="sequenceVideo"
                class="sequence-stage max-w-2xl mx-auto space-y-4"
              >
                <div class="sequence-header flex items-center justify-between text-xs text-muted-foreground">
                  <div class="sequence-nav-info flex items-center gap-1.5 font-mono">
                    <component
                      :is="PlayCircle24Regular"
                      class="size-3.5 text-primary"
                    />
                    <span>当前视频</span>
                    <strong class="text-foreground">{{ sequenceIndex + 1 }} / {{ acceptedVideos.length }}</strong>
                  </div>
                  <span class="sequence-tip text-[11px]">左右方向键快速切歌 / 空格键播放</span>
                </div>

                <VideoCollectResultCard
                  :key="`seq-${sequenceVideo.info.bvid}`"
                  :item="sequenceVideo"
                  :index="sequenceIndex"
                  presentation="plain"
                  :featured="true"
                  :revealed="true"
                  :watched="watchedIds.includes(sequenceVideo.info.bvid)"
                  @select="openSequenceVideo"
                  @toggle-watched="toggleWatched(sequenceVideo.info.bvid)"
                />

                <div class="sequence-controls flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    :disabled="sequenceIndex === 0"
                    class="flex items-center gap-1.5"
                    @click="prevSequenceVideo"
                  >
                    <component
                      :is="ArrowLeft24Regular"
                      class="size-4"
                    />
                    上一个
                  </Button>
                  <Button
                    variant="secondary"
                    @click="skipSequenceVideo"
                  >
                    跳过此视频
                  </Button>
                  <Button
                    class="flex items-center gap-1.5"
                    @click="openSequenceVideo"
                  >
                    打开并在 B 站播放
                    <component
                      :is="ArrowRight24Regular"
                      class="size-4"
                    />
                  </Button>
                </div>

                <!-- 底部播放列表 -->
                <div class="sequence-filmstrip space-y-2 pt-4 border-t border-border/60">
                  <div class="filmstrip-label text-xs font-semibold text-muted-foreground">播放列表</div>
                  <div class="filmstrip-track flex gap-2 overflow-x-auto pb-2">
                    <button
                      v-for="(item, idx) in acceptedVideos"
                      :key="`strip-${item.info.bvid}`"
                      type="button"
                      class="filmstrip-item flex items-center gap-2 p-1.5 pr-2.5 rounded-lg border border-border/80 bg-card hover:border-primary/50 text-left shrink-0 transition"
                      :class="{
                        'border-primary bg-primary/5': idx === sequenceIndex,
                        'opacity-60': watchedIds.includes(item.info.bvid),
                      }"
                      @click="setSequenceIndex(idx)"
                    >
                      <span class="strip-index font-mono text-[11px] text-muted-foreground w-4 text-center">{{
                        idx + 1
                      }}</span>
                      <img
                        :src="item.video.cover.replace('http://', 'https://')"
                        :alt="item.video.title"
                        class="strip-thumb size-8 rounded object-cover"
                      />
                      <div class="strip-details flex flex-col text-xs max-w-32">
                        <span class="strip-title truncate font-medium">{{ item.video.title }}</span>
                        <span class="strip-duration font-mono text-[10px] text-muted-foreground">{{
                          formatDuration(item.video.length)
                        }}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>

              <div
                v-else
                class="text-center py-16 space-y-3"
              >
                <h3 class="text-lg font-bold">本轮征集视频已全部浏览完毕</h3>
                <p class="text-xs text-muted-foreground">
                  已累计观看 {{ watchedVideos.length }} 个视频，总观看时长 {{ formatDuration(watchedDuration) }}
                </p>
                <Button
                  class="mt-2 flex items-center gap-1.5 mx-auto"
                  @click="restartSequence"
                >
                  <component
                    :is="ArrowClockwise24Regular"
                    class="size-4"
                  />
                  从头再看一轮
                </Button>
              </div>
            </template>

            <!-- 模式 4：随机翻牌盲盒 -->
            <template v-else-if="mode === 'flip'">
              <div class="result-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <VideoCollectResultCard
                  v-for="(item, index) in shuffledVideos"
                  :key="`flip-${item.info.bvid}`"
                  :item="item"
                  :index="index"
                  presentation="flip"
                  :revealed="revealedIds.includes(item.info.bvid)"
                  :watched="watchedIds.includes(item.info.bvid)"
                  @select="openVideo(item)"
                  @toggle-reveal="toggleReveal(item.info.bvid)"
                  @toggle-watched="toggleWatched(item.info.bvid)"
                />
              </div>
            </template>
          </div>
        </section>
      </template>
    </main>
  </VideoCollectPageShell>
</template>

