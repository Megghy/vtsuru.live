<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
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
    <FormField label="样式">
      <Select v-model="blockProps.variant">
        <SelectTrigger>
          <SelectValue placeholder="样式" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="compact">紧凑</SelectItem>
          <SelectItem value="full">完整</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField label="最多显示">
      <NumberField
        v-model="blockProps.maxItems"
        :min="3"
        :max="30"
        class="w-full"
      />
    </FormField>
    <SettingRow
      title="显示搜索"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showSearch" />
    </SettingRow>
    <SettingRow
      title="显示点歌方式"
      variant="none"
      class="py-1"
    >
      <Switch v-model:checked="blockProps.showRequestStatus" />
    </SettingRow>
    <SettingRow
      title="允许块内快捷点歌"
      variant="none"
      class="py-1"
    >
      <Switch
        :checked="blockProps.allowQuickRequest !== false"
        @update:checked="blockProps.allowQuickRequest = $event"
      />
    </SettingRow>
  </PropsGrid>
</template>
