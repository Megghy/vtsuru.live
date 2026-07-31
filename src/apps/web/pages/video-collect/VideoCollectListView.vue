<script setup lang="ts">
import {
  ArrowClockwise24Regular,
  ArrowRight24Regular,
  ArrowSwap24Regular,
  CheckmarkCircle24Regular,
  Clock24Regular,
  Person24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { NButton, NIcon, NProgress, NRadioButton, NRadioGroup, NResult, NSpin, NTag, useMessage } from 'naive-ui'
import { computed, ref, watch } from 'vue'
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

const route = useRoute()
const router = useRouter()
const message = useMessage()

const videoDetail = ref<VideoCollectDetail | null>()
const isLoading = ref(false)
const mode = ref<ViewMode>('list')
const watchedIds = ref<string[]>([])
const revealedIds = ref<string[]>([])
const sequenceIndex = ref(0)
const shuffledVideos = ref<ResultVideo[]>([])
const drawnIds = ref<string[]>([])
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
const sequenceVideo = computed(() => acceptedVideos.value[sequenceIndex.value])
const drawDisplayVideo = computed(() => drawnVideo.value ?? drawPreview.value)
const isCollecting = computed(() => Boolean(table.value && !table.value.isFinish && table.value.endAt > Date.now()))

await loadData()
watch(() => route.params.id, loadData)
watch(
  () => acceptedVideos.value.map((item) => item.info.bvid).join(','),
  () => shuffleDeck(),
  { immediate: true },
)
watch(mode, () => {
  drawRunId++
  isDrawing.value = false
  drawPreview.value = undefined
  drawnVideo.value = undefined
  revealedIds.value = []
  sequenceIndex.value = 0
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
  try {
    const response = await QueryGetAPI<VideoCollectDetail>(`${VIDEO_COLLECT_API_URL}get`, { id: currentId() })
    videoDetail.value = response.code === 200 ? response.data : null
    if (response.code !== 200 && response.code !== 404) throw new Error(response.message)
    loadProgress()
  } catch (error) {
    console.error('获取视频征集结果失败', error)
    videoDetail.value = null
    message.error(error instanceof Error ? error.message : '结果加载失败')
  } finally {
    isLoading.value = false
  }
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

function reveal(item: ResultVideo) {
  if (revealedIds.value.includes(item.info.bvid)) {
    openVideo(item)
    return
  }
  revealedIds.value = [...revealedIds.value, item.info.bvid]
}

function handleCard(item: ResultVideo) {
  if (mode.value === 'list') openVideo(item)
  else reveal(item)
}

function randomVideo(videos: ResultVideo[]) {
  return videos[Math.floor(Math.random() * videos.length)]
}

async function drawRandomVideo() {
  const runId = ++drawRunId
  let pool = acceptedVideos.value.filter((item) => !drawnIds.value.includes(item.info.bvid))
  if (pool.length === 0) {
    drawnIds.value = []
    pool = acceptedVideos.value
  }
  if (pool.length === 0) return

  isDrawing.value = true
  drawnVideo.value = undefined
  for (let index = 0; index < 12; index++) {
    if (runId !== drawRunId) return
    drawPreview.value = randomVideo(acceptedVideos.value)
    await new Promise((resolve) => setTimeout(resolve, 55 + index * 5))
  }
  if (runId !== drawRunId) return

  const selected = randomVideo(pool)
  drawnVideo.value = selected
  drawPreview.value = undefined
  drawnIds.value = [...drawnIds.value, selected.info.bvid]
  isDrawing.value = false
}

function openSequenceVideo() {
  if (!sequenceVideo.value) return
  openVideo(sequenceVideo.value)
  sequenceIndex.value++
}

function skipSequenceVideo() {
  if (sequenceIndex.value < acceptedVideos.value.length) sequenceIndex.value++
}

function restartSequence() {
  sequenceIndex.value = 0
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

function resetProgress() {
  watchedIds.value = []
  revealedIds.value = []
  sequenceIndex.value = 0
  drawnIds.value = []
  drawnVideo.value = undefined
  drawPreview.value = undefined
  saveProgress()
}
</script>

<template>
  <VideoCollectPageShell :table="table">
    <main class="result-page">
      <NSpin :show="isLoading">
        <NResult
          v-if="videoDetail === null && !isLoading"
          status="404"
          title="视频征集不存在"
          description="链接可能有误，或该征集已被删除。"
        />

        <template v-else-if="videoDetail && table">
          <header class="result-header">
            <div class="result-heading">
              <button
                type="button"
                class="owner-link"
                @click="router.push({ name: 'user-index', params: { id: table.owner.name } })"
              >
                <NIcon :component="Person24Regular" />
                {{ table.owner.name }} 的视频征集
              </button>
              <div class="title-row">
                <h1>{{ table.name }}</h1>
                <NTag
                  size="small"
                  :type="isCollecting ? 'success' : 'default'"
                  :bordered="false"
                >
                  {{ isCollecting ? '征集中' : '已结束' }}
                </NTag>
              </div>
              <p>{{ table.description || '未填写征集说明' }}</p>
            </div>
            <NButton
              v-if="isCollecting"
              secondary
              @click="router.push({ name: 'video-collect', params: { id: table.shortId } })"
            >
              推荐视频
              <template #icon><NIcon :component="ArrowRight24Regular" /></template>
            </NButton>
          </header>

          <section
            class="result-summary"
            aria-label="观看进度"
          >
            <div class="summary-stat">
              <NIcon :component="Video24Regular" />
              <span>通过视频</span>
              <strong>{{ acceptedVideos.length }}</strong>
            </div>
            <div class="summary-stat">
              <NIcon :component="Clock24Regular" />
              <span>总时长</span>
              <strong>{{ formatDuration(totalDuration) }}</strong>
            </div>
            <div class="summary-stat">
              <NIcon :component="CheckmarkCircle24Regular" />
              <span>已观看</span>
              <strong>{{ watchedVideos.length }} / {{ acceptedVideos.length }}</strong>
            </div>
            <div class="progress-block">
              <div>
                <span>观看进度</span>
                <strong>{{ progressPercentage }}%</strong>
              </div>
              <NProgress
                type="line"
                :percentage="progressPercentage"
                :height="7"
                :show-indicator="false"
                :status="progressPercentage === 100 ? 'success' : 'default'"
              />
            </div>
          </section>

          <section class="result-workspace">
            <div class="mode-toolbar">
              <NRadioGroup
                v-model:value="mode"
                name="result-view-mode"
                class="mode-selector"
              >
                <NRadioButton value="list">全部视频</NRadioButton>
                <NRadioButton value="draw">随机抽取</NRadioButton>
                <NRadioButton value="sequence">逐个观看</NRadioButton>
                <NRadioButton value="flip">随机翻牌</NRadioButton>
              </NRadioGroup>
              <div class="mode-actions">
                <NButton
                  v-if="mode === 'flip'"
                  secondary
                  @click="shuffleDeck"
                >
                  <template #icon><NIcon :component="ArrowSwap24Regular" /></template>
                  重新洗牌
                </NButton>
                <NButton
                  v-if="watchedIds.length > 0"
                  quaternary
                  @click="resetProgress"
                >
                  <template #icon><NIcon :component="ArrowClockwise24Regular" /></template>
                  重置进度
                </NButton>
              </div>
            </div>

            <Transition
              name="mode-switch"
              mode="out-in"
            >
              <div
                :key="acceptedVideos.length === 0 ? 'empty' : mode"
                class="mode-content"
              >
                <NResult
                  v-if="acceptedVideos.length === 0"
                  status="info"
                  title="暂无通过的视频"
                  description="审核通过后，视频会显示在这里。"
                />

                <div
                  v-else-if="mode === 'draw'"
                  class="draw-stage"
                >
                  <div class="draw-counter">
                    <span>本轮已抽取</span>
                    <strong>{{ drawnIds.length }} / {{ acceptedVideos.length }}</strong>
                  </div>
                  <div
                    class="draw-display"
                    :class="{ 'is-drawing': isDrawing }"
                  >
                    <VideoCollectResultCard
                      v-if="drawDisplayVideo"
                      :key="`draw-${drawDisplayVideo.info.bvid}`"
                      :item="drawDisplayVideo"
                      :index="acceptedVideos.indexOf(drawDisplayVideo)"
                      presentation="plain"
                      :revealed="true"
                      :watched="watchedIds.includes(drawDisplayVideo.info.bvid)"
                      @select="drawnVideo && openVideo(drawnVideo)"
                    />
                    <button
                      v-else
                      type="button"
                      class="draw-placeholder"
                      @click="drawRandomVideo"
                    >
                      <NIcon :component="ArrowSwap24Regular" />
                      <strong>随机抽取</strong>
                    </button>
                  </div>
                  <div class="draw-actions">
                    <NButton
                      v-if="drawnVideo"
                      secondary
                      @click="openVideo(drawnVideo)"
                    >
                      打开视频
                    </NButton>
                    <NButton
                      type="primary"
                      :loading="isDrawing"
                      @click="drawRandomVideo"
                    >
                      <template #icon><NIcon :component="ArrowSwap24Regular" /></template>
                      {{ drawnVideo ? '继续抽取' : '开始抽取' }}
                    </NButton>
                  </div>
                </div>

                <template v-else-if="mode === 'sequence'">
                  <div
                    v-if="sequenceVideo"
                    class="sequence-stage"
                  >
                    <div class="sequence-counter">
                      <span>当前视频</span>
                      <strong>{{ sequenceIndex + 1 }} / {{ acceptedVideos.length }}</strong>
                    </div>
                    <VideoCollectResultCard
                      :key="`sequence-${sequenceVideo.info.bvid}`"
                      :item="sequenceVideo"
                      :index="sequenceIndex"
                      presentation="plain"
                      :revealed="true"
                      :watched="watchedIds.includes(sequenceVideo.info.bvid)"
                      @select="openSequenceVideo"
                    />
                    <div class="sequence-actions">
                      <NButton @click="skipSequenceVideo">跳过</NButton>
                      <NButton
                        type="primary"
                        @click="openSequenceVideo"
                      >
                        打开并显示下一个
                        <template #icon><NIcon :component="ArrowRight24Regular" /></template>
                      </NButton>
                    </div>
                  </div>
                  <NResult
                    v-else
                    status="success"
                    title="本轮已完成"
                    :description="`已观看 ${watchedVideos.length} 个视频，共 ${formatDuration(watchedDuration)}`"
                  >
                    <template #footer>
                      <NButton
                        type="primary"
                        @click="restartSequence"
                      >
                        再看一轮
                      </NButton>
                    </template>
                  </NResult>
                </template>

                <TransitionGroup
                  v-else
                  appear
                  tag="div"
                  name="result-card"
                  class="result-grid"
                  :class="{ 'is-flip-layout': mode === 'flip' }"
                >
                  <VideoCollectResultCard
                    v-for="(item, index) in mode === 'flip' ? shuffledVideos : acceptedVideos"
                    :key="`${mode}-${item.info.bvid}`"
                    :style="{ '--card-index': Math.min(index, 10) }"
                    :item="item"
                    :index="index"
                    :presentation="mode === 'flip' ? 'flip' : 'plain'"
                    :revealed="mode === 'list' || revealedIds.includes(item.info.bvid)"
                    :watched="watchedIds.includes(item.info.bvid)"
                    @select="handleCard(item)"
                  />
                </TransitionGroup>
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
  width: min(calc(100% - 32px), 1180px);
  max-width: var(--vtsuru-page-max-width, 1180px);
  min-width: 0;
  min-height: 100vh;
  min-height: 100svh;
  margin: 0 auto;
  padding: 36px 0 56px;
  box-sizing: border-box;
}

.result-header {
  display: flex;
  gap: 24px;
  align-items: flex-start;
  justify-content: space-between;
  min-width: 0;
  padding-bottom: 24px;
  animation: section-enter 0.48s cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.result-heading {
  min-width: 0;
}

.owner-link {
  display: inline-flex;
  gap: 7px;
  align-items: center;
  padding: 0;
  color: var(--collect-muted);
  font: inherit;
  font-size: 13px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.owner-link:hover {
  color: var(--collect-accent);
}

.title-row {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
  margin-top: 11px;
}

.title-row h1 {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 30px;
  line-height: 1.25;
  letter-spacing: 0;
}

.result-heading p {
  max-width: 720px;
  margin: 12px 0 0;
  color: var(--collect-muted);
  line-height: 1.6;
  white-space: pre-wrap;
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 0.55fr)) minmax(220px, 1.35fr);
  min-width: 0;
  border-block: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
  animation: section-enter 0.48s 80ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.summary-stat {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  gap: 3px 9px;
  min-width: 0;
  padding: 16px;
}

.summary-stat + .summary-stat,
.progress-block {
  border-left: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
}

.summary-stat .n-icon {
  grid-row: 1 / 3;
  align-self: center;
  color: var(--collect-accent);
}

.summary-stat span,
.progress-block span {
  color: var(--collect-muted);
  font-size: 12px;
}

.summary-stat strong {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-block {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 9px;
  min-width: 0;
  padding: 16px 18px;
}

.progress-block > div {
  display: flex;
  justify-content: space-between;
}

.result-workspace {
  display: flex;
  flex-direction: column;
  gap: 24px;
  min-width: 0;
  padding-top: 24px;
  animation: section-enter 0.48s 140ms cubic-bezier(0.2, 0.75, 0.25, 1) both;
}

.mode-toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.mode-selector {
  display: flex;
  min-width: 0;
}

.mode-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
}

.result-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  gap: var(--vtsuru-page-spacing, 16px);
  min-width: 0;
}

.result-grid.is-flip-layout {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
}

.mode-content {
  min-width: 0;
}

.mode-switch-enter-active,
.mode-switch-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.25s cubic-bezier(0.2, 0.75, 0.25, 1);
}

.mode-switch-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.mode-switch-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}

.result-card-enter-active {
  transition:
    opacity 0.3s ease calc(var(--card-index, 0) * 35ms),
    transform 0.38s cubic-bezier(0.2, 0.75, 0.25, 1) calc(var(--card-index, 0) * 35ms);
}

.result-card-enter-from {
  opacity: 0;
  transform: translateY(14px) scale(0.985);
}

.result-card-move {
  transition: transform 0.38s cubic-bezier(0.2, 0.75, 0.25, 1);
}

.draw-stage {
  width: min(100%, 560px);
  min-width: 0;
  margin: 0 auto;
}

.draw-counter,
.draw-actions {
  display: flex;
  align-items: center;
}

.draw-counter {
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--collect-muted);
  font-size: 12px;
}

