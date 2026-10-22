<script setup lang="ts">
import {
  ArrowSync24Filled,
  Chat24Regular,
  Clock24Regular,
  DataTrending24Regular,
  Money24Regular,
  Search24Filled,
  Video24Regular,
} from '@vicons/fluent'
import { useSessionStorage } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ResponseLiveInfoModel } from '@/api/api-models'
import { getApiLiveGetAll } from '@/api/generated/live/live'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'

defineOptions({ name: 'ManageLiveView' })

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

// 核心数据状态
const lives = ref<ResponseLiveInfoModel[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

// 分页与筛选
const page = useSessionStorage<number>('ManageLive.page', 1)
const pageSize = usePersistedStorage<number>('ManageLive.pageSize', 10)
const keyword = usePersistedStorage<string>('ManageLive.keyword', '')
const statusFilter = usePersistedStorage<'all' | 'live' | 'finished'>('ManageLive.status', 'all')
const sortKey = usePersistedStorage<'startAt' | 'danmakusCount' | 'totalIncome' | 'interactionCount'>(
  'ManageLive.sort',
  'startAt',
)
const sortOrder = usePersistedStorage<'desc' | 'asc'>('ManageLive.order', 'desc')

// 自动刷新
const enableAutoRefresh = usePersistedStorage<boolean>('ManageLive.autoRefresh', false)
const refreshSeconds = usePersistedStorage<number>('ManageLive.refreshSeconds', 60)
let refreshTimer: number | undefined

const isVerified = computed(() => accountInfo.value?.isBiliVerified === true)

// 宏观概览统计
const overviewStats = computed(() => {
  const list = lives.value
  const totalCount = list.length
  let livingCount = 0
  let totalMinutes = 0
  let totalDanmakus = 0
  let totalIncome = 0

  for (const item of list) {
    if (!item.isFinish) livingCount++
    const start = Number(item.startAt) || 0
    const end = item.isFinish ? Number(item.stopAt) || start : Date.now()
    if (start > 0 && end >= start) {
      totalMinutes += Math.floor((end - start) / 60000)
    }
    totalDanmakus += item.danmakusCount || 0
    totalIncome += item.totalIncome || 0
  }

  const totalHours = (totalMinutes / 60).toFixed(1)

  return {
    totalCount,
    livingCount,
    totalHours,
    totalDanmakus,
    totalIncome: totalIncome.toFixed(1),
  }
})

// 筛选与排序
const filteredAndSortedLives = computed(() => {
  let arr = lives.value.filter((l) =>
    statusFilter.value === 'all' ? true : statusFilter.value === 'live' ? !l.isFinish : l.isFinish,
  )

  if (keyword.value && keyword.value.trim() !== '') {
    const k = keyword.value.trim().toLowerCase()
    arr = arr.filter((l) => l.title.toLowerCase().includes(k) || l.liveId.toLowerCase().includes(k))
  }

  arr = arr.slice().toSorted((a, b) => {
    const k = sortKey.value
    const av = (a as any)[k] ?? 0
    const bv = (b as any)[k] ?? 0
    const diff = av > bv ? 1 : av < bv ? -1 : 0
    return sortOrder.value === 'asc' ? diff : -diff
  })

  return arr
})

const totalFilteredCount = computed(() => filteredAndSortedLives.value.length)

const totalPages = computed(() => {
  const size = pageSize.value || 10
  return Math.max(1, Math.ceil(totalFilteredCount.value / size))
})

const pagedLives = computed(() => {
  const size = pageSize.value || 10
  const start = Math.max(0, (page.value - 1) * size)
  const end = start + size
  return filteredAndSortedLives.value.slice(start, end)
})

watch([lives, pageSize], () => {
  const total = filteredAndSortedLives.value.length
  const size = pageSize.value || 10
  const maxPage = Math.max(1, Math.ceil(total / size))
  if (page.value > maxPage) page.value = maxPage
})

async function getAll() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = (await getApiLiveGetAll()) as unknown as {
      code: number
      message?: string
      data: ResponseLiveInfoModel[]
    }
    if (data.code === 200) {
      lives.value = data.data
    } else {
      message.error(`无法获取数据: ${data.message}`)
      loadError.value = data.message
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '无法获取数据'
    message.error(msg)
    loadError.value = msg
  } finally {
    isLoading.value = false
  }
}

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  sortKey.value = 'startAt'
  sortOrder.value = 'desc'
  page.value = 1
}

