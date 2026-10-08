<script setup lang="ts">
import { NColorPicker, NFlex, NFormItem, NInputNumber, NSelect, NSwitch } from 'naive-ui'

import type { BlockNode } from '@/apps/user-page/block/schema'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps, propertyAvailable } = useBlockPropsEditor(() => props.block)

const alignOptions = [
  { label: '左对齐', value: 'start' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'end' },
]
const typeOptions = [
  { label: '默认 (Default)', value: 'default' },
  { label: '主要品牌色 (Primary)', value: 'primary' },
  { label: '信息蓝 (Info)', value: 'info' },
  { label: '成功绿 (Success)', value: 'success' },
  { label: '警告黄 (Warning)', value: 'warning' },
  { label: '危险红 (Error)', value: 'error' },
]
const variantOptions = [
  { label: '实心填充 (solid)', value: 'solid' },
  { label: '次级柔色 (secondary)', value: 'secondary' },
  { label: '轻量描边 (tertiary)', value: 'tertiary' },
  { label: '纯文字无框 (quaternary)', value: 'quaternary' },
  { label: '幽灵边框 (ghost)', value: 'ghost' },
]
const sizeOptions = [
  { label: '小 (sm)', value: 'sm' },
  { label: '中 (md)', value: 'md' },
  { label: '大 (lg)', value: 'lg' },
]
const radiusOptions = [
  { label: '默认圆角', value: 'default' },
  { label: '胶囊全圆', value: 'pill' },
  { label: '硬朗直角', value: 'sharp' },
  { label: '自定义数值', value: 'custom' },
]
const effectOptions = [
  { label: '无', value: 'none' },
  { label: '脉冲缩放', value: 'pulse' },
  { label: '呼吸光晕', value: 'breathe' },
  { label: '轻跳', value: 'bounce' },
  { label: '晃动', value: 'wiggle' },
  { label: '常亮光晕', value: 'glow' },
  { label: 'RGB 炫彩', value: 'rainbow' },
]
const intensityOptions = [
  { label: '弱', value: 'low' },
  { label: '中', value: 'mid' },
  { label: '强', value: 'high' },
]

function colorValue(key: 'color' | 'textColor' | 'borderColor') {
  const value = blockProps.value[key]
  return typeof value === 'string' ? value : null
}

function setColor(key: 'color' | 'textColor' | 'borderColor', value: string | null) {
  blockProps.value[key] = value || undefined
}
</script>

<template>
  <NFormItem
    v-if="propertyAvailable('align')"
    label="对齐方式"
  >
    <NSelect
      v-model:value="blockProps.align"
      :options="alignOptions"
    />
  </NFormItem>
  <NFormItem
    v-if="propertyAvailable('fullWidth')"
    label="按钮铺满宽度"
  >
    <NFlex justify="end">
      <NSwitch
        v-model:value="blockProps.fullWidth"
        size="small"
      />
    </NFlex>
  </NFormItem>
  <NFormItem label="按钮类型">
    <NSelect
      v-model:value="blockProps.type"
      :options="typeOptions"
    />
  </NFormItem>
  <NFormItem label="样式变体">
    <NSelect
      v-model:value="blockProps.variant"
      :options="variantOptions"
    />
  </NFormItem>
  <NFormItem label="尺寸">
    <NSelect
      v-model:value="blockProps.size"
      :options="sizeOptions"
    />
  </NFormItem>
  <NFormItem label="形态">
    <NSelect
      v-model:value="blockProps.radius"
      :options="radiusOptions"
    />
  </NFormItem>
  <NFormItem
    v-if="propertyAvailable('radiusPx')"
    label="圆角 px"
  >
    <NInputNumber
      v-model:value="blockProps.radiusPx"
      :min="0"
      :max="48"
      style="width: 100%"
    />
  </NFormItem>
  <NFormItem label="背景色">
    <NColorPicker
      :value="colorValue('color')"
      :show-alpha="true"
      :modes="['hex']"
      @update:value="(value) => setColor('color', value)"
    />
  </NFormItem>
  <NFormItem label="文字色">
    <NColorPicker
      :value="colorValue('textColor')"
      :show-alpha="true"
      :modes="['hex']"
      @update:value="(value) => setColor('textColor', value)"
    />
  </NFormItem>
  <NFormItem label="边框粗细">
    <NInputNumber
      v-model:value="blockProps.borderWidth"
      :min="0"
      :max="8"
      style="width: 100%"
    />
  </NFormItem>
  <NFormItem label="边框颜色">
    <NColorPicker
      :value="colorValue('borderColor')"
      :show-alpha="true"
      :modes="['hex']"
      @update:value="(value) => setColor('borderColor', value)"
    />
  </NFormItem>
  <NFormItem label="透明度">
    <NInputNumber
      v-model:value="blockProps.opacity"
      :min="0.15"
      :max="1"
      :step="0.05"
      style="width: 100%"
    />
  </NFormItem>
  <NFormItem label="特效">
    <NSelect
      v-model:value="blockProps.effect"
      :options="effectOptions"
    />
  </NFormItem>
  <NFormItem
    v-if="blockProps.effect && blockProps.effect !== 'none'"
    label="特效强度"
  >
    <NSelect
      v-model:value="blockProps.effectIntensity"
      :options="intensityOptions"
    />
  </NFormItem>
</template>
