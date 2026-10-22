<script setup lang="ts">
import {
  ArrowDownload24Regular,
  ArrowLeft24Regular,
  ArrowSync24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Delete24Regular,
  Dismiss24Regular,
  Edit24Regular,
  Grid24Regular,
  Info24Regular,
  Link24Regular,
  MoreVertical24Regular,
  Open24Regular,
  Search24Regular,
  Share24Regular,
  TableDismiss24Regular,
  TableSimple24Regular,
} from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import Qrcode from 'qrcode.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { VideoCollectCreateModel, VideoCollectDetail, VideoCollectTable, VideoInfo } from '@/api/api-models'
import { DuplicateVideoPolicy, VideoStatus } from '@/api/api-models'
import {
  getApiVideoCollectGet,
  postApiVideoCollectDelete,
  postApiVideoCollectFinish,
  postApiVideoCollectSetStatus,
  postApiVideoCollectUpdate,
} from '@/api/generated/video-collect/video-collect'
import VideoItemCard from '@/apps/manage/components/VideoItemCard.vue'
import { formatDuration } from '@/apps/manage/composables/formatters'
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'
import { copyToClipboard, objectsToCSV } from '@/shared/utils'

import VideoCollectFormModal from './VideoCollectFormModal.vue'

type SortOption = 'submitted-desc' | 'duration-desc' | 'duration-asc' | 'title'
type ViewMode = 'list' | 'grid'

const route = useRoute()
const router = useRouter()
const message = useMessage()

const videoDetail = ref<VideoCollectDetail>()
const isLoading = ref(false)
const tableOperation = ref<string>()
const videoOperation = ref<string>()
const shareModalVisible = ref(false)
const editModalVisible = ref(false)
const previewModalVisible = ref(false)
const previewBvid = ref('')
const previewTitle = ref('')

const deleteModalVisible = ref(false)

const activeStatus = ref<VideoStatus>(VideoStatus.Pending)
const keyword = ref('')
const sortOption = ref<SortOption>('submitted-desc')
const viewMode = ref<ViewMode>((localStorage.getItem('vtsuru-vc-viewmode') as ViewMode) || 'list')
const qrCodeWrapper = ref<HTMLElement>()
const selectedBvids = ref<string[]>([])
const isBatchUpdating = ref(false)

const table = computed(() => videoDetail.value?.table)
const videos = computed(() => videoDetail.value?.videos ?? [])
const shareUrl = computed(() => (table.value ? `${CURRENT_HOST}video-collect/${table.value.shortId}` : ''))
const isActive = computed(() => Boolean(table.value && !table.value.isFinish && table.value.endAt > Date.now()))
const collectionStatus = computed(() => {
  if (!isActive.value) return '已结束'
  if (table.value && table.value.startAt > Date.now()) return '未开始'
  return '进行中'
})

const pendingVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Pending))
const acceptedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Accepted))
const rejectedVideos = computed(() => videos.value.filter((item) => item.info.status === VideoStatus.Rejected))
const acceptedDuration = computed(() => acceptedVideos.value.reduce((sum, item) => sum + item.video.length, 0))

const editValue = computed<VideoCollectCreateModel | undefined>(() => {
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
  const search = keyword.value.trim().toLocaleLowerCase()
  const result = videos.value.filter((item) => {
    if (item.info.status !== activeStatus.value) return false
    if (!search) return true
    const senders = item.info.senders
      .map((sender) => `${sender.sender ?? ''} ${sender.senderId ?? ''} ${sender.description ?? ''}`)
      .join(' ')
    return `${item.info.bvid} ${item.video.title} ${item.video.ownerName} ${senders}`
      .toLocaleLowerCase()
      .includes(search)
  })

  return result.toSorted((a, b) => {
    if (sortOption.value === 'duration-desc') return b.video.length - a.video.length
    if (sortOption.value === 'duration-asc') return a.video.length - b.video.length
    if (sortOption.value === 'title') return a.video.title.localeCompare(b.video.title, 'zh-CN')
    return latestSubmitTime(b.info) - latestSubmitTime(a.info)
  })
})

