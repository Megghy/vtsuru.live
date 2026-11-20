<script setup lang="ts">
import AddSquare24Regular from '@vicons/fluent/es/AddSquare24Regular'
import ArrowDownload24Regular from '@vicons/fluent/es/ArrowDownload24Regular'
import ArrowSortDownLines24Regular from '@vicons/fluent/es/ArrowSortDownLines24Regular'
import ArrowSync24Regular from '@vicons/fluent/es/ArrowSync24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Info24Filled from '@vicons/fluent/es/Info24Filled'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import Settings24Regular from '@vicons/fluent/es/Settings24Regular'
import Warning24Regular from '@vicons/fluent/es/Warning24Regular'
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointUserModel, SettingPoint } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import {
  getApiPointGetAllUsers,
  postApiPointBatchDeleteUser,
  postApiPointDeleteUser,
  postApiPointGivePoint,
  postApiPointReset,
  postApiPointSeasonReset,
} from '@/api/generated/point/point'
import { formatNumber, formatTime } from '@/apps/manage/composables/formatters'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { objectsToCSV, useMessage } from '@/shared/utils'

import PointUserDetailCard from './PointUserDetailCard.vue'

type UserSortKey = 'updateAt_desc' | 'point_desc' | 'point_asc' | 'order_desc'

interface PointUserSettings {
  onlyAuthed: boolean
  sortBy?: UserSortKey
}

const props = defineProps<{
  pointSetting?: SettingPoint
}>()
const emit = defineEmits<{
  openSourceSettings: []
}>()

const message = useMessage()
const accountInfo = useAccount()

const settings = usePersistedStorage<PointUserSettings>('Settings.Point.Users', {
  onlyAuthed: false,
  sortBy: 'updateAt_desc',
})

const pn = ref(1)
const ps = ref(25)

const showDetailSheet = ref(false)
const showGivePointModal = ref(false)
const showResetAllPointsModal = ref(false)
const showSeasonResetModal = ref(false)
const selectedUserKeys = ref<string[]>([])
const seasonCarryOverPercent = ref(20)
const seasonNameInput = ref('')
const seasonUpdateSetting = ref(true)
const { loading: isLoading, run } = useApiAction()
isLoading.value = true

// 积分调整表单（支持从表格行直接锁定或手动选 UID）
const presetTargetUser = ref<ResponsePointUserModel | null>(null)
const addPointCount = ref(0)
const addPointReason = ref('')
const addPointTarget = ref<number>()
const selectedTargetUserName = ref<string>()

const resetConfirmText = ref('')
const RESET_CONFIRM_TEXT = '我确认删除'

const users = ref<ResponsePointUserModel[]>([])

const pointSourceOptions = [
  { type: EventDataTypes.Guard, label: '上舰' },
  { type: EventDataTypes.SC, label: 'Superchat' },
  { type: EventDataTypes.Gift, label: '礼物' },
] as const

const emptyOpenId = '00000000-0000-0000-0000-000000000000'

type PointUserTargetParams = { authId: number } | { uId: number } | { oId: string }

function getPointUserTargetParams(user: ResponsePointUserModel): PointUserTargetParams | null {
  const info = user.info
  if (!info) return null
  if (info.id > 0) return { authId: info.id }
  if (info.userId > 0) return { uId: info.userId }
  if (info.openId && info.openId !== emptyOpenId) return { oId: info.openId }
  return null
}

const enabledPointSources = computed(() => {
  const allowType = props.pointSetting?.allowType ?? []
  return pointSourceOptions.filter((source) => allowType.includes(source.type)).map((source) => source.label)
})

const pointSourceText = computed(() => {
  if (!props.pointSetting) return '加载中'
  return enabledPointSources.value.length > 0 ? enabledPointSources.value.join('、') : '未启用'
})

const hasPaymentPointSource = computed(() => {
  const allowType = props.pointSetting?.allowType ?? []
  return allowType.includes(EventDataTypes.SC) || allowType.includes(EventDataTypes.Gift)
})

const pointSourceAlertType = computed(() => {
  if (!props.pointSetting) return 'info'
  return hasPaymentPointSource.value ? 'info' : 'warning'
})

