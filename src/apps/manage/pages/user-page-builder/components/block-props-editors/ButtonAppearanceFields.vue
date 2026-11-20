<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import ColorPicker from '@/shared/ui/color-picker/ColorPicker.vue'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

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
  <FormField
    v-if="propertyAvailable('align')"
    label="对齐方式"
  >
    <Select v-model="blockProps.align">
      <SelectTrigger>
        <SelectValue placeholder="对齐方式" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in alignOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <SettingRow
    v-if="propertyAvailable('fullWidth')"
    title="按钮铺满宽度"
    variant="none"
    class="py-1"
  >
    <Switch v-model:checked="blockProps.fullWidth" />
  </SettingRow>

  <FormField label="按钮类型">
    <Select v-model="blockProps.type">
      <SelectTrigger>
        <SelectValue placeholder="按钮类型" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in typeOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <FormField label="样式变体">
    <Select v-model="blockProps.variant">
      <SelectTrigger>
        <SelectValue placeholder="样式变体" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in variantOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <FormField label="尺寸">
    <Select v-model="blockProps.size">
      <SelectTrigger>
        <SelectValue placeholder="尺寸" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in sizeOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <FormField label="形态">
    <Select v-model="blockProps.radius">
      <SelectTrigger>
        <SelectValue placeholder="形态" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in radiusOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <FormField
    v-if="propertyAvailable('radiusPx')"
    label="圆角 px"
  >
    <NumberField
      v-model="blockProps.radiusPx"
      :min="0"
      :max="48"
      class="w-full"
    />
  </FormField>

  <FormField label="背景色">
    <ColorPicker
      :value="colorValue('color')"
      :show-alpha="true"
      @update:value="(value) => setColor('color', value)"
    />
  </FormField>

  <FormField label="文字色">
    <ColorPicker
      :value="colorValue('textColor')"
      :show-alpha="true"
      @update:value="(value) => setColor('textColor', value)"
    />
  </FormField>

  <FormField label="边框粗细">
    <NumberField
      v-model="blockProps.borderWidth"
      :min="0"
      :max="8"
      class="w-full"
    />
  </FormField>

  <FormField label="边框颜色">
    <ColorPicker
      :value="colorValue('borderColor')"
      :show-alpha="true"
      @update:value="(value) => setColor('borderColor', value)"
    />
  </FormField>

  <FormField label="透明度">
    <NumberField
      v-model="blockProps.opacity"
      :min="0.15"
      :max="1"
      :step="0.05"
      class="w-full"
    />
  </FormField>

  <FormField label="特效">
    <Select v-model="blockProps.effect">
      <SelectTrigger>
        <SelectValue placeholder="选择特效" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in effectOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>

  <FormField
    v-if="blockProps.effect && blockProps.effect !== 'none'"
    label="特效强度"
  >
    <Select v-model="blockProps.effectIntensity">
      <SelectTrigger>
        <SelectValue placeholder="特效强度" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in intensityOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </FormField>
</template>
