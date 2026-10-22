<script setup lang="ts">
import { ArrowSync24Regular, Delete24Regular, Eye24Regular } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type {
  RequestApplyPointGuardDuplicateFixModel,
  RequestPointGuardDuplicatePointValues,
  ResponsePointGuardDuplicateApplyResult,
  ResponsePointGuardDuplicateDetailModel,
  ResponsePointGuardDuplicateLevelCounts,
  ResponsePointGuardDuplicateScanModel,
  ResponsePointGuardDuplicateUserModel,
} from '@/api/api-models'
import {
  getApiPointGetDuplicateGuardDetail,
  getApiPointScanDuplicateGuards,
  postApiPointApplyDuplicateGuardsFix,
} from '@/api/generated/point/point'
import { unwrapOk } from '@/api/query'
import { formatPoints, formatTime } from '@/apps/manage/composables/formatters'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tag } from '@/shared/ui/tag'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'

interface DuplicateUserRow extends ResponsePointGuardDuplicateUserModel {
  previewPoints: number
}

const message = useMessage()
const accountInfo = useAccount()

const dayCount = ref(7)
const windowSeconds = ref(3)
const includeLiving = ref(true)
const includeFinished = ref(true)
const excludeFixed = ref(true)

const deductPoints = ref(true)
const deleteEvents = ref(true)
const cleanLiveData = ref(true)

const pointMode = ref<'current' | 'manual'>('current')
const manualPointValues = ref<RequestPointGuardDuplicatePointValues>({
  jianzhang: 0,
  tidu: 0,
  zongdu: 0,
})

const scanLoading = ref(false)
const applyLoading = ref(false)
const detailLoading = ref(false)
const showDetailModal = ref(false)
const scanResult = ref<ResponsePointGuardDuplicateScanModel | null>(null)
const detailResult = ref<ResponsePointGuardDuplicateDetailModel | null>(null)
const applyResult = ref<ResponsePointGuardDuplicateApplyResult | null>(null)
const selectedRowKeys = ref<string[]>([])

// 分页
const currentPage = ref(1)
const pageSize = 10

const currentPointValues = computed<RequestPointGuardDuplicatePointValues>(() => ({
  jianzhang: accountInfo.value?.settings?.point?.jianzhangPoint ?? 0,
  tidu: accountInfo.value?.settings?.point?.tiduPoint ?? 0,
  zongdu: accountInfo.value?.settings?.point?.zongduPoint ?? 0,
}))

watch(
  currentPointValues,
  (values) => {
    if (
      manualPointValues.value.jianzhang === 0 &&
      manualPointValues.value.tidu === 0 &&
      manualPointValues.value.zongdu === 0
    ) {
      manualPointValues.value = { ...values }
    }
  },
  { immediate: true, deep: true },
)

const effectivePointValues = computed(() =>
  pointMode.value === 'manual' ? manualPointValues.value : currentPointValues.value,
)

function calcEstimatedPoints(levelCounts: ResponsePointGuardDuplicateLevelCounts, values = effectivePointValues.value) {
  return Number(
    (
      levelCounts.jianzhang * values.jianzhang +
      levelCounts.tidu * values.tidu +
      levelCounts.zongdu * values.zongdu
    ).toFixed(2),
  )
}

const rows = computed<DuplicateUserRow[]>(() =>
  (scanResult.value?.users ?? []).map((user) => ({
    ...user,
    previewPoints: calcEstimatedPoints(user.levelCounts),
  })),
)

const paginatedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return rows.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.ceil(rows.value.length / pageSize) || 1)

const isAllSelected = computed(() => {
  if (rows.value.length === 0) return false
  return rows.value.every((r) => selectedRowKeys.value.includes(r.guardOUId))
})

function toggleSelectAll(checked: boolean) {
  if (checked) {
    selectedRowKeys.value = rows.value.map((r) => r.guardOUId)
  } else {
    selectedRowKeys.value = []
  }
}

