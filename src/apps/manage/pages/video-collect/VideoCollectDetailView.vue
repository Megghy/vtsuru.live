<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  LayoutGrid,
  Link2,
  List,
  MoreVertical,
  Power,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  X,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { batchImportVideoCollect, type BiliCollectionVideoItem } from '@/api/bili-extra'
import type { RequestVideoTable, ResponseVideoCollectDetail, VideoCollectInfo } from '@/api/generated/model'
import { DuplicateVideoPolicy, VideoStatus } from '@/api/generated/model'
import {
  getApiVideoCollectGet,
  postApiVideoCollectDelete,
  postApiVideoCollectFinish,
  postApiVideoCollectSetStatus,
  postApiVideoCollectUpdate,
} from '@/api/generated/video-collect/video-collect'
import {
  batchSetVideoCollectStatus,
  removeVideoCollectSender,
  removeVideoCollectVideo,
} from '@/api/video-collect-extra'
import BiliCollectionImportDialog from '@/apps/manage/components/BiliCollectionImportDialog.vue'
import VideoItemCard from '@/apps/manage/components/VideoItemCard.vue'
import BiliVideoPreviewDialog from '@/shared/components/BiliVideoPreviewDialog.vue'
import { CURRENT_HOST } from '@/shared/config'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { copyToClipboard, objectsToCSV, useMessage } from '@/shared/utils'
import {
  buildBiliVideoUrl,
  formatVideoDuration,
  getVideoCollectLifecycleLabel,
  getVideoCollectLifecycleState,
  normalizeTimestamp,
} from '@/shared/utils/videoCollect'

import VideoCollectFormModal from './VideoCollectFormModal.vue'
import VideoCollectShareDialog from './VideoCollectShareDialog.vue'
import VideoRejectReasonDialog from './VideoRejectReasonDialog.vue'

type SortOption = 'submitted-desc' | 'senders-desc' | 'duration-desc' | 'duration-asc' | 'title'
type ViewMode = 'list' | 'grid'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const videoDetail = ref<ResponseVideoCollectDetail>()
const isLoading = ref(false)
const tableOperation = ref<string>()
const videoOperation = ref<string>()
const shareModalVisible = ref(false)
const editModalVisible = ref(false)
const biliImportModalVisible = ref(false)
const isBiliImporting = ref(false)
const deleteModalVisible = ref(false)

// 预览弹窗状态
const previewModalVisible = ref(false)
const previewBvid = ref('')
const previewTitle = ref('')
const previewPage = ref(1)

// 拒绝理由弹窗状态
const rejectDialogVisible = ref(false)
const rejectTargets = ref<VideoCollectInfo[]>([])
const rejectTargetTitle = ref('')

const activeStatus = ref<VideoStatus>(VideoStatus.Pending)
const keyword = ref('')
const debouncedKeyword = refDebounced(keyword, 180)
const partitionFilter = ref('all')
const sortOption = ref<SortOption>('submitted-desc')
const viewMode = ref<ViewMode>((localStorage.getItem('vtsuru-vc-viewmode') as ViewMode) || 'list')
const selectedBvids = ref<string[]>([])
const isBatchUpdating = ref(false)
let loadSeq = 0

const table = computed(() => videoDetail.value?.table)
const videos = computed(() => videoDetail.value?.videos ?? [])
const shareUrl = computed(() => (table.value ? `${CURRENT_HOST}video-collect/${table.value.shortId}` : ''))
const lifecycleState = computed(() => (table.value ? getVideoCollectLifecycleState(table.value) : 'finished'))
const isActive = computed(() => lifecycleState.value !== 'finished')
const collectionStatus = computed(() => getVideoCollectLifecycleLabel(lifecycleState.value))

const pendingVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Pending))
const acceptedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Accepted))
const rejectedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Rejected))
const acceptedDuration = computed(() => acceptedVideos.value.reduce((sum, item) => sum + item.video.length, 0))

const availablePartitions = computed(() => {
  const set = new Set<string>()
  for (const item of videos.value) {
    if (item.video.partitionName) set.add(item.video.partitionName)
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'zh-CN'))
})

