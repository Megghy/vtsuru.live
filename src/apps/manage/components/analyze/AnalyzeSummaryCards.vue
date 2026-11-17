<script lang="ts" setup>
import ArrowDown24Regular from '@vicons/fluent/es/ArrowDown24Regular'
import ArrowTrending24Regular from '@vicons/fluent/es/ArrowTrending24Regular'
import ChatMultiple24Regular from '@vicons/fluent/es/ChatMultiple24Regular'
import People24Regular from '@vicons/fluent/es/People24Regular'
import Timer24Regular from '@vicons/fluent/es/Timer24Regular'
import Trophy24Regular from '@vicons/fluent/es/Trophy24Regular'
import Wallet24Regular from '@vicons/fluent/es/Wallet24Regular'

import type { AnalyzeMilestones } from '@/apps/manage/composables/analyzeRange'
import { formatNumber } from '@/apps/manage/composables/formatters'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent, CardHeader } from '@/shared/ui/card'

import type { UnifiedSummary } from './types'

defineProps<{
  summary: UnifiedSummary
  milestones: AnalyzeMilestones
  totalDayCount: number
}>()
</script>

<template>
  <!-- 峰值高光胶囊条 -->
  <div
    v-if="milestones.maxIncomeDay || milestones.maxDanmakuDay"
    class="flex items-center gap-2.5 p-2.5 rounded-lg border border-border bg-card overflow-x-auto text-xs"
  >
    <div class="flex items-center gap-1.5 font-semibold shrink-0 text-foreground">
      <component
        :is="Trophy24Regular"
        class="h-4 w-4 text-amber-500"
      />
      <span>{{ summary.titlePrefix }}高光:</span>
    </div>

    <div
      v-if="milestones.maxIncomeDay"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
    >
      <span class="text-muted-foreground">单日最高收益</span>
      <span class="font-bold text-amber-500 font-mono">¥{{ formatNumber(milestones.maxIncomeDay.value) }}</span>
      <span class="text-[10px] text-muted-foreground">{{ milestones.maxIncomeDay.dateStr }}</span>
    </div>

    <div
      v-if="milestones.maxDanmakuDay"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
    >
      <span class="text-muted-foreground">单日弹幕狂欢</span>
      <span class="font-bold text-emerald-500 font-mono">{{ formatNumber(milestones.maxDanmakuDay.value) }} 条</span>
      <span class="text-[10px] text-muted-foreground">{{ milestones.maxDanmakuDay.dateStr }}</span>
    </div>

    <div
      v-if="milestones.maxDurationDay"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
    >
      <span class="text-muted-foreground">最长开播</span>
      <span class="font-bold text-purple-500 font-mono"
        >{{ (milestones.maxDurationDay.value / 60).toFixed(1) }} 小时</span
      >
      <span class="text-[10px] text-muted-foreground">{{ milestones.maxDurationDay.dateStr }}</span>
    </div>

    <div
      v-if="milestones.maxInteractionDay"
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/60 border border-border shrink-0"
    >
      <span class="text-muted-foreground">互动峰值</span>
      <span class="font-bold text-cyan-500 font-mono">{{ formatNumber(milestones.maxInteractionDay.value) }} 人</span>
      <span class="text-[10px] text-muted-foreground">{{ milestones.maxInteractionDay.dateStr }}</span>
    </div>
  </div>

  <!-- 4 宫格 Bento 核心指标大卡 -->
  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <!-- 收益总览 -->
    <Card class="flex flex-col justify-between">
      <CardHeader class="p-3.5 flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-amber-500/15 text-amber-500 flex-center">
            <component
              :is="Wallet24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <span class="text-xs font-semibold">{{ summary.titlePrefix }}总收益</span>
        </div>
        <Badge
          v-if="summary.incomeTrend !== undefined"
          :variant="summary.incomeTrend >= 0 ? 'brand' : 'destructive'"
          class="text-[10px] px-1 py-0 h-4"
        >
          <component
            :is="summary.incomeTrend >= 0 ? ArrowTrending24Regular : ArrowDown24Regular"
            class="h-3 w-3 mr-0.5"
          />
          {{ Math.abs(summary.incomeTrend) }}%
        </Badge>
      </CardHeader>

      <CardContent class="space-y-2">
        <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
          <span class="text-amber-500 text-lg">¥</span>
          {{ formatNumber(summary.grandTotalIncome) }}
        </div>

        <div class="space-y-1 text-[11px] text-muted-foreground">
          <div class="flex justify-between">
            <span>礼物 ¥{{ formatNumber(summary.giftIncome) }}</span>
            <span>SC ¥{{ formatNumber(summary.scIncome) }}</span>
          </div>
          <div class="h-1.5 rounded-full bg-muted flex overflow-hidden gap-0.5">
            <div
              class="bg-amber-500 h-full"
              :style="{
                width: `${summary.grandTotalIncome > 0 ? (summary.giftIncome / summary.grandTotalIncome) * 100 : 0}%`,
              }"
            />
            <div
              class="bg-orange-500 h-full"
              :style="{
                width: `${summary.grandTotalIncome > 0 ? (summary.scIncome / summary.grandTotalIncome) * 100 : 0}%`,
              }"
            />
            <div
              v-if="summary.guardIncome > 0"
              class="bg-blue-500 h-full"
              :style="{
                width: `${summary.grandTotalIncome > 0 ? (summary.guardIncome / summary.grandTotalIncome) * 100 : 0}%`,
              }"
            />
          </div>
        </div>

        <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
          <span>时薪: <strong class="text-foreground font-mono">¥{{ summary.hourlyIncome.toFixed(1) }}</strong></span>
          <span>场均: <strong class="text-foreground font-mono">¥{{ summary.dailyAvgIncome.toFixed(1) }}</strong></span>
        </div>
      </CardContent>
    </Card>

    <!-- 弹幕与互动 -->
    <Card class="flex flex-col justify-between">
      <CardHeader class="p-3.5 flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-emerald-500/15 text-emerald-500 flex-center">
            <component
              :is="ChatMultiple24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <span class="text-xs font-semibold">{{ summary.titlePrefix }}弹幕数</span>
        </div>
        <Badge
          v-if="summary.danmakuTrend !== undefined"
          :variant="summary.danmakuTrend >= 0 ? 'brand' : 'destructive'"
          class="text-[10px] px-1 py-0 h-4"
        >
          {{ Math.abs(summary.danmakuTrend) }}%
        </Badge>
      </CardHeader>

      <CardContent class="space-y-2">
        <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
          {{ formatNumber(summary.totalDanmakuCount) }}
          <span class="text-xs font-normal text-muted-foreground">条</span>
        </div>

        <div class="text-xs text-muted-foreground flex-between">
          <span>观众互动粘性</span>
          <span class="font-semibold text-foreground">{{ summary.avgDanmakuPerUser.toFixed(1) }} 条/人</span>
        </div>

        <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
          <span>互动: <strong class="text-foreground font-mono">{{ formatNumber(summary.totalInteractions) }}</strong></span>
          <span>点赞: <strong class="text-foreground font-mono">{{ formatNumber(summary.totalLikeCount) }}</strong></span>
        </div>
      </CardContent>
    </Card>

    <!-- 粉丝与转化 -->
    <Card class="flex flex-col justify-between">
      <CardHeader class="p-3.5 flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-cyan-500/15 text-cyan-500 flex-center">
            <component
              :is="People24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <span class="text-xs font-semibold">{{ summary.titlePrefix }}互动人数</span>
        </div>
        <Badge
          variant="secondary"
          size="xs"
        >
          转化率 {{ summary.payingRate.toFixed(1) }}%
        </Badge>
      </CardHeader>

      <CardContent class="space-y-2">
        <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
          {{ formatNumber(summary.interactionUsers) }}
          <span class="text-xs font-normal text-muted-foreground">人</span>
        </div>

        <div class="text-xs text-muted-foreground flex-between">
          <span>付费观众: <strong class="text-foreground">{{ formatNumber(summary.payingUsers) }}人</strong></span>
          <span>客单价: ¥{{ summary.avgIncomePerPayingUser.toFixed(1) }}</span>
        </div>

        <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
          <span>渗透率: <strong class="text-foreground font-mono">{{ summary.payingRate.toFixed(1) }}%</strong></span>
          <span>日均: <strong class="text-foreground font-mono">{{ summary.dailyAvgInteractions.toFixed(0) }}人</strong></span>
        </div>
      </CardContent>
    </Card>

    <!-- 开播时长 -->
    <Card class="flex flex-col justify-between">
      <CardHeader class="p-3.5 flex-row items-center justify-between">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded bg-purple-500/15 text-purple-500 flex-center">
            <component
              :is="Timer24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <span class="text-xs font-semibold">{{ summary.titlePrefix }}直播时长</span>
        </div>
        <Badge
          variant="secondary"
          size="xs"
        >
          开播 {{ summary.activeLiveDays }} 天
        </Badge>
      </CardHeader>

      <CardContent class="space-y-2">
        <div class="text-2xl font-extrabold font-mono text-foreground flex items-baseline gap-1">
          {{ (summary.totalLiveMinutes / 60).toFixed(1) }}
          <span class="text-xs font-normal text-muted-foreground">小时</span>
        </div>

        <div class="text-xs text-muted-foreground flex-between">
          <span>周期开播率</span>
          <span class="font-semibold text-foreground">
            {{ totalDayCount > 0 ? ((summary.activeLiveDays / totalDayCount) * 100).toFixed(0) : 0 }}%
          </span>
        </div>

        <div class="pt-2 border-t border-border flex justify-between text-[11px] text-muted-foreground">
          <span
            >场均:
            <strong class="text-foreground font-mono">{{ (summary.avgLiveMinutesPerSession / 60).toFixed(1) }}h</strong></span
          >
          <span>总场次: <strong class="text-foreground font-mono">{{ summary.totalSessions }}场</strong></span>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