const pointSourceHelpText = computed(() => {
  if (!props.pointSetting) return '正在读取当前积分来源。'
  if (hasPaymentPointSource.value) return '只有启用的来源会写入积分记录。'
  return 'SC / 礼物未启用时，送礼记录不会生成积分用户。'
})

const searchKeyword = ref('')
const debouncedSearchKeyword = ref('')

const updateSearch = useDebounceFn((value: string) => {
  debouncedSearchKeyword.value = value
}, 250)

watch(searchKeyword, (newVal) => {
  updateSearch(newVal)
  pn.value = 1
})

watch(
  () => [settings.value.onlyAuthed, settings.value.sortBy],
  () => {
    pn.value = 1
  },
)

const filteredUsers = computed(() => {
  const keyword = debouncedSearchKeyword.value.trim().toLowerCase()
  const sortBy = settings.value.sortBy ?? 'updateAt_desc'
  return users.value
    .filter((user) => {
      if (settings.value.onlyAuthed && !user.isAuthed) return false
      if (!keyword) return true
      return (
        user.info.name?.toLowerCase().includes(keyword) === true ||
        user.info.userId?.toString().includes(keyword) === true ||
        user.info.openId?.toLowerCase().includes(keyword) === true
      )
    })
    .toSorted((a, b) => {
      switch (sortBy) {
        case 'point_desc':
          return b.point - a.point
        case 'point_asc':
          return a.point - b.point
        case 'order_desc':
          return (b.orderCount || 0) - (a.orderCount || 0)
        case 'updateAt_desc':
        default:
          return b.updateAt - a.updateAt
      }
    })
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / ps.value) || 1)

const paginatedUsers = computed(() => {
  const start = (pn.value - 1) * ps.value
  return filteredUsers.value.slice(start, start + ps.value)
})

const userStats = computed(() => {
  const totalPoints = users.value.reduce((sum, u) => sum + u.point, 0)
  const avgPoints = users.value.length > 0 ? totalPoints / users.value.length : 0
  return {
    total: users.value.length,
    authed: users.value.filter((u) => u.isAuthed).length,
    totalPoints: Number(totalPoints.toFixed(1)),
    totalOrders: users.value.reduce((sum, u) => sum + ((u.orderCount || 0) > 0 ? u.orderCount || 0 : 0), 0),
    avgPoints: Number(avgPoints.toFixed(1)),
  }
})

const currentUser = ref<ResponsePointUserModel>()

async function getUsers() {
  return (
    (await run<ResponsePointUserModel[]>(() => getApiPointGetAllUsers(), {
      fail: '获取用户失败',
    })) ?? []
  )
}

async function refresh() {
  users.value = await getUsers()
}

function openGivePointForUser(user: ResponsePointUserModel | null) {
  presetTargetUser.value = user
  addPointCount.value = 0
  addPointReason.value = ''
  addPointTarget.value = undefined
  selectedTargetUserName.value = undefined
  showGivePointModal.value = true
}

const canSubmitGivePoint = computed(() => {
  if (!addPointCount.value || addPointCount.value === 0) return false
  if (presetTargetUser.value) {
    return getPointUserTargetParams(presetTargetUser.value) !== null
  }
  return Boolean(addPointTarget.value && addPointTarget.value > 0)
})

async function givePoint() {
  if (addPointCount.value === 0) {
    message.error('积分数量不能为 0')
    return
  }

  let targetParams: PointUserTargetParams | null = null
  if (presetTargetUser.value) {
    targetParams = getPointUserTargetParams(presetTargetUser.value)
  } else if (addPointTarget.value && addPointTarget.value > 0) {
    targetParams = { uId: addPointTarget.value }
  }

  if (!targetParams) {
    message.error('请选择有效目标用户')
    return
  }

  const delta = addPointCount.value
  const data = await run(
    () =>
      postApiPointGivePoint({
        ...(targetParams as any),
        count: delta,
        reason: addPointReason.value || '',
      }),
    { fail: '调整积分失败' },
  )

  if (data) {
    const userName =
      presetTargetUser.value?.info?.name ||
      data?.userName ||
      selectedTargetUserName.value ||
      `UID: ${addPointTarget.value}`
    const action = delta > 0 ? '给予' : '扣除'
    message.success(`成功为 ${userName} ${action}了 ${Math.abs(delta)} 积分`)

    if (presetTargetUser.value) {
      presetTargetUser.value.point =
        typeof data.totalPoint === 'number'
          ? Number(data.totalPoint.toFixed(1))
          : Number((presetTargetUser.value.point + delta).toFixed(1))
      presetTargetUser.value.updateAt = Date.now()
    } else {
      void refresh()
    }

    showGivePointModal.value = false
    presetTargetUser.value = null
    addPointCount.value = 0
    addPointReason.value = ''
    addPointTarget.value = undefined
    selectedTargetUserName.value = undefined
  }
}

