<script setup lang="ts">
import { Delete24Regular, Edit24Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import type { ResponsePointOrder2UserModel, ShippingAddressInfo } from '@/api/generated/model'
import { postApiPointBuyBatch } from '@/api/generated/point/point'
import { IMGUR_URL } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import ShippingAddressPicker from './ShippingAddressPicker.vue'
import { evaluateSelection, usePointCart, type PointCartItem } from './usePointCart'

const props = defineProps<{
  vId: number
  currentPoint: number
  /** 当前礼物列表,购物车条目以此为准校验 */
  goods: ResponsePointGoodModel[]
}>()

const emit = defineEmits<{
  /** 多款式礼物需回到兑换弹窗修改 */
  edit: [goods: ResponsePointGoodModel]
  success: [orders: ResponsePointOrder2UserModel[]]
}>()

const show = defineModel<boolean>('show', { required: true })

const useAuth = useBiliAuth()
const cart = usePointCart(props.vId)
const isLoading = ref(false)
const selectedAddress = ref<ShippingAddressInfo>()
const emptyCover = `${IMGUR_URL}None.png`

function simpleMax(good: ResponsePointGoodModel) {
  return Math.min((good.maxBuyCount ?? 100000) - (good.purchasedCount ?? 0), good.count ?? 100000)
}

/** 礼物信息可能在加入后变化,结算前逐项按最新数据校验 */
function lineError(item: PointCartItem, good: ResponsePointGoodModel | undefined) {
  if (!good) return '礼物已下架或不存在'
  if (!good.canPurchase) return good.cannotPurchaseReason || '当前无法兑换'
  if (!item.selectedSubItems?.length) return item.count > simpleMax(good) ? '超出库存或限购' : ''
  const subMap = new Map((good.subItems ?? []).map((s) => [Number(s.id), s]))
  const invalid = item.selectedSubItems.find((s) => {
    const sub = subMap.get(Number(s.subItemId))
    return !sub || (sub.count != null && s.quantity > sub.count)
  })
  return invalid ? '所选款式已变更或库存不足' : ''
}

const goodsMap = computed(() => new Map(props.goods.map((g) => [g.id, g])))

const lines = computed(() =>
  cart.items.value.map((item) => {
    const good = goodsMap.value.get(item.goodsId)
    const subNames = new Map((good?.subItems ?? []).map((s) => [Number(s.id), s.name]))
    return {
      item,
      good,
      error: lineError(item, good),
      ...(good ? evaluateSelection(good, item) : { cost: 0, needAddress: false }),
      subText: item.selectedSubItems
        ?.map((s) => `${subNames.get(Number(s.subItemId)) ?? '未知款式'}×${s.quantity}`)
        .join('、'),
    }
  }),
)

const total = computed(() => Number(lines.value.reduce((acc, l) => acc + l.cost, 0).toFixed(2)))
const needAddress = computed(() => lines.value.some((l) => l.needAddress))

const checkoutError = computed(() => {
  if (!lines.value.length) return '购物车是空的'
  if (lines.value.some((l) => l.error)) return '请先处理无法兑换的礼物'
  if (total.value > props.currentPoint) return `积分不足(需要${total.value}, 当前${props.currentPoint})`
  if (needAddress.value && !selectedAddress.value) return '请选择收货地址'
  return ''
})

function updateCount(item: PointCartItem, count: number | null) {
  cart.put({ ...item, count: Number(count ?? 1) })
}

async function checkout() {
  isLoading.value = true
  try {
    const data = (await postApiPointBuyBatch(
      {
        vId: props.vId,
        items: cart.items.value.map((i) => ({
          goodsId: i.goodsId,
          count: i.count,
          selectedSubItems: i.selectedSubItems,
          remark: i.remark,
        })),
        addressId: needAddress.value ? selectedAddress.value?.id : undefined,
      },
      { headers: Object.fromEntries(await useAuth.getBiliAuthHeaders()) },
    )) as unknown as { code: number; message?: string; data: ResponsePointOrder2UserModel[] }

    if (data.code !== 200) {
      toast.error(`兑换失败: ${data.message}`)
      return
    }

    cart.clear()
    show.value = false
    emit('success', data.data)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : `兑换出错: ${error}`)
  } finally {
    isLoading.value = false
  }
}
</script>
<template>
  <Sheet v-model:open="show">
    <SheetContent class="w-full sm:max-w-md flex flex-col p-4 gap-3">
      <SheetHeader class="pb-2 border-b border-border/60">
        <SheetTitle class="text-sm font-semibold">购物车 ({{ lines.length }})</SheetTitle>
      </SheetHeader>

      <Empty
        v-if="!lines.length"
        description="购物车是空的，去挑选礼物吧~"
        class="py-12"
      />

      <ScrollArea
        v-else
        class="flex-1 min-h-0 pr-3"
      >
        <div class="space-y-2 text-xs">
          <div
            v-for="line in lines"
            :key="line.item.goodsId"
            class="p-2.5 rounded-lg border flex gap-2.5"
            :class="line.error ? 'border-destructive/50 bg-destructive/5' : 'border-border/80'"
          >
            <img
              :src="line.good?.cover?.path ?? emptyCover"
              class="size-12 rounded object-cover border border-border/60 shrink-0"
              alt=""
            />
            <div class="flex-1 min-w-0 flex flex-col gap-1">
              <div class="flex items-center justify-between gap-2">
                <strong class="font-medium text-foreground truncate">{{ line.good?.name ?? '未知礼物' }}</strong>
                <span class="font-mono text-primary shrink-0">{{ line.cost }} 分</span>
              </div>
              <p
                v-if="line.subText"
                class="text-muted-foreground truncate"
              >
                {{ line.subText }}
              </p>
              <p
                v-if="line.item.remark"
                class="text-muted-foreground truncate"
              >
                备注: {{ line.item.remark }}
              </p>
              <p
                v-if="line.error"
                class="text-destructive"
              >
                {{ line.error }}
              </p>

              <div class="flex items-center justify-end gap-1.5 mt-auto">
                <NumberField
                  v-if="line.good && !line.item.selectedSubItems?.length"
                  :model-value="line.item.count"
                  :min="1"
                  :max="Math.max(simpleMax(line.good), 1)"
                  class="w-28"
                  @update:model-value="updateCount(line.item, $event)"
                />
                <Button
                  v-if="line.good"
                  variant="ghost"
                  size="icon"
                  class="size-7"
                  aria-label="修改"
                  @click="emit('edit', line.good)"
                >
                  <component
                    :is="Edit24Regular"
                    class="size-3.5"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  class="size-7 text-muted-foreground hover:text-destructive"
                  aria-label="移除"
                  @click="cart.remove(line.item.goodsId)"
                >
                  <component
                    :is="Delete24Regular"
                    class="size-3.5"
                  />
                </Button>
              </div>
            </div>
          </div>

          <ShippingAddressPicker
            v-if="needAddress"
            v-model="selectedAddress"
          />
        </div>
      </ScrollArea>

      <SheetFooter class="pt-2 border-t border-border/60 flex-col gap-2 sm:flex-col">
        <div class="flex items-baseline justify-between text-xs">
          <span class="text-muted-foreground">
            总计 <strong class="text-primary font-mono text-base font-semibold">{{ total }}</strong> 积分
          </span>
          <span class="text-muted-foreground">持有 {{ currentPoint >= 0 ? currentPoint : '--' }}</span>
        </div>
        <p
          v-if="checkoutError && lines.length"
          class="text-destructive text-xs m-0"
        >
          {{ checkoutError }}
        </p>
        <div class="flex items-center justify-end gap-2">
          <Popconfirm
            title="清空购物车"
            positive-text="清空"
            negative-text="取消"
            :disabled="!lines.length || isLoading"
            @positive-click="cart.clear()"
          >
            <template #trigger>
              <Button
                variant="outline"
                :disabled="!lines.length || isLoading"
              >
                清空
              </Button>
            </template>
            确定清空购物车吗？
          </Popconfirm>
          <Popconfirm
            title="确认兑换"
            positive-text="确认"
            negative-text="取消"
            :disabled="!!checkoutError || isLoading"
            @positive-click="checkout"
          >
            <template #trigger>
              <Button :disabled="!!checkoutError || isLoading">结算 ({{ lines.length }})</Button>
            </template>
            确定要花费 {{ total }} 积分兑换这 {{ lines.length }} 个礼物吗？任一礼物失败将整单取消。
          </Popconfirm>
        </div>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