function applyQueryToState() {
  const q = route.query
  if (q.page) page.value = Number(q.page) || 1
  if (q.pageSize) pageSize.value = Number(q.pageSize) || 10
  if (q.q) keyword.value = String(q.q)
  if (q.status && (['all', 'live', 'finished'] as const).includes(q.status as any)) statusFilter.value = q.status as any
  if (q.sort && (['startAt', 'danmakusCount', 'totalIncome', 'interactionCount'] as const).includes(q.sort as any))
    sortKey.value = q.sort as any
  if (q.order && (['asc', 'desc'] as const).includes(q.order as any)) sortOrder.value = q.order as any
}

function syncStateToQuery() {
  router
    .replace({
      query: {
        ...route.query,
        page: String(page.value),
        pageSize: String(pageSize.value),
        q: keyword.value || undefined,
        status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
        sort: sortKey.value !== 'startAt' ? sortKey.value : undefined,
        order: sortOrder.value !== 'desc' ? sortOrder.value : undefined,
      },
    })
    .catch(() => {})
}

watch([page, pageSize, keyword, statusFilter, sortKey, sortOrder], syncStateToQuery)

function setupAutoRefresh() {
  clearAutoRefresh()
  if (!isVerified.value || !enableAutoRefresh.value) return
  const sec = Math.max(10, Number(refreshSeconds.value) || 60)
  refreshTimer = window.setInterval(() => {
    void getAll()
  }, sec * 1000)
}

function clearAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = undefined
  }
}

watch([enableAutoRefresh, refreshSeconds], setupAutoRefresh)
watch(isVerified, (verified) => {
  if (verified) void getAll()
  setupAutoRefresh()
})

onMounted(async () => {
  applyQueryToState()
  if (isVerified.value) await getAll()
  setupAutoRefresh()
})

