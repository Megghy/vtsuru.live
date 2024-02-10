<script setup lang="ts">
import {
  GoodsTypes,
  PointOrderStatus,
  ResponsePointGoodModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointOrder2UserModel,
} from '@/api/api-models'
import {
  DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NFlex,
  NIcon,
  NInput,
  NModal,
  NScrollbar,
  NTag,
  NText,
  NTime,
  NTooltip,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import AddressDisplay from './AddressDisplay.vue'
import PointGoodsItem from './PointGoodsItem.vue'
import { Info24Filled } from '@vicons/fluent'

const props = defineProps<{
  order: ResponsePointOrder2UserModel[] | ResponsePointOrder2OwnerModel[]
  type: 'user' | 'owner'
  goods?: ResponsePointGoodModel[]
  loading?: boolean
}>()
const isLoading = ref(false)
watch(
  () => props.loading,
  () => {
    isLoading.value = props.loading
  },
)
const orderAsUser = computed(() => {
  return props.order as ResponsePointOrder2UserModel[]
})
const orderAsOwner = computed(() => {
  return props.order as ResponsePointOrder2OwnerModel[]
})

const showDetailModal = ref(false)
const orderDetail = ref<ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel>()
const currentGoods = computed(() => {
  //@ts-ignore
  if (props.type == 'user') return orderDetail.value.goods
  //@ts-ignore
  else return props.goods.find((g) => g.id == orderDetail.value.goodsId)
})

const orderColumn: DataTableColumns<ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel> = [
  {
    title: '订单号',
    key: 'id',
  },
  {
    title: '时间',
    key: 'time',
    sorter: 'default',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return h(NTime, { time: row.createAt })
    },
  },
  {
    title: '使用积分',
    key: 'point',
  },
  {
    title: '订单状态',
    key: 'status',
    sorter: 'default',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      switch (row.status) {
        case PointOrderStatus.Pending:
          return h(NTag, { size: 'small' }, () => '等待发货')
        case PointOrderStatus.Shipped:
          return h(NTag, { size: 'small', type: 'info' }, () => '已发货')
        case PointOrderStatus.Completed:
          return h(NTag, { size: 'small', type: 'success' }, () => '已完成')
      }
    },
  },
  {
    title: '订单类型',
    key: 'type',
    filter: (filterOptionValue: unknown, row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return row.type == filterOptionValue
    },
    filterOptions: [
      {
        label: '实体礼物',
        value: GoodsTypes.Physical,
      },
      {
        label: '虚拟礼物',
        value: GoodsTypes.Virtual,
      },
    ],
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return h(NTag, { type: 'success', bordered: false, size: 'small' }, () =>
        row.type == GoodsTypes.Physical ? '实体礼物' : '虚拟礼物',
      )
    },
  },
  {
    title: '地址',
    key: 'address',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      if (row.type == GoodsTypes.Physical) {
        return h(AddressDisplay, { address: row.address })
      } else {
        return h(NText, { depth: 3 }, () => '无需发货')
      }
    },
  },
  {
    title: '操作',
    key: 'action',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return h(
        NButton,
        {
          type: 'info',
          size: 'small',
          onClick: () => {
            orderDetail.value = row
            showDetailModal.value = true
          },
        },
        { default: () => '详情' },
      )
    },
  },
]
</script>

<template>
  <NDataTable
    :loading="isLoading"
    :columns="orderColumn"
    :data="order"
    :pagination="{ showSizePicker: true, pageSizes: [10, 25, 50, 100], defaultPageSize: 10, size: 'small' }"
  >
  </NDataTable>
  <NModal
    v-if="orderDetail"
    v-model:show="showDetailModal"
    preset="card"
    title="订单详情"
    style="max-width: 800px; max-height: 90vh"
  >
    <NScrollbar style="max-height: 80vh">
      <div style="width: 97%">
        <template v-if="type == 'user'">
          <NDivider style="margin-top: 0">
            商品快照
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" />
              </template>
              兑换成功时生成的礼物快照, 即使主播对礼物内容进行了修改这个地方也不会变化
            </NTooltip>
          </NDivider>
          <NFlex justify="center">
            <PointGoodsItem style="max-width: 300px" :goods="currentGoods" />
          </NFlex>
          <template v-if="orderDetail.type == GoodsTypes.Virtual">
            <NDivider> 虚拟礼物内容 </NDivider>
            <NInput :value="currentGoods?.content" type="textarea" readonly placeholder="无内容" />
          </template>
        </template>
        <template v-else-if="type == 'owner'"> </template>
      </div>
    </NScrollbar>
  </NModal>
</template>
