<script setup lang="ts">
import { ArrowDownload24Regular, ArrowSync24Filled, Delete24Regular, Grid28Filled, List16Filled } from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { EventModel } from '@/api/api-models'
import { EventDataTypes } from '@/api/api-models'
import { getApiEventGet, postApiEventGuardDelete, postApiEventGuardManual } from '@/api/generated/event/event'
import { getApiHistoryGuardsList, getApiHistoryGuardsStats } from '@/api/generated/history/history'
import EventFetcherAlert from '@/apps/manage/components/event-fetcher/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
import { AVATAR_URL } from '@/shared/config'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { DateRangePicker } from '@/shared/ui/date-picker'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'
import { GuidUtils } from '@/shared/utils'

interface GuardMemberModel {
  guardOUId: string
  username: string
  guardLevel: string
  accompanyDays: number
  isActive: boolean
  lastUpdateTime: string
}

interface GuardStatsModel {
  totalCount: number
  governorCount: number
  admiralCount: number
  captainCount: number
  avgAccompanyDays: number
  maxAccompanyDays: number
  lastUpdateTime: string
}

const accountInfo = useAccount()
const message = useMessage()
const { run } = useApiAction()

// 日期范围与快捷方式
const curDate = new Date()
const thisMonthStart = new Date(curDate.getFullYear(), curDate.getMonth(), 1).getTime()
const selectedDate = ref<[number, number]>([thisMonthStart, curDate.getTime()])
const startDateInput = ref(format(thisMonthStart, 'yyyy-MM-dd'))
const endDateInput = ref(format(curDate, 'yyyy-MM-dd'))

function setDateRangePreset(type: 'thisMonth' | 'lastMonth') {
  const now = new Date()
  if (type === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
    const end = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    selectedDate.value = [start, end]
    startDateInput.value = format(start, 'yyyy-MM-dd')
    endDateInput.value = format(end, 'yyyy-MM-dd')
  } else {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
    const end = now.getTime()
    selectedDate.value = [start, end]
    startDateInput.value = format(start, 'yyyy-MM-dd')
    endDateInput.value = format(end, 'yyyy-MM-dd')
  }
}

function handleDateInputChange() {
  if (!startDateInput.value || !endDateInput.value) return
  const s = new Date(startDateInput.value).getTime()
  const e = new Date(endDateInput.value).setHours(23, 59, 59, 999)
  if (s <= e) {
    selectedDate.value = [s, e]
  } else {
    selectedDate.value = [e, s]
  }
}

const selectedType = ref(EventDataTypes.Guard)
const events = ref<EventModel[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const displayMode = ref<'grid' | 'column'>('grid')
const exportType = ref<'json' | 'csv'>('csv')
const offset = ref(0)
const limit = ref(20)
const hasMore = ref(true)

const userFilterInput = ref('')
const userFilterApplied = ref<{ uid?: number; ouid?: string; uname?: string }>({})

function isGuidText(text: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)
}

function parseUserFilter(text: string) {
  const t = text.trim()
  if (!t) return {}
  if (/^\d+$/.test(t)) {
    const uid = Number(t)
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new Error('UID 无效')
    }
    return { uid }
  }
  if (isGuidText(t)) {
    return { ouid: t }
  }
  return { uname: t }
}

async function applyUserFilter() {
  try {
    userFilterApplied.value = parseUserFilter(userFilterInput.value)
    await fetchData(true)
  } catch (e) {
    message.error((e as Error).message)
  }
}

async function clearUserFilter() {
  userFilterInput.value = ''
  userFilterApplied.value = {}
  await fetchData(true)
}

const selectedEvents = computed(() => {
  return events.value.filter((e) => e.type == selectedType.value)
})

const eventSummary = computed(() => {
  const list = selectedEvents.value
  const uniqueUsers = new Set(list.map((e) => e.ouid || String(e.uid) || e.uname)).size
  const totalPrice = list.reduce((sum, e) => sum + (Number(e.price) || 0), 0)
  const totalNum = list.reduce((sum, e) => sum + (Number(e.num) || 0), 0)
  return {
    count: list.length,
    uniqueUsers,
    totalPrice,
    totalNum,
  }
})

let fetchGen = 0
let inFlightKey = ''

