<script setup lang="ts">
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
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">{{ label }}文字</label>
      <Input
        v-model="action.label"
        placeholder="留空则不显示"
        class="h-8 text-xs"
      />
    </div>
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">{{ label }}目标类型</label>
      <Select
        :model-value="getNavigationTargetType(action)"
        @update:model-value="(value) => setNavigationTargetType(action, value as any)"
      >
        <SelectTrigger class="h-8 text-xs">
          <SelectValue :placeholder="`${label}目标类型`" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="page">页面</SelectItem>
          <SelectItem value="external">外链</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div class="span-full space-y-1">
      <label class="text-xs text-muted-foreground">{{ label }}目标</label>
      <Select
        v-if="action.page"
        v-model="action.page"
      >
        <SelectTrigger class="h-8 text-xs">
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
        class="h-8 text-xs"
      />
    </div>
  </PropsGrid>
</template>
