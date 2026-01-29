<script setup lang="ts">
import type { HistoryItem } from '../../store/autoAction/utils/historyLogger'

import { ArrowClockwise16Filled, CheckmarkCircle16Filled, Delete16Filled, DismissCircle16Filled, History16Regular } from '@vicons/fluent'
import {
  NButton, NCard, NDataTable, NEmpty, NIcon, NPopconfirm, NFlex, NSpin, NTabPane, NTabs, NTag, NTime, NTooltip, useMessage } from 'naive-ui';
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
    width: 160,
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
    width: 140,
    ellipsis: { tooltip: true },
    render: (row: HistoryItem) => h(NTag, { size: 'small', bordered: false }, { default: () => row.actionName || '未命名' })
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
    ellipsis: { tooltip: true },
    render: (row: HistoryItem) => row.target ? h(NTag, { size: 'small', type: 'info', bordered: false }, { default: () => row.target }) : '-'
  },
  {
    title: '状态',
    key: 'success',
    width: 100,
    align: 'center',
    render: (row: HistoryItem) => {
      if (row.success) {
        return h(
          NTooltip,
          { trigger: 'hover' },
          {
            trigger: () => h(
              NIcon,
              { color: 'var(--n-success-color)', size: 20 },
              { default: () => h(CheckmarkCircle16Filled) }
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
              NIcon,
              { color: 'var(--n-error-color)', size: 20 },
              { default: () => h(DismissCircle16Filled) }
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
  <NCard
    size="small"
    bordered
    :segmented="{ content: true }"
    class="history-viewer-card"
  >
    <template #header>
      <NFlex align="center">
        <NIcon :component="History16Regular" />
        <span>执行历史记录</span>
      </NFlex>
    </template>
    
    <template #header-extra>
      <NFlex size="small">
        <NButton
          size="small"
          quaternary
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
              quaternary
            >
              <template #icon>
                <NIcon :component="Delete16Filled" />
              </template>
              清空所有
            </NButton>
          </template>
          确定要清空所有类型的历史记录吗？此操作不可恢复。
        </NPopconfirm>
      </NFlex>
    </template>

    <NTabs
      v-model:value="activeTab"
      type="line"
      animated
      pane-style="padding: 12px 0 0 0;"
    >
      <NTabPane
        v-for="(label, type) in typeNameMap"
        :key="type"
        :name="type"
        :tab="label"
      >
        <NSpin :show="loading">
          <NFlex vertical :size="12">
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
              size="small"
              scroll-x="800"
            >
              <template #empty>
                <NEmpty description="暂无历史记录" />
              </template>
            </NDataTable>
            
            <NFlex v-if="historyData[type as HistoryType].length > 0" justify="end">
              <NPopconfirm
                placement="bottom"
                @positive-click="() => handleClearHistory(type as HistoryType)"
              >
                <template #trigger>
                  <NButton
                    size="tiny"
                    type="warning"
                    quaternary
                  >
                    <template #icon>
                      <NIcon :component="Delete16Filled" />
                    </template>
                    清空{{ label }}历史
                  </NButton>
                </template>
                确定要清空所有{{ label }}历史记录吗？此操作不可恢复。
              </NPopconfirm>
            </NFlex>
          </NFlex>
        </NSpin>
      </NTabPane>
    </NTabs>
  </NCard>
</template>

<style scoped>
.history-viewer-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.n-card__content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.n-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.n-tab-pane) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.n-spin-container), :deep(.n-spin-content) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
