<script setup lang="ts">
import { Add24Regular, ArrowSync24Regular } from '@vicons/fluent'
import type { FormRules, SelectOption } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCheckbox,
  NDatePicker,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NIcon,
  NImage,
  NInput,
  NInputNumber,
  NModal,
  NScrollbar,
  NSelect,
  NSpin,
  NTag,
  NText,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { AddressInfo, ResponsePointGoodModel, ResponsePointOrder2UserModel } from '@/api/api-models'
import { GoodsTypes, ServiceFieldType } from '@/api/api-models'
import { POINT_API_URL, IMGUR_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { NavigateToNewTab } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import AddressDisplay from './AddressDisplay.vue'

const props = defineProps<{
  /** 直播间主播 ID */
  vId: number
  /** 当前用户在该直播间的积分 */
  currentPoint: number
}>()

const emit = defineEmits<{
  /** 兑换成功后通知父级刷新积分与礼物列表 */
  success: []
}>()

const router = useRouter()
const useAuth = useBiliAuth()
const message = useMessage()
const dialog = useDialog()
const biliAuth = computed(() => useAuth.biliAuth)

const show = defineModel<boolean>('show', { required: true })
const goods = defineModel<ResponsePointGoodModel | undefined>('goods', { required: true })

// --- 状态 ---
const isLoading = ref(false)
const showAddressSelect = ref(false)
const showAddressModal = ref(false)
const currentAddress = ref<AddressInfo>()
const formRef = ref()
const userAgree = ref(false)
const buyCount = ref(1)
const selectedAddress = ref<AddressInfo>()
const remark = ref('')
const serviceAnswers = ref<Record<string, string | string[] | number | undefined>>({})
type BuySubItem = { subItemId: number; quantity: number }
const selectedSubItems = ref<BuySubItem[]>([])

const emptyCover = `${IMGUR_URL}None.png`

// --- 基础派生 ---
const hasSubItems = computed(() => (goods.value?.subItems?.length ?? 0) > 0)
const isService = computed(() => goods.value?.type === GoodsTypes.Service)
const serviceConfig = computed(() => (isService.value ? goods.value?.serviceConfig : undefined))
const isPhysical = computed(() => goods.value?.type === GoodsTypes.Physical)

const typeLabel = computed(() => {
  switch (goods.value?.type) {
    case GoodsTypes.Physical:
      return '实体礼物'
    case GoodsTypes.Service:
      return '服务'
    default:
      return '虚拟物品'
  }
})

/** 头部价格:多款式取区间,单商品取自身价 */
const priceText = computed(() => {
  if (!goods.value) return ''
  const list = goods.value.subItems?.filter((s) => s.count == null || s.count > 0) ?? []
  if (!hasSubItems.value || !list.length) return String(goods.value.price)
  const prices = list.map((s) => Number(s.price))
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return min === max ? String(min) : `${min}~${max}`
})

/** 头部库存摘要:与款式列表的实时可选项保持一致 */
const stockText = computed(() => {
  if (!goods.value) return ''
  if (!hasSubItems.value) {
    return goods.value.count === 0 ? '缺货' : goods.value.count ? `余 ${goods.value.count}` : '库存不限'
  }
  const available = (goods.value.subItems ?? []).filter((s) => s.count == null || s.count > 0)
  if (!available.length) return '缺货'
  const limited = available.filter((s) => s.count != null)
  if (!limited.length) return '库存不限'
  return `余 ${limited.reduce((acc, s) => acc + (s.count ?? 0), 0)}`
})

const cost = computed(() => {
  if (!goods.value) return 0
  if (goods.value.canFreeBuy) return 0

  if (hasSubItems.value) {
    const subMap = new Map((goods.value.subItems ?? []).map((s) => [String(s.id), s]))
    const sum = selectedSubItems.value.reduce(
      (acc, s) => acc + (Number(subMap.get(String(s.subItemId))?.price) || 0) * (Number(s.quantity) || 0),
      0,
    )
    return Number(sum.toFixed(2))
  }
  return Number(((goods.value.price > 0 ? goods.value.price : 0) * (buyCount.value || 1)).toFixed(2))
})

const needAddress = computed(() => {
  if (!goods.value) return false
  if (!hasSubItems.value) return isPhysical.value && !goods.value.collectUrl

  const selectedIds = new Set(selectedSubItems.value.map((s) => String(s.subItemId)))
  return (goods.value.subItems ?? []).some(
    (s) => selectedIds.has(String(s.id)) && s.type === GoodsTypes.Physical && !s.collectUrl,
  )
})

const canDoBuy = computed(() => {
  if (!goods.value?.canPurchase) return false

  const pointsOk = goods.value.canFreeBuy || cost.value <= props.currentPoint

  if (hasSubItems.value) {
    const maxSelections = goods.value.maxSubItemSelections
    if (!selectedSubItems.value.length) return false
    if (maxSelections && maxSelections > 0 && selectedSubItems.value.length > maxSelections) return false
    if (selectedSubItems.value.some((s) => s.quantity < 1 || !Number.isInteger(s.quantity))) return false

    const subMap = new Map((goods.value.subItems ?? []).map((s) => [String(s.id), s]))
    for (const s of selectedSubItems.value) {
      const sub = subMap.get(String(s.subItemId))
      if (!sub || sub.count === 0) return false
      if (sub.count != null && s.quantity > sub.count) return false
    }
    return pointsOk && (!needAddress.value || !!selectedAddress.value)
  }

  if ((goods.value.purchasedCount ?? 0) + buyCount.value > (goods.value.maxBuyCount ?? Number.MAX_VALUE)) return false
  return pointsOk && (!needAddress.value || !!selectedAddress.value)
})

/** 无法兑换时展示在 footer 的原因 */
const blockedReason = computed(() => {
  if (!goods.value || canDoBuy.value) return ''
  return goods.value.cannotPurchaseReason || '积分不足或条件不满足'
})

/** 已售 / 已购合并为一行摘要,避免三块 Alert 撑高弹窗 */
const statusSummary = computed(() => {
  if (!goods.value) return []
  const list: string[] = []
  if (goods.value.soldCount) list.push(`已售 ${goods.value.soldCount} 次`)
  if (goods.value.hasPurchased) {
    const max = goods.value.maxBuyCount
    list.push(max ? `你已兑换 ${goods.value.purchasedCount}/${max} 次` : `你已兑换 ${goods.value.purchasedCount} 次`)
  }
  return list
})

const rebuyWarning = computed(() =>
  goods.value?.hasPurchased && !goods.value.isAllowRebuy ? '该礼物不允许重复兑换' : '',
)

// --- 款式选择 ---
function isSubItemChecked(id: number) {
  return selectedSubItems.value.some((s) => String(s.subItemId) === String(id))
}

function isSubItemDisabled(id: number) {
  const sub = goods.value?.subItems?.find((s) => String(s.id) === String(id))
  if (!sub || sub.count === 0) return true
  const maxSelections = goods.value?.maxSubItemSelections
  if (!maxSelections || maxSelections <= 0) return false
  return selectedSubItems.value.length >= maxSelections && !isSubItemChecked(id)
}

function toggleSubItem(id: number, checked: boolean) {
  if (isSubItemDisabled(id)) return
  const targetId = Number(id)
  if (!checked) {
    selectedSubItems.value = selectedSubItems.value.filter((s) => Number(s.subItemId) !== targetId)
    return
  }
  if (selectedSubItems.value.some((s) => Number(s.subItemId) === targetId)) return
  selectedSubItems.value = [...selectedSubItems.value, { subItemId: targetId, quantity: 1 }]
}

function updateSubItemQuantity(id: number, quantity: number | null) {
  const targetId = Number(id)
  selectedSubItems.value = selectedSubItems.value.map((s) =>
    Number(s.subItemId) === targetId ? { ...s, quantity: Number(quantity ?? 1) } : s,
  )
}

const subItemMax = computed(
  () => (sub: { maxBuyCount?: number | null; count?: number | null }) =>
    Math.min(sub.maxBuyCount ?? 100000, sub.count == null ? 100000 : sub.count),
)

// --- 地址 ---
interface AreaData {
  [province: string]: { [city: string]: { [district: string]: string[] } }
}

const areas = usePersistedStorage<{ createAt: number; data: AreaData }>('Data.Areas', { createAt: 0, data: {} })

async function getArea() {
  if (areas.value && Date.now() - areas.value.createAt < 1000 * 60 * 60 * 24 * 7) return
  const res = await fetch('https://oss.suki.club/vtsuru/area_data.json')
  if (!res.ok) throw new Error('获取地区数据失败')
  areas.value = { createAt: Date.now(), data: await res.json() }
}

const addressOptions = computed(
  () => biliAuth.value.address?.map((item) => ({ label: item.address, value: item.id })) ?? [],
)
const provinceOptions = computed(() => Object.keys(areas.value?.data ?? {}).map((p) => ({ label: p, value: p })))
const cityOptions = (province?: string) =>
  province ? Object.keys(areas.value?.data?.[province] ?? {}).map((c) => ({ label: c, value: c })) : []
const districtOptions = (province?: string, city?: string) =>
  province && city ? Object.keys(areas.value?.data?.[province]?.[city] ?? {}).map((d) => ({ label: d, value: d })) : []
const streetOptions = (province?: string, city?: string, district?: string) =>
  (province && city && district ? areas.value?.data?.[province]?.[city]?.[district] : undefined)?.map((s) => ({
    label: s,
    value: s,
  })) ?? []

const addressFormRules: FormRules = {
  phone: { required: true, message: '请输入手机号' },
  address: { required: true, message: '请输入详细地址' },
  name: { required: true, message: '请输入收件人姓名' },
  area: {
    required: true,
    message: '请选择地区',
    validator: () => !!(currentAddress.value?.province && currentAddress.value?.city && currentAddress.value?.district),
  },
}

function onAreaSelectChange(level: number) {
  if (!currentAddress.value) return
  if (level === 0) {
    currentAddress.value.city = undefined
    currentAddress.value.district = undefined
    currentAddress.value.street = undefined
  } else if (level === 1) {
    currentAddress.value.district = undefined
    currentAddress.value.street = undefined
  } else {
    currentAddress.value.street = undefined
  }
}

async function openAddressModal() {
  showAddressModal.value = true
  currentAddress.value = {} as AddressInfo
  userAgree.value = false
  await getArea()
}

async function refreshAddressList() {
  if (!useAuth.isAuthed || !biliAuth.value.id) return
  await useAuth.getAuthInfo()
}

async function updateAddress() {
  await formRef.value?.validate()
  isLoading.value = true
  try {
    const data = await useAuth.QueryBiliAuthPostAPI<AddressInfo>(
      `${POINT_API_URL}user/update-address`,
      currentAddress.value,
    )
    if (data.code !== 200) {
      message.error(`保存失败: ${data.message}`)
      return
    }
    message.success('地址已保存')
    showAddressModal.value = false
    const list = biliAuth.value.address
    if (list) {
      const index = list.findIndex((a) => a.id === data.data.id)
      if (index >= 0) list[index] = data.data
      else list.push(data.data)
    } else {
      biliAuth.value.address = [data.data]
    }
  } finally {
    isLoading.value = false
  }
}

function renderLabel(option: SelectOption) {
  return h(AddressDisplay, { address: biliAuth.value.address?.find((a) => a.id === option.value), size: 'small' })
}

function renderOption({ option }: { option: SelectOption }) {
  const address = biliAuth.value.address?.find((a) => a.id === option.value)
  return h(
    NButton,
    {
      style: 'width: 100%; justify-content: flex-start;',
      secondary: true,
      type: selectedAddress.value?.id === option.value ? 'info' : 'default',
      onClick: () => {
        selectedAddress.value = address
        showAddressSelect.value = false
      },
    },
    () => h(AddressDisplay, { address }),
  )
}

// --- 提交 ---
function showSuccessDialog(order: ResponsePointOrder2UserModel) {
  dialog.success({
    title: '兑换成功',
    content: () => {
      const elements: ReturnType<typeof h>[] = [h(NText, null, { default: () => `订单号:${order.id}` })]

      const subItems = order.selectedSubItems ?? []
      if (subItems.length) {
        elements.push(
          h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '已选款式' }),
          h(NText, null, { default: () => subItems.map((s) => `${s.nameSnapshot}×${s.quantity}`).join('、') }),
        )
      }

      const keys = subItems
        .flatMap((s) => (s.assignedVirtualKeys || []).map((k) => `${s.nameSnapshot}: ${k}`))
        .join('\n')
      if (keys) {
        elements.push(
          h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '密钥' }),
          h(
            NAlert,
            { type: 'success', bordered: false, style: 'white-space: pre-wrap; word-break: break-word;' },
            { default: () => keys },
          ),
        )
      }

      if (order.type === GoodsTypes.Virtual && order.goods.content) {
        elements.push(
          h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '礼物内容' }),
          h(
            NAlert,
            { type: 'success', bordered: false, style: 'white-space: pre-wrap; word-break: break-word;' },
            { default: () => order.goods.content },
          ),
        )
      }

      return h(NFlex, { vertical: true, size: 'small' }, { default: () => elements })
    },
    positiveText: '前往查看',
    negativeText: '关闭',
    onPositiveClick: () => {
      show.value = false
      router.push({ name: 'bili-user-orders' })
    },
    onNegativeClick: () => {
      show.value = false
    },
  })
}

