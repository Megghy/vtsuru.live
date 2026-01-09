<script setup lang="ts">
import type { CheckInRankingInfo, UserInfo } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NInput,
  NPagination,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NTooltip,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import { CHECKIN_API_URL } from '@/shared/config'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
}>()

// 状态变量
const isLoading = ref(false)
const rankingData = ref<CheckInRankingInfo[]>([])
const timeRange = ref<string>('all')
const userFilter = ref<string>('')
const checkInKeyword = ref('签到') // 默认签到关键词
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
    }

    filtered = filtered.filter((user) => {
      const checkInTime = new Date(user.lastCheckInTime)
      return checkInTime >= startTime
    })
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

// 处理分页后的数据
const pagedData = computed(() => {
  const { page, pageSize } = pagination.value
  const startIndex = (page - 1) * pageSize
  const endIndex = startIndex + pageSize
  return filteredRankingData.value.slice(startIndex, endIndex)
})

// 加载签到排行榜数据
async function loadCheckInRanking() {
  isLoading.value = true
  try {
    // 使用用户视角的签到排行API
    const response = await QueryGetAPI<CheckInRankingInfo[]>(`${CHECKIN_API_URL}ranking`, {
      vId: props.userInfo?.id,
      count: 100,
    })

    if (response.code === 200) {
      rankingData.value = response.data
      pagination.value.page = 1 // 重置为第一页
    } else {
      rankingData.value = []
      window.$message?.error?.(`获取签到排行榜失败: ${response.message}`)
    }
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    rankingData.value = []
  } finally {
    isLoading.value = false
  }
}

// 获取签到关键词
async function fetchCheckInKeyword() {
  if (!props.userInfo?.id) return

  try {
    // 获取主播的签到关键词设置
    const response = await QueryGetAPI<{
      keyword: string
      isEnabled: boolean
      requireAuth: boolean
    }>(`${CHECKIN_API_URL}keyword`, {
      vId: props.userInfo?.id,
    })

    if (response.code === 200 && response.data) {
      checkInKeyword.value = response.data.keyword
    }
  } catch (error) {
    console.error('获取签到关键词失败:', error)
  }
}

// 组件挂载时获取签到排行和关键词
onMounted(() => {
  fetchCheckInKeyword()
  loadCheckInRanking()
})
</script>

<template>
  <NCard
    class="ranking-card"
    title="签到排行榜"
    size="small"
    bordered
  >
    <template #header-extra>
      <NSpace :wrap="true" :size="8">
        <NSelect
          v-model:value="timeRange"
          size="small"
          style="min-width: 120px; width: auto"
          :options="timeRangeOptions"
          @update:value="loadCheckInRanking"
        />
        <NInput
          v-model:value="userFilter"
          size="small"
          placeholder="搜索用户"
          clearable
          style="min-width: 140px; width: auto"
        />
        <NButton
          type="primary"
          size="small"
          :loading="isLoading"
          @click="loadCheckInRanking"
        >
          刷新
        </NButton>
      </NSpace>
    </template>

    <NSpin :show="isLoading">
      <div
        v-if="rankingData.length === 0 && !isLoading"
        class="empty-data"
      >
        <NEmpty description="暂无签到数据" />
      </div>

      <!-- 自定义排行榜表格 -->
      <div
        v-else
        class="ranking-table-wrapper"
      >
        <div class="custom-ranking-table">
          <!-- 排行榜头部 -->
          <div class="ranking-header">
            <div class="ranking-row">
              <div class="col-rank">
                排名
              </div>
              <div class="col-user">
                用户
              </div>
              <div class="col-days">
                连续签到
              </div>
              <div class="col-monthly">
                本月签到
              </div>
              <div class="col-total">
                总签到
              </div>
              <div class="col-time">
                最近签到时间
              </div>
            </div>
          </div>

          <!-- 排行榜内容 -->
          <div class="ranking-body">
            <div
              v-for="(item, index) in pagedData"
              :key="index"
              class="ranking-row"
              :class="{ 'top-three': index < 3 }"
            >
              <!-- 排名列 -->
              <div class="col-rank">
                <div
                  class="rank-number"
                  :class="{
                    'rank-1': index === 0,
                    'rank-2': index === 1,
                    'rank-3': index === 2,
                  }"
                >
                  {{ index + 1 + (pagination.page - 1) * pagination.pageSize }}
                </div>
              </div>

              <!-- 用户列 -->
              <div class="col-user">
                <div class="user-name">
                  {{ item.name }}
                </div>
                <NTag
                  v-if="item.isAuthed"
                  size="small"
                  type="success"
                  :bordered="false"
                  style="margin-left: 8px;"
                >
                  已认证
                </NTag>
              </div>

              <!-- 连续签到列 -->
              <div class="col-days">
                <div class="days-count">
                  {{ item.consecutiveDays }}
                </div>
                <div class="days-text">
                  天
                </div>
              </div>

              <!-- 本月签到列 -->
              <div class="col-monthly">
                <div class="count-value">
                  {{ item.monthlyCheckInCount || 0 }}
                </div>
                <div class="count-text">
                  次
                </div>
              </div>

              <!-- 总签到列 -->
              <div class="col-total">
                <div class="count-value">
                  {{ item.totalCheckInCount || 0 }}
                </div>
                <div class="count-text">
                  次
                </div>
              </div>

              <!-- 签到时间列 -->
              <div class="col-time">
                <NTooltip>
                  <template #trigger>
                    <NTime
                      :time="item.lastCheckInTime"
                      type="relative"
                    />
                  </template>
                  <template #default>
                    <NTime :time="item.lastCheckInTime" />
                  </template>
                </NTooltip>
              </div>
            </div>
          </div>

          <!-- 分页控制 -->
          <div class="ranking-footer">
            <NPagination
              v-model:page="pagination.page"
              v-model:page-size="pagination.pageSize"
              :item-count="filteredRankingData.length"
              :page-sizes="[10, 20, 50]"
              show-size-picker
            />
          </div>
        </div>
      </div>
    </NSpin>

    <div class="ranking-info">
      <NAlert type="info" size="small">
        <template #icon>
          <NIcon>
            <Info24Filled />
          </NIcon>
        </template>
        签到可获得积分，连续签到有额外奖励。排行榜每日更新，发送"{{ checkInKeyword }}"即可参与签到。
      </NAlert>
    </div>
  </NCard>
