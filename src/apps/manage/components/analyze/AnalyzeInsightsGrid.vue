<script lang="ts" setup>
import CalendarLtr24Regular from '@vicons/fluent/es/CalendarLtr24Regular'
import Grid24Regular from '@vicons/fluent/es/Grid24Regular'
import MoneyHand24Regular from '@vicons/fluent/es/MoneyHand24Regular'
import Sparkle24Regular from '@vicons/fluent/es/Sparkle24Regular'
import Star24Regular from '@vicons/fluent/es/Star24Regular'
import { computed, ref } from 'vue'

import type {
  AnalyzeAreaStat,
  AnalyzeDayOfWeekStat,
  AnalyzeSessionItem,
} from '@/apps/manage/composables/analyzeRange'
import { formatDate, formatNumber } from '@/apps/manage/composables/formatters'
import { Badge } from '@/shared/ui/badge'
import { Card } from '@/shared/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import type { UnifiedSummary } from './types'

const props = defineProps<{
  summary: UnifiedSummary
  dayOfWeekStats: AnalyzeDayOfWeekStat[]
  areaStats: AnalyzeAreaStat[]
  sessions: AnalyzeSessionItem[]
}>()

const bestDayInsight = computed(() => {
  const stats = props.dayOfWeekStats.filter((d) => d.liveDaysCount > 0)
  if (stats.length === 0) return null
  return {
    income: stats.toSorted((a, b) => b.avgIncome - a.avgIncome)[0],
    danmaku: stats.toSorted((a, b) => b.avgDanmaku - a.avgDanmaku)[0],
  }
})

const activeTopSessionTab = ref<'income' | 'danmaku' | 'duration'>('income')

const topSessions = computed(() => {
  switch (activeTopSessionTab.value) {
    case 'income':
      return props.sessions.toSorted((a, b) => b.totalIncome - a.totalIncome).slice(0, 5)
    case 'danmaku':
      return props.sessions.toSorted((a, b) => b.danmakuCount - a.danmakuCount).slice(0, 5)
    case 'duration':
    default:
      return props.sessions.toSorted((a, b) => b.liveMinutes - a.liveMinutes).slice(0, 5)
  }
})
</script>

