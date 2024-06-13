<script setup lang="ts">
import {
  GoodsTypes,
  PointOrderStatus,
  ResponsePointGoodModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointOrder2UserModel,
} from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
import {
  DataTableColumns,
  DataTableRowKey,
  NAutoComplete,
  NButton,
  NDataTable,
  NDivider,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NScrollbar,
  NStep,
  NSteps,
  NTag,
  NText,
  NTime,
  NTooltip,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import AddressDisplay from './AddressDisplay.vue'
import PointGoodsItem from './PointGoodsItem.vue'

const props = defineProps<{
  order: ResponsePointOrder2UserModel[] | ResponsePointOrder2OwnerModel[]
  type: 'user' | 'owner'
  goods?: ResponsePointGoodModel[]
  loading?: boolean
}>()
const message = useMessage()
const dialog = useDialog()

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
const selectedItem = ref<DataTableRowKey[]>()

const showDetailModal = ref(false)
const orderDetail = ref<ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel>()
const currentGoods = computed(() => {
  //@ts-ignore
  if (props.type == 'user') return orderDetail.value.goods
  //@ts-ignore
  else return props.goods.find((g) => g.id == orderDetail.value.goodsId)
})
const expressOptions = computed(() => {
  if (!orderAsOwner.value) return []
  return orderAsOwner.value.map((o) => ({
    label: o.expressCompany,
    value: o.expressCompany,
  }))
})

const orderColumn: DataTableColumns<ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel> = [
  {
    type: 'selection',

    disabled: () => props.type == 'user',
    options: [
      'all',
      'none',
      {
        label: '选中未发货的',
        key: 'f2',
        onSelect: (pageData) => {
          selectedItem.value = pageData.filter((row) => row.status == PointOrderStatus.Pending).map((row) => row.id)
          console.log(selectedItem.value)
        },
      },
    ],
  },
  {
    title: '订单号',
    key: 'id',
  },
  {
    title: '用户',
    key: 'user',
    disabled: () => props.type == 'user',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return row.instanceOf == 'user'
        ? ''
        : h(NTooltip, null, {
            trigger: () =>
              h(
                NButton,
                {
                  text: true,
                  type: 'primary',
                  tag: 'a',
                  href: 'https://space.bilibili.com/' + row.customer.userId + '',
                  target: '_blank',
                },
                { default: () => row.customer.name },
              ),
            default: () => row.customer.userId,
          })
    },
  },
  {
    title: '礼物名',
    key: 'giftName',
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return row.instanceOf == 'user' ? row.goods.name : props.goods?.find((g) => g.id == row.goodsId)?.name
    },
  },
  {
    title: '数量',
    key: 'count',
  },
  {
    title: '时间',
    key: 'time',
    sorter: 'default',
    minWidth: 80,
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      return h(NTooltip, null, {
        trigger: () => h(NTime, { time: row.createAt, type: 'relative' }),
        default: () => h(NTime, { time: row.createAt }),
      })
    },
  },
  {
    title: '使用积分',
    key: 'point',
    sorter: 'default',
  },
  {
    title: '订单状态',
    key: 'status',
    filter:
      props.type == 'owner'
        ? undefined
        : (filterOptionValue: unknown, row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
            return row.status == filterOptionValue
          },
    filterOptions: [
      {
        label: '等待发货',
        value: PointOrderStatus.Pending,
      },
      {
        label: '已发货',
        value: PointOrderStatus.Shipped,
      },
      {
        label: '已完成',
        value: PointOrderStatus.Completed,
      },
    ],
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      switch (row.status) {
        case PointOrderStatus.Pending:
          return h(NTag, { size: 'small' }, () => '等待发货')
        case PointOrderStatus.Shipped:
          return h(NTag, { size: 'small', type: row.expressCompany ? 'info' : 'warning', bordered: false }, () =>
            row.expressCompany ? '已发货 | 已填写单号' : '已发货 | 未填写单号',
          )
        case PointOrderStatus.Completed:
          return h(NTag, { size: 'small', type: 'success' }, () => '已完成')
      }
    },
  },
  {
    title: '订单类型',
    key: 'type',
    filter:
      props.type == 'owner'
        ? undefined
        : (filterOptionValue: unknown, row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
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
    minWidth: 250,
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      const collectUrl =
        row.instanceOf == 'user' ? row.goods.collectUrl : props.goods?.find((g) => g.id == row.goodsId)?.collectUrl
      if (row.type == GoodsTypes.Physical) {
        return collectUrl
          ? h(NButton, { tag: 'a', href: collectUrl, target: '_blank', text: true, type: 'info' }, () =>
              h(NText, { italic: true }, () => '通过站外链接收集'),
            )
          : h(AddressDisplay, { address: row.address })
      } else {
        return h(NText, { depth: 3, italic: true }, () => '无需发货')
      }
    },
  },
  {
    title: '快递信息',
    key: 'express',
    minWidth: 150,
    render: (row: ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel) => {
      if (row.type == GoodsTypes.Physical) {
        return row.trackingNumber
          ? h(
              NFlex,
              {
                depth: 3,
              },
              () => [
                h(
                  NTag,
                  {
                    size: 'tiny',
                    bordered: false,
                  },
                  () => row.expressCompany,
                ),
                h(NText, { depth: 3 }, () => row.trackingNumber),
              ],
            )
          : h(NText, { depth: 3, italic: true }, () => '尚未发货')
      } else {
        return h(NText, { depth: 3, italic: true }, () => '无需发货')
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
function onChangeStatus(id: number, status: PointOrderStatus) {
  dialog.info({
    title: '提示',
    content: '确认修改订单状态?',
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      updateStatus([id], status)
    },
  })
}
async function updateStatus(id: number[], status: PointOrderStatus) {
  try {
    const data = await QueryPostAPI(POINT_API_URL + 'update-orders-status', {
      ids: id,
      status,
    })
    if (data.code == 200) {
      message.success('操作成功')
      props.order?.forEach((row) => {
        if (id.includes(row.id)) {
          row.status = status
        }
      })
    } else {
      message.error('操作失败: ' + data.message)
    }
  } catch (err) {
    message.error('操作失败: ' + err)
    console.log(err)
  }
}
async function updateExpress(item: ResponsePointOrder2OwnerModel) {
  if (!item.trackingNumber || !item.expressCompany) {
    message.error('请填写快递单号和快递公司')
    return
  }
  try {
    isLoading.value = true
    const data = await QueryPostAPI(POINT_API_URL + 'update-order-express', {
      id: item.id,
      trackingNumber: item.trackingNumber,
      expressCompany: item.expressCompany,
    })
    if (data.code == 200) {
      message.success('操作成功')
    } else {
      message.error('操作失败: ' + data.message)
    }
  } catch (err) {
    message.error('操作失败: ' + err)
    console.log(err)
  }
  isLoading.value = false
}

onMounted(() => {
  props.order?.forEach((row) => {
    row.instanceOf = props.type
  })
})
</script>

<template>
  <NDataTable
    v-model:checked-row-keys="selectedItem"
    :row-key="(row) => row.id"
    :loading="isLoading"
    :columns="orderColumn"
    :data="order"
    :pagination="{ showSizePicker: true, pageSizes: [10, 25, 50, 100], defaultPageSize: 10, size: 'small' }"
    size="small"
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
        <template v-if="orderDetail.instanceOf == 'user'">
          <NDivider style="margin-top: 0">
            礼物快照
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
          <template
            v-if="
              orderDetail.type == GoodsTypes.Physical &&
              orderDetail.status == PointOrderStatus.Pending &&
              orderDetail.goods.embedCollectUrl &&
              orderDetail.goods.collectUrl
            "
          >
            <NDivider> 填写收货地址 </NDivider>
            <NButton tag="a" :href="orderDetail.goods.collectUrl" target="_blank" type="info">
              在新窗口中打开地址填写表格
            </NButton>
            <br />
            <iframe
              height="1200"
              width="800"
              :src="orderDetail.goods.collectUrl"
              frameborder="0"
              allowfullscreen
              sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
            ></iframe>
          </template>
        </template>
        <template v-else-if="orderDetail.instanceOf == 'owner'"
          ><NFlex justify="center">
            <PointGoodsItem style="max-width: 300px" :goods="currentGoods" />
          </NFlex>
          <NDivider> 设置订单状态 </NDivider>
          <NFlex justify="center" style="width: 100%">
            <NSteps
              :current="orderDetail.status + 1"
              size="small"
              @update:current="(c) => onChangeStatus(orderDetail?.id ?? -1, c - 1)"
            >
              <NStep title="等待中" description="等待主播发货" :disabled="orderDetail.status >= 0" />
              <NStep title="已发货" description="已经发货了" :disabled="orderDetail.status >= 1" />
              <NStep title="已完成" description="就是已完成" :disabled="orderDetail.status >= 2" />
            </NSteps>
          </NFlex>
          <template v-if="orderDetail.status == PointOrderStatus.Shipped && orderDetail.instanceOf == 'owner'">
            <NDivider> 快递 </NDivider>
            <NFlex vertical>
              <NAutoComplete
                v-model:value="orderDetail.expressCompany"
                placeholder="快递公司"
                :options="expressOptions"
                style="max-width: 100px"
              />
              <NInputGroup>
                <NInputGroupLabel> 快递单号 </NInputGroupLabel>
                <NInput
                  v-model:value="orderDetail.trackingNumber"
                  placeholder="就是快递单号"
                  style="max-width: 200px"
                />
              </NInputGroup>
              <NButton type="primary" @click="updateExpress(orderDetail)" style="width: 120px" :loading="isLoading">
                更新快递信息
              </NButton>
            </NFlex>
          </template>
        </template>
      </div>
    </NScrollbar>
  </NModal>
</template>
