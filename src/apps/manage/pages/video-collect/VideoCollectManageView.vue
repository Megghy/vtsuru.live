<script setup lang="ts">
import {
  Add20Regular,
  ArrowRight24Regular,
  ArrowSync24Regular,
  Copy24Regular,
  Delete24Regular,
  Edit24Regular,
  Folder24Regular,
  MoreVertical24Regular,
  Open24Regular,
  Search24Regular,
  TableDismiss24Regular,
  Timer24Regular,
  Video24Regular,
} from '@vicons/fluent'
import { format } from 'date-fns'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { RequestVideoTable, ResponseVideoCollectModel } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import {
  getApiVideoCollectGetAll,
  postApiVideoCollectCreate,
  postApiVideoCollectDelete,
  postApiVideoCollectFinish,
  postApiVideoCollectUpdate,
} from '@/api/generated/video-collect/video-collect'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Skeleton } from '@/shared/ui/skeleton'
import { useMessage } from '@/shared/utils'
import { copyToClipboard } from '@/shared/utils'

import VideoCollectFormModal from './VideoCollectFormModal.vue'

type StatusFilter = 'all' | 'active' | 'finished'

const message = useMessage()
const router = useRouter()
const accountInfo = useAccount()

const videoTables = ref<ResponseVideoCollectModel[]>([])
const isLoading = ref(false)
const isCreating = ref(false)
const createModalVisible = ref(false)
const editModalVisible = ref(false)
const currentEditingTable = ref<ResponseVideoCollectModel>()
const keyword = ref('')
const statusFilter = ref<StatusFilter>('all')

const deleteModalVisible = ref(false)
const tableToDelete = ref<ResponseVideoCollectModel | null>(null)

const videoCollectUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/video-collect` : '',
)
const activeTables = computed(() => videoTables.value.filter(isActive))
const totalVideoCount = computed(() => videoTables.value.reduce((sum, table) => sum + table.videoCount, 0))
const filteredTables = computed(() => {
  const search = keyword.value.trim().toLocaleLowerCase()

  return videoTables.value
    .filter((table) => {
      if (statusFilter.value === 'active' && !isActive(table)) return false
      if (statusFilter.value === 'finished' && isActive(table)) return false
      if (!search) return true
      return `${table.name} ${table.description}`.toLocaleLowerCase().includes(search)
    })
    .toSorted((a, b) => Number(isActive(b)) - Number(isActive(a)) || b.createAt - a.createAt)
})

const editInitialValue = computed<RequestVideoTable | undefined>(() => {
  if (!currentEditingTable.value) return undefined
  const t = currentEditingTable.value
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    startAt: t.startAt,
    endAt: t.endAt,
    maxVideoCount: t.maxVideoCount,
    minVideoDuration: t.minVideoDuration,
    maxVideoDuration: t.maxVideoDuration,
    allowedPartitions: [...(t.allowedPartitions ?? [])],
    allowUnregisteredUser: t.allowUnregisteredUser,
    maxVideoPerUser: t.maxVideoPerUser,
    requireDescription: t.requireDescription,
    duplicatePolicy: t.duplicatePolicy,
  }
})

void loadTables()

function isActive(table: ResponseVideoCollectModel) {
  return !table.isFinish && table.endAt > Date.now()
}

function tableStatus(table: ResponseVideoCollectModel) {
  if (!isActive(table)) return '已结束'
  if (table.startAt > Date.now()) return '未开始'
  return '进行中'
}

function capacityPercentage(table: ResponseVideoCollectModel) {
  return Math.min(100, Math.round((table.videoCount / table.maxVideoCount) * 100))
}

async function loadTables() {
  isLoading.value = true
  try {
    const response = (await getApiVideoCollectGetAll()) as unknown as {
      code: number
      message?: string
      data: ResponseVideoCollectModel[]
    }
    if (response.code !== 200) throw new Error(response.message)
    videoTables.value = response.data
  } catch (error) {
    console.error(error)
    message.error('视频征集列表加载失败')
  } finally {
    isLoading.value = false
  }
}

async function createTable(model: RequestVideoTable) {
  isCreating.value = true
  try {
    const response = (await postApiVideoCollectCreate(model as any)) as unknown as {
      code: number
      message?: string
      data: ResponseVideoCollectModel
    }
    if (response.code !== 200) throw new Error(response.message)
    videoTables.value.unshift(response.data)
    createModalVisible.value = false
    message.success('征集已创建')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '创建失败')
  } finally {
    isCreating.value = false
  }
}

async function updateTable(model: RequestVideoTable) {
  if (!currentEditingTable.value) return
  isCreating.value = true
  try {
    const response = (await postApiVideoCollectUpdate({
      ...model,
      id: currentEditingTable.value.id,
    } as any)) as unknown as {
      code: number
      message?: string
      data: ResponseVideoCollectModel
    }
    if (response.code !== 200) throw new Error(response.message)
    const idx = videoTables.value.findIndex((t) => t.id === currentEditingTable.value?.id)
    if (idx !== -1) videoTables.value[idx] = response.data
    editModalVisible.value = false
    message.success('征集规则已更新')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '更新失败')
  } finally {
    isCreating.value = false
  }
}

function copyShareLink(table: ResponseVideoCollectModel) {
  const url = `${CURRENT_HOST}video-collect/${table.shortId}`
  copyToClipboard(url)
  message.success('已复制投稿页面链接')
}

function openResultPage(table: ResponseVideoCollectModel) {
  router.push({ name: 'video-collect-list', params: { id: table.id } })
}

function openEditModal(table: ResponseVideoCollectModel) {
  currentEditingTable.value = table
  editModalVisible.value = true
}

async function toggleFinish(table: ResponseVideoCollectModel) {
  const finish = !table.isFinish
  try {
    const response = await postApiVideoCollectFinish({ id: table.id, finish: finish as any })
    if (response.code !== 200) throw new Error(response.message)
    table.isFinish = finish
    message.success(finish ? '征集已结束' : '征集已重新开启')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '操作失败')
  }
}

function promptDelete(table: ResponseVideoCollectModel) {
  tableToDelete.value = table
  deleteModalVisible.value = true
}

async function confirmDelete() {
  if (!tableToDelete.value) return
  const id = tableToDelete.value.id
  try {
    const response = await postApiVideoCollectDelete({ id })
    if (response.code !== 200) throw new Error(response.message)
    videoTables.value = videoTables.value.filter((t) => t.id !== id)
    message.success('征集已删除')
  } catch (error) {
    console.error(error)
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    deleteModalVisible.value = false
    tableToDelete.value = null
  }
}
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="视频征集"
      subtitle="征集活动管理与投稿审核"
      :function-type="FunctionTypes.VideoCollect"
      :links="[{ label: '公开展示页', value: videoCollectUrl }]"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            :loading="isLoading"
            @click="loadTables"
          >
            <component
              :is="ArrowSync24Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            刷新
          </Button>
          <Button
            variant="brand"
            @click="createModalVisible = true"
          >
            <component
              :is="Add20Regular"
              class="h-3.5 w-3.5 mr-1"
            />
            新建征集
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <!-- Bento 概览看板 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <Card
        class="p-3 cursor-pointer transition-all hover:border-brand/40"
        :class="{ 'border-brand bg-brand-soft/20': statusFilter === 'all' }"
        @click="statusFilter = 'all'"
      >
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>全部征集</span>
          <component
            :is="Folder24Regular"
            class="h-4 w-4"
          />
        </div>
        <div class="text-2xl font-bold font-mono text-foreground mt-1">
          {{ videoTables.length }}
        </div>
      </Card>

      <Card
        class="p-3 cursor-pointer transition-all hover:border-brand/40"
        :class="{ 'border-brand bg-brand-soft/20': statusFilter === 'active' }"
        @click="statusFilter = 'active'"
      >
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>进行中 / 开放中</span>
          <component
            :is="Timer24Regular"
            class="h-4 w-4 text-emerald-500"
          />
        </div>
        <div class="text-2xl font-bold font-mono text-emerald-500 mt-1">
          {{ activeTables.length }}
        </div>
      </Card>

      <Card class="p-3">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>累计征集视频</span>
          <component
            :is="Video24Regular"
            class="h-4 w-4 text-brand"
          />
        </div>
        <div class="text-2xl font-bold font-mono text-foreground mt-1">
          {{ totalVideoCount }}
        </div>
      </Card>
    </div>

    <!-- 工具栏 -->
    <Card class="p-3 flex items-center justify-between flex-wrap gap-2.5">
      <div class="relative w-72">
        <component
          :is="Search24Regular"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
        />
        <Input
          v-model="keyword"
          placeholder="搜索征集名称或说明..."
          class="pl-8"
        />
      </div>

      <div class="w-40">
        <Select
          v-model="statusFilter"
          default-value="all"
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"> 全部状态 </SelectItem>
            <SelectItem value="active"> 仅进行中 / 开放中 </SelectItem>
            <SelectItem value="finished"> 仅已结束 </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </Card>

    <!-- 列表区 -->
    <div
      v-if="isLoading && !videoTables.length"
      class="space-y-3"
    >
      <Skeleton
        v-for="i in 3"
        :key="i"
        class="h-24 rounded-lg"
      />
    </div>

    <Card
      v-else-if="!filteredTables.length"
      class="p-12 text-center"
    >
      <div class="text-muted-foreground text-sm">
        {{ videoTables.length === 0 ? '暂无视频征集活动' : '没有符合条件的征集' }}
      </div>
      <div
        v-if="videoTables.length === 0"
        class="mt-3"
      >
        <Button
          size="xs"
          variant="brand"
          @click="createModalVisible = true"
        >
          立即创建第一个征集
        </Button>
      </div>
    </Card>

    <div
      v-else
      class="space-y-2.5"
    >
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="p-3 rounded-lg border border-border bg-card/60 hover:bg-muted/40 cursor-pointer transition-colors flex items-center justify-between flex-wrap gap-3"
        @click="router.push({ name: 'manage-videoCollect-Detail', params: { id: table.id } })"
      >
        <!-- 主体信息 -->
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-center gap-2">
            <Badge
              :variant="
                tableStatus(table) === '进行中' ? 'secondary' : tableStatus(table) === '未开始' ? 'outline' : 'default'
              "
              class="text-[10px] px-1.5 py-0 h-4"
            >
              {{ tableStatus(table) }}
            </Badge>
            <strong
              class="text-sm font-semibold truncate text-foreground hover:text-brand transition-colors"
              :title="table.name"
            >
              {{ table.name }}
            </strong>
          </div>
          <p
            class="text-xs text-muted-foreground line-clamp-1"
            :title="table.description"
          >
            {{ table.description || '未填写征集说明' }}
          </p>
        </div>

        <!-- 时间与进度 -->
        <div class="flex items-center gap-4 sm:gap-6 text-xs text-muted-foreground shrink-0">
          <div>
            <div class="text-[10px]">
              {{ tableStatus(table) === '未开始' ? '开放时间' : '截止时间' }}
            </div>
            <div class="font-mono text-xs text-foreground mt-0.5">
              {{ format(tableStatus(table) === '未开始' ? table.startAt : table.endAt, 'yyyy-MM-dd HH:mm') }}
            </div>
          </div>

          <div class="w-28 space-y-1">
            <div class="flex items-center justify-between text-[10px]">
              <span>名额占用</span>
              <strong class="font-mono text-foreground">{{ table.videoCount }} / {{ table.maxVideoCount }}</strong>
            </div>
            <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                class="h-full bg-brand transition-all rounded-full"
                :style="{ width: `${capacityPercentage(table)}%` }"
              />
            </div>
          </div>

          <!-- 行内操作 -->
          <div
            class="flex items-center gap-1"
            @click.stop
          >
            <Button
              size="xs"
              variant="outline"
              title="复制投稿页面链接"
              @click.stop="copyShareLink(table)"
            >
              <component
                :is="Copy24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              链接
            </Button>
            <Button
              size="xs"
              variant="outline"
              title="查看展示结果页"
              @click.stop="openResultPage(table)"
            >
              <component
                :is="Open24Regular"
                class="h-3.5 w-3.5 mr-1"
              />
              结果
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger as-child>
                <Button
                  size="icon-xs"
                  variant="ghost"
                >
                  <component
                    :is="MoreVertical24Regular"
                    class="h-3.5 w-3.5"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem @click="openEditModal(table)">
                  <component
                    :is="Edit24Regular"
                    class="h-3.5 w-3.5 mr-1.5"
                  />
                  编辑规则
                </DropdownMenuItem>
                <DropdownMenuItem @click="toggleFinish(table)">
                  <component
                    :is="TableDismiss24Regular"
                    class="h-3.5 w-3.5 mr-1.5"
                  />
                  {{ isActive(table) ? '结束征集' : '重新开启' }}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  class="text-destructive"
                  @click="promptDelete(table)"
                >
                  <component
                    :is="Delete24Regular"
                    class="h-3.5 w-3.5 mr-1.5"
                  />
                  删除征集
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <component
              :is="ArrowRight24Regular"
              class="h-4 w-4 text-muted-foreground ml-1"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 新建弹窗 -->
    <VideoCollectFormModal
      v-model:show="createModalVisible"
      title="新建视频征集"
      :loading="isCreating"
      @submit="createTable"
    />

    <!-- 编辑弹窗 -->
    <VideoCollectFormModal
      v-model:show="editModalVisible"
      title="编辑视频征集规则"
      :initial-value="editInitialValue"
      :loading="isCreating"
      @submit="updateTable"
    />

    <!-- 删除确认对话框 -->
    <AlertDialog
      :open="deleteModalVisible"
      @update:open="(val) => (deleteModalVisible = val)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>删除视频征集</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定删除“{{ tableToDelete?.name }}”吗？此操作无法撤销。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="deleteModalVisible = false"> 取消 </AlertDialogCancel>
          <AlertDialogAction @click="confirmDelete"> 确定删除 </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