function currentQueryKey() {
  const filter = userFilterApplied.value
  return `${selectedDate.value[0]}:${selectedDate.value[1]}:${selectedType.value}:${filter.uid ?? ''}:${filter.ouid ?? ''}:${filter.uname ?? ''}`
}

async function get(currentOffset: number, currentLimit: number) {
  try {
    const data = (await getApiEventGet({
      start: selectedDate.value[0],
      end: selectedDate.value[1],
      offset: currentOffset,
      limit: currentLimit,
      type: selectedType.value,
      uid: userFilterApplied.value.uid,
      ouid: userFilterApplied.value.ouid,
      uname: userFilterApplied.value.uname,
    })) as unknown as {
      code: number
      message?: string
      data: EventModel[]
    }
    if (data.code == 200) {
      return data.data
    } else {
      message.error(`获取数据失败: ${data.message}`)
      return []
    }
  } catch (err) {
    message.error(`获取数据失败: ${(err as Error).message}`)
    return []
  }
}

function sortEvents(list: EventModel[]) {
  return new List(list).OrderByDescending((d) => d.time).ToArray()
}

async function fetchData(reset = false) {
  if (reset) {
    const key = currentQueryKey()
    if (isLoading.value && inFlightKey === key) return
    inFlightKey = key
    const gen = ++fetchGen
    isLoading.value = true
    isLoadingMore.value = false
    offset.value = 0
    hasMore.value = true
    try {
      const fetchedData = await get(0, limit.value)
      if (gen !== fetchGen) return
      events.value = sortEvents(fetchedData)
      offset.value = fetchedData.length
      hasMore.value = fetchedData.length === limit.value
    } finally {
      if (gen === fetchGen) isLoading.value = false
    }
    return
  }

  if (isLoading.value || isLoadingMore.value || !hasMore.value) return
  const gen = fetchGen
  isLoadingMore.value = true
  try {
    const fetchedData = await get(offset.value, limit.value)
    if (gen !== fetchGen) return
    if (fetchedData.length > 0) {
      events.value = [...events.value, ...sortEvents(fetchedData)]
      offset.value += fetchedData.length
      hasMore.value = fetchedData.length === limit.value
    } else {
      hasMore.value = false
    }
  } finally {
    if (gen === fetchGen) isLoadingMore.value = false
  }
}

function onFilterChange() {
  void fetchData(true)
}

function loadMore() {
  void fetchData(false)
}

function sameDateRange(a?: [number, number] | null, b?: [number, number] | null) {
  return !!a && !!b && a[0] === b[0] && a[1] === b[1]
}

watch(
  [selectedDate, selectedType],
  (curr, prev) => {
    if (prev && sameDateRange(curr[0], prev[0]) && curr[1] === prev[1]) return
    onFilterChange()
  },
  { immediate: true },
)

// 手动补录上舰记录
const manualGuardUname = ref('')
const manualGuardUserKey = ref('')
const manualGuardMsg = ref<'舰长' | '提督' | '总督'>('舰长')
const manualGuardTime = ref('')
const manualGuardNum = ref<number>(1)
const manualGuardPrice = ref<number | undefined>(undefined)
const manualGuardLoading = ref(false)

async function addManualGuard() {
  if (manualGuardLoading.value) return

  const uname = manualGuardUname.value.trim()
  if (!uname) {
    message.error('uname 不能为空')
    return
  }

  const userKey = manualGuardUserKey.value.trim()
  if (!userKey) {
    message.error('请填写 uid 或 ouid')
    return
  }

  let uid: number | undefined
  let ouid: string | undefined
  try {
    const parsed = parseUserFilter(userKey)
    if ('uid' in parsed) uid = parsed.uid
    if ('ouid' in parsed) ouid = parsed.ouid
  } catch (e) {
    message.error((e as Error).message)
    return
  }

  if (!uid && !ouid) {
    message.error('请填写 uid 或 ouid')
    return
  }

  const num = manualGuardNum.value ?? 1
  if (num <= 0) {
    message.error('num 必须大于 0')
    return
  }

  manualGuardLoading.value = true
  try {
    const timeVal = manualGuardTime.value ? new Date(manualGuardTime.value).getTime() : undefined
    const resp = (await postApiEventGuardManual({
      uid,
      ouid,
      uname,
      msg: manualGuardMsg.value,
      time: timeVal,
      num,
      price: manualGuardPrice.value ?? undefined,
    })) as unknown as {
      code: number
      message?: string
      data: EventModel
    }
    if (resp.code !== 200) {
      message.error(`添加失败: ${resp.message}`)
      return
    }

    message.success('已添加')
    await fetchData(true)
  } catch (e) {
    message.error(`添加失败: ${(e as Error).message}`)
  } finally {
    manualGuardLoading.value = false
  }
}

