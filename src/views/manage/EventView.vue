<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { EventModel } from '@/api/api-models'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/components/EventFetcherAlert.vue'
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import { AVATAR_URL, EVENT_API_URL, HISTORY_API_URL } from '@/data/constants'
import { GuidUtils, isDarkMode } from '@/Utils'
import {
  ArrowDownload24Regular,
  ArrowSync24Filled,
  Grid28Filled,
  List16Filled,
} from '@vicons/fluent'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCollapse,
  NCollapseItem,
  NDataTable,
  NDatePicker,
  NDivider,
  NEllipsis,
  NGrid,
  NGridItem,
  NH3,
  NIcon,
  NInfiniteScroll,
  NLi,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NUl,
  useMessage,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'

// 定义数据模型类型 (从 HistoryView 迁移)
interface GuardMemberModel {
  guardOUId: string
  username: string
  guardLevel: string
  accompanyDays: number
  isActive: boolean
  lastUpdateTime: string
}

interface GuardStatsModel {
  totalCount: number
  governorCount: number
  admiralCount: number
  captainCount: number
  avgAccompanyDays: number
  maxAccompanyDays: number
  lastUpdateTime: string
}

const accountInfo = useAccount()
const message = useMessage()

// #region Event History Logic
// 日期选择快捷方式
const rangeShortcuts = {
  上个月: () => {
    const cur = new Date()
    const lastMonth = new Date(cur.getFullYear(), cur.getMonth() - 1)
    return [
      new Date(cur.getFullYear(), cur.getMonth() - 1, 1).getTime(),
      new Date(cur.getFullYear(), cur.getMonth(), 1).getTime(),
    ] as const
  },
  本月: () => {
    const cur = new Date()
    return [new Date(cur.getFullYear(), cur.getMonth(), 1).getTime(), cur.getTime()] as const
  },
}

// 响应式状态
const selectedDate = ref<[number, number]>([rangeShortcuts.本月()[0], rangeShortcuts.本月()[1]])
const selectedType = ref(EventDataTypes.Guard)
const events = ref<EventModel[]>([]) // 初始为空数组
const isLoading = ref(false) // 用于初始加载
const isLoadingMore = ref(false) // 用于无限滚动加载
const displayMode = ref<'grid' | 'column'>('grid')
const exportType = ref<'json' | 'csv'>('csv')
const offset = ref(0) // 当前偏移量
const limit = ref(20) // 每次加载数量
const hasMore = ref(true) // 是否还有更多数据

// 根据类型过滤事件
const selectedEvents = computed(() => {
  return events.value.filter(e => e.type == selectedType.value)
})

// API请求获取数据
async function get(currentOffset: number, currentLimit: number) {
  try {
    const data = await QueryGetAPI<EventModel[]>(`${EVENT_API_URL}get`, {
      start: selectedDate.value[0],
      end: selectedDate.value[1],
      offset: currentOffset,
      limit: currentLimit,
    })
    if (data.code == 200) {
      if (currentOffset === 0) {
        message.success(`成功获取 ${data.data.length} 条数据`)
      }
      return data.data
    }
    else {
      message.error(`获取数据失败: ${data.message}`)
      return []
    }
  }
  catch (err) {
    message.error(`获取数据失败: ${(err as Error).message}`)
    return []
  }
}

// 封装的数据获取函数
async function fetchData(isInitialLoad = false) {
  if (isLoading.value || isLoadingMore.value)
    return

  if (isInitialLoad) {
    isLoading.value = true
    offset.value = 0
    events.value = []
    hasMore.value = true
  }
  else {
    isLoadingMore.value = true
  }

  const currentOffset = offset.value
  const fetchedData = await get(currentOffset, limit.value)

  if (fetchedData.length > 0) {
    const sortedData = new List(fetchedData).OrderByDescending(d => d.time).ToArray()
    events.value = isInitialLoad ? sortedData : [...events.value, ...sortedData]
    offset.value += fetchedData.length
    hasMore.value = fetchedData.length === limit.value
  }
  else {
    hasMore.value = false
  }

  if (isInitialLoad) {
    isLoading.value = false
  }
  else {
    isLoadingMore.value = false
  }
}

// 日期或类型变化时重新加载
async function onFilterChange() {
  await fetchData(true)
}

