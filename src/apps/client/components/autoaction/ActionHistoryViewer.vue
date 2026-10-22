<script setup lang="ts">
import {
  ArrowClockwise16Filled,
  CheckmarkCircle16Filled,
  Delete16Filled,
  DismissCircle16Filled,
  History16Regular,
} from '@vicons/fluent'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { HistoryItem } from '../../store/autoAction/utils/historyLogger'
import {
  clearAllHistory,
  clearHistory,
  getHistoryByType,
  HistoryType,
} from '../../store/autoAction/utils/historyLogger'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const loading = ref(true)
const activeTab = ref(HistoryType.DANMAKU)
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
const pageSize = ref(10)

const typeNameMap = {
  [HistoryType.DANMAKU]: '弹幕发送',
  [HistoryType.PRIVATE_MSG]: '私信发送',
  [HistoryType.COMMAND]: '命令执行',
}

const refreshInterval = 30000
let refreshTimer: number | null = null

const currentList = computed(() => historyData.value[activeTab.value] || [])
const paginatedList = computed(() => {
  const p = page.value[activeTab.value] || 1
  const start = (p - 1) * pageSize.value
  return currentList.value.slice(start, start + pageSize.value)
})

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
    loadHistory()
  }, refreshInterval)
}

function stopRefreshTimer() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  loadHistory()
  startRefreshTimer()
})

onUnmounted(() => {
  stopRefreshTimer()
})
</script>

<template>
  <Card class="border bg-card">
    <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
      <div class="flex items-center gap-2">
        <History16Regular class="size-4 text-primary" />
        <CardTitle class="text-sm font-semibold">执行历史记录</CardTitle>
      </div>

      <div class="flex items-center gap-2">
        <Button variant="secondary" class="gap-1" :disabled="loading" @click="loadHistory">
          <ArrowClockwise16Filled class="size-3.5" :class="{ 'animate-spin': loading }" />
          刷新
        </Button>
        <Popconfirm
          title="清空所有历史"
          @positive-click="handleClearAllHistory"
        >
          <template #trigger>
            <Button variant="outline" class="border-destructive/40 text-destructive hover:bg-destructive/10 gap-1">
              <Delete16Filled class="size-3.5" />
              清空所有
            </Button>
          </template>
          确定要清空所有类型的历史记录吗？此操作不可恢复。
        </Popconfirm>
      </div>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs v-model="activeTab" class="w-full">
        <TabsList class="grid w-full grid-cols-3 max-w-[360px]">
          <TabsTrigger
            v-for="(label, type) in typeNameMap"
            :key="type"
            :value="type"
            class="text-xs"
          >
            {{ label }}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          v-for="(label, type) in typeNameMap"
          :key="type"
          :value="type"
          class="pt-3 space-y-3"
        >
          <div class="border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="text-xs w-[160px]">时间</TableHead>
                  <TableHead class="text-xs w-[140px]">操作名称</TableHead>
                  <TableHead class="text-xs">内容</TableHead>
                  <TableHead class="text-xs w-[120px]">目标</TableHead>
                  <TableHead class="text-xs text-center w-[80px]">状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="paginatedList.length > 0">
                  <TableRow
                    v-for="row in paginatedList"
                    :key="row.id"
                  >
                    <TableCell class="text-xs text-muted-foreground whitespace-nowrap">
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

                    <TableCell class="text-xs">
                      <Badge
                        variant="secondary"
                        class="text-[10px] h-5 px-1.5 font-normal max-w-[130px] truncate"
                      >
                        {{ row.actionName || '未命名' }}
                      </Badge>
                    </TableCell>

                    <TableCell class="text-xs font-mono max-w-[300px] truncate" :title="row.content">
                      {{ row.content }}
                    </TableCell>

                    <TableCell class="text-xs">
                      <Badge
                        v-if="row.target"
                        variant="outline"
                        class="text-[10px] h-5 px-1.5 border-sky-500/40 text-sky-600 bg-sky-500/10"
                      >
                        {{ row.target }}
                      </Badge>
                      <span v-else class="text-muted-foreground">-</span>
                    </TableCell>

                    <TableCell class="text-center">
                      <TooltipProvider>
                        <Tooltip v-if="row.success">
                          <TooltipTrigger>
                            <CheckmarkCircle16Filled class="size-4 text-emerald-500 mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>执行成功</TooltipContent>
                        </Tooltip>
                        <Tooltip v-else>
                          <TooltipTrigger>
                            <DismissCircle16Filled class="size-4 text-destructive mx-auto" />
                          </TooltipTrigger>
                          <TooltipContent>{{ row.error || '执行失败' }}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow>
                    <TableCell colspan="5" class="text-center py-8">
                      <Empty description="暂无历史记录" />
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="currentList.length > 0"
            class="flex items-center justify-between pt-1"
          >
            <Popconfirm
              title="确认清空"
              @positive-click="handleClearHistory(type as HistoryType)"
            >
              <template #trigger>
                <Button size="xs" variant="ghost" class="h-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30 gap-1">
                  <Delete16Filled class="size-3" />
                  清空{{ label }}历史
                </Button>
              </template>
              确定要清空所有{{ label }}历史记录吗？此操作不可恢复。
            </Popconfirm>

            <Pagination
              v-if="currentList.length > pageSize"
              :page="page[type as HistoryType]"
              :page-size="pageSize"
              :total="currentList.length"
              size="small"
              @update:page="page[type as HistoryType] = $event"
            />
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>
  </Card>
</template>