.draw-counter strong {
  color: var(--collect-fg);
}

.draw-display {
  min-width: 0;
  transition:
    filter 0.16s ease,
    transform 0.16s ease;
}

.draw-display.is-drawing {
  filter: blur(2px) saturate(0.72);
  transform: scale(0.985);
}

.draw-placeholder {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 320px;
  color: var(--collect-accent);
  font: inherit;
  background: linear-gradient(var(--vtsuru-page-primary-soft), var(--vtsuru-page-primary-soft)), var(--collect-card);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    transform 0.18s ease;
}

.draw-placeholder:hover {
  border-color: var(--collect-accent);
  transform: translateY(-2px);
}

.draw-placeholder .n-icon {
  font-size: 38px;
}

.draw-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.sequence-stage {
  width: min(100%, 620px);
  min-width: 0;
  margin: 0 auto;
}

.sequence-counter,
.sequence-actions {
  display: flex;
  align-items: center;
}

.sequence-counter {
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--collect-muted);
  font-size: 12px;
}

.sequence-counter strong {
  color: var(--collect-fg);
}

.sequence-actions {
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

@keyframes section-enter {
  from {
    opacity: 0;
    transform: translateY(12px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 840px) {
  .result-summary {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .progress-block {
    grid-column: 1 / -1;
    border-top: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
    border-left: 0;
  }

  .mode-toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .mode-actions {
    justify-content: flex-end;
  }
}

@media (max-width: 560px) {
  .result-page {
    width: min(calc(100% - 24px), 1180px);
    padding-block: 24px 36px;
  }

  .result-header {
    flex-direction: column;
    gap: 16px;
  }

  .title-row {
    align-items: flex-start;
  }

  .title-row h1 {
    font-size: 25px;
  }

  .result-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .summary-stat + .summary-stat,
  .progress-block {
    border-top: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--collect-border);
    border-left: 0;
  }

  .mode-selector {
    display: flex;
    flex-wrap: wrap;
    height: auto;
  }

  .mode-selector :deep(.n-radio-button) {
    flex: 0 0 50%;
    min-width: 0;
  }

  .mode-selector :deep(.n-radio-group__splitor) {
    display: none;
  }

  .mode-actions,
  .draw-actions,
  .sequence-actions {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .result-header,
  .result-summary,
  .result-workspace {
    animation: none;
  }

  .mode-switch-enter-active,
  .mode-switch-leave-active,
  .result-card-enter-active,
  .result-card-move,
  .draw-display,
  .draw-placeholder {
    transition: none;
  }
}
</style>
