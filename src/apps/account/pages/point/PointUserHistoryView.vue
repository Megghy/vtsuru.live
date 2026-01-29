<script setup lang="ts">
import type { ResponsePointHisrotyModel } from '@/api/api-models'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { ArrowSync24Regular, ArrowDownload24Regular } from '@vicons/fluent'
import { NButton, NDatePicker, NEmpty, NFlex, NGrid, NIcon, NRadioButton, NRadioGroup, NSelect, NSpin, useMessage } from 'naive-ui';
import { computed, onMounted, ref } from 'vue'
import { PointFrom } from '@/api/api-models'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import { POINT_API_URL } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'
import { objectsToCSV } from '@/shared/utils'

// 定义加载完成的事件
const emit = defineEmits(['dataLoaded'])
const message = useMessage()
const useAuth = useBiliAuth()
const isLoading = ref(false)

const history = ref<ResponsePointHisrotyModel[]>([])
const streamerFilter = ref<string | null>('')
const pointTypeFilter = ref<'all' | 'increase' | 'decrease'>('all')
const dateRange = ref<[number, number] | null>(null)

// 获取积分历史记录
async function getHistories() {
  try {
    isLoading.value = true
    const data = await useAuth.QueryBiliAuthGetAPI<ResponsePointHisrotyModel[]>(`${POINT_API_URL}user/get-histories`)
    if (data.code == 200) {
      console.log('[point] 已获取积分历史')
      history.value = data.data
      // 触发数据加载完成事件
      emit('dataLoaded')
      return data.data
    } else {
      message.error(`获取积分历史失败: ${data.message}`)
      console.error(data)
    }
  } catch (err) {
    message.error(`获取积分历史失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }
  return []
}

// 提供给父组件调用的重置方法
function reset() {
  history.value = []
  streamerFilter.value = ''
}

// 暴露方法给父组件
defineExpose({
  getHistories,
  reset,
})

onMounted(async () => {
  history.value = await getHistories()
})

// 根据主播名称筛选历史记录
const filteredHistory = computed(() => {
  let result = history.value

  // 主播筛选
  if (streamerFilter.value && streamerFilter.value !== '') {
    result = result.filter((item) => {
      // 统一按 extra.user.name 进行匹配（Use 也带 user），避免筛选时仍混入其它主播的消耗记录
      return item.extra?.user?.name === streamerFilter.value
    })
  }

  // 积分类型筛选
  if (pointTypeFilter.value === 'increase') {
    result = result.filter(h => h.point > 0)
  } else if (pointTypeFilter.value === 'decrease') {
    result = result.filter(h => h.point < 0)
  }

  // 时间范围筛选
  if (dateRange.value && dateRange.value[0] && dateRange.value[1]) {
    result = result.filter(h => h.createAt >= dateRange.value![0] && h.createAt <= dateRange.value![1])
  }

  return result
})

// 积分历史统计（跟随筛选条件）
const historyStats = computed(() => {
  const totalIncrease = filteredHistory.value.filter(h => h.point > 0).reduce((sum, h) => sum + h.point, 0)
  const totalDecrease = Math.abs(filteredHistory.value.filter(h => h.point < 0).reduce((sum, h) => sum + h.point, 0))
  return {
    total: filteredHistory.value.length,
    totalIncrease: Number(totalIncrease.toFixed(1)),
    totalDecrease: Number(totalDecrease.toFixed(1)),
    netIncrease: Number((totalIncrease - totalDecrease).toFixed(1)),
    fromManual: filteredHistory.value.filter(h => h.from === PointFrom.Manual).length,
    fromDanmaku: filteredHistory.value.filter(h => h.from === PointFrom.Danmaku).length,
    fromCheckIn: filteredHistory.value.filter(h => h.from === PointFrom.CheckIn).length,
    fromUse: filteredHistory.value.filter(h => h.from === PointFrom.Use).length,
  }
})

// 计算可选的主播列表
const streamerOptions = computed(() => {
  const names = new Set<string>()
  history.value.forEach((item) => {
    if ([PointFrom.Manual, PointFrom.Danmaku, PointFrom.CheckIn].includes(item.from) && item.extra?.user?.name) {
      names.add(item.extra.user.name)
    }
  })
  // 添加"全部主播"选项
  const options = [{ label: '全部主播', value: '' }]
  names.forEach((name) => {
    options.push({ label: name, value: name })
  })
  return options
})

// 导出积分历史数据
function exportHistoryData() {
  try {
    const pointFromText = {
      [PointFrom.Manual]: '手动调整',
      [PointFrom.Danmaku]: '弹幕',
      [PointFrom.CheckIn]: '签到',
      [PointFrom.Use]: '使用积分',
    }

    const text = objectsToCSV(
      filteredHistory.value.map((item) => {
        return {
          时间: format(item.createAt, 'yyyy-MM-dd HH:mm:ss'),
          积分变化: Number(item.point.toFixed(1)),
          来源: pointFromText[item.from] || '未知',
          主播: item.extra?.user?.name || '-',
          款式: (item.extra?.selectedSubItems ?? []).map(s => `${s.nameSnapshot} x ${s.quantity}`).join('; ') || '-',
          数量: item.count || '-',
          备注: item.extra?.reason || '-',
        }
      }),
    )

    // 添加BOM标记，确保Excel正确识别UTF-8编码
    const BOM = new Uint8Array([0xEF, 0xBB, 0xBF])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `积分历史_${format(Date.now(), 'yyyy-MM-dd_HH-mm-ss')}.csv`,
    )

    message.success('导出成功')
  } catch (error) {
    message.error(`导出失败: ${error}`)
    console.error('导出失败:', error)
  }
}
</script>

<template>
  <NSpin :show="isLoading">
    <!-- 统计卡片 -->
    <NGrid
      cols="2 600:4"
      :x-gap="12"
      :y-gap="12"
      style="margin-bottom: 16px"
    >
      <div class="stat-card">
        <div class="stat-label">
          总记录
        </div>
        <div class="stat-value">
          {{ historyStats.total }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          总获得
        </div>
        <div class="stat-value success">
          +{{ historyStats.totalIncrease }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          总消耗
        </div>
        <div class="stat-value error">
          -{{ historyStats.totalDecrease }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">
          净增加
        </div>
        <div class="stat-value primary">
          {{ historyStats.netIncrease }}
        </div>
      </div>
    </NGrid>

    <!-- 工具栏 -->
    <div class="toolbar-section">
      <NFlex vertical :gap="12">
        <!-- 筛选行 -->
        <NFlex justify="space-between" align="center" wrap :gap="12">
          <NFlex align="center" :gap="12" wrap>
            <NSelect
              v-model:value="streamerFilter"
              :options="streamerOptions"
              placeholder="按主播筛选"
              clearable
              size="medium"
              style="min-width: 140px; max-width: 200px"
            />
            <NRadioGroup
              v-model:value="pointTypeFilter"
              size="medium"
            >
              <NRadioButton value="all">
                全部
              </NRadioButton>
              <NRadioButton value="increase">
                增加
              </NRadioButton>
              <NRadioButton value="decrease">
                减少
              </NRadioButton>
            </NRadioGroup>
            <NDatePicker
              v-model:value="dateRange"
              type="datetimerange"
              clearable
              size="medium"
              style="max-width: 360px"
              placeholder="选择时间范围"
            />
          </NFlex>

          <NFlex :gap="8">
            <NButton secondary size="medium" type="info" @click="exportHistoryData">
              <template #icon>
                <NIcon :component="ArrowDownload24Regular" />
              </template>
              导出
            </NButton>
            <NButton secondary size="medium" @click="getHistories">
              <template #icon>
                <NIcon :component="ArrowSync24Regular" />
              </template>
              刷新
            </NButton>
          </NFlex>
        </NFlex>
      </NFlex>
    </div>

    <div style="margin-top: 16px;" />

    <NEmpty
      v-if="filteredHistory.length === 0"
      description="暂无符合条件的积分记录"
    />
    <PointHistoryCard
      v-else
      :histories="filteredHistory"
    />
  </NSpin>
</template>

<style scoped>
.stat-card {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  transition: all 0.3s var(--n-bezier);
}

.stat-card:hover {
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 1px var(--n-primary-color) inset;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--n-text-color);
}

.stat-label {
  font-size: 13px;
  color: var(--n-text-color-3);
}

.stat-value.primary { color: var(--n-primary-color); }
.stat-value.success { color: var(--n-success-color); }
.stat-value.error { color: var(--n-error-color); }

.toolbar-section {
  background-color: var(--n-card-color);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  padding: 12px 16px;
}

@media (max-width: 768px) {
  .stat-value {
    font-size: 20px;
  }
}
</style>
