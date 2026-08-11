<script setup lang="ts">
import { NFormItem, NSelect } from 'naive-ui'
import { computed } from 'vue'

import type { BlockNode } from '@/apps/user-page/block/schema'

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
  <NFormItem label="文字特效">
    <NSelect
      v-model:value="blockProps.textEffect"
      :options="effectOptions"
    />
  </NFormItem>
  <NFormItem
    v-if="showIntensity"
    label="特效强度"
  >
    <NSelect
      v-model:value="blockProps.effectIntensity"
      :options="intensityOptions"
    />
  </NFormItem>
</template>