/** 表单校验:返回错误文案,通过则返回空串 */
function validateForm(): string {
  const good = goods.value
  if (!good) return '礼物数据异常,请刷新后重试'

  if (hasSubItems.value) {
    if (!selectedSubItems.value.length) return '请选择至少一个款式'
    const subMap = new Map((good.subItems ?? []).map((s) => [String(s.id), s]))
    for (const s of selectedSubItems.value) {
      const sub = subMap.get(String(s.subItemId))
      if (!sub) return '款式数据异常,请刷新后重试'
      if (s.quantity < 1) return '款式数量不能小于1'
      if (!Number.isInteger(s.quantity)) return '款式数量必须为整数'
      if (sub.type === GoodsTypes.Virtual && s.quantity !== 1) return `${sub.name} 为虚拟礼物,数量固定为 1`
    }
  } else {
    if (buyCount.value < 1) return '兑换数量不能小于1'
    if (!Number.isInteger(buyCount.value)) return '兑换数量必须为整数'
    if ((good.purchasedCount ?? 0) + buyCount.value > (good.maxBuyCount ?? Number.MAX_VALUE))
      return `超出最大兑换次数限制(${good.maxBuyCount})`
  }

  if (needAddress.value && !selectedAddress.value) return '请选择收货地址'

  if (isService.value) {
    const missing = (serviceConfig.value?.fields ?? []).find((field) => {
      const answer = serviceAnswers.value[field.id]
      return field.required && (Array.isArray(answer) ? !answer.length : !String(answer ?? '').trim())
    })
    if (missing) return `请填写${missing.label}`
  }

  return ''
}

