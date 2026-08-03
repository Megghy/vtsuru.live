<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, propertyAvailable } = useBlockPropsEditor(() => props.block)

const alignOptions = [
  { label: '左对齐', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'end' },
]
const typeOptions = ['primary', 'default', 'info', 'success', 'warning', 'error'].map((value) => ({
  label: value,
  value,
}))
const variantOptions = ['solid', 'secondary', 'tertiary', 'quaternary', 'ghost'].map((value) => ({
  label: value,
  value,
}))
</script>

<template>
  <UFormField
    v-if="propertyAvailable('align')"
    label="对齐方式"
  >
    <USelect
      v-model="blockProps.align"
      :items="alignOptions"
    />
  </UFormField>
  <UFormField
    v-if="propertyAvailable('fullWidth')"
    label="按钮铺满宽度"
  >
    <div class="builder-row">
      <USwitch
        v-model="blockProps.fullWidth"
        size="small"
      />
    </div>
  </UFormField>
  <UFormField label="按钮类型">
    <USelect
      v-model="blockProps.type"
      :items="typeOptions"
    />
  </UFormField>
  <UFormField label="样式">
    <USelect
      v-model="blockProps.variant"
      :items="variantOptions"
    />
  </UFormField>
</template>
