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
  Filter24Regular,
  Grid24Regular,
  History24Regular,
  Person24Regular,
  PlayCircle24Regular,
  Search24Regular,
  Sparkle24Regular,
  Trophy24Regular,
  Video24Regular,
} from '@vicons/fluent'
import {
  NButton,
  NIcon,
  NInput,
  NPopconfirm,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NResult,
  NSelect,
  NSpin,
  NTag,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectDetail, VideoCollectVideo, VideoInfo } from '@/api/api-models'
import { VideoStatus } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { formatDuration } from '@/apps/manage/composables/formatters'
import { VIDEO_COLLECT_API_URL } from '@/shared/config'

import VideoCollectPageShell from './VideoCollectPageShell.vue'
import VideoCollectResultCard from './VideoCollectResultCard.vue'

type ResultVideo = { info: VideoInfo; video: VideoCollectVideo }
type ViewMode = 'list' | 'draw' | 'sequence' | 'flip'
type WatchFilter = 'all' | 'unwatched' | 'watched'
type SortOption = 'default' | 'duration-asc' | 'duration-desc' | 'senders-desc'

const route = useRoute()
const router = useRouter()
const message = useMessage()

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
    const response = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: currentId() })
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
    message.error(loadError.value)
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

// 随机抽取算法（带平滑减速与定格动效）
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
    message.info('本轮已抽完所有视频，已重新开启新一轮')
  }

  isDrawing.value = true
  drawnVideo.value = undefined

  // 减速时间表：高速滚动 -> 逐渐减速 -> 定格
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
  message.success('已重置所有进度')
}

function resetFilter() {
  searchQuery.value = ''
  watchFilter.value = 'all'
}

