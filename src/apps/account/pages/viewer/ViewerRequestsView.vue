<script setup lang="ts">
import { format } from 'date-fns'
import { ExternalLink, ListMusic, RefreshCw, Search, Undo2, Users } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { postApiLiveRequestCancelFromWeb } from '@/api/generated/live-request/live-request'
import { QueueFrom, QueueStatus, SongRequestFrom, SongRequestStatus } from '@/api/generated/model'
import { postApiQueueCancelFromWeb } from '@/api/queueExtras'
import {
  fetchMyQueueRecords,
  fetchMySongRequests,
  type MyQueueRecordItem,
  type MySongRequestItem,
} from '@/api/viewer-records'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const route = useRoute()
const router = useRouter()
const auth = useBiliAuth()

const activeTab = ref<'song' | 'queue'>(route.query.tab === 'queue' ? 'queue' : 'song')

// 点播记录状态
const songLoading = ref(false)
const songItems = ref<MySongRequestItem[]>([])
const songTotal = ref(0)
const songPage = ref(1)
const songPageSize = 20
const songKeyword = ref('')
const songStatus = ref<string>('all')
const cancellingSongId = ref<number | null>(null)

// 排队记录状态
const queueLoading = ref(false)
const queueItems = ref<MyQueueRecordItem[]>([])
const queueTotal = ref(0)
const queuePage = ref(1)
const queuePageSize = 20
const queueStatus = ref<string>('all')
const cancellingQueueId = ref<number | null>(null)

const isCurrentLoading = computed(() => (activeTab.value === 'song' ? songLoading.value : queueLoading.value))

function normalizeTs(ts?: number | null) {
  if (!ts) return 0
  return ts < 1e12 ? ts * 1000 : ts
}

function formatDateTime(ts?: number | null) {
  const value = normalizeTs(ts)
  return value ? format(value, 'yyyy-MM-dd HH:mm') : '-'
}

function songStatusMeta(status: SongRequestStatus) {
  switch (status) {
    case SongRequestStatus.Waiting:
      return { label: '等待演唱', variant: 'warning' as const }
    case SongRequestStatus.Singing:
      return { label: '演唱中', variant: 'default' as const }
    case SongRequestStatus.Finish:
      return { label: '已完成', variant: 'success' as const }
    case SongRequestStatus.Cancel:
      return { label: '已取消', variant: 'secondary' as const }
    default:
      return { label: '未知', variant: 'outline' as const }
  }
}

function songFromLabel(from: SongRequestFrom) {
  switch (from) {
    case SongRequestFrom.Web:
      return '网页点歌'
    case SongRequestFrom.Danmaku:
      return '弹幕'
    case SongRequestFrom.SC:
      return 'SC'
    case SongRequestFrom.Gift:
      return '礼物'
    case SongRequestFrom.Manual:
      return '主播添加'
    default:
      return '点播'
  }
}

function queueStatusMeta(status: QueueStatus) {
  switch (status) {
    case QueueStatus.Waiting:
      return { label: '排队中', variant: 'warning' as const }
    case QueueStatus.Progressing:
      return { label: '进行中', variant: 'default' as const }
    case QueueStatus.Finish:
      return { label: '已完成', variant: 'success' as const }
    case QueueStatus.Cancel:
      return { label: '已取消', variant: 'secondary' as const }
    default:
      return { label: '未知', variant: 'outline' as const }
  }
}

function queueFromLabel(from: QueueFrom) {
  switch (from) {
    case QueueFrom.Web:
      return '网页排队'
    case QueueFrom.Danmaku:
      return '弹幕'
    case QueueFrom.SC:
      return 'SC'
    case QueueFrom.Gift:
      return '礼物'
    case QueueFrom.Manual:
      return '主播添加'
    default:
      return '排队'
  }
}

