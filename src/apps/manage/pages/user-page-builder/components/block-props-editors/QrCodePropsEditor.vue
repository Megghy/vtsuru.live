<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'

import PropsGrid from '../PropsGrid.vue'
import { useBlockPropsEditor } from './useBlockPropsEditor'

const props = defineProps<{ block: BlockNode }>()
const { blockProps } = useBlockPropsEditor(() => props.block)

const levelOptions = [
  { label: '低 (L)', value: 'L' },
  { label: '中 (M)', value: 'M' },
  { label: '较高 (Q)', value: 'Q' },
  { label: '高 (H)', value: 'H' },
]
</script>

<template>
  <div class="builder-form">
    <PropsGrid>
      <UFormField
        class="span-full"
        label="内容"
        required
      >
        <UTextarea
          v-model="blockProps.content"
          maxlength="500"
          show-count
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="文本或 https 链接"
        />
      </UFormField>
      <UFormField
        class="span-full"
        label="标题"
      >
        <UInput
          v-model="blockProps.title"
          maxlength="100"
          show-count
          placeholder="可选"
        />
      </UFormField>
      <UFormField label="尺寸">
        <UInputNumber
          v-model="blockProps.size"
          :min="128"
          :max="512"
          :step="16"
          style="width: 100%"
        />
      </UFormField>
      <UFormField label="纠错等级">
        <USelect
          v-model="blockProps.level"
          :items="levelOptions"
        />
      </UFormField>
      <UFormField label="前景色">
        <UColorPicker
          v-model="blockProps.foreground"
          :show-alpha="false"
          :modes="['hex']"
        />
      </UFormField>
      <UFormField label="背景色">
        <UColorPicker
          v-model="blockProps.background"
          :show-alpha="false"
          :modes="['hex']"
        />
      </UFormField>
      <UFormField label="边距">
        <UInputNumber
          v-model="blockProps.margin"
          :min="0"
          :max="32"
          :step="1"
          style="width: 100%"
        />
      </UFormField>
    </PropsGrid>
  </div>
</template>
