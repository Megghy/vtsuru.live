<script setup lang="ts">
import { useAccount } from '@/api/account'
import { GoodsTypes, PointOrderStatus, ResponsePointGoodModel, ResponsePointOrder2OwnerModel, ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { objectsToCSV } from '@/Utils'
import { useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  DataTableRowKey,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSpin,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import PointUserDetailCard from './PointUserDetailCard.vue'

// 订单筛选设置类型定义
type OrderFilterSettings = {
  type?: GoodsTypes       // 订单类型（实体/虚拟）
  status?: PointOrderStatus // 订单状态
  customer?: number       // 用户ID
  onlyRequireShippingInfo: boolean // 是否只显示需要物流信息的订单
}

const props = defineProps<{
  goods: ResponsePointGoodModel[]
}>()

// 默认筛选设置
const defaultSettings = {
  onlyRequireShippingInfo: false,
} as OrderFilterSettings

// 使用持久化存储保存筛选设置
const filterSettings = useStorage<OrderFilterSettings>('Setting.Point.OrderFilter', defaultSettings)

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
    return true
  })
})

const isLoading = ref(false)
const selectedItem = ref<DataTableRowKey[]>()
const targetStatus = ref<PointOrderStatus>()
const showStatusModal = ref(false)

// 获取所有订单
async function getOrders() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(POINT_API_URL + 'get-orders')
    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
    }
  } catch (err) {
    console.log(err)
    message.error('获取订单失败: ' + err)
  } finally {
    isLoading.value = false
  }
  return []
}

// 删除选中的订单
async function deleteOrder() {
  if (!selectedItem.value?.length) {
    message.warning('请选择要删除的订单')
    return
  }

  try {
    const data = await QueryPostAPI(POINT_API_URL + 'delete-orders', selectedItem.value)
    if (data.code == 200) {
      message.success('删除成功')
      orders.value = orders.value.filter((o) => !selectedItem.value?.includes(o.id))
      selectedItem.value = undefined
    } else {
      message.error('删除失败: ' + data.message)
    }
  } catch (err) {
    message.error('删除失败: ' + err)
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
    const requestData = {
      orderIds: selectedItem.value,
      status: targetStatus.value
    }

    const data = await QueryPostAPI<number[]>(POINT_API_URL + 'batch-update-order-status', requestData)
    if (data.code == 200) {
      message.success('更新成功')
      // 更新本地订单状态
      orders.value.forEach(order => {
        if (data.data.includes(order.id)) {
          order.status = targetStatus.value as PointOrderStatus
          order.updateAt = Date.now()
        }
      })
      targetStatus.value = undefined
      showStatusModal.value = false
    } else {
      message.error('更新失败: ' + data.message)
    }
  } catch (err) {
    message.error('更新失败: ' + err)
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
          礼物数量: s.count,
          礼物单价: gift?.price,
          礼物总价: s.point,
          快递公司: s.expressCompany,
          快递单号: s.trackingNumber,
          创建时间: format(s.createAt, 'yyyy-MM-dd HH:mm:ss'),
          更新时间: s.updateAt ? format(s.updateAt, 'yyyy-MM-dd HH:mm:ss') : '未更新',
        }
      }),
    )

    // 添加BOM标记，确保Excel正确识别UTF-8编码
    const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
    const utf8encoder = new TextEncoder()
    const utf8array = utf8encoder.encode(text)

    saveAs(
      new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
      `积分订单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
    )

    message.success('导出成功')
  } catch (error) {
    message.error('导出失败: ' + error)
    console.error('导出失败:', error)
  }
}

// 刷新订单数据
async function refresh() {
  orders.value = await getOrders()
}

onMounted(async () => {
  await refresh()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NEmpty
      v-if="orders.length == 0"
      description="暂无订单"
    />
    <template v-else>
      <!-- 操作按钮 -->
      <NFlex
        :wrap="false"
        justify="start"
        :gap="12"
        class="action-buttons"
      >
        <NButton @click="refresh">
          刷新
        </NButton>
        <NButton
          secondary
          type="info"
          @click="exportData"
        >
          导出数据
        </NButton>
      </NFlex>

      <NDivider />

      <!-- 筛选条件卡片 -->
      <NCard
        size="small"
        title="筛选订单"
      >
        <template #header-extra>
          <NButton
            size="small"
            type="warning"
            @click="filterSettings = JSON.parse(JSON.stringify(defaultSettings))"
          >
            重置
          </NButton>
        </template>
        <NFlex
          align="center"
          :wrap="true"
          :gap="8"
        >
          <NSelect
            v-model:value="filterSettings.type"
            :options="[
              { label: '实体', value: GoodsTypes.Physical },
              { label: '虚拟', value: GoodsTypes.Virtual },
            ]"
            clearable
            placeholder="订单类型"
            style="min-width: 120px; max-width: 150px"
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
            style="min-width: 120px; max-width: 150px"
          />
          <NSelect
            v-model:value="filterSettings.customer"
            :options="new List(orders)
              .DistinctBy((s) => s.customer.userId)
              .Select((s) => ({ label: s.customer.name, value: s.customer.userId }))
              .ToArray()
            "
            placeholder="用户"
            clearable
            style="min-width: 120px; max-width: 150px"
          />
          <NCheckbox v-model:checked="filterSettings.onlyRequireShippingInfo">
            仅包含未填写快递单号的订单
          </NCheckbox>
        </NFlex>
      </NCard>

      <NDivider title-placement="left">
        <NFlex
          :gap="8"
          :wrap="false"
        >
          <NPopconfirm @positive-click="deleteOrder">
            <template #trigger>
              <NButton
                size="tiny"
                type="error"
                :disabled="!selectedItem?.length"
              >
                删除选中的订单 | {{ selectedItem?.length ?? 0 }}
              </NButton>
            </template>
            确定删除吗?
          </NPopconfirm>

          <NPopconfirm @positive-click="openStatusUpdateModal">
            <template #trigger>
              <NButton
                size="tiny"
                type="info"
                :disabled="!selectedItem?.length"
              >
                批量更新状态
              </NButton>
            </template>
            确定要更新选中订单的状态吗?
          </NPopconfirm>
        </NFlex>
      </NDivider>

      <!-- 订单列表 -->
      <PointOrderCard
        :order="filteredOrders"
        type="owner"
        @selected-item="(items) => (selectedItem = items)"
      />

      <!-- 状态选择模态框 -->
      <NModal
        v-model:show="showStatusModal"
        title="选择目标状态"
        preset="card"
        style="max-width: 400px"
      >
        <NSpace vertical>
          <NText>请选择您想要将订单更新为的状态</NText>
          <NSelect
            v-model:value="targetStatus"
            :options="[
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
        </NSpace>
      </NModal>
    </template>
  </NSpin>
</template>

<style scoped>
.action-buttons {
  margin: 12px 0;
}
</style>