async function loadSongs() {
  songLoading.value = true
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const resp = await fetchMySongRequests(
      {
        pageNum: songPage.value - 1,
        pageSize: songPageSize,
        keyword: songKeyword.value.trim() || undefined,
        status: songStatus.value === 'all' ? undefined : (Number(songStatus.value) as SongRequestStatus),
      },
      Object.keys(headers).length > 0 ? headers : undefined,
    )
    if (resp.code !== 200) throw new Error(resp.message || '加载失败')
    songItems.value = resp.data ?? []
    songTotal.value = resp.total ?? 0
  } catch (err) {
    toast.error(`获取点播记录失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    songLoading.value = false
  }
}

async function loadQueues() {
  queueLoading.value = true
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const resp = await fetchMyQueueRecords(
      {
        pageNum: queuePage.value - 1,
        pageSize: queuePageSize,
        status: queueStatus.value === 'all' ? undefined : (Number(queueStatus.value) as QueueStatus),
      },
      Object.keys(headers).length > 0 ? headers : undefined,
    )
    if (resp.code !== 200) throw new Error(resp.message || '加载失败')
    queueItems.value = resp.data ?? []
    queueTotal.value = resp.total ?? 0
  } catch (err) {
    toast.error(`获取排队记录失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    queueLoading.value = false
  }
}

async function cancelSong(item: MySongRequestItem) {
  cancellingSongId.value = item.id
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const resp = await postApiLiveRequestCancelFromWeb(
      { target: item.target, id: item.id },
      Object.keys(headers).length > 0 ? { headers } : undefined,
    )
    if (resp.code !== 200) throw new Error(resp.message)
    toast.success(
      resp.data?.pointRefunded && resp.data.refundedAmount > 0
        ? `已撤回点歌并退还 ${resp.data.refundedAmount} 积分`
        : '已撤回点歌',
    )
    await loadSongs()
  } catch (err) {
    toast.error(`撤回失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    cancellingSongId.value = null
  }
}

async function cancelQueue(item: MyQueueRecordItem) {
  cancellingQueueId.value = item.id
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const resp = await postApiQueueCancelFromWeb(
      { target: item.target, id: item.id },
      Object.keys(headers).length > 0 ? { headers } : undefined,
    )
    if (resp.code !== 200) throw new Error(resp.message)
    toast.success(
      resp.data?.pointRefunded && resp.data.refundedAmount > 0
        ? `已撤回排队并退还 ${resp.data.refundedAmount} 积分`
        : '已撤回排队',
    )
    await loadQueues()
  } catch (err) {
    toast.error(`撤回失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    cancellingQueueId.value = null
  }
}

function refreshCurrent() {
  if (activeTab.value === 'song') {
    void loadSongs()
  } else {
    void loadQueues()
  }
}

function handleSongSearch() {
  songPage.value = 1
  void loadSongs()
}

watch(activeTab, (next) => {
  void router.replace({ query: { ...route.query, tab: next } })
  if (next === 'song' && songItems.value.length === 0) void loadSongs()
  if (next === 'queue' && queueItems.value.length === 0) void loadQueues()
})

watch(songStatus, () => {
  songPage.value = 1
  void loadSongs()
})

watch(queueStatus, () => {
  queuePage.value = 1
  void loadQueues()
})

