<script setup lang="ts">
import type { EventModel } from '@/api/api-models'
import { Grid28Filled, List16Filled } from '@vicons/fluent'
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
  NTable,
  NTag,
  NText,
  NTime,
  NUl,
  useMessage,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import EventFetcherAlert from '@/components/EventFetcherAlert.vue' // 添加缺失的组件导入
import EventFetcherStatusCard from '@/components/EventFetcherStatusCard.vue'
import { AVATAR_URL, EVENT_API_URL } from '@/data/constants'
import { isDarkMode } from '@/Utils'

const accountInfo = useAccount()
const message = useMessage()

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

// 根据类型过滤事件 - 这个计算属性现在可能只显示当前已加载的事件
// 如果需要导出 *所有* 选定日期/类型的数据，导出逻辑需要调整
const selectedEvents = computed(() => {
  return events.value.filter(e => e.type == selectedType.value)
})

// API请求获取数据 - 修改为支持分页
async function get(currentOffset: number, currentLimit: number) {
  try {
    const data = await QueryGetAPI<EventModel[]>(`${EVENT_API_URL}get`, {
      start: selectedDate.value[0],
      end: selectedDate.value[1],
      offset: currentOffset, // 添加 offset 参数
      limit: currentLimit, // 添加 limit 参数
    })
    if (data.code == 200) {
      message.success(`成功获取 ${data.data.length} 条数据`) // 调整提示
      return data.data // 直接返回数据数组
    } else {
      message.error(`获取数据失败: ${data.message}`)
      return []
    }
  } catch (err) {
    message.error(`获取数据失败: ${(err as Error).message}`) // 提供更详细的错误信息
    return []
  }
}

// 封装的数据获取函数
async function fetchData(isInitialLoad = false) {
  if (isLoading.value || isLoadingMore.value) return // 防止重复加载

  if (isInitialLoad) {
    isLoading.value = true
    offset.value = 0 // 重置偏移量
    events.value = [] // 清空现有事件
    hasMore.value = true // 假设有更多数据
  } else {
    isLoadingMore.value = true
  }

  const currentOffset = offset.value
  const fetchedData = await get(currentOffset, limit.value)

  if (fetchedData.length > 0) {
    // 使用 Linqts 进行排序后追加或设置
    const sortedData = new List(fetchedData).OrderByDescending(d => d.time).ToArray()
    events.value = isInitialLoad ? sortedData : [...events.value, ...sortedData]
    offset.value += fetchedData.length // 更新偏移量
    hasMore.value = fetchedData.length === limit.value // 如果返回的数量等于请求的数量，则可能还有更多
  } else {
    hasMore.value = false // 没有获取到数据，说明没有更多了
  }

  if (isInitialLoad) {
    isLoading.value = false
  } else {
    isLoadingMore.value = false
  }
}

// 日期或类型变化时重新加载
async function onFilterChange() {
  await fetchData(true) // 初始加载
}

// 无限滚动加载更多
async function loadMore() {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) return
  console.log('Loading more...') // 调试信息
  await fetchData(false)
}

// 监视日期和类型变化
watch([selectedDate, selectedType], onFilterChange, { immediate: true }) // 初始加载数据

// 获取SC颜色
function GetSCColor(price: number): string {
  if (price === 0) return `#2a60b2`
  if (price > 0 && price < 30) return `#2a60b2`
  if (price >= 30 && price < 50) return `#2a60b2`
  if (price >= 50 && price < 100) return `#427d9e`
  if (price >= 100 && price < 500) return `#c99801`
  if (price >= 500 && price < 1000) return `#e09443`
  if (price >= 1000 && price < 2000) return `#e54d4d`
  if (price >= 2000) return `#ab1a32`
  return ''
}

// 获取舰长颜色
function GetGuardColor(price: number | null | undefined): string {
  if (price) {
    if (price < 138) return ''
    if (price >= 138 && price < 1598) return 'rgb(104, 136, 241)'
    if (price >= 1598 && price < 15998) return 'rgb(157, 155, 255)'
    if (price >= 15998) return 'rgb(122, 4, 35)'
  }
  return ''
}

