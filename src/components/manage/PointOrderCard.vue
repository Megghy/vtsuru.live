<script setup lang="ts">
import type {
  DataTableColumns,
  DataTableRowKey,
} from 'naive-ui'
import type {
  ResponsePointOrder2OwnerModel,
  ResponsePointOrder2UserModel,
} from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NAlert,
  NAutoComplete,
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NEllipsis,
  NEmpty,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NScrollbar,
  NSpace,
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
import {
  GoodsTypes,
  PointOrderStatus,
} from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import AddressDisplay from './AddressDisplay.vue'
import PointGoodsItem from './PointGoodsItem.vue'

type OrderType = ResponsePointOrder2UserModel | ResponsePointOrder2OwnerModel

const props = defineProps<{
  order: ResponsePointOrder2UserModel[] | ResponsePointOrder2OwnerModel[]
  type: 'user' | 'owner'
  loading?: boolean
}>()

const emit = defineEmits(['selectedItem'])
const message = useMessage()
const dialog = useDialog()
// 状态管理
const isLoading = ref(false)
const showDetailModal = ref(false)
const selectedItem = ref<DataTableRowKey[]>([])
const orderDetail = ref<OrderType>()

// 监听加载状态
watch(() => props.loading, (val) => {
  isLoading.value = !!val
})

// 计算属性
const orderAsUser = computed(() => props.order as ResponsePointOrder2UserModel[])
const orderAsOwner = computed(() => props.order as ResponsePointOrder2OwnerModel[])

const currentGoods = computed(() => {
  if (!orderDetail.value) return null

  return orderDetail.value.goods
})

const expressOptions = computed(() => {
  if (props.type !== 'owner' || !orderAsOwner.value) return []

  // 过滤掉空值并去重
  const companies = [...new Set(
    orderAsOwner.value
      .map(o => o.expressCompany)
      .filter(Boolean),
  )]

  return companies.map(company => ({
    label: company,
    value: company,
  }))
})

// 状态映射表
const statusMap = {
  [PointOrderStatus.Pending]: {
    text: '等待发货',
    type: 'default',
    description: '订单创建完成，等待主播发货',
    action: '发货',
    nextStatusText: '确认发货后，订单状态将变为"已发货"',
    prevStatusText: '',
  },
  [PointOrderStatus.Shipped]: {
    text: (hasExpress: boolean) => hasExpress ? '已发货 | 已填写单号' : '已发货 | 未填写单号',
    type: (hasExpress: boolean) => hasExpress ? 'info' : 'warning',
    description: '订单已发货，可以添加快递信息',
    action: '完成订单',
    nextStatusText: '确认后将可以进行发货信息填写',
    prevStatusText: '回退到"等待发货"状态，适用于发货信息填写错误等情况',
  },
  [PointOrderStatus.Completed]: {
    text: '已完成',
    type: 'success',
    description: '订单已完成',
    action: '',
    nextStatusText: '完成后无法再进行状态修改',
    prevStatusText: '回退到"已发货"状态（仅限实体礼物）',
  },
}

