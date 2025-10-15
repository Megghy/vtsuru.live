<script setup lang="ts">
import type { HistoryItem } from '../../store/autoAction/utils/historyLogger'

import { ArrowClockwise16Filled, CheckmarkCircle16Filled, Delete16Filled, DismissCircle16Filled } from '@vicons/fluent'
import {
  NButton,
  NDataTable,
  NEmpty,
  NIcon,
  NPopconfirm,
  NSpace,
  NSpin,
  NTabPane,
  NTabs,
  NTag,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import type { DataTableColumns } from 'naive-ui'

import { h, onMounted, onUnmounted, ref } from 'vue'
import { clearAllHistory, clearHistory, getHistoryByType, HistoryType } from '../../store/autoAction/utils/historyLogger'

const message = useMessage()
const loading = ref(true)
const activeTab = ref(HistoryType.DANMAKU)
const historyData = ref<Record<HistoryType, HistoryItem[]>>({
  [HistoryType.DANMAKU]: [],
  [HistoryType.PRIVATE_MSG]: [],
  [HistoryType.COMMAND]: [],
})

// 类型名称映射
const typeNameMap = {
  [HistoryType.DANMAKU]: '弹幕发送',
  [HistoryType.PRIVATE_MSG]: '私信发送',
  [HistoryType.COMMAND]: '命令执行',
}

// 刷新间隔（毫秒）
const refreshInterval = 10000
let refreshTimer: number | null = null

// 列定义
const columns: DataTableColumns<HistoryItem> = [
  {
    title: '时间',
    key: 'timestamp',
    width: 180,
    sorter: (a: HistoryItem, b: HistoryItem) => a.timestamp - b.timestamp,
    render: (row: HistoryItem) => {
      return h(NTooltip, {
      }, {
        trigger: () => h(NTime, {
          time: row.timestamp,
          type: 'relative',
        }),
        default: () => new Date(row.timestamp).toLocaleString(),
      })
    },
  },
  {
    title: '操作名称',
    key: 'actionName',
    width: 160,
  },
  {
    title: '内容',
    key: 'content',
    ellipsis: {
      tooltip: true,
    } as const,
  },
  {
    title: '目标',
    key: 'target',
    width: 120,
  },
  {
    title: '状态',
    key: 'success',
    width: 100,
    render: (row: HistoryItem) => {
      if (row.success) {
        return h(
          NTooltip,
          { trigger: 'hover' },
          {
            trigger: () => h(
              NTag,
              { type: 'success', size: 'small', round: true },
              { default: () => '成功', icon: () => h(NIcon, { component: CheckmarkCircle16Filled }) },
            ),
            default: () => '执行成功',
          },
        )
      } else {
        return h(
          NTooltip,
          { trigger: 'hover' },
          {
            trigger: () => h(
              NTag,
              { type: 'error', size: 'small', round: true },
              { default: () => '失败', icon: () => h(NIcon, { component: DismissCircle16Filled }) },
            ),
            default: () => row.error || '执行失败',
          },
        )
      }
    },
  },
]

// 加载历史数据
async function loadHistory() {
  loading.value = true
  try {
    // 并行加载所有类型的历史
    const [danmakuHistory, privateMsgHistory, commandHistory] = await Promise.all([
      getHistoryByType(HistoryType.DANMAKU),
      getHistoryByType(HistoryType.PRIVATE_MSG),
      getHistoryByType(HistoryType.COMMAND),
    ])

    historyData.value = {
      [HistoryType.DANMAKU]: danmakuHistory.sort((a, b) => b.timestamp - a.timestamp),
      [HistoryType.PRIVATE_MSG]: privateMsgHistory.sort((a, b) => b.timestamp - a.timestamp),
      [HistoryType.COMMAND]: commandHistory.sort((a, b) => b.timestamp - a.timestamp),
    }
  } catch (error) {
    console.error('加载历史数据失败:', error)
    message.error('加载历史数据失败')
  } finally {
    loading.value = false
  }
}

// 清除历史
async function handleClearHistory(type: HistoryType) {
  try {
    await clearHistory(type)
    historyData.value[type] = []
    message.success(`已清空${typeNameMap[type]}历史`)
  } catch (error) {
    console.error('清除历史失败:', error)
    message.error('清除历史失败')
  }
}

// 清除所有历史
async function handleClearAllHistory() {
  try {
    await clearAllHistory()
    Object.keys(historyData.value).forEach((type) => {
      historyData.value[type as HistoryType] = []
    })
    message.success('已清空所有历史记录')
  } catch (error) {
    console.error('清除所有历史失败:', error)
    message.error('清除所有历史失败')
  }
}

// 开始定时刷新
function startRefreshTimer() {
  stopRefreshTimer()
  refreshTimer = window.setInterval(() => {
    loadHistory()
  }, refreshInterval)
}

// 停止定时刷新
function stopRefreshTimer() {
  if (refreshTimer !== null) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

onMounted(() => {
  loadHistory()
  startRefreshTimer()
})

onUnmounted(() => {
  stopRefreshTimer()
})
</script>

<template>
  <div class="history-viewer">
    <NSpace vertical>
      <NSpace justify="space-between">
        <div class="history-title">
          操作执行历史
        </div>
        <NSpace>
          <NButton
            size="small"
            :loading="loading"
            @click="loadHistory"
          >
            <template #icon>
              <NIcon :component="ArrowClockwise16Filled" />
            </template>
            刷新
          </NButton>
          <NPopconfirm
            placement="bottom"
            @positive-click="handleClearAllHistory"
          >
            <template #trigger>
              <NButton
                size="small"
                type="error"
                ghost
              >
                <template #icon>
                  <NIcon :component="Delete16Filled" />
                </template>
                清空所有历史
              </NButton>
            </template>
            确定要清空所有类型的历史记录吗？此操作不可恢复。
          </NPopconfirm>
        </NSpace>
      </NSpace>

      <NTabs
        v-model:value="activeTab"
        type="line"
        animated
      >
        <NTabPane
          v-for="(label, type) in typeNameMap"
          :key="type"
          :name="type"
          :tab="label"
        >
          <NSpin :show="loading">
            <NSpace vertical>
              <NSpace justify="end">
                <NPopconfirm
                  placement="bottom"
                  @positive-click="() => handleClearHistory(type as HistoryType)"
                >
                  <template #trigger>
                    <NButton
                      size="small"
                      type="warning"
                      ghost
                    >
                      <template #icon>
                        <NIcon :component="Delete16Filled" />
                      </template>
                      清空{{ label }}历史
                    </NButton>
                  </template>
                  确定要清空所有{{ label }}历史记录吗？此操作不可恢复。
                </NPopconfirm>
              </NSpace>

              <NDataTable
                :columns="columns"
                :data="historyData[type as HistoryType]"
                :bordered="false"
                :pagination="{
                  pageSize: 10,
                  showSizePicker: true,
                  pageSizes: [10, 20, 50],
                }"
                :row-key="row => row.id"
                default-sort-order="descend"
              >
                <template #empty>
                  <NEmpty description="暂无历史记录" />
                </template>
              </NDataTable>
            </NSpace>
          </NSpin>
        </NTabPane>
      </NTabs>
    </NSpace>
  </div>
</template>

<style scoped>
.history-viewer {
  width: 100%;
}

.history-title {
  font-size: 16px;
  font-weight: 500;
}
</style>
