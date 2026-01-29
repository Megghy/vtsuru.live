<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui'
import type { CheckInRankingInfo, CheckInResult, Setting_Point } from '@/api/api-models'

import {
  ArrowClockwise16Filled,
  Delete16Filled,
  Flash24Regular,
  Info24Filled,
  People24Regular,
  Search24Regular,
  Settings24Regular
} from '@vicons/fluent'
import { NAlert, NButton, NCard, NDataTable, NDivider, NForm, NFormItem, NIcon, NInput, NInputGroup, NInputNumber, NPopconfirm, NSelect, NFlex, NSpin, NSwitch, NTabPane, NTabs, NText, NTime, NTooltip, NTag, NGi, NGrid } from 'naive-ui';
import { computed, h, onMounted, ref } from 'vue'
import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { CHECKIN_API_URL } from '@/shared/config'
import AutoActionEditor from '../AutoActionEditor.vue'
import TemplateHelper from '../TemplateHelper.vue'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'

const icons = {
  Search: Search24Regular,
  Flash: Flash24Regular,
  People: People24Regular,
  Settings: Settings24Regular,
  Refresh: ArrowClockwise16Filled,
  Delete: Delete16Filled,
  Info: Info24Filled
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
const checkInPlaceholders = [
  { name: '{{checkin.points}}', description: '获得的总积分' },
  { name: '{{checkin.consecutiveDays}}', description: '连续签到天数' },
  { name: '{{checkin.todayRank}}', description: '今日签到排名' },
  { name: '{{checkin.time}}', description: '签到时间对象' },
]

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
  return (accountInfo.value?.settings?.point ?? defaultPointSetting)
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
    window.$notification.success({
      title: '设置已保存',
      duration: 3000,
    })
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
      window.$notification.error({
        title: '保存失败',
        content: msg,
        duration: 5000,
      })
    }
  } catch (err) {
    window.$notification.error({
      title: '保存失败',
      content: String(err),
      duration: 5000,
    })
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
    filtered = filtered.filter(user =>
      user.name.toLowerCase().includes(keyword),
    )
  }

  return filtered
})

