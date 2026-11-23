<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import { Clapperboard, Clock, Film, MessageSquareQuote, User, Video } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { VideoStatus } from '@/api/generated/model'
import type {
  ReponseVideoCollectVideo,
  ResponseVideoCollectDetail,
  ResponseVideoCollectModel,
} from '@/api/generated/model'
import { getApiVideoCollectGet, getApiVideoCollectGetActive } from '@/api/generated/video-collect/video-collect'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'

import {
  createSampleVideoCollectItems,
  createSampleVideoCollectTable,
  DEFAULT_VIDEO_COLLECT_STATE,
  formatVideoDuration,
  normalizeBiliCoverUrl,
} from './types'
import type { VideoCollectAction, VideoCollectState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const {
  state,
  onAction,
  userId: resolvedUserId,
} = useObsBridge<VideoCollectState, VideoCollectAction>({
  componentId: 'video-collect',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_VIDEO_COLLECT_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 1000) })

const activeTables = ref<ResponseVideoCollectModel[]>([])
const detailData = ref<ResponseVideoCollectDetail | null>(null)
const isLoading = ref(false)
const hasFetched = ref(false)
let activeReqSeq = 0
let detailReqSeq = 0

async function fetchDetail(tableId: string) {
  if (!tableId) {
    detailData.value = null
    return
  }
  const seq = ++detailReqSeq
  try {
    const res = await getApiVideoCollectGet({ id: tableId })
    if (seq !== detailReqSeq) return
    detailData.value = res.code === 200 && res.data ? res.data : null
  } catch {
    if (seq !== detailReqSeq) return
    detailData.value = null
  }
}

async function fetchActiveTables() {
  const uid = resolvedUserId.value
  if (!uid) {
    activeTables.value = []
    detailData.value = null
    hasFetched.value = true
    return
  }
  const seq = ++activeReqSeq
  isLoading.value = true
  try {
    const res = await getApiVideoCollectGetActive({ id: String(uid) })
    if (seq !== activeReqSeq) return
    activeTables.value = res.code === 200 && Array.isArray(res.data) ? res.data : []
    const preferredId = state.value.selectedTableId || activeTables.value[0]?.id || ''
    if (preferredId) {
      await fetchDetail(preferredId)
    } else {
      detailData.value = null
    }
  } catch {
    if (seq !== activeReqSeq) return
    activeTables.value = []
    detailData.value = null
  } finally {
    if (seq === activeReqSeq) {
      isLoading.value = false
      hasFetched.value = true
    }
  }
}

watch(
  resolvedUserId,
  () => {
    void fetchActiveTables()
  },
  { immediate: true },
)

watch(
  () => state.value.selectedTableId,
  (nextId) => {
    if (state.value.useSampleData || state.value.mode === 'manual') return
    const targetId = nextId || activeTables.value[0]?.id || ''
    if (targetId && detailData.value?.table?.id !== targetId) {
      void fetchDetail(targetId)
    }
  },
)

// 每 2 分钟自动刷新公开征集列表与投稿
useIntervalFn(() => {
  if (!state.value.useSampleData && state.value.mode !== 'manual') {
    void fetchActiveTables()
  }
}, 2 * 60_000)

onMounted(() => {
  onAction((action) => {
    if (action.type === 'REFRESH') {
      void fetchActiveTables()
    }
  })
})

const sampleTable = createSampleVideoCollectTable()
const sampleVideos = createSampleVideoCollectItems()

const activeTable = computed<ResponseVideoCollectModel | null>(() => {
  if (state.value.useSampleData) return sampleTable
  if (
    detailData.value?.table &&
    (!state.value.selectedTableId || detailData.value.table.id === state.value.selectedTableId)
  ) {
    return detailData.value.table
  }
  if (state.value.selectedTableId) {
    return activeTables.value.find((t) => t.id === state.value.selectedTableId) ?? activeTables.value[0] ?? null
  }
  return activeTables.value[0] ?? null
})

const acceptedVideos = computed<ReponseVideoCollectVideo[]>(() => {
  if (state.value.useSampleData) return sampleVideos
  return (detailData.value?.videos ?? []).filter((item) => item.info.status === VideoStatus.Accepted)
})

const currentSubmission = computed(() => {
  if (state.value.mode === 'manual') {
    return {
      key: 'manual',
      title: state.value.manualTitle || '未命名投稿视频',
      cover: normalizeBiliCoverUrl(state.value.manualCover),
      senderName: state.value.manualSender || '匿名观众',
      upName: state.value.manualUpName || '',
      message: state.value.manualMessage || '',
      indexLabel: state.value.manualIndexLabel || '1 / 1',
      duration: state.value.manualDuration || '',
    }
  }

  const list = acceptedVideos.value
  if (!list.length) return null

  let resolvedIdx = Math.max(0, Math.min(list.length - 1, state.value.currentIndex || 0))
  if (state.value.currentBvid) {
    const matchedIdx = list.findIndex((item) => item.info.bvid === state.value.currentBvid)
    if (matchedIdx >= 0) resolvedIdx = matchedIdx
  }
  const target = list[resolvedIdx]
  if (!target) return null
  const primarySender = target.info.senders[0]
  return {
    key: target.info.bvid || target.video.id || String(resolvedIdx),
    title: target.video.title,
    cover: normalizeBiliCoverUrl(target.video.cover),
    senderName: primarySender?.sender || '匿名观众',
    upName: target.video.ownerName || '',
    message: primarySender?.description || '',
    indexLabel: `${resolvedIdx + 1} / ${list.length}`,
    duration: formatVideoDuration(target.video.length),
  }
})

