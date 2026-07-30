<script setup lang="ts">
import { NColorPicker, NForm, NFormItem, NInput, NInputNumber, NSelect } from 'naive-ui'

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
  <NForm
    label-placement="top"
    size="small"
  >
    <PropsGrid>
      <NFormItem
        class="span-full"
        label="内容"
        required
      >
        <NInput
          v-model:value="blockProps.content"
          type="textarea"
          maxlength="500"
          show-count
          :autosize="{ minRows: 2, maxRows: 6 }"
          placeholder="文本或 https 链接"
        />
      </NFormItem>
      <NFormItem
        class="span-full"
        label="标题"
      >
        <NInput
          v-model:value="blockProps.title"
          maxlength="100"
          show-count
          placeholder="可选"
        />
      </NFormItem>
      <NFormItem label="尺寸">
        <NInputNumber
          v-model:value="blockProps.size"
          :min="128"
          :max="512"
          :step="16"
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="纠错等级">
        <NSelect
          v-model:value="blockProps.level"
          :options="levelOptions"
        />
      </NFormItem>
      <NFormItem label="前景色">
        <NColorPicker
          v-model:value="blockProps.foreground"
          :show-alpha="false"
          :modes="['hex']"
        />
      </NFormItem>
      <NFormItem label="背景色">
        <NColorPicker
          v-model:value="blockProps.background"
          :show-alpha="false"
          :modes="['hex']"
        />
      </NFormItem>
      <NFormItem label="边距">
        <NInputNumber
          v-model:value="blockProps.margin"
          :min="0"
          :max="32"
          :step="1"
          style="width: 100%"
        />
      </NFormItem>
    </PropsGrid>
  </NForm>
</template>