async function deleteUser(user: ResponsePointUserModel) {
  const params = getPointUserTargetParams(user)
  if (!params) {
    message.error('无法识别积分用户')
    return
  }

  if (
    await run(() => postApiPointDeleteUser(params as any), {
      success: '已删除',
      fail: '删除失败',
    })
  ) {
    users.value = users.value.filter((u) => u !== user)
  }
}

function getPointUserKey(user: ResponsePointUserModel): string {
  if (user.info.id > 0) return `auth:${user.info.id}`
  if (user.info.userId > 0) return `uid:${user.info.userId}`
  return `oid:${user.info.openId}`
}

function handleDetailUserUpdated(payload: { point: number; updateAt: number }) {
  if (!currentUser.value) return
  const key = getPointUserKey(currentUser.value)
  users.value = users.value.map((u) => (getPointUserKey(u) === key ? { ...u, ...payload } : u))
  currentUser.value = { ...currentUser.value, ...payload }
}

const isAllPageSelected = computed(
  () =>
    paginatedUsers.value.length > 0 &&
    paginatedUsers.value.every((u) => selectedUserKeys.value.includes(getPointUserKey(u))),
)

function toggleUserSelection(user: ResponsePointUserModel, checked: boolean) {
  const key = getPointUserKey(user)
  if (checked) {
    if (!selectedUserKeys.value.includes(key)) {
      selectedUserKeys.value = [...selectedUserKeys.value, key]
    }
  } else {
    selectedUserKeys.value = selectedUserKeys.value.filter((k) => k !== key)
  }
}

function toggleSelectAllPage(checked: boolean) {
  const pageKeys = paginatedUsers.value.map(getPointUserKey)
  if (checked) {
    selectedUserKeys.value = Array.from(new Set([...selectedUserKeys.value, ...pageKeys]))
  } else {
    const removeSet = new Set(pageKeys)
    selectedUserKeys.value = selectedUserKeys.value.filter((k) => !removeSet.has(k))
  }
}

async function batchDeleteSelectedUsers() {
  const selectedUsers = users.value.filter((u) => selectedUserKeys.value.includes(getPointUserKey(u)))
  const payloads = selectedUsers
    .map((u) => getPointUserTargetParams(u))
    .filter((p): p is PointUserTargetParams => p !== null)

  if (!payloads.length) {
    message.warning('所选用户均无法识别删除标识')
    return
  }

  const deletedCount = await run(() => postApiPointBatchDeleteUser(payloads), {
    fail: '批量删除用户失败',
  })
  if (deletedCount !== null) {
    const removeSet = new Set(selectedUsers)
    users.value = users.value.filter((u) => !removeSet.has(u))
    selectedUserKeys.value = []
    message.success(`已批量删除 ${deletedCount} 位用户`)
  }
}

function openSeasonResetModal() {
  seasonNameInput.value = props.pointSetting?.seasonName ?? ''
  const defaultRate = props.pointSetting?.defaultCarryOverRate ?? 0.2
  seasonCarryOverPercent.value = Math.round(defaultRate * 100)
  seasonUpdateSetting.value = true
  showSeasonResetModal.value = true
}

const estimatedSeasonAfterTotal = computed(() => {
  const rate = Math.max(0, Math.min(100, seasonCarryOverPercent.value)) / 100
  return Number((userStats.value.totalPoints * rate).toFixed(1))
})

