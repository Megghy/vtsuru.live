<script setup lang="ts">
import { NFlex, NForm, NFormItem, NInput, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'

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
  <NForm
    label-placement="top"
    size="small"
  >
    <NText
      strong
      style="display: block; margin-bottom: 8px; font-size: 13px"
    >
      布局设置
    </NText>
    <PropsGrid
      :col-gap="8"
      :row-gap="0"
    >
      <NFormItem label="布局类型">
        <NSelect
          v-model:value="layout.layout"
          :options="[
            { label: 'Row - 横向', value: 'row' },
            { label: 'Column - 纵向', value: 'column' },
            { label: 'Grid - 网格', value: 'grid' },
          ]"
        />
      </NFormItem>
      <NFormItem
        v-if="layout.layout === 'row'"
        label="允许换行"
      >
        <NFlex justify="end">
          <NSwitch
            v-model:value="layout.wrap"
            size="small"
          />
        </NFlex>
      </NFormItem>
      <NFormItem
        v-if="layout.layout === 'grid'"
        label="列数"
      >
        <NInputNumber
          v-model:value="layout.columns"
          :min="1"
          :max="12"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="间距">
        <NInputNumber
          v-model:value="layout.gap"
          :min="0"
          :max="80"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="最大宽度">
        <NInput
          v-model:value="layout.maxWidth"
          placeholder="如 100% / 480px"
        />
      </NFormItem>
      <NFormItem label="横向对齐">
        <NSelect
          v-model:value="horizontalModel"
          :options="horizontalOptions"
        />
      </NFormItem>
      <NFormItem label="纵向对齐">
        <NSelect
          v-model:value="verticalModel"
          :options="verticalOptions"
        />
      </NFormItem>
    </PropsGrid>
    <NText
      depth="3"
      style="
        display: block;
        margin-top: 12px;
        padding: 6px 8px;
        background: var(--vtsuru-bg-muted);
        border-radius: 4px;
        font-size: 12px;
        line-height: 1.5;
      "
    >
      子区块请在「区块管理」中管理：选中多个区块点击「成组」按钮，或拖入已展开的组。
    </NText>
  </NForm>
</template>
