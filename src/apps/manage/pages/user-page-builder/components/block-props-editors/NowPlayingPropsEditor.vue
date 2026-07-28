<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NFlex, NForm, NFormItem, NSwitch } from 'naive-ui'
import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <NForm label-placement="top" size="small">
    <PropsGrid>
      <NFormItem label="显示点歌用户">
        <NFlex justify="end">
          <NSwitch v-model:value="blockProps.showRequester" size="small" />
        </NFlex>
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
