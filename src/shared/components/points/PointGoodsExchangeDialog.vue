<script setup lang="ts">
import { Add24Regular, ArrowSync24Regular } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponsePointGoodModel } from '@/api/client-types'
import type { ResponsePointOrder2UserModel, ShippingAddressInfo } from '@/api/generated/model'
import { GoodsTypes, ServiceFieldType } from '@/api/generated/model'
import { postApiPointBuy, postApiPointUserUpdateAddress } from '@/api/generated/point/point'
import { IMGUR_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Textarea } from '@/shared/ui/textarea'
import { NavigateToNewTab, toast } from '@/shared/utils'
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
const biliAuth = computed(() => useAuth.biliAuth)

const show = defineModel<boolean>('show', { required: true })
const goods = defineModel<ResponsePointGoodModel | undefined>('goods', { required: true })

// --- 状态 ---
const isLoading = ref(false)
const showAddressModal = ref(false)
const currentAddress = ref<ShippingAddressInfo>({} as ShippingAddressInfo)
const userAgree = ref(false)
const buyCount = ref(1)
const selectedAddress = ref<ShippingAddressInfo>()
const remark = ref('')
const serviceAnswers = ref<Record<string, string | string[] | number | undefined>>({})
type BuySubItem = { subItemId: number; quantity: number }
const selectedSubItems = ref<BuySubItem[]>([])
const successOrder = ref<ResponsePointOrder2UserModel>()
const showSuccessModal = ref(false)

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
  if (goods.value.count != null && buyCount.value > goods.value.count) return false
  return pointsOk && (!needAddress.value || !!selectedAddress.value)
})

/** 无法兑换时展示在 footer 的原因 */
const blockedReason = computed(() => {
  if (!goods.value || canDoBuy.value) return ''
  return goods.value.cannotPurchaseReason || '积分不足或条件不满足'
})

/** 已售 / 已购合并为一行摘要 */
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

const addressList = computed(() => biliAuth.value.address ?? [])
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
  currentAddress.value = {} as ShippingAddressInfo
  userAgree.value = false
  showAddressModal.value = true
  await getArea()
}

async function refreshAddressList() {
  if (!useAuth.isAuthed || !biliAuth.value.id) return
  await useAuth.getAuthInfo()
}

async function updateAddress() {
  if (!currentAddress.value.province || !currentAddress.value.city || !currentAddress.value.district) {
    toast.warning('请选择完整的省市区')
    return
  }
  if (!currentAddress.value.address?.trim()) {
    toast.warning('请输入详细地址')
    return
  }
  if (!currentAddress.value.name?.trim()) {
    toast.warning('请输入联系人姓名')
    return
  }
  if (!currentAddress.value.phone) {
    toast.warning('请输入联系电话')
    return
  }
  if (!userAgree.value) {
    toast.warning('请确认信息真实有效')
    return
  }

  isLoading.value = true
  try {
    const data = (await postApiPointUserUpdateAddress(currentAddress.value as any, {
      headers: Object.fromEntries(await useAuth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: ShippingAddressInfo
    }
    if (data.code !== 200) {
      toast.error(`保存失败: ${data.message}`)
      return
    }
    toast.success('地址已保存')
    showAddressModal.value = false
    const list = biliAuth.value.address
    if (list) {
      const index = list.findIndex((a) => a.id === data.data.id)
      if (index >= 0) list[index] = data.data
      else list.push(data.data)
    } else {
      biliAuth.value.address = [data.data]
    }
    selectedAddress.value = data.data
  } finally {
    isLoading.value = false
  }
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
    }
  } else {
    if (buyCount.value < 1) return '兑换数量不能小于1'
    if (!Number.isInteger(buyCount.value)) return '兑换数量必须为整数'
    if ((good.purchasedCount ?? 0) + buyCount.value > (good.maxBuyCount ?? Number.MAX_VALUE))
      return `超出最大兑换次数限制(${good.maxBuyCount})`
    if (good.count != null && buyCount.value > good.count) return '库存不足'
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
    toast.error(invalid)
    return
  }

  isLoading.value = true
  try {
    const data = (await postApiPointBuy(
      {
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
      } as any,
      { headers: Object.fromEntries(await useAuth.getBiliAuthHeaders()) },
    )) as unknown as {
      code: number
      message?: string
      data: ResponsePointOrder2UserModel
    }

    if (data.code !== 200) {
      toast.error(`兑换失败: ${data.message}`)
      return
    }

    show.value = false
    successOrder.value = data.data
    showSuccessModal.value = true
    emit('success')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `兑换出错: ${error}`)
  } finally {
    isLoading.value = false
  }
}

