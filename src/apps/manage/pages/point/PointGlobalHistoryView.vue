<script setup lang="ts">
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { computed, onMounted, ref, watch } from 'vue'

import { PointFrom, type ResponseGlobalPointHistoriesResult } from '@/api/generated/model'
import { getApiPointHistories } from '@/api/generated/point/point'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { toast } from '@/shared/utils'

type QuickRange = 'all' | 'today' | '7d' | '30d'

const isLoading = ref(false)
const page = ref(1)
const pageSize = ref(30)
const fromFilter = ref<string>('all')
const quickRange = ref<QuickRange>('7d')
const searchKeyword = ref('')
const debouncedKeyword = ref('')
const startDateInput = ref('')
const endDateInput = ref('')

const result = ref<ResponseGlobalPointHistoriesResult>({
  items: [],
  total: 0,
  page: 1,
  pageSize: 30,
  totalEarned: 0,
  totalSpent: 0,
  netChange: 0,
})

const totalPages = computed(() => Math.max(1, Math.ceil((result.value.total || 0) / pageSize.value)))

function applyQuickRange(range: QuickRange) {
  quickRange.value = range
  const now = new Date()
  const toStr = (d: Date) => format(d, 'yyyy-MM-dd')
  if (range === 'all') {
    startDateInput.value = ''
    endDateInput.value = ''
  } else if (range === 'today') {
    const today = toStr(now)
    startDateInput.value = today
    endDateInput.value = today
  } else if (range === '7d') {
    const start = new Date(now)
    start.setDate(start.getDate() - 6)
    startDateInput.value = toStr(start)
    endDateInput.value = toStr(now)
  } else {
    const start = new Date(now)
    start.setDate(start.getDate() - 29)
    startDateInput.value = toStr(start)
    endDateInput.value = toStr(now)
  }
}

applyQuickRange('7d')

const updateSearch = useDebounceFn((v: string) => {
  debouncedKeyword.value = v
}, 300)

watch(searchKeyword, (v) => {
  page.value = 1
  updateSearch(v)
})

watch([fromFilter, debouncedKeyword, startDateInput, endDateInput, pageSize], () => {
  if (page.value !== 1) {
    page.value = 1
  } else {
    void loadHistories()
  }
})

watch(page, () => {
  void loadHistories()
})

let requestSeq = 0

async function loadHistories() {
  const seq = ++requestSeq
  isLoading.value = true
  try {
    const startMs = startDateInput.value ? new Date(`${startDateInput.value}T00:00:00`).getTime() : undefined
    const endMs = endDateInput.value ? new Date(`${endDateInput.value}T23:59:59.999`).getTime() : undefined
    const res = await getApiPointHistories({
      page: page.value,
      pageSize: pageSize.value,
      from: fromFilter.value === 'all' ? undefined : (Number(fromFilter.value) as PointFrom),
      keyword: debouncedKeyword.value.trim() || undefined,
      startTime: startMs && Number.isFinite(startMs) ? startMs : undefined,
      endTime: endMs && Number.isFinite(endMs) ? endMs : undefined,
    })
    if (seq !== requestSeq) return
    if (res.code === 200 && res.data) {
      result.value = res.data
    } else {
      toast.error(res.message || '加载积分流水失败')
    }
  } catch (err) {
    if (seq === requestSeq) {
      toast.error(`加载积分流水失败: ${err instanceof Error ? err.message : String(err)}`)
    }
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
    }
  }
}

function getSourceMeta(from: PointFrom) {
  switch (from) {
    case PointFrom.Danmaku:
      return { label: '直播互动', variant: 'secondary' as const }
    case PointFrom.Manual:
      return { label: '手动/结算', variant: 'outline' as const }
    case PointFrom.Use:
      return { label: '积分消耗', variant: 'destructive' as const }
    case PointFrom.CheckIn:
      return { label: '每日签到', variant: 'success' as const }
    case PointFrom.DailyFirstInteraction:
      return { label: '首次互动', variant: 'secondary' as const }
  }
}

onMounted(() => {
  void loadHistories()
})
</script>

