<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid>
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">展示人数</label>
      <Select :model-value="String(blockProps.count ?? 3)" @update:model-value="(val) => (blockProps.count = Number(val))">
        <SelectTrigger>
          <SelectValue placeholder="展示人数" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">前三名</SelectItem>
          <SelectItem value="10">前十名</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示本月次数</label>
      <Switch v-model:checked="blockProps.showMonthly" />
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示累计次数</label>
      <Switch v-model:checked="blockProps.showTotal" />
    </div>
  </PropsGrid>
</template>
