<script setup lang="ts">
import { useAccount } from '@/api/account'
import { GoodsTypes, PointOrderStatus, ResponsePointGoodModel, ResponsePointOrder2OwnerModel } from '@/api/api-models'
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
  NPopconfirm,
  NSelect,
  NSpin,
  useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'

type OrderFilterSettings = {
  type?: GoodsTypes
  status?: PointOrderStatus
  customer?: number
  onlyRequireShippingInfo: boolean
}

const props = defineProps<{
  goods: ResponsePointGoodModel[]
}>()
const defaultSettings = {
  onlyRequireShippingInfo: false,
} as OrderFilterSettings
const filterSettings = useStorage<OrderFilterSettings>('Setting.Point.OrderFilter', defaultSettings)

const message = useMessage()
const accountInfo = useAccount()

const orders = ref<ResponsePointOrder2OwnerModel[]>([])
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
async function deleteOrder() {
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
const statusText = {
  [PointOrderStatus.Completed]: '已完成',
  [PointOrderStatus.Pending]: '等待发货',
  [PointOrderStatus.Shipped]: '已发货',
}
function exportData() {
  const text = objectsToCSV(
    filteredOrders.value.map((s) => {
      const gift = props.goods.find((g) => g.id == s.goodsId)
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
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8encoder = new TextEncoder()
  const utf8array = utf8encoder.encode(text)
  saveAs(
    new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }),
    `积分订单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`,
  )
}
async function refresh() {
  orders.value = await getOrders()
}

onMounted(async () => {
  orders.value = await getOrders()
})
</script>

<template>
  <NSpin :show="isLoading">
    <NEmpty v-if="orders.length == 0" description="暂无订单"></NEmpty>
    <template v-else>
      <br />
      <NFlex>
        <NButton @click="refresh">刷新</NButton>
        <NButton @click="exportData" secondary type="info">导出数据</NButton>
      </NFlex>
      <NDivider />
      <NCard size="small" title="筛选订单">
        <template #header-extra>
          <NButton @click="filterSettings = JSON.parse(JSON.stringify(defaultSettings))" size="small" type="warning">
            重置
          </NButton>
        </template>
        <NFlex align="center">
          <NSelect
            v-model:value="filterSettings.type"
            :options="[
              { label: '实体', value: GoodsTypes.Physical },
              { label: '虚拟', value: GoodsTypes.Virtual },
            ]"
            clearable
            placeholder="订单类型"
            style="width: 150px"
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
            style="width: 150px"
          />

          <NSelect
            v-model:value="filterSettings.customer"
            :options="
              new List(orders)
                .DistinctBy((s) => s.customer.userId)
                .Select((s) => ({ label: s.customer.name, value: s.customer.userId }))
                .ToArray()
            "
            placeholder="用户"
            clearable
            style="width: 150px"
          />
          <NCheckbox v-model:checked="filterSettings.onlyRequireShippingInfo" label="仅包含未填写快递单号的订单" />
        </NFlex>
      </NCard>
      <NDivider v-if="(selectedItem?.length ?? 0) == 0" title-placement="left" />
      <NDivider v-else title-placement="left">
        <NPopconfirm @positive-click="deleteOrder">
          <template #trigger>
            <NButton size="tiny" type="error"> 删除选中的订单 | {{ selectedItem?.length }} </NButton>
          </template>
          确定删除吗?
        </NPopconfirm>
      </NDivider>
      <PointOrderCard @selected-item="items => selectedItem = items" :order="filteredOrders" :goods="goods" type="owner" />
    </template>
  </NSpin>
</template>