<template>
  <div class="space-y-3.5">
    <!-- 区间收支汇总 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">区间总发放</span>
          <span class="text-lg font-bold font-mono text-emerald-500">
            +{{ Number((result.totalEarned ?? 0).toFixed(2)) }}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">区间总消耗</span>
          <span class="text-lg font-bold font-mono text-rose-500">
            -{{ Number((result.totalSpent ?? 0).toFixed(2)) }}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">区间净变动</span>
          <span
            class="text-lg font-bold font-mono"
            :class="result.netChange >= 0 ? 'text-primary' : 'text-amber-500'"
          >
            {{ result.netChange >= 0 ? '+' : '' }}{{ Number((result.netChange ?? 0).toFixed(2)) }}
          </span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">流水记录数</span>
          <span class="text-lg font-bold font-mono text-foreground">{{ result.total }}</span>
        </CardContent>
      </Card>
    </div>

    <!-- 筛选工具栏 -->
    <div class="p-3 rounded-lg border border-border/80 bg-card flex-between flex-wrap gap-2.5 text-xs">
      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-52 max-w-full">
          <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索用户名或备注"
            class="pl-8"
          />
        </div>

        <Select v-model="fromFilter">
          <SelectTrigger class="w-32">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem :value="String(PointFrom.Danmaku)">直播互动</SelectItem>
            <SelectItem :value="String(PointFrom.CheckIn)">每日签到</SelectItem>
            <SelectItem :value="String(PointFrom.DailyFirstInteraction)">首次互动</SelectItem>
            <SelectItem :value="String(PointFrom.Use)">积分消耗</SelectItem>
            <SelectItem :value="String(PointFrom.Manual)">手动/结算</SelectItem>
          </SelectContent>
        </Select>

        <ToggleGroup
          type="single"
          :model-value="quickRange"
          @update:model-value="(v) => v && applyQuickRange(v as QuickRange)"
        >
          <ToggleGroupItem value="today">今天</ToggleGroupItem>
          <ToggleGroupItem value="7d">近7天</ToggleGroupItem>
          <ToggleGroupItem value="30d">近30天</ToggleGroupItem>
          <ToggleGroupItem value="all">全部</ToggleGroupItem>
        </ToggleGroup>

        <div class="flex items-center gap-1.5">
          <Input
            v-model="startDateInput"
            type="date"
            class="w-34"
          />
          <span class="text-muted-foreground">-</span>
          <Input
            v-model="endDateInput"
            type="date"
            class="w-34"
          />
        </div>
      </div>

      <Button
        variant="outline"
        :loading="isLoading"
        @click="loadHistories"
      >
        <ArrowSync24Regular class="size-3.5 mr-1" />
        刷新
      </Button>
    </div>

    <!-- 流水列表 -->
    <Card>
      <CardContent class="p-0">
        <Spin :show="isLoading">
          <Empty
            v-if="result.items.length === 0"
            description="该筛选条件下暂无积分流水"
            class="py-12"
          />
          <div v-else>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-40">时间</TableHead>
                    <TableHead class="w-40">观众</TableHead>
                    <TableHead class="w-28">来源</TableHead>
                    <TableHead class="w-28 text-right">变动积分</TableHead>
                    <TableHead>详情 / 原因</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="item in result.items"
                    :key="item.id"
                    class="hover:bg-muted/30"
                  >
                    <TableCell class="font-mono text-xs text-muted-foreground">
                      {{ format(item.createAt, 'yyyy-MM-dd HH:mm:ss') }}
                    </TableCell>
                    <TableCell class="font-medium text-xs text-foreground">
                      {{ item.userName }}
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="getSourceMeta(item.from).variant"
                        size="xs"
                      >
                        {{ getSourceMeta(item.from).label }}
                      </Badge>
                    </TableCell>
                    <TableCell
                      class="text-right font-mono font-semibold text-xs"
                      :class="
                        item.point >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      "
                    >
                      {{ item.point >= 0 ? '+' : '' }}{{ Number(item.point.toFixed(2)) }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      <span v-if="item.goodsName">兑换「{{ item.goodsName }}」</span>
                      <span v-else-if="item.reason">{{ item.reason }}</span>
                      <span v-else-if="item.count && item.count > 1">x {{ item.count }}</span>
                      <span v-else>--</span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div class="flex-between px-4 py-3 border-t text-xs">
              <span class="text-muted-foreground">共 {{ result.total }} 条，第 {{ page }} / {{ totalPages }} 页</span>
              <div class="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  :disabled="page <= 1"
                  @click="page--"
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  :disabled="page >= totalPages"
                  @click="page++"
                >
                  下一页
                </Button>
              </div>
            </div>
          </div>
        </Spin>
      </CardContent>
    </Card>
  </div>
</template>