const summaryProgress = computed(() => {
  const table = activeTable.value
  if (!table || table.maxVideoCount <= 0) return 0
  return Math.min(100, Math.max(0, (table.videoCount / table.maxVideoCount) * 100))
})

const summaryCountdown = computed(() => {
  const table = activeTable.value
  if (!table) return ''
  const nowMs = now.value.getTime()
  if (table.isFinish || (table.endAt > 0 && table.endAt <= nowMs)) {
    return '征集已结束'
  }
  const isUpcoming = table.startAt > nowMs
  const diff = Math.max(0, (isUpcoming ? table.startAt : table.endAt) - nowMs)
  const totalSec = Math.floor(diff / 1000)
  const days = Math.floor(totalSec / 86400)
  const hours = Math.floor((totalSec % 86400) / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  const clock = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const prefix = isUpcoming ? '距开放 ' : '距截止 '
  return days > 0 ? `${prefix}${days}天 ${clock}` : `${prefix}${clock}`
})
</script>

<template>
  <div
    class="vc-obs-root"
    :class="[
      `theme-${state.theme}`,
      {
        'is-inline': props.inlineMode,
        'no-shadow': props.noShadow,
      },
    ]"
    :style="{ '--widget-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <div class="vc-shell">
      <!-- 模式 A & C：茶话会鉴赏 / 手动投稿角标 -->
      <template v-if="state.mode === 'watch' || state.mode === 'manual'">
        <Transition
          name="card-swap"
          mode="out-in"
        >
          <div
            v-if="currentSubmission"
            :key="currentSubmission.key"
            class="watch-layout"
          >
            <div class="video-thumb">
              <img
                v-if="currentSubmission.cover"
                :src="currentSubmission.cover"
                :alt="currentSubmission.title"
                referrerpolicy="no-referrer"
                class="thumb-img"
              />
              <div
                v-else
                class="thumb-fallback"
              >
                <Film class="fallback-icon" />
              </div>
              <span
                v-if="currentSubmission.duration"
                class="duration-pill"
              >
                {{ currentSubmission.duration }}
              </span>
            </div>

            <div class="video-meta">
              <div class="meta-top-row">
                <span class="status-badge">
                  <Clapperboard class="badge-icon" />
                  {{ state.badgeLabel || '正在鉴赏' }}
                </span>
                <span
                  v-if="state.useSampleData && state.mode === 'watch'"
                  class="sample-pill"
                >
                  示例
                </span>
                <span class="index-counter">{{ currentSubmission.indexLabel }}</span>
              </div>

              <div class="video-title">{{ currentSubmission.title }}</div>

              <div class="sender-row">
                <span class="sender-chip">
                  <User class="mini-icon" />
                  投稿: {{ currentSubmission.senderName }}
                </span>
                <span
                  v-if="state.showUpName && currentSubmission.upName"
                  class="up-chip"
                >
                  UP: {{ currentSubmission.upName }}
                </span>
              </div>

              <div
                v-if="state.showMessage && currentSubmission.message"
                class="message-bar"
              >
                <MessageSquareQuote class="quote-icon" />
                <span class="message-text">{{ currentSubmission.message }}</span>
              </div>
            </div>
          </div>

          <div
            v-else-if="hasFetched && !isLoading"
            key="empty-watch"
            class="empty-state"
          >
            <Video class="empty-icon" />
            <div class="empty-copy">
              <span class="empty-title">暂无已通过审核的视频投稿</span>
              <span class="empty-hint">可在控制台切换「手动编辑」或开启示例数据预览</span>
            </div>
          </div>
        </Transition>
      </template>

      <!-- 模式 B：征集进度摘要模式 -->
      <template v-else>
        <div
          v-if="activeTable"
          class="summary-layout"
        >
          <div class="summary-head">
            <div class="summary-title-wrap">
              <span class="status-badge">
                <Clapperboard class="badge-icon" />
                视频征集
              </span>
              <span
                v-if="state.useSampleData"
                class="sample-pill"
              >
                示例
              </span>
              <span class="summary-name">{{ activeTable.name }}</span>
            </div>
            <span class="summary-count">
              <strong>{{ activeTable.videoCount }}</strong>
              <span class="count-sep">/ {{ activeTable.maxVideoCount }}</span>
            </span>
          </div>

          <div class="summary-progress-track">
            <div
              class="summary-progress-fill"
              :style="{ transform: `scaleX(${summaryProgress / 100})` }"
            />
          </div>

          <div class="summary-footer">
            <span class="summary-desc">
              {{ activeTable.description || '欢迎前往主页投递你的推荐视频！' }}
            </span>
            <span class="summary-countdown">
              <Clock class="mini-icon" />
              {{ summaryCountdown }}
            </span>
          </div>
        </div>

        <div
          v-else-if="hasFetched && !isLoading"
          class="empty-state"
        >
          <Video class="empty-icon" />
          <div class="empty-copy">
            <span class="empty-title">当前没有进行中的视频征集</span>
            <span class="empty-hint">新建征集表或开启「示例数据预览」即可查看效果</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.vc-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
  color: #f8fafc;
}

