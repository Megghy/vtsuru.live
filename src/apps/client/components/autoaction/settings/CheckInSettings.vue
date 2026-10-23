<script lang="ts" setup>
import {
  ArrowClockwise16Filled,
  Delete16Filled,
  Flash24Regular,
  Info24Filled,
  People24Regular,
  Search24Regular,
  Settings24Regular,
} from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  getApiCheckinAdminUsers,
  postApiCheckinAdminReset,
  postApiCheckinCheckInFor,
} from '@/api/generated/check-in/check-in'
import type { CheckInResponse, ResponseUserCheckInModel, SettingPoint } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import AutoActionEditor from '../AutoActionEditor.vue'
import { CHECKIN_PLACEHOLDERS } from '../placeholders'
import TemplateHelper from '../TemplateHelper.vue'

const autoActionStore = useAutoAction()
const config = autoActionStore.checkInModule.checkInConfig
const accountInfo = useAccount()
const isLoading = ref(false)

const customTestContext = ref({
  checkin: {
    points: 0,
    consecutiveDays: 0,
    todayRank: 0,
    time: new Date(),
  },
})

const checkInPlaceholders = CHECKIN_PLACEHOLDERS

const defaultPointSetting: SettingPoint = {
  allowType: [],
  jianzhangPoint: 0,
  tiduPoint: 0,
  zongduPoint: 0,
  giftPercentMap: {},
  scPointPercent: 0,
  giftPointPercent: 0,
  giftAllowType: 0,
  shouldDiscontinueWhenSoldOut: false,
  enableCheckIn: false,
  checkInKeyword: '',
  givePointsForCheckIn: false,
  baseCheckInPoints: 0,
  enableConsecutiveBonus: false,
  bonusPointsPerDay: 0,
  maxBonusPoints: 0,
  allowSelfCheckIn: false,
  requireAuth: false,
  enableDailyFirstDanmaku: false,
  dailyFirstDanmakuPoints: 5,
  enableDailyFirstGift: false,
  dailyFirstGiftPoints: 10,
  useDailyFirstGiftPercent: false,
  dailyFirstGiftPercent: 0.1,
  dailyFirstOnlyOnStreaming: false,
  checkInOnlyOnStreaming: false,
}

const serverSetting = computed<SettingPoint>(() => {
  return accountInfo.value?.settings?.point ?? defaultPointSetting
})

const canEdit = computed(() => {
  return accountInfo.value && accountInfo.value.settings && accountInfo.value.settings.point
})

async function updateSettings() {
  const serverSaved = await updateServerSettings()
  if (serverSaved) {
    toast.success('设置已保存')
  }
  return serverSaved
}

async function updateServerSettings() {
  if (!canEdit.value) return false
  isLoading.value = true

  try {
    const msg = await SaveSetting('Point', accountInfo.value.settings.point)
    if (msg) {
      return true
    } else {
      toast.error(`保存失败: ${msg}`)
    }
  } catch (err) {
    toast.error(`保存失败: ${String(err)}`)
    console.error('保存签到设置失败:', err)
  } finally {
    isLoading.value = false
  }
  return false
}

// 排行榜数据
const rankingData = ref<ResponseUserCheckInModel[]>([])
const isLoadingRanking = ref(false)
const timeRange = ref<string>('all')
const userFilter = ref<string>('')
const rankingPage = ref(1)
const rankingPageSize = ref(10)

const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '上个月', value: 'lastMonth' },
]