// 排行榜列定义
const rankingColumns: DataTableColumns<CheckInRankingInfo> = [
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
      return h(NTag, { size: 'small', round: true, type, bordered: false }, { default: () => rank })
    },
  },
  {
    title: '用户名',
    key: 'name',
    render: (row) => h(NText, { strong: true }, { default: () => row.name })
  },
  {
    title: '连续签到',
    key: 'consecutiveDays',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.consecutiveDays - b.consecutiveDays,
    render: (row) => h(NText, { type: row.consecutiveDays > 0 ? 'success' : 'default' }, { default: () => `${row.consecutiveDays} 天` })
  },
  {
    title: '总积分',
    key: 'points',
    width: 120,
    align: 'center',
    sorter: (a, b) => a.points - b.points,
    render: (row) => h(NText, { strong: true, type: 'info' }, { default: () => row.points })
  },
  {
    title: '最近签到',
    key: 'lastCheckInTime',
    width: 180,
    render(row: CheckInRankingInfo) {
      return h(NTooltip, {
      }, {
        trigger: () => h(NTime, {
          time: row.lastCheckInTime,
          type: 'relative',
        }),
        default: () => new Date(row.lastCheckInTime).toLocaleString(),
      })
    },
    sorter: (a, b) => a.lastCheckInTime - b.lastCheckInTime,
  },
  {
    title: '认证',
    key: 'isAuthed',
    width: 80,
    align: 'center',
    render(row: CheckInRankingInfo) {
      return row.isAuthed ? h(NTag, { size: 'tiny', type: 'success', bordered: false }, { default: () => '已认证' }) : h(NText, { depth: 3 }, { default: () => '否' })
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    align: 'center',
    render(row: CheckInRankingInfo) {
      return h(
        NPopconfirm,
        {
          onPositiveClick: () => resetUserCheckInByGuid(row.ouId),
        },
        {
          trigger: () => h(
            NButton,
            {
              size: 'tiny',
              type: 'error',
              quaternary: true,
              disabled: isResetting.value,
              loading: isResetting.value && resetTargetId.value === row.ouId,
              onClick: e => e.stopPropagation(),
            },
            { icon: () => h(NIcon, { component: icons.Delete }) },
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
      window.$message.error(`获取签到排行榜失败: ${response.message}`)
    }
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    window.$notification.error({
      title: '加载失败',
      content: '无法加载签到排行榜数据',
      duration: 5000,
    })
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
      window.$notification.success({
        title: '重置成功',
        content: '用户签到数据已重置',
        duration: 3000,
      })

      // 重置成功后重新加载排行榜
      await loadCheckInRanking()
    } else {
      window.$notification.error({
        title: '重置失败',
        content: response?.message || '无法重置用户签到数据',
        duration: 5000,
      })
    }
  } catch (error) {
    console.error('重置用户签到数据失败:', error)
    window.$notification.error({
      title: '重置失败',
      content: '重置用户签到数据时发生错误',
      duration: 5000,
    })
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
      window.$notification.success({
        title: '重置成功',
        content: '所有用户的签到数据已重置',
        duration: 3000,
      })

      // 重置成功后重新加载排行榜
      await loadCheckInRanking()
    } else {
      window.$notification.error({
        title: '重置失败',
        content: response?.message || '无法重置所有用户签到数据',
        duration: 5000,
      })
    }
  } catch (error) {
    console.error('重置所有用户签到数据失败:', error)
    window.$notification.error({
      title: '重置失败',
      content: '重置所有用户签到数据时发生错误',
      duration: 5000,
    })
  } finally {
    isResetting.value = false
  }
}

// 测试签到功能
const testUid = ref<number>()
const testUsername = ref<string>('测试用户')
const testResult = ref<{ success: boolean, message: string }>()

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
      window.$notification[result.success ? 'success' : 'info']({
        title: result.success ? '测试签到成功' : '测试签到失败',
        content: testResult.value.message,
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
    window.$notification.error({
      title: '测试签到失败',
      content: testResult.value.message,
      duration: 5000,
    })
  }
}
function updateCheckInRanking(value: boolean) {
  accountInfo.value.settings.enableFunctions = value ? [...accountInfo.value.settings.enableFunctions, FunctionTypes.CheckInRanking] : accountInfo.value.settings.enableFunctions.filter(f => f !== FunctionTypes.CheckInRanking)
  SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
}

// 组件挂载时加载排行榜
onMounted(() => {
  loadCheckInRanking()
})
</script>

<template>
  <NCard
    v-if="config"
    title="弹幕签到设置"
    size="small"
    bordered
    :segmented="{ content: true }"
    class="checkin-settings-card"
  >
    <NScrollbar class="checkin-scrollbar">
      <NTabs type="segment" animated>
        <NTabPane name="settings" tab="功能设置">
          <template #tab>
            <NFlex align="center" :size="4">
              <NIcon :component="icons.Settings" />
              <span>功能设置</span>
            </NFlex>
          </template>
          
          <NSpin :show="isLoading">
            <NFlex vertical :size="16" style="padding-top: 16px;">
              <NAlert v-if="!canEdit" type="warning" size="small" :bordered="false">
                加载中或无法编辑设置，请稍后再试
              </NAlert>

              <NGrid cols="1 m:2" :x-gap="16" :y-gap="16" responsive="screen">
                <!-- 基本开关 -->
                <NGi span="1 m:2">
                  <NCard title="基础设置" size="small" embedded bordered>
                    <NForm label-placement="left" :label-width="120" size="small" :show-feedback="false">
                      <NFormItem label="启用签到功能">
                        <NSwitch v-model:value="serverSetting.enableCheckIn" @update:value="updateServerSettings" />
                        <template #feedback>
                          观众发送签到命令可获得积分
                        </template>
                      </NFormItem>
                      
                      <transition name="fade">
                        <div v-if="serverSetting.enableCheckIn" style="margin-top: 12px;">
                          <NFormItem label="签到命令" required>
                            <NInputGroup>
                              <NInput
                                :value="serverSetting.checkInKeyword"
                                placeholder="例如：签到"
                                @update:value="(v: string) => serverSetting.checkInKeyword = v"
                              />
                              <NButton type="primary" @click="updateServerSettings">
                                保存
                              </NButton>
                            </NInputGroup>
                          </NFormItem>
                          
                          <NFlex :size="12" style="margin-top: 12px;">
                            <NFormItem label="要求已认证" style="flex: 1">
                              <NSwitch v-model:value="serverSetting.requireAuth" @update:value="updateServerSettings" />
                            </NFormItem>
                            <NFormItem label="允许自己签到" style="flex: 1">
                              <NSwitch v-model:value="serverSetting.allowSelfCheckIn" @update:value="updateServerSettings" />
                            </NFormItem>
                          </NFlex>
                          
                          <NFormItem label="允许查看排行" style="margin-top: 12px;">
                            <NSwitch
                              :value="accountInfo.settings.enableFunctions.includes(FunctionTypes.CheckInRanking)"
                              @update:value="updateCheckInRanking"
                            />
                          </NFormItem>
                        </div>
                      </transition>
                    </NForm>
                  </NCard>
                </NGi>

                <!-- 积分奖励 -->
                <NGi span="1 m:2">
                  <transition name="fade">
                    <NCard v-if="serverSetting.enableCheckIn" title="积分奖励配置" size="small" embedded bordered>
                      <NForm label-placement="left" :label-width="120" size="small" :show-feedback="false">
                        <NFormItem label="启用积分奖励">
                          <NSwitch v-model:value="serverSetting.givePointsForCheckIn" @update:value="updateServerSettings" />
                        </NFormItem>
                        
                        <transition name="fade">
                          <NFlex v-if="serverSetting.givePointsForCheckIn" vertical :size="12" style="margin-top: 12px;">
                            <NFormItem label="基础签到积分">
                              <NInputNumber v-model:value="serverSetting.baseCheckInPoints" :min="0" style="width: 100%" @update:value="updateServerSettings" />
                            </NFormItem>
                            
                            <NDivider style="margin: 4px 0;" />
                            
                            <NFormItem label="连续签到奖励">
                              <NSwitch v-model:value="serverSetting.enableConsecutiveBonus" @update:value="updateServerSettings" />
                            </NFormItem>
                            
                            <transition name="fade">
                              <NFlex v-if="serverSetting.enableConsecutiveBonus" vertical :size="8">
                                <NFormItem label="每日额外奖励">
                                  <NInputNumber v-model:value="serverSetting.bonusPointsPerDay" :min="0" style="width: 100%" @update:value="updateServerSettings" />
                                </NFormItem>
                                <NFormItem label="奖励积分上限">
                                  <NInputNumber v-model:value="serverSetting.maxBonusPoints" :min="0" style="width: 100%" @update:value="updateServerSettings" />
                                </NFormItem>
                              </NFlex>
                            </transition>
                          </NFlex>
                        </transition>
                      </NForm>
                    </NCard>
                  </transition>
                </NGi>

                <!-- 回复消息 -->
                <NGi span="1 m:2">
                  <transition name="fade">
                    <NCard v-if="serverSetting.enableCheckIn" title="自动回复消息" size="small" embedded bordered>
                      <NFlex vertical :size="12">
                        <NForm label-placement="left" :label-width="120" size="small" :show-feedback="false">
                          <NFormItem label="发送签到回复">
                            <NSwitch v-model:value="config.sendReply" />
                          </NFormItem>
                        </NForm>
                        
                        <transition name="fade">
                          <NFlex v-if="config.sendReply" vertical :size="16" style="margin-top: 8px;">
                            <TemplateHelper :placeholders="checkInPlaceholders" />
                            
                            <div class="reply-editor-section">
                              <NText strong class="section-label">
                                签到成功回复
                              </NText>
                              <AutoActionEditor
                                :action="config.successAction"
                                :hide-name="true"
                                :hide-enabled="true"
                                :custom-test-context="customTestContext"
                              />
                            </div>

                            <div class="reply-editor-section">
                              <NText strong class="section-label">
                                重复签到回复
                              </NText>
                              <AutoActionEditor
                                :action="config.cooldownAction"
                                :hide-name="true"
                                :hide-enabled="true"
                                :custom-test-context="customTestContext"
                              />
                            </div>
                          </NFlex>
                        </transition>
                      </NFlex>
                    </NCard>
                  </transition>
                </NGi>
              </NGrid>

              <NFlex justify="center" style="margin-top: 8px; padding-bottom: 32px;">
                <NButton type="primary" size="large" :disabled="!canEdit" :loading="isLoading" style="width: 200px;" @click="updateSettings">
                  保存所有更改
                </NButton>
              </NFlex>
            </NFlex>
          </NSpin>
        </NTabPane>

        <NTabPane name="ranking" tab="签到排行榜">
          <template #tab>
            <NFlex align="center" :size="4">
              <NIcon :component="icons.People" />
              <span>签到排行榜</span>
            </NFlex>
          </template>
          
          <NFlex vertical :size="16" style="padding-top: 16px;">
            <NAlert type="info" size="small" :bordered="false">
              显示用户签到排行榜。选择时间段可查看不同期间的签到数据。
            </NAlert>

            <NFlex justify="space-between" align="center" class="ranking-toolbar">
              <NFlex align="center" :size="12">
                <NSelect v-model:value="timeRange" :options="timeRangeOptions" style="width: 140px" size="small" @update:value="loadCheckInRanking" />
                <NInput v-model:value="userFilter" placeholder="搜索用户名..." size="small" clearable style="width: 180px">
                  <template #prefix>
                    <NIcon :component="icons.Search" />
                  </template>
                </NInput>
              </NFlex>
              
              <NFlex :size="8">
                <NButton size="small" secondary :loading="isLoadingRanking" @click="loadCheckInRanking">
                  <template #icon>
                    <NIcon :component="icons.Refresh" />
                  </template>
                  刷新
                </NButton>
                <NPopconfirm @positive-click="resetAllCheckIn">
                  <template #trigger>
                    <NButton size="small" type="error" quaternary>
                      重置全部
                    </NButton>
                  </template>
                  警告：此操作将清空所有用户的签到记录，确定要继续吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>

            <NDataTable
              :columns="rankingColumns"
              :data="filteredRankingData"
              :pagination="{
                pageSize: 10,
                showSizePicker: true,
                pageSizes: [10, 20, 50, 100],
              }"
              :bordered="false"
              :loading="isLoadingRanking"
              size="small"
              striped
            />
          </NFlex>
        </NTabPane>

        <NTabPane name="test" tab="模拟测试">
          <template #tab>
            <NFlex align="center" :size="4">
              <NIcon :component="icons.Flash" />
              <span>模拟测试</span>
            </NFlex>
          </template>
          
          <NFlex vertical :size="16" style="padding-top: 16px; max-width: 600px;">
            <NAlert type="info" size="small" :bordered="false">
              在此可以模拟用户发送签到命令，验证逻辑和回复消息是否正确。
            </NAlert>

            <NCard size="small" embedded bordered>
              <NForm label-placement="top" size="small">
                <NFormItem label="模拟用户 UID">
                  <BiliUserSelector
                    v-model:value="testUid"
                    placeholder="请输入或选择B站用户"
                    @user-info-loaded="(u) => { if (u?.name && (!testUsername || testUsername === '测试用户')) testUsername = u.name }"
                  />
                </NFormItem>
                <NFormItem label="模拟用户名称">
                  <NInput v-model:value="testUsername" placeholder="默认为'测试用户'" />
                </NFormItem>
                <NFlex justify="end">
                  <NButton type="primary" :disabled="!testUid || !serverSetting.enableCheckIn" @click="handleTestCheckIn">
                    开始模拟签到
                  </NButton>
                </NFlex>
              </NForm>
            </NCard>

            <transition name="fade">
              <div v-if="testResult">
                <NDivider title-placement="left">
                  测试结果
                </NDivider>
                <NAlert :type="testResult.success ? 'success' : 'warning'" :title="testResult.success ? '模拟签到成功' : '模拟签到失败'" :bordered="false">
                  {{ testResult.message }}
                </NAlert>
              </div>
            </transition>
          </NFlex>
        </NTabPane>
      </NTabs>
    </NScrollbar>

    <template #footer>
      <div class="checkin-footer">
        <NIcon :component="icons.Info" size="14" />
        <span>提示：签到回复消息会遵循全局弹幕设置（频率限制、长度等）。</span>
      </div>
    </template>
  </NCard>
  
  <NCard v-else size="small" bordered embedded>
    <NFlex justify="center" align="center" style="padding: 40px;">
      <NSpin size="large" description="正在加载设置..." />
    </NFlex>
  </NCard>
</template>

<style scoped>
.check-in-settings-container {
  height: 100%;
}

.reply-editor-section {
  background-color: var(--n-color-modal);
  padding: 12px;
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-divider-color);
}

.section-label {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
}

.ranking-toolbar {
  background-color: var(--n-action-color);
  padding: 8px 12px;
  border-radius: var(--n-border-radius);
}

.checkin-footer {
  margin-top: 24px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color-3);
  font-size: 12px;
}

/* Transitions */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
