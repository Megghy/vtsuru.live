<script setup lang="ts">
import type { ResponseLiveInfoModel } from '@/api/api-models'
import {
  ArrowSort24Filled,
  ArrowSync24Filled,
  Search24Filled
} from '@vicons/fluent'
import { NAlert, NButton, NCard, NDivider, NEmpty, NIcon, NInput, NInputNumber, NList, NListItem, NPagination, NSelect, NSkeleton, NSpace, NSwitch, useMessage } from 'naive-ui'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLocalStorage, useSessionStorage, useStorage } from '@vueuse/core'
import { useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/components/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import LiveInfoContainer from '@/components/LiveInfoContainer.vue'
import { LIVE_API_URL } from '@/data/constants'

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

onMounted(async () => {
  applyQueryToState()
  await getAll()
  setupAutoRefresh()
})

onBeforeUnmount(() => {
  clearAutoRefresh()
})
</script>

<template>
  <NSpace vertical justify="center" align="center" :size="24">
    <EventFetcherAlert />
    <EventFetcherStatusCard />
  </NSpace>

  <div v-if="accountInfo?.isBiliVerified != true" style="margin-top: 24px;">
    <NAlert type="info" title="未认证">
      尚未进行Bilibili认证，部分功能可能受限。
    </NAlert>
  </div>

  <template v-else>
    <NCard style="margin-top: 24px; margin-bottom: 24px; max-width: 1200px; left: 50%; transform: translateX(-50%);" size="small">
      <NSpace justify="space-between" align="center" wrap item-style="flex-grow: 1">
        <!-- Left: Search and Filter -->
        <NSpace align="center" wrap>
          <NInput v-model:value="keyword" placeholder="搜索标题或ID" clearable style="width: 280px">
            <template #prefix>
              <NIcon :component="Search24Filled" />
            </template>
          </NInput>

          <NSelect v-model:value="statusFilter" :options="[
            { label: '全部状态', value: 'all' },
            { label: '直播中', value: 'live' },
            { label: '已结束', value: 'finished' },
          ]" style="width: 140px">
          </NSelect>
        </NSpace>

        <!-- Right: Sort and Actions -->
        <NSpace align="center" wrap>
          <NSpace align="center" :size="12">
            <span style="color: var(--n-text-color-3); font-size: 12px;">排序:</span>
            <NSelect v-model:value="sortKey" size="small" :options="[
              { label: '开始时间', value: 'startAt' },
              { label: '弹幕数', value: 'danmakusCount' },
              { label: '互动数', value: 'interactionCount' },
              { label: '收益', value: 'totalIncome' },
            ]" style="width: 120px" />
            <NSelect v-model:value="sortOrder" size="small" :options="[
              { label: '降序', value: 'desc' },
              { label: '升序', value: 'asc' },
            ]" style="width: 90px" />
          </NSpace>

          <NDivider vertical />

          <NSpace align="center">
            <NSwitch v-model:value="enableAutoRefresh" size="small">
              <template #checked>自动刷新</template>
              <template #unchecked>自动刷新</template>
            </NSwitch>
            <NInputNumber v-if="enableAutoRefresh" v-model:value="refreshSeconds" size="small" style="width: 80px"
              :min="10" placeholder="秒">
              <template #suffix>s</template>
            </NInputNumber>
            <NButton size="small" secondary type="primary" :loading="isLoading" @click="getAll()">
              <template #icon>
                <NIcon :component="ArrowSync24Filled" />
              </template>
              刷新
            </NButton>
          </NSpace>
        </NSpace>
      </NSpace>
    </NCard>

    <NSkeleton v-if="isLoading && !lives.length" text :repeat="5" />
    <template v-else>
      <NEmpty v-if="!filteredAndSortedLives.length" description="没有找到符合条件的直播记录">
        <template #extra>
          <NButton type="primary" @click="getAll">重新加载</NButton>
        </template>
      </NEmpty>

      <div v-else class="list-container">
        <NList hoverable clickable class="live-list">
          <NListItem v-for="live in pagedLives" :key="live.liveId" @click="OnClickCover(live)" class="live-list-item">
            <LiveInfoContainer :key="live.liveId" :live="live" />
          </NListItem>
        </NList>

        <NSpace justify="center" align="center" style="margin-top: 24px; margin-bottom: 48px;">
          <NPagination v-model:page="page" v-model:page-size="pageSize" show-quick-jumper show-size-picker
            :page-sizes="[10, 20, 30, 40]" :item-count="filteredAndSortedLives.length" />
        </NSpace>
      </div>
    </template>
  </template>
</template>

<style scoped>
.list-container {
  max-width: 1000px;
  margin: 0 auto;
}

.live-list {
  background: transparent;
}

.live-list-item {
  padding: 16px;
  border-radius: 8px;
  transition: background-color 0.2s;
  margin-bottom: 8px;
  background-color: rgba(255, 255, 255, 0.02);
}

.live-list-item:hover {
  background-color: rgba(255, 255, 255, 0.05);
}
</style>