// 表格列定义
const orderColumn: DataTableColumns<OrderType> = [
  {
    type: 'selection',
    disabled: () => props.type === 'user',
    options: [
      'all',
      'none',
      {
        label: '选中未发货的',
        key: 'f2',
        onSelect: (pageData) => {
          selectedItem.value = pageData
            .filter(row => row.status === PointOrderStatus.Pending)
            .map(row => row.id)
        },
      },
    ],
  },
  {
    title: '订单号',
    minWidth: 70,
    key: 'id',
  },
  {
    title: '用户',
    key: 'user',
    disabled: () => props.type === 'user',
    render: (row: OrderType) => {
      if (row.instanceOf === 'user') return ''

      const ownerRow = row as ResponsePointOrder2OwnerModel
      return h(NTooltip, null, {
        trigger: () =>
          h(
            NButton,
            {
              text: true,
              type: 'primary',
              tag: 'a',
              href: `https://space.bilibili.com/${ownerRow.customer?.userId || ''}`,
              target: '_blank',
            },
            { default: () => ownerRow.customer?.name || '未知用户' },
          ),
        default: () => ownerRow.customer?.userId || '未知ID',
      })
    },
  },
  {
    title: '礼物名',
    key: 'giftName',
    minWidth: 150,
    render: (row: OrderType) => {
      return row.goods?.name
    },
  },
  {
    title: '数量',
    key: 'count',
  },
  {
    title: '时间',
    key: 'time',
    sorter: (row1: OrderType, row2: OrderType) => row1.createAt - row2.createAt,
    minWidth: 80,
    render: (row: OrderType) => {
      return h(NTooltip, null, {
        trigger: () => h(NTime, { time: row.createAt, type: 'relative' }),
        default: () => h(NTime, { time: row.createAt }),
      })
    },
  },
  {
    title: '使用积分',
    key: 'point',
    sorter: (row1: OrderType, row2: OrderType) => row1.point - row2.point,
    render: (row: OrderType) => {
      return Number(row.point.toFixed(1))
    },
  },
  {
    title: '订单状态',
    key: 'status',
    filter: props.type === 'owner'
      ? undefined
      : (filterOptionValue: unknown, row: OrderType) => row.status === filterOptionValue,
    filterOptions: [
      { label: '等待发货', value: PointOrderStatus.Pending },
      { label: '已发货', value: PointOrderStatus.Shipped },
      { label: '已完成', value: PointOrderStatus.Completed },
    ],
    render: (row: OrderType) => {
      const status = statusMap[row.status] || { text: '未知状态', type: 'error' }
      const hasExpress = !!row.expressCompany

      const text = typeof status.text === 'function' ? status.text(hasExpress) : status.text
      const type = typeof status.type === 'function' ? status.type(hasExpress) : status.type

      return h(NTag, {
        size: 'small',
        type: type as any,
        bordered: false,
      }, () => text)
    },
  },
  {
    title: '订单类型',
    key: 'type',
    filter: props.type === 'owner'
      ? undefined
      : (filterOptionValue: unknown, row: OrderType) => row.type === filterOptionValue,
    filterOptions: [
      { label: '实体礼物', value: GoodsTypes.Physical },
      { label: '虚拟礼物', value: GoodsTypes.Virtual },
    ],
    render: (row: OrderType) => {
      return h(NTag, {
        type: 'success',
        bordered: false,
        size: 'small',
      }, () => row.type === GoodsTypes.Physical ? '实体礼物' : '虚拟礼物')
    },
  },
  {
    title: '备注',
    key: 'remark',
    minWidth: 100,
    render: (row: OrderType) => {
      if (!row.remark) {
        return h(NText, { depth: 3, italic: true }, () => '无')
      }
      return h(NEllipsis, { style: { maxWidth: '100px' } }, () => row.remark)
    },
  },
  {
    title: '地址',
    key: 'address',
    minWidth: 250,
    render: (row: OrderType) => {
      const goodsCollectUrl = row.goods.collectUrl

      if (row.type === GoodsTypes.Physical) {
        return goodsCollectUrl
          ? h(NButton, {
              tag: 'a',
              href: goodsCollectUrl,
              target: '_blank',
              text: true,
              type: 'info',
            }, () => h(NText, { italic: true }, () => '通过站外链接收集'))
          : h(AddressDisplay, { address: row.address, size: 'small' })
      } else {
        return h(NText, { depth: 3, italic: true }, () => '无需发货')
      }
    },
  },
  {
    title: '快递信息',
    key: 'express',
    minWidth: 150,
    render: (row: OrderType) => {
      if (row.type === GoodsTypes.Physical) {
        if (row.trackingNumber) {
          return h(NFlex, { align: 'center', gap: 8 }, () => [
            h(NTag, { size: 'tiny', bordered: false }, () => row.expressCompany),
            h(NEllipsis, { style: { maxWidth: '100px' } }, () => h(NText, { depth: 3 }, () => row.trackingNumber)),
          ])
        }
        return h(NText, { depth: 3, italic: true }, () => '尚未发货')
      }
      return h(NText, { depth: 3, italic: true }, () => '无需发货')
    },
  },
  {
    title: '操作',
    key: 'action',
    fixed: 'right',
    render: (row: OrderType) => {
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

// 业务方法
function getNextStatus(currentStatus: PointOrderStatus): PointOrderStatus | null {
  if (!orderDetail.value) return null

  // 虚拟礼物直接从等待到完成
  if (orderDetail.value.type === GoodsTypes.Virtual && currentStatus === PointOrderStatus.Pending) {
    return PointOrderStatus.Completed
  }

  if (currentStatus === PointOrderStatus.Pending) return PointOrderStatus.Shipped
  if (currentStatus === PointOrderStatus.Shipped) return PointOrderStatus.Completed
  return null
}

function getPrevStatus(currentStatus: PointOrderStatus): PointOrderStatus | null {
  if (!orderDetail.value) return null

  // 虚拟礼物不允许回退
  if (orderDetail.value.type === GoodsTypes.Virtual) return null

  // 已完成订单不允许回退
  if (currentStatus === PointOrderStatus.Completed) return null

  if (currentStatus === PointOrderStatus.Shipped) return PointOrderStatus.Pending
  return null
}

function onChangeStatus(id: number, status: PointOrderStatus) {
  const statusInfo = statusMap[status]
  const currentStatusInfo = orderDetail.value ? statusMap[orderDetail.value.status] : null
  const currentStatusText = currentStatusInfo
    ? (typeof currentStatusInfo.text === 'function'
        ? currentStatusInfo.text(!!orderDetail.value?.expressCompany)
        : currentStatusInfo.text)
    : '当前状态'

  const newStatusText = typeof statusInfo.text === 'function'
    ? statusInfo.text(false)
    : statusInfo.text

  let tipText = ''
  if (status > (orderDetail.value?.status || 0)) {
    tipText = statusInfo.nextStatusText

    // 特殊处理虚拟礼物
    if (orderDetail.value?.type === GoodsTypes.Virtual && status === PointOrderStatus.Completed) {
      tipText = '该虚拟礼物将被标记为已完成'
    }
  } else if (status < (orderDetail.value?.status || 0)) {
    tipText = statusInfo.prevStatusText
  }

  dialog.info({
    title: '修改订单状态',
    content: () => h('div', null, [
      h('p', null, `确认将订单状态从「${currentStatusText}」修改为「${newStatusText}」吗？`),
      tipText ? h('p', { style: 'color: #f90; margin-top: 8px;' }, tipText) : null,
    ]),
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: () => {
      updateStatus([id], status)
    },
  })
}

async function updateStatus(ids: number[], status: PointOrderStatus) {
  if (!ids.length) return

  try {
    isLoading.value = true
    const data = await QueryPostAPI(`${POINT_API_URL}update-orders-status`, {
      ids,
      status,
    })

    if (data.code === 200) {
      message.success('操作成功')
      props.order?.forEach((row) => {
        if (ids.includes(row.id)) {
          row.status = status
        }
      })
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

async function updateExpress(item: ResponsePointOrder2OwnerModel) {
  if (!item.trackingNumber || !item.expressCompany) {
    message.error('请填写快递单号和快递公司')
    return
  }

  try {
    isLoading.value = true
    const data = await QueryPostAPI(`${POINT_API_URL}update-order-express`, {
      id: item.id,
      trackingNumber: item.trackingNumber,
      expressCompany: item.expressCompany,
    })

    if (data.code === 200) {
      message.success('操作成功')
    } else {
      message.error(`操作失败: ${data.message}`)
    }
  } catch (err) {
    message.error(`操作失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

// 初始化
onMounted(() => {
  props.order?.forEach((row) => {
    row.instanceOf = props.type
  })
})
</script>

<template>
  <div class="point-order-card">
    <NDataTable
      v-model:checked-row-keys="selectedItem"
      :row-key="(row) => row.id"
      :loading="isLoading"
      :columns="orderColumn"
      :data="order"
      :pagination="{
        showSizePicker: true,
        pageSizes: [10, 25, 50, 100],
        defaultPageSize: 10,
        size: 'small',
      }"
      size="small"
      @update:checked-row-keys="keys => emit('selectedItem', keys)"
    >
      <template #empty>
        <NEmpty description="暂无订单" />
      </template>
    </NDataTable>

    <!-- 订单详情模态框 -->
    <NModal
      v-if="orderDetail"
      v-model:show="showDetailModal"
      preset="card"
      title="订单详情"
      style="max-width: 90vw; min-width: 400px; width: 800px;"
    >
      <NScrollbar
        style="max-height: 80vh; padding-right: 12px;"
        trigger="none"
      >
        <div class="order-detail-content">
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
            <PointGoodsItem
              v-if="currentGoods"
              class="goods-item"
              :goods="currentGoods"
            />
          </NFlex>

          <!-- 移动并修改备注信息 -->
          <template v-if="orderDetail.remark">
            <NAlert
              title="备注信息"
              type="info"
              style="margin-top: 16px; margin-bottom: 16px;"
              closable
            >
              <template #icon>
                <NIcon :component="Info24Filled" />
              </template>
              <NText>{{ orderDetail.remark }}</NText>
            </NAlert>
          </template>

          <!-- 用户视图 -->
          <template v-if="orderDetail.instanceOf === 'user'">
            <!-- 虚拟礼物内容 -->
            <template v-if="orderDetail.type === GoodsTypes.Virtual">
              <NDivider>虚拟礼物内容</NDivider>
              <NInput
                v-if="currentGoods"
                :value="currentGoods.content"
                type="textarea"
                readonly
                placeholder="无内容"
              />
            </template>

            <!-- 实体礼物地址收集 -->
            <template
              v-if="
                orderDetail.type === GoodsTypes.Physical
                  && orderDetail.status === PointOrderStatus.Pending
                  && (orderDetail as ResponsePointOrder2UserModel).goods.embedCollectUrl
                  && (orderDetail as ResponsePointOrder2UserModel).goods.collectUrl
              "
            >
              <NDivider>填写收货地址</NDivider>
              <NFlex
                vertical
                align="center"
                gap="12"
              >
                <NButton
                  tag="a"
                  :href="(orderDetail as ResponsePointOrder2UserModel).goods.collectUrl"
                  target="_blank"
                  type="info"
                >
                  在新窗口中打开地址填写表格
                </NButton>

                <iframe
                  class="collect-iframe"
                  :src="(orderDetail as ResponsePointOrder2UserModel).goods.collectUrl"
                  frameborder="0"
                  allowfullscreen
                  sandbox="allow-same-origin allow-scripts allow-modals allow-downloads allow-forms allow-popups"
                />
              </NFlex>
            </template>
          </template>

          <!-- 主播视图 -->
          <template v-else-if="orderDetail.instanceOf === 'owner'">
            <NDivider>订单状态管理</NDivider>

            <!-- 虚拟礼物提示 -->
            <NAlert
              v-if="orderDetail.type === GoodsTypes.Virtual"
              type="success"
              style="margin-bottom: 16px;"
            >
              <template #icon>
                <NIcon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                    />
                    <line
                      x1="12"
                      y1="16"
                      x2="12"
                      y2="12"
                    />
                    <line
                      x1="12"
                      y1="8"
                      x2="12.01"
                      y2="8"
                    />
                  </svg>
                </NIcon>
              </template>
              该订单为虚拟礼物，无需发货
            </NAlert>

            <!-- 订单已完成提示 -->
            <NAlert
              v-if="orderDetail.status === PointOrderStatus.Completed"
              type="info"
              style="margin-bottom: 16px;"
            >
              <template #icon>
                <NIcon>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </NIcon>
              </template>
              该订单已完成，无法再进行状态修改
            </NAlert>

            <!-- 状态信息卡片 -->
            <NCard
              class="status-info-card"
              size="small"
            >
              <template #header>
                <div class="status-info-header">
                  <NTag
                    v-if="orderDetail.status === PointOrderStatus.Pending"
                    type="default"
                    size="medium"
                  >
                    {{ statusMap[PointOrderStatus.Pending].text }}
                  </NTag>
                  <NTag
                    v-else-if="orderDetail.status === PointOrderStatus.Shipped"
                    :type="orderDetail.expressCompany ? 'info' : 'warning'"
                    size="medium"
                  >
                    {{ orderDetail.expressCompany
                      ? '已发货 | 已填写单号'
                      : '已发货 | 未填写单号' }}
                  </NTag>
                  <NTag
                    v-else-if="orderDetail.status === PointOrderStatus.Completed"
                    type="success"
                    size="medium"
                  >
                    {{ statusMap[PointOrderStatus.Completed].text }}
                  </NTag>
                  <span class="status-info-desc">{{ statusMap[orderDetail.status].description }}</span>
                </div>
              </template>

              <NSpace
                v-if="orderDetail.status !== PointOrderStatus.Completed"
                vertical
                size="small"
                class="status-actions-info"
              >
                <NCard
                  v-if="getNextStatus(orderDetail.status) !== null"
                  class="status-action-item"
                  embedded
                >
                  <NSpace align="center">
                    <NIcon
                      class="action-icon"
                      size="20"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m9 18 6-6-6-6" />
                      </svg>
                    </NIcon>
                    <div class="action-text">
                      <div class="action-title">
                        下一状态操作
                      </div>
                      <div class="action-desc">
                        {{ statusMap[orderDetail.status].nextStatusText }}
                      </div>
                    </div>
                  </NSpace>
                </NCard>

                <NCard
                  v-if="getPrevStatus(orderDetail.status) !== null"
                  class="status-action-item"
                  embedded
                >
                  <NSpace align="center">
                    <NIcon
                      class="action-icon"
                      size="20"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="m15 18-6-6 6-6" />
                      </svg>
                    </NIcon>
                    <div class="action-text">
                      <div class="action-title">
                        回退操作
                      </div>
                      <div class="action-desc">
                        {{ statusMap[orderDetail.status].prevStatusText }}
                      </div>
                    </div>
                  </NSpace>
                </NCard>
              </NSpace>
            </NCard>

            <!-- 收货地址信息 -->
            <template v-if="orderDetail.type === GoodsTypes.Physical">
              <NDivider>收货地址</NDivider>
              <NCard
                size="small"
                class="address-info-card"
              >
                <AddressDisplay
                  :address="orderDetail.address"
                  size="default"
                />
              </NCard>
            </template>

            <!-- 快递信息 -->
            <template v-if="orderDetail.status === PointOrderStatus.Shipped && orderDetail.instanceOf === 'owner' && orderDetail.type === GoodsTypes.Physical">
              <NDivider>快递</NDivider>
              <NCard
                size="small"
                class="express-form"
              >
                <NSpace
                  vertical
                  size="medium"
                >
                  <NAutoComplete
                    v-model:value="orderDetail.expressCompany"
                    placeholder="快递公司"
                    :options="expressOptions"
                    class="express-company-input"
                  />
                  <NInputGroup>
                    <NInputGroupLabel>快递单号</NInputGroupLabel>
                    <NInput
                      v-model:value="orderDetail.trackingNumber"
                      placeholder="就是快递单号"
                      class="tracking-number-input"
                    />
                  </NInputGroup>
                  <NButton
                    type="primary"
                    class="update-express-btn"
                    :loading="isLoading"
                    @click="updateExpress(orderDetail as ResponsePointOrder2OwnerModel)"
                  >
                    更新快递信息
                  </NButton>
                </NSpace>
              </NCard>
            </template>

            <NDivider>
              状态更新
            </NDivider>

            <!-- 状态修改指引 -->
            <NText
              v-if="orderDetail.status !== PointOrderStatus.Completed"
              class="status-guide"
              depth="3"
            >
              <NIcon
                :component="Info24Filled"
                style="margin-right: 4px"
              />订
              点击步骤条可直接修改订单状态，或使用下方按钮进行更改
            </NText>

            <NFlex
              justify="center"
              class="order-status-steps"
            >
              <NSteps
                :current="orderDetail.status + 1"
                size="small"
                @update:current="(c) => onChangeStatus(orderDetail?.id ?? -1, c - 1)"
              >
                <NStep
                  title="等待中"
                  :description="statusMap[PointOrderStatus.Pending].description"
                  :disabled="orderDetail.status >= 0 || orderDetail.type === GoodsTypes.Virtual"
                />
                <NStep
                  title="已发货"
                  :description="statusMap[PointOrderStatus.Shipped].description"
                  :disabled="orderDetail.status >= 1 || orderDetail.type === GoodsTypes.Virtual"
                />
                <NStep
                  title="已完成"
                  :description="statusMap[PointOrderStatus.Completed].description"
                  :disabled="orderDetail.status >= 2"
                />
              </NSteps>
            </NFlex>

            <!-- 状态操作按钮 -->
            <NFlex
              justify="center"
              class="status-action-buttons"
            >
              <NButton
                v-if="getPrevStatus(orderDetail.status) !== null"
                type="warning"
                @click="onChangeStatus(orderDetail.id, getPrevStatus(orderDetail.status)!)"
              >
                回退到上一状态
              </NButton>

              <NButton
                v-if="getNextStatus(orderDetail.status) !== null"
                type="primary"
                @click="onChangeStatus(orderDetail.id, getNextStatus(orderDetail.status)!)"
              >
                {{ orderDetail.type === GoodsTypes.Virtual && orderDetail.status === PointOrderStatus.Pending
                  ? '完成订单'
                  : statusMap[orderDetail.status].action }}
              </NButton>
            </NFlex>
          </template>
        </div>
      </NScrollbar>
    </NModal>
  </div>
</template>

<style scoped>
.point-order-card {
  width: 100%;
}

:deep(.n-data-table .n-data-table-tr:hover) {
  background-color: var(--n-table-color-striped);
}

.order-detail-content {
  width: 100%;
  padding: 0 8px;
}

.goods-item {
  max-width: 300px;
  width: 100%;
}

.order-status-steps {
  width: 100%;
  margin-bottom: 12px;
}

.status-info-card {
  margin-bottom: 16px;
}

.status-info-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.status-info-desc {
  margin-left: 12px;
  color: var(--n-text-color-3);
}

.status-actions-info {
  width: 100%;
}

.action-icon {
  color: var(--n-text-color-3);
}

.action-title {
  font-weight: 500;
  margin-bottom: 4px;
  font-size: 14px;
  color: var(--n-text-color-1);
}

.action-desc {
  color: var(--n-text-color-3);
  font-size: 13px;
}

.status-guide {
  display: block;
  margin-bottom: 12px;
  font-size: 14px;
  text-align: center;
}

.express-form {
  max-width: 400px;
}

.express-company-input {
  max-width: 200px;
}

.tracking-number-input {
  max-width: 300px;
}

.update-express-btn {
  width: 120px;
}

.collect-iframe {
  height: 600px;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}

.status-action-buttons {
  margin: 16px 0 24px;
  display: flex;
  gap: 12px;
}

.status-action-buttons .n-button {
  min-width: 120px;
  transition: all 0.3s;
}

.status-action-buttons .n-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px var(--n-box-shadow-color);
}

.address-info-card {
  margin-bottom: 16px;
}

@media (max-width: 768px) {
  .order-detail-modal {
    max-width: 95vw;
  }

  .goods-item {
    max-width: 100%;
  }

  .collect-iframe {
    height: 400px;
  }
}
</style>