async function buyGoods() {
  const good = goods.value
  if (!good) return

  const invalid = validateForm()
  if (invalid) {
    message.error(invalid)
    return
  }

  const subMap = new Map((good.subItems ?? []).map((s) => [String(s.id), s]))
  const summary = hasSubItems.value
    ? selectedSubItems.value
        .map((s) => `${subMap.get(String(s.subItemId))?.name ?? s.subItemId}×${s.quantity}`)
        .join('、')
    : `${buyCount.value} 个`

  dialog.warning({
    title: '确认兑换',
    content: hasSubItems.value
      ? `确定要花费 ${cost.value} 积分兑换 "${good.name}" 吗?\n款式:${summary}`
      : `确定要花费 ${cost.value} 积分兑换 ${buyCount.value} 个 "${good.name}" 吗?`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      isLoading.value = true
      try {
        const data = await useAuth.QueryBiliAuthPostAPI<ResponsePointOrder2UserModel>(`${POINT_API_URL}buy`, {
          vId: props.vId,
          goodsId: good.id,
          count: hasSubItems.value ? selectedSubItems.value.reduce((acc, s) => acc + s.quantity, 0) : buyCount.value,
          addressId: selectedAddress.value?.id ?? null,
          remark: remark.value,
          ...(isService.value
            ? {
                serviceAnswers: Object.fromEntries(
                  Object.entries(serviceAnswers.value).map(([id, value]) => [
                    id,
                    Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value),
                  ]),
                ),
              }
            : {}),
          ...(hasSubItems.value ? { selectedSubItems: selectedSubItems.value } : {}),
        })

        if (data.code !== 200) {
          message.error(`兑换失败: ${data.message}`)
          return
        }

        show.value = false
        showSuccessDialog(data.data)
        emit('success')
      } finally {
        isLoading.value = false
      }
    },
  })
}

