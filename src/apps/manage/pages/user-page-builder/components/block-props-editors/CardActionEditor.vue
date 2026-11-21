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
          <SelectItem value="page">站内页面</SelectItem>
          <SelectItem value="external">外部链接</SelectItem>
          <SelectItem value="copy">复制文本</SelectItem>
          <SelectItem value="back">返回上页</SelectItem>
        </SelectContent>
      </Select>
    </FormField>
    <FormField
      :label="getNavigationTargetType(action) === 'copy' ? `${label}复制内容` : `${label}目标`"
      class="span-full"
    >
      <Select
        v-if="getNavigationTargetType(action) === 'page'"
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
      <div
        v-else-if="getNavigationTargetType(action) === 'copy'"
        class="space-y-2"
      >
        <Input
          v-model="action.copyText"
          placeholder="点击后自动复制的文本..."
        />
        <Input
          v-model="action.copiedMessage"
          placeholder="复制成功提示（可选）"
        />
      </div>
      <Input
        v-else-if="getNavigationTargetType(action) === 'external'"
        v-model="action.url"
        placeholder="https://..."
      />
      <span
        v-else
        class="text-xs text-muted-foreground"
      >
        点击后返回上一页
      </span>
    </FormField>
  </PropsGrid>
</template>