const editValue = computed<RequestVideoTable | undefined>(() => {
  if (!table.value) return undefined
  return {
    id: table.value.id,
    name: table.value.name,
    description: table.value.description,
    startAt: table.value.startAt,
    endAt: table.value.endAt,
    maxVideoCount: table.value.maxVideoCount,
    minVideoDuration: table.value.minVideoDuration,
    maxVideoDuration: table.value.maxVideoDuration,
    allowedPartitions: [...(table.value.allowedPartitions ?? [])],
    allowUnregisteredUser: table.value.allowUnregisteredUser,
    maxVideoPerUser: table.value.maxVideoPerUser,
    requireDescription: table.value.requireDescription,
    duplicatePolicy: table.value.duplicatePolicy,
  }
})

const visibleVideos = computed(() => {
  const search = debouncedKeyword.value.trim().toLocaleLowerCase()
  const result = videos.value.filter((item) => {
    if (item.info.status !== activeStatus.value) return false
    if (partitionFilter.value !== 'all' && item.video.partitionName !== partitionFilter.value) return false
    if (!search) return true
    const senders = item.info.senders
      .map((sender) => `${sender.sender ?? ''} ${sender.senderId ?? ''} ${sender.description ?? ''}`)
      .join(' ')
    return `${item.info.bvid ?? ''} ${item.video.title} ${item.video.ownerName} ${item.video.partitionName ?? ''} ${senders}`
      .toLocaleLowerCase()
      .includes(search)
  })

  return result.toSorted((a, b) => {
    if (sortOption.value === 'senders-desc') return b.info.senders.length - a.info.senders.length
    if (sortOption.value === 'duration-desc') return b.video.length - a.video.length
    if (sortOption.value === 'duration-asc') return a.video.length - b.video.length
    if (sortOption.value === 'title') return a.video.title.localeCompare(b.video.title, 'zh-CN')
    return latestSubmitTime(b.info) - latestSubmitTime(a.info)
  })
})

const isAllSelected = computed(() => {
  if (visibleVideos.value.length === 0) return false
  return visibleVideos.value.every((item) => selectedBvids.value.includes(item.info.bvid ?? ''))
})

const isIndeterminateSelected = computed(() => {
  const count = visibleVideos.value.filter((item) => selectedBvids.value.includes(item.info.bvid ?? '')).length
  return count > 0 && count < visibleVideos.value.length
})

const selectAllCheckboxState = computed<boolean | 'indeterminate'>(() => {
  if (isAllSelected.value) return true
  if (isIndeterminateSelected.value) return 'indeterminate'
  return false
})

void loadData()
watch(
  () => route.params.id,
  () => void loadData(),
)
watch([activeStatus, debouncedKeyword, partitionFilter], () => {
  selectedBvids.value = []
})

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  localStorage.setItem('vtsuru-vc-viewmode', mode)
}

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

function latestSubmitTime(info: VideoCollectInfo) {
  return Math.max(...info.senders.map((sender) => normalizeTimestamp(sender.sendAt)), 0)
}

async function loadData() {
  const seq = ++loadSeq
  isLoading.value = true
  try {
    const response = await getApiVideoCollectGet({ id: currentId() })
    if (seq !== loadSeq) return
    if (response.code !== 200) throw new Error(response.message)
    videoDetail.value = response.data
  } catch (error) {
    if (seq !== loadSeq) return
    console.error(error)
    videoDetail.value = undefined
    message.error(error instanceof Error ? error.message : '征集详情加载失败')
  } finally {
    if (seq === loadSeq) isLoading.value = false
  }
}

async function handleBiliCollectionImport(items: BiliCollectionVideoItem[]) {
  if (!table.value || items.length === 0) return
  isBiliImporting.value = true
  try {
    const res = await batchImportVideoCollect(
      table.value.id,
      items.map((i) => i.bvid),
    )
    const parts = [`新增 ${res.imported} 个`]
    if (res.skipped > 0) parts.push(`跳过重复 ${res.skipped} 个`)
    if (res.failed.length > 0) parts.push(`失败 ${res.failed.length} 个`)
    message.success(`导入完成：${parts.join('，')}`)
    await loadData()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '批量导入失败')
  } finally {
    isBiliImporting.value = false
  }
}

function updateLocalStatus(video: VideoCollectInfo, status: VideoStatus, rejectReason?: string) {
  if (table.value) {
    const occupiedBefore = video.status !== VideoStatus.Rejected
    const occupiedAfter = status !== VideoStatus.Rejected
    table.value.videoCount += Number(occupiedAfter) - Number(occupiedBefore)
  }
  video.status = status
  video.rejectReason = status === VideoStatus.Rejected ? rejectReason || null : null
}

