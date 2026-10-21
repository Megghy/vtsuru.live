<script setup lang="ts">
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { editor, propertyValues } = useBlockPropsEditor(() => props.block)
type LayoutProps = ReturnType<typeof editor.ensureLayoutProps>
const layout = computed(() => editor.ensureLayoutProps(props.block))

const horizontalJustifyOptions = [
  { label: 'start - 靠左', value: 'start' },
  { label: 'center - 居中', value: 'center' },
  { label: 'end - 靠右', value: 'end' },
  { label: 'between - 两端对齐', value: 'between' },
  { label: 'around - 环绕分布', value: 'around' },
  { label: 'evenly - 均匀分布', value: 'evenly' },
]
const verticalJustifyOptions = horizontalJustifyOptions.map((option) => ({
  ...option,
  label: option.label
    .replace('靠左', '靠上')
    .replace('靠右', '靠下')
    .replace('两端对齐', '上下两端对齐')
    .replace('环绕分布', '上下环绕分布')
    .replace('均匀分布', '上下均匀分布'),
}))
const horizontalAlignOptions = [
  { label: 'start - 靠左', value: 'start' },
  { label: 'center - 居中', value: 'center' },
  { label: 'end - 靠右', value: 'end' },
  { label: 'stretch - 拉伸/等高', value: 'stretch' },
]
const verticalAlignOptions = horizontalAlignOptions.map((option) => ({
  ...option,
  label: option.label.replace('靠左', '靠上').replace('靠右', '靠下'),
}))

const horizontalModel = computed<string>({
  get: () => (layout.value.layout === 'column' ? layout.value.align : layout.value.justify),
  set(value) {
    if (layout.value.layout === 'column') layout.value.align = value as LayoutProps['align']
    else layout.value.justify = value as LayoutProps['justify']
  },
})
const verticalModel = computed<string>({
  get: () => (layout.value.layout === 'column' ? layout.value.justify : layout.value.align),
  set(value) {
    if (layout.value.layout === 'column') layout.value.justify = value as LayoutProps['justify']
    else layout.value.align = value as LayoutProps['align']
  },
})
const horizontalOptions = computed(() => {
  if (layout.value.layout === 'column') return horizontalAlignOptions
  const values = propertyValues('justify')
  return values
    ? horizontalJustifyOptions.filter((option) => values.includes(option.value as 'start' | 'center' | 'end'))
    : horizontalJustifyOptions
})
const verticalOptions = computed(() =>
  layout.value.layout === 'column' ? verticalJustifyOptions : verticalAlignOptions,
)
</script>

<template>
  <div class="space-y-3">
    <div class="text-xs font-semibold">
      布局设置
    </div>
    <PropsGrid
      :col-gap="8"
      :row-gap="0"
    >
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">布局类型</label>
        <Select v-model="layout.layout">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="布局类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="row">Row - 横向</SelectItem>
            <SelectItem value="column">Column - 纵向</SelectItem>
            <SelectItem value="grid">Grid - 网格</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        v-if="layout.layout === 'row'"
        class="flex items-center justify-between py-1"
      >
        <label class="text-xs text-muted-foreground">允许换行</label>
        <Switch v-model:checked="layout.wrap" />
      </div>

      <div
        v-if="layout.layout === 'grid'"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground">列数</label>
        <NInputNumber
          v-model:value="layout.columns"
          :min="1"
          :max="12"
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">间距</label>
        <NInputNumber
          v-model:value="layout.gap"
          :min="0"
          :max="80"
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">最大宽度</label>
        <input
          v-model="layout.maxWidth"
          placeholder="如 100% / 480px"
          class="flex h-8 w-full rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">横向对齐</label>
        <Select v-model="horizontalModel">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="横向对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in horizontalOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">纵向对齐</label>
        <Select v-model="verticalModel">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="纵向对齐" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in verticalOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </PropsGrid>
    <div class="mt-3 rounded p-2 text-xs text-muted-foreground bg-muted/50 leading-relaxed">
      子区块请在「区块管理」中管理：选中多个区块点击「成组」按钮，或拖入已展开的组。
    </div>
  </div>
</template>