// 快捷键支持
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
    <main class="result-page">
      <NSpin :show="isLoading">
        <!-- 404 状态 -->
        <NResult
          v-if="videoDetail === null && !isLoading && !loadError"
          status="404"
          title="视频征集不存在"
          description="链接可能有误，或该征集已被删除。"
        >
          <template #footer>
            <NButton
              secondary
              @click="router.push({ name: 'home' })"
            >
              返回首页
            </NButton>
          </template>
        </NResult>

        <!-- 网络加载异常重试状态 -->
        <NResult
          v-else-if="loadError && !isLoading"
          status="error"
          title="加载结果失败"
          :description="loadError"
        >
          <template #footer>
            <NButton
              type="primary"
              @click="loadData"
            >
              <template #icon><NIcon :component="ArrowClockwise24Regular" /></template>
              重新加载
            </NButton>
          </template>
        </NResult>

        <!-- 正常内容展示 -->
        <template v-else-if="videoDetail && table">
          <!-- 头部信息 -->
          <header class="result-header">
            <div class="result-heading">
              <button
                type="button"
                class="owner-link"
                @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
              >
                <NIcon :component="Person24Regular" />
                <span>{{ table.owner.name }}</span>
                <span class="owner-suffix">的视频征集</span>
              </button>
              <div class="title-row">
                <h1>{{ table.name }}</h1>
                <NTag
                  size="small"
                  :type="isCollecting ? 'success' : 'default'"
                  :bordered="false"
                  class="status-tag"
                >
                  {{ isCollecting ? '征集中' : '已结束' }}
                </NTag>
              </div>
              <p
                v-if="table.description"
                class="table-description"
              >
                {{ table.description }}
              </p>
            </div>
            <div class="header-actions">
              <NButton
                v-if="isCollecting"
                type="primary"
                secondary
                @click="router.push({ name: 'video-collect', params: { id: table.shortId } })"
              >
                推荐视频
                <template #icon><NIcon :component="ArrowRight24Regular" /></template>
              </NButton>
            </div>
          </header>

          <!-- 现代 Bento 风格统计与进度看板 -->
          <section
            class="result-summary-grid"
            aria-label="征集统计与观看进度"
          >
            <div class="summary-card stat-videos">
              <div class="stat-icon-wrapper">
                <NIcon :component="Video24Regular" />
              </div>
              <div class="stat-content">
                <span class="stat-label">通过视频</span>
                <strong class="stat-value">{{ acceptedVideos.length }}</strong>
              </div>
            </div>

            <div class="summary-card stat-duration">
              <div class="stat-icon-wrapper">
                <NIcon :component="Clock24Regular" />
              </div>
              <div class="stat-content">
                <span class="stat-label">总时长</span>
                <strong class="stat-value">{{ formatDuration(totalDuration) }}</strong>
              </div>
            </div>

            <div class="summary-card stat-watched">
              <div class="stat-icon-wrapper">
                <NIcon :component="CheckmarkCircle24Regular" />
              </div>
              <div class="stat-content">
                <span class="stat-label">已观看</span>
                <strong class="stat-value">{{ watchedVideos.length }} / {{ acceptedVideos.length }}</strong>
              </div>
            </div>

            <div
              class="summary-card progress-card"
              :class="{ 'is-complete': isAllWatched }"
            >
              <div class="progress-info">
                <div class="progress-title">
                  <NIcon :component="isAllWatched ? Trophy24Regular : Sparkle24Regular" />
                  <span>观看进度</span>
                </div>
                <strong class="progress-value">{{ progressPercentage }}%</strong>
              </div>
              <NProgress
                type="line"
                :percentage="progressPercentage"
                :height="8"
                :show-indicator="false"
                :status="isAllWatched ? 'success' : 'default'"
                class="custom-progress-bar"
              />
            </div>
          </section>

          <!-- 工作台区域 -->
          <section class="result-workspace">
            <!-- 模式切换与工具栏 -->
            <div class="workspace-toolbar">
              <!-- 模式 Segmented 选择器 -->
              <div class="mode-segmented-control">
                <NRadioGroup
                  v-model:value="mode"
                  name="result-view-mode"
                  size="medium"
                  class="mode-radio-group"
                >
                  <NRadioButton value="list">
                    <NIcon :component="Grid24Regular" />
                    <span>全部视频</span>
                  </NRadioButton>
                  <NRadioButton value="draw">
                    <NIcon :component="ArrowSwap24Regular" />
                    <span>随机抽取</span>
                  </NRadioButton>
                  <NRadioButton value="sequence">
                    <NIcon :component="PlayCircle24Regular" />
                    <span>逐个观看</span>
                  </NRadioButton>
                  <NRadioButton value="flip">
                    <NIcon :component="Apps24Regular" />
                    <span>随机翻牌</span>
                  </NRadioButton>
                </NRadioGroup>
              </div>

              <!-- 各模式对应的快捷操作区 -->
              <div class="toolbar-actions">
                <!-- 列表模式：搜索、筛选、排序 -->
                <template v-if="mode === 'list'">
                  <NInput
                    v-model:value="searchQuery"
                    placeholder="搜索标题、UP 主、推荐人..."
                    clearable
                    size="small"
                    class="search-input"
                  >
                    <template #prefix>
                      <NIcon :component="Search24Regular" />
                    </template>
                  </NInput>

                  <NRadioGroup
                    v-model:value="watchFilter"
                    size="small"
                    class="filter-radio-group"
                  >
                    <NRadioButton value="all">全部</NRadioButton>
                    <NRadioButton value="unwatched">未看</NRadioButton>
                    <NRadioButton value="watched">已看</NRadioButton>
                  </NRadioGroup>

                  <NSelect
                    v-model:value="sortBy"
                    :options="sortOptions"
                    size="small"
                    class="sort-select"
                  />
                </template>

                <!-- 翻牌模式快捷动作 -->
                <template v-if="mode === 'flip'">
                  <div class="flip-status-pill">已揭晓 {{ revealedIds.length }} / {{ shuffledVideos.length }}</div>
                  <NButton
                    secondary
                    size="small"
                    @click="shuffleDeck"
                  >
                    <template #icon><NIcon :component="ArrowSwap24Regular" /></template>
                    重新洗牌
                  </NButton>
                  <NButton
                    secondary
                    size="small"
                    @click="revealAll"
                  >
                    <template #icon><NIcon :component="Eye24Regular" /></template>
                    全部翻开
                  </NButton>
                  <NButton
                    secondary
                    size="small"
                    @click="hideAll"
                  >
                    <template #icon><NIcon :component="EyeOff24Regular" /></template>
                    全部盖上
                  </NButton>
                </template>

                <!-- 重置观看进度（防误触二次确认） -->
                <NPopconfirm
                  v-if="watchedIds.length > 0 || drawnIds.length > 0"
                  @positive-click="resetProgress"
                >
                  <template #trigger>
                    <NButton
                      quaternary
                      size="small"
                      class="reset-btn"
                    >
                      <template #icon><NIcon :component="ArrowClockwise24Regular" /></template>
                      重置进度
                    </NButton>
                  </template>
                  确定要重置所有已观看与抽取记录吗？此操作无法撤销。
                </NPopconfirm>
              </div>
            </div>

            <!-- 模式内容切换区 -->
            <Transition
              name="mode-fade"
              mode="out-in"
            >
              <div
                :key="acceptedVideos.length === 0 ? 'empty' : mode"
                class="mode-stage-wrapper"
              >
                <!-- 空数据状态 -->
                <NResult
                  v-if="acceptedVideos.length === 0"
                  status="info"
                  title="暂无通过的视频"
                  :description="
                    isCollecting ? '征集进行中，主播审核通过后会显示在这里。' : '审核通过后，视频会显示在这里。'
                  "
                />

                <!-- 模式 1：全部视频列表 (List Mode) -->
                <template v-else-if="mode === 'list'">
                  <div
                    v-if="filteredVideos.length === 0"
                    class="empty-filter-state"
                  >
                    <NResult
                      status="info"
                      title="未找到匹配的视频"
                      description="可以尝试调整搜索关键词或筛选条件"
                    >
                      <template #footer>
                        <NButton
                          size="small"
                          secondary
                          @click="resetFilter"
                        >
                          清除筛选
                        </NButton>
                      </template>
                    </NResult>
                  </div>

                  <div
                    v-else
                    class="result-grid"
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

                <!-- 模式 2：随机抽取 (Draw Mode) -->
                <template v-else-if="mode === 'draw'">
                  <div class="draw-stage">
                    <div class="draw-stage-header">
                      <div class="draw-round-info">
                        <NIcon :component="ArrowSwap24Regular" />
                        <span>本轮已抽取</span>
                        <strong>{{ drawnIds.length }} / {{ acceptedVideos.length }}</strong>
                      </div>
                      <span class="draw-shortcut-tip">提示：可按空格键快捷抽取</span>
                    </div>

                    <div
                      class="draw-display-box"
                      :class="{ 'is-drawing': isDrawing }"
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
                        class="draw-trigger-placeholder"
                        @click="drawRandomVideo"
                      >
                        <div class="placeholder-icon">
                          <NIcon :component="Sparkle24Regular" />
                        </div>
                        <strong>点击开始随机抽取</strong>
                        <span>或按键盘空格键</span>
                      </button>
                    </div>

                    <div class="draw-actions-row">
                      <NButton
                        v-if="drawnVideo"
                        secondary
                        size="large"
                        @click="openVideo(drawnVideo)"
                      >
                        在哔哩哔哩打开
                        <template #icon><NIcon :component="ArrowRight24Regular" /></template>
                      </NButton>
                      <NButton
                        type="primary"
                        size="large"
                        :loading="isDrawing"
                        class="main-draw-btn"
                        @click="drawRandomVideo"
                      >
                        <template #icon><NIcon :component="Sparkle24Regular" /></template>
                        {{ drawnVideo ? '继续抽取下一个' : '开始抽取' }}
                      </NButton>
                    </div>

                    <!-- 历史抽取记录流 -->
                    <div
                      v-if="drawnHistory.length > 0"
                      class="drawn-history-stream"
                    >
                      <div class="history-title">
                        <NIcon :component="History24Regular" />
                        <span>抽取历史 ({{ drawnHistory.length }})</span>
                      </div>
                      <div class="history-scroll-track">
                        <div
                          v-for="(histItem, hIndex) in drawnHistory"
                          :key="`hist-${histItem.info.bvid}`"
                          class="history-item-pill"
                          :class="{ 'is-current': drawnVideo?.info.bvid === histItem.info.bvid }"
                          @click="drawnVideo = histItem"
                        >
                          <img
                            :src="histItem.video.cover.replace('http://', 'https://')"
                            :alt="histItem.video.title"
                            class="hist-thumb"
                          />
                          <div class="hist-info">
                            <span class="hist-name">{{ histItem.video.title }}</span>
                            <span class="hist-sender">{{
                              histItem.info.senders[0]?.sender || histItem.video.ownerName
                            }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>

                <!-- 模式 3：逐个观看 (Sequence Mode) -->
                <template v-else-if="mode === 'sequence'">
                  <div
                    v-if="sequenceVideo"
                    class="sequence-stage"
                  >
                    <div class="sequence-header">
                      <div class="sequence-nav-info">
                        <NIcon :component="PlayCircle24Regular" />
                        <span>当前视频</span>
                        <strong>{{ sequenceIndex + 1 }} / {{ acceptedVideos.length }}</strong>
                      </div>
                      <span class="sequence-tip">左右方向键快速切歌 / 空格键播放</span>
                    </div>

                    <!-- 主展示卡片 -->
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

                    <!-- 控制栏 -->
                    <div class="sequence-controls">
                      <NButton
                        secondary
                        :disabled="sequenceIndex === 0"
                        @click="prevSequenceVideo"
                      >
                        <template #icon><NIcon :component="ArrowLeft24Regular" /></template>
                        上一个
                      </NButton>
                      <NButton
                        secondary
                        @click="skipSequenceVideo"
                      >
                        跳过此视频
                      </NButton>
                      <NButton
                        type="primary"
                        @click="openSequenceVideo"
                      >
                        打开并在 B 站播放
                        <template #icon><NIcon :component="ArrowRight24Regular" /></template>
                      </NButton>
                    </div>

                    <!-- 底部序列胶卷 (Filmstrip Playlist) -->
                    <div class="sequence-filmstrip">
                      <div class="filmstrip-label">播放列表</div>
                      <div class="filmstrip-track">
                        <button
                          v-for="(item, idx) in acceptedVideos"
                          :key="`strip-${item.info.bvid}`"
                          type="button"
                          class="filmstrip-item"
                          :class="{
                            'is-active': idx === sequenceIndex,
                            'is-watched': watchedIds.includes(item.info.bvid),
                          }"
                          @click="setSequenceIndex(idx)"
                        >
                          <span class="strip-index">{{ idx + 1 }}</span>
                          <img
                            :src="item.video.cover.replace('http://', 'https://')"
                            :alt="item.video.title"
                            class="strip-thumb"
                          />
                          <div class="strip-details">
                            <span class="strip-title">{{ item.video.title }}</span>
                            <span class="strip-duration">{{ formatDuration(item.video.length) }}</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <NResult
                    v-else
                    status="success"
                    title="本轮征集视频已全部浏览完毕"
                    :description="`已累计观看 ${watchedVideos.length} 个视频，总观看时长 ${formatDuration(watchedDuration)}`"
                  >
                    <template #footer>
                      <NButton
                        type="primary"
                        @click="restartSequence"
                      >
                        <template #icon><NIcon :component="ArrowClockwise24Regular" /></template>
                        从头再看一轮
                      </NButton>
                    </template>
                  </NResult>
                </template>

                <!-- 模式 4：随机翻牌盲盒 (Flip Mode) -->
                <template v-else-if="mode === 'flip'">
                  <div class="result-grid is-flip-layout">
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
            </Transition>
          </section>
        </template>
      </NSpin>
    </main>
  </VideoCollectPageShell>
