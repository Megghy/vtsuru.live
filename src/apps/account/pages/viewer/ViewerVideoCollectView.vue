<script setup lang="ts">
import { format } from 'date-fns'
import { ExternalLink, Play, RefreshCw, Undo2 } from 'lucide-vue-next'
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { VideoStatus } from '@/api/generated/model'
import { withdrawMyVideoCollectSubmission } from '@/api/video-collect-extra'
import { fetchMyAllVideoSubmissions, type MyVideoSubmissionItem } from '@/api/viewer-records'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import BiliVideoPreviewDialog from '@/shared/components/BiliVideoPreviewDialog.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { toast } from '@/shared/utils'
import { formatVideoDuration, normalizeBiliCoverUrl, normalizeTimestamp } from '@/shared/utils/videoCollect'
import { useBiliAuth } from '@/store/useBiliAuth'

const router = useRouter()
const auth = useBiliAuth()

const isLoading = ref(false)
const items = ref<MyVideoSubmissionItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 20
const statusFilter = ref<string>('all')
const withdrawingKey = ref<string | null>(null)

const previewOpen = ref(false)
const previewItem = ref<MyVideoSubmissionItem | null>(null)

function statusMeta(status?: VideoStatus) {
  switch (status) {
    case VideoStatus.Accepted:
      return { label: '已通过', variant: 'success' as const }
    case VideoStatus.Rejected:
      return { label: '已拒绝', variant: 'destructive' as const }
    default:
      return { label: '待审核', variant: 'warning' as const }
  }
}

function formatSubmitTime(item: MyVideoSubmissionItem) {
  const latest = item.video.info.senders?.[item.video.info.senders.length - 1]?.sendAt
  if (!latest) return '-'
  return format(normalizeTimestamp(latest), 'yyyy-MM-dd HH:mm')
}

function openPreview(item: MyVideoSubmissionItem) {
  previewItem.value = item
  previewOpen.value = true
}

