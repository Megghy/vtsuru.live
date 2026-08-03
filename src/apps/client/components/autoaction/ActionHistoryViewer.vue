<script setup lang="ts">
const CheckmarkCircle16Filled = 'i-lucide-circle'
const DismissCircle16Filled = 'i-lucide-circle'
import { h, onMounted, onUnmounted, ref, resolveComponent } from 'vue'

import type { HistoryItem } from '../../store/autoAction/utils/historyLogger'
import {
  clearAllHistory,
  clearHistory,
  getHistoryByType,
  HistoryType,
} from '../../store/autoAction/utils/historyLogger'

const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
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

const refreshInterval = 30000
let refreshTimer: number | null = null

// 列定义
const columns: any[] = [
  {
    title: '时间',
    key: 'timestamp',
    width: 160,
    sorter: (a: HistoryItem, b: HistoryItem) => a.timestamp - b.timestamp,
    render: (row: HistoryItem) => {
      return h(
        resolveComponent('UTooltip'),
        {},
        {
          trigger: () =>
            h('time', {
              time: row.timestamp,
              type: 'relative',
            }),
          default: () => new Date(row.timestamp).toLocaleString(),
        },
      )
    },
  },
  {
    title: '操作名称',
    key: 'actionName',
    width: 140,
    ellipsis: { tooltip: true },
    render: (row: HistoryItem) =>
      h(resolveComponent('UBadge'), { size: 'small', bordered: false }, { default: () => row.actionName || '未命名' }),
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
    render: (row: HistoryItem) =>
      row.target
        ? h(resolveComponent('UBadge'), { size: 'small', type: 'info', bordered: false }, { default: () => row.target })
        : '-',
  },
  {
    title: '状态',
    key: 'success',
    width: 100,
    align: 'center',
    render: (row: HistoryItem) => {
      if (row.success) {
        return h(
          resolveComponent('UTooltip'),
          { trigger: 'hover' },
          {
            trigger: () =>
              h(
                resolveComponent('UIcon'),
                { color: 'var(--vtsuru-success)', size: 20 },
                { default: () => h(CheckmarkCircle16Filled) },
              ),
            default: () => '执行成功',
          },
        )
      } else {
        return h(
          resolveComponent('UTooltip'),
          { trigger: 'hover' },
          {
            trigger: () =>
              h(
                resolveComponent('UIcon'),
                { color: 'var(--vtsuru-error)', size: 20 },
                { default: () => h(DismissCircle16Filled) },
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
      [HistoryType.DANMAKU]: danmakuHistory.toSorted((a, b) => b.timestamp - a.timestamp),
      [HistoryType.PRIVATE_MSG]: privateMsgHistory.toSorted((a, b) => b.timestamp - a.timestamp),
      [HistoryType.COMMAND]: commandHistory.toSorted((a, b) => b.timestamp - a.timestamp),
    }
  } catch (error) {
    console.error('加载历史数据失败:', error)
    feedback('error', '加载历史数据失败')
  } finally {
    loading.value = false
  }
}

// 清除历史
async function handleClearHistory(type: HistoryType) {
  try {
    await clearHistory(type)
    historyData.value[type] = []
    feedback('success', `已清空${typeNameMap[type]}历史`)
  } catch (error) {
    console.error('清除历史失败:', error)
    feedback('error', '清除历史失败')
  }
}

// 清除所有历史
async function handleClearAllHistory() {
  try {
    await clearAllHistory()
    Object.keys(historyData.value).forEach((type) => {
      historyData.value[type as HistoryType] = []
    })
    feedback('success', '已清空所有历史记录')
  } catch (error) {
    console.error('清除所有历史失败:', error)
    feedback('error', '清除所有历史失败')
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
  <UCard
    size="small"
    bordered
    :segmented="{ content: true }"
    class="history-viewer-card"
  >
    <template #header>
      <div align="center">
        <UIcon name="i-lucide-circle" />
        <span>执行历史记录</span>
      </div>
    </template>

    <template #header-extra>
      <div size="small">
        <UButton
          size="small"
          variant="ghost"
          :loading="loading"
          @click="loadHistory"
        >
          <template #leading>
            <UIcon name="i-lucide-circle" />
          </template>
          刷新
        </UButton>
        <UPopover>
          <UButton
            size="sm"
            color="error"
            variant="ghost"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            清空所有
          </UButton>
          <template #content="{ close }">
            <div class="space-y-3 p-3">
              <div>确定要清空所有类型的历史记录吗？此操作不可恢复。</div>
              <div class="flex justify-end gap-2">
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  @click="close"
                  >取消</UButton
                >
                <UButton
                  size="xs"
                  color="error"
                  @click="(close(), handleClearAllHistory)"
                  >确认</UButton
                >
              </div>
            </div>
          </template>
        </UPopover>
      </div>
    </template>

    <div>
      <UTabs
        v-model="activeTab"
        :items="Object.entries(typeNameMap).map(([value, label]) => ({ value, label }))"
        :content="false"
      />
      <section
        v-for="(label, type) in typeNameMap"
        :key="type"
        v-show="activeTab === type"
      >
        <div :show="loading">
          <div
            vertical
            :size="12"
          >
            <UTable
              :columns="columns"
              :data="historyData[type as HistoryType]"
              :bordered="false"
              :pagination="{
                pageIndex: 1,
                pageSize: 10,
              }"
              :row-key="(row) => row.id"
              default-sort-order="descend"
              size="small"
              scroll-x="800"
            >
              <template #empty>
                <UEmpty description="暂无历史记录" />
              </template>
            </UTable>

            <div
              v-if="historyData[type as HistoryType].length > 0"
              justify="end"
            >
              <UPopover>
                <UButton
                  size="xs"
                  color="warning"
                  variant="ghost"
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  清空{{ label }}历史
                </UButton>
                <template #content="{ close }">
                  <div class="space-y-3 p-3">
                    <div>确定要清空所有{{ label }}历史记录吗？此操作不可恢复。</div>
                    <div class="flex justify-end gap-2">
                      <UButton
                        size="xs"
                        color="neutral"
                        variant="ghost"
                        @click="close"
                        >取消</UButton
                      >
                      <UButton
                        size="xs"
                        color="warning"
                        @click="(close(), handleClearHistory(type as HistoryType))"
                        >确认</UButton
                      >
                    </div>
                  </div>
                </template>
              </UPopover>
            </div>
          </div>
        </div>
      </section>
    </div>
  </UCard>
</template>

<style scoped>
.history-viewer-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

:deep(.u-card__content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.u-tabs) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

:deep(.u-tab-pane) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.u-spin-container),
:deep(.u-spin-content) {
  height: 100%;
  display: flex;
  flex-direction: column;
}
</style>
