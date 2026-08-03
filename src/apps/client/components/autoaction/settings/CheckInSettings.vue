<script lang="ts" setup>
const Search24Regular = 'i-lucide-circle'
const Flash24Regular = 'i-lucide-circle'
const People24Regular = 'i-lucide-circle'
const Settings24Regular = 'i-lucide-circle'
const ArrowClockwise16Filled = 'i-lucide-circle'
const Delete16Filled = 'i-lucide-circle'
const Info24Filled = 'i-lucide-circle'
import { computed, h, onMounted, ref, resolveComponent } from 'vue'

import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import type { CheckInRankingInfo, CheckInResult, Setting_Point } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { CHECKIN_API_URL } from '@/shared/config'

import AutoActionEditor from '../AutoActionEditor.vue'
import { CHECKIN_PLACEHOLDERS } from '../placeholders'
import TemplateHelper from '../TemplateHelper.vue'

const icons = {
  Search: Search24Regular,
  Flash: Flash24Regular,
  People: People24Regular,
  Settings: Settings24Regular,
  Refresh: ArrowClockwise16Filled,
  Delete: Delete16Filled,
  Info: Info24Filled,
}

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

// 签到模板的特定占位符
const checkInPlaceholders = CHECKIN_PLACEHOLDERS

// 服务端签到设置（提供强类型默认值，避免模板中访问属性时报错）
const defaultPointSetting: Setting_Point = {
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
const serverSetting = computed<Setting_Point>(() => {
  return accountInfo.value?.settings?.point ?? defaultPointSetting
})

// 是否可以编辑设置
const canEdit = computed(() => {
  return accountInfo.value && accountInfo.value.settings && accountInfo.value.settings.point
})

// 更新所有设置
async function updateSettings() {
  // 先保存服务端设置
  const serverSaved = await updateServerSettings()

  if (serverSaved) {
    useToast().add({ color: 'success', title: '设置已保存', duration: 3000 })
  }

  return serverSaved
}

// 更新服务端签到设置
async function updateServerSettings() {
  if (!canEdit.value) {
    return false
  }

  isLoading.value = true

  try {
    const msg = await SaveSetting('Point', accountInfo.value.settings.point)
    if (msg) {
      return true
    } else {
      useToast().add({ color: 'error', title: '保存失败', description: msg, duration: 5000 })
    }
  } catch (err) {
    useToast().add({ color: 'error', title: '保存失败', description: String(err), duration: 5000 })
    console.error('保存签到设置失败:', err)
  } finally {
    isLoading.value = false
  }

  return false
}

// 排行榜数据
const rankingData = ref<CheckInRankingInfo[]>([])
const isLoadingRanking = ref(false)
const timeRange = ref<string>('all')
const userFilter = ref<string>('')
const pagination = ref({
  page: 1,
  pageSize: 10,
})

// 时间段选项
const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '上个月', value: 'lastMonth' },
]

// 过滤后的排行榜数据
const filteredRankingData = computed(() => {
  let filtered = rankingData.value

  // 按时间范围筛选
  if (timeRange.value !== 'all') {
    const now = new Date()
    let startTime: Date

    if (timeRange.value === 'today') {
      // 今天凌晨
      startTime = new Date(now)
      startTime.setHours(0, 0, 0, 0)
    } else if (timeRange.value === 'week') {
      // 本周一
      const dayOfWeek = now.getDay() || 7 // 把周日作为7处理
      startTime = new Date(now)
      startTime.setDate(now.getDate() - (dayOfWeek - 1))
      startTime.setHours(0, 0, 0, 0)
    } else if (timeRange.value === 'month') {
      // 本月1号
      startTime = new Date(now.getFullYear(), now.getMonth(), 1)
    } else if (timeRange.value === 'lastMonth') {
      // 上月1号
      startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      // 本月1号作为结束时间
      const endTime = new Date(now.getFullYear(), now.getMonth(), 1)
      filtered = filtered.filter((user) => {
        const checkInTime = new Date(user.lastCheckInTime)
        return checkInTime >= startTime && checkInTime < endTime
      })
      // 已经筛选完成，不需要再次筛选
      startTime = new Date(0)
    }

    // 如果不是上个月，用通用筛选逻辑
    if (timeRange.value !== 'lastMonth') {
      filtered = filtered.filter((user) => {
        const checkInTime = new Date(user.lastCheckInTime)
        return checkInTime >= startTime
      })
    }
  }

  // 按用户名筛选
  if (userFilter.value) {
    const keyword = userFilter.value.toLowerCase()
    filtered = filtered.filter((user) => user.name.toLowerCase().includes(keyword))
  }

  return filtered
})

