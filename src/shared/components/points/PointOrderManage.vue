<script setup lang="ts">
import type {
  DataTableRowKey,
} from 'naive-ui'
import type { ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  NButton, NCheckbox, NDivider, NEmpty, NFlex, NGrid, NIcon, NModal, NPopconfirm, NSelect, NSpin, NText, useMessage
} from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { GoodsTypes, PointOrderStatus } from '@/api/api-models'
import { fetchOwnerOrders, updateOrdersStatus } from '@/api/point-orders'
import { QueryPostAPI } from '@/api/query'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { POINT_API_URL } from '@/shared/config'
import { objectsToCSV } from '@/shared/utils'
import { ArrowSync24Regular, ArrowDownload24Regular, Delete24Regular, Edit24Regular, Filter24Regular } from '@vicons/fluent'
import { usePersistedStorage } from '@/shared/storage/persist'

// 订单筛选设置类型定义
interface OrderFilterSettings {
  type?: GoodsTypes // 订单类型（实体/虚拟）
  status?: PointOrderStatus // 订单状态
  customer?: number // 用户ID
  streamerId?: number // 主播ID（仅组织订单）
  onlyRequireShippingInfo: boolean // 是否只显示需要物流信息的订单
}

const props = defineProps<{
  goods?: ResponsePointGoodModel[]
  orgId?: number
  streamerOptions?: { label: string, value: number }[]
}>()

// 默认筛选设置
const defaultSettings = {
  onlyRequireShippingInfo: false,
} as OrderFilterSettings

// 使用持久化存储保存筛选设置
const filterKey = computed(() => (props.orgId
  ? `vtsuru:setting:point:order-filter:org-${props.orgId}`
  : 'vtsuru:setting:point:order-filter:owner'))
const filterSettings = usePersistedStorage<OrderFilterSettings>(filterKey, defaultSettings)

watch(
  () => filterSettings.value.streamerId,
  () => {
    if (props.orgId) {
      refresh()
    }
  },
)

watch(
  () => filterSettings.value.customer,
  () => {
    if (props.orgId) {
      refresh()
    }
  },
)

const message = useMessage()
const accountInfo = useAccount()

// 订单数据
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
// 根据筛选条件过滤后的订单
const filteredOrders = computed(() => {
  return orders.value.filter((o) => {
    if (filterSettings.value.type != undefined && o.type !== filterSettings.value.type) return false
    if (filterSettings.value.status != undefined && o.status !== filterSettings.value.status) return false
    if (filterSettings.value.onlyRequireShippingInfo && o.trackingNumber) return false
    if (filterSettings.value.customer && o.customer.userId != filterSettings.value.customer) return false
    if (props.orgId && filterSettings.value.streamerId && o.vTsuruId !== filterSettings.value.streamerId) return false
    return true
  })
})

const isLoading = ref(false)
const selectedItem = ref<DataTableRowKey[]>()
const targetStatus = ref<PointOrderStatus>()
const showStatusModal = ref(false)

// 订单统计
const orderStats = computed(() => {
  return {
    total: orders.value.length,
    pending: orders.value.filter(o => o.status === PointOrderStatus.Pending).length,
    shipped: orders.value.filter(o => o.status === PointOrderStatus.Shipped).length,
    completed: orders.value.filter(o => o.status === PointOrderStatus.Completed).length,
    physical: orders.value.filter(o => o.type === GoodsTypes.Physical).length,
    virtual: orders.value.filter(o => o.type === GoodsTypes.Virtual).length,
    totalPoints: Number(orders.value.reduce((sum, o) => sum + o.point, 0).toFixed(1)),
    filteredCount: filteredOrders.value.length,
  }
})