async function loadSubmissions() {
  isLoading.value = true
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    const resp = await fetchMyAllVideoSubmissions(
      {
        pageNum: page.value - 1,
        pageSize,
        status: statusFilter.value === 'all' ? undefined : (Number(statusFilter.value) as VideoStatus),
      },
      Object.keys(headers).length > 0 ? headers : undefined,
    )
    if (resp.code !== 200) throw new Error(resp.message || '加载失败')
    items.value = resp.data ?? []
    total.value = resp.total ?? 0
  } catch (err) {
    toast.error(`获取视频投稿记录失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isLoading.value = false
  }
}

async function withdraw(item: MyVideoSubmissionItem) {
  const key = `${item.tableId}:${item.video.info.bvid}`
  withdrawingKey.value = key
  try {
    const headers = Object.fromEntries(await auth.getBiliAuthHeaders())
    await withdrawMyVideoCollectSubmission(item.tableId, item.video.info.bvid, headers)
    toast.success('已撤回投稿')
    await loadSubmissions()
  } catch (err) {
    toast.error(`撤回失败：${err instanceof Error ? err.message : String(err)}`)
  } finally {
    withdrawingKey.value = null
  }
}

watch(statusFilter, () => {
  page.value = 1
  void loadSubmissions()
})

onMounted(() => {
  void loadSubmissions()
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <AccountPageHeader
      title="我的视频投稿"
      subtitle="跨主播查看你在各视频征集活动中的投稿审核状态、拒绝原因，待审核的投稿支持直接撤回。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="isLoading"
          class="gap-1.5"
          @click="loadSubmissions"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': isLoading }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <Card class="p-3 flex-between flex-wrap gap-2">
      <span class="text-xs text-muted-foreground">共 {{ total }} 条投稿记录</span>
      <div class="w-40">
        <Select v-model="statusFilter">
          <SelectTrigger class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部状态</SelectItem>
            <SelectItem :value="String(VideoStatus.Pending)">待审核</SelectItem>
            <SelectItem :value="String(VideoStatus.Accepted)">已通过</SelectItem>
            <SelectItem :value="String(VideoStatus.Rejected)">已拒绝</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>

    <div
      v-if="isLoading && items.length === 0"
      class="space-y-3"
    >
      <Skeleton
        v-for="i in 3"
        :key="i"
        class="h-28 rounded-lg"
      />
    </div>

    <Empty
      v-else-if="items.length === 0"
      description="暂无视频投稿记录"
      class="py-12 rounded-lg border border-dashed border-border"
    />

    <div
      v-else
      class="space-y-3"
    >
      <Card
        v-for="item in items"
        :key="`${item.tableId}-${item.video.info.bvid}`"
        class="p-3.5 flex flex-col sm:flex-row gap-3.5"
      >
        <!-- 视频封面 -->
        <div
          class="relative w-full sm:w-40 aspect-video rounded-md overflow-hidden bg-muted shrink-0 cursor-pointer group"
          @click="openPreview(item)"
        >
          <img
            :src="normalizeBiliCoverUrl(item.video.video.cover)"
            :alt="item.video.video.title"
            referrerpolicy="no-referrer"
            class="size-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
          <div
            class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex-center text-white"
          >
            <Play class="size-7 fill-white" />
          </div>
          <span
            class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white text-[11px] font-mono tabular-nums"
          >
            {{ formatVideoDuration(item.video.video.length) }}
          </span>
        </div>

        <!-- 详情与操作 -->
        <div class="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div class="space-y-1.5">
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <Badge
                    :variant="statusMeta(item.video.info.status).variant"
                    size="xs"
                  >
                    {{ statusMeta(item.video.info.status).label }}
                  </Badge>
                  <Badge
                    v-if="item.video.info.watched"
                    variant="secondary"
                    size="xs"
                  >
                    主播已看
                  </Badge>
                  <Badge
                    v-if="item.tableFinished"
                    variant="outline"
                    size="xs"
                  >
                    活动已结束
                  </Badge>
                </div>
                <h3
                  class="text-sm font-semibold text-foreground line-clamp-1 cursor-pointer hover:text-primary transition-colors m-0"
                  @click="openPreview(item)"
                >
                  {{ item.video.video.title }}
                </h3>
              </div>
            </div>

            <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              <div class="flex items-center gap-1.5">
                <Avatar class="size-4">
                  <AvatarImage :src="item.owner.faceUrl || ''" />
                  <AvatarFallback class="text-[10px]">{{ item.owner.name?.slice(0, 1) || '主' }}</AvatarFallback>
                </Avatar>
                <span>{{ item.owner.name }}</span>
              </div>
              <span>·</span>
              <span class="truncate max-w-48">{{ item.tableName }}</span>
              <span>·</span>
              <span class="font-mono tabular-nums">{{ formatSubmitTime(item) }}</span>
            </div>

            <div
              v-if="item.video.info.rejectReason && item.video.info.status === VideoStatus.Rejected"
              class="text-xs px-2.5 py-1.5 rounded bg-destructive/10 text-destructive border border-destructive/20"
            >
              拒绝理由：{{ item.video.info.rejectReason }}
            </div>

            <div
              v-if="item.video.info.senders?.some((s) => s.description)"
              class="text-xs text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5 space-y-0.5"
            >
              <div
                v-for="(s, idx) in item.video.info.senders.filter((x) => x.description)"
                :key="idx"
                class="line-clamp-2"
              >
                推荐语：{{ s.description }}
              </div>
            </div>
          </div>

          <div class="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-border/50">
            <span class="text-[11px] font-mono text-muted-foreground">
              {{ item.video.info.bvid }} · UP {{ item.video.video.ownerName }}
            </span>

            <div class="flex items-center gap-1.5">
              <Popconfirm
                v-if="item.canWithdraw"
                title="确认撤回这条待审核投稿？"
                positive-text="确认撤回"
                negative-text="取消"
                @positive-click="withdraw(item)"
              >
                <template #trigger>
                  <Button
                    size="xs"
                    variant="outline"
                    :loading="withdrawingKey === `${item.tableId}:${item.video.info.bvid}`"
                    class="gap-1"
                  >
                    <Undo2 class="size-3" />
                    撤回
                  </Button>
                </template>
                撤回后将从该视频征集活动中移除你的推荐记录。
              </Popconfirm>
              <Button
                size="xs"
                variant="ghost"
                class="gap-1"
                @click="
                  router.push({
                    name: item.tableFinished ? 'video-collect-list' : 'video-collect-public',
                    params: { id: item.shortId },
                  })
                "
              >
                {{ item.tableFinished ? '查看结果' : '前往活动' }}
                <ExternalLink class="size-3" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div
        v-if="total > pageSize"
        class="flex justify-center pt-2"
      >
        <Pagination
          v-model:page="page"
          :total="total"
          :page-size="pageSize"
          @update:page="loadSubmissions"
        />
      </div>
    </div>

    <BiliVideoPreviewDialog
      v-model:open="previewOpen"
      :bvid="previewItem?.video.info.bvid ?? ''"
      :title="previewItem?.video.video.title ?? ''"
      :author="previewItem?.video.video.ownerName"
      :page="previewItem?.video.info.page"
    />
  </div>
</template>
