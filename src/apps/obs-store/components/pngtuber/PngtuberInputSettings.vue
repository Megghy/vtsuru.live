<script setup lang="ts">
import { NAlert, NFormItem, NInputNumber, NSelect, NSpace, NSwitch } from 'naive-ui'

import type { PngtuberState } from '@/shared/pngtuber/types'
defineProps<{ state: PngtuberState; disabled: boolean }>()
const emit = defineEmits<{ change: [patch: Partial<PngtuberState>] }>()
const fields = [
  { key: 'threshold', label: '开口阈值', min: 1, max: 100, step: 1 },
  { key: 'closeThreshold', label: '闭口阈值', min: 0, max: 100, step: 1 },
  { key: 'gain', label: '麦克风增益', min: 0.5, max: 3, step: 0.1 },
  { key: 'attackDelay', label: '开口延时（ms）', min: 0, max: 1000, step: 10 },
  { key: 'releaseDelay', label: '闭口延时（ms）', min: 0, max: 2000, step: 10 },
] as const
</script>
<template>
  <NSpace
    vertical
    :size="12"
  >
    <NSelect
      :value="state.inputMode"
      :disabled="disabled"
      :options="[
        { label: '麦克风（各展示端独立采集）', value: 'microphone' },
        { label: '控制页麦克风（同步音量）', value: 'controller' },
        { label: '客户端麦克风', value: 'client' },
        { label: 'OBS 音量（客户端连接）', value: 'obs' },
      ]"
      @update:value="emit('change', { inputMode: $event })"
    />
    <NAlert
      type="info"
      :show-icon="false"
      >{{
        state.inputMode === 'microphone'
          ? '本页麦克风仅供本地预览。OBS 浏览器源独立采集，请在 OBS 诊断页面选择当前设备。'
          : state.inputMode === 'controller'
            ? '保持本页打开并启动麦克风，音量将同步到同频道展示端。'
            : state.inputMode === 'client'
              ? '需要启动 VTsuru 客户端，并在客户端开启该频道的麦克风输入。'
              : '需要启动 VTsuru 客户端并连接 OBS，由客户端提供 OBS 音量。'
      }}</NAlert
    >
    <div class="fields">
      <NFormItem
        v-for="f in fields"
        :key="f.key"
        :label="f.label"
        :show-feedback="false"
        ><NInputNumber
          :value="state[f.key]"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :disabled="disabled"
          size="small"
          @update:value="(value) => value !== null && emit('change', { [f.key]: value })"
      /></NFormItem>
    </div>
    <NSpace align="center"
      ><span>噪声抑制</span
      ><NSwitch
        :value="state.noiseSuppression"
        :disabled="disabled"
        @update:value="emit('change', { noiseSuppression: $event })"
    /></NSpace>
  </NSpace>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