// 关闭即重置
watch(show, (visible) => {
  if (visible) return
  selectedSubItems.value = []
  selectedAddress.value = undefined
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
  <Dialog
    v-if="goods"
    :open="show"
    @update:open="!$event && requestClose()"
  >
    <DialogContent class="sm:max-w-2xl max-h-[88vh] flex flex-col p-4 gap-3">
      <!-- 紧凑头部 -->
      <DialogHeader class="pb-2 border-b border-border/60">
        <div class="flex items-start gap-3">
          <img
            :src="goods.cover ? goods.cover.path : emptyCover"
            class="size-14 rounded-lg object-cover border border-border/80 shrink-0"
            alt="封面"
          />
          <div class="flex-1 min-w-0 flex flex-col gap-1">
            <DialogTitle class="text-sm font-semibold truncate text-foreground">
              {{ goods.name }}
            </DialogTitle>
            <div class="flex items-center gap-1.5 flex-wrap text-xs">
              <Badge
                variant="default"
                class="text-[10px] h-4.5 px-1.5 font-normal"
              >
                {{ priceText }} 积分
              </Badge>
              <Badge
                variant="secondary"
                class="text-[10px] h-4.5 px-1.5 font-normal"
              >
                {{ typeLabel }}
              </Badge>
              <span class="text-muted-foreground text-[11px]">{{ stockText }}</span>
              <span
                v-for="item in statusSummary"
                :key="item"
                class="text-muted-foreground text-[11px]"
              >
                · {{ item }}
              </span>
            </div>
          </div>
        </div>
      </DialogHeader>

      <ScrollArea class="flex-1 min-h-0 pr-4">
        <div class="space-y-3.5 text-xs">
          <Alert
            v-if="rebuyWarning"
            class="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
          >
            <AlertDescription class="text-xs">{{ rebuyWarning }}</AlertDescription>
          </Alert>

          <template v-if="isService">
            <Alert
              v-if="serviceConfig?.rules"
              class="text-xs bg-muted/40 border-border/80"
            >
              <AlertDescription class="text-xs whitespace-pre-wrap leading-relaxed">{{
                serviceConfig.rules
              }}</AlertDescription>
            </Alert>
            <Alert class="text-xs bg-muted/30 border-border/60">
              <AlertDescription class="text-xs text-muted-foreground">
                提交后进入待接单状态<span v-if="serviceConfig?.estimatedDays"
                  >，预计 {{ serviceConfig.estimatedDays }} 天内完成</span
                >。主播确认接单后会在订单中更新进度。
              </AlertDescription>
            </Alert>
          </template>

          <!-- 服务字段表单 -->
          <div
            v-if="serviceConfig?.fields?.length"
            class="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/60"
          >
            <div
              v-for="field in serviceConfig.fields"
              :key="field.id"
              class="space-y-1"
            >
              <label class="font-medium text-foreground text-xs flex items-center gap-1">
                <span>{{ field.label }}</span>
                <span
                  v-if="field.required"
                  class="text-destructive"
                  >*</span
                >
              </label>

              <Select
                v-if="field.type === ServiceFieldType.Select"
                :model-value="(serviceAnswers[field.id] as string) || ''"
                @update:model-value="serviceAnswers[field.id] = String($event)"
              >
                <SelectTrigger>
                  <SelectValue :placeholder="`请选择${field.label}`" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in field.options"
                    :key="opt"
                    :value="opt"
                    class="text-xs"
                  >
                    {{ opt }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Input
                v-else-if="field.type === ServiceFieldType.Date"
                :model-value="(serviceAnswers[field.id] as string) || ''"
                type="date"
                @update:model-value="serviceAnswers[field.id] = $event"
              />

              <Input
                v-else-if="field.type === ServiceFieldType.Number"
                :model-value="serviceAnswers[field.id] == null ? '' : String(serviceAnswers[field.id])"
                type="number"
                step="any"
                @update:model-value="serviceAnswers[field.id] = Number($event) || undefined"
              />

              <Textarea
                v-else-if="field.type === ServiceFieldType.Textarea"
                :model-value="(serviceAnswers[field.id] as string) || ''"
                rows="3"
                :placeholder="`请输入${field.label}`"
                maxlength="2000"
                class="text-xs resize-none"
                @update:model-value="serviceAnswers[field.id] = $event"
              />

              <Input
                v-else
                :model-value="(serviceAnswers[field.id] as string) || ''"
                :type="field.type === ServiceFieldType.Url ? 'url' : 'text'"
                :placeholder="field.type === ServiceFieldType.Url ? '请输入链接' : `请输入${field.label}`"
                maxlength="300"
                @update:model-value="serviceAnswers[field.id] = $event"
              />
            </div>
          </div>

          <!-- 款式选择 -->
          <div
            v-if="hasSubItems"
            class="space-y-2"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-foreground text-xs">选择款式 *</span>
              <span class="text-[11px] text-muted-foreground">
                可多选，价格累计
                <template v-if="goods.maxSubItemSelections"> （最多选 {{ goods.maxSubItemSelections }} 种） </template>
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="sub in goods.subItems ?? []"
                :key="sub.id"
                class="p-2.5 rounded-lg border flex items-center justify-between gap-2.5 transition cursor-pointer select-none"
                :class="
                  isSubItemChecked(sub.id)
                    ? 'border-primary bg-primary/5 shadow-2xs'
                    : isSubItemDisabled(sub.id)
                      ? 'border-border/40 opacity-50 cursor-not-allowed bg-muted/20'
                      : 'border-border/80 hover:bg-muted/30 bg-background'
                "
                @click="toggleSubItem(sub.id, !isSubItemChecked(sub.id))"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <Checkbox
                    :checked="isSubItemChecked(sub.id)"
                    :disabled="isSubItemDisabled(sub.id)"
                    @click.stop
                    @update:checked="toggleSubItem(sub.id, $event)"
                  />
                  <img
                    v-if="sub.cover?.path"
                    :src="sub.cover.path"
                    class="size-10 rounded object-cover border border-border/60 shrink-0"
                    alt=""
                  />
                  <div class="min-w-0 flex flex-col gap-0.5">
                    <div class="flex items-center gap-1.5">
                      <strong class="font-medium text-foreground text-xs truncate">{{ sub.name }}</strong>
                      <Badge
                        variant="secondary"
                        class="text-[10px] h-4 px-1 font-mono shrink-0"
                      >
                        {{ sub.price }}分
                      </Badge>
                    </div>
                    <span class="text-[11px] text-muted-foreground truncate">
                      {{ sub.count === 0 ? '缺货' : sub.count != null ? `余 ${sub.count}` : '库存不限' }}
                    </span>
                  </div>
                </div>

                <div
                  v-if="isSubItemChecked(sub.id) && !isService"
                  class="w-20 shrink-0"
                  @click.stop
                >
                  <NumberField
                    :model-value="selectedSubItems.find((s) => s.subItemId === sub.id)?.quantity ?? 1"
                    :min="1"
                    :max="subItemMax(sub)"
                    @update:model-value="updateSubItemQuantity(sub.id, $event)"
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 单商品数量 -->
          <div
            v-else-if="!isService"
            class="space-y-1.5"
          >
            <div class="flex items-center justify-between">
              <span class="font-medium text-foreground text-xs">兑换数量 *</span>
              <span class="text-[11px] text-muted-foreground">
                {{
                  goods.hasPurchased
                    ? `已兑换 ${goods.purchasedCount} / ${goods.maxBuyCount ?? '∞'}`
                    : `库存 ${goods.count ?? '无限'} · 限购 ${goods.maxBuyCount ?? '无限'}`
                }}
              </span>
            </div>
            <div class="w-32">
              <NumberField
                v-model="buyCount"
                :min="1"
                :max="
                  Math.min(
                    goods.maxBuyCount ?? 100000,
                    (goods.maxBuyCount ?? 100000) - (goods.purchasedCount ?? 0),
                    goods.count ?? 100000,
                  )
                "
              />
            </div>
          </div>

          <!-- 收货地址 -->
          <div
            v-if="needAddress"
            class="space-y-1.5"
          >
            <span class="font-medium text-foreground text-xs">收货地址 *</span>
            <div class="flex items-center gap-2">
              <Select
                :model-value="selectedAddress?.id ? String(selectedAddress.id) : ''"
                class="flex-1"
                @update:model-value="selectedAddress = addressList.find((a) => String(a.id) === $event)"
              >
                <SelectTrigger class="flex-1">
                  <SelectValue placeholder="请选择收货地址" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="addr in addressList"
                    :key="addr.id"
                    :value="String(addr.id)"
                    class="text-xs"
                  >
                    {{ addr.name }} ({{ addr.phone }}) · {{ addr.province }}{{ addr.city }}{{ addr.district
                    }}{{ addr.address }}
                  </SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                class="size-8 shrink-0"
                aria-label="新增收货地址"
                @click="openAddressModal"
              >
                <component
                  :is="Add24Regular"
                  class="size-3.5"
                />
              </Button>
              <Button
                variant="outline"
                size="icon"
                class="size-8 shrink-0"
                aria-label="刷新地址列表"
                @click="refreshAddressList"
              >
                <component
                  :is="ArrowSync24Regular"
                  class="size-3.5"
                />
              </Button>
            </div>
          </div>

          <!-- 留言 -->
          <div class="space-y-1">
            <span class="font-medium text-foreground text-xs">备注留言 (可选)</span>
            <Textarea
              v-model="remark"
              rows="2"
              placeholder="如有特殊需求请留言..."
              maxlength="100"
              class="text-xs resize-none"
            />
          </div>
        </div>
      </ScrollArea>

      <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-between sm:justify-between">
        <div class="flex items-baseline gap-1 text-xs">
          <span class="text-muted-foreground">总计</span>
          <strong class="text-primary font-mono text-base font-semibold">{{ cost }}</strong>
          <span class="text-muted-foreground">积分 · 持有 {{ currentPoint >= 0 ? currentPoint : '--' }}</span>
        </div>

        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            :disabled="isLoading"
            @click="requestClose"
          >
            取消
          </Button>

          <Popconfirm
            title="确认兑换"
            positive-text="确认"
            negative-text="取消"
            :disabled="!canDoBuy || isLoading"
            @positive-click="buyGoods"
          >
            <template #trigger>
              <Button :disabled="!canDoBuy || isLoading"> 确认兑换 </Button>
            </template>
            确定要花费 {{ cost }} 积分兑换 "{{ goods.name }}" 吗？
          </Popconfirm>
        </div>
      </DialogFooter>

      <p
        v-if="blockedReason"
        class="text-destructive text-xs text-right -mt-1 m-0"
      >
        {{ blockedReason }}
      </p>
    </DialogContent>
  </Dialog>

  <!-- 新增收货地址弹窗 -->
  <Dialog v-model:open="showAddressModal">
    <DialogContent class="sm:max-w-md p-4 space-y-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold">新增收货地址</DialogTitle>
      </DialogHeader>

      <div class="space-y-3 text-xs">
        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">省份</label>
            <Select
              :model-value="currentAddress.province || ''"
              @update:model-value="
                currentAddress.province = String($event)
                onAreaSelectChange(0)
              "
            >
              <SelectTrigger>
                <SelectValue placeholder="省份" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in provinceOptions"
                  :key="p.value"
                  :value="p.value"
                  class="text-xs"
                >
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">城市</label>
            <Select
              :model-value="currentAddress.city || ''"
              :disabled="!currentAddress.province"
              @update:model-value="
                currentAddress.city = String($event)
                onAreaSelectChange(1)
              "
            >
              <SelectTrigger>
                <SelectValue placeholder="城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="c in cityOptions(currentAddress.province)"
                  :key="c.value"
                  :value="c.value"
                  class="text-xs"
                >
                  {{ c.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">区县</label>
            <Select
              :model-value="currentAddress.district || ''"
              :disabled="!currentAddress.city"
              @update:model-value="
                currentAddress.district = String($event)
                onAreaSelectChange(2)
              "
            >
              <SelectTrigger>
                <SelectValue placeholder="区/县" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="d in districtOptions(currentAddress.province, currentAddress.city)"
                  :key="d.value"
                  :value="d.value"
                  class="text-xs"
                >
                  {{ d.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">街道 (选填)</label>
            <Select
              :model-value="currentAddress.street || ''"
              :disabled="!currentAddress.district"
              @update:model-value="currentAddress.street = $event ? String($event) : undefined"
            >
              <SelectTrigger>
                <SelectValue placeholder="街道" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="s in streetOptions(currentAddress.province, currentAddress.city, currentAddress.district)"
                  :key="s.value"
                  :value="s.value"
                  class="text-xs"
                >
                  {{ s.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-muted-foreground text-[11px]">详细地址</label>
          <Textarea
            v-model="currentAddress.address"
            rows="2"
            placeholder="楼栋号、单元号、门牌号等"
            class="text-xs resize-none"
          />
        </div>

        <div class="grid grid-cols-2 gap-2">
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">联系电话</label>
            <Input
              :model-value="currentAddress.phone ? String(currentAddress.phone) : ''"
              type="tel"
              placeholder="手机号"
              class="font-mono"
              @update:model-value="currentAddress.phone = Number($event) || undefined"
            />
          </div>
          <div class="space-y-1">
            <label class="text-muted-foreground text-[11px]">联系人</label>
            <Input
              v-model="currentAddress.name"
              placeholder="姓名"
            />
          </div>
        </div>

        <label class="flex items-center gap-1.5 cursor-pointer pt-1">
          <Checkbox v-model:checked="userAgree" />
          <span class="text-xs text-foreground">我确认以上收件信息真实有效</span>
        </label>
      </div>

      <DialogFooter class="pt-2 border-t border-border/60">
        <Button
          variant="outline"
          @click="showAddressModal = false"
        >
          取消
        </Button>
        <Button
          :disabled="!userAgree || isLoading"
          @click="updateAddress"
        >
          保存地址
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- 兑换成功弹窗 -->
  <Dialog
    v-if="successOrder"
    v-model:open="showSuccessModal"
  >
    <DialogContent class="sm:max-w-md p-4 space-y-3">
      <DialogHeader class="pb-2 border-b border-border/60">
        <DialogTitle class="text-sm font-semibold text-emerald-600 flex items-center gap-1.5"> 兑换成功！ </DialogTitle>
      </DialogHeader>

      <div class="space-y-3 text-xs">
        <p class="text-muted-foreground font-mono">订单号: #{{ successOrder.id }}</p>

        <template v-if="successOrder.selectedSubItems?.length">
          <Separator />
          <div class="space-y-1">
            <span class="text-[11px] font-medium text-muted-foreground block">已选款式</span>
            <p class="text-foreground">
              {{ successOrder.selectedSubItems.map((s) => `${s.nameSnapshot}×${s.quantity}`).join('、') }}
            </p>
          </div>
        </template>

        <template v-if="successOrder.type === GoodsTypes.Virtual && successOrder.goods?.content">
          <Separator />
          <div class="space-y-1">
            <span class="text-[11px] font-medium text-muted-foreground block">礼物内容</span>
            <Alert class="text-xs bg-muted/40 whitespace-pre-wrap break-words">
              <AlertDescription class="text-xs">{{ successOrder.goods.content }}</AlertDescription>
            </Alert>
          </div>
        </template>
      </div>

      <DialogFooter class="pt-2 border-t border-border/60 flex items-center justify-end gap-2">
        <Button
          variant="outline"
          @click="showSuccessModal = false"
        >
          关闭
        </Button>
        <Button
          @click="
            showSuccessModal = false
            router.push({ name: 'bili-user-orders' })
          "
        >
          查看我的订单
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
