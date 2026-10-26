<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import type { ResponsePointOrder2UserModel, ShippingAddressInfo } from '@/api/generated/model'
import { GoodsTypes, ServiceFieldType } from '@/api/generated/model'
import { postApiPointBuy } from '@/api/generated/point/point'
import { IMGUR_URL } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import ShippingAddressPicker from './ShippingAddressPicker.vue'
import { evaluateSelection, usePointCart, type BuySubItem } from './usePointCart'

const props = defineProps<{
  /** 直播间主播 ID */
  vId: number
  /** 当前用户在该直播间的积分 */
  currentPoint: number
}>()

const emit = defineEmits<{
  /** 兑换成功后通知父级展示订单并刷新积分与礼物列表 */
  success: [orders: ResponsePointOrder2UserModel[]]
}>()

const useAuth = useBiliAuth()
const cart = usePointCart(props.vId)

const show = defineModel<boolean>('show', { required: true })
const goods = defineModel<ResponsePointGoodModel | undefined>('goods', { required: true })

// --- 状态 ---
const isLoading = ref(false)
const buyCount = ref(1)
const selectedSubItems = ref<BuySubItem[]>([])
const selectedAddress = ref<ShippingAddressInfo>()
const remark = ref('')
const serviceAnswers = ref<Record<string, string | string[] | number | undefined>>({})

const emptyCover = `${IMGUR_URL}None.png`

// --- 基础派生 ---
const hasSubItems = computed(() => (goods.value?.subItems?.length ?? 0) > 0)
const isService = computed(() => goods.value?.type === GoodsTypes.Service)
const serviceConfig = computed(() => (isService.value ? goods.value?.serviceConfig : undefined))
const inCart = computed(() => !!goods.value && !!cart.find(goods.value.id))

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

const availableSubs = computed(() => goods.value?.subItems?.filter((s) => s.count == null || s.count > 0) ?? [])

/** 头部价格:多款式取区间,单商品取自身价 */
const priceText = computed(() => {
  if (!goods.value) return ''
  if (!hasSubItems.value || !availableSubs.value.length) return String(goods.value.price)
  const prices = availableSubs.value.map((s) => Number(s.price))
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
  if (!availableSubs.value.length) return '缺货'
  const limited = availableSubs.value.filter((s) => s.count != null)
  if (!limited.length) return '库存不限'
  return `余 ${limited.reduce((acc, s) => acc + (s.count ?? 0), 0)}`
})

/** 当前选择,加入购物车与直接兑换共用 */
const selection = computed(() =>
  hasSubItems.value
    ? {
        count: selectedSubItems.value.reduce((acc, s) => acc + s.quantity, 0),
        selectedSubItems: selectedSubItems.value,
        remark: remark.value || undefined,
      }
    : { count: buyCount.value, remark: remark.value || undefined },
)

const evaluated = computed(() =>
  goods.value ? evaluateSelection(goods.value, selection.value) : { cost: 0, needAddress: false },
)
const cost = computed(() => evaluated.value.cost)
const needAddress = computed(() => evaluated.value.needAddress)

/** 款式/数量/服务表单错误,不含积分与地址;加入购物车只需此项通过 */
const selectionError = computed(() => {
  const good = goods.value
  if (!good) return ''
  if (!good.canPurchase) return good.cannotPurchaseReason || '当前无法兑换'

  if (hasSubItems.value) {
    if (!selectedSubItems.value.length) return '请选择至少一个款式'
    const max = good.maxSubItemSelections
    if (max && max > 0 && selectedSubItems.value.length > max) return `最多选择 ${max} 种款式`
    const subMap = new Map((good.subItems ?? []).map((s) => [Number(s.id), s]))
    for (const s of selectedSubItems.value) {
      const sub = subMap.get(Number(s.subItemId))
      if (!sub) return '款式数据异常,请刷新后重试'
      if (sub.count === 0) return `${sub.name} 缺货`
      if (s.quantity < 1 || !Number.isInteger(s.quantity)) return '款式数量必须为正整数'
      if (sub.count != null && s.quantity > sub.count) return `${sub.name} 库存不足`
    }
  } else {
    if (buyCount.value < 1 || !Number.isInteger(buyCount.value)) return '兑换数量必须为正整数'
    if ((good.purchasedCount ?? 0) + buyCount.value > (good.maxBuyCount ?? Number.MAX_VALUE))
      return `超出最大兑换次数限制(${good.maxBuyCount})`
    if (good.count != null && buyCount.value > good.count) return '库存不足'
  }

  const missing = (serviceConfig.value?.fields ?? []).find((field) => {
    const answer = serviceAnswers.value[field.id]
    return field.required && (Array.isArray(answer) ? !answer.length : !String(answer ?? '').trim())
  })
  return missing ? `请填写${missing.label}` : ''
})

