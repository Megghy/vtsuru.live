<script lang="ts" setup>
import { Info, RotateCw, Search, Settings, Trash2, Users, Zap } from 'lucide-vue-next'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import {
  getApiCheckinAdminUsers,
  postApiCheckinAdminReset,
  postApiCheckinCheckInFor,
} from '@/api/generated/check-in/check-in'
import type { ResponseUserCheckInModel, SettingPoint } from '@/api/generated/model'
import { FunctionTypes } from '@/api/generated/model'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import AutoActionEditor from '../AutoActionEditor.vue'
import { CHECKIN_PLACEHOLDERS } from '../placeholders'

const autoActionStore = useAutoAction()
const config = autoActionStore.checkInModule.checkInConfig
const accountInfo = useAccount()
const isLoading = ref(false)

const customTestContext = ref({
  checkin: {
    points: 20,
    consecutiveDays: 5,
    todayRank: 3,
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

const serverSetting = computed<SettingPoint>(() => accountInfo.value?.settings?.point ?? defaultPointSetting)
const canEdit = computed(() => Boolean(accountInfo.value?.settings?.point))

async function updateServerSettings(showSuccessToast = true) {
  if (!canEdit.value) return false
  isLoading.value = true

  try {
    await SaveSetting('Point', accountInfo.value.settings.point)
    if (showSuccessToast) toast.success('云端签到规则已保存')
    return true
  } catch (err) {
    toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
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

// 本地筛选条件变化时仅重置页码，不再重复请求后端接口
watch([timeRange, userFilter], () => {
  rankingPage.value = 1
})

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

  if (userFilter.value.trim()) {
    const keyword = userFilter.value.trim().toLowerCase()
    filtered = filtered.filter((user) => user.name.toLowerCase().includes(keyword))
  }

  return filtered
})

const paginatedRankingData = computed(() => {
  const start = (rankingPage.value - 1) * rankingPageSize.value
  return filteredRankingData.value.slice(start, start + rankingPageSize.value)
})

function getAbsoluteRank(pageIdx: number): number {
  return (rankingPage.value - 1) * rankingPageSize.value + pageIdx + 1
}

async function loadCheckInRanking() {
  if (isLoadingRanking.value) return
  isLoadingRanking.value = true
  try {
    const response = await getApiCheckinAdminUsers()
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

async function resetUserCheckInByGuid(ouId: string) {
  if (!ouId || isResetting.value) return
  isResetting.value = true
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
      message: '请输入有效的 UID 并确保签到功能已启用',
    }
    return
  }

  try {
    const response = await postApiCheckinCheckInFor({
      uId: testUid.value,
      name: testUsername.value || '测试用户',
    })

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
        message: `API 返回错误: ${response.message || '未知错误'}`,
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
  void loadCheckInRanking()
})
</script>

<template>
  <Card v-if="config">
    <CardHeader class="p-3 border-b">
      <CardTitle class="text-xs font-semibold">弹幕签到设置</CardTitle>
    </CardHeader>

    <CardContent class="p-3">
      <Tabs default-value="settings">
        <TabsList class="grid w-full grid-cols-3">
          <TabsTrigger
            value="settings"
            class="gap-1.5"
          >
            <Settings class="size-3.5" />
            功能设置
          </TabsTrigger>
          <TabsTrigger
            value="ranking"
            class="gap-1.5"
          >
            <Users class="size-3.5" />
            签到排行榜
          </TabsTrigger>
          <TabsTrigger
            value="test"
            class="gap-1.5"
          >
            <Zap class="size-3.5" />
            模拟测试
          </TabsTrigger>
        </TabsList>

        <!-- 功能设置 -->
        <TabsContent
          value="settings"
          class="pt-3 space-y-4"
        >
          <Alert
            size="sm"
            variant="warning"
            v-if="!canEdit"
          >
            <AlertDescription class="m-0">加载中或无法编辑云端设置，请稍后再试</AlertDescription>
          </Alert>

          <div class="space-y-3.5">
            <!-- 云端规则区 -->
            <div class="border rounded-md p-3 bg-muted/10 space-y-3">
              <div class="flex-between">
                <div class="flex items-center gap-2">
                  <span class="font-semibold text-xs text-foreground">云端签到规则</span>
                  <Badge
                    variant="outline"
                    size="xs"
                  >
                    云端同步
                  </Badge>
                </div>
                <Button
                  size="xs"
                  :disabled="!canEdit || isLoading"
                  @click="updateServerSettings(true)"
                >
                  {{ isLoading ? '保存中...' : '保存云端规则' }}
                </Button>
              </div>

              <SettingRow
                type="switch"
                variant="compact"
                title="启用签到功能"
                description="观众发送签到命令可获得积分"
                v-model="serverSetting.enableCheckIn"
                @change="updateServerSettings(false)"
              />

              <div
                v-if="serverSetting.enableCheckIn"
                class="space-y-3 pt-1"
              >
                <FormField
                  label="签到命令"
                  required
                  description="修改关键词后请点击右上角「保存云端规则」"
                >
                  <Input
                    v-model="serverSetting.checkInKeyword"
                    placeholder="例如：签到"
                  />
                </FormField>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-2">
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="要求已认证"
                    v-model="serverSetting.requireAuth"
                    @change="updateServerSettings(false)"
                  />
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="允许自己签到"
                    v-model="serverSetting.allowSelfCheckIn"
                    @change="updateServerSettings(false)"
                  />
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="允许查看排行"
                    :model-value="accountInfo.settings?.enableFunctions?.includes(FunctionTypes.CheckInRanking)"
                    @change="updateCheckInRanking"
                  />
                </div>

                <!-- 积分奖励配置 -->
                <div class="border-t pt-3 space-y-2.5">
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="启用积分奖励"
                    v-model="serverSetting.givePointsForCheckIn"
                    @change="updateServerSettings(false)"
                  />

                  <div
                    v-if="serverSetting.givePointsForCheckIn"
                    class="space-y-2.5 pl-2 border-l-2 border-primary/30"
                  >
                    <SettingRow
                      type="number"
                      variant="compact"
                      title="基础签到积分"
                      :min="0"
                      v-model="serverSetting.baseCheckInPoints"
                    />

                    <SettingRow
                      type="switch"
                      variant="compact"
                      title="连续签到奖励"
                      v-model="serverSetting.enableConsecutiveBonus"
                      @change="updateServerSettings(false)"
                    />

                    <div
                      v-if="serverSetting.enableConsecutiveBonus"
                      class="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      <SettingRow
                        type="number"
                        variant="compact"
                        title="每日额外奖励"
                        :min="0"
                        v-model="serverSetting.bonusPointsPerDay"
                      />
                      <SettingRow
                        type="number"
                        variant="compact"
                        title="奖励积分上限"
                        :min="0"
                        v-model="serverSetting.maxBonusPoints"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 客户端本地回复模板区 -->
            <div
              v-if="serverSetting.enableCheckIn"
              class="border rounded-md p-3 bg-muted/10 space-y-3"
            >
              <div class="flex items-center gap-2">
                <span class="font-semibold text-xs text-foreground">客户端自动回复模板</span>
                <Badge
                  variant="secondary"
                  size="xs"
                >
                  本地实时保存
                </Badge>
              </div>

              <SettingRow
                type="switch"
                variant="compact"
                title="发送签到回复"
                hint="关闭后仍记录积分，但客户端不向直播间或私信发送回复"
                v-model="config.sendReply"
              />

              <div
                v-if="config.sendReply"
                class="space-y-3.5 pt-1"
              >
                <div class="space-y-2 p-3 rounded-md border bg-card">
                  <span class="font-semibold text-xs text-foreground block">签到成功回复</span>
                  <AutoActionEditor
                    :action="config.successAction"
                    :hide-name="true"
                    :hide-enabled="true"
                    :hide-user-filter="true"
                    :hide-trigger-settings="true"
                    :custom-test-context="customTestContext"
                    :extra-placeholders="checkInPlaceholders"
                  />
                </div>

                <!-- 早鸟签到（开播前 30 分钟内） -->
                <div class="space-y-2.5 p-3 rounded-md border bg-card">
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="启用早鸟签到专属回复"
                    hint="开播后 30 分钟内完成签到时，优先使用下方专属回复替代普通签到回复"
                    v-model="config.earlyBird.enabled"
                  />
                  <AutoActionEditor
                    v-if="config.earlyBird.enabled"
                    :action="config.earlyBird.successAction"
                    :hide-name="true"
                    :hide-enabled="true"
                    :hide-user-filter="true"
                    :hide-trigger-settings="true"
                    :custom-test-context="customTestContext"
                    :extra-placeholders="checkInPlaceholders"
                  />
                </div>

                <div class="space-y-2 p-3 rounded-md border bg-card">
                  <span class="font-semibold text-xs text-foreground block">重复签到回复</span>
                  <AutoActionEditor
                    :action="config.cooldownAction"
                    :hide-name="true"
                    :hide-enabled="true"
                    :hide-user-filter="true"
                    :hide-trigger-settings="true"
                    :custom-test-context="customTestContext"
                    :extra-placeholders="checkInPlaceholders"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <!-- 签到排行榜 -->
        <TabsContent
          value="ranking"
          class="pt-3 space-y-3"
        >
          <div class="flex-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <div class="w-32">
                <Select v-model="timeRange">
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="opt in timeRangeOptions"
                      :key="opt.value"
                      :value="opt.value"
                    >
                      {{ opt.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div class="relative w-44">
                <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
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
                class="gap-1.5"
                :disabled="isLoadingRanking"
                @click="loadCheckInRanking"
              >
                <RotateCw
                  class="size-3.5"
                  :class="{ 'animate-spin': isLoadingRanking }"
                />
                刷新
              </Button>

              <Popconfirm
                title="确定清空所有用户的签到记录吗？"
                description="此操作不可撤销。"
                @confirm="resetAllCheckIn"
              >
                <Button
                  variant="outline"
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  重置全部
                </Button>
              </Popconfirm>
            </div>
          </div>

          <div class="border rounded-md overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead class="text-center w-16">排名</TableHead>
                  <TableHead>用户名</TableHead>
                  <TableHead class="text-center w-24">连续签到</TableHead>
                  <TableHead class="text-center w-24">总积分</TableHead>
                  <TableHead class="w-40">最近签到</TableHead>
                  <TableHead class="text-center w-20">认证</TableHead>
                  <TableHead class="text-right w-20">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="paginatedRankingData.length > 0">
                  <TableRow
                    v-for="(row, idx) in paginatedRankingData"
                    :key="row.ouId || idx"
                  >
                    <TableCell class="text-center tabular-nums">
                      <Badge
                        variant="secondary"
                        size="xs"
                        class="font-bold"
                        :class="
                          getAbsoluteRank(idx) === 1
                            ? 'bg-amber-500 text-white'
                            : getAbsoluteRank(idx) <= 3
                              ? 'bg-sky-500 text-white'
                              : ''
                        "
                      >
                        {{ getAbsoluteRank(idx) }}
                      </Badge>
                    </TableCell>

                    <TableCell class="font-semibold">
                      {{ row.name }}
                    </TableCell>

                    <TableCell class="text-center tabular-nums">
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

                    <TableCell class="text-center font-bold text-sky-600 dark:text-sky-400 tabular-nums">
                      {{ row.points }}
                    </TableCell>

                    <TableCell class="text-muted-foreground whitespace-nowrap">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <span class="cursor-help">{{ formatRelativeTime(row.lastCheckInTime) }}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ new Date(row.lastCheckInTime).toLocaleString() }}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>

                    <TableCell class="text-center">
                      <Badge
                        v-if="row.isAuthed"
                        variant="success"
                        size="xs"
                      >
                        已认证
                      </Badge>
                      <span
                        v-else
                        class="text-xs text-muted-foreground"
                      >
                        否
                      </span>
                    </TableCell>

                    <TableCell class="text-right">
                      <Popconfirm
                        :title="`确定重置用户「${row.name}」的签到数据吗？`"
                        @confirm="resetUserCheckInByGuid(row.ouId)"
                      >
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          class="text-destructive hover:bg-destructive/10"
                          :disabled="isResetting"
                        >
                          <Trash2 class="size-3.5" />
                        </Button>
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
            />
          </div>
        </TabsContent>

        <!-- 模拟测试 -->
        <TabsContent
          value="test"
          class="pt-3 space-y-4 max-w-xl"
        >
          <Alert
            size="sm"
            variant="info"
          >
            <AlertDescription class="m-0">
              在此可以向服务端发送一次真实模拟签到请求，验证积分计算与客户端自动回复是否正常。
            </AlertDescription>
          </Alert>

          <div class="border rounded-md p-3.5 bg-card space-y-3">
            <FormField label="模拟用户 UID">
              <BiliUserSelector
                v-model:value="testUid"
                placeholder="请输入或选择 B 站用户"
                @user-info-loaded="
                  (u) => {
                    if (u?.name && (!testUsername || testUsername === '测试用户')) testUsername = u.name
                  }
                "
              />
            </FormField>

            <FormField label="模拟用户名称">
              <Input
                v-model="testUsername"
                placeholder="默认为「测试用户」"
              />
            </FormField>

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
            <Alert :variant="testResult.success ? 'success' : 'warning'">
              <AlertTitle>
                {{ testResult.success ? '模拟签到成功' : '模拟签到失败' }}
              </AlertTitle>
              <AlertDescription class="mt-1">
                {{ testResult.message }}
              </AlertDescription>
            </Alert>
          </div>
        </TabsContent>
      </Tabs>
    </CardContent>

    <div class="p-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center gap-1.5">
      <Info class="size-4 shrink-0 text-muted-foreground" />
      <span>提示：签到回复消息会遵循全局消息队列间隔与弹幕限流保护。</span>
    </div>
  </Card>

  <Card
    v-else
    class="p-12 text-center"
  >
    <Spin size="medium" />
    <span class="text-xs text-muted-foreground block mt-2">正在加载设置...</span>
  </Card>
</template>
