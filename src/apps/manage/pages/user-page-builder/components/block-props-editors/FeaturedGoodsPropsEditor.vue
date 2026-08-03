<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <div class="builder-form">
    <PropsGrid>
      <UFormField label="展示数量">
        <USelect
          v-model="blockProps.count"
          :items="[3, 4, 5, 6].map((value) => ({ label: `${value} 个`, value }))"
        />
      </UFormField>
      <UFormField label="选择方式">
        <USelect
          v-model="blockProps.selection"
          :items="[
            { label: '优先置顶商品', value: 'pinned' },
            { label: '优先库存可用', value: 'available' },
          ]"
        />
      </UFormField>
      <UFormField label="显示商品说明">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showDescription"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示库存状态">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showStock"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
