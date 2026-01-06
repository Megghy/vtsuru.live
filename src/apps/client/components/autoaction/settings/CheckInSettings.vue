<script lang="ts" setup>
import type { DataTableColumns } from 'naive-ui'
import type { CheckInRankingInfo, CheckInResult, Setting_Point } from '@/api/api-models'

import { Info24Filled } from '@vicons/fluent'
import { NAlert, NButton, NCard, NDataTable, NDivider, NForm, NFormItem, NIcon, NInput, NInputGroup, NInputNumber, NPopconfirm, NSelect, NSpace, NSpin, NSwitch, NTabPane, NTabs, NText, NTime, NTooltip } from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { CHECKIN_API_URL } from '@/shared/config'
import AutoActionEditor from '../AutoActionEditor.vue'
import TemplateHelper from '../TemplateHelper.vue'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'

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
    render: (row: CheckInRankingInfo, index: number) => h('span', {}, index + 1),
  },
  {
    title: '用户名',
    key: 'name',
  },
  {
    title: '连续签到天数',
    key: 'consecutiveDays',
    sorter: true,
  },
  {
    title: '积分',
    key: 'points',
    sorter: true,
  },
  {
    title: '最近签到时间',
    key: 'lastCheckInTime',
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
    sorter: true,
  },
  {
    title: '已认证',
    key: 'isAuthed',
    render(row: CheckInRankingInfo) {
      return h('span', {}, row.isAuthed ? '是' : '否')
    },
  },
  {
    title: '操作',
    key: 'actions',
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
              size: 'small',
              type: 'warning',
              disabled: isResetting.value,
              loading: isResetting.value && resetTargetId.value === row.ouId,
              onClick: e => e.stopPropagation(),
            },
            { default: () => '重置签到' },
          ),
          default: () => '确定要重置该用户的所有签到数据吗？此操作不可撤销。',
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
    // 获取所有用户数据，不再根据时间范围过滤
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
  >
    <NTabs
      type="line"
      animated
    >
      <NTabPane
        name="settings"
        tab="签到设置"
      >
        <NSpin :show="isLoading">
          <NAlert
            v-if="!canEdit"
            type="warning"
          >
            加载中或无法编辑设置，请稍后再试
          </NAlert>

          <NForm
            label-placement="left"
            :label-width="120"
            :style="{
              maxWidth: '650px',
            }"
          >
            <!-- 服务端签到设置 -->
            <NDivider title-placement="left">
              基本设置
            </NDivider>

            <NFormItem label="启用签到功能">
              <NSwitch
                v-model:value="serverSetting.enableCheckIn"
                @update:value="updateServerSettings"
              />
              <template #feedback>
                启用后，观众可以通过发送签到命令获得积分
              </template>
            </NFormItem>

            <template v-if="serverSetting.enableCheckIn">
              <NFormItem
                label="签到命令"
                required
              >
                <NInputGroup>
                  <NInput
                    :value="serverSetting.checkInKeyword"
                    placeholder="例如：签到"
                    @update:value="(v: string) => serverSetting.checkInKeyword = v"
                  />
                  <NButton
                    type="primary"
                    @click="updateServerSettings"
                  >
                    保存
                  </NButton>
                </NInputGroup>
                <template #feedback>
                  观众发送此命令可以触发签到（注意：同时更新客户端命令设置）
                </template>
              </NFormItem>

              <NFormItem label="为签到提供积分">
                <NSwitch
                  v-model:value="serverSetting.givePointsForCheckIn"
                  @update:value="updateServerSettings"
                />
                <template #feedback>
                  启用后，签到会获得积分奖励
                </template>
              </NFormItem>

              <!-- 积分相关设置，只有在开启"为签到提供积分"后显示 -->
              <template v-if="serverSetting.givePointsForCheckIn">
                <NFormItem label="基础签到积分">
                  <NInputNumber
                    v-model:value="serverSetting.baseCheckInPoints"
                    :min="0"
                    style="width: 100%"
                    @update:value="updateServerSettings"
                  />
                  <template #feedback>
                    每次签到获得的基础积分数量
                  </template>
                </NFormItem>

                <NFormItem label="启用连续签到奖励">
                  <NSwitch
                    v-model:value="serverSetting.enableConsecutiveBonus"
                    @update:value="updateServerSettings"
                  />
                  <template #feedback>
                    启用后，连续签到会获得额外奖励
                  </template>
                </NFormItem>

                <template v-if="serverSetting.enableConsecutiveBonus">
                  <NFormItem label="每天额外奖励积分">
                    <NInputNumber
                      v-model:value="serverSetting.bonusPointsPerDay"
                      :min="0"
                      style="width: 100%"
                      @update:value="updateServerSettings"
                    />
                    <template #feedback>
                      每天连续签到额外奖励的积分数量
                    </template>
                  </NFormItem>

                  <NFormItem label="最大奖励积分">
                    <NInputNumber
                      v-model:value="serverSetting.maxBonusPoints"
                      :min="0"
                      style="width: 100%"
                      @update:value="updateServerSettings"
                    />
                    <template #feedback>
                      连续签到奖励积分的上限
                    </template>
                  </NFormItem>
                </template>
              </template>

              <NFormItem label="允许自己签到">
                <NSwitch
                  v-model:value="serverSetting.allowSelfCheckIn"
                  @update:value="updateServerSettings"
                />
                <template #feedback>
                  启用后，主播自己也可以签到获得积分
                </template>
              </NFormItem>

              <NFormItem label="要求用户已认证">
                <NSwitch
                  v-model:value="serverSetting.requireAuth"
                  @update:value="updateServerSettings"
                />
                <template #feedback>
                  启用后，只有已认证的用户才能签到
                </template>
              </NFormItem>

              <NFormItem label="允许查看签到排行">
                <NSwitch
                  :value="accountInfo.settings.enableFunctions.includes(FunctionTypes.CheckInRanking)"
                  @update:value="updateCheckInRanking"
                />
                <template #feedback>
                  启用后，用户可以查看签到排行榜
                </template>
              </NFormItem>
            </template>

            <!-- 客户端回复设置 -->
            <NDivider title-placement="left">
              回复消息设置
            </NDivider>

            <NFormItem label="发送签到回复">
              <NSwitch v-model:value="config.sendReply" />
              <template #feedback>
                启用后，签到成功或重复签到时会发送弹幕回复，关闭则只显示通知不发送弹幕
              </template>
            </NFormItem>

            <template v-if="config.sendReply">
              <!-- 签到模板帮助信息组件 -->
              <div style="margin-bottom: 12px">
                <TemplateHelper :placeholders="checkInPlaceholders" />
                <NAlert
                  type="info"
                  :show-icon="false"
                  style="margin-top: 8px"
                >
                  <template #header>
                    <div
                      style="display: flex; align-items: center; font-weight: bold"
                    >
                      <NIcon
                        :component="Info24Filled"
                        style="margin-right: 4px"
                      />
                      签到模板可用变量列表
                    </div>
                  </template>
                </NAlert>
              </div>
              <NDivider title-placement="left">
                签到成功回复
              </NDivider>
              <AutoActionEditor
                :action="config.successAction"
                :hide-name="true"
                :hide-enabled="true"
                :custom-test-context="customTestContext"
              />

              <NDivider title-placement="left">
                签到冷却回复
              </NDivider>
              <AutoActionEditor
                :action="config.cooldownAction"
                :hide-name="true"
                :hide-enabled="true"
                :custom-test-context="customTestContext"
              />
            </template>

            <NFormItem>
              <NButton
                type="primary"
                :disabled="!canEdit"
                :loading="isLoading"
                @click="updateSettings"
              >
                保存所有设置
              </NButton>
            </NFormItem>
          </NForm>
        </NSpin>
      </NTabPane>

      <NTabPane
        name="checkInRanking"
        tab="签到排行榜"
      >
        <div class="checkin-ranking">
          <NSpace vertical>
            <NAlert type="info">
              显示用户签到排行榜，包括连续签到天数和积分情况。选择时间段可查看不同期间的签到情况。
            </NAlert>

            <div class="ranking-filter">
              <NSpace align="center">
                <span>时间段：</span>
                <NSelect
                  v-model:value="timeRange"
                  style="width: 180px"
                  :options="timeRangeOptions"
                  @update:value="loadCheckInRanking"
                />

                <span>用户名：</span>
                <NInput
                  v-model:value="userFilter"
                  placeholder="搜索用户"
                  clearable
                  style="width: 150px"
                />

                <NButton
                  type="primary"
                  :loading="isLoadingRanking"
                  @click="loadCheckInRanking"
                >
                  刷新排行榜
                </NButton>
              </NSpace>
            </div>

            <NDataTable
              :columns="rankingColumns"
              :data="filteredRankingData"
              :pagination="{
                pageSize: 10,
                showSizePicker: true,
                pageSizes: [10, 20, 50, 100],
                onChange: (page: number) => pagination.page = page,
                onUpdatePageSize: (pageSize: number) => pagination.pageSize = pageSize,
              }"
              :bordered="false"
              :loading="isLoadingRanking"
              striped
            />

            <NDivider />

            <div class="ranking-actions">
              <NSpace vertical>
                <NAlert type="warning">
                  以下操作将重置用户的签到记录，请谨慎操作。重置后数据无法恢复。
                </NAlert>

                <NSpace justify="end">
                  <NPopconfirm @positive-click="resetAllCheckIn">
                    <template #trigger>
                      <NButton
                        type="error"
                        :disabled="isResetting"
                        :loading="isResetting"
                      >
                        重置所有用户签到数据
                      </NButton>
                    </template>
                    <template #default>
                      <div style="max-width: 250px">
                        <p>警告：此操作将清空所有用户的签到记录，包括连续签到天数等数据，且不可恢复！</p>
                        <p>确定要继续吗？</p>
                      </div>
                    </template>
                  </NPopconfirm>
                </NSpace>
              </NSpace>
            </div>
          </NSpace>
        </div>
      </NTabPane>

      <NTabPane
        name="testCheckIn"
        tab="测试签到"
      >
        <div class="test-checkin">
          <NSpace vertical>
            <NAlert type="info">
              在此可以模拟用户签到，测试签到功能是否正常工作。
            </NAlert>

            <NForm :label-width="100">
              <NFormItem label="用户UID">
                <BiliUserSelector
                  v-model:value="testUid"
                  placeholder="请输入B站用户UID"
                  @user-info-loaded="(u) => { if (u?.name && (!testUsername || testUsername === '测试用户')) testUsername = u.name }"
                />
              </NFormItem>
              <NFormItem label="用户名">
                <NInput
                  v-model:value="testUsername"
                  placeholder="输入用户名，默认为'测试用户'"
                />
              </NFormItem>
              <NFormItem>
                <NButton
                  type="primary"
                  :disabled="!testUid || !serverSetting.enableCheckIn"
                  @click="handleTestCheckIn"
                >
                  模拟签到
                </NButton>
              </NFormItem>
            </NForm>

            <NDivider title-placement="left">
              测试结果
            </NDivider>

            <NCard
              v-if="testResult"
              size="small"
              :title="testResult.success ? '签到成功' : '签到失败'"
            >
              <NText>{{ testResult.message }}</NText>
            </NCard>
          </NSpace>
        </div>
      </NTabPane>
    </NTabs>

    <NText
      :depth="3"
      style="font-size: 12px; margin-top: 15px; display: block"
    >
      提示：签到成功发送的回复消息会遵循全局的弹幕发送设置（如频率限制、弹幕长度等）。
    </NText>
  </NCard>
  <NCard
    v-else
    title="加载中..."
    size="small"
  >
    <NText>正在加载签到设置...</NText>
  </NCard>
</template>

<style scoped>
.settings-section {
  margin: 8px 0;
}

.ranking-filter {
  margin: 10px 0;
}
</style>
