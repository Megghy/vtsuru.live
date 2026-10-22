<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import ColorPicker from '@/shared/ui/color-picker/ColorPicker.vue'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
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
  <div v-if="propertyAvailable('align')" class="space-y-1">
    <label class="text-xs text-muted-foreground">对齐方式</label>
    <Select v-model="blockProps.align">
      <SelectTrigger>
        <SelectValue placeholder="对齐方式" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in alignOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div v-if="propertyAvailable('fullWidth')" class="flex items-center justify-between py-1">
    <label class="text-xs text-muted-foreground">按钮铺满宽度</label>
    <Switch v-model:checked="blockProps.fullWidth" />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">按钮类型</label>
    <Select v-model="blockProps.type">
      <SelectTrigger>
        <SelectValue placeholder="按钮类型" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in typeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">样式变体</label>
    <Select v-model="blockProps.variant">
      <SelectTrigger>
        <SelectValue placeholder="样式变体" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in variantOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">尺寸</label>
    <Select v-model="blockProps.size">
      <SelectTrigger>
        <SelectValue placeholder="尺寸" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in sizeOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">形态</label>
    <Select v-model="blockProps.radius">
      <SelectTrigger>
        <SelectValue placeholder="形态" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in radiusOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div v-if="propertyAvailable('radiusPx')" class="space-y-1">
    <label class="text-xs text-muted-foreground">圆角 px</label>
    <NInputNumber
      v-model:value="blockProps.radiusPx"
      :min="0"
      :max="48"
      class="w-full"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">背景色</label>
    <ColorPicker
      :value="colorValue('color')"
      :show-alpha="true"
      @update:value="(value) => setColor('color', value)"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">文字色</label>
    <ColorPicker
      :value="colorValue('textColor')"
      :show-alpha="true"
      @update:value="(value) => setColor('textColor', value)"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">边框粗细</label>
    <NInputNumber
      v-model:value="blockProps.borderWidth"
      :min="0"
      :max="8"
      class="w-full"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">边框颜色</label>
    <ColorPicker
      :value="colorValue('borderColor')"
      :show-alpha="true"
      @update:value="(value) => setColor('borderColor', value)"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">透明度</label>
    <NInputNumber
      v-model:value="blockProps.opacity"
      :min="0.15"
      :max="1"
      :step="0.05"
      class="w-full"
    />
  </div>

  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">特效</label>
    <Select v-model="blockProps.effect">
      <SelectTrigger>
        <SelectValue placeholder="选择特效" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in effectOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div v-if="blockProps.effect && blockProps.effect !== 'none'" class="space-y-1">
    <label class="text-xs text-muted-foreground">特效强度</label>
    <Select v-model="blockProps.effectIntensity">
      <SelectTrigger>
        <SelectValue placeholder="特效强度" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in intensityOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
