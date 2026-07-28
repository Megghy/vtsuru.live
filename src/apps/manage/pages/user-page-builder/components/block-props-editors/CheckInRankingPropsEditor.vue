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
      <NFormItem label="展示人数">
        <NSelect v-model:value="blockProps.count" :options="[{ label: '前三名', value: 3 }, { label: '前十名', value: 10 }]" />
      </NFormItem>
      <NFormItem label="显示本月次数">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showMonthly" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示累计次数">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showTotal" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