</template>

<style scoped>
.result-page {
  width: min(calc(100% - 32px), 1200px);
  max-width: var(--vtsuru-page-max-width, 1200px);
  min-width: 0;
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  padding: 36px 0 64px;
  box-sizing: border-box;
}

/* Header */
.result-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  padding-bottom: 24px;
}

.result-heading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.owner-link {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 0;
  color: var(--collect-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition: color 0.18s ease;
}

.owner-link:hover {
  color: var(--collect-accent);
}

.owner-suffix {
  opacity: 0.8;
}

.title-row {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.title-row h1 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.25;
}

.status-tag {
  font-weight: 600;
}

.table-description {
  max-width: 760px;
  margin: 4px 0 0;
  color: var(--collect-muted);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.header-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
}

/* Bento-style Summary Grid */
.result-summary-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(130px, 1fr)) minmax(240px, 1.6fr);
  gap: 14px;
  min-width: 0;
  margin-bottom: 28px;
}

.summary-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--collect-card);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
  border-radius: var(--vtsuru-page-radius, 10px);
  box-shadow: var(--vtsuru-page-shadow);
}

.stat-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  font-size: 20px;
  color: var(--collect-accent);
  background: color-mix(in srgb, var(--collect-accent) 12%, transparent);
  border-radius: 8px;
}