async function deleteGuardEvent(item: EventModel) {
  if (!item.id) {
    message.error('无法删除：缺少 id')
    return
  }
  const ok = await run(
    () =>
      postApiEventGuardDelete({ id: item.id }) as unknown as Promise<{
        code: number
        message?: string
        data: string
      }>,
    {
      success: '已删除',
      fail: '删除失败',
    },
  )
  if (ok !== undefined) events.value = events.value.filter((e) => e.id !== item.id)
}

function GetSCColor(price: number): string {
  if (price === 0) return '#2a60b2'
  if (price > 0 && price < 30) return '#2a60b2'
  if (price >= 30 && price < 50) return '#427d9e'
  if (price >= 50 && price < 100) return '#c99801'
  if (price >= 500 && price < 1000) return '#e09443'
  if (price >= 1000 && price < 2000) return '#e54d4d'
  if (price >= 2000) return '#ab1a32'
  return '#2a60b2'
}

function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138) return '#3b82f6'
    if (price >= 138 && price < 1598) return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998) return 'rgb(157, 155, 255)'
    if (price >= 15998) return 'rgb(122, 4, 35)'
  }
  return '#3b82f6'
}

function exportData() {
  if (hasMore.value) {
    message.warning('当前导出的是已加载的部分数据，并非所有数据。')
  }
  let text = ''
  const fileName = generateExportFileName()

  switch (exportType.value) {
    case 'json': {
      text = JSON.stringify(selectedEvents.value)
      break
    }
    case 'csv': {
      text = objectsToCSV(
        selectedEvents.value.map((v) => ({
          type: v.type,
          time: format(v.time, 'yyyy-MM-dd HH:mm:ss'),
          name: v.uname,
          uId: v.uid,
          num: v.num,
          price: v.price,
          msg: v.msg,
        })),
      )
      break
    }
  }

  const payload = exportType.value === 'csv' ? `\uFEFF${text}` : text
  saveAs(new Blob([payload], { type: 'text/plain;charset=utf-8' }), fileName)
}

function generateExportFileName() {
  return `${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[0], 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[1], 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.id}_${accountInfo.value?.name}_${selectedType.value}.${exportType.value}`
}

function objectsToCSV(arr: any[]) {
  if (arr.length === 0) return ''
  const array = [Object.keys(arr[0])].concat(arr)
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value
        })
        .toString()
    })
    .join('\n')
}

// 当前在舰用户
const guardList = ref<GuardMemberModel[]>([])
const guardStats = ref<GuardStatsModel | null>(null)
const guardListLoading = ref(false)
const guardPaginationPage = ref(1)
const guardPaginationPageSize = ref(20)

const paginatedGuardList = computed(() => {
  const start = (guardPaginationPage.value - 1) * guardPaginationPageSize.value
  return guardList.value.slice(start, start + guardPaginationPageSize.value)
})

const totalGuardPages = computed(() => Math.ceil(guardList.value.length / guardPaginationPageSize.value) || 1)

async function loadGuardList() {
  guardListLoading.value = true
  try {
    const [listResponse, statsResponse] = (await Promise.all([
      getApiHistoryGuardsList({ activeOnly: true }),
      getApiHistoryGuardsStats(),
    ])) as unknown as [
      { code: number; data: GuardMemberModel[]; message?: string },
      { code: number; data: GuardStatsModel; message?: string },
    ]

    if (listResponse.code === 200) {
      guardList.value = listResponse.data
    } else {
      message.error(`加载舰长列表失败: ${listResponse.message}`)
    }

    if (statsResponse.code === 200) {
      guardStats.value = statsResponse.data
    } else {
      message.error(`加载舰长统计失败: ${statsResponse.message}`)
    }
  } catch (err) {
    message.error('加载舰长数据失败')
    console.error(err)
  } finally {
    guardListLoading.value = false
  }
}