// 获取所有订单
// 删除选中的订单
async function deleteOrder() {
  if (props.orgId) {
    message.warning('组织订单暂不支持删除')
    return
  }
  if (!selectedItem.value?.length) {
    message.warning('请选择要删除的订单')
    return
  }

  try {
    const data = await QueryPostAPI(`${POINT_API_URL}delete-orders`, selectedItem.value)
    if (data.code == 200) {
      message.success('删除成功')
      orders.value = orders.value.filter(o => !selectedItem.value?.includes(o.id))
      selectedItem.value = undefined
    } else {
      message.error(`删除失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`删除失败: ${err}`)
    console.log(err)
  }
}

// 打开状态更新模态框
function openStatusUpdateModal() {
  if (!selectedItem.value?.length) {
    message.warning('请选择要更新的订单')
    return
  }
  showStatusModal.value = true
}

// 批量更新订单状态
async function batchUpdateOrderStatus() {
  if (!selectedItem.value?.length) {
    message.warning('请选择要更新的订单')
    return
  }

  if (targetStatus.value === undefined) {
    message.warning('请选择目标状态')
    return
  }

  try {
    await updateOrdersStatus(
      props.orgId ? { kind: 'org', orgId: props.orgId } : { kind: 'owner' },
      (selectedItem.value as number[]) ?? [],
      targetStatus.value,
    )
    message.success('更新成功')
    const updated = new Set<number>((selectedItem.value as number[]) ?? [])
    orders.value.forEach((order) => {
      if (updated.has(Number(order.id))) {
        order.status = targetStatus.value as PointOrderStatus
        order.updateAt = Date.now()
      }
    })
    targetStatus.value = undefined
    showStatusModal.value = false
  } catch (err) {
    message.error(err instanceof Error ? err.message : `更新失败: ${err}`)
    console.log(err)
  }
}

// 订单状态文本映射
const statusText = {
  [PointOrderStatus.Completed]: '已完成',
  [PointOrderStatus.Pending]: '等待发货',
  [PointOrderStatus.Shipped]: '已发货',
}

// 导出订单数据为CSV
function exportData() {
  try {
    const text = objectsToCSV(
      filteredOrders.value.map((s) => {
        const gift = s.goods
        return {
          订单号: s.id,
          订单类型: s.type == GoodsTypes.Physical ? '实体' : '虚拟',
          订单状态: statusText[s.status],
          用户名: s.customer.name ?? '未知',
          用户UID: s.customer.userId,
          联系人: s.address?.name,
          联系电话: s.address?.phone,
          地址: s.address
            ? `${s.address?.province}省${s.address?.city}市${s.address?.district}区${s.address?.street}街道${s.address?.address}`
            : '无',
          礼物名: gift?.name ?? '已删除',
          款式: (s.selectedSubItems ?? []).map(sub => `${sub.nameSnapshot} x ${sub.quantity}`).join('; ') || '-',
          礼物数量: s.count,
          礼物单价: gift?.price ? Number(gift.price.toFixed(1)) : 0,
          礼物总价: Number(s.point.toFixed(1)),
          快递公司: s.expressCompany,
          快递单号: s.trackingNumber,
          备注: s.remark ?? '',
          创建时间: format(s.createAt, 'yyyy-MM-dd HH:mm:ss'),
          更新时间: s.updateAt ? format(s.updateAt, 'yyyy-MM-dd HH:mm:ss') : '未更新',
        }
      }),
    )

    // 添加BOM标记，确保Excel正确识别UTF-8编码
    const BOM = new Uint8Array([0xEF, 0xBB, 0xBF])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `积分订单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
    )

    message.success('导出成功')
  } catch (error) {
    message.error(`导出失败: ${error}`)
    console.error('导出失败:', error)
  }
}

// 刷新订单数据
async function refresh() {
  orders.value = await fetchOwnerOrders(
    props.orgId
      ? {
          kind: 'org',
          orgId: props.orgId,
          streamerId: filterSettings.value.streamerId,
          customer: filterSettings.value.customer,
        }
      : { kind: 'owner' },
  )
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NEmpty
      v-if="orders.length === 0"
      description="暂无订单"
    />
    <template v-else>
      <!-- 统计卡片 -->
      <NGrid
        cols="2 600:3 900:6"
        :x-gap="12"
        :y-gap="12"
        style="margin-bottom: 16px"
      >
        <div class="stat-card">
          <div class="stat-label">
            总订单
          </div>
          <div class="stat-value">
            {{ orderStats.total }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">
            待发货
          </div>
          <div class="stat-value warning">
            {{ orderStats.pending }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">
            已发货
          </div>
          <div class="stat-value info">
            {{ orderStats.shipped }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">
            已完成
          </div>
          <div class="stat-value success">
            {{ orderStats.completed }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">
            实体 / 虚拟
          </div>
          <div class="stat-value">
            {{ orderStats.physical }} / {{ orderStats.virtual }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">
            总积分
          </div>
          <div class="stat-value primary">
            {{ orderStats.totalPoints }}
          </div>
        </div>
      </NGrid>

      <!-- 工具栏区域 -->
      <div class="toolbar-section">
        <NFlex vertical :gap="12">
          <!-- 筛选行 -->
          <NFlex justify="space-between" align="center" wrap :gap="12">
            <NFlex align="center" :gap="12" wrap>
              <NSelect
                v-if="orgId && streamerOptions?.length"
                v-model:value="filterSettings.streamerId"
                :options="streamerOptions"
                placeholder="主播"
                clearable
                size="medium"
                style="min-width: 140px; max-width: 220px"
              />
              <NSelect
                v-model:value="filterSettings.type"
                :options="[
                  { label: '实体订单', value: GoodsTypes.Physical },
                  { label: '虚拟订单', value: GoodsTypes.Virtual },
                ]"
                clearable
                placeholder="订单类型"
                size="medium"
                style="min-width: 140px"
              />
              <NSelect
                v-model:value="filterSettings.status"
                :options="[
                  { label: '已完成', value: PointOrderStatus.Completed },
                  { label: '等待发货', value: PointOrderStatus.Pending },
                  { label: '已发货', value: PointOrderStatus.Shipped },
                ]"
                placeholder="订单状态"
                clearable
                size="medium"
                style="min-width: 140px"
              />
              <NSelect
                v-model:value="filterSettings.customer"
                :options="new List(orders)
                  .DistinctBy((s) => s.customer.userId)
                  .Select((s) => ({ label: s.customer.name, value: s.customer.userId }))
                  .ToArray()
                "
                placeholder="按用户筛选"
                filterable
                clearable
                size="medium"
                style="min-width: 160px; max-width: 240px"
              />
              <NCheckbox v-model:checked="filterSettings.onlyRequireShippingInfo">
                仅未填单号
              </NCheckbox>
            </NFlex>

            <NButton
              secondary
              size="medium"
              type="warning"
              @click="filterSettings = JSON.parse(JSON.stringify(defaultSettings))"
            >
              <template #icon>
                <NIcon :component="Filter24Regular" />
              </template>
              重置筛选
            </NButton>
          </NFlex>
          
          <NDivider style="margin: 0" />

          <!-- 操作行 -->
          <NFlex justify="space-between" align="center" wrap :gap="12">
            <NFlex :gap="12">
              <NButton secondary size="medium" @click="refresh">
                <template #icon>
                  <NIcon :component="ArrowSync24Regular" />
                </template>
                刷新
              </NButton>
              <NButton
                secondary
                type="info"
                size="medium"
                @click="exportData"
              >
                <template #icon>
                  <NIcon :component="ArrowDownload24Regular" />
                </template>
                导出数据
              </NButton>
            </NFlex>

            <NFlex :gap="12">
              <NPopconfirm @positive-click="openStatusUpdateModal">
                <template #trigger>
                  <NButton
                    size="medium"
                    type="info"
                    :disabled="!selectedItem?.length"
                  >
                    <template #icon>
                      <NIcon :component="Edit24Regular" />
                    </template>
                    批量更新状态 ({{ selectedItem?.length ?? 0 }})
                  </NButton>
                </template>
                确定要更新选中订单的状态吗?
              </NPopconfirm>

              <NPopconfirm v-if="!orgId" @positive-click="deleteOrder">
                <template #trigger>
                  <NButton
                    size="medium"
                    type="error"
                    :disabled="!selectedItem?.length"
                  >
                    <template #icon>
                      <NIcon :component="Delete24Regular" />
                    </template>
                    批量删除 ({{ selectedItem?.length ?? 0 }})
                  </NButton>
                </template>
                确定删除吗?
              </NPopconfirm>
            </NFlex>
          </NFlex>
        </NFlex>
      </div>

      <NDivider style="margin: 16px 0" />

      <!-- 订单列表 -->
      <PointOrderCard
        :order="filteredOrders"
        type="owner"
        :org-id="orgId"
        @selected-item="(items) => (selectedItem = items)"
      />

      <!-- 状态选择模态框 -->
      <NModal
        v-model:show="showStatusModal"
        title="选择目标状态"
        preset="card"
        style="max-width: 400px"
      >
        <NFlex vertical>
          <NText>请选择您想要将订单更新为的状态</NText>
          <NSelect
            v-model:value="targetStatus"
            :options=" [
              { label: '已完成', value: PointOrderStatus.Completed },
              { label: '等待发货', value: PointOrderStatus.Pending },
              { label: '已发货', value: PointOrderStatus.Shipped },
            ]"
            placeholder="选择状态"
            style="width: 100%"
          />
          <NFlex
            justify="end"
            :gap="12"
          >
            <NButton @click="showStatusModal = false">
              取消
            </NButton>
            <NButton
              type="primary"
              :disabled="targetStatus === undefined"
              @click="batchUpdateOrderStatus"
            >
              确认更新
            </NButton>
          </NFlex>
        </NFlex>
      </NModal>
    </template>
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
.stat-value.info { color: var(--n-info-color); }
.stat-value.warning { color: var(--n-warning-color); }

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
