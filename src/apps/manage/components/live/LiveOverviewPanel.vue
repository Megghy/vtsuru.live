<script setup lang="ts">
import {
  Box24Regular,
  Chat24Regular,
  Clock24Regular,
  DataTrending24Regular,
  HandRight24Regular,
  Money24Regular,
  People24Regular,
  Person24Regular,
  Ribbon24Regular,
  Trophy24Filled,
  VehicleShip24Filled,
} from '@vicons/fluent'
import {
  NAvatar,
  NButton,
  NCard,
  NDivider,
  NEmpty,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NNumberAnimation,
  NProgress,
  NSkeleton,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { DanmakuModel, ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LIVE_API_URL } from '@/shared/config'

const props = defineProps<{
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}>()

const message = useMessage()
const rankingList = ref<ResponseLiveRankingEntryModel[]>([])
const isRankingLoading = ref(false)

// 基础时长
const durationMinutes = computed(() => {
  const start = Number(props.live.startAt) || 0
  const end = props.live.isFinish ? Number(props.live.stopAt) || start : Date.now()
  return Math.max(0, Math.floor((end - start) / 60000))
})

const durationText = computed(() => {
  const mins = durationMinutes.value
  if (mins < 1) return '不足 1 分钟'
  const hours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hours > 0) {
    return remMins > 0 ? `${hours} 小时 ${remMins} 分` : `${hours} 小时`
  }
  return `${mins} 分钟`
})

// 观众画像去重
const chatterStats = computed(() => {
  const chatters = new Set<string>()
  const payers = new Set<string>()

  for (const d of props.danmakus) {
    const uid = d.ouId || (d.uId ? String(d.uId) : '')
    if (!uid) continue
    if (d.type === EventDataTypes.Message) {
      chatters.add(uid)
    }
    if ((d.type === EventDataTypes.Gift || d.type === EventDataTypes.SC || d.type === EventDataTypes.Guard) && (d.price || 0) > 0) {
      payers.add(uid)
    }
  }

  const uniqueChatters = chatters.size || (props.live.danmakusCount > 0 ? 1 : 0)
  const uniquePayers = payers.size
  const avgDanmakuPerUser = uniqueChatters > 0 ? (props.live.danmakusCount / uniqueChatters).toFixed(1) : '0'

  return {
    uniqueChatters,
    uniquePayers,
    avgDanmakuPerUser,
  }
})

// 收入构成分析
const incomeBreakdown = computed(() => {
  let sc = 0
  let gift = 0
  let guard = 0

  for (const d of props.danmakus) {
    const price = d.price || 0
    if (d.type === EventDataTypes.SC) sc += price
    else if (d.type === EventDataTypes.Gift) gift += price
    else if (d.type === EventDataTypes.Guard) guard += price
  }

  const total = props.live.totalIncome || sc + gift + guard || 0
  const scPercent = total > 0 ? Math.round((sc / total) * 100) : 0
  const giftPercent = total > 0 ? Math.round((gift / total) * 100) : 0
  const guardPercent = total > 0 ? Math.round((guard / total) * 100) : 0

  return {
    total,
    sc: sc.toFixed(1),
    gift: gift.toFixed(1),
    guard: guard.toFixed(1),
    scPercent,
    giftPercent,
    guardPercent,
  }
})

// 弹幕时段密度走势分桶 (Timeline Activity Waves)
interface TimeBucket {
  label: string
  timeRange: string
  danmakuCount: number
  income: number
  danmakuHeightPercent: number
}

const activityBuckets = computed<TimeBucket[]>(() => {
  const start = Number(props.live.startAt) || 0
  if (!start || props.danmakus.length === 0) return []

  const end = props.live.isFinish ? Number(props.live.stopAt) || start + 3600000 : Date.now()
  const span = Math.max(60000, end - start)

  // 根据总时长动态切分 12 ~ 24 个时间桶
  const bucketCount = Math.min(24, Math.max(12, Math.ceil(span / (10 * 60000))))
  const bucketDuration = span / bucketCount

  const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const bStart = start + i * bucketDuration
    const bEnd = bStart + bucketDuration
    const sDate = new Date(bStart)
    const eDate = new Date(bEnd)
    const formatTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    return {
      label: formatTime(sDate),
      timeRange: `${formatTime(sDate)} ~ ${formatTime(eDate)}`,
      danmakuCount: 0,
      income: 0,
      danmakuHeightPercent: 0,
    }
  })

  for (const d of props.danmakus) {
    const t = Number(d.time) || 0
    if (t < start || t > end) continue
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((t - start) / bucketDuration)))
    if (buckets[idx]) {
      if (d.type === EventDataTypes.Message) {
        buckets[idx].danmakuCount++
      }
      if ((d.price || 0) > 0) {
        buckets[idx].income += d.price || 0
      }
    }
  }

  const maxDanmaku = Math.max(1, ...buckets.map((b) => b.danmakuCount))
  for (const b of buckets) {
    b.danmakuHeightPercent = Math.max(6, Math.round((b.danmakuCount / maxDanmaku) * 100))
  }

  return buckets
})