</template>

<style scoped>
.empty-data {
  padding: 40px 0;
  text-align: center;
}

.ranking-info {
  margin-top: 12px;
}

/* 自定义表格样式 */
.custom-ranking-table {
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  margin-bottom: 16px;
  overflow-x: auto;
}

.ranking-header {
  background-color: var(--n-color-embedded);
  font-weight: 600;
  color: var(--n-text-color-2);
}

.ranking-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid var(--n-divider-color);
  transition: background-color 0.2s ease;
}

.ranking-body .ranking-row:hover {
  background-color: rgba(var(--n-primary-color-rgb), 0.04);
}

.ranking-body .ranking-row:last-child {
  border-bottom: none;
}

.top-three {
  background-color: rgba(var(--n-primary-color-rgb), 0.02);
}

.col-rank {
  width: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-user {
  flex: 1;
  display: flex;
  align-items: center;
}

.col-days,
.col-monthly,
.col-total {
  width: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.col-time {
  width: 150px;
  text-align: center;
}

.rank-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  color: var(--n-text-color-2);
  background-color: var(--n-color-embedded);
}

.rank-1 {
  background-color: rgba(var(--n-warning-color-rgb), 0.16);
  color: var(--n-warning-color) !important;
}

.rank-2 {
  background-color: rgba(var(--n-info-color-rgb), 0.14);
  color: var(--n-info-color) !important;
}

.rank-3 {
  background-color: rgba(var(--n-success-color-rgb), 0.14);
  color: var(--n-success-color) !important;
}

.user-name {
  font-weight: 600;
  margin-right: 8px;
}

.days-count,
.count-value {
  font-weight: 600;
  font-size: 18px;
  color: var(--n-info-color);
  margin-right: 4px;
}

.days-text,
.count-text {
  color: var(--n-text-color-3);
  font-size: 12px;
}

.ranking-footer {
  padding: 16px;
  display: flex;
  justify-content: center;
}

/* 增强响应式样式 */
.ranking-card :deep(.n-card-header__main) {
  font-size: 16px;
  white-space: nowrap;
}

.ranking-table-wrapper {
  overflow-x: auto;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .ranking-card :deep(.n-card-header) {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .ranking-card :deep(.n-card-header__extra) {
    margin-left: 0;
    width: 100%;
  }

  .col-rank {
    width: 50px;
  }

  .col-days,
  .col-monthly,
  .col-total {
    width: 80px;
  }

  .col-time {
    width: 120px;
  }

  .custom-ranking-table {
    min-width: 550px;
  }
}

@media (max-width: 480px) {
  .col-user {
    min-width: 80px;
  }

  .col-days,
  .col-monthly,
  .col-total {
    width: 70px;
  }

  .col-time {
    width: 100px;
  }
}
</style>