const buyError = computed(
  () =>
    selectionError.value ||
    (cost.value > props.currentPoint ? '积分不足' : '') ||
    (needAddress.value && !selectedAddress.value ? '请选择收货地址' : ''),
)

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
  return selectedSubItems.value.some((s) => Number(s.subItemId) === Number(id))
}

function isSubItemDisabled(id: number) {
  const sub = goods.value?.subItems?.find((s) => Number(s.id) === Number(id))
  if (!sub || sub.count === 0) return true
  const max = goods.value?.maxSubItemSelections
  if (!max || max <= 0) return false
  return selectedSubItems.value.length >= max && !isSubItemChecked(id)
}

function toggleSubItem(id: number, checked: boolean) {
  const targetId = Number(id)
  if (!checked) {
    selectedSubItems.value = selectedSubItems.value.filter((s) => Number(s.subItemId) !== targetId)
    return
  }
  if (isSubItemDisabled(targetId) || isSubItemChecked(targetId)) return
  selectedSubItems.value = [...selectedSubItems.value, { subItemId: targetId, quantity: 1 }]
}

function updateSubItemQuantity(id: number, quantity: number | null) {
  selectedSubItems.value = selectedSubItems.value.map((s) =>
    Number(s.subItemId) === Number(id) ? { ...s, quantity: Number(quantity ?? 1) } : s,
  )
}

function subItemMax(sub: { maxBuyCount?: number | null; count?: number | null }) {
  return Math.min(sub.maxBuyCount ?? 100000, sub.count ?? 100000)
}

function addToCart() {
  const updated = inCart.value
  cart.put({ goodsId: goods.value!.id, ...selection.value })
  toast.success(updated ? '已更新购物车' : '已加入购物车')
  show.value = false
}

async function buyGoods() {
  const good = goods.value!
  isLoading.value = true
  try {
    const data = (await postApiPointBuy(
      {
        vId: props.vId,
        goodsId: good.id,
        count: selection.value.count,
        addressId: selectedAddress.value?.id ?? null,
        remark: remark.value,
        selectedSubItems: hasSubItems.value ? selectedSubItems.value : null,
        serviceAnswers: isService.value
          ? Object.fromEntries(
              Object.entries(serviceAnswers.value).map(([id, value]) => [
                id,
                Array.isArray(value) ? value.join('\n') : value == null ? '' : String(value),
              ]),
            )
          : undefined,
      },
      { headers: Object.fromEntries(await useAuth.getBiliAuthHeaders()) },
    )) as unknown as { code: number; message?: string; data: ResponsePointOrder2UserModel }

    if (data.code !== 200) {
      toast.error(`兑换失败: ${data.message}`)
      return
    }

    // 已直接兑换的礼物从购物车移除,避免重复兑换
    cart.remove(good.id)
    show.value = false
    emit('success', [data.data])
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `兑换出错: ${error}`)
  } finally {
    isLoading.value = false
  }
}

// 打开时按购物车中的选择回填,否则重置
watch(show, (visible) => {
  if (!visible || !goods.value) return
  const saved = cart.find(goods.value.id)
  buyCount.value = saved?.count ?? 1
  selectedSubItems.value = saved?.selectedSubItems?.map((s) => ({ ...s })) ?? []
  remark.value = saved?.remark ?? ''
  selectedAddress.value = undefined
  serviceAnswers.value = {}
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
                class="p-2.5 rounded-lg border flex flex-col gap-2 transition cursor-pointer select-none"
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
                  class="flex items-center justify-between gap-2 pt-2 border-t border-primary/15 cursor-default"
                  @click.stop
                >
                  <span class="text-[11px] text-muted-foreground">数量</span>
                  <NumberField
                    :model-value="selectedSubItems.find((s) => s.subItemId === sub.id)?.quantity ?? 1"
                    :min="1"
                    :max="subItemMax(sub)"
                    class="w-28"
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
            <NumberField
              v-model="buyCount"
              :min="1"
              :max="Math.min((goods.maxBuyCount ?? 100000) - (goods.purchasedCount ?? 0), goods.count ?? 100000)"
              class="w-32"
            />
          </div>

          <ShippingAddressPicker
            v-if="needAddress"
            v-model="selectedAddress"
          />

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
          <Button
            v-if="!isService"
            variant="secondary"
            :disabled="!!selectionError || isLoading"
            @click="addToCart"
          >
            {{ inCart ? '更新购物车' : '加入购物车' }}
          </Button>

          <Popconfirm
            title="确认兑换"
            positive-text="确认"
            negative-text="取消"
            :disabled="!!buyError || isLoading"
            @positive-click="buyGoods"
          >
            <template #trigger>
              <Button :disabled="!!buyError || isLoading"> 确认兑换 </Button>
            </template>
            确定要花费 {{ cost }} 积分兑换 "{{ goods.name }}" 吗？
          </Popconfirm>
        </div>
      </DialogFooter>

      <p
        v-if="buyError"
        class="text-destructive text-xs text-right -mt-1 m-0"
      >
        {{ buyError }}
      </p>
    </DialogContent>
  </Dialog>
</template>
