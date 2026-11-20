<script setup lang="ts">
import { computed } from 'vue'

import type { UploadPointGoodsModel } from '@/api/client-types'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Separator } from '@/shared/ui/separator'

const goods = defineModel<UploadPointGoodsModel>('goods', { required: true })

function toDatetimeLocalValue(ts?: number | null) {
  if (!ts || ts <= 0) return ''
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(val: string): number | undefined {
  if (!val) return undefined
  const ms = new Date(val).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

const saleStartInput = computed({
  get: () => toDatetimeLocalValue(goods.value.saleStartTime),
  set: (v: string) => {
    goods.value.saleStartTime = fromDatetimeLocalValue(v)
  },
})

const saleEndInput = computed({
  get: () => toDatetimeLocalValue(goods.value.saleEndTime),
  set: (v: string) => {
    goods.value.saleEndTime = fromDatetimeLocalValue(v)
  },
})

const hasDiscount = computed({
  get: () => goods.value.discountPrice != null,
  set: (enabled: boolean) => {
    if (enabled) {
      const suggested = Math.max(0, Math.floor((goods.value.price ?? 0) * 0.8))
      goods.value.discountPrice = suggested
    } else {
      goods.value.discountPrice = undefined
      goods.value.discountStartTime = undefined
      goods.value.discountEndTime = undefined
    }
  },
})

const discountStartInput = computed({
  get: () => toDatetimeLocalValue(goods.value.discountStartTime),
  set: (v: string) => {
    goods.value.discountStartTime = fromDatetimeLocalValue(v)
  },
})

const discountEndInput = computed({
  get: () => toDatetimeLocalValue(goods.value.discountEndTime),
  set: (v: string) => {
    goods.value.discountEndTime = fromDatetimeLocalValue(v)
  },
})

function setQuickDiscountRatio(ratio: number) {
  const base = Number(goods.value.price ?? 0)
  goods.value.discountPrice = Math.max(0, Number((base * ratio).toFixed(2)))
}
</script>

<template>
  <div class="space-y-4 text-xs">
    <!-- 定时上下架窗口 -->
    <div class="space-y-2.5">
      <div class="flex-between">
        <span class="font-medium text-foreground">定时售卖时间窗</span>
        <Button
          v-if="goods.saleStartTime || goods.saleEndTime"
          type="button"
          variant="ghost"
          size="xs"
          class="text-muted-foreground"
          @click="((goods.saleStartTime = undefined), (goods.saleEndTime = undefined))"
        >
          清空时间窗
        </Button>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div id="goods-sale-start">
          <FormField
            label="开售时间"
            extra="留空表示立即开售"
          >
            <Input
              v-model="saleStartInput"
              type="datetime-local"
            />
          </FormField>
        </div>
        <div id="goods-sale-end">
          <FormField
            label="停售时间"
            extra="留空表示长期可售"
          >
            <Input
              v-model="saleEndInput"
              type="datetime-local"
            />
          </FormField>
        </div>
      </div>
    </div>

    <Separator />

    <!-- 限时折扣 -->
    <div class="space-y-3">
      <div class="flex-between gap-2">
        <label class="flex items-center gap-2 cursor-pointer font-medium text-foreground">
          <Checkbox
            :checked="hasDiscount"
            @update:checked="(v) => (hasDiscount = Boolean(v))"
          />
          <span>启用限时折扣价</span>
        </label>

        <div
          v-if="hasDiscount && (goods.price ?? 0) > 0"
          class="flex items-center gap-1"
        >
          <Button
            type="button"
            variant="outline"
            size="xs"
            @click="setQuickDiscountRatio(0.9)"
          >
            9折
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            @click="setQuickDiscountRatio(0.8)"
          >
            8折
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            @click="setQuickDiscountRatio(0.5)"
          >
            5折
          </Button>
        </div>
      </div>

      <div
        v-if="hasDiscount"
        class="space-y-3 rounded-lg border border-border/70 p-3 bg-muted/20"
      >
        <div id="goods-discount-price">
          <FormField
            label="折后积分"
            extra="若礼物配置了多款式，所有款式在折扣期间将按同比例折算"
          >
            <NumberField
              :model-value="goods.discountPrice ?? 0"
              :min="0"
              @update:model-value="goods.discountPrice = $event ?? 0"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="折扣开始时间"
            extra="留空表示保存后立即生效"
          >
            <Input
              v-model="discountStartInput"
              type="datetime-local"
            />
          </FormField>
          <div id="goods-discount-end">
            <FormField
              label="折扣结束时间"
              extra="留空表示持续特惠"
            >
              <Input
                v-model="discountEndInput"
                type="datetime-local"
              />
            </FormField>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