async function setStatus(status: VideoStatus, video: VideoCollectInfo, reason?: string) {
  const bvid = video.bvid ?? ''
  if (!bvid) return
  videoOperation.value = bvid
  try {
    const response = await postApiVideoCollectSetStatus({
      id: currentId(),
      bvid,
      status,
      reason: reason || undefined,
    })
    if (response.code !== 200) throw new Error(response.message)
    updateLocalStatus(video, status, reason)
    selectedBvids.value = selectedBvids.value.filter((id) => id !== bvid)
    message.success('审核状态已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '审核操作失败')
  } finally {
    videoOperation.value = undefined
  }
}

function openSingleReject(video: VideoCollectInfo, title: string) {
  rejectTargets.value = [video]
  rejectTargetTitle.value = title
  rejectDialogVisible.value = true
}

function openBatchReject() {
  const targets = visibleVideos.value
    .filter((item) => selectedBvids.value.includes(item.info.bvid ?? ''))
    .map((item) => item.info)
  if (!targets.length) {
    message.warning('请先选择视频')
    return
  }
  rejectTargets.value = targets
  rejectTargetTitle.value = ''
  rejectDialogVisible.value = true
}

async function confirmReject(reason: string) {
  const targets = rejectTargets.value
  if (targets.length === 0) return
  if (targets.length === 1) {
    await setStatus(VideoStatus.Rejected, targets[0], reason)
    rejectDialogVisible.value = false
    return
  }
  await executeBatchSetStatus(VideoStatus.Rejected, targets, reason)
  rejectDialogVisible.value = false
}

async function batchSetStatus(status: VideoStatus) {
  if (status === VideoStatus.Rejected) {
    openBatchReject()
    return
  }
  const targets = visibleVideos.value
    .filter((item) => selectedBvids.value.includes(item.info.bvid ?? ''))
    .map((item) => item.info)
  if (!targets.length) {
    message.warning('请先选择视频')
    return
  }
  await executeBatchSetStatus(status, targets)
}

async function executeBatchSetStatus(status: VideoStatus, targets: VideoCollectInfo[], rejectReason?: string) {
  const bvids = targets.map((v) => v.bvid).filter((b): b is string => Boolean(b))
  if (!bvids.length) return
  isBatchUpdating.value = true
  try {
    const res = await batchSetVideoCollectStatus({
      id: currentId(),
      bvids,
      status,
      rejectReason: rejectReason || undefined,
    })
    selectedBvids.value = []
    if (res.failed.length === 0) {
      message.success(`已批量更新 ${res.updated} 条`)
    } else {
      message.warning(`已更新 ${res.updated} 条，${res.failed.length} 条失败（可能超出征集上限）`)
    }
    await loadData()
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '批量更新失败')
  } finally {
    isBatchUpdating.value = false
  }
}

async function handleRemoveVideo(video: VideoCollectInfo) {
  const bvid = video.bvid ?? ''
  if (!bvid) return
  videoOperation.value = bvid
  try {
    await removeVideoCollectVideo(currentId(), bvid)
    selectedBvids.value = selectedBvids.value.filter((id) => id !== bvid)
    message.success('投稿已删除')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除投稿失败')
  } finally {
    videoOperation.value = undefined
  }
}

async function handleRemoveSender(video: VideoCollectInfo, senderIndex: number) {
  const bvid = video.bvid ?? ''
  if (!bvid) return
  videoOperation.value = bvid
  try {
    await removeVideoCollectSender({ id: currentId(), bvid, senderIndex })
    message.success('推荐记录已移除')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '移除推荐记录失败')
  } finally {
    videoOperation.value = undefined
  }
}

function toggleSelect(bvid: string) {
  if (selectedBvids.value.includes(bvid)) {
    selectedBvids.value = selectedBvids.value.filter((id) => id !== bvid)
  } else {
    selectedBvids.value = [...selectedBvids.value, bvid]
  }
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedBvids.value = []
  } else {
    selectedBvids.value = visibleVideos.value.map((item) => item.info.bvid).filter((b): b is string => Boolean(b))
  }
}

