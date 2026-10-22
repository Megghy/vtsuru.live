<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { NumberField } from '@/shared/ui/number-field'
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
      <label class="text-xs text-muted-foreground">样式</label>
      <Select v-model="blockProps.variant">
        <SelectTrigger>
          <SelectValue placeholder="样式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="compact">紧凑</SelectItem>
          <SelectItem value="full">完整</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">最多显示</label>
      <NumberField
        v-model="blockProps.maxItems"
        :min="3"
        :max="30"
        class="w-full"
      />
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示搜索</label>
      <Switch v-model:checked="blockProps.showSearch" />
    </div>
    <div class="flex items-center justify-between py-1">
      <label class="text-xs text-muted-foreground">显示点歌方式</label>
      <Switch v-model:checked="blockProps.showRequestStatus" />
    </div>
  </PropsGrid>
</template>