// 导出数据功能 - 注意：这现在只导出已加载的数据
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
  if (arr.length === 0) return ''

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
      <!-- 日期选择和类型选择区域 -->
      <NSpace
        justify="center"
        align="center"
        class="control-panel"
      >
        <NDatePicker
          v-model:value="selectedDate"
          type="datetimerange"
          :shortcuts="rangeShortcuts"
          start-placeholder="开始时间"
          end-placeholder="结束时间"
          :disabled="isLoading || isLoadingMore"
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
      <br>

      <!-- 导出选项区域 -->
      <NCard
        title="导出"
        size="small"
      >
        <NSpace>
          <NRadioGroup
            v-model:value="exportType"
            style="margin: 0 auto"
          >
            <NRadioButton value="csv">
              CSV
            </NRadioButton>
            <NRadioButton value="json">
              Json
            </NRadioButton>
          </NRadioGroup>
          <NButton
            type="primary"
            :disabled="selectedEvents.length === 0 || isLoading || isLoadingMore"
            @click="exportData"
          >
            导出{{ hasMore ? ' (已加载部分)' : ' (全部)' }}
          </NButton>
        </NSpace>
        <NText
          v-if="hasMore && selectedEvents.length > 0"
          type="warning"
          style="font-size: smaller; display: block; margin-top: 5px;"
        >
          当前仅显示已加载的部分数据，滚动到底部可加载更多。导出功能也仅导出已加载数据。
        </NText>
      </NCard>

      <NDivider>
        共加载 {{ selectedEvents.length }} 条 {{ hasMore ? '(滚动加载更多...)' : '' }}
      </NDivider>

      <!-- 数据展示区域 -->
      <NSpin :show="isLoading">
        <!-- 主 Spinner 只在初始加载时显示 -->
        <!-- 显示模式切换 -->
        <NRadioGroup
          v-model:value="displayMode"
          style="display: flex; justify-content: center"
          size="small"
        >
          <NRadioButton value="grid">
            <NIcon :component="Grid28Filled" />
          </NRadioButton>
          <NRadioButton value="column">
            <NIcon :component="List16Filled" />
          </NRadioButton>
        </NRadioGroup>
        <br>

        <!-- 数据展示区域 - 网格或表格 -->
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
              @load="loadMore"
            >
              <NGrid
                cols="1 500:2 800:3 1000:4 1200:5"
                :x-gap="12"
                :y-gap="8"
                style="min-height: 200px;"
              >
                <NGridItem
                  v-for="item in selectedEvents"
                  :key="`${item.time}_${item.uid}_${item.price}`"
                >
                  <NCard
                    size="small"
                    :style="`height: ${selectedType == EventDataTypes.Guard ? '175px' : '220px'}`"
                    embedded
                    hoverable
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
                        :size="64"
                        :src="item.uid ? AVATAR_URL + item.uid : item.uface"
                        :img-props="{ referrerpolicy: 'no-referrer' }"
                        style="box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2)"
                      />
                      <NSpace>
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
                        :depth="1"
                        style="font-weight: 500;"
                      >
                        <!-- 用户名加粗一点 -->
                        {{ item.uname }}
                      </NText>
                      <NText
                        depth="3"
                        style="font-size: small"
                      >
                        <NTime :time="item.time" />
                      </NText>
                      <NEllipsis
                        v-if="selectedType == EventDataTypes.SC"
                        :line-clamp="3"
                      >
                        <!-- SC 消息限制行数 -->
                        {{ item.msg }}
                      </NEllipsis>
                    </NSpace>
                  </NCard>
                </NGridItem>
              </NGrid>
              <!-- 加载更多指示器 -->
              <div
                v-if="isLoadingMore"
                style="text-align: center; padding: 10px;"
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
                style="text-align: center; padding: 10px;"
              >
                <NText depth="3">
                  没有更多数据了
                </NText>
              </div>
            </NInfiniteScroll>
          </div>

          <!-- 表格视图 (未应用无限滚动) -->
          <NTable v-else-if="!isLoading && selectedEvents.length > 0">
            <!-- 添加 v-else-if 避免初始加载时显示空表格 -->
            <thead>
              <tr>
                <th>用户名</th>
                <th>UId</th>
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
                <td>{{ item.uid }}</td>
                <td>
                  <NTime
                    :time="item.time"
                    format="yyyy-MM-dd HH:mm:ss"
                  /> <!-- 指定格式 -->
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
          <!-- 初始加载时或无数据时的提示 -->
          <NAlert
            v-else-if="!isLoading && selectedEvents.length === 0"
            title="无数据"
            type="info"
          >
            在选定的时间范围和类型内没有找到数据。
          </NAlert>
        </Transition>
      </NSpin>
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
