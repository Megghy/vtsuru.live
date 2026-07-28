<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NFlex, NForm, NFormItem, NSelect, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="展示数量">
        <NSelect
          v-model:value="blockProps.count"
          :options="[3, 4, 5, 6].map(value => ({ label: `${value} 个`, value }))"
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
      <NFormItem label="显示商品说明">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showDescription" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示库存状态">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showStock" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