function clearSelection() {
  selectedBvids.value = []
}

async function updateTable(model: RequestVideoTable) {
  tableOperation.value = 'edit'
  try {
    const response = await postApiVideoCollectUpdate({
      ...model,
      id: currentId(),
    })
    if (response.code !== 200) throw new Error(response.message)
    if (videoDetail.value) videoDetail.value.table = response.data
    editModalVisible.value = false
    message.success('征集信息已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    tableOperation.value = undefined
  }
}

async function toggleCollection() {
  if (!table.value) return
  tableOperation.value = 'toggle'
  const finish = !table.value.isFinish
  try {
    const response = await postApiVideoCollectFinish({ id: table.value.id, finish })
    if (response.code !== 200) throw new Error(response.message)
    table.value.isFinish = finish
    message.success(finish ? '征集已结束' : '征集已重新开启')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '状态更新失败')
  } finally {
    tableOperation.value = undefined
  }
}

async function deleteTable() {
  if (!table.value) return
  tableOperation.value = 'delete'
  try {
    const response = await postApiVideoCollectDelete({ id: table.value.id })
    if (response.code !== 200) throw new Error(response.message)
    message.success('征集已删除')
    await router.replace({ name: 'manage-videoCollect' })
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    tableOperation.value = undefined
    deleteModalVisible.value = false
  }
}

function copyAcceptedBvids() {
  if (acceptedVideos.value.length === 0) return
  const text = acceptedVideos.value.map((item) => item.info.bvid).join('\n')
  copyToClipboard(text)
  message.success(`已复制 ${acceptedVideos.value.length} 个通过的 BV 号`)
}

function copyAcceptedLinks() {
  if (acceptedVideos.value.length === 0) return
  const text = acceptedVideos.value.map((item) => buildBiliVideoUrl(item.info.bvid, item.info.page)).join('\n')
  copyToClipboard(text)
  message.success(`已复制 ${acceptedVideos.value.length} 个通过的视频链接`)
}

function exportResults() {
  if (!table.value || acceptedVideos.value.length === 0) return
  const rows = acceptedVideos.value.map(({ info, video }) => ({
    BV号: info.bvid ?? '',
    分P: info.page && info.page > 1 ? `P${info.page}` : 'P1',
    标题: video.title,
    分区: video.partitionName || '',
    UP主: video.ownerName,
    时长秒: video.length,
    是否已看: info.watched ? '已看' : '未看',
    推荐人数: info.senders.length,
    推荐人: info.senders.map((sender) => sender.sender || '匿名用户').join('、'),
    推荐理由: info.senders
      .map((sender) => sender.description)
      .filter(Boolean)
      .join(' | '),
  }))
  const content = `\uFEFF${objectsToCSV(rows)}`
  saveAs(new Blob([content], { type: 'text/csv;charset=utf-8' }), `${table.value.name}-通过结果-${Date.now()}.csv`)
}

function openPreview(bvid: string, title: string, page = 1) {
  previewBvid.value = bvid
  previewTitle.value = title
  previewPage.value = page
  previewModalVisible.value = true
}
</script>

