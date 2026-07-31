<script setup lang="ts">
import { ArrowClockwise24Regular, Info24Filled, Search24Regular, Trophy24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NEmpty,
  NIcon,
  NInput,
  NPagination,
  NSelect,
  NSpin,
  NTag,
  NTime,
  NTooltip,
} from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { CheckInRankingInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { CHECKIN_API_URL } from '@/shared/config'

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
}>()

const isLoading = ref(false)
const rankingData = ref<CheckInRankingInfo[]>([])
const timeRange = ref('all')
const userFilter = ref('')
const checkInKeyword = ref('签到')
const pagination = ref({ page: 1, pageSize: 10 })

const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
]
const pageSizeOptions = [10, 20, 50].map((value) => ({ label: `${value} 条/页`, value }))

function getRangeStart(range: string) {
  const now = new Date()
  if (range === 'today') {
    now.setHours(0, 0, 0, 0)
    return now
  }
  if (range === 'week') {
    now.setDate(now.getDate() - ((now.getDay() || 7) - 1))
    now.setHours(0, 0, 0, 0)
    return now
  }
  return new Date(now.getFullYear(), now.getMonth(), 1)
}

const filteredRankingData = computed(() => {
  const keyword = userFilter.value.trim().toLocaleLowerCase()
  const rangeStart = timeRange.value === 'all' ? undefined : getRangeStart(timeRange.value)

  return rankingData.value.filter((item) => {
    const matchesRange = !rangeStart || new Date(item.lastCheckInTime) >= rangeStart
    const matchesUser = !keyword || item.name.toLocaleLowerCase().includes(keyword)
    return matchesRange && matchesUser
  })
})

const pagedData = computed(() => {
  const { page, pageSize } = pagination.value
  const startIndex = (page - 1) * pageSize
  return filteredRankingData.value.slice(startIndex, startIndex + pageSize).map((item, index) => ({
    ...item,
    rank: startIndex + index + 1,
  }))
})

watch([timeRange, userFilter, () => pagination.value.pageSize], () => {
  pagination.value.page = 1
})

async function loadCheckInRanking() {
  isLoading.value = true
  try {
    const response = await QueryGetAPI<CheckInRankingInfo[]>(`${CHECKIN_API_URL}ranking`, {
      vId: props.userInfo?.id,
      count: 100,
    })

    if (response.code !== 200) {
      rankingData.value = []
      window.$message?.error?.(`获取签到排行榜失败: ${response.message}`)
      return
    }

    rankingData.value = response.data
    pagination.value.page = 1
  } catch (error) {
    console.error('加载签到排行榜失败:', error)
    rankingData.value = []
  } finally {
    isLoading.value = false
  }
}

async function fetchCheckInKeyword() {
  if (!props.userInfo?.id) return

  try {
    const response = await QueryGetAPI<{ keyword: string }>(`${CHECKIN_API_URL}keyword`, {
      vId: props.userInfo.id,
    })
    if (response.code === 200) checkInKeyword.value = response.data.keyword
  } catch (error) {
    console.error('获取签到关键词失败:', error)
  }
}

onMounted(() => {
  void fetchCheckInKeyword()
  void loadCheckInRanking()
})
</script>

<template>
  <NCard
    class="ranking-card"
    size="small"
    bordered
  >
    <template #header>
      <div class="ranking-title">
        <NIcon :component="Trophy24Filled" />
        <span>签到排行榜</span>
        <span
          v-if="rankingData.length"
          class="ranking-count"
          >{{ filteredRankingData.length }} 人</span
        >
      </div>
    </template>

    <div class="filter-bar">
      <NSelect
        v-model:value="timeRange"
        size="small"
        :options="timeRangeOptions"
        aria-label="签到时间范围"
      />
      <NInput
        v-model:value="userFilter"
        size="small"
        placeholder="搜索用户"
        clearable
      >
        <template #prefix>
          <NIcon :component="Search24Regular" />
        </template>
      </NInput>
      <NButton
        type="primary"
        size="small"
        :loading="isLoading"
        @click="loadCheckInRanking"
      >
        <template #icon>
          <NIcon :component="ArrowClockwise24Regular" />
        </template>
        刷新
      </NButton>
    </div>

    <NSpin :show="isLoading">
      <NEmpty
        v-if="!isLoading && rankingData.length === 0"
        class="empty-data"
        description="暂无签到数据"
      />
      <NEmpty
        v-else-if="!isLoading && filteredRankingData.length === 0"
        class="empty-data"
        description="没有符合条件的用户"
      />

      <div
        v-else
        class="ranking-table"
        role="table"
        aria-label="签到排行榜"
      >
        <div
          class="ranking-header ranking-grid"
          role="row"
        >
          <span>排名</span>
          <span>用户</span>
          <span>连续签到</span>
          <span>本月签到</span>
          <span>总签到</span>
          <span>最近签到</span>
        </div>

        <div
          v-for="item in pagedData"
          :key="item.ouId"
          class="ranking-row ranking-grid"
          :class="{ 'top-three': item.rank <= 3 }"
          role="row"
        >
          <div class="rank-cell">
            <span
              class="rank-number"
              :class="item.rank <= 3 ? `rank-${item.rank}` : undefined"
              >{{ item.rank }}</span
            >
          </div>

          <div class="user-cell">
            <strong class="user-name">{{ item.name }}</strong>
            <NTag
              v-if="item.isAuthed"
              size="tiny"
              type="success"
              :bordered="false"
            >
              已认证
            </NTag>
          </div>

          <div class="metric-cell streak-cell">
            <span class="metric-label">连续</span>
            <strong>{{ item.consecutiveDays }}</strong>
            <span class="metric-unit">天</span>
          </div>
          <div class="metric-cell monthly-cell">
            <span class="metric-label">本月</span>
            <strong>{{ item.monthlyCheckInCount ?? 0 }}</strong>
            <span class="metric-unit">次</span>
          </div>
          <div class="metric-cell total-cell">
            <span class="metric-label">累计</span>
            <strong>{{ item.totalCheckInCount ?? 0 }}</strong>
            <span class="metric-unit">次</span>
          </div>
          <div class="time-cell">
            <span class="metric-label">最近签到</span>
            <NTooltip>
              <template #trigger>
                <NTime
                  :time="item.lastCheckInTime"
                  type="relative"
                />
              </template>
              <NTime :time="item.lastCheckInTime" />
            </NTooltip>
          </div>
        </div>

        <div class="ranking-footer">
          <NPagination
            v-model:page="pagination.page"
            :page-size="pagination.pageSize"
            :item-count="filteredRankingData.length"
            :page-slot="5"
          />
          <NSelect
            v-model:value="pagination.pageSize"
            class="page-size-select"
            size="small"
            :options="pageSizeOptions"
            aria-label="每页显示数量"
          />
        </div>
      </div>
    </NSpin>

    <NAlert
      class="ranking-info"
      type="info"
      size="small"
    >
      <template #icon>
        <NIcon :component="Info24Filled" />
      </template>
      签到可获得积分，连续签到有额外奖励。发送“{{ checkInKeyword }}”即可参与签到。
    </NAlert>
  </NCard>
</template>

<style scoped src="./CheckInRankingView.css"></style>
