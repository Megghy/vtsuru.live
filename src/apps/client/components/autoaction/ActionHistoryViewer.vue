<script setup lang="ts">
import { CheckCircle2, Copy, Eye, History, RotateCw, Search, Trash2, XCircle } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { ActionType, VTS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import type { HistoryItem } from '../../store/autoAction/utils/historyLogger'
import {
  clearAllHistory,
  clearHistory,
  getHistoryByType,
  HistoryType,
} from '../../store/autoAction/utils/historyLogger'

const loading = ref(true)
const activeTab = ref<HistoryType>(HistoryType.DANMAKU)
const searchText = ref('')
const statusFilter = ref<'all' | 'success' | 'failed'>('all')
const detailItem = ref<HistoryItem | null>(null)
const showDetailDialog = ref(false)

const historyData = ref<Record<HistoryType, HistoryItem[]>>({
  [HistoryType.DANMAKU]: [],
  [HistoryType.PRIVATE_MSG]: [],
  [HistoryType.COMMAND]: [],
})

const page = ref<Record<HistoryType, number>>({
  [HistoryType.DANMAKU]: 1,
  [HistoryType.PRIVATE_MSG]: 1,
  [HistoryType.COMMAND]: 1,
})
const pageSize = ref(15)

const typeNameMap: Record<HistoryType, string> = {
  [HistoryType.DANMAKU]: '弹幕发送',
  [HistoryType.PRIVATE_MSG]: '私信发送',
  [HistoryType.COMMAND]: '动作与联动',
}

watch([searchText, statusFilter, activeTab], () => {
  page.value[activeTab.value] = 1
})

const filteredList = computed(() => {
  let list = historyData.value[activeTab.value] || []
  if (statusFilter.value === 'success') list = list.filter((item) => item.success)
  else if (statusFilter.value === 'failed') list = list.filter((item) => !item.success)

  if (searchText.value.trim()) {
    const q = searchText.value.trim().toLowerCase()
    list = list.filter(
      (item) =>
        (item.actionName || '').toLowerCase().includes(q) ||
        (item.content || '').toLowerCase().includes(q) ||
        (item.error || '').toLowerCase().includes(q) ||
        (item.target || '').toLowerCase().includes(q),
    )
  }
  return list
})

const paginatedList = computed(() => {
  const p = page.value[activeTab.value] || 1
  const start = (p - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

function getFailedCount(type: HistoryType): number {
  return (historyData.value[type] || []).filter((item) => !item.success).length
}

function getActionTypeLabel(actionType: ActionType): string {
  switch (actionType) {
    case ActionType.SEND_DANMAKU:
      return '弹幕'
    case ActionType.SEND_PRIVATE_MSG:
      return '私信'
    case ActionType.PLAY_AUDIO:
      return '音效'
    case ActionType.PNGTUBER_EXPRESSION:
      return 'PNGtuber'
    default:
      if (VTS_ACTION_TYPES.has(actionType)) return 'VTS'
      return '命令'
  }
}

function openDetail(item: HistoryItem) {
  detailItem.value = item
  showDetailDialog.value = true
}

function copyText(text: string) {
  void navigator.clipboard.writeText(text)
  toast.success('已复制到剪贴板')
}

const refreshInterval = 30000
let refreshTimer: number | null = null

async function loadHistory() {
  loading.value = true
  try {
    const [danmakuHistory, privateMsgHistory, commandHistory] = await Promise.all([
      getHistoryByType(HistoryType.DANMAKU),
      getHistoryByType(HistoryType.PRIVATE_MSG),
      getHistoryByType(HistoryType.COMMAND),
    ])

    historyData.value = {
      [HistoryType.DANMAKU]: danmakuHistory.toSorted((a, b) => b.timestamp - a.timestamp),
      [HistoryType.PRIVATE_MSG]: privateMsgHistory.toSorted((a, b) => b.timestamp - a.timestamp),
      [HistoryType.COMMAND]: commandHistory.toSorted((a, b) => b.timestamp - a.timestamp),
    }
  } catch (error) {
    console.error('加载历史数据失败:', error)
    toast.error('加载历史数据失败')
  } finally {
    loading.value = false
  }
}

async function handleClearHistory(type: HistoryType) {
  try {
    await clearHistory(type)
    historyData.value[type] = []
    page.value[type] = 1
    toast.success(`已清空${typeNameMap[type]}历史`)
  } catch (error) {
    console.error('清除历史失败:', error)
    toast.error('清除历史失败')
  }
}

async function handleClearAllHistory() {
  try {
    await clearAllHistory()
    Object.keys(historyData.value).forEach((type) => {
      historyData.value[type as HistoryType] = []
      page.value[type as HistoryType] = 1
    })
    toast.success('已清空所有历史记录')
  } catch (error) {
    console.error('清除所有历史失败:', error)
    toast.error('清除所有历史失败')
  }
}

function startRefreshTimer() {
  stopRefreshTimer()
  refreshTimer = window.setInterval(() => {
    void loadHistory()
  }, refreshInterval)
}

function stopRefreshTimer() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  void loadHistory()
  startRefreshTimer()
})

onUnmounted(() => {
  stopRefreshTimer()
})
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex flex-row items-center justify-between space-y-0">
      <div class="flex items-center gap-2">
        <History class="size-4 text-primary" />
        <CardTitle class="text-xs font-semibold">执行历史记录</CardTitle>
      </div>

      <div class="flex items-center gap-2">
        <Button
          variant="secondary"
          class="gap-1.5"
          :disabled="loading"
          @click="loadHistory"
        >
          <RotateCw
            class="size-3.5"
            :class="{ 'animate-spin': loading }"
          />
          刷新
        </Button>
        <Popconfirm
          title="确定清空所有类型的历史记录吗？"
          description="此操作不可恢复。"
          @confirm="handleClearAllHistory"
        >
          <Button
            variant="outline"
            class="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 class="size-3.5" />
            清空所有
          </Button>
        </Popconfirm>
      </div>
    </CardHeader>

    <CardContent class="p-3 space-y-3">
      <Tabs
        v-model="activeTab"
        class="w-full"
      >
        <div class="flex-between gap-2.5 flex-wrap">
          <TabsList class="grid grid-cols-3 w-full max-w-[380px]">
            <TabsTrigger
              v-for="(label, type) in typeNameMap"
              :key="type"
              :value="type"
              class="gap-1.5"
            >
              <span>{{ label }}</span>
              <Badge
                v-if="getFailedCount(type as HistoryType) > 0"
                variant="destructive"
                size="xs"
                class="tabular-nums"
              >
                {{ getFailedCount(type as HistoryType) }}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <div class="flex items-center gap-2 flex-wrap">
            <div class="relative w-44">
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <Input
                v-model="searchText"
                placeholder="搜索规则/内容/报错..."
                class="pl-8 pr-2"
              />
            </div>

            <div class="w-28">
              <Select v-model="statusFilter">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="success">仅成功</SelectItem>
                  <SelectItem value="failed">仅失败</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <TabsContent
          v-for="(label, type) in typeNameMap"
          :key="type"
          :value="type"
          class="pt-3 space-y-3"
        >
          <div class="border rounded-md overflow-x-auto bg-card">
            <Table>
              <TableHeader>
                <TableRow class="[&_th]:whitespace-nowrap">
                  <TableHead class="w-28">时间</TableHead>
                  <TableHead class="w-36">规则名称</TableHead>
                  <TableHead
                    v-if="type === HistoryType.COMMAND"
                    class="w-24 text-center"
                  >
                    类型
                  </TableHead>
                  <TableHead class="min-w-[180px]">执行内容 / 摘要</TableHead>
                  <TableHead
                    v-if="type !== HistoryType.COMMAND"
                    class="w-28"
                  >
                    目标
                  </TableHead>
                  <TableHead class="text-center w-20">状态</TableHead>
                  <TableHead class="text-right w-16">详情</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="paginatedList.length > 0">
                  <TableRow
                    v-for="row in paginatedList"
                    :key="row.id"
                    class="cursor-pointer hover:bg-muted/40"
                    @click="openDetail(row)"
                  >
                    <TableCell class="text-muted-foreground whitespace-nowrap tabular-nums">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger class="cursor-help underline decoration-dotted">
                            {{ new Date(row.timestamp).toLocaleTimeString() }}
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ new Date(row.timestamp).toLocaleString() }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        size="xs"
                        class="max-w-[130px] truncate"
                      >
                        {{ row.actionName || '未命名' }}
                      </Badge>
                    </TableCell>

                    <TableCell
                      v-if="type === HistoryType.COMMAND"
                      class="text-center"
                    >
                      <Badge
                        variant="outline"
                        size="xs"
                      >
                        {{ getActionTypeLabel(row.actionType) }}
                      </Badge>
                    </TableCell>

                    <TableCell class="max-w-[320px]">
                      <div class="font-mono text-xs truncate">
                        {{ row.content }}
                      </div>
                      <div
                        v-if="!row.success && row.error"
                        class="text-[11px] text-destructive truncate mt-0.5"
                      >
                        {{ row.error }}
                      </div>
                    </TableCell>

                    <TableCell v-if="type !== HistoryType.COMMAND">
                      <Badge
                        v-if="row.target"
                        variant="outline"
                        size="xs"
                        class="border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10 tabular-nums"
                      >
                        {{ row.target }}
                      </Badge>
                      <span
                        v-else
                        class="text-muted-foreground"
                      >
                        -
                      </span>
                    </TableCell>

                    <TableCell class="text-center">
                      <TooltipProvider>
                        <Tooltip v-if="row.success">
                          <TooltipTrigger>
                            <CheckCircle2 class="size-4 text-emerald-500 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>执行成功</TooltipContent>
                        </Tooltip>
                        <Tooltip v-else>
                          <TooltipTrigger>
                            <XCircle class="size-4 text-destructive mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>{{ row.error || '执行失败' }}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell class="text-right">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        aria-label="查看详情"
                        @click.stop="openDetail(row)"
                      >
                        <Eye class="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow>
                    <TableCell
                      colspan="6"
                      class="text-center py-8"
                    >
                      <Empty :description="searchText || statusFilter !== 'all' ? '没有匹配的记录' : '暂无历史记录'" />
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="(historyData[type as HistoryType] || []).length > 0"
            class="flex-between pt-1"
          >
            <Popconfirm
              :title="`确定清空所有${label}历史记录吗？`"
              description="此操作不可恢复。"
              @confirm="handleClearHistory(type as HistoryType)"
            >
              <Button
                size="xs"
                variant="ghost"
                class="text-amber-600 hover:text-amber-700 gap-1"
              >
                <Trash2 class="size-3.5" />
                清空{{ label }}历史
              </Button>
            </Popconfirm>

            <Pagination
              v-if="filteredList.length > pageSize"
              :page="page[type as HistoryType]"
              :page-size="pageSize"
              :total="filteredList.length"
              @update:page="page[type as HistoryType] = $event"
            />
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>

    <!-- 详情弹窗 -->
    <Dialog v-model:open="showDetailDialog">
      <DialogContent class="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle class="text-sm flex items-center gap-2">
            <span>执行记录详情</span>
            <Badge
              v-if="detailItem"
              :variant="detailItem.success ? 'success' : 'destructive'"
              size="xs"
            >
              {{ detailItem.success ? '成功' : '失败' }}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div
          v-if="detailItem"
          class="space-y-3 text-xs"
        >
          <div class="grid grid-cols-2 gap-2 p-2.5 rounded-md bg-muted/40 border">
            <div>
              <span class="text-muted-foreground">规则名称：</span>
              <span class="font-medium text-foreground">{{ detailItem.actionName || '未命名' }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">动作类型：</span>
              <span class="font-medium text-foreground">{{ getActionTypeLabel(detailItem.actionType) }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">执行时间：</span>
              <span class="tabular-nums">{{ new Date(detailItem.timestamp).toLocaleString() }}</span>
            </div>
            <div>
              <span class="text-muted-foreground">目标：</span>
              <span class="tabular-nums">{{ detailItem.target || '-' }}</span>
            </div>
          </div>

          <div class="space-y-1">
            <div class="flex-between">
              <span class="font-semibold text-foreground">执行内容</span>
              <Button
                size="xs"
                variant="ghost"
                class="gap-1"
                @click="copyText(detailItem.content)"
              >
                <Copy class="size-3.5" />
                复制内容
              </Button>
            </div>
            <pre class="p-2.5 rounded-md bg-muted/50 border font-mono text-xs whitespace-pre-wrap break-all max-h-40 overflow-y-auto scrollbar-thin">{{ detailItem.content }}</pre>
          </div>

          <div
            v-if="detailItem.error"
            class="space-y-1"
          >
            <div class="flex-between">
              <span class="font-semibold text-destructive">错误信息</span>
              <Button
                size="xs"
                variant="ghost"
                class="gap-1 text-destructive"
                @click="copyText(detailItem.error)"
              >
                <Copy class="size-3.5" />
                复制报错
              </Button>
            </div>
            <pre class="p-2.5 rounded-md bg-destructive/10 border border-destructive/30 font-mono text-xs text-destructive whitespace-pre-wrap break-all max-h-40 overflow-y-auto scrollbar-thin">{{ detailItem.error }}</pre>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </Card>
</template>