<template>
  <div class="space-y-4 w-full">
    <div
      v-if="isLoading && !videoDetail"
      class="space-y-3"
    >
      <Skeleton class="h-20 rounded-lg" />
      <Skeleton class="h-64 rounded-lg" />
    </div>

    <template v-else-if="videoDetail && table">
      <!-- 页头与操作区 -->
      <div class="flex-between flex-wrap gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <SimpleTooltip content="返回征集列表">
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="返回列表"
              class="shrink-0"
              @click="router.push({ name: 'manage-videoCollect' })"
            >
              <ArrowLeft class="size-4" />
            </Button>
          </SimpleTooltip>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold text-foreground truncate">
                {{ table.name }}
              </h1>
              <Badge
                :variant="isActive ? 'secondary' : 'default'"
                size="xs"
                class="shrink-0"
              >
                {{ collectionStatus }}
              </Badge>
            </div>
            <p
              v-if="table.description"
              class="text-xs text-muted-foreground truncate max-w-lg mt-0.5"
            >
              {{ table.description }}
            </p>
          </div>
        </div>

        <div class="flex items-center flex-wrap gap-1.5">
          <Button
            variant="outline"
            :disabled="isBiliImporting"
            @click="biliImportModalVisible = true"
          >
            <Download class="size-3.5 mr-1" />
            导入收藏夹/合集
          </Button>

          <Button
            variant="outline"
            @click="shareModalVisible = true"
          >
            <Share2 class="size-3.5 mr-1" />
            分享
          </Button>

          <Button
            variant="outline"
            @click="router.push({ name: 'video-collect-list', params: { id: table.id }, query: route.query })"
          >
            <ExternalLink class="size-3.5 mr-1" />
            鉴赏工作台
          </Button>

          <Button
            variant="outline"
            @click="editModalVisible = true"
          >
            <Edit3 class="size-3.5 mr-1" />
            规则
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="更多操作"
              >
                <MoreVertical class="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="toggleCollection">
                <Power class="size-3.5 mr-1.5" />
                {{ isActive ? '结束征集' : '重新开启征集' }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="copyAcceptedBvids"
              >
                <Copy class="size-3.5 mr-1.5" />
                复制通过 BV 号 ({{ acceptedVideos.length }})
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="copyAcceptedLinks"
              >
                <Link2 class="size-3.5 mr-1.5" />
                复制通过视频链接
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="exportResults"
              >
                <Download class="size-3.5 mr-1.5" />
                导出结果 (CSV)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="deleteModalVisible = true"
              >
                <Trash2 class="size-3.5 mr-1.5" />
                删除征集
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- 规则微型卡片 -->
      <Card class="p-3 flex-between flex-wrap gap-3">
        <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span class="font-mono tabular-nums">
            {{ format(normalizeTimestamp(table.startAt), 'MM-dd HH:mm') }} ~
            {{ format(normalizeTimestamp(table.endAt), 'MM-dd HH:mm') }}
          </span>

          <Badge
            variant="outline"
            size="xs"
          >
            {{ table.allowUnregisteredUser ? '游客可投' : '仅限绑定' }}
          </Badge>
          <Badge
            variant="outline"
            size="xs"
          >
            {{ table.duplicatePolicy === DuplicateVideoPolicy.Reject ? '拒绝重复' : '重复合并' }}
          </Badge>
          <Badge
            v-if="table.maxVideoPerUser"
            variant="outline"
            size="xs"
          >
            每人限 {{ table.maxVideoPerUser }} 个
          </Badge>
          <Badge
            v-if="table.minVideoDuration || table.maxVideoDuration"
            variant="outline"
            size="xs"
          >
            时长 {{ table.minVideoDuration ? formatVideoDuration(table.minVideoDuration) : '00:00' }} ~
            {{ table.maxVideoDuration ? formatVideoDuration(table.maxVideoDuration) : '不限' }}
          </Badge>
          <Badge
            v-if="acceptedDuration > 0"
            variant="secondary"
            size="xs"
            class="font-mono tabular-nums"
          >
            已通过总时长 {{ formatVideoDuration(acceptedDuration) }}
          </Badge>

          <Popover v-if="table.allowedPartitions?.length">
            <PopoverTrigger as-child>
              <Badge
                variant="outline"
                size="xs"
                class="cursor-pointer hover:text-foreground"
              >
                限定 {{ table.allowedPartitions.length }} 个分区
              </Badge>
            </PopoverTrigger>
            <PopoverContent class="w-64 p-2 space-y-1.5">
              <div class="text-xs font-semibold text-foreground">限定投稿分区：</div>
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="p in table.allowedPartitions"
                  :key="p"
                  variant="secondary"
                  size="xs"
                >
                  {{ p }}
                </Badge>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div class="w-36 space-y-1">
          <div class="flex-between text-[11px] text-muted-foreground">
            <span>名额</span>
            <strong class="font-mono tabular-nums text-foreground">
              {{ table.videoCount }} / {{ table.maxVideoCount }}
            </strong>
          </div>
          <Progress
            :model-value="Math.min(100, Math.round((table.videoCount / Math.max(1, table.maxVideoCount)) * 100))"
            class="h-1.5"
          />
        </div>
      </Card>

      <!-- 审核工作台 -->
      <div class="space-y-3">
        <!-- Tab 栏与工具条 -->
        <Card class="p-3 flex-between flex-wrap gap-3">
          <ToggleGroup
            type="single"
            size="xs"
            :model-value="String(activeStatus)"
            @update:model-value="
              (val) => {
                if (val !== undefined && val !== '') activeStatus = Number(val)
              }
            "
          >
            <ToggleGroupItem
              :value="String(VideoStatus.Pending)"
              class="gap-1.5"
            >
              <span>待审核</span>
              <Badge
                variant="secondary"
                size="xs"
                class="tabular-nums"
              >
                {{ pendingVideos.length }}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem
              :value="String(VideoStatus.Accepted)"
              class="gap-1.5"
            >
              <span>已通过</span>
              <Badge
                variant="secondary"
                size="xs"
                class="tabular-nums"
              >
                {{ acceptedVideos.length }}
              </Badge>
            </ToggleGroupItem>
            <ToggleGroupItem
              :value="String(VideoStatus.Rejected)"
              class="gap-1.5"
            >
              <span>已拒绝</span>
              <Badge
                variant="secondary"
                size="xs"
                class="tabular-nums"
              >
                {{ rejectedVideos.length }}
              </Badge>
            </ToggleGroupItem>
          </ToggleGroup>

          <!-- 右侧筛选与视图工具 -->
          <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
            <div class="relative w-full sm:w-52">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                v-model="keyword"
                placeholder="搜索标题、BV、UP、推荐人..."
                class="pl-8"
              />
            </div>

            <div
              v-if="availablePartitions.length > 1"
              class="w-32"
            >
              <Select v-model="partitionFilter">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="全部分区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部分区</SelectItem>
                  <SelectItem
                    v-for="p in availablePartitions"
                    :key="p"
                    :value="p"
                  >
                    {{ p }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="w-36">
              <Select v-model="sortOption">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted-desc">最新提交</SelectItem>
                  <SelectItem value="senders-desc">推荐人数: 多→少</SelectItem>
                  <SelectItem value="duration-desc">时长: 长→短</SelectItem>
                  <SelectItem value="duration-asc">时长: 短→长</SelectItem>
                  <SelectItem value="title">标题排序</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ToggleGroup
              :model-value="viewMode"
              type="single"
              size="xs"
              @update:model-value="(val) => val && setViewMode(val as ViewMode)"
            >
              <SimpleTooltip content="列表视图">
                <ToggleGroupItem
                  value="list"
                  aria-label="列表视图"
                >
                  <List class="size-3.5" />
                </ToggleGroupItem>
              </SimpleTooltip>
              <SimpleTooltip content="网格视图">
                <ToggleGroupItem
                  value="grid"
                  aria-label="网格视图"
                >
                  <LayoutGrid class="size-3.5" />
                </ToggleGroupItem>
              </SimpleTooltip>
            </ToggleGroup>

            <SimpleTooltip content="刷新投稿列表">
              <Button
                size="icon-sm"
                variant="outline"
                :loading="isLoading"
                aria-label="刷新投稿列表"
                @click="loadData"
              >
                <RefreshCw class="size-3.5" />
              </Button>
            </SimpleTooltip>
          </div>
        </Card>

        <!-- 批量操作条 -->
        <div
          v-if="selectedBvids.length > 0"
          class="p-2.5 rounded-lg border border-brand/40 bg-brand-soft/30 flex-between flex-wrap gap-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-semibold text-foreground">已选中 {{ selectedBvids.length }} 项</span>
            <Button
              size="xs"
              variant="ghost"
              class="text-muted-foreground"
              @click="clearSelection"
            >
              取消勾选
            </Button>
          </div>

          <div class="flex items-center flex-wrap gap-1.5">
            <Button
              v-if="activeStatus !== VideoStatus.Accepted"
              size="xs"
              variant="brand"
              :loading="isBatchUpdating"
              @click="batchSetStatus(VideoStatus.Accepted)"
            >
              <Check class="size-3.5 mr-1" />
              批量通过 ({{ selectedBvids.length }})
            </Button>

            <Button
              v-if="activeStatus !== VideoStatus.Rejected"
              size="xs"
              variant="destructive"
              :loading="isBatchUpdating"
              @click="batchSetStatus(VideoStatus.Rejected)"
            >
              <X class="size-3.5 mr-1" />
              批量拒绝 ({{ selectedBvids.length }})
            </Button>

            <Button
              v-if="activeStatus !== VideoStatus.Pending"
              size="xs"
              variant="outline"
              :loading="isBatchUpdating"
              @click="batchSetStatus(VideoStatus.Pending)"
            >
              批量退回待审
            </Button>
          </div>
        </div>

        <!-- 全选控制栏 -->
        <div
          v-if="visibleVideos.length > 0"
          class="flex-between text-xs text-muted-foreground px-1"
        >
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="selectAllCheckboxState"
              @update:checked="toggleSelectAll"
            />
            <span>全选当前 (共 {{ visibleVideos.length }} 条)</span>
          </div>
          <span class="text-[11px] hidden sm:inline">点击封面可就地预览播放</span>
        </div>

        <!-- 视频列表 / 网格 -->
        <Card
          v-if="visibleVideos.length === 0"
          class="p-10"
        >
          <Empty
            :description="keyword || partitionFilter !== 'all' ? '未搜索到符合条件的视频' : '当前状态下暂无投稿视频'"
          />
        </Card>

        <div
          v-else-if="viewMode === 'list'"
          class="space-y-2"
        >
          <VideoItemCard
            v-for="item in visibleVideos"
            :key="item.info.bvid"
            :video-info="item.info"
            :video-data="item.video"
            :loading="videoOperation === item.info.bvid || isBatchUpdating"
            view-mode="list"
            :selected="selectedBvids.includes(item.info.bvid ?? '')"
            @update-status="setStatus"
            @reject="openSingleReject"
            @remove-video="handleRemoveVideo"
            @remove-sender="handleRemoveSender"
            @toggle-select="toggleSelect"
            @preview="openPreview"
          />
        </div>

        <div
          v-else
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          <VideoItemCard
            v-for="item in visibleVideos"
            :key="item.info.bvid"
            :video-info="item.info"
            :video-data="item.video"
            :loading="videoOperation === item.info.bvid || isBatchUpdating"
            view-mode="grid"
            :selected="selectedBvids.includes(item.info.bvid ?? '')"
            @update-status="setStatus"
            @reject="openSingleReject"
            @remove-video="handleRemoveVideo"
            @remove-sender="handleRemoveSender"
            @toggle-select="toggleSelect"
            @preview="openPreview"
          />
        </div>
      </div>
    </template>

    <Card
      v-else-if="!isLoading"
      class="p-10"
    >
      <Empty description="无法加载视频征集：征集不存在，或无访问权限">
        <Button
          variant="outline"
          class="mt-2"
          @click="router.push({ name: 'manage-videoCollect' })"
        >
          返回征集列表
        </Button>
      </Empty>
    </Card>

    <!-- 分享征集弹窗 -->
    <VideoCollectShareDialog
      v-model:open="shareModalVisible"
      :share-url="shareUrl"
      :table-name="table?.name ?? ''"
    />

    <!-- 编辑规则弹窗 -->
    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集规则"
      :initial-value="editValue"
      :loading="tableOperation === 'edit'"
      @submit="updateTable"
    />

    <!-- 从 B 站收藏夹 / 合集批量导入 -->
    <BiliCollectionImportDialog
      v-model:open="biliImportModalVisible"
      title="从 B 站收藏夹 / 合集批量导入征集表"
      description="支持公开收藏夹、UP 主合集链接或 BV 号，单次最多勾选 100 个视频导入当前征集表"
      :max-select="100"
      @confirm="handleBiliCollectionImport"
    />

    <!-- 就地播放预览弹窗 -->
    <BiliVideoPreviewDialog
      v-model:open="previewModalVisible"
      :bvid="previewBvid"
      :title="previewTitle"
      :page="previewPage"
    />

    <!-- 拒绝理由弹窗 -->
    <VideoRejectReasonDialog
      v-model:open="rejectDialogVisible"
      :count="rejectTargets.length"
      :target-title="rejectTargetTitle"
      :loading="Boolean(videoOperation) || isBatchUpdating"
      @confirm="confirmReject"
    />

    <!-- 删除确认对话框 -->
    <AlertDialog
      :open="deleteModalVisible"
      @update:open="(val) => (deleteModalVisible = val)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除视频征集</AlertDialogTitle>
          <AlertDialogDescription>
            确定删除“{{ table?.name }}”吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteModalVisible = false">取消</AlertDialogCancel>
          <AlertDialogAction @click="deleteTable">确定删除</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
