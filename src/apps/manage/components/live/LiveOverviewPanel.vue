<script setup lang="ts">
import {
  Chat24Regular,
  Clock24Regular,
  DataTrending24Regular,
  HandRight24Regular,
  Money24Regular,
  Person24Regular,
  Trophy24Filled,
} from '@vicons/fluent'
import { computed, onMounted, ref, watch } from 'vue'

import type { DanmakuModel, ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { getApiLiveRanking } from '@/api/generated/live/live'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}>()

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

function formatTimeHHmm(val: number | string | undefined | null) {
  if (!val) return ''
  const d = new Date(Number(val))
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

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
    if (
      (d.type === EventDataTypes.Gift || d.type === EventDataTypes.SC || d.type === EventDataTypes.Guard) &&
      (d.price || 0) > 0
    ) {
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

// 弹幕时段密度走势分桶
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

  const bucketCount = Math.min(24, Math.max(12, Math.ceil(span / (10 * 60000))))
  const bucketDuration = span / bucketCount

  const buckets: TimeBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const bStart = start + i * bucketDuration
    const bEnd = bStart + bucketDuration
    const sDate = new Date(bStart)
    const eDate = new Date(bEnd)
    const formatTime = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
    const res = (await getApiLiveRanking({
      liveId: props.live.liveId,
      limit: 10,
    })) as unknown as {
      code: number
      data?: ResponseLiveRankingEntryModel[]
    }
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
  return { background: 'var(--muted)', color: 'var(--muted-foreground)' }
}

onMounted(fetchRanking)
watch(() => props.live.liveId, fetchRanking)
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- 顶部核心指标 4 宫格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card class="p-3.5">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>直播历时</span>
            <component
              :is="Clock24Regular"
              class="size-4.5"
            />
          </div>
          <div class="text-xl font-bold font-mono">
            {{ durationText }}
          </div>
          <div class="text-[11px] text-muted-foreground">
            {{ formatTimeHHmm(live.startAt) }} ~ {{ live.isFinish ? formatTimeHHmm(live.stopAt) : '(直播中)' }}
          </div>
        </div>
      </Card>

      <Card class="p-3.5">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>弹幕总数 / 发言人数</span>
            <component
              :is="Chat24Regular"
              class="size-4.5"
            />
          </div>
          <div class="text-xl font-bold font-mono">
            {{ live.danmakusCount.toLocaleString() }}
            <span class="text-xs font-normal text-muted-foreground">条</span>
          </div>
          <div class="text-[11px] text-muted-foreground">
            {{ chatterStats.uniqueChatters }} 位独立观众 · 人均 {{ chatterStats.avgDanmakuPerUser }} 条
          </div>
        </div>
      </Card>

      <Card class="p-3.5">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>总打赏收益</span>
            <component
              :is="Money24Regular"
              class="size-4.5 text-emerald-500"
            />
          </div>
          <div class="text-xl font-bold font-mono text-emerald-500">
            <span class="text-xs mr-0.5">¥</span>{{ live.totalIncome.toLocaleString() }}
          </div>
          <div class="text-[11px] text-muted-foreground">{{ chatterStats.uniquePayers }} 位付费观众打赏</div>
        </div>
      </Card>

      <Card class="p-3.5">
        <div class="flex flex-col gap-1.5">
          <div class="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>总互动人次</span>
            <component
              :is="HandRight24Regular"
              class="size-4.5"
            />
          </div>
          <div class="text-xl font-bold font-mono">
            {{ live.interactionCount.toLocaleString() }}
            <span class="text-xs font-normal text-muted-foreground">次</span>
          </div>
          <div class="text-[11px] text-muted-foreground">包含进场、点赞与关注</div>
        </div>
      </Card>
    </div>

    <!-- 中间：时段密度波形走势 & 收入构成分析 -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-3">
      <!-- 左侧：弹幕热度时间轴波形走势 (8 cols) -->
      <Card class="lg:col-span-8 p-3.5 flex flex-col">
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-border">
          <span class="text-sm font-semibold">弹幕热度时间轴走势</span>
          <span class="text-xs text-muted-foreground flex items-center gap-1">
            <component
              :is="DataTrending24Regular"
              class="size-3.5"
            />
            直观定位直播高光时刻
          </span>
        </div>

        <div
          v-if="activityBuckets.length > 0"
          class="activity-timeline-container flex-1 flex flex-col justify-end"
        >
          <div class="activity-bars-wrapper flex items-end gap-1 h-36 pt-4 pb-1">
            <TooltipProvider
              v-for="(b, idx) in activityBuckets"
              :key="idx"
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <div class="flex-1 flex flex-col items-center h-full justify-end cursor-pointer group">
                    <div
                      class="w-full rounded-t transition-all"
                      :class="
                        b.income > 0
                          ? 'bg-amber-500/80 group-hover:bg-amber-500'
                          : 'bg-primary/50 group-hover:bg-primary'
                      "
                      :style="{ height: `${b.danmakuHeightPercent}%` }"
                    />
                    <span
                      v-if="idx % Math.ceil(activityBuckets.length / 6) === 0"
                      class="text-[10px] text-muted-foreground mt-1 select-none"
                    >
                      {{ b.label }}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div class="text-xs space-y-1">
                    <div class="font-medium">{{ b.timeRange }}</div>
                    <div>
                      💬 弹幕数: <strong>{{ b.danmakuCount }} 条</strong>
                    </div>
                    <div
                      v-if="b.income > 0"
                      class="text-amber-500"
                    >
                      💰 打赏收益: <strong>¥{{ b.income.toFixed(1) }}</strong>
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div
          v-else
          class="h-36 flex items-center justify-center text-xs text-muted-foreground"
        >
          暂无详细时段弹幕事件
        </div>
      </Card>

      <!-- 右侧：打赏与收入构成 (4 cols) -->
      <Card class="lg:col-span-4 p-3.5 flex flex-col">
        <div class="text-sm font-semibold pb-2 mb-2 border-b border-border">本场打赏构成</div>
        <div class="flex flex-col gap-3.5 py-1">
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-amber-500" />
                醒目留言 (SC)
              </span>
              <span class="font-mono font-medium">¥{{ incomeBreakdown.sc }} ({{ incomeBreakdown.scPercent }}%)</span>
            </div>
            <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                class="bg-amber-500 h-full rounded-full"
                :style="{ width: `${incomeBreakdown.scPercent}%` }"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-emerald-500" />
                付费礼物
              </span>
              <span class="font-mono font-medium"
                >¥{{ incomeBreakdown.gift }} ({{ incomeBreakdown.giftPercent }}%)</span
              >
            </div>
            <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                class="bg-emerald-500 h-full rounded-full"
                :style="{ width: `${incomeBreakdown.giftPercent}%` }"
              />
            </div>
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between text-xs">
              <span class="flex items-center gap-1.5 text-muted-foreground">
                <span class="size-2 rounded-full bg-indigo-500" />
                大航海 / 舰长
              </span>
              <span class="font-mono font-medium"
                >¥{{ incomeBreakdown.guard }} ({{ incomeBreakdown.guardPercent }}%)</span
              >
            </div>
            <div class="w-full bg-muted rounded-full h-1.5 overflow-hidden">
              <div
                class="bg-indigo-500 h-full rounded-full"
                :style="{ width: `${incomeBreakdown.guardPercent}%` }"
              />
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 底部：本场打赏贡献榜 Top 10 -->
    <Card class="p-3.5">
      <div class="flex items-center justify-between pb-2 mb-3 border-b border-border">
        <span class="text-sm font-semibold">本场打赏贡献榜 (Top 10)</span>
        <span class="text-xs text-muted-foreground flex items-center gap-1">
          <component
            :is="Trophy24Filled"
            class="size-3.5 text-amber-500"
          />
          基于观众打赏总额排行
        </span>
      </div>

      <div
        v-if="isRankingLoading"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5"
      >
        <Skeleton
          v-for="i in 5"
          :key="i"
          class="h-14 w-full rounded-lg"
        />
      </div>

      <div
        v-else-if="rankingList.length > 0"
        class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5"
      >
        <div
          v-for="(rank, idx) in rankingList"
          :key="rank.ouId"
          class="flex items-center gap-2.5 p-2 rounded-lg border border-border bg-card/50"
        >
          <div
            class="size-5 rounded flex items-center justify-center text-[11px] font-bold shrink-0"
            :style="getRankBadgeStyle(idx)"
          >
            {{ idx + 1 }}
          </div>

          <Avatar class="size-8">
            <AvatarImage :src="rank.uFace" />
            <AvatarFallback>
              <component
                :is="Person24Regular"
                class="size-4"
              />
            </AvatarFallback>
          </Avatar>

          <div class="min-w-0 flex-1">
            <div
              class="text-xs font-medium truncate"
              :title="rank.uName"
            >
              {{ rank.uName }}
            </div>
            <div class="text-xs font-mono font-semibold text-emerald-500">
              <span class="text-[10px]">¥</span>{{ rank.totalPaid.toLocaleString() }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-else
        class="py-8 flex justify-center"
      >
        <Empty description="本场直播暂无观众打赏记录" />
      </div>
    </Card>
  </div>
</template>
