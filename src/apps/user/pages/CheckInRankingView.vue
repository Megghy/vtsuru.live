<script setup lang="ts">
import { ArrowClockwise24Regular, Info24Filled, Search24Regular, Trophy24Filled } from '@vicons/fluent'
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, ref, watch } from 'vue'

import type { CheckInRankingInfo, UserInfo } from '@/api/api-models'
import {
  getApiCheckinKeyword,
  getApiCheckinRanking,
} from '@/api/generated/check-in/check-in'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

const props = defineProps<{
  userInfo: UserInfo | undefined
}>()

const isLoading = ref(false)
const rankingData = ref<CheckInRankingInfo[]>([])
const timeRange = ref('all')
const userFilter = ref('')
const checkInKeyword = ref('签到')
const pagination = ref({ page: 1, pageSize: 10 })

const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]
const pageSizeOptions = [10, 20, 50].map((value) => ({ label: `${value} 条/页`, value: String(value) }))

function getRangeStart(range: string) {
  const now = new Date()
  if (range === 'today') {
    now.setHours(0, 0, 0, 0)
    return now
  }
  if (range === 'week') {
    now.setDate(now.getDate() - ((now.getDay() || 7) - 1))
    now.setHours(0, 0, 0, 0)
    return now
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const filteredRankingData = computed(() => {
  const keyword = userFilter.value.trim().toLocaleLowerCase()
  const rangeStart = timeRange.value === 'all' ? undefined : getRangeStart(timeRange.value)

  return rankingData.value.filter((item) => {
    const matchesRange = !rangeStart || new Date(item.lastCheckInTime) >= rangeStart
    const matchesUser = !keyword || item.name.toLocaleLowerCase().includes(keyword)
    return matchesRange && matchesUser
  })
})

const pagedData = computed(() => {
  const { page, pageSize } = pagination.value
  const startIndex = (page - 1) * pageSize
  return filteredRankingData.value.slice(startIndex, startIndex + pageSize).map((item, index) => ({
    ...item,
    rank: startIndex + index + 1,
  }))
})

watch([timeRange, userFilter, () => pagination.value.pageSize], () => {
  pagination.value.page = 1
})

async function loadCheckInRanking() {
  isLoading.value = true
  try {
    const response = (await getApiCheckinRanking({
      vId: props.userInfo?.id,
      count: 100,
    })) as unknown as {
      code: number
      message?: string
      data: CheckInRankingInfo[]
    }

    if (response.code !== 200) {
      rankingData.value = []
      toast.error(`获取签到排行榜失败: ${response.message}`)
      return
    }

    rankingData.value = response.data
    pagination.value.page = 1
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    rankingData.value = []
  } finally {
    isLoading.value = false
  }
}

async function fetchCheckInKeyword() {
  if (!props.userInfo?.id) return

  try {
    const response = (await getApiCheckinKeyword({
      vId: props.userInfo.id,
    })) as unknown as {
      code: number
      data: { keyword: string }
    }
    if (response.code === 200) checkInKeyword.value = response.data.keyword
  } catch (error) {
    console.error('获取签到关键词失败:', error)
  }
}

function formatRelativeTime(dateStr: string | number) {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: zhCN })
  } catch {
    return String(dateStr)
  }
}

function formatDateTime(dateStr: string | number) {
  try {
    return format(new Date(dateStr), 'yyyy-MM-dd HH:mm:ss')
  } catch {
    return String(dateStr)
  }
}

onMounted(() => {
  void fetchCheckInKeyword()
  void loadCheckInRanking()
})
</script>