.stat-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-label {
  color: var(--collect-muted);
  font-size: 12px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--collect-fg);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-card {
  flex-direction: column;
  justify-content: center;
  gap: 10px;
  padding: 16px 20px;
}

.progress-card.is-complete {
  border-color: color-mix(in srgb, #10b981 60%, var(--collect-border));
}

.progress-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.progress-title {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--collect-muted);
  font-size: 13px;
  font-weight: 500;
}

.progress-title .n-icon {
  color: var(--collect-accent);
}

.progress-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--collect-fg);
}

.custom-progress-bar {
  width: 100%;
}

/* Workspace & Toolbar */
.result-workspace {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
}

.workspace-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--collect-border);
}

.mode-segmented-control {
  display: flex;
  min-width: 0;
}

.mode-radio-group :deep(.n-radio-button) {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.search-input {
  width: 220px;
}

.sort-select {
  width: 140px;
}

.flip-status-pill {
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--collect-accent);
  background: color-mix(in srgb, var(--collect-accent) 12%, transparent);
  border-radius: 999px;
}

.reset-btn {
  color: var(--collect-muted);
}

/* Grid Layout */
.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: var(--vtsuru-page-spacing, 16px);
  min-width: 0;
}

.result-grid.is-flip-layout {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
}

.empty-filter-state {
  padding: 48px 0;
}