function toggleSelectRow(key: string, checked: boolean) {
  if (checked) {
    if (!selectedRowKeys.value.includes(key)) selectedRowKeys.value.push(key)
  } else {
    selectedRowKeys.value = selectedRowKeys.value.filter((k) => k !== key)
  }
}

const selectedUsers = computed(() => {
  const selected = new Set(selectedRowKeys.value)
  return rows.value.filter((row) => selected.has(row.guardOUId))
})

const selectedPreviewPoints = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.previewPoints, 0))
const selectedEventDuplicates = computed(() =>
  selectedUsers.value.reduce((sum, row) => sum + row.duplicateEventCount, 0),
)
const selectedLiveDuplicates = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.duplicateLiveCount, 0))

function getUserSecondaryText(user: ResponsePointGuardDuplicateUserModel) {
  if (user.info?.userId) return `UID ${user.info.userId}`
  if (user.info?.openId) return `OpenId ${user.info.openId.slice(0, 8)}...`
  return user.guardOUId
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case 'Event':
      return '事件记录'
    case 'LivingLive':
      return '直播中 Live'
    case 'FinishedLive':
      return '历史 Live'
    default:
      return sourceType
  }
}

async function scanDuplicates() {
  scanLoading.value = true
  applyResult.value = null
  try {
    const result = unwrapOk(
      await getApiPointScanDuplicateGuards({
        dayCount: dayCount.value,
        windowSeconds: windowSeconds.value,
        includeLiving: includeLiving.value,
        includeFinished: includeFinished.value,
        excludeFixed: excludeFixed.value,
      }),
      '扫描重复上舰失败',
    )
    scanResult.value = result
    selectedRowKeys.value = result.users.map((user) => user.guardOUId)
    currentPage.value = 1
    message.success(`扫描完成，共 ${result.duplicatedUserCount} 位用户存在重复上舰`)
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    scanLoading.value = false
  }
}

async function openDetail(row: ResponsePointGuardDuplicateUserModel) {
  showDetailModal.value = true
  detailLoading.value = true
  detailResult.value = null
  try {
    detailResult.value = unwrapOk(
      (await getApiPointGetDuplicateGuardDetail({
        guardOuId: row.guardOUId,
        dayCount: dayCount.value,
        windowSeconds: windowSeconds.value,
        includeLiving: includeLiving.value,
        includeFinished: includeFinished.value,
        excludeFixed: excludeFixed.value,
      })) as any,
      '获取重复详情失败',
    )
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    detailLoading.value = false
  }
}

function resetManualPointValues() {
  manualPointValues.value = { ...currentPointValues.value }
}

function createApplyPayload(applyAll: boolean): RequestApplyPointGuardDuplicateFixModel {
  return {
    dayCount: dayCount.value,
    windowSeconds: windowSeconds.value,
    includeLiving: includeLiving.value,
    includeFinished: includeFinished.value,
    excludeFixed: excludeFixed.value,
    deductPoints: deductPoints.value,
    deleteEvents: deleteEvents.value,
    cleanLiveData: cleanLiveData.value,
    useManualPointValues: pointMode.value === 'manual',
    manualPointValues: pointMode.value === 'manual' ? { ...manualPointValues.value } : null,
    guardOuIds: applyAll ? null : [...selectedRowKeys.value],
  }
}