// 排行榜列定义
const rankingColumns: any[] = [
  {
    title: '排名',
    key: 'rank',
    width: 80,
    align: 'center',
    render: (_, index: number) => {
      const rank = index + 1
      let type: 'default' | 'primary' | 'info' = 'default'
      if (rank === 1) type = 'primary'
      else if (rank <= 3) type = 'info'
      return h(
        resolveComponent('UBadge'),
        { size: 'small', round: true, type, bordered: false },
        { default: () => rank },
      )
    },
  },
  {
    title: '用户名',
    key: 'name',
    render: (row) => h('span', { strong: true }, { default: () => row.name }),
  },
  {
    title: '连续签到',
    key: 'consecutiveDays',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.consecutiveDays - b.consecutiveDays,
    render: (row) =>
      h(
        'span',
        { type: row.consecutiveDays > 0 ? 'success' : 'default' },
        { default: () => `${row.consecutiveDays} 天` },
      ),
  },
  {
    title: '总积分',
    key: 'points',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.points - b.points,
    render: (row) => h('span', { strong: true, type: 'info' }, { default: () => row.points }),
  },
  {
    title: '最近签到',
    key: 'lastCheckInTime',
    width: 180,
    render(row: CheckInRankingInfo) {
      return h(
        resolveComponent('UTooltip'),
        {},
        {
          trigger: () =>
            h('time', {
              time: row.lastCheckInTime,
              type: 'relative',
            }),
          default: () => new Date(row.lastCheckInTime).toLocaleString(),
        },
      )
    },
    sorter: (a, b) => a.lastCheckInTime - b.lastCheckInTime,
  },
  {
    title: '认证',
    key: 'isAuthed',
    width: 80,
    align: 'center',
    render(row: CheckInRankingInfo) {
      return row.isAuthed
        ? h(resolveComponent('UBadge'), { size: 'tiny', type: 'success', bordered: false }, { default: () => '已认证' })
        : h('span', { depth: 3 }, { default: () => '否' })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    align: 'center',
    render(row: CheckInRankingInfo) {
      return h(
        resolveComponent('UPopover'),
        {
          onPositiveClick: () => resetUserCheckInByGuid(row.ouId),
        },
        {
          trigger: () =>
            h(
              resolveComponent('UButton'),
              {
                size: 'tiny',
                type: 'error',
                quaternary: true,
                disabled: isResetting.value,
                loading: isResetting.value && resetTargetId.value === row.ouId,
                onClick: (e) => e.stopPropagation(),
              },
              { icon: () => h(resolveComponent('UIcon'), { component: icons.Delete }) },
            ),
          default: () => `确定要重置用户 "${row.name}" 的签到数据吗？`,
        },
      )
    },
  },
]

// 加载签到排行榜数据
async function loadCheckInRanking() {
  if (isLoadingRanking.value) return

  isLoadingRanking.value = true
  try {
    const response = await QueryGetAPI<CheckInRankingInfo[]>(`${CHECKIN_API_URL}admin/users`)

    if (response.code == 200) {
      rankingData.value = response.data
      pagination.value.page = 1 // 重置为第一页
    } else {
      rankingData.value = []
      useToast().add({ title: `获取签到排行榜失败: ${response.message}`, color: 'error' })
    }
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    useToast().add({ color: 'error', title: '加载失败', description: '无法加载签到排行榜数据', duration: 5000 })
    rankingData.value = []
  } finally {
    isLoadingRanking.value = false
  }
}

// 重置签到数据相关
const isResetting = ref(false)
const resetTargetId = ref<string>()

// 重置单个用户签到数据
async function resetUserCheckInByGuid(ouId: string) {
  if (!ouId || isResetting.value) return

  isResetting.value = true
  resetTargetId.value = ouId

  try {
    const response = await QueryGetAPI(`${CHECKIN_API_URL}admin/reset`, {
      ouId,
    })

    if (response && response.code === 200) {
      useToast().add({ color: 'success', title: '重置成功', description: '用户签到数据已重置', duration: 3000 })

      // 重置成功后重新加载排行榜
      await loadCheckInRanking()
    } else {
      useToast().add({
        color: 'error',
        title: '重置失败',
        description: response?.message || '无法重置用户签到数据',
        duration: 5000,
      })
    }
  } catch (error) {
    console.error('重置用户签到数据失败:', error)
    useToast().add({ color: 'error', title: '重置失败', description: '重置用户签到数据时发生错误', duration: 5000 })
  } finally {
    isResetting.value = false
    resetTargetId.value = undefined
  }
}

// 重置所有用户签到数据
async function resetAllCheckIn() {
  if (isResetting.value) return

  isResetting.value = true
  try {
    const response = await QueryGetAPI(`${CHECKIN_API_URL}admin/reset`, {})

    if (response && response.code === 200) {
      useToast().add({ color: 'success', title: '重置成功', description: '所有用户的签到数据已重置', duration: 3000 })

      // 重置成功后重新加载排行榜
      await loadCheckInRanking()
    } else {
      useToast().add({
        color: 'error',
        title: '重置失败',
        description: response?.message || '无法重置所有用户签到数据',
        duration: 5000,
      })
    }
  } catch (error) {
    console.error('重置所有用户签到数据失败:', error)
    useToast().add({ color: 'error', title: '重置失败', description: '重置所有用户签到数据时发生错误', duration: 5000 })
  } finally {
    isResetting.value = false
  }
}

// 测试签到功能
const testUid = ref<number>()
const testUsername = ref<string>('测试用户')
const testResult = ref<{ success: boolean; message: string }>()

// 处理测试签到
async function handleTestCheckIn() {
  if (!testUid.value || !serverSetting.value.enableCheckIn) {
    testResult.value = {
      success: false,
      message: '请输入有效的UID或确保签到功能已启用',
    }
    return
  }

  try {
    // 直接调用服务端签到API
    const response = await QueryGetAPI<CheckInResult>(`${CHECKIN_API_URL}check-in-for`, {
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

      // 显示通知
      useToast().add({
        color: result.success ? 'success' : 'info',
        title: result.success ? '测试签到成功' : '测试签到失败',
        description: testResult.value.message,
        duration: 3000,
      })
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

    // 显示错误通知
    useToast().add({ color: 'error', title: '测试签到失败', description: testResult.value.message, duration: 5000 })
  }
}
function updateCheckInRanking(value: boolean) {
  accountInfo.value.settings.enableFunctions = value
    ? [...accountInfo.value.settings.enableFunctions, FunctionTypes.CheckInRanking]
    : accountInfo.value.settings.enableFunctions.filter((f) => f !== FunctionTypes.CheckInRanking)
  SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
}

// 组件挂载时加载排行榜
onMounted(() => {
  loadCheckInRanking()
})
</script>

<template>
  <UCard
    v-if="config"
    title="弹幕签到设置"
    size="small"
    bordered
    :segmented="{ content: true }"
    class="checkin-settings-card"
  >
    <div class="checkin-scrollbar">
      <div
        type="segment"
        animated
      >
        <section
          name="settings"
          tab="功能设置"
        >
          <div class="checkin-tab-label">
            <div
              align="center"
              :size="4"
            >
              <UIcon name="i-lucide-circle" />
              <span>功能设置</span>
            </div>
          </div>

          <div :show="isLoading">
            <div
              vertical
              :size="16"
              style="padding-top: 16px"
            >
              <UAlert
                v-if="!canEdit"
                type="warning"
                size="small"
                :bordered="false"
              >
                加载中或无法编辑设置，请稍后再试
              </UAlert>

              <div
                cols="1 m:2"
                :x-gap="16"
                :y-gap="16"
                responsive="screen"
              >
                <!-- 基本开关 -->
                <div span="1 m:2">
                  <UCard
                    title="基础设置"
                    size="small"
                    embedded
                    bordered
                  >
                    <UForm
                      label-placement="left"
                      :label-width="120"
                      size="small"
                      :show-feedback="false"
                    >
                      <UFormField label="启用签到功能">
                        <USwitch
                          v-model="serverSetting.enableCheckIn"
                          @update:model-value="updateServerSettings"
                        />
                        <template #feedback> 观众发送签到命令可获得积分 </template>
                      </UFormField>

                      <transition name="fade">
                        <div
                          v-if="serverSetting.enableCheckIn"
                          style="margin-top: 12px"
                        >
                          <UFormField
                            label="签到命令"
                            required
                          >
                            <div>
                              <UInput
                                :value="serverSetting.checkInKeyword"
                                placeholder="例如：签到"
                                @update:value="(v: string) => (serverSetting.checkInKeyword = v)"
                              />
                              <UButton
                                color="primary"
                                @click="updateServerSettings"
                              >
                                保存
                              </UButton>
                            </div>
                          </UFormField>

                          <div
                            :size="12"
                            style="margin-top: 12px"
                          >
                            <UFormField
                              label="要求已认证"
                              style="flex: 1"
                            >
                              <USwitch
                                v-model="serverSetting.requireAuth"
                                @update:model-value="updateServerSettings"
                              />
                            </UFormField>
                            <UFormField
                              label="允许自己签到"
                              style="flex: 1"
                            >
                              <USwitch
                                v-model="serverSetting.allowSelfCheckIn"
                                @update:model-value="updateServerSettings"
                              />
                            </UFormField>
                          </div>

                          <UFormField
                            label="允许查看排行"
                            style="margin-top: 12px"
                          >
                            <USwitch
                              :model-value="accountInfo.settings.enableFunctions.includes(FunctionTypes.CheckInRanking)"
                              @update:model-value="updateCheckInRanking"
                            />
                          </UFormField>
                        </div>
                      </transition>
                    </UForm>
                  </UCard>
                </div>

                <!-- 积分奖励 -->
                <div span="1 m:2">
                  <transition name="fade">
                    <UCard
                      v-if="serverSetting.enableCheckIn"
                      title="积分奖励配置"
                      size="small"
                      embedded
                      bordered
                    >
                      <UForm
                        label-placement="left"
                        :label-width="120"
                        size="small"
                        :show-feedback="false"
                      >
                        <UFormField label="启用积分奖励">
                          <USwitch
                            v-model="serverSetting.givePointsForCheckIn"
                            @update:model-value="updateServerSettings"
                          />
                        </UFormField>

                        <transition name="fade">
                          <div
                            v-if="serverSetting.givePointsForCheckIn"
                            vertical
                            :size="12"
                            style="margin-top: 12px"
                          >
                            <UFormField label="基础签到积分">
                              <UInputNumber
                                v-model="serverSetting.baseCheckInPoints"
                                :min="0"
                                style="width: 100%"
                                @update:value="updateServerSettings"
                              />
                            </UFormField>

                            <USeparator style="margin: 4px 0" />

                            <UFormField label="连续签到奖励">
                              <USwitch
                                v-model="serverSetting.enableConsecutiveBonus"
                                @update:model-value="updateServerSettings"
                              />
                            </UFormField>

                            <transition name="fade">
                              <div
                                v-if="serverSetting.enableConsecutiveBonus"
                                vertical
                                :size="8"
                              >
                                <UFormField label="每日额外奖励">
                                  <UInputNumber
                                    v-model="serverSetting.bonusPointsPerDay"
                                    :min="0"
                                    style="width: 100%"
                                    @update:value="updateServerSettings"
                                  />
                                </UFormField>
                                <UFormField label="奖励积分上限">
                                  <UInputNumber
                                    v-model="serverSetting.maxBonusPoints"
                                    :min="0"
                                    style="width: 100%"
                                    @update:value="updateServerSettings"
                                  />
                                </UFormField>
                              </div>
                            </transition>
                          </div>
                        </transition>
                      </UForm>
                    </UCard>
                  </transition>
                </div>

                <!-- 回复消息 -->
                <div span="1 m:2">
                  <transition name="fade">
                    <UCard
                      v-if="serverSetting.enableCheckIn"
                      title="自动回复消息"
                      size="small"
                      embedded
                      bordered
                    >
                      <div
                        vertical
                        :size="12"
                      >
                        <UForm
                          label-placement="left"
                          :label-width="120"
                          size="small"
                          :show-feedback="false"
                        >
                          <UFormField label="发送签到回复">
                            <USwitch v-model="config.sendReply" />
                          </UFormField>
                        </UForm>

                        <transition name="fade">
                          <div
                            v-if="config.sendReply"
                            vertical
                            :size="16"
                            style="margin-top: 8px"
                          >
                            <TemplateHelper :placeholders="checkInPlaceholders" />

                            <div class="reply-editor-section">
                              <span
                                strong
                                class="section-label"
                              >
                                签到成功回复
                              </span>
                              <AutoActionEditor
                                :action="config.successAction"
                                :hide-name="true"
                                :hide-enabled="true"
                                :hide-user-filter="true"
                                :custom-test-context="customTestContext"
                              />
                            </div>

                            <div class="reply-editor-section">
                              <span
                                strong
                                class="section-label"
                              >
                                重复签到回复
                              </span>
                              <AutoActionEditor
                                :action="config.cooldownAction"
                                :hide-name="true"
                                :hide-enabled="true"
                                :hide-user-filter="true"
                                :custom-test-context="customTestContext"
                              />
                            </div>
                          </div>
                        </transition>
                      </div>
                    </UCard>
                  </transition>
                </div>
              </div>

              <div
                justify="center"
                style="margin-top: 8px; padding-bottom: 32px"
              >
                <UButton
                  color="primary"
                  size="large"
                  :disabled="!canEdit"
                  :loading="isLoading"
                  style="width: 200px"
                  @click="updateSettings"
                >
                  保存所有更改
                </UButton>
              </div>
            </div>
          </div>
        </section>

        <section
          name="ranking"
          tab="签到排行榜"
        >
          <div class="checkin-tab-label">
            <div
              align="center"
              :size="4"
            >
              <UIcon name="i-lucide-circle" />
              <span>签到排行榜</span>
            </div>
          </div>

          <div
            vertical
            :size="16"
            style="padding-top: 16px"
          >
            <UAlert
              type="info"
              size="small"
              :bordered="false"
            >
              显示用户签到排行榜。选择时间段可查看不同期间的签到数据。
            </UAlert>

            <div
              justify="space-between"
              align="center"
              class="ranking-toolbar"
            >
              <div
                align="center"
                :size="12"
              >
                <USelectMenu
                  v-model="timeRange"
                  :items="timeRangeOptions"
                  style="width: 140px"
                  size="small"
                  @update:value="loadCheckInRanking"
                  value-key="value"
                />
                <UInput
                  v-model="userFilter"
                  placeholder="搜索用户名..."
                  size="small"
                  clearable
                  style="width: 180px"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                </UInput>
              </div>

              <div :size="8">
                <UButton
                  size="small"
                  variant="soft"
                  :loading="isLoadingRanking"
                  @click="loadCheckInRanking"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  刷新
                </UButton>
                <UPopover>
                  <UButton
                    size="sm"
                    color="error"
                    variant="ghost"
                  >
                    重置全部
                  </UButton>
                  <template #content="{ close }">
                    <div class="space-y-3 p-3">
                      <div>警告：此操作将清空所有用户的签到记录，确定要继续吗？</div>
                      <div class="flex justify-end gap-2">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          @click="close"
                          >取消</UButton
                        >
                        <UButton
                          size="xs"
                          color="error"
                          @click="(close(), resetAllCheckIn)"
                          >确认</UButton
                        >
                      </div>
                    </div>
                  </template>
                </UPopover>
              </div>
            </div>

            <UTable
              :columns="rankingColumns"
              :data="filteredRankingData"
              :pagination="{
                pageIndex: 1,
                pageSize: 10,
              }"
              :bordered="false"
              :loading="isLoadingRanking"
              size="small"
              striped
            />
          </div>
        </section>

        <section
          name="test"
          tab="模拟测试"
        >
          <div class="checkin-tab-label">
            <div
              align="center"
              :size="4"
            >
              <UIcon name="i-lucide-circle" />
              <span>模拟测试</span>
            </div>
          </div>

          <div
            vertical
            :size="16"
            style="padding-top: 16px; max-width: 600px"
          >
            <UAlert
              type="info"
              size="small"
              :bordered="false"
            >
              在此可以模拟用户发送签到命令，验证逻辑和回复消息是否正确。
            </UAlert>

            <UCard
              size="small"
              embedded
              bordered
            >
              <UForm
                label-placement="top"
                size="small"
              >
                <UFormField label="模拟用户 UID">
                  <BiliUserSelector
                    v-model="testUid"
                    placeholder="请输入或选择B站用户"
                    @user-info-loaded="
                      (u) => {
                        if (u?.name && (!testUsername || testUsername === '测试用户')) testUsername = u.name
                      }
                    "
                  />
                </UFormField>
                <UFormField label="模拟用户名称">
                  <UInput
                    v-model="testUsername"
                    placeholder="默认为'测试用户'"
                  />
                </UFormField>
                <div justify="end">
                  <UButton
                    color="primary"
                    :disabled="!testUid || !serverSetting.enableCheckIn"
                    @click="handleTestCheckIn"
                  >
                    开始模拟签到
                  </UButton>
                </div>
              </UForm>
            </UCard>

            <transition name="fade">
              <div v-if="testResult">
                <USeparator title-placement="left"> 测试结果 </USeparator>
                <UAlert
                  :type="testResult.success ? 'success' : 'warning'"
                  :title="testResult.success ? '模拟签到成功' : '模拟签到失败'"
                  :bordered="false"
                >
                  {{ testResult.message }}
                </UAlert>
              </div>
            </transition>
          </div>
        </section>
      </div>
    </div>

    <template #footer>
      <div class="checkin-footer">
        <UIcon
          name="i-lucide-circle"
          size="14"
        />
        <span>提示：签到回复消息会遵循全局弹幕设置（频率限制、长度等）。</span>
      </div>
    </template>
  </UCard>

  <UCard
    v-else
    size="small"
    bordered
    embedded
  >
    <div
      justify="center"
      align="center"
      style="padding: 40px"
    >
      <div
        size="large"
        description="正在加载设置..."
      />
    </div>
  </UCard>
</template>

<style scoped>
.check-in-settings-container {
  height: 100%;
}

.reply-editor-section {
  background-color: var(--vtsuru-bg-elevated);
  padding: 12px;
  border-radius: var(--vtsuru-radius);
  border: 1px solid var(--vtsuru-border);
}

.section-label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
}

.ranking-toolbar {
  background-color: var(--vtsuru-bg-muted);
  padding: 8px 12px;
  border-radius: var(--vtsuru-radius);
}

.checkin-footer {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
