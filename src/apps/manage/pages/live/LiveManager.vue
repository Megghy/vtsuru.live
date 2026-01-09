<script setup lang="ts">
import type { ResponseLiveInfoModel } from '@/api/api-models'
import {
  ArrowSync24Filled,
  Search24Filled
} from '@vicons/fluent'
import { NAlert, NButton, NCard, NDivider, NEmpty, NFlex, NIcon, NInput, NInputNumber, NPagination, NSelect, NSkeleton, NSwitch, NText, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLocalStorage, useSessionStorage, useStorage } from '@vueuse/core'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/apps/manage/components/live/LiveInfoContainer.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { LIVE_API_URL } from '@/shared/config'

defineOptions({ name: 'ManageLiveView' })

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

// state
const lives = ref<ResponseLiveInfoModel[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

// pagination & query sync
const page = useSessionStorage<number>('ManageLive.page', 1)
const pageSize = useStorage<number>('ManageLive.pageSize', 10)

// search / filter / sort
const keyword = useLocalStorage<string>('ManageLive.keyword', '')
const statusFilter = useLocalStorage<'all' | 'live' | 'finished'>('ManageLive.status', 'all')
const sortKey = useLocalStorage<'startAt' | 'danmakusCount' | 'totalIncome' | 'interactionCount'>('ManageLive.sort', 'startAt')
const sortOrder = useLocalStorage<'desc' | 'asc'>('ManageLive.order', 'desc')

// refresh
const enableAutoRefresh = useLocalStorage<boolean>('ManageLive.autoRefresh', false)
const refreshSeconds = useLocalStorage<number>('ManageLive.refreshSeconds', 60)
let refreshTimer: number | undefined

watch([lives, pageSize], () => {
  const total = filteredAndSortedLives.value.length
  const size = pageSize.value || 10
  const maxPage = Math.max(1, Math.ceil(total / size))
  if (page.value > maxPage) page.value = maxPage
})

const isVerified = computed(() => accountInfo.value?.isBiliVerified === true)
const totalCount = computed(() => filteredAndSortedLives.value.length)

const filteredAndSortedLives = computed(() => {
  // filter by status
  let arr = lives.value.filter(l =>
    statusFilter.value === 'all'
      ? true
      : statusFilter.value === 'live'
        ? !l.isFinish
        : l.isFinish,
  )
  // search by title or id
  if (keyword.value && keyword.value.trim() !== '') {
    const k = keyword.value.trim().toLowerCase()
    arr = arr.filter(l => l.title.toLowerCase().includes(k) || l.liveId.toLowerCase().includes(k))
  }
  // sort
  arr = arr.slice().sort((a, b) => {
    const k = sortKey.value
    const av = (a as any)[k] ?? 0
    const bv = (b as any)[k] ?? 0
    const diff = av > bv ? 1 : av < bv ? -1 : 0
    return sortOrder.value === 'asc' ? diff : -diff
  })
  return arr
})

const pagedLives = computed(() => {
  const size = pageSize.value || 10
  const start = Math.max(0, (page.value - 1) * size)
  const end = start + size
  return filteredAndSortedLives.value.slice(start, end)
})

async function getAll() {
  isLoading.value = true
  loadError.value = null
  try {
    const data = await QueryGetAPI<ResponseLiveInfoModel[]>(`${LIVE_API_URL}get-all`)
    if (data.code == 200) {
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

function OnClickCover(live: ResponseLiveInfoModel) {
  router.push({
    name: 'manage-liveDetail',
    params: { id: live.liveId },
  })
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
  if (q.status && (['all', 'live', 'finished'] as const).includes(q.status as any))
    statusFilter.value = q.status as any
  if (q.sort && (['startAt', 'danmakusCount', 'totalIncome', 'interactionCount'] as const).includes(q.sort as any))
    sortKey.value = q.sort as any
  if (q.order && (['asc', 'desc'] as const).includes(q.order as any)) sortOrder.value = q.order as any
}

function syncStateToQuery() {
  router.replace({
    query: {
      ...route.query,
      page: String(page.value),
      pageSize: String(pageSize.value),
      q: keyword.value || undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
      sort: sortKey.value !== 'startAt' ? sortKey.value : undefined,
      order: sortOrder.value !== 'desc' ? sortOrder.value : undefined,
    },
  }).catch(() => { })
}

watch([page, pageSize, keyword, statusFilter, sortKey, sortOrder], syncStateToQuery)

function setupAutoRefresh() {
  clearAutoRefresh()
  if (!isVerified.value) return
  if (!enableAutoRefresh.value) return
  const sec = Math.max(10, Number(refreshSeconds.value) || 60)
  // @ts-ignore - setInterval returns number in browser
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
      title="直播管理"
      subtitle="支持搜索、筛选、排序与自动刷新"
      :loading="isLoading"
    >
      <template #action>
        <NButton size="small" secondary :disabled="isLoading" @click="resetFilters">
          重置筛选
        </NButton>
        <NButton size="small" type="primary" :loading="isLoading" @click="getAll">
          <template #icon>
            <NIcon :component="ArrowSync24Filled" />
          </template>
          刷新
        </NButton>
      </template>

      <div class="header-stack">
        <EventFetcherAlert />
        <EventFetcherStatusCard />

        <NAlert v-if="!isVerified" type="info" title="未认证" :bordered="false">
          尚未进行 Bilibili 认证，部分功能可能受限。
        </NAlert>

        <NAlert v-else-if="loadError" type="error" title="加载失败" :bordered="false">
          {{ loadError }}
          <template #action>
            <NButton size="small" secondary :loading="isLoading" @click="getAll">
              重试
            </NButton>
          </template>
        </NAlert>
      </div>
    </ManagePageHeader>

    <template v-if="isVerified">
      <NCard class="toolbar-card" size="small" :bordered="true" content-style="padding: 12px;">
        <NFlex justify="space-between" align="center" wrap :size="12">
          <NFlex align="center" wrap :size="10">
            <NInput v-model:value="keyword" placeholder="搜索标题或ID" clearable class="search-input">
              <template #prefix>
                <NIcon :component="Search24Filled" />
              </template>
            </NInput>

            <NSelect
              v-model:value="statusFilter"
              :options="[
                { label: '全部状态', value: 'all' },
                { label: '直播中', value: 'live' },
                { label: '已结束', value: 'finished' },
              ]"
              class="status-select"
            />
          </NFlex>

          <NFlex align="center" wrap :size="10">
            <span class="toolbar-label">排序</span>
            <NSelect
              v-model:value="sortKey"
              size="small"
              :options="[
                { label: '开始时间', value: 'startAt' },
                { label: '弹幕数', value: 'danmakusCount' },
                { label: '互动数', value: 'interactionCount' },
                { label: '收益', value: 'totalIncome' },
              ]"
              class="sort-select"
            />
            <NSelect
              v-model:value="sortOrder"
              size="small"
              :options="[
                { label: '降序', value: 'desc' },
                { label: '升序', value: 'asc' },
              ]"
              class="order-select"
            />

            <NDivider vertical />

            <NFlex align="center" wrap :size="8">
              <NSwitch v-model:value="enableAutoRefresh" size="small">
                <template #checked>
                  自动刷新
                </template>
                <template #unchecked>
                  自动刷新
                </template>
              </NSwitch>
              <NInputNumber
                v-if="enableAutoRefresh"
                v-model:value="refreshSeconds"
                size="small"
                class="refresh-seconds"
                :min="10"
                placeholder="秒"
              >
                <template #suffix>
                  s
                </template>
              </NInputNumber>
            </NFlex>
          </NFlex>
        </NFlex>

        <NDivider style="margin: 12px 0 0;" />
        <NFlex justify="space-between" align="center" wrap :size="12" style="margin-top: 10px;">
          <NText depth="3" class="result-meta">
            共 {{ totalCount }} 条记录
          </NText>
        </NFlex>
      </NCard>

      <NSkeleton v-if="isLoading && !lives.length" class="skeleton" text :repeat="6" />
      <template v-else>
        <NCard v-if="!filteredAndSortedLives.length" class="empty-card" size="small" :bordered="true">
          <NEmpty description="没有找到符合条件的直播记录">
            <template #extra>
              <NButton type="primary" :loading="isLoading" @click="getAll">
                重新加载
              </NButton>
            </template>
          </NEmpty>
        </NCard>

        <div v-else class="live-stack">
          <div
            v-for="live in pagedLives"
            :key="live.liveId"
            class="live-row"
            role="button"
            tabindex="0"
            @click="OnClickCover(live)"
            @keydown.enter.prevent="OnClickCover(live)"
            @keydown.space.prevent="OnClickCover(live)"
          >
            <LiveInfoContainer :live="live" />
          </div>

          <div class="pagination">
            <NPagination
              v-model:page="page"
              v-model:page-size="pageSize"
              show-quick-jumper
              show-size-picker
              :page-sizes="[10, 20, 30, 40]"
              :item-count="filteredAndSortedLives.length"
            />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.live-manager-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px 16px 48px;
}

.header-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.toolbar-card {
  margin-top: 12px;
}

.search-input {
  width: 280px;
}

.status-select {
  width: 140px;
}

.sort-select {
  width: 120px;
}

.order-select {
  width: 90px;
}

.refresh-seconds {
  width: 86px;
}

.toolbar-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--n-text-color-3);
}

.result-meta {
  font-size: 12px;
}

.skeleton {
  margin-top: 12px;
}

.empty-card {
  margin-top: 12px;
}

.live-stack {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-row {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-card-color);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.live-row:hover {
  background-color: var(--n-color-embedded);
}

.live-row:focus-visible {
  outline: none;
  border-color: rgba(var(--n-primary-color-rgb), 0.35);
  box-shadow: 0 0 0 2px rgba(var(--n-primary-color-rgb), 0.18);
}

.pagination {
  margin-top: 8px;
  padding-top: 10px;
  display: flex;
  justify-content: center;
}
</style>
