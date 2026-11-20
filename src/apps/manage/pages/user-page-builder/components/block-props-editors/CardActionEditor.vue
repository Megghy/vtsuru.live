<script setup lang="ts">
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import PropsGrid from '../PropsGrid.vue'
import { getNavigationTargetType, setNavigationTargetType } from './navigationTargets'

defineProps<{
  action: Record<string, any>
  pageOptions: Array<{ label: string; value: string }>
  label: string
}>()
</script>

<template>
  <PropsGrid>
    <FormField :label="`${label}文字`">
      <Input
        v-model="action.label"
        placeholder="留空则不显示"
      />
    </FormField>
    <FormField :label="`${label}目标类型`">
      <Select
        :model-value="getNavigationTargetType(action)"
        @update:model-value="(value) => setNavigationTargetType(action, value as any)"
      >
        <SelectTrigger>
          <SelectValue :placeholder="`${label}目标类型`" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="page">页面</SelectItem>
          <SelectItem value="external">外链</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField
      :label="`${label}目标`"
      class="span-full"
    >
      <Select
        v-if="action.page"
        v-model="action.page"
      >
        <SelectTrigger>
          <SelectValue placeholder="选择目标页面" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in pageOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Input
        v-else
        v-model="action.url"
        placeholder="https://..."
      />
    </FormField>
  </PropsGrid>
</template>
