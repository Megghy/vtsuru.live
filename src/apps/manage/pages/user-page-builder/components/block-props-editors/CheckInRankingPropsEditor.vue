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
      <UFormField label="展示人数">
        <USelect
          v-model="blockProps.count"
          :items="[
            { label: '前三名', value: 3 },
            { label: '前十名', value: 10 },
          ]"
        />
      </UFormField>
      <UFormField label="显示本月次数">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showMonthly"
            size="small"
          />
        </div>
      </UFormField>
      <UFormField label="显示累计次数">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showTotal"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
