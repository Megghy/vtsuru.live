<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示点歌用户</label>
      <Switch v-model:checked="blockProps.showRequester" />
    </div>
  </PropsGrid>
</template>