async function submitSeasonReset() {
  const rate = Math.max(0, Math.min(100, seasonCarryOverPercent.value)) / 100
  const data = await run(
    () =>
      postApiPointSeasonReset({
        carryOverRate: rate,
        seasonName: seasonNameInput.value.trim() || undefined,
        updateSeasonSetting: seasonUpdateSetting.value,
      }),
    { fail: '赛季结算失败' },
  )
  if (data) {
    message.success(
      `赛季结算完成：影响 ${data.affectedUsers} 人，结算前 ${Number(data.totalBefore.toFixed(1))} -> 结算后 ${Number(data.totalAfter.toFixed(1))}`,
    )
    showSeasonResetModal.value = false
    selectedUserKeys.value = []
    void refresh()
  }
}

async function resetAllPoints() {
  if (resetConfirmText.value !== RESET_CONFIRM_TEXT) {
    message.error(`请输入"${RESET_CONFIRM_TEXT}"以确认操作`)
    return
  }

  if (await run(() => postApiPointReset(), { success: '已重置所有用户积分', fail: '重置失败' })) {
    resetConfirmText.value = ''
    showResetAllPointsModal.value = false
    users.value = []
    selectedUserKeys.value = []
    void refresh()
  }
}

function exportData() {
  try {
    const exportList = filteredUsers.value
    const text = objectsToCSV(
      exportList.map((user) => ({
        用户ID: user.info.userId || user.info.openId,
        用户名: user.info.name || '未知',
        认证状态: user.isAuthed ? '已认证' : '未认证',
        积分: Number(user.point.toFixed(1)),
        订单数量: user.orderCount || 0,
        最后更新时间: format(user.updateAt, 'yyyy-MM-dd HH:mm:ss'),
      })),
    )

    const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `用户积分_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name ?? ''}_.csv`,
    )

    message.success(`已导出 ${exportList.length} 位用户`)
  } catch (error) {
    message.error(`导出失败: ${error}`)
  }
}

onMounted(() => {
  void refresh()
})
</script>

