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
      <UFormField label="排列方式">
        <USelect
          v-model="blockProps.layout"
          :items="[
            { label: '横向', value: 'horizontal' },
            { label: '纵向', value: 'vertical' },
          ]"
        />
      </UFormField>
      <UFormField label="包含标题级别">
        <UCheckboxGroup
          v-model="blockProps.levels"
          :items="[
            { label: '一级', value: '1' },
            { label: '二级', value: '2' },
            { label: '三级', value: '3' },
          ]"
        />
      </UFormField>
      <UFormField label="显示序号">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showNumbers"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
