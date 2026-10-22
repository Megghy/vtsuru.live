<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { ResponsePointGoodModel } from '@/api/api-models'
import { GoodsStatus } from '@/api/api-models'
import { fetchPublicPointGoods } from '@/apps/user-page/api'
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Checkbox } from '@/shared/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, blockProps } = useBlockPropsEditor(() => props.block)

const goods = ref<ResponsePointGoodModel[]>([])
const goodsLoading = ref(false)
const goodsLoadError = ref(false)
const selectedGoodsIds = computed<number[]>({
  get: () => (Array.isArray(blockProps.value.goodsIds) ? blockProps.value.goodsIds : []),
  set: (value) => {
    blockProps.value.goodsIds = value
  },
})

async function loadGoods() {
  const userId = editor.account.value?.id
  if (!userId) return
  goodsLoading.value = true
  goodsLoadError.value = false
  try {
    goods.value = (await fetchPublicPointGoods(userId)).filter((item) => item.status === GoodsStatus.Normal)
  } catch {
    goodsLoadError.value = true
  } finally {
    goodsLoading.value = false
  }
}

function toggleGood(id: number) {
  const current = [...selectedGoodsIds.value]
  const idx = current.indexOf(id)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    if (current.length >= 6) return
    current.push(id)
  }
  selectedGoodsIds.value = current
}

watch(
  () => editor.account.value?.id,
  () => void loadGoods(),
  { immediate: true },
)
</script>

<template>
  <div class="space-y-3">
    <PropsGrid>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">自动展示数量</label>
        <Select
          :model-value="String(blockProps.count ?? 4)"
          @update:model-value="(val) => (blockProps.count = Number(val))"
        >
          <SelectTrigger>
            <SelectValue placeholder="展示数量" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="val in [3, 4, 5, 6]"
              :key="val"
              :value="String(val)"
            >
              {{ val }} 个
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">选择方式</label>
        <Select v-model="blockProps.selection">
          <SelectTrigger>
            <SelectValue placeholder="选择方式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pinned">优先置顶商品</SelectItem>
            <SelectItem value="available">优先库存可用</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">手动选择礼物 (最多6个)</label>
        <Popover>
          <PopoverTrigger as-child>
            <button
              type="button"
              class="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <span class="truncate">
                {{
                  selectedGoodsIds.length ? `已选 ${selectedGoodsIds.length} 个商品` : '不选择时使用上面的自动选择方式'
                }}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent class="w-64 p-2 space-y-1 max-h-60 overflow-y-auto">
            <div
              v-if="goodsLoading"
              class="py-2 text-center text-xs text-muted-foreground"
            >
              加载中...
            </div>
            <div
              v-else-if="goods.length === 0"
              class="py-2 text-center text-xs text-muted-foreground"
            >
              暂无可选手办/礼物
            </div>
            <div
              v-for="item in goods"
              :key="item.id"
              class="flex items-center gap-2 p-1.5 rounded hover:bg-muted text-xs cursor-pointer"
              @click="toggleGood(item.id)"
            >
              <Checkbox :checked="selectedGoodsIds.includes(item.id)" />
              <span class="truncate flex-1">{{ item.name }}</span>
              <span class="text-muted-foreground shrink-0">{{ item.price }}积分</span>
            </div>
          </PopoverContent>
        </Popover>
        <div
          v-if="goodsLoadError"
          class="text-xs text-destructive mt-1"
        >
          礼物列表加载失败，请稍后重试
        </div>
      </div>

      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示商品说明</label>
        <Switch v-model:checked="blockProps.showDescription" />
      </div>

      <div class="flex items-center justify-between py-1">
        <label class="text-xs text-muted-foreground">显示库存状态</label>
        <Switch v-model:checked="blockProps.showStock" />
      </div>
    </PropsGrid>
  </div>
</template>
