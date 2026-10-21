<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid>
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">最多展示</label>
      <NInputNumber
        v-model:value="blockProps.count"
        :min="1"
        :max="6"
        class="w-full"
      />
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示活动说明</label>
      <Switch v-model:checked="blockProps.showDescription" />
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示投稿进度</label>
      <Switch v-model:checked="blockProps.showProgress" />
    </div>
  </PropsGrid>
</template>