function onTabChange(value: string | number) {
  if (value === 'current-captains' && guardList.value.length === 0) {
    void loadGuardList()
  }
}
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="舰长和 SC 事件"
      subtitle="事件流水记录、导出与在籍舰长明细"
    />

    <div class="space-y-3">
      <EventFetcherAlert />
      <EventFetcherStatusCard />
    </div>

    <!-- 未认证提示 -->
    <Card
      v-if="!accountInfo?.isBiliVerified"
      class="p-6 space-y-4"
    >
      <div class="space-y-3">
        <div class="font-semibold text-sm text-foreground">这是什么？</div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          可以查看曾经收到的 Superchat 以及上舰记录，并导出为 CSV / JSON 表格。
        </p>

        <div class="font-semibold text-sm text-foreground pt-2">可以直接使用吗？</div>
        <p class="text-xs text-muted-foreground leading-relaxed">
          使用这个功能需要你拥有一个可以 7*24 小时运行 Docker 容器或者 Node.js
          脚本的环境（如本地电脑、软路由或云服务器），并保持网络畅通。
        </p>
      </div>

      <div class="pt-4 border-t border-border flex justify-center">
        <a
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          class="inline-flex items-center justify-center rounded-md text-xs font-medium h-8 px-4 bg-brand text-brand-foreground hover:bg-brand/90"
        >
          查看部署指南 →
        </a>
      </div>
    </Card>

    <!-- 已认证主体内容 -->
    <Card
      v-else
      class="p-4"
    >
      <Tabs
        default-value="history"
        @update:model-value="onTabChange"
      >
        <TabsList class="mb-4">
          <TabsTrigger value="history"> 历史记录 </TabsTrigger>
          <TabsTrigger value="current-captains"> 当前在舰用户 </TabsTrigger>
        </TabsList>

        <!-- Tab 1: 历史记录面板 -->
        <TabsContent
          value="history"
          class="space-y-4"
        >
          <!-- 筛选与操作工具栏 -->
          <div class="flex items-center justify-between flex-wrap gap-2.5">
            <div class="flex items-center gap-2 flex-wrap">
              <!-- 快捷区间 -->
              <ToggleGroup type="single">
                <ToggleGroupItem
                  value="thisMonth"
                  @click="setDateRangePreset('thisMonth')"
                >
                  本月
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="lastMonth"
                  @click="setDateRangePreset('lastMonth')"
                >
                  上个月
                </ToggleGroupItem>
              </ToggleGroup>

              <!-- 自定义日期范围 -->
              <DateRangePicker
                v-model:start="startDateInput"
                v-model:end="endDateInput"
                size="sm"
                @update:start="handleDateInputChange"
                @update:end="handleDateInputChange"
              />

              <!-- 类型选择 (舰长 / Superchat) -->
              <ToggleGroup
                v-model="selectedType"
                type="single"
              >
                <ToggleGroupItem :value="EventDataTypes.Guard"> 舰长 </ToggleGroupItem>
                <ToggleGroupItem :value="EventDataTypes.SC"> Superchat </ToggleGroupItem>
              </ToggleGroup>

              <!-- 用户搜索输入 -->
              <div class="flex items-center gap-1">
                <Input
                  v-model="userFilterInput"
                  placeholder="筛选 UID / OUID / 用户名"
                  class="w-48"
                  @keyup.enter="applyUserFilter"
                />
                <Button
                  variant="outline"
                  class="px-2.5"
                  @click="applyUserFilter"
                >
                  应用
                </Button>
                <Button
                  v-if="userFilterInput || Object.keys(userFilterApplied).length"
                  variant="ghost"
                  class="px-2 text-muted-foreground"
                  @click="clearUserFilter"
                >
                  清空
                </Button>
              </div>
            </div>

            <!-- 导出功能 -->
            <div class="flex items-center gap-2">
              <ToggleGroup
                v-model="exportType"
                type="single"
              >
                <ToggleGroupItem value="csv"> CSV </ToggleGroupItem>
                <ToggleGroupItem value="json"> JSON </ToggleGroupItem>
              </ToggleGroup>

              <Button
                variant="outline"
                :disabled="selectedEvents.length === 0 || isLoading || isLoadingMore"
                @click="exportData"
              >
                <component
                  :is="ArrowDownload24Regular"
                  class="size-3.5 mr-1"
                />
                导出
              </Button>
            </div>
          </div>

          <!-- 手动添加上舰记录面板 (仅舰长模式可见) -->
          <div
            v-if="selectedType === EventDataTypes.Guard"
            class="p-3 rounded-lg border border-border bg-muted/20 space-y-2.5"
          >
            <div class="text-xs font-semibold text-muted-foreground">补录上舰流水记录</div>
            <div class="flex items-center gap-2 flex-wrap">
              <Input
                v-model="manualGuardUname"
                placeholder="用户名"
                class="w-32"
              />
              <Input
                v-model="manualGuardUserKey"
                placeholder="UID 或 OUID"
                class="w-44"
              />

              <div class="w-28">
                <Select
                  v-model="manualGuardMsg"
                  default-value="舰长"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="等级" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="舰长"> 舰长 </SelectItem>
                    <SelectItem value="提督"> 提督 </SelectItem>
                    <SelectItem value="总督"> 总督 </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Input
                v-model="manualGuardTime"
                type="datetime-local"
                class="w-48"
              />
              <Input
                v-model.number="manualGuardNum"
                type="number"
                min="1"
                placeholder="数量"
                class="w-20"
              />
              <Input
                v-model.number="manualGuardPrice"
                type="number"
                min="0"
                placeholder="价格(可选)"
                class="w-28"
              />

              <Button
                variant="default"
                :loading="manualGuardLoading"
                :disabled="isLoading || isLoadingMore"
                @click="addManualGuard"
              >
                添加记录
              </Button>
            </div>
          </div>

          <!-- 统计与视图切换条 -->
          <div class="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-muted-foreground">
                已加载 {{ eventSummary.count }} 条{{ hasMore ? ' (可继续加载)' : '' }}
              </span>
              <Badge
                variant="secondary"
                class="text-[11px] px-2 py-0.5"
              >
                人数 {{ eventSummary.uniqueUsers }}
              </Badge>
              <Badge
                variant="outline"
                class="text-[11px] px-2 py-0.5 font-medium"
              >
                金额合计 ¥{{ eventSummary.totalPrice }}
              </Badge>
              <Badge
                v-if="selectedType === EventDataTypes.Guard"
                variant="outline"
                class="text-[11px] px-2 py-0.5"
              >
                数量合计 {{ eventSummary.totalNum }}
              </Badge>
            </div>

            <ToggleGroup
              v-model="displayMode"
              type="single"
            >
              <ToggleGroupItem
                value="grid"
                aria-label="网格视图"
              >
                <component
                  :is="Grid28Filled"
                  class="size-3.5"
                />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="column"
                aria-label="列表视图"
              >
                <component
                  :is="List16Filled"
                  class="size-3.5"
                />
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <!-- 网格视图 -->
          <div v-if="displayMode === 'grid'">
            <div
              v-if="selectedEvents.length === 0 && !isLoading"
              class="py-12 text-center text-xs text-muted-foreground"
            >
              在选定时间范围内没有找到事件记录
            </div>

            <div
              v-else
              class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3"
            >
              <div
                v-for="item in selectedEvents"
                :key="item.id ?? `${item.time}_${item.uid}_${item.price}`"
                class="group relative p-3 rounded-lg border border-border bg-card/60 flex flex-col items-center text-center space-y-1.5 hover:border-brand/40 transition-colors"
                :style="{ minHeight: selectedType === EventDataTypes.Guard ? '150px' : '180px' }"
              >
                <!-- 删除按钮 -->
                <div
                  v-if="selectedType === EventDataTypes.Guard && item.id"
                  class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <AlertDialog>
                    <AlertDialogTrigger as-child>
                      <button
                        type="button"
                        class="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="删除"
                      >
                        <component
                          :is="Delete24Regular"
                          class="h-3 w-3"
                        />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent class="sm:max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle>删除确认</AlertDialogTitle>
                        <AlertDialogDescription class="text-xs"> 确定删除这条上舰记录？ </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction @click="deleteGuardEvent(item)"> 确定删除 </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <!-- 头像 -->
                <img
                  :src="item.uid ? AVATAR_URL + item.uid : item.uface"
                  referrerpolicy="no-referrer"
                  class="w-12 h-12 rounded-full border border-border object-cover"
                />

                <!-- 标签 -->
                <div class="flex items-center gap-1">
                  <Badge
                    v-if="selectedType === EventDataTypes.Guard"
                    variant="outline"
                    class="text-[9px] px-1 py-0 h-3.5"
                  >
                    {{ item.msg }}
                  </Badge>
                  <span
                    class="text-[10px] px-1.5 py-0.5 rounded-full text-white font-mono font-bold"
                    :style="{
                      backgroundColor:
                        selectedType === EventDataTypes.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                    }"
                  >
                    ¥{{ item.price }}
                  </span>
                </div>

                <!-- 用户名 -->
                <div
                  class="font-semibold text-xs truncate max-w-full text-foreground"
                  :title="item.uname"
                >
                  {{ item.uname }}
                </div>

                <!-- 时间 -->
                <div class="text-[10px] text-muted-foreground">
                  {{ format(item.time, 'yyyy-MM-dd HH:mm') }}
                </div>

                <!-- SC 留言 -->
                <div
                  v-if="selectedType === EventDataTypes.SC"
                  class="text-[11px] text-muted-foreground line-clamp-2 mt-1 px-1"
                >
                  {{ item.msg }}
                </div>
              </div>
            </div>

            <!-- 加载更多 -->
            <div
              v-if="hasMore"
              class="pt-4 flex justify-center"
            >
              <Button
                size="xs"
                variant="outline"
                :loading="isLoadingMore"
                @click="loadMore"
              >
                加载更多
              </Button>
            </div>
          </div>

          <!-- 列表/表格视图 -->
          <div
            v-else
            class="space-y-3"
          >
            <div class="rounded-md border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户名</TableHead>
                    <TableHead>OUID / UID</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead v-if="selectedType === EventDataTypes.Guard"> 类型 </TableHead>
                    <TableHead>价格</TableHead>
                    <TableHead v-if="selectedType === EventDataTypes.SC"> 内容 </TableHead>
                    <TableHead
                      v-if="selectedType === EventDataTypes.Guard"
                      class="text-right"
                    >
                      操作
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-if="selectedEvents.length === 0"
                    class="text-center"
                  >
                    <TableCell
                      colspan="7"
                      class="py-8 text-xs text-muted-foreground"
                    >
                      没有找到事件记录
                    </TableCell>
                  </TableRow>
                  <TableRow
                    v-for="item in selectedEvents"
                    :key="item.id ?? `${item.time}_${item.uid}_${item.price}`"
                  >
                    <TableCell class="text-xs font-semibold">
                      {{ item.uname }}
                    </TableCell>
                    <TableCell class="font-mono text-xs text-muted-foreground">
                      {{
                        GuidUtils.isGuidFromUserId(item.ouid) ? GuidUtils.guidToLong(item.ouid) : item.ouid || item.uid
                      }}
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ format(item.time, 'yyyy-MM-dd HH:mm:ss') }}
                    </TableCell>
                    <TableCell
                      v-if="selectedType === EventDataTypes.Guard"
                      class="text-xs"
                    >
                      {{ item.msg }}
                    </TableCell>
                    <TableCell>
                      <span
                        class="text-[10px] px-1.5 py-0.5 rounded-full text-white font-mono font-bold"
                        :style="{
                          backgroundColor:
                            selectedType === EventDataTypes.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                        }"
                      >
                        ¥{{ item.price }}
                      </span>
                    </TableCell>
                    <TableCell
                      v-if="selectedType === EventDataTypes.SC"
                      class="text-xs text-muted-foreground max-w-xs truncate"
                      :title="item.msg"
                    >
                      {{ item.msg }}
                    </TableCell>
                    <TableCell
                      v-if="selectedType === EventDataTypes.Guard"
                      class="text-right"
                    >
                      <AlertDialog v-if="item.id">
                        <AlertDialogTrigger as-child>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            class="text-destructive hover:bg-destructive/10"
                          >
                            <component
                              :is="Delete24Regular"
                              class="h-3 w-3"
                            />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent class="sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle>删除确认</AlertDialogTitle>
                            <AlertDialogDescription class="text-xs"> 确定删除这条上舰记录？ </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction @click="deleteGuardEvent(item)"> 确定删除 </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <!-- 加载更多 -->
            <div
              v-if="hasMore"
              class="pt-2 flex justify-center"
            >
              <Button
                size="xs"
                variant="outline"
                :loading="isLoadingMore"
                @click="loadMore"
              >
                加载更多
              </Button>
            </div>
          </div>
        </TabsContent>

        <!-- Tab 2: 当前在舰用户面板 -->
        <TabsContent
          value="current-captains"
          class="space-y-4"
        >
          <!-- 4 宫格统计卡片 -->
          <div
            v-if="guardStats"
            class="grid grid-cols-2 sm:grid-cols-4 gap-3"
          >
            <Card class="p-3">
              <div class="text-[11px] text-muted-foreground">舰长总数</div>
              <div class="text-xl font-bold font-mono text-foreground mt-0.5">
                {{ guardStats.totalCount }}
              </div>
            </Card>
            <Card class="p-3">
              <div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#ff6b9d]" />
                <span>总督</span>
              </div>
              <div class="text-xl font-bold font-mono text-[#ff6b9d] mt-0.5">
                {{ guardStats.governorCount }}
              </div>
            </Card>
            <Card class="p-3">
              <div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#c59aff]" />
                <span>提督</span>
              </div>
              <div class="text-xl font-bold font-mono text-[#c59aff] mt-0.5">
                {{ guardStats.admiralCount }}
              </div>
            </Card>
            <Card class="p-3">
              <div class="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <span class="w-2 h-2 rounded-full bg-[#00d1ff]" />
                <span>舰长</span>
              </div>
              <div class="text-xl font-bold font-mono text-[#00d1ff] mt-0.5">
                {{ guardStats.captainCount }}
              </div>
            </Card>
          </div>

          <!-- 刷新按钮 -->
          <div class="flex justify-end">
            <Button
              size="xs"
              variant="outline"
              :loading="guardListLoading"
              @click="loadGuardList"
            >
              <component
                :is="ArrowSync24Filled"
                class="h-3.5 w-3.5 mr-1"
              />
              刷新在舰列表
            </Button>
          </div>

          <!-- 表格 -->
          <div class="rounded-md border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>OUID / 账号</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead>等级</TableHead>
                  <TableHead class="text-right"> 陪伴天数 </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-if="guardList.length === 0"
                  class="text-center"
                >
                  <TableCell
                    colspan="4"
                    class="py-8 text-xs text-muted-foreground"
                  >
                    暂无在舰用户记录
                  </TableCell>
                </TableRow>
                <TableRow
                  v-for="row in paginatedGuardList"
                  :key="row.guardOUId"
                >
                  <TableCell class="font-mono text-xs font-bold">
                    {{
                      GuidUtils.isGuidFromUserId(row.guardOUId) ? GuidUtils.guidToLong(row.guardOUId) : row.guardOUId
                    }}
                  </TableCell>
                  <TableCell class="text-xs">
                    {{ row.username }}
                  </TableCell>
                  <TableCell>
                    <span
                      class="text-xs font-bold"
                      :style="{
                        color:
                          row.guardLevel === '总督' ? '#ff6b9d' : row.guardLevel === '提督' ? '#c59aff' : '#00d1ff',
                      }"
                    >
                      {{ row.guardLevel }}
                    </span>
                  </TableCell>
                  <TableCell class="text-right font-mono text-xs text-muted-foreground">
                    {{ row.accompanyDays }} 天
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- 分页器 -->
          <div
            v-if="guardList.length > guardPaginationPageSize"
            class="flex items-center justify-between text-xs text-muted-foreground pt-2"
          >
            <span>共 {{ guardList.length }} 位在舰用户</span>
            <div class="flex items-center gap-1.5">
              <Button
                size="xs"
                variant="outline"
                :disabled="guardPaginationPage <= 1"
                @click="guardPaginationPage--"
              >
                上一页
              </Button>
              <span class="px-2 font-mono">{{ guardPaginationPage }} / {{ totalGuardPages }}</span>
              <Button
                size="xs"
                variant="outline"
                :disabled="guardPaginationPage >= totalGuardPages"
                @click="guardPaginationPage++"
              >
                下一页
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  </div>
</template>