.vc-shell {
  width: 100%;
  max-width: 460px;
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease;
}

/* 4 套视觉主题 */
.theme-card .vc-shell {
  background: rgba(15, 18, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.13);
  backdrop-filter: blur(12px);
  border-radius: 13px;
  padding: 10px 12px;
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.44);
}

.theme-minimal .vc-shell {
  background: rgba(12, 14, 20, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 10px;
  padding: 9px 11px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

.theme-neon .vc-shell {
  background: rgba(9, 10, 18, 0.95);
  border: 1px solid var(--widget-accent);
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow:
    0 0 16px color-mix(in srgb, var(--widget-accent) 45%, transparent),
    inset 0 0 10px color-mix(in srgb, var(--widget-accent) 16%, transparent);
}

.theme-glass .vc-shell {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 15px;
  padding: 10px 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.28);
}

.no-shadow .vc-shell {
  box-shadow: none !important;
}

/* 切换过渡 */
.card-swap-enter-active,
.card-swap-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.card-swap-enter-from {
  opacity: 0;
  transform: translateX(6px);
}

.card-swap-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* 鉴赏模式布局 */
.watch-layout {
  display: grid;
  grid-template-columns: 124px minmax(0, 1fr);
  gap: 11px;
  align-items: center;
}

.video-thumb {
  position: relative;
  width: 124px;
  aspect-ratio: 16 / 10;
  border-radius: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.thumb-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.thumb-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, color-mix(in srgb, var(--widget-accent) 30%, #1e293b), rgba(15, 23, 42, 0.92));
  color: var(--widget-accent);
}

.fallback-icon {
  width: 26px;
  height: 26px;
  opacity: 0.9;
}

.duration-pill {
  position: absolute;
  right: 5px;
  bottom: 5px;
  font-size: 9px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(0, 0, 0, 0.76);
  color: #ffffff;
  text-shadow: none;
}

.video-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.meta-top-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--widget-accent) 24%, transparent);
  color: color-mix(in srgb, var(--widget-accent) 88%, #ffffff);
  flex-shrink: 0;
  text-shadow: none;
}

.badge-icon {
  width: 11px;
  height: 11px;
}

.sample-pill {
  font-size: 9px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  color: #e2e8f0;
  flex-shrink: 0;
}

.index-counter {
  margin-left: auto;
  font-size: 11px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--widget-accent);
  flex-shrink: 0;
}

.video-title {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.sender-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 11px;
  color: rgba(226, 232, 240, 0.85);
}

.sender-chip,
.up-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.up-chip {
  color: rgba(148, 163, 184, 0.9);
}

.mini-icon {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  color: var(--widget-accent);
}

.message-bar {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.07);
  border-left: 2px solid var(--widget-accent);
  min-width: 0;
}

.quote-icon {
  width: 11px;
  height: 11px;
  color: var(--widget-accent);
  flex-shrink: 0;
}

.message-text {
  font-size: 11px;
  color: rgba(241, 245, 249, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 摘要模式布局 */
.summary-layout {
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 4px 2px;
}

.summary-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-title-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.summary-name {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.summary-count {
  font-size: 15px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--widget-accent);
  flex-shrink: 0;
}

.count-sep {
  font-size: 11px;
  font-weight: 600;
  color: rgba(203, 213, 225, 0.72);
  margin-left: 2px;
}

.summary-progress-track {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  overflow: hidden;
}

.summary-progress-fill {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  background: var(--widget-accent);
  transform-origin: left;
  transition: transform 200ms ease;
}

.summary-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 11px;
}

.summary-desc {
  color: rgba(203, 213, 225, 0.8);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.summary-countdown {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #f8fafc;
  flex-shrink: 0;
}

/* 空态 */
.empty-state {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 8px;
}

.empty-icon {
  width: 22px;
  height: 22px;
  color: var(--widget-accent);
  flex-shrink: 0;
}

.empty-copy {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.empty-title {
  font-size: 12px;
  font-weight: 600;
  color: #ffffff;
}

.empty-hint {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.88);
}
</style>
