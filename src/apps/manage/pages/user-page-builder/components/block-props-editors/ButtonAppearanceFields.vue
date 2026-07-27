<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NFlex, NFormItem, NSelect, NSwitch } from 'naive-ui'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)

const alignOptions = [
  { label: '左对齐', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'end' },
]
const typeOptions = ['primary', 'default', 'info', 'success', 'warning', 'error'].map(value => ({ label: value, value }))
const variantOptions = ['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'].map(value => ({ label: value, value }))
</script>

<template>
  <NFormItem label="对齐方式">
    <NSelect v-model:value="blockProps.align" :options="alignOptions" />
  </NFormItem>
  <NFormItem label="按钮铺满宽度">
    <NFlex justify="end">
      <NSwitch v-model:value="blockProps.fullWidth" size="small" />
    </NFlex>
  </NFormItem>
  <NFormItem label="按钮类型">
    <NSelect v-model:value="blockProps.type" :options="typeOptions" />
  </NFormItem>
  <NFormItem label="样式">
    <NSelect v-model:value="blockProps.variant" :options="variantOptions" />
  </NFormItem>
</template>
