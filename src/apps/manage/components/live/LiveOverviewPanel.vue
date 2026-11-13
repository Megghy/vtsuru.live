<script setup lang="ts">
import BookmarkAdd24Regular from '@vicons/fluent/es/BookmarkAdd24Regular'
import Chat24Regular from '@vicons/fluent/es/Chat24Regular'
import Clock24Regular from '@vicons/fluent/es/Clock24Regular'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import DataTrending24Regular from '@vicons/fluent/es/DataTrending24Regular'
import HandRight24Regular from '@vicons/fluent/es/HandRight24Regular'
import Money24Regular from '@vicons/fluent/es/Money24Regular'
import Person24Regular from '@vicons/fluent/es/Person24Regular'
import Trophy24Filled from '@vicons/fluent/es/Trophy24Filled'
import { useClipboard } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import type { DanmakuModel } from '@/api/client-types'
import { getApiLiveRanking } from '@/api/generated/live/live'
import type { ResponseLiveInfoModel, ResponseLiveRankingEntryModel } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import type { LiveHighlightMarker } from '@/apps/live-dashboard/core/db'
import { dashboardDB } from '@/apps/live-dashboard/core/db'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Progress } from '@/shared/ui/progress'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import type { HighlightEntry } from '@/shared/utils/liveHighlights'
import {
  buildHighlightCommentText,
  buildHighlightSrtText,
  detectAutoHighlights,
} from '@/shared/utils/liveHighlights'
import { formatBiliOffset } from '@/shared/utils/songTimeline'

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

