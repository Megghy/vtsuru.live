<script setup lang="ts">
import { NFlex, NForm, NFormItem, NSelect, NSwitch, NText } from 'naive-ui'
import { computed, ref, watch } from 'vue'

import type { ResponsePointGoodModel } from '@/api/api-models'
import { GoodsStatus } from '@/api/api-models'
import { fetchPublicPointGoods } from '@/apps/user-page/api'
import type { BlockNode } from '@/apps/user-page/block/schema'

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
const goodsOptions = computed(() =>
  goods.value.map((item) => ({ label: `${item.name} · ${item.price} 积分`, value: item.id })),
)

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

function updateSelectedGoods(value: Array<string | number>) {
  selectedGoodsIds.value = value
    .map(Number)
    .filter((id) => Number.isInteger(id) && id > 0)
    .slice(0, 6)
}

watch(
  () => editor.account.value?.id,
  () => void loadGoods(),
  { immediate: true },
)
</script>

<template>
  <NForm
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="自动展示数量">
        <NSelect
          v-model:value="blockProps.count"
          :options="[3, 4, 5, 6].map((value) => ({ label: `${value} 个`, value }))"
        />
      </NFormItem>
      <NFormItem label="选择方式">
        <NSelect
          v-model:value="blockProps.selection"
          :options="[
            { label: '优先置顶商品', value: 'pinned' },
            { label: '优先库存可用', value: 'available' },
          ]"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="手动选择礼物"
      >
        <NSelect
          :value="selectedGoodsIds"
          multiple
          clearable
          filterable
          :loading="goodsLoading"
          :options="goodsOptions"
          placeholder="不选择时使用上面的自动选择方式"
          @update:value="updateSelectedGoods"
        />
        <NText
          v-if="goodsLoadError"
          depth="3"
          style="font-size: 12px"
        >
          礼物列表加载失败，请稍后重试
        </NText>
      </NFormItem>
      <NFormItem label="显示商品说明">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showDescription"
            size="small"
          />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示库存状态">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showStock"
            size="small"
          />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