// 拉取打赏榜
async function fetchRanking() {
  if (!props.live.liveId) return
  isRankingLoading.value = true
  try {
    const res = await QueryGetAPI<ResponseLiveRankingEntryModel[]>(`${LIVE_API_URL}ranking`, {
      liveId: props.live.liveId,
      limit: 10,
    })
    if (res.code === 200 && res.data) {
      rankingList.value = res.data
    }
  } catch (err) {
    console.error('Failed to fetch live ranking:', err)
  } finally {
    isRankingLoading.value = false
  }
}

function getRankBadgeStyle(index: number) {
  if (index === 0) return { background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#fff' }
  if (index === 1) return { background: 'linear-gradient(135deg, #94a3b8, #64748b)', color: '#fff' }
  if (index === 2) return { background: 'linear-gradient(135deg, #b45309, #78350f)', color: '#fff' }
  return { background: 'var(--vtsuru-bg-muted)', color: 'var(--vtsuru-fg-muted)' }
}

onMounted(fetchRanking)
watch(() => props.live.liveId, fetchRanking)
</script>

<template>
  <div class="live-overview-panel">
    <!-- 顶部核心指标 4 宫格 -->
    <NGrid
      :cols="4"
      :x-gap="12"
      :y-gap="12"
      responsive="screen"
      class="metrics-grid"
    >
      <NGridItem :span="1">
        <NCard
          size="small"
          class="metric-card"
          :bordered="true"
        >
          <div class="metric-inner">
            <div class="metric-header">
              <span class="metric-title">直播历时</span>
              <NIcon
                :component="Clock24Regular"
                class="metric-icon"
              />
            </div>
            <div class="metric-main">
              <span class="metric-number">{{ durationText }}</span>
            </div>
            <div class="metric-footer">
              <span class="metric-sub">
                <NTime :time="live.startAt" format="HH:mm" />
                ~
                <template v-if="live.isFinish">
                  <NTime :time="live.stopAt ?? 0" format="HH:mm" />
                </template>
                <template v-else>
                  (直播中)
                </template>
              </span>
            </div>
          </div>
        </NCard>
      </NGridItem>

      <NGridItem :span="1">
        <NCard
          size="small"
          class="metric-card"
          :bordered="true"
        >
          <div class="metric-inner">
            <div class="metric-header">
              <span class="metric-title">弹幕总数 / 发言人数</span>
              <NIcon
                :component="Chat24Regular"
                class="metric-icon"
              />
            </div>
            <div class="metric-main">
              <span class="metric-number">{{ live.danmakusCount.toLocaleString() }}</span>
              <span class="metric-unit">条</span>
            </div>
            <div class="metric-footer">
              <span class="metric-sub">
                {{ chatterStats.uniqueChatters }} 位独立观众 · 人均 {{ chatterStats.avgDanmakuPerUser }} 条
              </span>
            </div>
          </div>
        </NCard>
      </NGridItem>

      <NGridItem :span="1">
        <NCard
          size="small"
          class="metric-card"
          :bordered="true"
        >
          <div class="metric-inner">
            <div class="metric-header">
              <span class="metric-title">总打赏收益</span>
              <NIcon
                :component="Money24Regular"
                class="metric-icon income-icon"
              />
            </div>
            <div class="metric-main">
              <span class="metric-unit currency">¥</span>
              <span class="metric-number income-number">{{ live.totalIncome.toLocaleString() }}</span>
            </div>
            <div class="metric-footer">
              <span class="metric-sub">
                {{ chatterStats.uniquePayers }} 位付费观众打赏
              </span>
            </div>
          </div>
        </NCard>
      </NGridItem>

      <NGridItem :span="1">
        <NCard
          size="small"
          class="metric-card"
          :bordered="true"
        >
          <div class="metric-inner">
            <div class="metric-header">
              <span class="metric-title">总互动人次</span>
              <NIcon
                :component="HandRight24Regular"
                class="metric-icon"
              />
            </div>
            <div class="metric-main">
              <span class="metric-number">{{ live.interactionCount.toLocaleString() }}</span>
              <span class="metric-unit">次</span>
            </div>
            <div class="metric-footer">
              <span class="metric-sub">包含进场、点赞与关注</span>
            </div>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 中间：时段密度波形走势 & 收入构成分析 -->
    <NGrid
      :cols="12"
      :x-gap="12"
      :y-gap="12"
      responsive="screen"
    >
      <!-- 左侧：弹幕热度时间轴波形走势 (8 cols) -->
      <NGridItem :span="8">
        <NCard
          size="small"
          title="弹幕热度时间轴走势"
          :bordered="true"
          class="bento-panel"
        >
          <template #header-extra>
            <span class="panel-extra-hint">
              <NIcon :component="DataTrending24Regular" />
              直观定位直播高光时刻
            </span>
          </template>

          <div
            v-if="activityBuckets.length > 0"
            class="activity-timeline-container"
          >
            <div class="activity-bars-wrapper">
              <div
                v-for="(b, idx) in activityBuckets"
                :key="idx"
                class="activity-bar-col"
              >
                <NTooltip trigger="hover">
                  <template #trigger>
                    <div class="bar-hitbox">
                      <div
                        class="activity-bar"
                        :style="{ height: `${b.danmakuHeightPercent}%` }"
                        :class="{ 'has-income': b.income > 0 }"
                      />
                    </div>
                  </template>
                  <div class="activity-tooltip">
                    <div class="tooltip-time">{{ b.timeRange }}</div>
                    <div class="tooltip-row">
                      <span>💬 弹幕数:</span>
                      <strong>{{ b.danmakuCount }} 条</strong>
                    </div>
                    <div
                      v-if="b.income > 0"
                      class="tooltip-row income-row"
                    >
                      <span>💰 打赏收益:</span>
                      <strong>¥{{ b.income.toFixed(1) }}</strong>
                    </div>
                  </div>
                </NTooltip>
                <span
                  v-if="idx % Math.ceil(activityBuckets.length / 6) === 0"
                  class="bar-label"
                >
                  {{ b.label }}
                </span>
              </div>
            </div>
          </div>
          <div
            v-else
            class="empty-timeline"
          >
            <NText depth="3">暂无详细时段弹幕事件</NText>
          </div>
        </NCard>
      </NGridItem>

      <!-- 右侧：打赏与收入构成 (4 cols) -->
      <NGridItem :span="4">
        <NCard
          size="small"
          title="本场打赏构成"
          :bordered="true"
          class="bento-panel"
        >
          <div class="income-breakdown-box">
            <div class="breakdown-item">
              <div class="breakdown-header">
                <span class="breakdown-label">
                  <span class="color-dot dot-sc" />
                  醒目留言 (SC)
                </span>
                <span class="breakdown-value">¥{{ incomeBreakdown.sc }} ({{ incomeBreakdown.scPercent }}%)</span>
              </div>
              <NProgress
                type="line"
                :percentage="incomeBreakdown.scPercent"
                color="#f59e0b"
                :show-indicator="false"
                :height="6"
              />
            </div>

            <div class="breakdown-item">
              <div class="breakdown-header">
                <span class="breakdown-label">
                  <span class="color-dot dot-gift" />
                  付费礼物
                </span>
                <span class="breakdown-value">¥{{ incomeBreakdown.gift }} ({{ incomeBreakdown.giftPercent }}%)</span>
              </div>
              <NProgress
                type="line"
                :percentage="incomeBreakdown.giftPercent"
                color="#10b981"
                :show-indicator="false"
                :height="6"
              />
            </div>

            <div class="breakdown-item">
              <div class="breakdown-header">
                <span class="breakdown-label">
                  <span class="color-dot dot-guard" />
                  大航海 / 舰长
                </span>
                <span class="breakdown-value">¥{{ incomeBreakdown.guard }} ({{ incomeBreakdown.guardPercent }}%)</span>
              </div>
              <NProgress
                type="line"
                :percentage="incomeBreakdown.guardPercent"
                color="#6366f1"
                :show-indicator="false"
                :height="6"
              />
            </div>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 底部：本场打赏贡献榜 Top 10 -->
    <NCard
      size="small"
      title="本场打赏贡献榜 (Top 10)"
      :bordered="true"
      class="bento-panel ranking-panel"
    >
      <template #header-extra>
        <span class="panel-extra-hint">
          <NIcon :component="Trophy24Filled" style="color: #f59e0b" />
          基于观众打赏总额排行
        </span>
      </template>

      <NSkeleton
        v-if="isRankingLoading"
        text
        :repeat="4"
      />
      <div
        v-else-if="rankingList.length > 0"
        class="ranking-grid"
      >
        <div
          v-for="(rank, idx) in rankingList"
          :key="rank.ouId"
          class="ranking-card"
        >
          <div
            class="rank-badge"
            :style="getRankBadgeStyle(idx)"
          >
            {{ idx + 1 }}
          </div>

          <NAvatar
            round
            size="medium"
            :src="rank.uFace || undefined"
            fallback-src="https://i0.hdslb.com/bfs/face/member/noface.jpg"
            class="rank-avatar"
          >
            <template #fallback>
              <NIcon :component="Person24Regular" />
            </template>
          </NAvatar>

          <div class="rank-info">
            <span class="rank-name" :title="rank.uName">{{ rank.uName }}</span>
            <span class="rank-paid">
              <span class="currency">¥</span>{{ rank.totalPaid.toLocaleString() }}
            </span>
          </div>
        </div>
      </div>
      <div
        v-else
        class="empty-ranking"
      >
        <NEmpty description="本场直播暂无观众打赏记录" />
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.live-overview-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.metrics-grid {
  margin-bottom: 2px;
}

.metric-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
  border: 1px solid var(--vtsuru-border);
}