// 关闭即重置,避免下次打开残留上一次的选择
watch(show, (visible) => {
  if (visible) return
  selectedSubItems.value = []
  selectedAddress.value = undefined
  showAddressSelect.value = false
  buyCount.value = 1
  remark.value = ''
  serviceAnswers.value = {}
  showAddressModal.value = false
})

const requestClose = () => {
  if (isLoading.value) return
  show.value = false
}
</script>

<template>
  <NModal
    v-if="goods"
    v-model:show="show"
    preset="card"
    style="width: min(760px, 95vw)"
    :mask-closable="!isLoading"
    :close-on-esc="!isLoading"
    :segmented="{ content: true, action: true }"
  >
    <!-- 紧凑头部:小图 + 名称 + 价格/库存 + 类型 -->
    <template #header>
      <div class="dialog-header">
        <NImage
          :src="goods.cover ? goods.cover.path : emptyCover"
          :fallback-src="emptyCover"
          object-fit="cover"
          :preview-disabled="!goods.cover"
          class="header-cover"
        />
        <div class="header-body">
          <NText
            strong
            class="header-title"
          >
            {{ goods.name }}
          </NText>
          <NFlex
            align="center"
            :gap="8"
            wrap
          >
            <NTag
              size="small"
              :bordered="false"
              round
              type="primary"
              secondary
            >
              {{ priceText }} 积分
            </NTag>
            <NTag
              size="small"
              :bordered="false"
              round
            >
              {{ typeLabel }}
            </NTag>
            <NText
              depth="3"
              class="header-meta"
            >
              {{ stockText }}
            </NText>
            <NText
              v-for="item in statusSummary"
              :key="item"
              depth="3"
              class="header-meta"
            >
              · {{ item }}
            </NText>
          </NFlex>
        </div>
      </div>
    </template>

    <div class="dialog-body">
      <NScrollbar class="dialog-scroll">
        <div class="dialog-content">
          <NAlert
            v-if="rebuyWarning"
            type="warning"
            :bordered="false"
            class="dialog-alert"
          >
            {{ rebuyWarning }}
          </NAlert>

          <template v-if="isService">
            <NAlert
              v-if="serviceConfig?.rules"
              type="info"
              :bordered="false"
              class="dialog-alert dialog-alert--pre"
            >
              {{ serviceConfig.rules }}
            </NAlert>
            <NAlert
              type="default"
              :bordered="false"
              class="dialog-alert"
            >
              提交后进入待接单状态<span v-if="serviceConfig?.estimatedDays"
                >，预计 {{ serviceConfig.estimatedDays }} 天内完成</span
              >。主播确认接单后会在订单中更新进度。
            </NAlert>
          </template>

          <NForm
            label-placement="top"
            :show-feedback="false"
            label-width="auto"
            class="dialog-form"
          >
            <NFormItem
              v-for="field in serviceConfig?.fields ?? []"
              :key="field.id"
              :label="field.label"
              :required="field.required"
              class="dialog-form-item"
            >
              <NSelect
                v-if="field.type === ServiceFieldType.Select"
                v-model:value="serviceAnswers[field.id] as string"
                :options="field.options.map((option) => ({ label: option, value: option }))"
                :placeholder="`请选择${field.label}`"
              />
              <NSelect
                v-else-if="field.type === ServiceFieldType.MultiSelect"
                v-model:value="serviceAnswers[field.id] as string[]"
                multiple
                :options="field.options.map((option) => ({ label: option, value: option }))"
                :placeholder="`请选择${field.label}`"
              />
              <NInput
                v-else-if="field.type === ServiceFieldType.Number"
                :value="serviceAnswers[field.id] == null ? null : String(serviceAnswers[field.id])"
                :input-props="{ type: 'number', step: 'any' }"
                :placeholder="`请输入${field.label}`"
                @update:value="serviceAnswers[field.id] = $event"
              />
              <NDatePicker
                v-else-if="field.type === ServiceFieldType.Date"
                :formatted-value="
                  typeof serviceAnswers[field.id] === 'string' ? String(serviceAnswers[field.id]) : null
                "
                type="date"
                value-format="yyyy-MM-dd"
                :placeholder="`请选择${field.label}`"
                class="field-full"
                @update:formatted-value="serviceAnswers[field.id] = $event ?? ''"
              />
              <NInput
                v-else
                :value="serviceAnswers[field.id] == null ? '' : String(serviceAnswers[field.id])"
                :type="field.type === ServiceFieldType.Textarea ? 'textarea' : 'text'"
                :placeholder="field.type === ServiceFieldType.Url ? '请输入链接' : `请输入${field.label}`"
                :input-props="field.type === ServiceFieldType.Url ? { type: 'url' } : undefined"
                :autosize="field.type === ServiceFieldType.Textarea ? { minRows: 3, maxRows: 8 } : undefined"
                :maxlength="field.type === ServiceFieldType.Textarea ? 2000 : 300"
                show-count
                @update:value="serviceAnswers[field.id] = String($event ?? '')"
              />
            </NFormItem>

            <!-- 款式选择:多款式时两列排布 -->
            <NFormItem
              v-if="hasSubItems"
              label="选择款式"
              required
              class="dialog-form-item"
            >
              <div class="sub-item-field">
                <div class="sub-item-grid">
                  <div
                    v-for="sub in goods.subItems ?? []"
                    :key="sub.id"
                    class="sub-item-card"
                    :class="{
                      active: isSubItemChecked(sub.id),
                      disabled: isSubItemDisabled(sub.id),
                    }"
                    @click="toggleSubItem(sub.id, !isSubItemChecked(sub.id))"
                  >
                    <NCheckbox
                      :checked="isSubItemChecked(sub.id)"
                      :disabled="isSubItemDisabled(sub.id)"
                      @click.stop
                      @update:checked="(v) => toggleSubItem(sub.id, v)"
                    />
                    <NImage
                      v-if="sub.cover?.path"
                      :src="sub.cover.path"
                      width="44"
                      height="44"
                      class="sub-item-cover"
                      object-fit="cover"
                      @click.stop
                    />
                    <div class="sub-item-info">
                      <NFlex
                        align="center"
                        :gap="8"
                      >
                        <NText
                          strong
                          :depth="sub.count === 0 ? 3 : 1"
                          class="sub-item-name"
                        >
                          {{ sub.name }}
                        </NText>
                        <NTag
                          size="tiny"
                          :bordered="false"
                          round
                          type="primary"
                          secondary
                        >
                          {{ sub.price }} 积分
                        </NTag>
                      </NFlex>
                      <NText
                        v-if="sub.description"
                        depth="3"
                        class="sub-item-meta"
                      >
                        {{ sub.description }}
                      </NText>
                      <NText
                        depth="3"
                        class="sub-item-meta"
                      >
                        <span v-if="sub.count === 0">缺货</span>
                        <span v-else-if="sub.count != null">库存 {{ sub.count }}</span>
                        <span v-else>库存不限</span>
                      </NText>
                    </div>
                    <div
                      v-if="isSubItemChecked(sub.id)"
                      @click.stop
                    >
                      <NInputNumber
                        :value="selectedSubItems.find((s) => s.subItemId === sub.id)?.quantity ?? 1"
                        :min="1"
                        :max="subItemMax(sub)"
                        button-placement="both"
                        size="small"
                        class="sub-item-quantity"
                        step="1"
                        :precision="0"
                        @update:value="(v) => updateSubItemQuantity(sub.id, v)"
                      />
                    </div>
                  </div>
                </div>
                <div class="sub-item-hint">
                  <NText
                    depth="3"
                    class="form-hint"
                  >
                    * 可多选，价格按所选款式累计计算
                    <span v-if="goods.maxSubItemSelections">
                      （最多选 {{ goods.maxSubItemSelections }} 种，已选 {{ selectedSubItems.length }} 种）
                    </span>
                  </NText>
                </div>
              </div>
            </NFormItem>

            <!-- 单商品数量 -->
            <NFormItem
              v-else
              label="兑换数量"
              required
              class="dialog-form-item"
            >
              <NFlex
                align="center"
                :gap="12"
              >
                <NInputNumber
                  v-model:value="buyCount"
                  :min="1"
                  :max="
                    Math.min(goods.maxBuyCount ?? 100000, (goods.maxBuyCount ?? 100000) - (goods.purchasedCount ?? 0))
                  "
                  button-placement="both"
                  class="quantity-input"
                  step="1"
                  :precision="0"
                />
                <NText
                  depth="3"
                  class="form-hint"
                >
                  {{
                    goods.hasPurchased
                      ? `已兑换 ${goods.purchasedCount} / ${goods.maxBuyCount ?? '∞'}`
                      : `库存 ${goods.count ?? '无限'} · 限购 ${goods.maxBuyCount ?? '无限'}`
                  }}
                </NText>
              </NFlex>
            </NFormItem>

            <!-- 收货地址 -->
            <NFormItem
              v-if="needAddress"
              label="收货地址"
              required
              class="dialog-form-item"
            >
              <NFlex
                vertical
                :gap="8"
                class="field-full"
              >
                <NFlex
                  :gap="8"
                  class="field-full"
                >
                  <NSelect
                    v-model:show="showAddressSelect"
                    :value="selectedAddress?.id"
                    :options="addressOptions"
                    :render-label="renderLabel"
                    :render-option="renderOption"
                    placeholder="请选择收货地址"
                    class="field-grow"
                  />
                  <NButton
                    secondary
                    type="primary"
                    @click="openAddressModal"
                  >
                    <template #icon>
                      <NIcon :component="Add24Regular" />
                    </template>
                  </NButton>
                  <NButton
                    secondary
                    @click="refreshAddressList"
                  >
                    <template #icon>
                      <NIcon :component="ArrowSync24Regular" />
                    </template>
                  </NButton>
                </NFlex>
                <NText
                  depth="3"
                  class="form-hint"
                >
                  可新增或刷新地址，也可前往
                  <NButton
                    text
                    type="primary"
                    size="tiny"
                    @click="NavigateToNewTab('/bili-user/settings')"
                  >
                    账号设置
                  </NButton>
                  管理
                </NText>
              </NFlex>
            </NFormItem>

            <NFormItem
              label="备注信息"
              class="dialog-form-item dialog-form-item--last"
            >
              <NInput
                v-model:value="remark"
                type="textarea"
                placeholder="如有特殊需求请留言（可选）"
                :autosize="{ minRows: 2, maxRows: 4 }"
                maxlength="100"
                show-count
              />
            </NFormItem>
          </NForm>
        </div>
      </NScrollbar>
    </div>

    <!-- 粘性操作栏 -->
    <template #action>
      <div class="dialog-footer">
        <NFlex
          justify="space-between"
          align="center"
          :gap="16"
          wrap
        >
          <NFlex
            align="baseline"
            :gap="4"
          >
            <NText
              depth="3"
              class="footer-label"
            >
              总计
            </NText>
            <NText
              type="primary"
              class="footer-cost"
            >
              {{ cost }}
            </NText>
            <NText
              depth="3"
              class="footer-label"
            >
              积分 · 持有 {{ currentPoint >= 0 ? currentPoint : '--' }}
            </NText>
          </NFlex>

          <NFlex :gap="12">
            <NButton
              :disabled="isLoading"
              @click="requestClose"
            >
              取消
            </NButton>
            <NButton
              type="primary"
              :disabled="!canDoBuy || isLoading"
              :loading="isLoading"
              @click="buyGoods"
            >
              确认兑换
            </NButton>
          </NFlex>
        </NFlex>
        <NText
          v-if="blockedReason"
          type="error"
          class="footer-reason"
        >
          {{ blockedReason }}
        </NText>
      </div>
    </template>
  </NModal>

  <!-- 新增收货地址 -->
  <NModal
    v-model:show="showAddressModal"
    preset="card"
    style="width: min(640px, 95vw)"
    title="新增收货地址"
    :segmented="{ content: true, action: true }"
  >
    <NSpin
      v-if="currentAddress"
      :show="isLoading"
    >
      <NForm
        ref="formRef"
        :model="currentAddress"
        :rules="addressFormRules"
        label-placement="top"
      >
        <NFormItem
          label="地区选择"
          path="area"
          required
        >
          <NGrid
            :cols="24"
            :x-gap="8"
            :y-gap="8"
            class="field-full"
          >
            <NGi :span="12">
              <NSelect
                v-model:value="currentAddress.province"
                :options="provinceOptions"
                placeholder="省份"
                filterable
                @update:value="onAreaSelectChange(0)"
              />
            </NGi>
            <NGi :span="12">
              <NSelect
                :key="currentAddress.province"
                v-model:value="currentAddress.city"
                :options="cityOptions(currentAddress.province)"
                :disabled="!currentAddress.province"
                placeholder="城市"
                filterable
                @update:value="onAreaSelectChange(1)"
              />
            </NGi>
            <NGi :span="12">
              <NSelect
                :key="currentAddress.city"
                v-model:value="currentAddress.district"
                :options="districtOptions(currentAddress.province, currentAddress.city)"
                :disabled="!currentAddress.city"
                placeholder="区/县"
                filterable
                @update:value="onAreaSelectChange(2)"
              />
            </NGi>
            <NGi :span="12">
              <NSelect
                :key="currentAddress.district"
                v-model:value="currentAddress.street"
                :options="streetOptions(currentAddress.province, currentAddress.city, currentAddress.district)"
                :disabled="!currentAddress.district"
                placeholder="街道"
                filterable
              />
            </NGi>
          </NGrid>
        </NFormItem>
        <NFormItem
          label="详细地址"
          path="address"
          required
        >
          <NInput
            v-model:value="currentAddress.address"
            placeholder="请输入详细地址（楼栋号、单元号、门牌号等）"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </NFormItem>
        <NGrid
          :cols="2"
          :x-gap="12"
        >
          <NGi>
            <NFormItem
              label="联系电话"
              path="phone"
              required
            >
              <NInputNumber
                v-model:value="currentAddress.phone"
                placeholder="请输入联系电话"
                :show-button="false"
                class="field-full"
              />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem
              label="联系人"
              path="name"
              required
            >
              <NInput
                v-model:value="currentAddress.name"
                placeholder="请输入联系人姓名"
              />
            </NFormItem>
          </NGi>
        </NGrid>
        <NCheckbox v-model:checked="userAgree"> 我确认以上信息真实有效 </NCheckbox>
      </NForm>
    </NSpin>

    <template #action>
      <NFlex
        justify="end"
        :gap="12"
      >
        <NButton @click="showAddressModal = false"> 取消 </NButton>
        <NButton
          type="primary"
          :disabled="!userAgree || isLoading"
          :loading="isLoading"
          @click="updateAddress"
        >
          保存
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>

