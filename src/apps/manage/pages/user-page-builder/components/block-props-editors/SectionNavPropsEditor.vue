<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)

function toggleLevel(level: number) {
  const current = Array.isArray(blockProps.value.levels) ? [...blockProps.value.levels] : []
  const idx = current.indexOf(level)
  if (idx >= 0) {
    current.splice(idx, 1)
  } else {
    current.push(level)
  }
  blockProps.value.levels = current
}

function hasLevel(level: number) {
  return Array.isArray(blockProps.value.levels) && blockProps.value.levels.includes(level)
}
</script>

<template>
  <PropsGrid>
    <FormField label="排列方式">
      <Select v-model="blockProps.layout">
        <SelectTrigger>
          <SelectValue placeholder="排列方式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="horizontal">横向</SelectItem>
          <SelectItem value="vertical">纵向</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField label="包含标题级别">
      <div class="flex items-center gap-3 pt-1">
        <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <Checkbox
            :checked="hasLevel(1)"
            @update:checked="() => toggleLevel(1)"
          />
          <span>一级</span>
        </label>
        <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <Checkbox
            :checked="hasLevel(2)"
            @update:checked="() => toggleLevel(2)"
          />
          <span>二级</span>
        </label>
        <label class="flex items-center gap-1.5 text-xs cursor-pointer select-none">
          <Checkbox
            :checked="hasLevel(3)"
            @update:checked="() => toggleLevel(3)"
          />
          <span>三级</span>
        </label>
      </div>
    </FormField>
    <SettingRow
      title="显示序号"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showNumbers" />
    </SettingRow>
  </PropsGrid>
</template>
