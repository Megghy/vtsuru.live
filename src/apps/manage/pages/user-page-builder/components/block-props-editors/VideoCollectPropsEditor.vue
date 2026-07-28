<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NFlex, NForm, NFormItem, NInputNumber, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="最多展示">
        <NInputNumber v-model:value="blockProps.count" :min="1" :max="6" :precision="0" style="width: 100%" />
      </NFormItem>
      <NFormItem label="显示活动说明">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showDescription" size="small" />
        </NFlex>
      </NFormItem>
      <NFormItem label="显示投稿进度">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showProgress" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
