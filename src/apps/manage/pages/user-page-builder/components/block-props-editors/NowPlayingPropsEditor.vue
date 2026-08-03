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
      <UFormField label="显示点歌用户">
        <div class="builder-row">
          <USwitch
            v-model="blockProps.showRequester"
            size="small"
          />
        </div>
      </UFormField>
    </PropsGrid>
  </div>
</template>
