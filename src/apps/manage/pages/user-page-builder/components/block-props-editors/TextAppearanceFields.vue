<script setup lang="ts">
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)

const effectOptions = [
  { label: '无', value: 'none' },
  { label: '渐变字', value: 'gradient' },
  { label: '发光', value: 'glow' },
  { label: '高光扫过', value: 'shine' },
  { label: '呼吸', value: 'breathe' },
  { label: '彩虹字', value: 'rainbow' },
  { label: '打字机', value: 'typewriter' },
]
const intensityOptions = [
  { label: '弱', value: 'low' },
  { label: '中', value: 'mid' },
  { label: '强', value: 'high' },
]

const showIntensity = computed(() => {
  const effect = blockProps.value.textEffect
  return typeof effect === 'string' && effect !== 'none'
})
</script>

<template>
  <div class="space-y-1">
    <label class="text-xs text-muted-foreground">文字特效</label>
    <Select v-model="blockProps.textEffect">
      <SelectTrigger class="h-8 text-xs">
        <SelectValue placeholder="选择特效" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in effectOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
  <div v-if="showIntensity" class="space-y-1">
    <label class="text-xs text-muted-foreground">特效强度</label>
    <Select v-model="blockProps.effectIntensity">
      <SelectTrigger class="h-8 text-xs">
        <SelectValue placeholder="选择强度" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem v-for="opt in intensityOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>
</template>