async function applyCleanup(applyAll: boolean) {
  if (!deductPoints.value && !deleteEvents.value && !cleanLiveData.value) {
    message.error('扣分 / 删除事件 / 清理 Live 数据 至少选择一项')
    return
  }

  if (!applyAll && selectedRowKeys.value.length === 0) {
    message.error('请先选择至少一个用户')
    return
  }

  applyLoading.value = true
  try {
    const result = unwrapOk(
      await postApiPointApplyDuplicateGuardsFix(createApplyPayload(applyAll)),
      '执行重复上舰清理失败',
    )
    applyResult.value = result
    message.success(
      `执行完成，扣除 ${formatPoints(result.totalPointsDeducted)} 积分，清理 ${result.liveDuplicateRowsRemoved} 条 Live 重复`,
    )
    await scanDuplicates()
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    applyLoading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <Alert variant="default" class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
      <AlertDescription class="text-xs">
        默认会同时扣除重复积分、删除重复事件，并清理 live
        历史里的重复上舰。你可以在执行前取消其中任意动作，也可以切换为手动三档积分值预览和执行。
      </AlertDescription>
    </Alert>

    <!-- 扫描条件 -->
    <Card class="border border-border">
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold text-muted-foreground uppercase">扫描条件</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-0">
        <div class="flex items-center gap-3 flex-wrap text-xs">
          <span class="text-muted-foreground">最近</span>
          <NInputNumber v-model="dayCount" :min="1" :max="90" class="w-20" />
          <span class="text-muted-foreground">天</span>
          <span class="text-muted-foreground ml-2">窗口</span>
          <NInputNumber v-model="windowSeconds" :min="1" :max="30" class="w-20" />
          <span class="text-muted-foreground">秒</span>

          <div class="flex items-center gap-1.5 ml-2">
            <Switch v-model:checked="includeLiving" />
            <span class="text-muted-foreground">包含正在直播</span>
          </div>
          <div class="flex items-center gap-1.5 ml-2">
            <Switch v-model:checked="includeFinished" />
            <span class="text-muted-foreground">包含历史直播</span>
          </div>
          <div class="flex items-center gap-1.5 ml-2">
            <Switch v-model:checked="excludeFixed" />
            <span class="text-muted-foreground">排除已处理</span>
          </div>

          <Button class="ml-auto gap-1.5" :disabled="scanLoading" @click="scanDuplicates">
            <ArrowSync24Regular class="size-3.5" :class="{ 'animate-spin': scanLoading }" />
            {{ scanLoading ? '扫描中...' : '扫描重复上舰' }}
          </Button>
        </div>
      </CardContent>
    </Card>

    <!-- 扣分设置 -->
    <Card class="border border-border">
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold text-muted-foreground uppercase">扣分设置</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-0 space-y-3">
        <ToggleGroup
          v-model="pointMode"
          type="single"
          size="xs"
        >
          <ToggleGroupItem value="current">
            按当前积分设置
          </ToggleGroupItem>
          <ToggleGroupItem value="manual">
            手动三档设置
          </ToggleGroupItem>
        </ToggleGroup>

        <div class="flex items-center gap-3 flex-wrap text-xs">
          <span class="text-muted-foreground">舰长</span>
          <NInputNumber
            v-model="manualPointValues.jianzhang"
            :min="0"
            :disabled="pointMode !== 'manual'"
            class="w-24"
          />
          <span class="text-muted-foreground">提督</span>
          <NInputNumber
            v-model="manualPointValues.tidu"
            :min="0"
            :disabled="pointMode !== 'manual'"
            class="w-24"
          />
          <span class="text-muted-foreground">总督</span>
          <NInputNumber
            v-model="manualPointValues.zongdu"
            :min="0"
            :disabled="pointMode !== 'manual'"
            class="w-24"
          />
          <Button size="xs" variant="outline" :disabled="pointMode !== 'manual'" @click="resetManualPointValues">
            恢复当前设置
          </Button>
        </div>

        <p class="text-[11px] text-muted-foreground">
          当前生效：舰长 {{ formatPoints(effectivePointValues.jianzhang) }} / 提督
          {{ formatPoints(effectivePointValues.tidu) }} / 总督 {{ formatPoints(effectivePointValues.zongdu) }}
        </p>
      </CardContent>
    </Card>

    <!-- 执行选项 -->
    <Card class="border border-border">
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold text-muted-foreground uppercase">执行选项</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-0 space-y-3">
        <div class="flex items-center gap-4 flex-wrap text-xs">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Switch v-model:checked="deductPoints" />
            <span>扣除重复积分</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Switch v-model:checked="deleteEvents" />
            <span>删除重复事件</span>
          </label>
          <label class="flex items-center gap-1.5 cursor-pointer">
            <Switch v-model:checked="cleanLiveData" />
            <span>清理 Live 数据</span>
          </label>
        </div>

        <div class="flex items-center gap-2 flex-wrap pt-2 border-t">
          <Tag type="warning">已选 {{ selectedUsers.length }} 人</Tag>
          <Tag type="error">预计扣分 {{ formatPoints(selectedPreviewPoints) }}</Tag>
          <Tag type="warning">事件重复 {{ selectedEventDuplicates }}</Tag>
          <Tag type="warning">Live 重复 {{ selectedLiveDuplicates }}</Tag>

          <div class="flex items-center gap-2 ml-auto">
            <Popconfirm positive-text="确认清理" negative-text="取消" @positive-click="applyCleanup(true)">
              <template #trigger>
                <Button variant="destructive" :disabled="applyLoading" class="gap-1.5">
                  <Delete24Regular class="size-3.5" />
                  一键清理全部
                </Button>
              </template>
              确认按当前筛选条件清理全部重复上舰数据？
            </Popconfirm>

            <Popconfirm positive-text="确认清理" negative-text="取消" @positive-click="applyCleanup(false)">
              <template #trigger>
                <Button :disabled="applyLoading || selectedRowKeys.length === 0">
                  清理已选用户 ({{ selectedRowKeys.length }})
                </Button>
              </template>
              确认仅清理已选中的重复上舰用户？
            </Popconfirm>
          </div>
        </div>
      </CardContent>
    </Card>

    <Alert v-if="scanResult" variant="default" class="border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
      <AlertDescription class="text-xs">
        扫描结果：{{ scanResult.duplicatedUserCount }} 位用户，{{ scanResult.duplicateGroupCount }} 组重复，事件重复
        {{ scanResult.duplicateEventCount }} 条，Live 重复 {{ scanResult.duplicateLiveCount }} 条。
      </AlertDescription>
    </Alert>

    <Alert v-if="applyResult" variant="default" class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400">
      <AlertDescription class="text-xs">
        本次执行：扣除 {{ formatPoints(applyResult.totalPointsDeducted) }} 积分，删除事件
        {{ applyResult.eventRowsDeleted }} 条，删除临时 Live 记录 {{ applyResult.tempEventRowsDeleted }} 条，更新 Live
        {{ applyResult.liveRowsUpdated }} 场，清理 Live 重复 {{ applyResult.liveDuplicateRowsRemoved }} 条。
      </AlertDescription>
    </Alert>

    <!-- 重复用户列表 -->
    <Card class="border border-border">
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-xs font-semibold text-muted-foreground uppercase">重复用户列表</CardTitle>
      </CardHeader>
      <CardContent class="p-0">
        <Empty v-if="!scanResult" description="先扫描重复上舰数据" class="py-8" />
        <Empty v-else-if="rows.length === 0" description="当前筛选条件下没有重复上舰" class="py-8" />
        <div v-else>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-10">
                    <Checkbox :checked="isAllSelected" @update:checked="toggleSelectAll" />
                  </TableHead>
                  <TableHead>用户</TableHead>
                  <TableHead class="w-20">组数</TableHead>
                  <TableHead class="w-24">事件重复</TableHead>
                  <TableHead class="w-24">Live 重复</TableHead>
                  <TableHead class="w-24">影响场次</TableHead>
                  <TableHead class="w-28">预计扣分</TableHead>
                  <TableHead class="w-56">时间范围</TableHead>
                  <TableHead class="w-20 text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="row in paginatedRows" :key="row.guardOUId">
                  <TableCell>
                    <Checkbox
                      :checked="selectedRowKeys.includes(row.guardOUId)"
                      @update:checked="toggleSelectRow(row.guardOUId, $event)"
                    />
                  </TableCell>
                  <TableCell>
                    <div class="flex flex-col text-xs">
                      <span class="font-medium text-foreground">{{ row.info?.name || '未知用户' }}</span>
                      <span class="text-[11px] text-muted-foreground">{{ getUserSecondaryText(row) }}</span>
                    </div>
                  </TableCell>
                  <TableCell class="text-xs">{{ row.duplicateGroups }}</TableCell>
                  <TableCell class="text-xs">{{ row.duplicateEventCount }}</TableCell>
                  <TableCell class="text-xs">{{ row.duplicateLiveCount }}</TableCell>
                  <TableCell class="text-xs">{{ row.affectedLiveCount }}</TableCell>
                  <TableCell class="text-xs font-mono font-medium text-destructive">
                    {{ formatPoints(row.previewPoints) }}
                  </TableCell>
                  <TableCell class="text-[11px] text-muted-foreground">
                    {{ formatTime(row.firstEventAt) }} ~ {{ formatTime(row.lastEventAt) }}
                  </TableCell>
                  <TableCell class="text-right">
                    <Button variant="ghost" size="xs" class="gap-1" @click="openDetail(row)">
                      <Eye24Regular class="size-3.5" />
                      详情
                    </Button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- 分页栏 -->
          <div v-if="totalPages > 1" class="flex items-center justify-between px-4 py-3 border-t text-xs">
            <span class="text-muted-foreground">
              共 {{ rows.length }} 条，第 {{ currentPage }} / {{ totalPages }} 页
            </span>
            <div class="flex items-center gap-1">
              <Button variant="outline" size="xs" :disabled="currentPage <= 1" @click="currentPage--">
                上一页
              </Button>
              <Button variant="outline" size="xs" :disabled="currentPage>= totalPages"
                @click="currentPage++"
              >
                下一页
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>

  <!-- 详情弹窗 -->
  <Dialog v-model:open="showDetailModal">
    <DialogContent class="max-w-3xl max-h-[85vh] flex flex-col">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">重复上舰详情</DialogTitle>
      </DialogHeader>

      <div class="flex-1 overflow-y-auto py-2 space-y-3">
        <Spin :show="detailLoading">
          <Empty v-if="!detailResult && !detailLoading" description="暂无详情" />
          <template v-else-if="detailResult">
            <Alert variant="default" class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <AlertDescription class="text-xs">
                {{ detailResult.user.info?.name || '未知用户' }}：{{ detailResult.user.duplicateGroups }} 组重复，事件重复
                {{ detailResult.user.duplicateEventCount }} 条，Live 重复 {{ detailResult.user.duplicateLiveCount }} 条。
              </AlertDescription>
            </Alert>

            <div class="space-y-3">
              <Card
                v-for="(group, index) in detailResult.groups"
                :key="`${group.sourceType}-${group.liveId || 'none'}-${group.anchorAt}-${index}`"
                class="border border-border p-3 space-y-2"
              >
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <Tag type="warning">{{ sourceTypeLabel(group.sourceType) }}</Tag>
                    <Tag type="info">重复 {{ group.duplicateCount }} 条</Tag>
                    <span v-if="group.liveTitle" class="font-medium text-foreground">
                      {{ group.liveTitle }}
                    </span>
                  </div>
                  <span class="text-[11px] text-muted-foreground">
                    {{ formatTime(group.anchorAt) }} ~ {{ formatTime(group.lastAt) }}
                  </span>
                </div>

                <div class="space-y-1.5 pt-1">
                  <div
                    v-for="entry in group.entries"
                    :key="`${entry.eventId}-${entry.time}-${entry.isDuplicate ? 'dup' : 'keep'}`"
                    class="flex items-center justify-between p-2 rounded bg-muted/40 text-xs"
                  >
                    <div class="flex items-center gap-2">
                      <Tag :type="entry.isDuplicate ? 'warning' : 'success'">
                        {{ entry.isDuplicate ? '重复' : '保留' }}
                      </Tag>
                      <span class="font-mono text-[11px]">{{ formatTime(entry.time) }}</span>
                      <span class="text-muted-foreground">{{ entry.message }}</span>
                    </div>
                    <div class="flex items-center gap-2.5 text-muted-foreground text-[11px]">
                      <span>数量 {{ entry.num }}</span>
                      <span>价格 {{ formatPoints(entry.price) }}</span>
                      <span>等级 {{ entry.guardLevel }}</span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </template>
        </Spin>
      </div>
    </DialogContent>
  </Dialog>
</template>