const filteredRankingData = computed(() => {
  let filtered = rankingData.value

  if (timeRange.value !== 'all') {
    const now = new Date()
    let startTime: Date

    if (timeRange.value === 'today') {
      startTime = new Date(now)
      startTime.setHours(0, 0, 0, 0)
    } else if (timeRange.value === 'week') {
      const dayOfWeek = now.getDay() || 7
      startTime = new Date(now)
      startTime.setDate(now.getDate() - (dayOfWeek - 1))
      startTime.setHours(0, 0, 0, 0)
    } else if (timeRange.value === 'month') {
      startTime = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (timeRange.value === 'lastMonth') {
      startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const endTime = new Date(now.getFullYear(), now.getMonth(), 1)
      filtered = filtered.filter((user) => {
        const checkInTime = new Date(user.lastCheckInTime)
        return checkInTime >= startTime && checkInTime < endTime
      })
      startTime = new Date(0)
    }

    if (timeRange.value !== 'lastMonth') {
      filtered = filtered.filter((user) => {
        const checkInTime = new Date(user.lastCheckInTime)
        return checkInTime >= startTime
      })
    }
  }

  if (userFilter.value) {
    const keyword = userFilter.value.toLowerCase()
    filtered = filtered.filter((user) => user.name.toLowerCase().includes(keyword))
  }

  return filtered
})

const paginatedRankingData = computed(() => {
  const start = (rankingPage.value - 1) * rankingPageSize.value
  return filteredRankingData.value.slice(start, start + rankingPageSize.value)
})

async function loadCheckInRanking() {
  if (isLoadingRanking.value) return
  isLoadingRanking.value = true
  try {
    const response = (await getApiCheckinAdminUsers()) as unknown as {
      code: number
      message?: string
      data: ResponseUserCheckInModel[]
    }

    if (response.code === 200) {
      rankingData.value = response.data
      rankingPage.value = 1
    } else {
      rankingData.value = []
      toast.error(`获取签到排行榜失败: ${response.message}`)
    }
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    toast.error('无法加载签到排行榜数据')
    rankingData.value = []
  } finally {
    isLoadingRanking.value = false
  }
}

const isResetting = ref(false)
const resetTargetId = ref<string>()

async function resetUserCheckInByGuid(ouId: string) {
  if (!ouId || isResetting.value) return
  isResetting.value = true
  resetTargetId.value = ouId

  try {
    const response = await postApiCheckinAdminReset({ ouId })
    if (response && response.code === 200) {
      toast.success('用户签到数据已重置')
      await loadCheckInRanking()
    } else {
      toast.error(response?.message || '无法重置用户签到数据')
    }
  } catch (error) {
    console.error('重置用户签到数据失败:', error)
    toast.error('重置用户签到数据时发生错误')
  } finally {
    isResetting.value = false
    resetTargetId.value = undefined
  }
}

async function resetAllCheckIn() {
  if (isResetting.value) return
  isResetting.value = true
  try {
    const response = await postApiCheckinAdminReset()
    if (response && response.code === 200) {
      toast.success('所有用户的签到数据已重置')
      await loadCheckInRanking()
    } else {
      toast.error(response?.message || '无法重置所有用户签到数据')
    }
  } catch (error) {
    console.error('重置所有用户签到数据失败:', error)
    toast.error('重置所有用户签到数据时发生错误')
  } finally {
    isResetting.value = false
  }
}

const testUid = ref<number>()
const testUsername = ref<string>('测试用户')
const testResult = ref<{ success: boolean; message: string }>()

async function handleTestCheckIn() {
  if (!testUid.value || !serverSetting.value.enableCheckIn) {
    testResult.value = {
      success: false,
      message: '请输入有效的UID或确保签到功能已启用',
    }
    return
  }

  try {
    const response = (await postApiCheckinCheckInFor({
      uId: testUid.value,
      name: testUsername.value || '测试用户',
    })) as unknown as {
      code: number
      message?: string
      data: CheckInResponse
    }

    if (response.code === 200 && response.data) {
      const result = response.data
      testResult.value = {
        success: result.success,
        message: result.success
          ? `签到成功！用户 ${testUsername.value || '测试用户'} 获得 ${result.points} 积分，连续签到 ${result.consecutiveDays} 天`
          : result.message || '签到失败，可能今天已经签到过了',
      }
      if (result.success) toast.success(testResult.value.message)
      else toast.info(testResult.value.message)
    } else {
      testResult.value = {
        success: false,
        message: `API返回错误: ${response.message || '未知错误'}`,
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: `签到操作失败: ${error instanceof Error ? error.message : String(error)}`,
    }
    toast.error(testResult.value.message)
  }
}

function updateCheckInRanking(value: boolean) {
  accountInfo.value.settings.enableFunctions = value
    ? [...accountInfo.value.settings.enableFunctions, FunctionTypes.CheckInRanking]
    : accountInfo.value.settings.enableFunctions.filter((f) => f !== FunctionTypes.CheckInRanking)
  SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
}

function formatRelativeTime(ts: number) {
  try {
    return formatDistanceToNow(new Date(ts), { addSuffix: true, locale: zhCN })
  } catch {
    return ''
  }
}

onMounted(() => {
  loadCheckInRanking()
})
</script>

<template>
  <Card
    v-if="config"
    class="border bg-card"
  >
    <CardHeader class="p-3 pb-2 border-b">
      <CardTitle class="text-sm font-semibold">弹幕签到设置</CardTitle>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs default-value="settings">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger
            value="settings"
            class="text-xs gap-1.5"
          >
            <Settings24Regular class="size-3.5" />
            功能设置
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            class="text-xs gap-1.5"
          >
            <People24Regular class="size-3.5" />
            签到排行榜
          </TabsTrigger>
          <TabsTrigger
            value="test"
            class="text-xs gap-1.5"
          >
            <Flash24Regular class="size-3.5" />
            模拟测试
          </TabsTrigger>
        </TabsList>

        <!-- 功能设置 -->
        <TabsContent
          value="settings"
          class="pt-3 space-y-4"
        >
          <Alert
            v-if="!canEdit"
            class="py-2 px-2.5 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <AlertDescription class="text-xs m-0"> 加载中或无法编辑设置，请稍后再试 </AlertDescription>
          </Alert>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <!-- 基础设置 -->
            <div class="col-span-1 md:col-span-2 border rounded-md p-3 bg-muted/10 space-y-3">
              <span class="font-semibold text-xs text-foreground block">基础设置</span>

              <div class="flex items-center justify-between p-2 rounded border bg-card">
                <div>
                  <span class="text-xs font-medium text-foreground block">启用签到功能</span>
                  <span class="text-[11px] text-muted-foreground block mt-0.5">观众发送签到命令可获得积分</span>
                </div>
                <Switch
                  v-model:checked="serverSetting.enableCheckIn"
                  @update:checked="updateServerSettings"
                />
              </div>

              <div
                v-if="serverSetting.enableCheckIn"
                class="space-y-3 pt-1"
              >
                <div class="flex items-center gap-2">
                  <span class="text-xs text-muted-foreground w-20 shrink-0">签到命令 *</span>
                  <Input
                    :value="serverSetting.checkInKeyword"
                    placeholder="例如：签到"
                    class="flex-1"
                    @input="serverSetting.checkInKeyword = ($event.target as HTMLInputElement).value"
                  />
                  <Button @click="updateServerSettings"> 保存 </Button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div class="flex items-center justify-between p-2 rounded border bg-card">
                    <span class="text-xs font-medium text-foreground">要求已认证</span>
                    <Switch
                      v-model:checked="serverSetting.requireAuth"
                      @update:checked="updateServerSettings"
                    />
                  </div>
                  <div class="flex items-center justify-between p-2 rounded border bg-card">
                    <span class="text-xs font-medium text-foreground">允许自己签到</span>
                    <Switch
                      v-model:checked="serverSetting.allowSelfCheckIn"
                      @update:checked="updateServerSettings"
                    />
                  </div>
                  <div class="flex items-center justify-between p-2 rounded border bg-card">
                    <span class="text-xs font-medium text-foreground">允许查看排行</span>
                    <Switch
                      :checked="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.CheckInRanking)"
                      @update:checked="updateCheckInRanking"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 积分奖励配置 -->
            <div
              v-if="serverSetting.enableCheckIn"
              class="col-span-1 md:col-span-2 border rounded-md p-3 bg-muted/10 space-y-3"
            >
              <span class="font-semibold text-xs text-foreground block">积分奖励配置</span>

              <div class="flex items-center justify-between p-2 rounded border bg-card">
                <span class="text-xs font-medium text-foreground">启用积分奖励</span>
                <Switch
                  v-model:checked="serverSetting.givePointsForCheckIn"
                  @update:checked="updateServerSettings"
                />
              </div>

              <div
                v-if="serverSetting.givePointsForCheckIn"
                class="space-y-3 pt-1"
              >
                <div class="flex items-center justify-between p-2 rounded border bg-card">
                  <span class="text-xs font-medium text-foreground">基础签到积分</span>
                  <NumberField
                    :model-value="serverSetting.baseCheckInPoints"
                    :min="0"
                    class="w-32"
                    @update:model-value="((serverSetting.baseCheckInPoints = $event || 0), updateServerSettings())"
                  />
                </div>

                <div class="flex items-center justify-between p-2 rounded border bg-card">
                  <span class="text-xs font-medium text-foreground">连续签到奖励</span>
                  <Switch
                    v-model:checked="serverSetting.enableConsecutiveBonus"
                    @update:checked="updateServerSettings"
                  />
                </div>

                <div
                  v-if="serverSetting.enableConsecutiveBonus"
                  class="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  <div class="flex items-center justify-between p-2 rounded border bg-card">
                    <span class="text-xs font-medium text-foreground">每日额外奖励</span>
                    <NumberField
                      :model-value="serverSetting.bonusPointsPerDay"
                      :min="0"
                      class="w-28"
                      @update:model-value="((serverSetting.bonusPointsPerDay = $event || 0), updateServerSettings())"
                    />
                  </div>
                  <div class="flex items-center justify-between p-2 rounded border bg-card">
                    <span class="text-xs font-medium text-foreground">奖励积分上限</span>
                    <NumberField
                      :model-value="serverSetting.maxBonusPoints"
                      :min="0"
                      class="w-28"
                      @update:model-value="((serverSetting.maxBonusPoints = $event || 0), updateServerSettings())"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 自动回复消息 -->
            <div
              v-if="serverSetting.enableCheckIn"
              class="col-span-1 md:col-span-2 border rounded-md p-3 bg-muted/10 space-y-3"
            >
              <div class="flex items-center justify-between p-2 rounded border bg-card">
                <span class="text-xs font-medium text-foreground">发送签到回复</span>
                <Switch v-model:checked="config.sendReply" />
              </div>

              <div
                v-if="config.sendReply"
                class="space-y-4 pt-1"
              >
                <TemplateHelper :placeholders="checkInPlaceholders" />

                <div class="reply-editor-section space-y-2 p-3 rounded-md border bg-card">
                  <span class="font-semibold text-xs text-foreground block">签到成功回复</span>
                  <AutoActionEditor
                    :action="config.successAction"
                    :hide-name="true"
                    :hide-enabled="true"
                    :hide-user-filter="true"
                    :custom-test-context="customTestContext"
                  />
                </div>

                <div class="reply-editor-section space-y-2 p-3 rounded-md border bg-card">
                  <span class="font-semibold text-xs text-foreground block">重复签到回复</span>
                  <AutoActionEditor
                    :action="config.cooldownAction"
                    :hide-name="true"
                    :hide-enabled="true"
                    :hide-user-filter="true"
                    :custom-test-context="customTestContext"
                  />
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-center pt-2">
            <Button
              class="px-8"
              :disabled="!canEdit || isLoading"
              @click="updateSettings"
            >
              {{ isLoading ? '保存中...' : '保存所有更改' }}
            </Button>
          </div>
        </TabsContent>

        <!-- 签到排行榜 -->
        <TabsContent
          value="ranking"
          class="pt-3 space-y-3"
        >
          <Alert class="py-2 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <AlertDescription class="text-xs m-0">
              显示用户签到排行榜。选择时间段可查看不同期间的签到数据。
            </AlertDescription>
          </Alert>

          <div class="flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="w-32">
                <Select
                  v-model="timeRange"
                  @update:model-value="loadCheckInRanking"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in timeRangeOptions"
                      :key="opt.value"
                      :value="opt.value"
                      class="text-xs"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="relative w-44">
                <Search24Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  v-model="userFilter"
                  placeholder="搜索用户名..."
                  class="pl-8 pr-2"
                />
              </div>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                class="gap-1"
                :disabled="isLoadingRanking"
                @click="loadCheckInRanking"
              >
                <ArrowClockwise16Filled
                  class="size-3.5"
                  :class="{ 'animate-spin': isLoadingRanking }"
                />
                刷新
              </Button>

              <Popconfirm
                title="警告"
                @positive-click="resetAllCheckIn"
              >
                <template #trigger>
                  <Button
                    variant="outline"
                    class="border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    重置全部
                  </Button>
                </template>
                此操作将清空所有用户的签到记录，确定要继续吗？
              </Popconfirm>
            </div>
          </div>

          <div class="border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="text-xs text-center w-16">排名</TableHead>
                  <TableHead class="text-xs">用户名</TableHead>
                  <TableHead class="text-xs text-center w-24">连续签到</TableHead>
                  <TableHead class="text-xs text-center w-24">总积分</TableHead>
                  <TableHead class="text-xs w-40">最近签到</TableHead>
                  <TableHead class="text-xs text-center w-20">认证</TableHead>
                  <TableHead class="text-xs text-right w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="paginatedRankingData.length > 0">
                  <TableRow
                    v-for="(row, idx) in paginatedRankingData"
                    :key="row.ouId || idx"
                  >
                    <TableCell class="text-xs text-center">
                      <Badge
                        variant="secondary"
                        class="text-[10px] h-5 px-1.5 font-bold"
                        :class="idx === 0 ? 'bg-amber-500 text-white' : idx <= 2 ? 'bg-sky-500 text-white' : ''"
                      >
                        {{ (rankingPage - 1) * rankingPageSize + idx + 1 }}
                      </Badge>
                    </TableCell>

                    <TableCell class="text-xs font-semibold">
                      {{ row.name }}
                    </TableCell>

                    <TableCell class="text-xs text-center">
                      <span
                        :class="
                          row.consecutiveDays > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                            : 'text-muted-foreground'
                        "
                      >
                        {{ row.consecutiveDays }} 天
                      </span>
                    </TableCell>

                    <TableCell class="text-xs text-center font-bold text-sky-600 dark:text-sky-400">
                      {{ row.points }}
                    </TableCell>

                    <TableCell class="text-xs text-muted-foreground whitespace-nowrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <span class="cursor-help">{{ formatRelativeTime(row.lastCheckInTime) }}</span>
                          </TooltipTrigger>
                          <TooltipContent class="text-xs">
                            {{ new Date(row.lastCheckInTime).toLocaleString() }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell class="text-xs text-center">
                      <Badge
                        v-if="row.isAuthed"
                        variant="outline"
                        class="text-[10px] h-4.5 px-1 border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                      >
                        已认证
                      </Badge>
                      <span
                        v-else
                        class="text-xs text-muted-foreground"
                        >否</span
                      >
                    </TableCell>

                    <TableCell class="text-xs text-right">
                      <Popconfirm
                        title="确认重置"
                        @positive-click="resetUserCheckInByGuid(row.ouId)"
                      >
                        <template #trigger>
                          <Button
                            size="xs"
                            variant="ghost"
                            class="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                            :disabled="isResetting"
                          >
                            <Delete16Filled class="size-3.5" />
                          </Button>
                        </template>
                        确定要重置用户「{{ row.name }}」的签到数据吗？
                      </Popconfirm>
                    </TableCell>
                  </TableRow>
                </template>
                <template v-else>
                  <TableRow>
                    <TableCell
                      colspan="7"
                      class="text-center py-8"
                    >
                      <Empty description="暂无签到排行数据" />
                    </TableCell>
                  </TableRow>
                </template>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="filteredRankingData.length > rankingPageSize"
            class="flex justify-end pt-2"
          >
            <Pagination
              v-model:page="rankingPage"
              v-model:page-size="rankingPageSize"
              :total="filteredRankingData.length"
              size="small"
            />
          </div>
        </TabsContent>

        <!-- 模拟测试 -->
        <TabsContent
          value="test"
          class="pt-3 space-y-4 max-w-xl"
        >
          <Alert class="py-2 px-2.5 border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <AlertDescription class="text-xs m-0">
              在此可以模拟用户发送签到命令，验证逻辑和回复消息是否正确。
            </AlertDescription>
          </Alert>

          <div class="border rounded-md p-3.5 bg-card space-y-3">
            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">模拟用户 UID</span>
              <BiliUserSelector
                v-model:value="testUid"
                placeholder="请输入或选择B站用户"
                @user-info-loaded="
                  (u) => {
                    if (u?.name && (!testUsername || testUsername === '测试用户')) testUsername = u.name
                  }
                "
              />
            </div>

            <div class="space-y-1">
              <span class="text-xs text-muted-foreground">模拟用户名称</span>
              <Input
                v-model="testUsername"
                placeholder="默认为'测试用户'"
              />
            </div>

            <div class="flex justify-end pt-1">
              <Button
                :disabled="!testUid || !serverSetting.enableCheckIn"
                @click="handleTestCheckIn"
              >
                开始模拟签到
              </Button>
            </div>
          </div>

          <div
            v-if="testResult"
            class="pt-1"
          >
            <Alert
              :class="
                testResult.success
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400'
              "
            >
              <AlertTitle class="text-xs font-semibold">
                {{ testResult.success ? '模拟签到成功' : '模拟签到失败' }}
              </AlertTitle>
              <AlertDescription class="text-xs mt-1">
                {{ testResult.message }}
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>

    <div class="p-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center gap-1.5">
      <Info24Filled class="size-4 shrink-0 text-muted-foreground" />
      <span>提示：签到回复消息会遵循全局弹幕设置（频率限制、长度等）。</span>
    </div>
  </Card>

  <Card
    v-else
    class="border bg-card p-12 text-center"
  >
    <div class="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
    <span class="text-xs text-muted-foreground block mt-2">正在加载设置...</span>
  </Card>
</template>
