<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NFlex, NForm, NFormItem, NInputNumber, NSelect, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="样式">
        <NSelect v-model:value="blockProps.variant" :options="[{ label: '紧凑', value: 'compact' }, { label: '完整', value: 'full' }]" />
      </NFormItem>
      <NFormItem label="最多显示">
        <NInputNumber v-model:value="blockProps.maxItems" :min="3" :max="30" style="width: 100%" />
      </NFormItem>
      <NFormItem label="显示搜索">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showSearch" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示点歌方式">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showRequestStatus" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
