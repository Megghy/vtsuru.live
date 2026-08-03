<script setup lang="ts">
import { ArrowClockwise24Regular, Info24Filled, Search24Regular, Trophy24Filled } from '@vicons/fluent'
import { computed, onMounted, ref, watch } from 'vue'

import type { CheckInRankingInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import PublicTime from '@/apps/user-page/PublicTime.vue'
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
const toast = useToast()

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
      toast.add({ title: `获取签到排行榜失败: ${response.message}`, color: 'error' })
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
  <UCard
    class="user-page-card ranking-card"
    size="small"
    bordered
  >
    <template #header>
      <div class="ranking-title">
        <component :is="Trophy24Filled" />
        <span>签到排行榜</span>
        <span
          v-if="rankingData.length"
          class="ranking-count"
          >{{ filteredRankingData.length }} 人</span
        >
      </div>
    </template>

    <div class="filter-bar">
      <USelect
        v-model="timeRange"
        size="sm"
        :items="timeRangeOptions"
        aria-label="签到时间范围"
      />
      <UInput
        v-model="userFilter"
        size="sm"
        placeholder="搜索用户"
        clearable
      >
        <template #leading>
          <component :is="Search24Regular" />
        </template>
      </UInput>
      <UButton
        color="primary"
        size="sm"
        :loading="isLoading"
        @click="loadCheckInRanking"
      >
        <template #leading>
          <component :is="ArrowClockwise24Regular" />
        </template>
        刷新
      </UButton>
    </div>

    <div :aria-busy="isLoading">
      <UEmpty
        v-if="!isLoading && rankingData.length === 0"
        class="public-empty empty-data"
        description="暂无签到数据"
      />
      <UEmpty
        v-else-if="!isLoading && filteredRankingData.length === 0"
        class="public-empty empty-data"
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
            <UBadge
              v-if="item.isAuthed"
              size="xs"
              color="success"
              :bordered="false"
            >
              已认证
            </UBadge>
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
            <UTooltip>
              <PublicTime
                :time="item.lastCheckInTime"
                type="relative"
              />

              <template #content><PublicTime :time="item.lastCheckInTime" /></template>
            </UTooltip>
          </div>
        </div>

        <div class="ranking-footer">
          <UPagination
            v-model:page="pagination.page"
            :items-per-page="pagination.pageSize"
            :total="filteredRankingData.length"
            :sibling-count="2"
          />
          <USelect
            v-model="pagination.pageSize"
            class="page-size-select"
            size="sm"
            :items="pageSizeOptions"
            aria-label="每页显示数量"
          />
        </div>
      </div>
    </div>

    <UAlert
      class="ranking-info"
      color="info"
    >
      <template #leading> <component :is="Info24Filled" /> </template
      ><template #description>
        签到可获得积分，连续签到有额外奖励。发送“{{ checkInKeyword }}”即可参与签到。
      </template></UAlert
    >
  </UCard>
</template>

<style scoped src="./CheckInRankingView.css"></style>
