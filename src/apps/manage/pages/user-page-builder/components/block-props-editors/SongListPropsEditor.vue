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
      <UFormField label="样式">
        <USelect
          v-model="blockProps.variant"
          :items="[
            { label: '紧凑', value: 'compact' },
            { label: '完整', value: 'full' },
          ]"
        />
      </UFormField>
      <UFormField label="最多显示">
        <UInputNumber
          v-model="blockProps.maxItems"
          :min="3"
          :max="30"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="显示搜索">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showSearch"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示点歌方式">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showRequestStatus"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