onBeforeUnmount(() => {
  clearAutoRefresh()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="直播记录"
      subtitle="汇总历史直播场次，提供单场弹幕明细、打赏排行与语音转写切片复盘"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            size="xs"
            variant="outline"
            @click="router.push({ name: 'manage-analyze' })"
          >
            <component
              :is="DataTrending24Regular"
              class="h-3.5 w-3.5 mr-1 text-brand"
            />
            深度看板
          </Button>

          <Button
            size="xs"
            variant="ghost"
            :disabled="isLoading"
            @click="resetFilters"
          >
            重置筛选
          </Button>

          <Button
            size="xs"
            variant="brand"
            :loading="isLoading"
            @click="getAll"
          >
            <component
              :is="ArrowSync24Filled"
              class="h-3.5 w-3.5 mr-1"
            />
            刷新
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <div class="space-y-3">
      <EventFetcherAlert />
      <EventFetcherStatusCard />

      <Alert
        v-if="!isVerified"
        variant="default"
      >
        <AlertTitle>未认证</AlertTitle>
        <AlertDescription class="text-xs"> 尚未进行 Bilibili 认证，请先在认证中心完成账号绑定。 </AlertDescription>
      </Alert>

      <Alert
        v-else-if="loadError"
        variant="destructive"
      >
        <AlertTitle>加载失败</AlertTitle>
        <AlertDescription class="text-xs flex items-center justify-between gap-2">
          <span>{{ loadError }}</span>
          <Button
            size="xs"
            variant="outline"
            :loading="isLoading"
            @click="getAll"
          >
            重试
          </Button>
        </AlertDescription>
      </Alert>
    </div>

    <template v-if="isVerified">
      <!-- 4 宫格 Bento 概览看板 -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card class="p-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>总直播场次</span>
            <component
              :is="Video24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-2xl font-bold font-mono text-foreground">{{ overviewStats.totalCount }}</span>
            <span class="text-xs text-muted-foreground">场</span>
          </div>
          <div class="mt-2 text-[11px]">
            <Badge
              v-if="overviewStats.livingCount > 0"
              variant="destructive"
              class="text-[9px] px-1 py-0 h-4"
            >
              ● {{ overviewStats.livingCount }} 场直播中
            </Badge>
            <span
              v-else
              class="text-muted-foreground"
              >当前未开播</span
            >
          </div>
        </Card>

        <Card class="p-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>累计直播时长</span>
            <component
              :is="Clock24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-2xl font-bold font-mono text-foreground">{{ overviewStats.totalHours }}</span>
            <span class="text-xs text-muted-foreground">小时</span>
          </div>
          <div class="mt-2 text-[11px] text-muted-foreground">历史开播累计时长</div>
        </Card>

        <Card class="p-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>累计互动弹幕</span>
            <component
              :is="Chat24Regular"
              class="h-3.5 w-3.5"
            />
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-2xl font-bold font-mono text-foreground">{{
              overviewStats.totalDanmakus.toLocaleString()
            }}</span>
            <span class="text-xs text-muted-foreground">条</span>
          </div>
          <div class="mt-2 text-[11px] text-muted-foreground">弹幕与观众发言总量</div>
        </Card>

        <Card class="p-3">
          <div class="flex items-center justify-between text-xs text-muted-foreground">
            <span>累计打赏收益</span>
            <component
              :is="Money24Regular"
              class="h-3.5 w-3.5 text-amber-500"
            />
          </div>
          <div class="mt-1 flex items-baseline gap-1">
            <span class="text-xs text-amber-500 font-bold">¥</span>
            <span class="text-2xl font-bold font-mono text-amber-500">{{
              Number(overviewStats.totalIncome).toLocaleString()
            }}</span>
          </div>
          <div class="mt-2 text-[11px] text-muted-foreground">礼物 / SC / 舰长打赏</div>
        </Card>
      </div>

      <!-- 筛选与控制工具条 -->
      <Card class="p-3 space-y-2.5">
        <div class="flex items-center justify-between flex-wrap gap-2.5">
          <!-- 左侧：搜索与状态过滤 -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative w-56">
              <component
                :is="Search24Filled"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
              />
              <Input
                v-model="keyword"
                placeholder="搜索标题或场次 ID..."
                class="pl-8"
              />
            </div>

            <ToggleGroup
              v-model="statusFilter"
              type="single"
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="live">直播中</ToggleGroupItem>
              <ToggleGroupItem value="finished">已结束</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <!-- 右侧：排序与自动刷新 -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>排序</span>
              <div class="w-28">
                <Select
                  v-model="sortKey"
                  default-value="startAt"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="startAt"> 开播时间 </SelectItem>
                    <SelectItem value="danmakusCount"> 弹幕总量 </SelectItem>
                    <SelectItem value="interactionCount"> 互动人次 </SelectItem>
                    <SelectItem value="totalIncome"> 打赏收益 </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="w-28">
                <Select
                  v-model="sortOrder"
                  default-value="desc"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="desc"> 降序 (高→低) </SelectItem>
                    <SelectItem value="asc"> 升序 (低→高) </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div class="h-4 w-[1px] bg-border mx-1" />

            <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>自动刷新</span>
              <Switch
                :checked="enableAutoRefresh"
                @update:checked="(val) => (enableAutoRefresh = val)"
              />
              <Input
                v-if="enableAutoRefresh"
                v-model.number="refreshSeconds"
                type="number"
                min="10"
                max="300"
                class="w-16"
              />
            </div>
          </div>
        </div>

        <div class="text-[11px] text-muted-foreground pt-1 border-t border-border">
          共找到 <strong class="text-foreground font-mono">{{ totalFilteredCount }}</strong> 条直播场次
        </div>
      </Card>

      <!-- 骨架屏 -->
      <div
        v-if="isLoading && !lives.length"
        class="space-y-3"
      >
        <Skeleton
          v-for="i in 4"
          :key="i"
          class="h-24 rounded-lg"
        />
      </div>

      <!-- 列表内容区 -->
      <template v-else>
        <Card
          v-if="!filteredAndSortedLives.length"
          class="p-12 text-center"
        >
          <div class="text-muted-foreground text-sm">未找到符合条件的直播记录</div>
          <div class="mt-3">
            <Button
              size="xs"
              variant="outline"
              @click="resetFilters"
            >
              清空筛选条件
            </Button>
          </div>
        </Card>

        <div
          v-else
          class="space-y-2.5"
        >
          <LiveInfoContainer
            v-for="item in pagedLives"
            :key="item.liveId"
            :live="item"
          />
        </div>

        <!-- 分页控制器 -->
        <div
          v-if="totalFilteredCount > 0"
          class="flex items-center justify-between text-xs text-muted-foreground pt-3"
        >
          <div class="flex items-center gap-2">
            <span>共 {{ totalFilteredCount }} 条</span>
            <div class="w-24">
              <Select
                :model-value="String(pageSize)"
                @update:model-value="(val) => (pageSize = Number(val))"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10"> 10 条/页 </SelectItem>
                  <SelectItem value="20"> 20 条/页 </SelectItem>
                  <SelectItem value="50"> 50 条/页 </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <Button
              size="xs"
              variant="outline"
              :disabled="page <= 1"
              @click="page--"
            >
              上一页
            </Button>
            <span class="px-2 font-mono">{{ page }} / {{ totalPages }}</span>
            <Button
              size="xs"
              variant="outline"
              :disabled="page >= totalPages"
              @click="page++"
            >
              下一页
            </Button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