<template>
  <div class="space-y-3.5">
    <!-- 紧凑统计栏 -->
    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">总用户</span>
          <span class="text-lg font-bold font-mono text-foreground">{{ userStats.total }}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">已认证</span>
          <span class="text-lg font-bold font-mono text-emerald-500">{{ userStats.authed }}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">总积分</span>
          <span class="text-lg font-bold font-mono text-primary">{{ userStats.totalPoints }}</span>
        </CardContent>
      </Card>
      <Card>
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">总订单</span>
          <span class="text-lg font-bold font-mono text-blue-500">{{ userStats.totalOrders }}</span>
        </CardContent>
      </Card>
      <Card class="col-span-2 sm:col-span-1">
        <CardContent class="p-3 flex-col-center text-center space-y-0.5">
          <span class="text-[11px] text-muted-foreground">平均积分</span>
          <span class="text-lg font-bold font-mono text-foreground">{{ userStats.avgPoints }}</span>
        </CardContent>
      </Card>
    </div>

    <!-- 积分来源提示 -->
    <Alert
      variant="warning"
      class="border py-2.5"
      :class="
        pointSourceAlertType === 'warning'
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      "
    >
      <div class="flex-between flex-wrap gap-2 w-full">
        <div>
          <span class="text-xs font-semibold block">当前积分来源：{{ pointSourceText }}</span>
          <span class="text-[11px] text-muted-foreground mt-0.5 block">{{ pointSourceHelpText }}</span>
        </div>
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="emit('openSourceSettings')"
        >
          <Settings24Regular class="size-3.5" />
          <span>来源设置</span>
        </Button>
      </div>
    </Alert>

    <!-- 工具栏 -->
    <div class="flex-between gap-2.5 flex-wrap bg-card p-3 rounded-lg border border-border">
      <div class="flex items-center gap-2.5 flex-wrap">
        <div class="relative w-56">
          <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索用户名 / UID / OpenId"
            class="pl-8"
          />
        </div>

        <Select
          :model-value="settings.sortBy ?? 'updateAt_desc'"
          @update:model-value="settings.sortBy = $event as UserSortKey"
        >
          <SelectTrigger class="w-36">
            <ArrowSortDownLines24Regular class="size-3.5 mr-1 text-muted-foreground shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="updateAt_desc">最近活跃</SelectItem>
            <SelectItem value="point_desc">积分从高到低</SelectItem>
            <SelectItem value="point_asc">积分从低到高</SelectItem>
            <SelectItem value="order_desc">订单最多</SelectItem>
          </SelectContent>
        </Select>

        <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
          <Checkbox
            :checked="settings.onlyAuthed"
            @update:checked="settings.onlyAuthed = Boolean($event)"
          />
          <span class="text-foreground">仅已认证</span>
        </label>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent class="max-w-xs space-y-1">
              <p>1. 若 EventFetcher 使用开放平台连接，未认证用户无 UID（仅 OpenId）。</p>
              <p>2. 用户名默认保留首次事件出现时的记录。</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          class="gap-1"
          @click="refresh"
        >
          <ArrowSync24Regular class="size-3.5" />
          <span class="hidden sm:inline">刷新</span>
        </Button>
        <Button
          variant="outline"
          class="gap-1"
          @click="openGivePointForUser(null)"
        >
          <AddSquare24Regular class="size-3.5" />
          <span>积分调整</span>
        </Button>
        <Button
          variant="outline"
          class="gap-1"
          @click="exportData"
        >
          <ArrowDownload24Regular class="size-3.5" />
          <span class="hidden sm:inline">导出 CSV</span>
        </Button>
        <Button
          variant="outline"
          class="gap-1 text-amber-600 dark:text-amber-400"
          @click="openSeasonResetModal"
        >
          <span>赛季结算</span>
        </Button>
        <Button
          variant="destructive"
          class="gap-1"
          @click="showResetAllPointsModal = true"
        >
          <Delete24Regular class="size-3.5" />
          <span class="hidden sm:inline">重置全部</span>
        </Button>
      </div>
    </div>

    <!-- 批量选择条 -->
    <div
      v-if="selectedUserKeys.length > 0"
      class="flex-between flex-wrap gap-2 px-3.5 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs"
    >
      <div class="flex items-center gap-2">
        <span class="font-medium text-foreground">已选择 {{ selectedUserKeys.length }} 位用户</span>
        <Button
          variant="ghost"
          size="xs"
          @click="selectedUserKeys = []"
        >
          取消选择
        </Button>
      </div>
      <Popconfirm
        positive-text="确认批量删除"
        negative-text="取消"
        @positive-click="batchDeleteSelectedUsers"
      >
        <template #trigger>
          <Button
            variant="destructive"
            size="xs"
            :loading="isLoading"
          >
            批量删除 ({{ selectedUserKeys.length }})
          </Button>
        </template>
        确定要批量删除已选择的 {{ selectedUserKeys.length }} 位积分用户吗？操作不可恢复。
      </Popconfirm>
    </div>

    <!-- 用户表格 -->
    <Card>
      <CardContent class="p-0">
        <Spin :show="isLoading">
          <Empty
            v-if="filteredUsers.length === 0"
            :description="isLoading ? '加载中...' : settings.onlyAuthed ? '没有已认证的用户' : '没有匹配用户'"
            class="py-12"
          />
          <div v-else>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-10 px-3">
                      <Checkbox
                        :checked="isAllPageSelected"
                        @update:checked="(v) => toggleSelectAllPage(Boolean(v))"
                      />
                    </TableHead>
                    <TableHead class="w-20">认证</TableHead>
                    <TableHead>用户</TableHead>
                    <TableHead class="w-28 text-right">积分</TableHead>
                    <TableHead class="w-24 text-right">订单数</TableHead>
                    <TableHead class="w-44">最后更新于</TableHead>
                    <TableHead class="w-40 text-right pr-4">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="user in paginatedUsers"
                    :key="getPointUserKey(user)"
                    class="hover:bg-muted/30"
                  >
                    <TableCell class="px-3">
                      <Checkbox
                        :checked="selectedUserKeys.includes(getPointUserKey(user))"
                        @update:checked="(v) => toggleUserSelection(user, Boolean(v))"
                      />
                    </TableCell>
                    <TableCell>
                      <Badge
                        :variant="user.isAuthed ? 'success' : 'secondary'"
                        size="xs"
                      >
                        {{ user.isAuthed ? '已认证' : '未认证' }}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div class="flex flex-col text-xs">
                        <span class="font-medium text-foreground">{{ user.info?.name || '未知' }}</span>
                        <span class="text-[11px] text-muted-foreground font-mono">
                          {{
                            user.info.userId > 0
                              ? `UID ${user.info.userId}`
                              : user.info.openId && user.info.openId !== emptyOpenId
                                ? `OID ${user.info.openId.slice(0, 10)}...`
                                : '--'
                          }}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right font-mono font-semibold text-foreground">
                      {{ formatNumber(Number(user.point.toFixed(1))) }}
                    </TableCell>
                    <TableCell class="text-right">
                      <span
                        v-if="!user.isAuthed"
                        class="text-muted-foreground text-[11px]"
                      >
                        未认证
                      </span>
                      <span
                        v-else-if="user.orderCount > 0"
                        class="font-mono"
                      >
                        {{ formatNumber(user.orderCount) }}
                      </span>
                      <span
                        v-else
                        class="text-muted-foreground text-[11px]"
                      >
                        0
                      </span>
                    </TableCell>
                    <TableCell class="text-muted-foreground text-xs">
                      {{ formatTime(user.updateAt) }}
                    </TableCell>
                    <TableCell class="text-right pr-4">
                      <div class="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="xs"
                          :disabled="!getPointUserTargetParams(user)"
                          @click="openGivePointForUser(user)"
                        >
                          调分
                        </Button>
                        <Button
                          variant="ghost"
                          size="xs"
                          class="text-primary hover:text-primary"
                          @click="((currentUser = user), (showDetailSheet = true))"
                        >
                          详情
                        </Button>
                        <Popconfirm
                          positive-text="删除"
                          negative-text="取消"
                          @positive-click="deleteUser(user)"
                        >
                          <template #trigger>
                            <Button
                              variant="ghost"
                              size="xs"
                              class="text-destructive hover:bg-destructive/10"
                            >
                              删除
                            </Button>
                          </template>
                          确定要删除「{{ user.info?.name || '该用户' }}」吗？记录将无法恢复
                        </Popconfirm>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <!-- 分页栏 -->
            <div class="flex-between px-4 py-3 border-t text-xs">
              <span class="text-muted-foreground">
                共 {{ filteredUsers.length }} 位用户，第 {{ pn }} / {{ totalPages }} 页
              </span>
              <div class="flex items-center gap-2">
                <div class="w-28">
                  <Select
                    :model-value="String(ps)"
                    @update:model-value="((ps = Number($event)), (pn = 1))"
                  >
                    <SelectTrigger size="xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 条/页</SelectItem>
                      <SelectItem value="25">25 条/页</SelectItem>
                      <SelectItem value="50">50 条/页</SelectItem>
                      <SelectItem value="100">100 条/页</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    :disabled="pn <= 1"
                    @click="pn--"
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    :disabled="pn >= totalPages"
                    @click="pn++"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Spin>
      </CardContent>
    </Card>

    <!-- 用户详情抽屉 -->
    <Sheet v-model:open="showDetailSheet">
      <SheetContent
        side="right"
        class="w-full sm:max-w-3xl flex flex-col p-0 gap-0"
      >
        <SheetHeader class="px-5 py-3.5 border-b border-border/70">
          <SheetTitle class="text-sm font-semibold">
            用户详情 · {{ currentUser?.info?.name || '未知用户' }}
          </SheetTitle>
        </SheetHeader>
        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
          <PointUserDetailCard
            v-if="currentUser"
            :key="getPointUserKey(currentUser)"
            :user="currentUser"
            @user-updated="handleDetailUserUpdated"
          />
        </div>
      </SheetContent>
    </Sheet>

    <!-- 积分调整弹窗 -->
    <Dialog v-model:open="showGivePointModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm">给予 / 扣除积分</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div
            v-if="presetTargetUser"
            class="flex-between p-2.5 rounded-lg border border-border bg-muted/30 text-xs"
          >
            <div>
              <span class="font-semibold text-foreground block">{{ presetTargetUser.info.name || '未知用户' }}</span>
              <span class="text-muted-foreground font-mono text-[11px]">
                当前积分: {{ Number(presetTargetUser.point.toFixed(1)) }}
              </span>
            </div>
            <Button
              variant="ghost"
              size="xs"
              @click="presetTargetUser = null"
            >
              更换用户
            </Button>
          </div>

          <FormField
            v-else
            label="目标用户"
          >
            <BiliUserSelector
              v-model:value="addPointTarget"
              placeholder="请输入 B站用户 UID"
              @user-info-loaded="(userInfo) => (selectedTargetUserName = userInfo?.name)"
            />
          </FormField>

          <FormField
            label="积分数量"
            hint="正数为给予，负数为扣除"
          >
            <NumberField
              v-model="addPointCount"
              placeholder="输入要给予或扣除的积分"
              class="w-full"
            />
          </FormField>

          <FormField label="备注说明 (选填)">
            <Input
              v-model="addPointReason"
              placeholder="请输入备注"
              maxlength="100"
            />
          </FormField>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showGivePointModal = false"
          >
            取消
          </Button>
          <Button
            :loading="isLoading"
            :disabled="!canSubmitGivePoint"
            @click="givePoint"
          >
            {{ !addPointCount || addPointCount === 0 ? '确定' : addPointCount > 0 ? '确认给予' : '确认扣除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 赛季结算 / 积分结转弹窗 -->
    <Dialog v-model:open="showSeasonResetModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">赛季结算与积分结转</DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            按指定比例保留观众当前积分（例如
            20%），清除溢出部分并写入「Manual」审计流水，同时保留用户账号与签到连续记录。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3.5 py-2 text-xs">
          <FormField label="新赛季 / 结算标识 (选填)">
            <Input
              v-model="seasonNameInput"
              placeholder="例如: 2026 夏日祭 S2"
              maxlength="64"
            />
          </FormField>

          <FormField label="积分结转比例 (%)">
            <template #extra>
              <div class="ml-auto flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  @click="seasonCarryOverPercent = 0"
                >
                  清零 0%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  @click="seasonCarryOverPercent = 20"
                >
                  20%
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  @click="seasonCarryOverPercent = 50"
                >
                  50%
                </Button>
              </div>
            </template>
            <NumberField
              v-model="seasonCarryOverPercent"
              :min="0"
              :max="100"
            />
          </FormField>

          <div class="p-2.5 rounded-lg border border-border/70 bg-muted/30 space-y-1">
            <div class="flex-between">
              <span class="text-muted-foreground">结算前总积分</span>
              <span class="font-mono font-semibold">{{ userStats.totalPoints }}</span>
            </div>
            <div class="flex-between">
              <span class="text-muted-foreground">预计结转后总积分</span>
              <span class="font-mono font-semibold text-primary">{{ estimatedSeasonAfterTotal }}</span>
            </div>
          </div>

          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox
              :checked="seasonUpdateSetting"
              @update:checked="seasonUpdateSetting = Boolean($event)"
            />
            <span>同步记录当前赛季名称与默认结转比例到积分规则</span>
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showSeasonResetModal = false"
          >
            取消
          </Button>
          <Button
            :loading="isLoading"
            @click="submitSeasonReset"
          >
            确认执行结算
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 重置所有用户积分弹窗 -->
    <Dialog v-model:open="showResetAllPointsModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm text-destructive flex items-center gap-2">
            <Warning24Regular class="size-5" />
            重置所有用户积分
          </DialogTitle>
          <DialogDescription class="text-xs text-destructive">
            警告：此操作将清空所有用户的积分记录，且不可恢复！
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <p class="text-xs text-foreground">
            请输入 <strong class="text-destructive">"{{ RESET_CONFIRM_TEXT }}"</strong> 以确认操作
          </p>
          <Input
            v-model="resetConfirmText"
            placeholder="请输入确认文本"
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showResetAllPointsModal = false"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            :loading="isLoading"
            :disabled="resetConfirmText !== RESET_CONFIRM_TEXT"
            @click="resetAllPoints"
          >
            确认重置所有用户积分
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
