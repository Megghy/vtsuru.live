<script setup lang="ts">
import {
  AddSquare24Regular,
  ArrowDownload24Regular,
  ArrowSync24Regular,
  Delete24Regular,
  Info24Filled,
  Search24Regular,
  Settings24Regular,
  Warning24Regular,
} from '@vicons/fluent'
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel } from '@/api/client-types'
import type { ResponsePointUserModel, SettingPoint } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import {
  getApiPointGetAllUsers,
  postApiPointDeleteUser,
  postApiPointGivePoint,
  postApiPointReset,
} from '@/api/generated/point/point'
import { formatNumber, formatTime } from '@/apps/manage/composables/formatters'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { objectsToCSV, useMessage } from '@/shared/utils'

import PointUserDetailCard from './PointUserDetailCard.vue'

interface PointUserSettings {
  onlyAuthed: boolean
  searchKeyword?: string
}

const props = defineProps<{
  goods: ResponsePointGoodModel[]
  pointSetting?: SettingPoint
}>()
const emit = defineEmits<{
  openSourceSettings: []
}>()

const message = useMessage()
const accountInfo = useAccount()

const defaultSettings: PointUserSettings = {
  onlyAuthed: false,
}

const settings = usePersistedStorage<PointUserSettings>(
  'Settings.Point.Users',
  JSON.parse(JSON.stringify(defaultSettings)),
)

// 分页参数
const pn = ref(1)
const ps = ref(25)

// 弹窗控制
const showModal = ref(false)
const showGivePointModal = ref(false)
const showResetAllPointsModal = ref(false)
const { loading: isLoading, run } = useApiAction()
isLoading.value = true

// 积分调整表单
const addPointCount = ref(0)
const addPointReason = ref<string>('')
const addPointTarget = ref<number>()
const selectedTargetUserName = ref<string>()

// 重置所有积分确认
const resetConfirmText = ref('')
const RESET_CONFIRM_TEXT = '我确认删除'

// 用户数据
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

// 搜索关键词
const searchKeyword = ref('')
const debouncedSearchKeyword = ref('')

const updateSearch = useDebounceFn((value: string) => {
  debouncedSearchKeyword.value = value
}, 300)

watch(searchKeyword, (newVal) => {
  updateSearch(newVal)
  pn.value = 1
})

watch(
  () => settings.value.onlyAuthed,
  () => {
    pn.value = 1
  },
)

const filteredUsers = computed(() => {
  const keyword = debouncedSearchKeyword.value.trim().toLowerCase()
  return users.value
    .filter((user) => {
      if (settings.value.onlyAuthed && !user.isAuthed) return false
      if (!keyword) return true
      return user.info.name?.toLowerCase().includes(keyword) === true || user.info.userId?.toString() === keyword
    })
    .toSorted((a, b) => b.updateAt - a.updateAt)
})

const totalPages = computed(() => Math.ceil(filteredUsers.value.length / ps.value) || 1)

const paginatedUsers = computed(() => {
  const start = (pn.value - 1) * ps.value
  return filteredUsers.value.slice(start, start + ps.value)
})

// 用户统计
const userStats = computed(() => {
  const totalPoints = users.value.reduce((sum, u) => sum + u.point, 0)
  const avgPoints = users.value.length > 0 ? users.value.reduce((sum, u) => sum + u.point, 0) / users.value.length : 0
  return {
    total: users.value.length,
    authed: users.value.filter((u) => u.isAuthed).length,
    totalPoints: Number(totalPoints.toFixed(1)),
    totalOrders: users.value.reduce((sum, u) => sum + ((u.orderCount || 0) > 0 ? u.orderCount || 0 : 0), 0),
    avgPoints: Number(avgPoints.toFixed(1)),
    filtered: filteredUsers.value.length,
  }
})

// 当前查看的用户详情
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

