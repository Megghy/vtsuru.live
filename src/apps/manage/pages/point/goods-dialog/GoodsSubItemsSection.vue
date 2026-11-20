<script setup lang="ts">
import Add24Filled from '@vicons/fluent/es/Add24Filled'
import ArrowDown24Filled from '@vicons/fluent/es/ArrowDown24Filled'
import ArrowUp24Filled from '@vicons/fluent/es/ArrowUp24Filled'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import Info24Regular from '@vicons/fluent/es/Info24Regular'
import { ref } from 'vue'

import type { UploadPointGoodsModel } from '@/api/client-types'
import type { TempSubPointGoodsModel } from '@/api/generated/model'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { nextTempSubItemId, type SubItemsSortMode } from './goodsFormHelpers'

const goods = defineModel<UploadPointGoodsModel>('goods', { required: true })
const subItemCoverFiles = defineModel<Record<number, UploadImageItem[]>>('subItemCoverFiles', { required: true })

const sortSelectValue = ref<SubItemsSortMode | ''>('')

const subItemsSortOptions: { label: string; value: SubItemsSortMode }[] = [
  { label: '按名称排序', value: 'name' },
  { label: '按价格排序', value: 'price' },
  { label: '按库存排序', value: 'stock' },
]

function applySubItemsSort(mode: SubItemsSortMode) {
  const list = [...(goods.value.subItems ?? [])]
  if (mode === 'name') {
    list.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN'))
  } else if (mode === 'price') {
    list.sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  } else if (mode === 'stock') {
    list.sort((a, b) => (a.stock ?? Number.MAX_SAFE_INTEGER) - (b.stock ?? Number.MAX_SAFE_INTEGER))
  }
  goods.value.subItems = list
  sortSelectValue.value = ''
}

function addSubItem() {
  const tempId = nextTempSubItemId()
  const list = goods.value.subItems ?? []
  list.push({
    id: tempId,
    name: '',
    price: goods.value.price ?? 100,
    stock: undefined,
    description: undefined,
    isAllowRebuy: undefined,
    maxBuyCount: undefined,
  })
  goods.value.subItems = list
  subItemCoverFiles.value[tempId] = []
}

function removeSubItem(subId: number | null | undefined) {
  const list = goods.value.subItems
  if (!list) return
  const idx = list.findIndex((s) => s.id === subId)
  if (idx !== -1) list.splice(idx, 1)
  if (subId != null) {
    delete subItemCoverFiles.value[subId]
  }
}

function moveSubItem(subId: number | null | undefined, direction: -1 | 1) {
  const list = goods.value.subItems
  if (!list) return
  const idx = list.findIndex((s) => s.id === subId)
  const target = idx + direction
  if (idx < 0 || target < 0 || target >= list.length) return
  const [item] = list.splice(idx, 1)
  list.splice(target, 0, item)
}

function getSubItemIndex(sub: TempSubPointGoodsModel): number {
  const idx = goods.value.subItems?.findIndex((s) => s.id === sub.id) ?? -1
  return idx >= 0 ? idx + 1 : 0
}

function updateSubItemInheritFlag(
  sub: TempSubPointGoodsModel,
  field: 'isAllowRebuy' | 'maxBuyCount',
  inherit: boolean,
) {
  if (field === 'isAllowRebuy') {
    sub.isAllowRebuy = inherit ? undefined : true
  } else {
    sub.maxBuyCount = inherit ? undefined : 1
  }
}
</script>

