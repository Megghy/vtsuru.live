<template>
  <div class="checkin-ranking-view">
    <NSpace vertical>
      <NCard
        class="ranking-card"
        title="签到排行榜"
      >
        <template #header-extra>
          <NSpace
            :wrap="true"
            :size="8"
          >
            <NSelect
              v-model:value="timeRange"
              style="min-width: 120px; width: auto"
              :options="timeRangeOptions"
              @update:value="loadCheckInRanking"
            />
            <NInput
              v-model:value="userFilter"
              placeholder="搜索用户"
              clearable
              style="min-width: 120px; width: auto"
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
            <div
              class="custom-ranking-table"
            >
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
                  :class="{'top-three': index < 3}"
                >
                  <!-- 排名列 -->
                  <div class="col-rank">
                    <div
                      class="rank-number"
                      :class="{
                        'rank-1': index === 0,
                        'rank-2': index === 1,
                        'rank-3': index === 2
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
                    <div
                      v-if="item.isAuthed"
                      class="user-authed"
                    >
                      已认证
                    </div>
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
                        <NTime
                          :time="item.lastCheckInTime"
                        />
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
          <NAlert type="info">
            <template #icon>
              <NIcon>
                <Info24Filled />
              </NIcon>
            </template>
            签到可获得积分，连续签到有额外奖励。排行榜每日更新，发送"{{ checkInKeyword }}"即可参与签到。
          </NAlert>
        </div>
      </NCard>
    </NSpace>
  </div>
</template>

<script setup lang="ts">
import { CheckInRankingInfo, UserInfo } from '@/api/api-models';
import { QueryGetAPI } from '@/api/query';
import { CHECKIN_API_URL } from '@/data/constants';
import { Info24Filled } from '@vicons/fluent';
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
  NTooltip,
} from 'naive-ui';
import { computed, onMounted, ref } from 'vue';

const props = defineProps<{
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
}>()

// 状态变量
const isLoading = ref(false);
const rankingData = ref<CheckInRankingInfo[]>([]);
const timeRange = ref<string>('all');
const userFilter = ref<string>('');
const checkInKeyword = ref('签到'); // 默认签到关键词
const pagination = ref({
  page: 1,
  pageSize: 10,
});

// 时间段选项
const timeRangeOptions = [
  { label: '全部时间', value: 'all' },
  { label: '今日', value: 'today' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
];

// 过滤后的排行榜数据
const filteredRankingData = computed(() => {
  let filtered = rankingData.value;

  // 按时间范围筛选
  if (timeRange.value !== 'all') {
    const now = new Date();
    let startTime: Date;

    if (timeRange.value === 'today') {
      // 今天凌晨
      startTime = new Date(now);
      startTime.setHours(0, 0, 0, 0);
    } else if (timeRange.value === 'week') {
      // 本周一
      const dayOfWeek = now.getDay() || 7; // 把周日作为7处理
      startTime = new Date(now);
      startTime.setDate(now.getDate() - (dayOfWeek - 1));
      startTime.setHours(0, 0, 0, 0);
    } else if (timeRange.value === 'month') {
      // 本月1号
      startTime = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    filtered = filtered.filter(user => {
      const checkInTime = new Date(user.lastCheckInTime);
      return checkInTime >= startTime;
    });
  }

  // 按用户名筛选
  if (userFilter.value) {
    const keyword = userFilter.value.toLowerCase();
    filtered = filtered.filter(user =>
      user.name.toLowerCase().includes(keyword)
    );
  }

  return filtered;
});

// 处理分页后的数据
const pagedData = computed(() => {
  const { page, pageSize } = pagination.value;
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  return filteredRankingData.value.slice(startIndex, endIndex);
});

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${month}月${day}日 ${hours}:${minutes}`;
}

// 加载签到排行榜数据
async function loadCheckInRanking() {
  isLoading.value = true;
  try {
    // 使用用户视角的签到排行API
    const response = await QueryGetAPI<CheckInRankingInfo[]>(`${CHECKIN_API_URL}ranking`, {
      vId: props.userInfo?.id,
      count: 100
    });

    if (response.code === 200) {
      rankingData.value = response.data;
      pagination.value.page = 1; // 重置为第一页
    } else {
      rankingData.value = [];
      window.$message?.error?.(`获取签到排行榜失败: ${response.message}`);
    }
  } catch (error) {
    console.error('加载签到排行榜失败:', error);
    rankingData.value = [];
  } finally {
    isLoading.value = false;
  }
}

// 获取签到关键词
async function fetchCheckInKeyword() {
  if (!props.userInfo?.id) return;

  try {
    // 获取主播的签到关键词设置
    const response = await QueryGetAPI<{
      keyword: string
      isEnabled: boolean
      requireAuth: boolean
    }>(`${CHECKIN_API_URL}keyword`, {
      vId: props.userInfo?.id
    });

    if (response.code === 200 && response.data) {
      checkInKeyword.value = response.data.keyword;
    }
  } catch (error) {
    console.error('获取签到关键词失败:', error);
  }
}

// 组件挂载时获取签到排行和关键词
onMounted(() => {
  fetchCheckInKeyword();
  loadCheckInRanking();
});
</script>

<style scoped>
.checkin-ranking-view {
  padding: 12px;
}

.empty-data {
  padding: 40px 0;
  text-align: center;
}

.ranking-info {
  margin-top: 20px;
}

/* 自定义表格样式 */
.custom-ranking-table {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: var(--box-shadow-1);
  margin-bottom: 16px;
  overflow-x: auto;
}

.ranking-header {
  background-color: var(--table-header-color);
  font-weight: var(--font-weight-strong);
  color: var(--text-color-2);
  border-radius: 8px;
}

.ranking-row {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--divider-color);
  transition: background-color 0.3s var(--cubic-bezier-ease-in-out);
}

.ranking-body .ranking-row:hover {
  background-color: var(--hover-color);
}

.ranking-body .ranking-row:last-child {
  border-bottom: none;
}

.top-three {
  background-color: var(--table-color-striped);
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
  font-weight: var(--font-weight-strong);
  color: var(--text-color-2);
  background-color: var(--action-color);
}

.rank-1 {
  background: linear-gradient(135deg, #ffe259, #ffa751);
  color: white !important;
}

.rank-2 {
  background: linear-gradient(135deg, #d3d3d3, #a9a9a9);
  color: white !important;
}

.rank-3 {
  background: linear-gradient(135deg, #c79364, #a77347);
  color: white !important;
}

.user-name {
  font-weight: var(--font-weight-strong);
  margin-right: 8px;
}

.user-authed {
  background-color: var(--success-color);
  color: white;
  padding: 2px 6px;
  border-radius: 10px;
  font-size: var(--font-size-tiny);
}

.days-count,
.count-value {
  font-weight: var(--font-weight-strong);
  font-size: var(--font-size-large);
  color: var(--info-color);
  margin-right: 4px;
}

.days-text,
.count-text {
  color: var(--text-color-3);
  font-size: var(--font-size-tiny);
}

.ranking-footer {
  padding: 16px;
  display: flex;
  justify-content: center;
  background-color: var(--table-header-color);
}

/* 增强响应式样式 */
.ranking-card :deep(.n-card-header__main) {
  font-size: var(--font-size-large);
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