const isAllSelected = computed(() => {
  if (visibleVideos.value.length === 0) return false
  return visibleVideos.value.every((item) => selectedBvids.value.includes(item.info.bvid))
})

const isIndeterminateSelected = computed(() => {
  const count = visibleVideos.value.filter((item) => selectedBvids.value.includes(item.info.bvid)).length
  return count > 0 && count < visibleVideos.value.length
})

void loadData()
watch(
  () => route.params.id,
  () => void loadData(),
)
watch([activeStatus, keyword], () => {
  selectedBvids.value = []
})

function setViewMode(mode: ViewMode) {
  viewMode.value = mode
  localStorage.setItem('vtsuru-vc-viewmode', mode)
}

function toTimestamp(time: unknown): number {
  if (typeof time === 'number') {
    return time < 1e11 ? time * 1000 : time
  }
  if (typeof time === 'string') {
    const parsed = new Date(time).getTime()
    return isNaN(parsed) ? Date.now() : parsed
  }
  if (time instanceof Date) return time.getTime()
  return Date.now()
}

function currentId() {
  const id = Array.isArray(route.params.id) ? route.params.id[0] : route.params.id
  if (!id) throw new Error('缺少征集 ID')
  return id
}

function latestSubmitTime(info: VideoInfo) {
  return Math.max(...info.senders.map((sender) => toTimestamp(sender.sendAt)), 0)
}

async function loadData() {
  isLoading.value = true
  try {
    const response = (await getApiVideoCollectGet({ id: currentId() })) as unknown as {
      code: number
      message?: string
      data: VideoCollectDetail
    }
    if (response.code !== 200) throw new Error(response.message)
    videoDetail.value = response.data
  } catch (error) {
    console.error(error)
    videoDetail.value = undefined
    message.error(error instanceof Error ? error.message : '征集详情加载失败')
  } finally {
    isLoading.value = false
  }
}