// 无限滚动加载更多
async function loadMore() {
  if (!hasMore.value || isLoadingMore.value || isLoading.value)
    return
  await fetchData(false)
}

// 监视日期和类型变化
watch([selectedDate, selectedType], onFilterChange, { immediate: true })

// 获取SC颜色
function GetSCColor(price: number): string {
  if (price === 0)
    return `#2a60b2`
  if (price > 0 && price < 30)
    return `#2a60b2`
  if (price >= 30 && price < 50)
    return `#427d9e`
  if (price >= 50 && price < 100)
    return `#c99801`
  if (price >= 500 && price < 1000)
    return `#e09443`
  if (price >= 1000 && price < 2000)
    return `#e54d4d`
  if (price >= 2000)
    return `#ab1a32`
  return ''
}

// 获取舰长颜色
function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138)
      return ''
    if (price >= 138 && price < 1598)
      return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998)
      return 'rgb(157, 155, 255)'
    if (price >= 15998)
      return 'rgb(122, 4, 35)'
  }
  return ''
}

// 导出数据功能
function exportData() {
  if (hasMore.value) {
    message.warning('当前导出的是已加载的部分数据，并非所有数据。')
  }
  let text = ''
  const fileName = generateExportFileName()

  switch (exportType.value) {
    case 'json': {
      text = JSON.stringify(selectedEvents.value)
      break
    }
    case 'csv': {
      text = objectsToCSV(
        selectedEvents.value.map(v => ({
          type: v.type,
          time: format(v.time, 'yyyy-MM-dd HH:mm:ss'),
          name: v.uname,
          uId: v.uid,
          num: v.num,
          price: v.price,
          msg: v.msg,
        })),
      )
      break
    }
  }

  saveAs(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
    fileName,
  )
}

// 生成导出文件名
function generateExportFileName() {
  return `${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[0], 'yyyy-MM-dd HH:mm:ss')}_${format(selectedDate.value[1], 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.id}_${accountInfo.value?.name}_${selectedType.value}.${exportType.value}`
}

// 将对象数组转换为CSV格式
function objectsToCSV(arr: any[]) {
  if (arr.length === 0)
    return ''

  const array = [Object.keys(arr[0])].concat(arr)
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value
        })
        .toString()
    })
    .join('\n')
}
// #endregion

// #region Current Captains Logic (Migrated)
const guardList = ref<GuardMemberModel[]>([])
const guardStats = ref<GuardStatsModel | null>(null)
const guardListLoading = ref(false)
const guardPaginationPage = ref(1)
const guardPaginationPageSize = ref(20)
const guardPagination = computed(() => ({
  page: guardPaginationPage.value,
  pageSize: guardPaginationPageSize.value,
  itemCount: guardList.value.length,
  showSizePicker: true,
  pageSizes: [10, 20, 30, 50],
  onChange: (page: number) => {
    guardPaginationPage.value = page
  },
  onUpdatePageSize: (pageSize: number) => {
    guardPaginationPageSize.value = pageSize
    guardPaginationPage.value = 1
  },
}))

const guardColumns: DataTableColumns<GuardMemberModel> = [
  {
    title: 'OUID',
    key: 'guardOUId',
    width: 250,
    ellipsis: {
      tooltip: true,
    },
    render: (row) => {
      return h('span', { style: { fontWeight: 'bold' } }, GuidUtils.isGuidFromUserId(row.guardOUId) ? GuidUtils.guidToLong(row.guardOUId) : row.guardOUId)
    },
  },
  {
    title: '用户名',
    key: 'username',
    ellipsis: {
      tooltip: true,
    },
  },
  {
    title: '等级',
    key: 'guardLevel',
    width: 100,
    render: (row) => {
      const colorMap: Record<string, string> = {
        总督: '#FF6B9D',
        提督: '#C59AFF',
        舰长: '#00D1FF',
      }
      return h(
        'span',
        { style: { color: colorMap[row.guardLevel] || '#333', fontWeight: 'bold' } },
        row.guardLevel,
      )
    },
  },
  {
    title: '陪伴天数',
    key: 'accompanyDays',
    width: 120,
    sorter: (a, b) => a.accompanyDays - b.accompanyDays,
  },
]