onMounted(() => {
  if (activeTab.value === 'song') {
    void loadSongs()
  } else {
    void loadQueues()
  }
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AccountPageHeader
      title="点播与排队记录"
      subtitle="聚合查看你在各直播间通过弹幕、SC、礼物或网页提交的点歌与排队历史，等待中的记录可直接撤回。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="isCurrentLoading"
          class="gap-1.5"
          @click="refreshCurrent"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': isCurrentLoading }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <Tabs v-model="activeTab">
      <TabsList class="grid w-full sm:w-72 grid-cols-2">
        <TabsTrigger
          value="song"
          class="gap-1.5"
        >
          <ListMusic class="size-3.5" />
          点播记录
        </TabsTrigger>
        <TabsTrigger
          value="queue"
          class="gap-1.5"
        >
          <Users class="size-3.5" />
          排队记录
        </TabsTrigger>
      </TabsList>

      <!-- 点播记录 -->
      <TabsContent
        value="song"
        class="space-y-3 mt-3"
      >
        <Card class="p-3 flex flex-col sm:flex-row gap-2.5">
          <div class="relative flex-1 min-w-0">
            <Search
              class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              v-model="songKeyword"
              placeholder="搜索点播歌曲名，回车查询..."
              class="pl-8"
              @keydown.enter="handleSongSearch"
            />
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="w-36">
              <Select v-model="songStatus">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem :value="String(SongRequestStatus.Waiting)">等待演唱</SelectItem>
                  <SelectItem :value="String(SongRequestStatus.Singing)">演唱中</SelectItem>
                  <SelectItem :value="String(SongRequestStatus.Finish)">已完成</SelectItem>
                  <SelectItem :value="String(SongRequestStatus.Cancel)">已取消</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="secondary"
              @click="handleSongSearch"
            >
              搜索
            </Button>
          </div>
        </Card>

        <div
          v-if="songLoading && songItems.length === 0"
          class="space-y-2.5"
        >
          <Skeleton
            v-for="i in 4"
            :key="i"
            class="h-20 rounded-lg"
          />
        </div>

        <Empty
          v-else-if="songItems.length === 0"
          description="暂无点播记录"
          class="py-12 rounded-lg border border-dashed border-border"
        />

        <div
          v-else
          class="space-y-2.5"
        >
          <Card
            v-for="item in songItems"
            :key="item.id"
            class="p-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <Avatar class="size-9 shrink-0">
                <AvatarImage :src="item.owner.faceUrl || ''" />
                <AvatarFallback>{{ item.owner.name?.slice(0, 1) || '主' }}</AvatarFallback>
              </Avatar>

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="text-sm font-semibold text-foreground truncate max-w-full">
                    {{ item.songName }}
                  </strong>
                  <Badge
                    :variant="songStatusMeta(item.status).variant"
                    size="xs"
                  >
                    {{ songStatusMeta(item.status).label }}
                  </Badge>
                  <Badge
                    variant="outline"
                    size="xs"
                  >
                    {{ songFromLabel(item.from) }}
                  </Badge>
                  <Badge
                    v-if="item.priorityLevel > 0"
                    variant="secondary"
                    size="xs"
                  >
                    插队
                  </Badge>
                </div>

                <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <Button
                    variant="link"
                    class="h-auto p-0 text-xs text-primary"
                    @click="router.push({ name: 'user-songList', params: { id: item.owner.name || item.target } })"
                  >
                    {{ item.owner.name }}
                  </Button>
                  <span class="font-mono tabular-nums">{{ formatDateTime(item.createAt) }}</span>
                  <span
                    v-if="item.pointCost && item.pointCost > 0"
                    class="font-mono tabular-nums"
                  >
                    · 消耗 {{ item.pointCost }} 积分{{ item.pointRefunded ? '（已退还）' : '' }}
                  </span>
                  <span
                    v-else-if="item.price && item.price > 0"
                    class="font-mono tabular-nums"
                  >
                    · ¥{{ item.price }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 justify-end">
              <Popconfirm
                v-if="item.canCancel"
                title="确认撤回这条待唱点播？"
                positive-text="确认撤回"
                negative-text="取消"
                @positive-click="cancelSong(item)"
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="outline"
                    :loading="cancellingSongId === item.id"
                    class="gap-1"
                  >
                    <Undo2 class="size-3" />
                    撤回
                  </Button>
                </template>
                撤回后将从主播待唱队列移除，如消耗了积分将自动退还。
              </Popconfirm>
              <Button
                size="xs"
                variant="ghost"
                class="gap-1"
                @click="router.push({ name: 'user-songList', params: { id: item.owner.name || item.target } })"
              >
                歌单页
                <ExternalLink class="size-3" />
              </Button>
            </div>
          </Card>

          <div
            v-if="songTotal > songPageSize"
            class="flex justify-center pt-2"
          >
            <Pagination
              v-model:page="songPage"
              :total="songTotal"
              :page-size="songPageSize"
              @update:page="loadSongs"
            />
          </div>
        </div>
      </TabsContent>

      <!-- 排队记录 -->
      <TabsContent
        value="queue"
        class="space-y-3 mt-3"
      >
        <Card class="p-3 flex-between flex-wrap gap-2">
          <span class="text-xs text-muted-foreground">按状态筛选排队记录</span>
          <div class="w-40">
            <Select v-model="queueStatus">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem :value="String(QueueStatus.Waiting)">排队中</SelectItem>
                <SelectItem :value="String(QueueStatus.Progressing)">进行中</SelectItem>
                <SelectItem :value="String(QueueStatus.Finish)">已完成</SelectItem>
                <SelectItem :value="String(QueueStatus.Cancel)">已取消</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        <div
          v-if="queueLoading && queueItems.length === 0"
          class="space-y-2.5"
        >
          <Skeleton
            v-for="i in 4"
            :key="i"
            class="h-20 rounded-lg"
          />
        </div>

        <Empty
          v-else-if="queueItems.length === 0"
          description="暂无排队记录"
          class="py-12 rounded-lg border border-dashed border-border"
        />

        <div
          v-else
          class="space-y-2.5"
        >
          <Card
            v-for="item in queueItems"
            :key="item.id"
            class="p-3.5 flex flex-col sm:flex-row sm:items-center gap-3"
          >
            <div class="flex items-start gap-3 flex-1 min-w-0">
              <Avatar class="size-9 shrink-0">
                <AvatarImage :src="item.owner.faceUrl || ''" />
                <AvatarFallback>{{ item.owner.name?.slice(0, 1) || '主' }}</AvatarFallback>
              </Avatar>

              <div class="min-w-0 flex-1 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <Button
                    variant="link"
                    class="h-auto p-0 text-sm font-semibold text-foreground"
                    @click="router.push({ name: 'user-queue', params: { id: item.owner.name || item.target } })"
                  >
                    {{ item.owner.name }}
                  </Button>
                  <Badge
                    :variant="queueStatusMeta(item.status).variant"
                    size="xs"
                  >
                    {{ queueStatusMeta(item.status).label }}
                  </Badge>
                  <Badge
                    variant="outline"
                    size="xs"
                  >
                    {{ queueFromLabel(item.from) }}
                  </Badge>
                  <Badge
                    v-if="item.batchNo"
                    variant="secondary"
                    size="xs"
                  >
                    第 {{ item.batchNo }} 车
                  </Badge>
                  <Badge
                    v-if="item.priorityLevel > 0"
                    variant="secondary"
                    size="xs"
                  >
                    插队
                  </Badge>
                </div>

                <p
                  v-if="item.content"
                  class="text-xs text-foreground m-0 break-words"
                >
                  备注：{{ item.content }}
                </p>

                <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span class="font-mono tabular-nums">{{ formatDateTime(item.createAt) }}</span>
                  <span
                    v-if="item.pointCost && item.pointCost > 0"
                    class="font-mono tabular-nums"
                  >
                    · 消耗 {{ item.pointCost }} 积分{{ item.pointRefunded ? '（已退还）' : '' }}
                  </span>
                  <span
                    v-else-if="item.giftPrice && item.giftPrice > 0"
                    class="font-mono tabular-nums"
                  >
                    · 礼物 ¥{{ item.giftPrice }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-1.5 shrink-0 justify-end">
              <Popconfirm
                v-if="item.canCancel"
                title="确认撤回这条排队？"
                positive-text="确认撤回"
                negative-text="取消"
                @positive-click="cancelQueue(item)"
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="outline"
                    :loading="cancellingQueueId === item.id"
                    class="gap-1"
                  >
                    <Undo2 class="size-3" />
                    撤回
                  </Button>
                </template>
                撤回后将退出当前排队，如消耗了积分将自动退还。
              </Popconfirm>
              <Button
                size="xs"
                variant="ghost"
                class="gap-1"
                @click="router.push({ name: 'user-queue', params: { id: item.owner.name || item.target } })"
              >
                排队页
                <ExternalLink class="size-3" />
              </Button>
            </div>
          </Card>

          <div
            v-if="queueTotal > queuePageSize"
            class="flex justify-center pt-2"
          >
            <Pagination
              v-model:page="queuePage"
              :total="queueTotal"
              :page-size="queuePageSize"
              @update:page="loadQueues"
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