async function setStatus(status: VideoStatus, video: VideoInfo) {
  videoOperation.value = video.bvid
  try {
    const response = await postApiVideoCollectSetStatus({
      id: currentId(),
      bvid: video.bvid,
      status: status as any,
    })
    if (response.code !== 200) throw new Error(response.message)
    updateLocalStatus(video, status)
    selectedBvids.value = selectedBvids.value.filter((id) => id !== video.bvid)
    message.success('审核状态已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '审核操作失败')
  } finally {
    videoOperation.value = undefined
  }
}

function updateLocalStatus(video: VideoInfo, status: VideoStatus) {
  if (table.value) {
    const occupiedBefore = video.status !== VideoStatus.Rejected
    const occupiedAfter = status !== VideoStatus.Rejected
    table.value.videoCount += Number(occupiedAfter) - Number(occupiedBefore)
  }
  video.status = status
}

function toggleSelect(bvid: string) {
  const idx = selectedBvids.value.indexOf(bvid)
  if (idx === -1) selectedBvids.value = [...selectedBvids.value, bvid]
  else selectedBvids.value = selectedBvids.value.filter((id) => id !== bvid)
}

function toggleSelectAll() {
  if (isAllSelected.value) {
    selectedBvids.value = []
  } else {
    selectedBvids.value = visibleVideos.value.map((item) => item.info.bvid)
  }
}

function clearSelection() {
  selectedBvids.value = []
}

async function batchSetStatus(status: VideoStatus) {
  const targets = visibleVideos.value.filter((item) => selectedBvids.value.includes(item.info.bvid))
  if (!targets.length) {
    message.warning('请先选择视频')
    return
  }
  isBatchUpdating.value = true
  let success = 0
  let failed = 0
  const concurrency = 4
  let queueIndex = 0

  async function worker() {
    while (queueIndex < targets.length) {
      const current = targets[queueIndex++]
      try {
        const response = await postApiVideoCollectSetStatus({
          id: currentId(),
          bvid: current.info.bvid,
          status: status as any,
        })
        if (response.code !== 200) throw new Error(response.message)
        updateLocalStatus(current.info, status)
        success++
      } catch {
        failed++
      }
    }
  }

  try {
    const workerCount = Math.min(concurrency, targets.length)
    await Promise.all(Array.from({ length: workerCount }, worker))
    selectedBvids.value = []
    if (failed === 0) message.success(`已批量更新 ${success} 条`)
    else message.warning(`成功 ${success} 条，失败 ${failed} 条`)
  } finally {
    isBatchUpdating.value = false
  }
}

async function updateTable(model: VideoCollectCreateModel) {
  tableOperation.value = 'edit'
  try {
    const response = (await postApiVideoCollectUpdate({
      ...model,
      id: currentId(),
    } as any)) as unknown as {
      code: number
      message?: string
      data: VideoCollectTable
    }
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
    const response = await postApiVideoCollectFinish({ id: table.value.id, finish: finish as any })
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
  const text = acceptedVideos.value.map((item) => `https://www.bilibili.com/video/${item.info.bvid}`).join('\n')
  copyToClipboard(text)
  message.success(`已复制 ${acceptedVideos.value.length} 个通过的视频链接`)
}

function exportResults() {
  if (!table.value || acceptedVideos.value.length === 0) return
  const rows = acceptedVideos.value.map(({ info, video }) => ({
    BV号: info.bvid,
    标题: video.title,
    UP主: video.ownerName,
    时长秒: video.length,
    推荐人: info.senders.map((sender) => sender.sender || '匿名用户').join('、'),
    推荐理由: info.senders
      .map((sender) => sender.description)
      .filter(Boolean)
      .join(' | '),
  }))
  const content = `\uFEFF${objectsToCSV(rows)}`
  saveAs(new Blob([content], { type: 'text/csv;charset=utf-8' }), `${table.value.name}-通过结果-${Date.now()}.csv`)
}

function saveQrCode() {
  const canvas = qrCodeWrapper.value?.querySelector('canvas')
  canvas?.toBlob((blob) => {
    if (!blob || !table.value) return
    saveAs(blob, `${table.value.name}-二维码.png`)
  })
}

function openPreview(bvid: string, title: string) {
  previewBvid.value = bvid
  previewTitle.value = title
  previewModalVisible.value = true
}

function openVideoInBili(bvid: string) {
  if (!bvid) return
  window.open(`https://www.bilibili.com/video/${bvid}`, '_blank', 'noopener,noreferrer')
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
      <!-- 紧凑页头与操作区 -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2.5 min-w-0">
          <Button
            size="icon-sm"
            variant="outline"
            title="返回列表"
            class="shrink-0"
            @click="router.push({ name: 'manage-videoCollect' })"
          >
            <component
              :is="ArrowLeft24Regular"
              class="h-4 w-4"
            />
          </Button>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h1 class="text-base font-bold text-foreground truncate">
                {{ table.name }}
              </h1>
              <Badge
                :variant="
                  collectionStatus === '进行中' ? 'secondary' : collectionStatus === '未开始' ? 'outline' : 'default'
                "
                class="text-[10px] px-1.5 py-0 h-4"
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

        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            @click="shareModalVisible = true"
          >
            <component
              :is="Share24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            分享
          </Button>

          <Button
            variant="outline"
            @click="router.push({ name: 'video-collect-list', params: { id: table.id }, query: route.query })"
          >
            <component
              :is="Open24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            展示结果
          </Button>

          <Button
            variant="outline"
            @click="editModalVisible = true"
          >
            <component
              :is="Edit24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            规则
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                size="icon-sm"
                variant="ghost"
              >
                <component
                  :is="MoreVertical24Regular"
                  class="h-3.5 w-3.5"
                />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem @click="toggleCollection">
                <component
                  :is="TableDismiss24Regular"
                  class="h-3.5 w-3.5 mr-1.5"
                />
                {{ isActive ? '结束征集' : '重新开启征集' }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="copyAcceptedBvids"
              >
                <component
                  :is="Copy24Regular"
                  class="h-3.5 w-3.5 mr-1.5"
                />
                复制通过 BV 号 ({{ acceptedVideos.length }})
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="copyAcceptedLinks"
              >
                <component
                  :is="Link24Regular"
                  class="h-3.5 w-3.5 mr-1.5"
                />
                复制通过视频链接
              </DropdownMenuItem>
              <DropdownMenuItem
                :disabled="acceptedVideos.length === 0"
                @click="exportResults"
              >
                <component
                  :is="ArrowDownload24Regular"
                  class="h-3.5 w-3.5 mr-1.5"
                />
                导出结果 (CSV)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="text-destructive"
                @click="deleteModalVisible = true"
              >
                <component
                  :is="Delete24Regular"
                  class="h-3.5 w-3.5 mr-1.5"
                />
                删除征集
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <!-- 规则微型卡片 -->
      <Card class="p-3 flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span class="flex items-center gap-1 font-mono">
            {{ format(toTimestamp(table.startAt), 'MM-dd HH:mm') }} ~
            {{ format(toTimestamp(table.endAt), 'MM-dd HH:mm') }}
          </span>

          <span class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border">
            {{ table.allowUnregisteredUser ? '游客可投' : '仅限绑定' }}
          </span>
          <span class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border">
            {{ table.duplicatePolicy === DuplicateVideoPolicy.Reject ? '拒绝重复' : '重复合并' }}
          </span>
          <span
            v-if="table.maxVideoPerUser"
            class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border"
          >
            每人限 {{ table.maxVideoPerUser }} 个
          </span>
          <span
            v-if="table.minVideoDuration || table.maxVideoDuration"
            class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border"
          >
            时长 {{ table.minVideoDuration ? formatDuration(table.minVideoDuration) : '0' }} ~
            {{ table.maxVideoDuration ? formatDuration(table.maxVideoDuration) : '不限' }}
          </span>

          <Popover v-if="table.allowedPartitions?.length">
            <PopoverTrigger as-child>
              <span
                class="px-1.5 py-0.5 rounded bg-muted/60 text-[11px] border border-border cursor-pointer hover:text-foreground"
              >
                限定 {{ table.allowedPartitions.length }} 个分区
              </span>
            </PopoverTrigger>
            <PopoverContent class="w-64 p-2 text-xs space-y-1.5">
              <div class="font-semibold text-foreground">限定投稿分区：</div>
              <div class="flex flex-wrap gap-1">
                <Badge
                  v-for="p in table.allowedPartitions"
                  :key="p"
                  variant="secondary"
                  class="text-[10px]"
                >
                  {{ p }}
                </Badge>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div class="w-36 space-y-1">
          <div class="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>名额</span>
            <strong class="font-mono text-foreground">{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
          </div>
          <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              class="h-full bg-brand rounded-full transition-all"
              :style="{ width: `${Math.min(100, Math.round((table.videoCount / table.maxVideoCount) * 100))}%` }"
            />
          </div>
        </div>
      </Card>

      <!-- 审核工作台 -->
      <div class="space-y-3">
        <!-- Tab 栏与工具条 -->
        <Card class="p-3 flex items-center justify-between flex-wrap gap-3">
          <div class="inline-flex rounded-md border border-border p-0.5 bg-muted/40">
            <Button
              size="xs"
              :variant="activeStatus === VideoStatus.Pending ? 'brand' : 'ghost'"
              class="h-6 px-2.5 flex items-center gap-1.5"
              @click="activeStatus = VideoStatus.Pending"
            >
              <span>待审核</span>
              <span class="px-1 py-0 rounded-full text-[10px] bg-background text-foreground font-mono font-bold">{{
                pendingVideos.length
              }}</span>
            </Button>
            <Button
              size="xs"
              :variant="activeStatus === VideoStatus.Accepted ? 'brand' : 'ghost'"
              class="h-6 px-2.5 flex items-center gap-1.5"
              @click="activeStatus = VideoStatus.Accepted"
            >
              <span>已通过</span>
              <span class="px-1 py-0 rounded-full text-[10px] bg-background text-foreground font-mono font-bold">{{
                acceptedVideos.length
              }}</span>
            </Button>
            <Button
              size="xs"
              :variant="activeStatus === VideoStatus.Rejected ? 'brand' : 'ghost'"
              class="h-6 px-2.5 flex items-center gap-1.5"
              @click="activeStatus = VideoStatus.Rejected"
            >
              <span>已拒绝</span>
              <span class="px-1 py-0 rounded-full text-[10px] bg-background text-foreground font-mono font-bold">{{
                rejectedVideos.length
              }}</span>
            </Button>
          </div>

          <!-- 右侧工具 -->
          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative w-48 sm:w-56">
              <component
                :is="Search24Regular"
                class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
              />
              <Input
                v-model="keyword"
                placeholder="搜索标题、BV、UP..."
                class="pl-8"
              />
            </div>

            <div class="w-32">
              <Select
                v-model="sortOption"
                default-value="submitted-desc"
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="submitted-desc"> 最新提交 </SelectItem>
                  <SelectItem value="duration-desc"> 时长: 长→短 </SelectItem>
                  <SelectItem value="duration-asc"> 时长: 短→长 </SelectItem>
                  <SelectItem value="title"> 标题排序 </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <ToggleGroup
              :model-value="viewMode"
              type="single"
              size="xs"
              @update:model-value="(val) => val && setViewMode(val as any)"
            >
              <ToggleGroupItem value="list">
                <component
                  :is="TableSimple24Regular"
                  class="h-3.5 w-3.5"
                />
              </ToggleGroupItem>
              <ToggleGroupItem value="grid">
                <component
                  :is="Grid24Regular"
                  class="h-3.5 w-3.5"
                />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              size="icon-sm"
              variant="outline"
              :loading="isLoading"
              @click="loadData"
            >
              <component
                :is="ArrowSync24Regular"
                class="h-3.5 w-3.5"
              />
            </Button>
          </div>
        </Card>

        <!-- 批量操作悬浮条 -->
        <div
          v-if="selectedBvids.length > 0"
          class="p-2.5 rounded-lg border border-brand/40 bg-brand-soft/30 flex items-center justify-between flex-wrap gap-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <span class="font-semibold text-foreground">已选中 {{ selectedBvids.length }} 项</span>
            <Button
              size="xs"
              variant="ghost"
              class="h-6 px-2 text-muted-foreground"
              @click="clearSelection"
            >
              取消勾选
            </Button>
          </div>

          <div class="flex items-center gap-1.5">
            <Button
              v-if="activeStatus !== VideoStatus.Accepted"
              size="xs"
              variant="brand"
              :loading="isBatchUpdating"
              @click="batchSetStatus(VideoStatus.Accepted)"
            >
              <component
                :is="Checkmark24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              批量通过 ({{ selectedBvids.length }})
            </Button>

            <Button
              v-if="activeStatus !== VideoStatus.Rejected"
              size="xs"
              variant="destructive"
              :loading="isBatchUpdating"
              @click="batchSetStatus(VideoStatus.Rejected)"
            >
              <component
                :is="Dismiss24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
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
          class="flex items-center justify-between text-xs text-muted-foreground px-1"
        >
          <div class="flex items-center gap-2">
            <Checkbox
              :checked="isAllSelected"
              @update:checked="toggleSelectAll"
            />
            <span>全选当前 (共 {{ visibleVideos.length }} 条)</span>
          </div>
          <span class="text-[11px] hidden sm:inline">提示: 点击视频封面可就地播放预览</span>
        </div>

        <!-- 视频容器 -->
        <Card
          v-if="visibleVideos.length === 0"
          class="p-12 text-center"
        >
          <div class="text-xs text-muted-foreground">
            {{ keyword ? '未搜索到符合条件的视频' : '当前状态下暂无投稿视频' }}
          </div>
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
            :selected="selectedBvids.includes(item.info.bvid)"
            @update-status="setStatus"
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
            :selected="selectedBvids.includes(item.info.bvid)"
            @update-status="setStatus"
            @toggle-select="toggleSelect"
            @preview="openPreview"
          />
        </div>
      </div>
    </template>

    <Card
      v-else-if="!isLoading"
      class="p-12 text-center space-y-3"
    >
      <div class="text-sm text-muted-foreground">无法加载视频征集：征集不存在，或无访问权限。</div>
      <div>
        <Button
          size="xs"
          variant="outline"
          @click="router.push({ name: 'manage-videoCollect' })"
        >
          返回征集列表
        </Button>
      </div>
    </Card>

    <!-- 分享征集弹窗 -->
    <Dialog
      :open="shareModalVisible"
      @update:open="(val) => (shareModalVisible = val)"
    >
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>分享视频征集</DialogTitle>
          <DialogDescription class="text-xs"> 观众与粉丝扫码即可直接提交视频投稿 </DialogDescription>
        </DialogHeader>

        <div class="flex flex-col items-center space-y-3 py-2">
          <div
            ref="qrCodeWrapper"
            class="p-3 bg-white rounded-lg border border-border"
          >
            <Qrcode
              :value="shareUrl"
              level="Q"
              :size="160"
              background="#ffffff"
              foreground="#000000"
              :margin="2"
            />
          </div>

          <div class="flex items-center gap-1.5 w-full">
            <Input
              :model-value="shareUrl"
              readonly
              class="font-mono flex-1"
            />
            <Button
              variant="brand"
              @click="
                copyToClipboard(shareUrl)
                message.success('链接已复制')
              "
            >
              复制
            </Button>
          </div>

          <Button
            size="xs"
            variant="outline"
            class="w-full"
            @click="saveQrCode"
          >
            <component
              :is="ArrowDownload24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            保存二维码图片
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 编辑规则弹窗 -->
    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集规则"
      :initial-value="editValue"
      :loading="tableOperation === 'edit'"
      @submit="updateTable"
    />

    <!-- 就地播放预览弹窗 -->
    <Dialog
      :open="previewModalVisible"
      @update:open="(val) => (previewModalVisible = val)"
    >
      <DialogContent class="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle class="truncate">
            {{ previewTitle || '视频预览' }}
          </DialogTitle>
          <DialogDescription class="text-xs font-mono"> BV: {{ previewBvid }} </DialogDescription>
        </DialogHeader>

        <div class="w-full aspect-video bg-black rounded-lg overflow-hidden my-2">
          <iframe
            v-if="previewModalVisible && previewBvid"
            :src="`https://player.bilibili.com/player.html?bvid=${previewBvid}&page=1&as_wide=1&high_quality=1&danmaku=0&autoplay=1`"
            scrolling="no"
            border="0"
            frameborder="no"
            framespacing="0"
            allowfullscreen="true"
            class="w-full h-full"
          />
        </div>

        <DialogFooter>
          <Button
            size="xs"
            variant="outline"
            @click="openVideoInBili(previewBvid)"
          >
            <component
              :is="Open24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            在哔哩哔哩打开
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 删除确认对话框 -->
    <AlertDialog
      :open="deleteModalVisible"
      @update:open="(val) => (deleteModalVisible = val)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除视频征集</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定删除“{{ table?.name }}”吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteModalVisible = false"> 取消 </AlertDialogCancel>
          <AlertDialogAction @click="deleteTable"> 确定删除 </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