/* Mode 2: Draw Stage */
.draw-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 580px);
  margin: 0 auto;
  gap: 18px;
}

.draw-stage-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: var(--collect-muted);
  font-size: 13px;
}

.draw-round-info {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.draw-round-info strong {
  color: var(--collect-fg);
}

.draw-shortcut-tip {
  font-size: 12px;
  opacity: 0.75;
}

.draw-display-box {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  contain: layout paint;
  transition:
    filter 0.2s ease,
    transform 0.2s ease;
}

.draw-display-box.is-drawing {
  filter: blur(2px) saturate(0.85);
  transform: scale(0.99);
}

.draw-trigger-placeholder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 360px;
  box-sizing: border-box;
  color: var(--collect-accent);
  background:
    radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--collect-accent) 15%, transparent), transparent 75%),
    var(--collect-card);
  border: 2px dashed color-mix(in srgb, var(--collect-accent) 40%, var(--collect-border));
  border-radius: var(--vtsuru-page-radius, 12px);
  cursor: pointer;
  transition: all 0.22s ease;
}

.draw-trigger-placeholder:hover {
  border-color: var(--collect-accent);
  transform: translateY(-2px);
  box-shadow: 0 12px 32px -8px color-mix(in srgb, var(--collect-accent) 25%, transparent);
}

.placeholder-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  font-size: 34px;
  color: var(--collect-accent);
  background: color-mix(in srgb, var(--collect-accent) 14%, transparent);
  border-radius: 50%;
}

.draw-trigger-placeholder strong {
  font-size: 18px;
}

.draw-trigger-placeholder span {
  font-size: 13px;
  color: var(--collect-muted);
}