.metric-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-title {
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
  font-weight: 500;
}

.metric-icon {
  font-size: 18px;
  color: var(--vtsuru-fg-muted);
}

.income-icon {
  color: #10b981;
}

.metric-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.metric-number {
  font-size: 22px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.income-number {
  color: #10b981;
}

.metric-unit {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.metric-unit.currency {
  font-size: 15px;
  font-weight: 600;
  color: #10b981;
}

.metric-footer {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  min-height: 18px;
  display: flex;
  align-items: center;
}

.metric-sub {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

.bento-panel {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
}

.panel-extra-hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 时间轴波形图 */
.activity-timeline-container {
  height: 160px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding-top: 10px;
}

.activity-bars-wrapper {
  display: flex;
  align-items: flex-end;
  height: 120px;
  gap: 4px;
  border-bottom: 1px solid var(--vtsuru-border);
  padding-bottom: 2px;
}

.activity-bar-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
  position: relative;
}

.bar-hitbox {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  cursor: pointer;
}

.activity-bar {
  width: 100%;
  border-radius: 3px 3px 0 0;
  background: var(--vtsuru-brand);
  opacity: 0.75;
  transition: all 0.2s ease;
  min-height: 4px;
}

.activity-bar:hover {
  opacity: 1;
  transform: scaleY(1.05);
}

.activity-bar.has-income {
  background: linear-gradient(to top, var(--vtsuru-brand), #10b981);
}

.bar-label {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  margin-top: 6px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.activity-tooltip {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.tooltip-time {
  font-weight: 600;
  color: var(--vtsuru-fg);
  border-bottom: 1px solid var(--vtsuru-border);
  padding-bottom: 2px;
}

.tooltip-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.income-row {
  color: #10b981;
}

.empty-timeline {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 收入构成 */
.income-breakdown-box {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 8px 0;
}

.breakdown-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.breakdown-label {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--vtsuru-fg);
  font-weight: 500;
}

.color-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.dot-sc {
  background-color: #f59e0b;
}

.dot-gift {
  background-color: #10b981;
}

.dot-guard {
  background-color: #6366f1;
}

.breakdown-value {
  color: var(--vtsuru-fg-muted);
  font-variant-numeric: tabular-nums;
}

/* 排行榜 */
.ranking-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12px;
  padding: 4px 0;
}

.ranking-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
}

.rank-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.rank-avatar {
  flex-shrink: 0;
}

.rank-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.rank-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rank-paid {
  font-size: 12px;
  font-weight: 600;
  color: #10b981;
  font-variant-numeric: tabular-nums;
}

.rank-paid .currency {
  font-size: 10px;
  margin-right: 1px;
}

.empty-ranking {
  padding: 24px 0;
}

@media (max-width: 992px) {
  .ranking-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .ranking-grid {
    grid-template-columns: 1fr;
  }
}
</style>