<template>
  <!-- 双列深度洞察 Bento -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
    <!-- 收入结构卡片 -->
    <Card class="p-4 space-y-3">
      <div class="flex items-center gap-2 text-xs font-semibold">
        <component
          :is="MoneyHand24Regular"
          class="h-4 w-4 text-amber-500"
        />
        <span>{{ summary.titlePrefix }}收入结构与变现盘面</span>
      </div>

      <div class="space-y-2">
        <div class="flex-between p-2 rounded bg-muted/40 border border-border text-xs">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span>普通打赏礼物</span>
          </div>
          <div class="font-mono font-semibold">
            ¥{{ formatNumber(summary.giftIncome) }}
            <span class="text-muted-foreground font-normal ml-1">
              ({{ summary.grandTotalIncome > 0 ? ((summary.giftIncome / summary.grandTotalIncome) * 100).toFixed(1) : 0 }}%)
            </span>
          </div>
        </div>

        <div class="flex-between p-2 rounded bg-muted/40 border border-border text-xs">
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-orange-500" />
            <span>醒目留言 (SC)</span>
          </div>
          <div class="font-mono font-semibold">
            ¥{{ formatNumber(summary.scIncome) }}
            <span class="text-muted-foreground font-normal ml-1">
              ({{ summary.grandTotalIncome > 0 ? ((summary.scIncome / summary.grandTotalIncome) * 100).toFixed(1) : 0 }}%)
            </span>
          </div>
        </div>

        <div
          v-if="summary.guardIncome > 0"
          class="flex-between p-2 rounded bg-muted/40 border border-border text-xs"
        >
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>直播大航海</span>
          </div>
          <div class="font-mono font-semibold">
            ¥{{ formatNumber(summary.guardIncome) }}
            <span class="text-muted-foreground font-normal ml-1">
              ({{ summary.grandTotalIncome > 0 ? ((summary.guardIncome / summary.grandTotalIncome) * 100).toFixed(1) : 0 }}%)
            </span>
          </div>
        </div>

        <div
          v-if="summary.offlineIncome > 0"
          class="flex-between p-2 rounded bg-muted/40 border border-border text-xs"
        >
          <div class="flex items-center gap-2">
            <div class="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>下播/未开播支持</span>
          </div>
          <div class="font-mono font-semibold text-emerald-500">
            ¥{{ formatNumber(summary.offlineIncome) }}
            <span class="text-muted-foreground font-normal ml-1">
              ({{ summary.grandTotalIncome > 0 ? ((summary.offlineIncome / summary.grandTotalIncome) * 100).toFixed(1) : 0 }}%)
            </span>
          </div>
        </div>
      </div>

      <!-- 付费转化漏斗 -->
      <div class="pt-2 border-t border-border space-y-1.5">
        <span class="text-xs font-semibold text-muted-foreground">观众变现转化</span>
        <div class="space-y-1 text-xs">
          <div class="flex justify-between text-muted-foreground text-[11px]">
            <span>互动观众: {{ formatNumber(summary.interactionUsers) }} 人</span>
            <span>100%</span>
          </div>
          <div class="h-2 rounded bg-blue-500/20 overflow-hidden">
            <div class="h-full bg-blue-500 w-full" />
          </div>

          <div class="flex justify-between text-muted-foreground text-[11px] pt-1">
            <span>付费观众: {{ formatNumber(summary.payingUsers) }} 人</span>
            <span class="text-purple-500 font-semibold">{{ summary.payingRate.toFixed(1) }}% 转化</span>
          </div>
          <div class="h-2 rounded bg-purple-500/20 overflow-hidden">
            <div
              class="h-full bg-purple-500"
              :style="{ width: `${Math.max(5, summary.payingRate)}%` }"
            />
          </div>
        </div>
      </div>
    </Card>

    <!-- 周开播黄金日与出勤 -->
    <Card class="p-4 space-y-3">
      <div class="flex-between">
        <div class="flex items-center gap-2 text-xs font-semibold">
          <component
            :is="CalendarLtr24Regular"
            class="h-4 w-4 text-brand"
          />
          <span>周开播习惯与黄金日</span>
        </div>
        <Badge
          v-if="bestDayInsight"
          variant="brand"
          size="xs"
        >
          黄金日: {{ bestDayInsight.income.dayName }}
        </Badge>
      </div>

      <div class="grid grid-cols-7 gap-1.5 pt-2 text-center text-xs">
        <div
          v-for="item in dayOfWeekStats"
          :key="item.dayOfWeek"
          class="p-1.5 rounded border border-border/50 bg-muted/20 flex flex-col items-center justify-between h-28"
          :class="{ 'border-brand/40 bg-brand/5': bestDayInsight?.income.dayOfWeek === item.dayOfWeek }"
        >
          <span class="font-semibold text-[11px]">{{ item.dayName }}</span>

          <div class="flex items-end gap-1 h-14 w-full justify-center">
            <div
              class="w-2 rounded-t bg-amber-500"
              :style="{
                height: `${bestDayInsight && bestDayInsight.income.avgIncome > 0 ? (item.avgIncome / bestDayInsight.income.avgIncome) * 100 : 0}%`,
              }"
              :title="`场均收益 ¥${item.avgIncome.toFixed(0)}`"
            />
            <div
              class="w-2 rounded-t bg-emerald-500"
              :style="{
                height: `${bestDayInsight && bestDayInsight.danmaku.avgDanmaku > 0 ? (item.avgDanmaku / bestDayInsight.danmaku.avgDanmaku) * 100 : 0}%`,
              }"
              :title="`场均弹幕 ${item.avgDanmaku.toFixed(0)}`"
            />
          </div>

          <span class="text-[10px] text-muted-foreground font-mono">¥{{ Math.round(item.avgIncome) }}</span>
        </div>
      </div>

      <div
        v-if="bestDayInsight"
        class="p-2 rounded bg-brand/5 border border-brand/20 text-xs text-foreground flex items-center gap-2"
      >
        <component
          :is="Sparkle24Regular"
          class="h-4 w-4 text-brand shrink-0"
        />
        <span>
          <strong>{{ bestDayInsight.income.dayName }}</strong> 场均收益最高 (¥{{
            bestDayInsight.income.avgIncome.toFixed(1)
          }})，建议将关键活动安排在该日。
        </span>
      </div>
    </Card>
  </div>

  <!-- 分区效能与单场高光 -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
    <Card class="p-4 space-y-3">
      <div class="flex items-center gap-2 text-xs font-semibold">
        <component
          :is="Grid24Regular"
          class="h-4 w-4 text-brand"
        />
        <span>{{ summary.titlePrefix }}直播分区效能</span>
      </div>

      <div
        v-if="areaStats.length === 0"
        class="text-xs text-muted-foreground text-center py-8"
      >
        当前区间无分区直播记录
      </div>
      <div
        v-else
        class="space-y-2 max-h-80 overflow-y-auto pr-1"
      >
        <div
          v-for="area in areaStats"
          :key="`${area.parentArea}-${area.area}`"
          class="p-2.5 rounded-lg border border-border bg-card/60 flex-between text-xs"
        >
          <div>
            <div class="flex items-center gap-1.5">
              <Badge
                variant="outline"
                size="xs"
              >
                {{ area.parentArea }}
              </Badge>
              <span class="font-semibold">{{ area.area }}</span>
            </div>
            <div class="text-[11px] text-muted-foreground mt-1">
              {{ area.sessionCount }} 场直播 · {{ (area.totalLiveMinutes / 60).toFixed(1) }} 小时 · 场均
              {{ formatNumber(area.avgDanmaku) }} 弹幕
            </div>
          </div>
          <div class="text-right font-mono">
            <span class="font-bold text-amber-500">¥{{ formatNumber(area.totalIncome) }}</span>
            <span class="text-[10px] text-muted-foreground block">场均 ¥{{ area.avgIncome.toFixed(0) }}</span>
          </div>
        </div>
      </div>
    </Card>

    <Card class="p-4 space-y-3">
      <div class="flex-between">
        <div class="flex items-center gap-2 text-xs font-semibold">
          <component
            :is="Star24Regular"
            class="h-4 w-4 text-amber-500"
          />
          <span>单场直播高光 TOP 5</span>
        </div>

        <ToggleGroup
          v-model="activeTopSessionTab"
          type="single"
          size="xs"
        >
          <ToggleGroupItem value="income">最高收益</ToggleGroupItem>
          <ToggleGroupItem value="danmaku">最密弹幕</ToggleGroupItem>
          <ToggleGroupItem value="duration">最长开播</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        v-if="sessions.length === 0"
        class="text-xs text-muted-foreground text-center py-8"
      >
        暂无单场直播记录
      </div>
      <div
        v-else
        class="space-y-2 max-h-80 overflow-y-auto pr-1"
      >
        <div
          v-for="(session, idx) in topSessions"
          :key="session.id"
          class="p-2.5 rounded-lg border border-border bg-card/60 flex items-center gap-2.5 text-xs"
        >
          <div
            class="w-5 h-5 rounded flex-center font-bold text-[11px] shrink-0"
            :class="{
              'bg-amber-500 text-black': idx === 0,
              'bg-slate-400 text-black': idx === 1,
              'bg-amber-700 text-white': idx === 2,
              'bg-muted text-muted-foreground': idx > 2,
            }"
          >
            {{ idx + 1 }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span
                class="font-semibold truncate"
                :title="session.title"
                >{{ session.title }}</span
              >
              <Badge
                variant="outline"
                class="text-[9px] px-1 py-0 h-3.5"
              >
                {{ session.area }}
              </Badge>
            </div>
            <div class="text-[11px] text-muted-foreground mt-0.5">
              {{ formatDate(session.startTime) }} · {{ (session.liveMinutes / 60).toFixed(1) }} 小时
            </div>
          </div>

          <div class="text-right font-mono shrink-0">
            <template v-if="activeTopSessionTab === 'income'">
              <span class="font-bold text-amber-500">¥{{ formatNumber(session.totalIncome) }}</span>
              <span class="text-[10px] text-muted-foreground block"
                >{{ formatNumber(session.danmakuCount) }} 条弹幕</span
              >
            </template>
            <template v-else-if="activeTopSessionTab === 'danmaku'">
              <span class="font-bold text-emerald-500">{{ formatNumber(session.danmakuCount) }} 条</span>
              <span class="text-[10px] text-muted-foreground block">¥{{ formatNumber(session.totalIncome) }}</span>
            </template>
            <template v-else>
              <span class="font-bold text-purple-500">{{ (session.liveMinutes / 60).toFixed(1) }} 小时</span>
              <span class="text-[10px] text-muted-foreground block">¥{{ formatNumber(session.totalIncome) }}</span>
            </template>
          </div>
        </div>
      </div>
    </Card>
  </div>
</template>
