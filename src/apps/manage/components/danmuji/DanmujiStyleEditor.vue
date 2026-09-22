<script setup lang="ts">
import { NCheckbox, NFormItem, NInputNumber, NSelect } from 'naive-ui'
import type { DanmujiStyle } from '@/shared/danmujiStyle'

const style = defineModel<DanmujiStyle>({ required: true })
const presets = [
  { label: '经典列表', value: 'classic' },
  { label: '气泡', value: 'bubble' },
  { label: '极简', value: 'minimal' },
]
</script>

<template>
  <div class="style-fields">
    <NFormItem label="外观预设" :show-feedback="false"><NSelect v-model:value="style.preset" :options="presets" size="small" /></NFormItem>
    <NFormItem label="字号" :show-feedback="false"><NInputNumber :value="style.fontSize" :min="10" :max="72" size="small" @update:value="value => { if (value !== null) style.fontSize = value }" /></NFormItem>
    <NFormItem label="不透明度" :show-feedback="false"><NInputNumber :value="style.opacity" :min="0" :max="1" :step="0.1" size="small" @update:value="value => { if (value !== null) style.opacity = value }" /></NFormItem>
    <NFormItem label="消息保留秒数（0 为不隐藏）" :show-feedback="false"><NInputNumber :value="style.autoHide" :min="0" :max="3600" size="small" @update:value="value => { if (value !== null) style.autoHide = value }" /></NFormItem>
    <NCheckbox v-model:checked="style.reverse">新消息在底部</NCheckbox>
    <NCheckbox v-model:checked="style.pinned">显示 SC / 礼物置顶栏</NCheckbox>
    <NFormItem v-if="style.pinned" label="置顶礼物最低金额（元）" :show-feedback="false"><NInputNumber :value="style.pinnedMinPrice" :min="0" :max="100000" size="small" @update:value="value => { if (value !== null) style.pinnedMinPrice = value }" /></NFormItem>
  </div>
</template>

<style scoped>
.style-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
</style>
