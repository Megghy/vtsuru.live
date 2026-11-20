<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)
</script>

<template>
  <PropsGrid>
    <FormField label="展示人数">
      <Select
        :model-value="String(blockProps.count ?? 3)"
        @update:model-value="(val) => (blockProps.count = Number(val))"
      >
        <SelectTrigger>
          <SelectValue placeholder="展示人数" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="3">前三名</SelectItem>
          <SelectItem value="10">前十名</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <SettingRow
      title="显示本月次数"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showMonthly" />
    </SettingRow>
    <SettingRow
      title="显示累计次数"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showTotal" />
    </SettingRow>
  </PropsGrid>
</template>