async function loadGuardList() {
  guardListLoading.value = true
  try {
    const [listResponse, statsResponse] = await Promise.all([
      QueryGetAPI<GuardMemberModel[]>(
        `${HISTORY_API_URL}guards-list?activeOnly=true`,
      ),
      QueryGetAPI<GuardStatsModel>(`${HISTORY_API_URL}guards/stats`),
    ])

    if (listResponse.code === 200) {
      guardList.value = listResponse.data
    }
    else {
      message.error(`加载舰长列表失败: ${listResponse.message}`)
    }

    if (statsResponse.code === 200) {
      guardStats.value = statsResponse.data
    }
    else {
      message.error(`加载舰长统计失败: ${statsResponse.message}`)
    }
  }
  catch (err) {
    message.error('加载舰长数据失败')
    console.error(err)
  }
  finally {
    guardListLoading.value = false
  }
}

// On tab change or mount, if we are in guard tab, load data if empty
async function onTabChange(value: string) {
  if (value === 'current-captains' && guardList.value.length === 0) {
    await loadGuardList()
  }
}
// #endregion
</script>

<template>
  <NSpace vertical>
    <EventFetcherAlert />
    <EventFetcherStatusCard />
  </NSpace>
  <NDivider />
  <NCard
    size="small"
    style="width: 100%"
  >
    <template v-if="accountInfo?.isBiliVerified">
      <NTabs
        type="line"
        animated
        default-value="history"
        @update:value="onTabChange"
      >
        <NTabPane
          name="history"
          tab="历史记录"
        >
          <!-- 历史记录面板 -->
          <NSpace
            vertical
            size="large"
          >
            <!-- 筛选工具栏 -->
            <div class="filter-bar">
              <NSpace
                align="center"
                wrap
                justify="space-between"
              >
                <NSpace
                  align="center"
                  wrap
                >
                  <NDatePicker
                    v-model:value="selectedDate"
                    type="datetimerange"
                    :shortcuts="rangeShortcuts"
                    start-placeholder="开始时间"
                    end-placeholder="结束时间"
                    :disabled="isLoading || isLoadingMore"
                    class="date-picker"
                  />
                  <NRadioGroup
                    v-model:value="selectedType"
                    :disabled="isLoading || isLoadingMore"
                  >
                    <NRadioButton :value="EventDataTypes.Guard">
                      舰长
                    </NRadioButton>
                    <NRadioButton :value="EventDataTypes.SC">
                      Superchat
                    </NRadioButton>
                  </NRadioGroup>
                </NSpace>

                <NSpace align="center">
                  <!-- 导出功能 -->
                  <NCard
                    size="small"
                    embedded
                    content-style="padding: 4px 12px;"
                  >
                    <NSpace align="center">
                      <NRadioGroup
                        v-model:value="exportType"
                        size="small"
                      >
                        <NRadioButton value="csv">
                          CSV
                        </NRadioButton>
                        <NRadioButton value="json">
                          Json
                        </NRadioButton>
                      </NRadioGroup>
                      <NButton
                        size="small"
                        secondary
                        type="primary"
                        :disabled="selectedEvents.length === 0 || isLoading || isLoadingMore"
                        @click="exportData"
                      >
                        <template #icon>
                          <NIcon :component="ArrowDownload24Regular" />
                        </template>
                        导出
                      </NButton>
                    </NSpace>
                  </NCard>
                </NSpace>
              </NSpace>
            </div>

            <!-- 视图切换和统计信息 -->
            <NSpace
              justify="space-between"
              align="center"
            >
              <NText depth="3">
                共加载 {{ selectedEvents.length }} 条 {{ hasMore ? '(滚动加载更多...)' : '' }}
              </NText>
              <NRadioGroup
                v-model:value="displayMode"
                size="small"
              >
                <NRadioButton value="grid">
                  <NIcon :component="Grid28Filled" />
                </NRadioButton>
                <NRadioButton value="column">
                  <NIcon :component="List16Filled" />
                </NRadioButton>
              </NRadioGroup>
            </NSpace>

            <!-- 数据展示区域 -->
            <NSpin :show="isLoading">
              <Transition
                mode="out-in"
                name="fade"
                appear
              >
                <!-- 网格视图 -->
                <div v-if="displayMode == 'grid'">
                  <NInfiniteScroll
                    :distance="100"
                    :disabled="isLoadingMore || !hasMore || isLoading"
                    style="height: 600px; padding-right: 10px;"
                    @load="loadMore"
                  >
                    <NGrid
                      cols="1 500:2 800:3 1000:4 1200:5"
                      :x-gap="12"
                      :y-gap="8"
                    >
                      <NGridItem
                        v-for="item in selectedEvents"
                        :key="`${item.time}_${item.uid}_${item.price}`"
                      >
                        <NCard
                          size="small"
                          :style="`height: ${selectedType == EventDataTypes.Guard ? '160px' : '200px'}`"
                          embedded
                          hoverable
                          class="event-card"
                        >
                          <NSpace
                            align="center"
                            vertical
                            :size="5"
                          >
                            <NAvatar
                              round
                              lazy
                              borderd
                              :size="54"
                              :src="item.uid ? AVATAR_URL + item.uid : item.uface"
                              :img-props="{ referrerpolicy: 'no-referrer' }"
                              class="event-avatar"
                            />
                            <NSpace size="small">
                              <NTag
                                v-if="selectedType == EventDataTypes.Guard"
                                size="tiny"
                                :bordered="false"
                              >
                                {{ item.msg }}
                              </NTag>
                              <NTag
                                size="tiny"
                                round
                                :color="{
                                  color: selectedType == EventDataTypes.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                                  textColor: 'white',
                                  borderColor: isDarkMode ? 'white' : '#00000000',
                                }"
                              >
                                {{ item.price }}
                              </NTag>
                            </NSpace>
                            <NText
                              strong
                              class="event-username"
                            >
                              <NEllipsis style="max-width: 150px">
                                {{ item.uname }}
                              </NEllipsis>
                            </NText>
                            <NText
                              depth="3"
                              style="font-size: 12px"
                            >
                              <NTime :time="item.time" />
                            </NText>
                            <NEllipsis
                              v-if="selectedType == EventDataTypes.SC"
                              :line-clamp="2"
                              style="font-size: 12px; text-align: center;"
                            >
                              {{ item.msg }}
                            </NEllipsis>
                          </NSpace>
                        </NCard>
                      </NGridItem>
                    </NGrid>
                    <!-- 加载更多指示器 -->
                    <div
                      v-if="isLoadingMore"
                      class="loading-more"
                    >
                      <NSpin size="small" />
                      <NText
                        depth="3"
                        style="margin-left: 5px;"
                      >
                        加载中...
                      </NText>
                    </div>
                    <div
                      v-if="!hasMore && !isLoading && selectedEvents.length > 0"
                      class="no-more"
                    >
                      <NText depth="3">
                        没有更多数据了
                      </NText>
                    </div>
                  </NInfiniteScroll>
                </div>

                <!-- 表格视图 -->
                <NTable
                  v-else-if="!isLoading && selectedEvents.length > 0"
                  striped
                >
                  <thead>
                    <tr>
                      <th>用户名</th>
                      <th>OUID</th>
                      <th>时间</th>
                      <th v-if="selectedType == EventDataTypes.Guard">
                        类型
                      </th>
                      <th>价格</th>
                      <th v-if="selectedType == EventDataTypes.SC">
                        内容
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="item in selectedEvents"
                      :key="`${item.time}_${item.uid}_${item.price}`"
                    >
                      <td>{{ item.uname }}</td>
                      <td>{{ GuidUtils.isGuidFromUserId(item.ouid) ? GuidUtils.guidToLong(item.ouid) : item.ouid }}</td>
                      <td>
                        <NTime
                          :time="item.time"
                          format="yyyy-MM-dd HH:mm:ss"
                        />
                      </td>
                      <td v-if="selectedType == EventDataTypes.Guard">
                        {{ item.msg }}
                      </td>
                      <td>
                        <NTag
                          size="small"
                          :color="{
                            color: selectedType == EventDataTypes.Guard ? GetGuardColor(item.price) : GetSCColor(item.price),
                            textColor: 'white',
                            borderColor: isDarkMode ? 'white' : '#00000000',
                          }"
                        >
                          {{ item.price }}
                        </NTag>
                      </td>
                      <td v-if="selectedType == EventDataTypes.SC">
                        <NEllipsis style="max-width: 300px">
                          {{ item.msg }}
                        </NEllipsis>
                      </td>
                    </tr>
                  </tbody>
                </NTable>

                <!-- 无数据提示 -->
                <NAlert
                  v-else-if="!isLoading && selectedEvents.length === 0"
                  title="无数据"
                  type="info"
                  style="margin-top: 20px;"
                >
                  在选定的时间范围和类型内没有找到数据。
                </NAlert>
              </Transition>
            </NSpin>
          </NSpace>
        </NTabPane>

        <NTabPane
          name="current-captains"
          tab="当前在舰用户"
        >
          <!-- 当前在舰用户面板 -->
          <NSpace
            vertical
            size="large"
          >
            <!-- 统计卡片 -->
            <NGrid
              v-if="guardStats"
              cols="2 600:4"
              item-responsive
              responsive="screen"
              x-gap="12"
              y-gap="12"
            >
              <NGridItem>
                <NCard
                  embedded
                  size="small"
                >
                  <NStatistic
                    label="舰长总数"
                    :value="guardStats.totalCount"
                  />
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard
                  embedded
                  size="small"
                >
                  <NStatistic
                    label="总督"
                    :value="guardStats.governorCount"
                  >
                    <template #prefix>
                      <span style="color: #FF6B9D">●</span>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard
                  embedded
                  size="small"
                >
                  <NStatistic
                    label="提督"
                    :value="guardStats.admiralCount"
                  >
                    <template #prefix>
                      <span style="color: #C59AFF">●</span>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
              <NGridItem>
                <NCard
                  embedded
                  size="small"
                >
                  <NStatistic
                    label="舰长"
                    :value="guardStats.captainCount"
                  >
                    <template #prefix>
                      <span style="color: #00D1FF">●</span>
                    </template>
                  </NStatistic>
                </NCard>
              </NGridItem>
            </NGrid>

            <!-- 工具栏 -->
            <NSpace justify="end">
              <NButton
                secondary
                type="primary"
                :loading="guardListLoading"
                @click="loadGuardList"
              >
                <template #icon>
                  <NIcon :component="ArrowSync24Filled" />
                </template>
                刷新列表
              </NButton>
            </NSpace>

            <!-- 列表 -->
            <NDataTable
              v-if="guardList?.length > 0"
              :columns="guardColumns"
              :data="guardList"
              :pagination="guardPagination"
              :loading="guardListLoading"
              :bordered="false"
              striped
              size="small"
            />
            <NAlert
              v-else-if="!guardListLoading"
              type="info"
            >
              暂无在舰用户
            </NAlert>
          </NSpace>
        </NTabPane>
      </NTabs>
    </template>

    <!-- 未认证用户提示区域 -->
    <template v-else>
      <NCollapse :default-expanded-names="['1']">
        <NCollapseItem
          title="这是什么?"
          name="1"
        >
          可以查看曾经收到的Superchat以及上舰记录, 并导出为 CSV 之类的表格
        </NCollapseItem>
        <NCollapseItem title="可以直接用吗">
          遗憾的是并不能, 使用这个功能需要你拥有一个可以7*24小时运行 Docker 容器或者 Node.js 脚本的环境,
          并且可以访问互联网
        </NCollapseItem>
        <NCollapseItem title="有没有什么要求?">
          关于环境的话理论上能够运行 Docker 或者 Node.js 的环境都能可以
          <br><br>
          此外, 你至少需要以下技能之一:
          <NUl>
            <NLi>了解并能够使用 Docker 容器</NLi>
            <NLi>了解并能够运行 Node.js</NLi>
            <NLi>熟悉互联网冲浪, 能够跟着教程点击鼠标</NLi>
            <NLi>拥有掌握以上技能的 stf 或者朋友</NLi>
          </NUl>
          <NH3>
            <NText strong>
              即使你对相关知识一窍不通也不用担心, 跟着后面的傻瓜教程中的 Koyeb 也可以完成部署.
              理论上这玩意里头的免费套餐就够用了, 当然如果你想要更稳一点上个付费套餐也不影响
            </NText>
          </NH3>
        </NCollapseItem>
      </NCollapse>
      <NDivider style="margin-bottom: 10px" />
      <NSpace justify="center">
        <NButton
          tag="a"
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          type="primary"
        >
          部署指南
        </NButton>
      </NSpace>
    </template>
  </NCard>
</template>


<style scoped>
/* 响应式样式调整 */
@media (max-width: 600px) {
  .control-panel {
    flex-direction: column;
    gap: 12px;
  }
}

/* 添加过渡效果 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 网格卡片样式微调 */
.n-card {
  transition: box-shadow 0.3s ease; /* 平滑阴影过渡 */
}
</style>
