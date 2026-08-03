<script setup lang="ts">
import { useSessionStorage } from '@vueuse/core'
import { showErrorToast } from '@/shared/services/toast'
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
const route = useRoute()
const router = useRouter()

// state
const lives = ref<ResponseLiveInfoModel[]>([])
const isLoading = ref(false)
const loadError = ref<string | null>(null)

// pagination & query sync
const page = useSessionStorage<number>('ManageLive.page', 1)
const pageSize = usePersistedStorage<number>('ManageLive.pageSize', 10)

// search / filter / sort
const keyword = usePersistedStorage<string>('ManageLive.keyword', '')
const statusFilter = usePersistedStorage<'all' | 'live' | 'finished'>('ManageLive.status', 'all')
const sortKey = usePersistedStorage<'startAt' | 'danmakusCount' | 'totalIncome' | 'interactionCount'>(
  'ManageLive.sort',
  'startAt',
)
const sortOrder = usePersistedStorage<'desc' | 'asc'>('ManageLive.order', 'desc')
const pageSizeOptions = [10, 20, 30, 40].map((value) => ({ label: `${value} 条/页`, value }))
const statusOptions = [{ label: '全部状态', value: 'all' }, { label: '直播中', value: 'live' }, { label: '已结束', value: 'finished' }]
const sortOptions = [{ label: '开始时间', value: 'startAt' }, { label: '弹幕数', value: 'danmakusCount' }, { label: '互动数', value: 'interactionCount' }, { label: '收益', value: 'totalIncome' }]
const orderOptions = [{ label: '降序', value: 'desc' }, { label: '升序', value: 'asc' }]

// refresh
const enableAutoRefresh = usePersistedStorage<boolean>('ManageLive.autoRefresh', false)
const refreshSeconds = usePersistedStorage<number>('ManageLive.refreshSeconds', 60)
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
  let arr = lives.value.filter((l) =>
    statusFilter.value === 'all' ? true : statusFilter.value === 'live' ? !l.isFinish : l.isFinish,
  )
  // search by title or id
  if (keyword.value && keyword.value.trim() !== '') {
    const k = keyword.value.trim().toLowerCase()
    arr = arr.filter((l) => l.title.toLowerCase().includes(k) || l.liveId.toLowerCase().includes(k))
  }
  // sort
  arr = arr.slice().toSorted((a, b) => {
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
      showErrorToast(`无法获取数据: ${data.message}`)
      loadError.value = data.message
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '无法获取数据'
    showErrorToast(msg)
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
        <UButton
          size="sm"
          color="neutral"
          variant="soft"
          :disabled="isLoading"
          @click="resetFilters"
        >
          重置筛选
        </UButton>
        <UButton
          size="sm"
          :loading="isLoading"
          @click="getAll"
        >
          <template #leading><UIcon name="i-lucide-refresh-cw" /></template>
          刷新
        </UButton>
      </template>

      <div class="live-manager-alerts">
        <EventFetcherAlert />
        <EventFetcherStatusCard />

        <UAlert
          v-if="!isVerified"
          color="info"
          title="未认证"
        >
          尚未进行 Bilibili 认证，部分功能可能受限。
        </UAlert>

        <UAlert
          v-else-if="loadError"
          color="error"
          title="加载失败"
        >
          <div>{{ loadError }}</div>
          <div style="margin-top: 8px">
            <UButton
              size="sm"
              color="neutral"
              variant="soft"
              :loading="isLoading"
              @click="getAll"
            >
              重试
            </UButton>
          </div>
        </UAlert>
      </div>
    </ManagePageHeader>

    <template v-if="isVerified">
      <UCard
        class="toolbar-card"
        :ui="{ body: 'p-3' }"
      >
        <div class="toolbar">
          <div class="toolbar__group">
            <UInput
              v-model="keyword"
              placeholder="搜索标题或ID"
              clearable
              class="search-input"
            >
              <template #leading><UIcon name="i-lucide-search" /></template>
            </UInput>

            <USelect
              v-model="statusFilter"
              :items="statusOptions"
              class="status-select"
            />
          </div>

          <div class="toolbar__group">
            <span class="manage-kicker">排序</span>
            <USelect
              v-model="sortKey"
              size="small"
              :items="sortOptions"
              class="sort-select"
            />
            <USelect
              v-model="sortOrder"
              size="small"
              :items="orderOptions"
              class="order-select"
            />

            <USeparator orientation="vertical" />

            <div class="toolbar__group">
              <USwitch v-model="enableAutoRefresh" label="自动刷新" />
              <UInputNumber
                v-if="enableAutoRefresh"
                v-model="refreshSeconds"
                size="sm"
                class="refresh-seconds"
                :min="10"
                placeholder="秒"
              />
            </div>
          </div>
        </div>

        <USeparator class="toolbar-separator" />
        <p class="result-meta">共 {{ totalCount }} 条记录</p>
      </UCard>

      <USkeleton
        v-if="isLoading && !lives.length"
        class="skeleton"
        class="h-8 w-full"
      />
      <template v-else>
        <UCard
          v-if="!filteredAndSortedLives.length"
          class="empty-card"
        >
          <UEmpty title="没有找到符合条件的直播记录">
            <template #extra>
              <UButton
                :loading="isLoading"
                @click="getAll"
              >
                重新加载
              </UButton>
            </template>
          </UEmpty>
        </UCard>

        <div
          v-else
          class="live-stack"
        >
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
            <UPagination
              v-model:page="page"
              :total="filteredAndSortedLives.length"
              :items-per-page="pageSize"
              :show-edges="false"
            />
            <USelect v-model="pageSize" :items="pageSizeOptions" size="sm" class="page-size" />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.live-manager-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.live-manager-alerts {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.toolbar,.toolbar__group { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }.toolbar { justify-content:space-between; }.toolbar-separator { margin:12px 0 0; }.page-size { width:110px; }

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

.result-meta {
  font-size: 12px;
}

.live-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.live-row {
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.live-row:hover {
  background-color: var(--vtsuru-bg-inset);
}

.live-row:focus-visible {
  outline: none;
  border-color: rgba(var(--vtsuru-primary-rgb), 0.35);
  box-shadow: 0 0 0 2px rgba(var(--vtsuru-primary-rgb), 0.18);
}

.pagination {
  margin-top: 8px;
  padding-top: 10px;
  display: flex;
  justify-content: center;
}
</style>
