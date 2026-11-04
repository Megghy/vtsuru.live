<script setup lang="ts">
import type { DanmujiStyle } from '@/shared/danmujiStyle'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'

const style = defineModel<DanmujiStyle>({ required: true })
const presets = [
  { label: '经典列表', value: 'classic' },
  { label: '气泡', value: 'bubble' },
  { label: '极简', value: 'minimal' },
]
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
    <FormField
      type="select"
      label="外观预设"
      :options="presets"
      v-model="style.preset"
    />

    <FormField
      type="number"
      label="字号"
      :min="10"
      :max="72"
      v-model="style.fontSize"
    />

    <FormField
      type="number"
      label="不透明度"
      :min="0"
      :max="1"
      :step="0.1"
      v-model="style.opacity"
    />

    <FormField
      type="number"
      label="消息保留秒数（0 为不隐藏）"
      :min="0"
      :max="3600"
      v-model="style.autoHide"
    />

    <div class="flex items-center gap-2 pt-1">
      <label class="flex items-center gap-1.5 cursor-pointer select-none">
        <Checkbox v-model:checked="style.reverse" />
        <span>新消息在底部</span>
      </label>
    </div>

    <div class="flex items-center gap-2 pt-1">
      <label class="flex items-center gap-1.5 cursor-pointer select-none">
        <Checkbox v-model:checked="style.pinned" />
        <span>显示 SC / 礼物置顶栏</span>
      </label>
    </div>

    <FormField
      v-if="style.pinned"
      type="number"
      label="置顶礼物最低金额（元）"
      class="col-span-full pt-1"
      :min="0"
      :max="100000"
      v-model="style.pinnedMinPrice"
    />
  </div>
</template>