<template>
  <div class="space-y-3">
    <Alert
      variant="info"
      size="sm"
    >
      <Info24Regular class="size-4" />
      <AlertDescription>
        前台兑换时观众可选择具体款式；款式价格为最终兑换价，库存按款式独立计算，未单独配置的属性沿用主商品。
      </AlertDescription>
    </Alert>

    <div class="flex-between flex-wrap gap-2 pb-2 border-b border-border/60">
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground whitespace-nowrap">单次最多可选:</span>
          <NumberField
            :model-value="goods.maxSubItemSelections ?? 0"
            :min="0"
            class="w-24"
            @update:model-value="goods.maxSubItemSelections = $event ?? 0"
          />
          <span class="text-xs text-muted-foreground">种 (0为不限)</span>
        </div>

        <Select
          :model-value="sortSelectValue"
          @update:model-value="(val) => val && applySubItemsSort(val as SubItemsSortMode)"
        >
          <SelectTrigger class="w-32">
            <SelectValue placeholder="一键排序..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in subItemsSortOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        type="button"
        variant="outline"
        @click="addSubItem"
      >
        <Add24Filled class="size-3.5 mr-1" />
        添加款式
      </Button>
    </div>

    <Empty
      v-if="!goods.subItems?.length"
      description="暂无款式，可按需添加多款式规格"
      class="py-6"
    />

    <div
      v-else
      class="space-y-3"
    >
      <Card
        v-for="sub in goods.subItems"
        :key="sub.id ?? sub.name"
        class="bg-muted/20"
      >
        <CardContent class="p-3 space-y-3">
          <div class="flex-between gap-2">
            <span class="text-xs font-semibold text-primary">款式 #{{ getSubItemIndex(sub) }}</span>
            <div class="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                :disabled="getSubItemIndex(sub) <= 1"
                @click="moveSubItem(sub.id, -1)"
              >
                <ArrowUp24Filled class="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                :disabled="getSubItemIndex(sub) >= (goods.subItems?.length ?? 0)"
                @click="moveSubItem(sub.id, 1)"
              >
                <ArrowDown24Filled class="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                class="text-destructive"
                @click="removeSubItem(sub.id)"
              >
                <Delete24Filled class="size-3.5 mr-1" />
                删除
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div :id="`sub-name-${sub.id}`">
              <FormField
                label="款式名称"
                required
                v-model="sub.name"
                placeholder="如: 粉色 / 大号"
                :maxlength="100"
              />
            </div>
            <div :id="`sub-price-${sub.id}`">
              <FormField
                label="所需积分"
                required
              >
                <NumberField
                  :model-value="sub.price ?? 0"
                  :min="0"
                  @update:model-value="sub.price = $event ?? 0"
                />
              </FormField>
            </div>
            <div :id="`sub-stock-${sub.id}`">
              <FormField label="款式库存">
                <div class="flex items-center gap-2 min-h-8">
                  <div class="flex items-center gap-1.5 shrink-0">
                    <Checkbox
                      :id="`sub-unlimited-${sub.id}`"
                      :checked="sub.stock == null"
                      @update:checked="(v) => (sub.stock = v ? undefined : 10)"
                    />
                    <label
                      :for="`sub-unlimited-${sub.id}`"
                      class="text-xs cursor-pointer"
                    >
                      不限
                    </label>
                  </div>
                  <NumberField
                    v-if="sub.stock != null"
                    :model-value="sub.stock ?? 0"
                    :min="0"
                    class="flex-1"
                    @update:model-value="sub.stock = $event ?? 0"
                  />
                </div>
              </FormField>
            </div>
          </div>

          <Accordion
            type="single"
            collapsible
            class="border-t pt-1"
          >
            <AccordionItem
              value="override"
              class="border-b-0"
            >
              <AccordionTrigger class="py-2 text-xs text-muted-foreground hover:no-underline">
                独立属性覆盖 (可选，默认沿用主商品配置)
              </AccordionTrigger>
              <AccordionContent class="pt-2 space-y-3">
                <FormField
                  v-if="sub.id != null"
                  label="款式封面"
                >
                  <ImageUpload
                    v-model="subItemCoverFiles[sub.id]"
                    :max-files="1"
                    accept="image/*"
                    size="xs"
                  />
                </FormField>

                <FormField
                  label="款式描述"
                  type="textarea"
                  v-model="sub.description"
                  placeholder="留空则沿用主商品描述"
                  :maxlength="500"
                  :rows="2"
                />

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FormField label="允许重购">
                    <div class="flex flex-wrap items-center gap-3 min-h-8">
                      <div class="flex items-center gap-1.5">
                        <Checkbox
                          :id="`sub-rebuy-inherit-${sub.id}`"
                          :checked="sub.isAllowRebuy == null"
                          @update:checked="(v) => updateSubItemInheritFlag(sub, 'isAllowRebuy', Boolean(v))"
                        />
                        <label
                          :for="`sub-rebuy-inherit-${sub.id}`"
                          class="text-xs cursor-pointer"
                        >
                          沿用主商品
                        </label>
                      </div>
                      <div
                        v-if="sub.isAllowRebuy != null"
                        class="flex items-center gap-1.5"
                      >
                        <Checkbox
                          :id="`sub-rebuy-val-${sub.id}`"
                          :checked="Boolean(sub.isAllowRebuy)"
                          @update:checked="(v) => (sub.isAllowRebuy = Boolean(v))"
                        />
                        <label
                          :for="`sub-rebuy-val-${sub.id}`"
                          class="text-xs cursor-pointer"
                        >
                          允许重复兑换
                        </label>
                      </div>
                    </div>
                  </FormField>

                  <div :id="`sub-max-buy-${sub.id}`">
                    <FormField label="单人限购数">
                      <div class="flex items-center gap-2 min-h-8">
                        <div class="flex items-center gap-1.5 shrink-0">
                          <Checkbox
                            :id="`sub-max-inherit-${sub.id}`"
                            :checked="sub.maxBuyCount == null"
                            @update:checked="(v) => updateSubItemInheritFlag(sub, 'maxBuyCount', Boolean(v))"
                          />
                          <label
                            :for="`sub-max-inherit-${sub.id}`"
                            class="text-xs cursor-pointer"
                          >
                            沿用主商品
                          </label>
                        </div>
                        <NumberField
                          v-if="sub.maxBuyCount != null"
                          :model-value="sub.maxBuyCount ?? 1"
                          :min="1"
                          class="flex-1"
                          @update:model-value="sub.maxBuyCount = $event ?? 1"
                        />
                      </div>
                    </FormField>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