// 收入构成分析与盲盒盈亏统计
const incomeBreakdown = computed(() => {
  let sc = 0
  let gift = 0
  let guard = 0
  let mysteryCount = 0
  let mysteryCost = 0
  let mysteryValue = 0

  for (const d of props.danmakus) {
    const price = d.price || 0
    if (d.type === EventDataTypes.SC) sc += price
    else if (d.type === EventDataTypes.Gift) {
      gift += price
      if (d.mysteryBoxName || (d.mysteryBoxPrice ?? 0) > 0) {
        mysteryCount += Math.max(1, d.num || 1)
        mysteryCost += price
        mysteryValue += d.mysteryBoxPrice ?? 0
      }
    } else if (d.type === EventDataTypes.Guard) guard += price
  }

  const total = props.live.totalIncome || sc + gift + guard || 0
  const scPercent = total > 0 ? Math.round((sc / total) * 100) : 0
  const giftPercent = total > 0 ? Math.round((gift / total) * 100) : 0
  const guardPercent = total > 0 ? Math.round((guard / total) * 100) : 0
  const mysteryProfit = Math.round((mysteryValue - mysteryCost) * 100) / 100

  return {
    total,
    sc: sc.toFixed(1),
    gift: gift.toFixed(1),
    guard: guard.toFixed(1),
    scPercent,
    giftPercent,
    guardPercent,
    mysteryCount,
    mysteryCost: mysteryCost.toFixed(1),
    mysteryValue: mysteryValue.toFixed(1),
    mysteryProfit,
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

onMounted(() => {
  void fetchRanking()
  void loadLocalMarkers()
})
watch(
  () => props.live.liveId,
  () => {
    void fetchRanking()
    void loadLocalMarkers()
  },
)

// 高光打点聚合与时间轴导出
const { copy } = useClipboard()
const localMarkers = ref<LiveHighlightMarker[]>([])
const includeManualMarkers = ref(true)
const includeAutoPeak = ref(true)
const includeAutoSc = ref(true)
const includeAutoGuard = ref(false)
const offsetAdjustSec = ref(0)

async function loadLocalMarkers() {
  const start = Number(props.live.startAt) || 0
  if (!start) {
    localMarkers.value = []
    return
  }
  const end = props.live.isFinish ? Number(props.live.stopAt) || start + 86400_000 : Date.now()
  try {
    localMarkers.value = await dashboardDB.markers.where('time').between(start, end, true, true).sortBy('time')
  } catch {
    localMarkers.value = []
  }
}

const autoHighlights = computed(() => {
  const start = Number(props.live.startAt) || 0
  const end = props.live.isFinish ? Number(props.live.stopAt) || undefined : undefined
  return detectAutoHighlights(props.danmakus, start, end, { includeGuard: includeAutoGuard.value })
})

const mergedHighlights = computed<HighlightEntry[]>(() => {
  const list: HighlightEntry[] = []
  if (includeManualMarkers.value) {
    for (const m of localMarkers.value) {
      list.push({
        id: `marker-${m.id ?? m.time}`,
        timeMs: m.time,
        label: m.author ? `${m.label} (${m.author})` : m.label,
        source: m.source,
        author: m.author,
      })
    }
  }
  for (const item of autoHighlights.value) {
    if (item.source === 'auto-peak' && !includeAutoPeak.value) continue
    if (item.source === 'auto-sc' && !includeAutoSc.value) continue
    if (item.source === 'auto-guard' && !includeAutoGuard.value) continue
    list.push(item)
  }
  return list.sort((a, b) => a.timeMs - b.timeMs)
})

async function copyHighlightComment() {
  const start = Number(props.live.startAt) || 0
  const text = buildHighlightCommentText(mergedHighlights.value, start, offsetAdjustSec.value)
  if (!text) {
    toast.warning('当前筛选下没有可导出的高光点')
    return
  }
  await copy(text)
  toast.success(`已复制 ${mergedHighlights.value.length} 条 B 站时间轴评论`)
}

function downloadHighlightSrt() {
  const start = Number(props.live.startAt) || 0
  const srt = buildHighlightSrtText(mergedHighlights.value, start, offsetAdjustSec.value)
  if (!srt) {
    toast.warning('当前筛选下没有可导出的高光点')
    return
  }
  const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
  saveAs(blob, `live-highlights-${props.live.liveId || start}.srt`)
  toast.success('已导出 SRT 时间标记文件')
}
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- 顶部核心指标 4 宫格 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      <Card class="p-3.5">
        <div class="flex flex-col gap-1.5">
          <div class="flex-between text-xs text-muted-foreground font-medium">
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
          <div class="flex-between text-xs text-muted-foreground font-medium">
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
          <div class="flex-between text-xs text-muted-foreground font-medium">
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
          <div class="flex-between text-xs text-muted-foreground font-medium">
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
        <div class="flex-between pb-2 mb-2 border-b border-border">
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
          class="h-36 flex-center text-xs text-muted-foreground"
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

          <div
            v-if="incomeBreakdown.mysteryCount > 0"
            class="pt-2.5 mt-1 border-t border-border/60 space-y-1 text-xs"
          >
            <div class="flex justify-between items-center">
              <span class="text-muted-foreground">盲盒统计 ({{ incomeBreakdown.mysteryCount }} 个)</span>
              <span
                class="font-mono font-semibold"
                :class="incomeBreakdown.mysteryProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'"
              >
                {{ incomeBreakdown.mysteryProfit >= 0 ? '+' : '-' }}¥{{
                  Math.abs(incomeBreakdown.mysteryProfit).toFixed(1)
                }}
              </span>
            </div>
            <div class="text-[11px] text-muted-foreground flex justify-between font-mono">
              <span>投入 ¥{{ incomeBreakdown.mysteryCost }}</span>
              <span>爆出 ¥{{ incomeBreakdown.mysteryValue }}</span>
            </div>
          </div>
        </div>
      </Card>
    </div>

    <!-- 高光时间轴与切片定位导出 -->
    <Card class="p-3.5">
      <div class="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-border">
        <div class="flex items-center gap-2">
          <component
            :is="BookmarkAdd24Regular"
            class="size-4 text-primary"
          />
          <span class="text-sm font-semibold">高光时间轴与切片定位</span>
          <Badge
            variant="secondary"
            size="xs"
          >
            {{ mergedHighlights.length }} 个标记
          </Badge>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs">
          <label class="flex items-center gap-1 cursor-pointer">
            <Checkbox v-model:checked="includeManualMarkers" />
            <span>主动打点 ({{ localMarkers.length }})</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <Checkbox v-model:checked="includeAutoPeak" />
            <span>弹幕峰值</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <Checkbox v-model:checked="includeAutoSc" />
            <span>高额 SC</span>
          </label>
          <label class="flex items-center gap-1 cursor-pointer">
            <Checkbox v-model:checked="includeAutoGuard" />
            <span>上舰</span>
          </label>
          <div class="flex items-center gap-1">
            <span class="text-muted-foreground">片头偏移(秒)</span>
            <NumberField
              v-model="offsetAdjustSec"
              class="w-20"
            />
          </div>
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            :disabled="mergedHighlights.length === 0"
            @click="copyHighlightComment"
          >
            <component
              :is="Copy24Regular"
              class="size-3.5"
            />
            复制评论区时间轴
          </Button>
          <Button
            size="xs"
            :disabled="mergedHighlights.length === 0"
            @click="downloadHighlightSrt"
          >
            导出剪映 .SRT 标记
          </Button>
        </div>
      </div>

      <div
        v-if="mergedHighlights.length > 0"
        class="max-h-48 overflow-y-auto scrollbar-thin grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs"
      >
        <div
          v-for="item in mergedHighlights"
          :key="item.id"
          class="flex items-center gap-2 rounded-md border bg-muted/20 px-2.5 py-1.5"
        >
          <Badge
            variant="outline"
            size="xs"
            class="font-mono shrink-0"
          >
            {{ formatBiliOffset(item.timeMs - Number(live.startAt) + offsetAdjustSec * 1000) }}
          </Badge>
          <span class="truncate flex-1">{{ item.label }}</span>
        </div>
      </div>
      <div
        v-else
        class="py-4 text-center text-xs text-muted-foreground"
      >
        暂无高光点（直播期间在中控台按 Alt+M 或发送 !mark 即可记录，或勾选弹幕峰值/SC 自动识别）
      </div>
    </Card>

    <!-- 底部：本场打赏贡献榜 Top 10 -->
    <Card class="p-3.5">
      <div class="flex-between pb-2 mb-3 border-b border-border">
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
            class="size-5 rounded flex-center text-[11px] font-bold shrink-0"
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
