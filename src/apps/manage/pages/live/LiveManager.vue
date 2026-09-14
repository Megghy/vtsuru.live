<script setup lang="ts">
import {
  ArrowSync24Filled,
  ArrowTrendingLines24Regular,
  Chat24Regular,
  Clock24Regular,
  DataTrending24Regular,
  Money24Regular,
  Open24Regular,
  Search24Filled,
  Video24Regular,
} from '@vicons/fluent'
import { useSessionStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NDivider,
  NEmpty,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NPagination,
  NRadioGroup,
  NRadioButton,
  NSelect,
  NSkeleton,
  NSwitch,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { ResponseLiveInfoModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { LIVE_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'

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
    const data = await QueryGetAPI<ResponseLiveInfoModel[]>(`${LIVE_API_URL}get-all`)
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
  // @ts-ignore
  refreshTimer = window.setInterval(() => {
    getAll()
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
  if (verified) getAll()
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
  <div class="live-manager-view">
    <ManagePageHeader
      title="直播记录"
      subtitle="汇总历史直播场次，提供单场弹幕明细、打赏排行与语音转写切片复盘"
      :loading="isLoading"
    >
      <template #action>
        <NButton
          size="small"
          secondary
          @click="router.push({ name: 'manage-analyze' })"
        >
          <template #icon>
            <NIcon :component="DataTrending24Regular" />
          </template>
          深度看板
        </NButton>
        <NButton
          size="small"
          secondary
          :disabled="isLoading"
          @click="resetFilters"
        >
          重置筛选
        </NButton>
        <NButton
          size="small"
          type="primary"
          :loading="isLoading"
          @click="getAll"
        >
          <template #icon>
            <NIcon :component="ArrowSync24Filled" />
          </template>
          刷新
        </NButton>
      </template>

      <div class="live-manager-alerts">
        <EventFetcherAlert />
        <EventFetcherStatusCard />

        <NAlert
          v-if="!isVerified"
          type="info"
          title="未认证"
          :bordered="false"
        >
          尚未进行 Bilibili 认证，请先在认证中心完成账号绑定。
        </NAlert>

        <NAlert
          v-else-if="loadError"
          type="error"
          title="加载失败"
          :bordered="false"
        >
          <div>{{ loadError }}</div>
          <div style="margin-top: 8px">
            <NButton
              size="small"
              secondary
              :loading="isLoading"
              @click="getAll"
            >
              重试
            </NButton>
          </div>
        </NAlert>
      </div>
    </ManagePageHeader>

    <template v-if="isVerified">
      <!-- Bento 概览看板 -->
      <NGrid
        :cols="4"
        :x-gap="12"
        :y-gap="12"
        responsive="screen"
        class="overview-grid"
      >
        <NGridItem :span="1">
          <NCard
            size="small"
            class="stat-card"
            :bordered="true"
          >
            <div class="stat-card-inner">
              <div class="stat-card-header">
                <span class="stat-title">总直播场次</span>
                <NIcon
                  :component="Video24Regular"
                  class="stat-icon"
                />
              </div>
              <div class="stat-main">
                <span class="stat-number">{{ overviewStats.totalCount }}</span>
                <span class="stat-unit">场</span>
              </div>
              <div class="stat-footer">
                <NTag
                  v-if="overviewStats.livingCount > 0"
                  size="small"
                  type="error"
                  :bordered="false"
                >
                  ● {{ overviewStats.livingCount }} 场直播中
                </NTag>
                <span
                  v-else
                  class="stat-hint"
                >
                  当前未开播
                </span>
              </div>
            </div>
          </NCard>
        </NGridItem>

        <NGridItem :span="1">
          <NCard
            size="small"
            class="stat-card"
            :bordered="true"
          >
            <div class="stat-card-inner">
              <div class="stat-card-header">
                <span class="stat-title">累计直播时长</span>
                <NIcon
                  :component="Clock24Regular"
                  class="stat-icon"
                />
              </div>
              <div class="stat-main">
                <span class="stat-number">{{ overviewStats.totalHours }}</span>
                <span class="stat-unit">小时</span>
              </div>
              <div class="stat-footer">
                <span class="stat-hint">历史累计时长统计</span>
              </div>
            </div>
          </NCard>
        </NGridItem>

        <NGridItem :span="1">
          <NCard
            size="small"
            class="stat-card"
            :bordered="true"
          >
            <div class="stat-card-inner">
              <div class="stat-card-header">
                <span class="stat-title">累计互动弹幕</span>
                <NIcon
                  :component="Chat24Regular"
                  class="stat-icon"
                />
              </div>
              <div class="stat-main">
                <span class="stat-number">{{ overviewStats.totalDanmakus.toLocaleString() }}</span>
                <span class="stat-unit">条</span>
              </div>
              <div class="stat-footer">
                <span class="stat-hint">弹幕与观众发言总量</span>
              </div>
            </div>
          </NCard>
        </NGridItem>

        <NGridItem :span="1">
          <NCard
            size="small"
            class="stat-card"
            :bordered="true"
          >
            <div class="stat-card-inner">
              <div class="stat-card-header">
                <span class="stat-title">累计打赏收益</span>
                <NIcon
                  :component="Money24Regular"
                  class="stat-icon income-icon"
                />
              </div>
              <div class="stat-main">
                <span class="stat-unit currency">¥</span>
                <span class="stat-number income-number">{{ Number(overviewStats.totalIncome).toLocaleString() }}</span>
              </div>
              <div class="stat-footer">
                <span class="stat-hint">礼物 / SC / 舰长打赏总额</span>
              </div>
            </div>
          </NCard>
        </NGridItem>
      </NGrid>

      <!-- 筛选与控制工具条 -->
      <NCard
        class="toolbar-card"
        size="small"
        :bordered="true"
      >
        <NFlex
          justify="space-between"
          align="center"
          wrap
          :size="12"
        >
          <!-- 左侧：搜索与状态过滤 -->
          <NFlex
            align="center"
            wrap
            :size="10"
          >
            <NInput
              v-model:value="keyword"
              placeholder="搜索标题或场次 ID..."
              clearable
              class="search-input"
            >
              <template #prefix>
                <NIcon :component="Search24Filled" />
              </template>
            </NInput>

            <NRadioGroup
              v-model:value="statusFilter"
              size="small"
            >
              <NRadioButton value="all">全部状态</NRadioButton>
              <NRadioButton value="live">直播中</NRadioButton>
              <NRadioButton value="finished">已结束</NRadioButton>
            </NRadioGroup>
          </NFlex>

          <!-- 右侧：排序与自动刷新 -->
          <NFlex
            align="center"
            wrap
            :size="10"
          >
            <span class="toolbar-label">排序</span>
            <NSelect
              v-model:value="sortKey"
              size="small"
              :options="[
                { label: '开播时间', value: 'startAt' },
                { label: '弹幕总量', value: 'danmakusCount' },
                { label: '互动人次', value: 'interactionCount' },
                { label: '打赏收益', value: 'totalIncome' },
              ]"
              class="sort-select"
            />
            <NSelect
              v-model:value="sortOrder"
              size="small"
              :options="[
                { label: '降序 (高→低)', value: 'desc' },
                { label: '升序 (低→高)', value: 'asc' },
              ]"
              class="order-select"
            />

            <NDivider vertical />

            <NFlex
              align="center"
              :size="8"
            >
              <span class="toolbar-label">自动刷新</span>
              <NSwitch
                v-model:value="enableAutoRefresh"
                size="small"
              />
              <NInputNumber
                v-if="enableAutoRefresh"
                v-model:value="refreshSeconds"
                size="small"
                class="refresh-seconds"
                :min="10"
                :max="300"
              >
                <template #suffix>s</template>
              </NInputNumber>
            </NFlex>
          </NFlex>
        </NFlex>

        <div class="toolbar-footer">
          <NText depth="3" class="result-count">
            共找到 <strong class="highlight-count">{{ totalFilteredCount }}</strong> 条直播场次
          </NText>
        </div>
      </NCard>

      <!-- 列表加载态骨架屏 -->
      <div
        v-if="isLoading && !lives.length"
        class="skeleton-container"
      >
        <NCard
          v-for="i in 4"
          :key="i"
          size="small"
          class="skeleton-card"
        >
          <NSkeleton height="80px" />
        </NCard>
      </div>

      <!-- 列表内容区 -->
      <template v-else>
        <NCard
          v-if="!filteredAndSortedLives.length"
          class="empty-card"
          size="small"
          :bordered="true"
        >
          <NEmpty description="未找到符合条件的直播记录">
            <template #extra>
              <NButton
                type="primary"
                secondary
                @click="resetFilters"
              >
                清空筛选条件
              </NButton>
            </template>
          </NEmpty>
        </NCard>

        <div
          v-else
          class="live-list"
        >
          <NCard
            v-for="item in pagedLives"
            :key="item.liveId"
            size="small"
            class="live-item-card"
            :bordered="true"
            hoverable
          >
            <LiveInfoContainer :live="item" />
          </NCard>
        </div>

        <!-- 分页控制器 -->
        <div
          v-if="totalFilteredCount > 0"
          class="pagination-wrapper"
        >
          <NPagination
            v-model:page="page"
            v-model:page-size="pageSize"
            :item-count="totalFilteredCount"
            :page-sizes="[10, 20, 50]"
            show-size-picker
            show-quick-jumper
          />
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.live-manager-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.live-manager-alerts {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}

/* Bento 概览看板 */
.overview-grid {
  margin-bottom: 4px;
}

.stat-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
  border: 1px solid var(--vtsuru-border);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.stat-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-card-inner {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-title {
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
  font-weight: 500;
}

.stat-icon {
  font-size: 18px;
  color: var(--vtsuru-fg-muted);
}

.income-icon {
  color: #10b981;
}

.stat-main {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.stat-number {
  font-size: 24px;
  font-weight: 700;
  color: var(--vtsuru-fg);
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.income-number {
  color: #10b981;
}

.stat-unit {
  font-size: 13px;
  color: var(--vtsuru-fg-muted);
}

.stat-unit.currency {
  font-weight: 600;
  font-size: 16px;
  color: #10b981;
}

.stat-footer {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  min-height: 20px;
  display: flex;
  align-items: center;
}

.stat-hint {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

/* 筛选工具栏 */
.toolbar-card {
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-card);
}

.search-input {
  width: 240px;
}

.toolbar-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  white-space: nowrap;
}

.sort-select {
  width: 120px;
}

.order-select {
  width: 120px;
}

.refresh-seconds {
  width: 72px;
}

.toolbar-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--vtsuru-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.result-count {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.highlight-count {
  color: var(--vtsuru-fg);
  font-weight: 600;
}

/* 列表区 */
.live-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-item-card {
  border-radius: var(--vtsuru-radius);
  border: 1px solid var(--vtsuru-border);
  transition: all 0.2s ease;
}

.live-item-card:hover {
  border-color: var(--vtsuru-brand);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.skeleton-card {
  border-radius: var(--vtsuru-radius);
}

.empty-card {
  border-radius: var(--vtsuru-radius);
  padding: 32px 0;
}

.pagination-wrapper {
  display: flex;
  justify-content: flex-end;
  padding: 12px 0 24px;
}

@media (max-width: 992px) {
  .overview-grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}

@media (max-width: 600px) {
  .overview-grid {
    grid-template-columns: 1fr !important;
  }
  .search-input {
    width: 100%;
  }
}
</style>
