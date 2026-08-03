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
      <UFormField label="最多展示">
        <UInputNumber
          v-model="blockProps.count"
          :min="1"
          :max="6"
          :precision="0"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="显示活动说明">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showDescription"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示投稿进度">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showProgress"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
