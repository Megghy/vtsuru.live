<script setup lang="ts">
import { NCheckboxGroup, NFlex, NForm, NFormItem, NSelect, NSwitch } from 'naive-ui'

import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem label="排列方式">
        <NSelect
          v-model:value="blockProps.layout"
          :options="[
            { label: '横向', value: 'horizontal' },
            { label: '纵向', value: 'vertical' },
          ]"
        />
      </NFormItem>
      <NFormItem label="包含标题级别">
        <NCheckboxGroup
          v-model:value="blockProps.levels"
          :options="[
            { label: '一级', value: 1 },
            { label: '二级', value: 2 },
            { label: '三级', value: 3 },
          ]"
        />
      </NFormItem>
      <NFormItem label="显示序号">
        <NFlex justify="end">
          <NSwitch
            v-model:value="blockProps.showNumbers"
            size="small"
          />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