.draw-actions-row {
  display: flex;
  gap: 12px;
  justify-content: center;
  width: 100%;
}

.main-draw-btn {
  min-width: 160px;
}

.drawn-history-stream {
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  background: var(--collect-card);
  border: 1px solid var(--collect-border);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.history-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--collect-muted);
}

.history-scroll-track {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.history-item-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  width: 200px;
  padding: 6px;
  background: color-mix(in srgb, var(--collect-border) 35%, transparent);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.history-item-pill:hover,
.history-item-pill.is-current {
  border-color: var(--collect-accent);
  background: color-mix(in srgb, var(--collect-accent) 12%, transparent);
}

.hist-thumb {
  width: 44px;
  height: 28px;
  object-fit: cover;
  border-radius: 4px;
}

.hist-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.hist-name {
  font-size: 11px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-sender {
  font-size: 10px;
  color: var(--collect-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Mode 3: Sequence Stage */
.sequence-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: min(100%, 680px);
  margin: 0 auto;
  gap: 18px;
}

.sequence-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  color: var(--collect-muted);
  font-size: 13px;
}

.sequence-nav-info {
  display: inline-flex;
  gap: 6px;
  align-items: center;
}

.sequence-nav-info strong {
  color: var(--collect-fg);
}

.sequence-tip {
  font-size: 12px;
  opacity: 0.75;
}

.sequence-controls {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  width: 100%;
}

.sequence-filmstrip {
  width: 100%;
  margin-top: 8px;
  padding: 12px;
  background: var(--collect-card);
  border: 1px solid var(--collect-border);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.filmstrip-label {
  margin-bottom: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--collect-muted);
}

.filmstrip-track {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.filmstrip-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  width: 180px;
  padding: 6px;
  color: var(--collect-fg);
  font: inherit;
  text-align: left;
  background: color-mix(in srgb, var(--collect-border) 25%, transparent);
  border: 1px solid var(--collect-border);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filmstrip-item:hover {
  border-color: var(--collect-accent);
}

.filmstrip-item.is-active {
  border-color: var(--collect-accent);
  background: color-mix(in srgb, var(--collect-accent) 15%, transparent);
}

.filmstrip-item.is-watched {
  opacity: 0.65;
}

.strip-index {
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--collect-muted);
}

.strip-thumb {
  width: 42px;
  height: 26px;
  object-fit: cover;
  border-radius: 3px;
}

.strip-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 2px;
}

.strip-title {
  font-size: 11px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.strip-duration {
  font-size: 10px;
  color: var(--collect-muted);
}

/* Transitions */
.mode-fade-enter-active,
.mode-fade-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.2, 0.8, 0.25, 1);
}

.mode-fade-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.mode-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* Responsive */
@media (max-width: 960px) {
  .result-summary-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .progress-card {
    grid-column: 1 / -1;
  }
}

@media (max-width: 640px) {
  .result-page {
    width: min(calc(100% - 24px), 1200px);
    padding-block: 24px 48px;
  }

  .result-header {
    flex-direction: column;
    gap: 16px;
  }

  .title-row h1 {
    font-size: 26px;
  }

  .result-summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .stat-videos {
    grid-column: 1 / 2;
  }

  .stat-duration {
    grid-column: 2 / 3;
  }

  .stat-watched {
    grid-column: 1 / 3;
  }

  .progress-card {
    grid-column: 1 / 3;
  }

  .workspace-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .mode-segmented-control {
    width: 100%;
  }

  .mode-radio-group {
    display: flex;
    width: 100%;
  }

  .mode-radio-group :deep(.n-radio-button) {
    flex: 1;
    justify-content: center;
    padding: 0 6px;
  }

  .toolbar-actions {
    width: 100%;
    justify-content: space-between;
  }

  .search-input {
    width: 100%;
  }

  .sequence-controls {
    flex-wrap: wrap;
    justify-content: stretch;
  }

  .sequence-controls :deep(.n-button) {
    flex: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mode-fade-enter-active,
  .mode-fade-leave-active,
  .draw-display-box,
  .draw-trigger-placeholder {
    transition: none !important;
  }
}
</style>