<template>
  <TooltipProvider>
    <Card class="ranking-card shadow-xs space-y-4">
      <CardHeader class="pb-3 border-b border-border/60">
        <div class="ranking-title flex items-center justify-between">
          <div class="flex items-center gap-2">
            <component :is="Trophy24Filled" class="size-5 text-amber-500" />
            <CardTitle class="text-base font-semibold">签到排行榜</CardTitle>
          </div>
          <span
            v-if="rankingData.length"
            class="ranking-count text-xs text-muted-foreground font-mono"
          >
            {{ filteredRankingData.length }} 人
          </span>
        </div>
      </CardHeader>

      <CardContent class="space-y-4 text-xs">
        <div class="filter-bar flex flex-wrap items-center gap-2">
          <Select v-model="timeRange">
            <SelectTrigger class="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in timeRangeOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div class="relative flex-1 min-w-36">
            <component :is="Search24Regular" class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input v-model="userFilter" placeholder="搜索用户" class="pl-8 w-full" />
          </div>

          <Button class="flex items-center gap-1" :disabled="isLoading" @click="loadCheckInRanking">
            <component :is="ArrowClockwise24Regular" class="size-3.5" :class="{ 'animate-spin': isLoading }" />
            刷新
          </Button>
        </div>

        <div v-if="isLoading" class="py-16 flex justify-center">
          <Spin />
        </div>

        <Empty
          v-else-if="rankingData.length === 0"
          class="empty-data py-10"
          description="暂无签到数据"
        />
        <Empty
          v-else-if="filteredRankingData.length === 0"
          class="empty-data py-10"
          description="没有符合条件的用户"
        />

        <div
          v-else
          class="ranking-table space-y-2"
          role="table"
          aria-label="签到排行榜"
        >
          <div
            class="ranking-header ranking-grid py-2 px-3 text-muted-foreground font-medium text-[11px] border-b border-border/60"
            role="row"
          >
            <span>排名</span>
            <span>用户</span>
            <span>连续签到</span>
            <span>本月签到</span>
            <span>总签到</span>
            <span>最近签到</span>
          </div>

          <TransitionGroup
            name="ranking-row"
            tag="div"
            class="ranking-body space-y-1"
          >
            <div
              v-for="(item, index) in pagedData"
              :key="item.ouId"
              class="ranking-row ranking-grid py-2 px-3 rounded-lg hover:bg-muted/40 transition items-center"
              :class="{ 'bg-amber-500/5 font-medium': item.rank <= 3 }"
              :style="{ '--row-index': index }"
              role="row"
            >
              <div class="rank-cell">
                <span
                  class="rank-number inline-flex items-center justify-center size-5 rounded-full text-xs font-mono font-bold"
                  :class="{
                    'bg-amber-500 text-white': item.rank === 1,
                    'bg-slate-400 text-white': item.rank === 2,
                    'bg-amber-700 text-white': item.rank === 3,
                    'text-muted-foreground': item.rank > 3,
                  }"
                >
                  {{ item.rank }}
                </span>
              </div>

              <div class="user-cell flex items-center gap-1.5 truncate">
                <strong class="user-name text-foreground truncate">{{ item.name }}</strong>
                <Badge
                  v-if="item.isAuthed"
                  variant="secondary"
                  class="text-[10px] h-4 px-1 bg-emerald-500/10 text-emerald-600 font-normal shrink-0"
                >
                  已认证
                </Badge>
              </div>

              <div class="metric-cell streak-cell flex items-baseline gap-0.5">
                <strong class="text-primary font-mono">{{ item.consecutiveDays }}</strong>
                <span class="metric-unit text-[10px] text-muted-foreground">天</span>
              </div>
              <div class="metric-cell monthly-cell flex items-baseline gap-0.5">
                <strong class="font-mono text-foreground">{{ item.monthlyCheckInCount ?? 0 }}</strong>
                <span class="metric-unit text-[10px] text-muted-foreground">次</span>
              </div>
              <div class="metric-cell total-cell flex items-baseline gap-0.5">
                <strong class="font-mono text-foreground">{{ item.totalCheckInCount ?? 0 }}</strong>
                <span class="metric-unit text-[10px] text-muted-foreground">次</span>
              </div>
              <div class="time-cell text-muted-foreground">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <span class="cursor-help hover:text-foreground">
                      {{ formatRelativeTime(item.lastCheckInTime) }}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    {{ formatDateTime(item.lastCheckInTime) }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TransitionGroup>

          <div class="ranking-footer flex items-center justify-between pt-3 border-t border-border/50">
            <Pagination
              :total="filteredRankingData.length"
              :items-per-page="pagination.pageSize"
              :page="pagination.page"
              @update:page="pagination.page = $event"
            />
            <Select
              :model-value="String(pagination.pageSize)"
              @update:model-value="pagination.pageSize = Number($event)"
            >
              <SelectTrigger class="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in pageSizeOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Alert class="ranking-info bg-muted/40 border-border/80">
          <component :is="Info24Filled" class="size-4 text-primary" />
          <AlertDescription class="text-xs text-muted-foreground ml-2">
            签到可获得积分，连续签到有额外奖励。发送“{{ checkInKeyword }}”即可参与签到。
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  </TooltipProvider>
</template>

<style scoped>
.ranking-grid {
  display: grid;
  grid-template-columns: 48px 1.5fr 1fr 1fr 1fr 1.2fr;
  gap: 8px;
  align-items: center;
}

@media (max-width: 640px) {
  .ranking-grid {
    grid-template-columns: 36px 1.5fr 1fr 1fr;
  }
  .monthly-cell,
  .time-cell {
    display: none;
  }
}
</style>