async function givePoint() {
  if (addPointCount.value === 0) {
    message.error('积分数量不能为 0')
    return
  }

  if (!addPointTarget.value || addPointTarget.value <= 0) {
    message.error('请输入用户ID')
    return
  }

  const data = await run(
    () =>
      postApiPointGivePoint({
        uId: addPointTarget.value,
        count: addPointCount.value,
        reason: addPointReason.value || '',
      }),
    { fail: '添加失败' },
  )

  if (data) {
    const userName = data?.userName || selectedTargetUserName.value || `UID: ${addPointTarget.value}`
    const action = addPointCount.value > 0 ? '添加' : '扣除'
    message.success(`成功为 ${userName} ${action}了 ${Math.abs(addPointCount.value)} 积分`)
    showGivePointModal.value = false
    setTimeout(() => refresh(), 1500)
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

async function resetAllPoints() {
  if (resetConfirmText.value !== RESET_CONFIRM_TEXT) {
    message.error(`请输入"${RESET_CONFIRM_TEXT}"以确认操作`)
    return
  }

  if (await run(() => postApiPointReset(), { success: '已重置所有用户积分', fail: '重置失败' })) {
    resetConfirmText.value = ''
    showResetAllPointsModal.value = false
    setTimeout(() => refresh(), 1500)
  }
}

function exportData() {
  try {
    const text = objectsToCSV(
      users.value.map((user) => ({
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
      `用户积分_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
    )

    message.success('导出成功')
  } catch (error) {
    message.error(`导出失败: ${error}`)
    console.error('导出失败:', error)
  }
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <Card class="border border-border">
        <CardContent class="p-3.5 space-y-1">
          <span class="text-xs text-muted-foreground">总用户</span>
          <span class="text-xl font-bold font-mono text-foreground block">{{ userStats.total }}</span>
        </CardContent>
      </Card>
      <Card class="border border-border">
        <CardContent class="p-3.5 space-y-1">
          <span class="text-xs text-muted-foreground">已认证</span>
          <span class="text-xl font-bold font-mono text-emerald-500 block">{{ userStats.authed }}</span>
        </CardContent>
      </Card>
      <Card class="border border-border">
        <CardContent class="p-3.5 space-y-1">
          <span class="text-xs text-muted-foreground">总积分</span>
          <span class="text-xl font-bold font-mono text-primary block">{{ userStats.totalPoints }}</span>
        </CardContent>
      </Card>
      <Card class="border border-border">
        <CardContent class="p-3.5 space-y-1">
          <span class="text-xs text-muted-foreground">总订单</span>
          <span class="text-xl font-bold font-mono text-blue-500 block">{{ userStats.totalOrders }}</span>
        </CardContent>
      </Card>
      <Card class="border border-border">
        <CardContent class="p-3.5 space-y-1">
          <span class="text-xs text-muted-foreground">平均积分</span>
          <span class="text-xl font-bold font-mono text-foreground block">{{ userStats.avgPoints }}</span>
        </CardContent>
      </Card>
    </div>

    <!-- 积分来源提示 -->
    <Alert
      variant="default"
      class="border"
      :class="
        pointSourceAlertType === 'warning'
          ? 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
          : 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400'
      "
    >
      <div class="flex items-center justify-between flex-wrap gap-2 w-full">
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
          <span class="hidden sm:inline">来源设置</span>
        </Button>
      </div>
    </Alert>

    <!-- 工具栏 -->
    <div class="flex items-center justify-between gap-3 flex-wrap bg-card p-3 rounded-lg border border-border">
      <div class="flex items-center gap-3 flex-wrap">
        <div class="relative w-56">
          <Search24Regular class="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索用户 (用户名或UID)"
            class="pl-8"
          />
        </div>

        <label class="flex items-center gap-1.5 cursor-pointer text-xs select-none">
          <Checkbox
            :checked="settings.onlyAuthed"
            @update:checked="settings.onlyAuthed = $event"
          />
          <span class="text-foreground">只显示已认证用户</span>
        </label>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
            </TooltipTrigger>
            <TooltipContent class="max-w-xs text-xs space-y-1">
              <p>
                1. 如果 EventFetcher 使用的是开放平台连接则无法通过UId搜索除了已认证和手动添加之外的用户 (OpenID不通用)
              </p>
              <p>2. 用户名只会保持在首条记录出现时的用户名</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div class="flex items-center gap-2">
        <Button
          size="xs"
          variant="outline"
          class="gap-1"
          @click="refresh"
        >
          <ArrowSync24Regular class="size-3.5" />
          <span class="hidden sm:inline">刷新</span>
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1 text-blue-500 hover:text-blue-600"
          @click="showGivePointModal = true"
        >
          <AddSquare24Regular class="size-3.5" />
          <span class="hidden sm:inline">积分调整</span>
        </Button>
        <Button
          size="xs"
          variant="outline"
          class="gap-1 text-blue-500 hover:text-blue-600"
          @click="exportData"
        >
          <ArrowDownload24Regular class="size-3.5" />
          <span class="hidden sm:inline">导出</span>
        </Button>

        <Popconfirm
          positive-text="确认重置"
          negative-text="取消"
          @positive-click="showResetAllPointsModal = true"
        >
          <template #trigger>
            <Button
              size="xs"
              variant="destructive"
              class="gap-1"
            >
              <Delete24Regular class="size-3.5" />
              <span class="hidden sm:inline">重置</span>
            </Button>
          </template>
          确定要重置所有用户的积分吗？慎点！
        </Popconfirm>
      </div>
    </div>

    <!-- 用户表格 -->
    <Card class="border border-border">
      <CardContent class="p-0">
        <Spin :show="isLoading">
          <Empty
            v-if="filteredUsers.length === 0"
            :description="isLoading ? '加载中...' : settings.onlyAuthed ? '没有已认证的用户' : '没有用户'"
            class="py-12"
          />
          <div v-else>
            <div class="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-20">认证</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead class="w-28 text-right">积分</TableHead>
                    <TableHead class="w-28 text-right">订单数量</TableHead>
                    <TableHead class="w-44">最后更新于</TableHead>
                    <TableHead class="w-28 text-center">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow
                    v-for="user in paginatedUsers"
                    :key="user.info.userId || user.info.openId"
                  >
                    <TableCell>
                      <Tag
                        :type="user.isAuthed ? 'success' : 'default'"
                        size="small"
                      >
                        {{ user.isAuthed ? '已认证' : '未认证' }}
                      </Tag>
                    </TableCell>
                    <TableCell>
                      <div class="flex flex-col text-xs">
                        <span class="font-medium text-foreground">{{ user.info?.name || '未知' }}</span>
                        <span
                          v-if="!user.info?.name"
                          class="text-[11px] text-muted-foreground"
                        >
                          ({{ user.info.userId ?? user.info.openId }})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell class="text-right text-xs font-mono font-medium text-foreground">
                      {{ formatNumber(Number(user.point.toFixed(1))) }}
                    </TableCell>
                    <TableCell class="text-right text-xs">
                      <span
                        v-if="!user.isAuthed"
                        class="text-muted-foreground text-[11px]"
                        >未认证</span
                      >
                      <span
                        v-else-if="user.orderCount > 0"
                        class="font-mono"
                        >{{ formatNumber(user.orderCount) }}</span
                      >
                      <span
                        v-else
                        class="text-muted-foreground text-[11px]"
                        >无订单</span
                      >
                    </TableCell>
                    <TableCell class="text-xs text-muted-foreground">
                      {{ formatTime(user.updateAt) }}
                    </TableCell>
                    <TableCell class="text-center">
                      <div class="flex items-center justify-center gap-1.5">
                        <Button
                          variant="ghost"
                          size="xs"
                          class="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          @click="
                            currentUser = user
                            showModal = true
                          "
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
                          确定要删除这个用户吗？记录将无法恢复
                        </Popconfirm>
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <!-- 分页栏 -->
            <div class="flex items-center justify-between px-4 py-3 border-t text-xs">
              <span class="text-muted-foreground">
                共 {{ filteredUsers.length }} 位用户，第 {{ pn }} / {{ totalPages }} 页
              </span>
              <div class="flex items-center gap-2">
                <div class="w-28">
                  <Select
                    :model-value="String(ps)"
                    @update:model-value="
                      ps = Number($event)
                      pn = 1
                    "
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

    <!-- 用户详情弹窗 -->
    <Dialog v-model:open="showModal">
      <DialogContent class="max-w-4xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader class="p-4 border-b">
          <DialogTitle class="text-sm font-semibold">用户详情</DialogTitle>
        </DialogHeader>
        <div class="flex-1 overflow-y-auto">
          <PointUserDetailCard
            v-if="currentUser"
            :user="currentUser"
            :goods="goods"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- 积分调整弹窗 -->
    <Dialog v-model:open="showGivePointModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">给予 / 扣除积分</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="space-y-1">
            <label class="text-xs font-medium text-foreground">目标用户</label>
            <BiliUserSelector
              v-model:value="addPointTarget"
              placeholder="请输入B站用户UID"
              @user-info-loaded="(userInfo) => (selectedTargetUserName = userInfo?.name)"
            />
          </div>

          <div class="space-y-1">
            <div class="flex items-center gap-1.5">
              <label class="text-xs font-medium text-foreground">积分数量</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="text-xs">正数为给予，负数为扣除</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <NumberField
              v-model="addPointCount"
              placeholder="输入要给予或扣除的积分"
              class="w-full"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-foreground">备注说明 (选填)</label>
            <Input
              v-model="addPointReason"
              placeholder="请输入备注"
              maxlength="100"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            :loading="isLoading"
            :disabled="!addPointTarget || !addPointCount"
            @click="givePoint"
          >
            {{ !addPointCount || addPointCount === 0 ? '确定' : addPointCount > 0 ? '给予' : '扣除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 重置所有用户积分弹窗 -->
    <Dialog v-model:open="showResetAllPointsModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold text-destructive flex items-center gap-2">
            <Warning24Regular class="size-5" />
            重置所有用户积分
          </DialogTitle>
          <DialogDescription class="text-xs text-destructive">
            警告：此操作将删除所有用户积分记录，不可恢复！
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