<style scoped>
.dialog-header {
  display: flex;
  gap: 14px;
  align-items: flex-start;
  min-width: 0;
}

.header-cover {
  width: 64px;
  height: 64px;
  flex: 0 0 auto;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
}

.header-body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.header-title {
  font-size: 1.1rem;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.header-meta {
  font-size: 12px;
}

.dialog-body {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.dialog-scroll {
  max-height: min(58vh, 560px);
}

.dialog-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 12px 16px 2px;
}

.dialog-alert {
  white-space: normal;
}

.dialog-alert--pre {
  white-space: pre-wrap;
}

.dialog-form :deep(.n-form-item-label) {
  font-weight: 600;
}

.dialog-form-item {
  margin-bottom: 14px;
}

.dialog-form-item--last {
  margin-bottom: 0;
}

.field-full {
  width: 100%;
}

.field-grow {
  flex: 1;
  min-width: 0;
}

.form-hint {
  font-size: 12px;
  line-height: 1.4;
}

.quantity-input {
  width: 140px;
}

/* 款式:窄屏单列,宽屏两列 */
.sub-item-field {
  display: flex;
  width: 100%;
  flex-direction: column;
}

.sub-item-grid {
  display: grid;
  width: 100%;
  gap: 10px;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
}

.sub-item-hint {
  margin-top: 8px;
}

.sub-item-card {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background-color: var(--vtsuru-bg-surface);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.sub-item-card:hover:not(.disabled) {
  border-color: var(--vtsuru-primary);
  background-color: color-mix(in srgb, var(--vtsuru-primary), transparent 95%);
}

.sub-item-card.active {
  border-color: var(--vtsuru-primary);
  background-color: color-mix(in srgb, var(--vtsuru-primary), transparent 90%);
}

.sub-item-card.disabled {
  opacity: 0.6;
  background-color: var(--vtsuru-bg-elevated);
  cursor: not-allowed;
}

.sub-item-cover {
  display: flex;
  width: 44px;
  height: 44px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  background-color: var(--vtsuru-bg-elevated);
}

.sub-item-cover :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.sub-item-info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.sub-item-name {
  font-size: 14px;
}

.sub-item-meta {
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sub-item-quantity {
  width: 92px;
  flex: 0 0 auto;
}

.dialog-footer {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-label {
  font-size: 12px;
}

.footer-cost {
  font-size: 18px;
  font-weight: 700;
}

.footer-reason {
  font-size: 12px;
  text-align: right;
}

@media (max-width: 560px) {
  .sub-item-grid {
    grid-template-columns: 1fr;
  }

  .sub-item-meta {
    white-space: normal;
  }
}
</style>
