<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { NAlert, NButton, NFormItem, NProgress, NSelect, NSpace, NText } from 'naive-ui'

import type { PngtuberState } from '@/shared/pngtuber/types'
import { useAudioReactive } from '@/shared/pngtuber/useAudioReactive'
const props = withDefaults(
  defineProps<{
    state: PngtuberState
    muted: boolean
    disabled?: boolean
    obs?: boolean
    controls?: boolean
    autoStart?: boolean
  }>(),
  { controls: true },
)
const emit = defineEmits<{
  change: [patch: Partial<PngtuberState>]
  sample: [volume: number, speaking: boolean]
  error: [message: string]
}>()
// OBS has its own storage key; browser-specific device IDs never enter bridge state.
const deviceId = useLocalStorage(props.obs ? 'pngtuber:obs:microphone' : 'pngtuber:manager:microphone', 'default')
const audio = useAudioReactive({
  threshold: () => props.state.threshold,
  closeThreshold: () => props.state.closeThreshold,
  attackDelay: () => props.state.attackDelay,
  gain: () => props.state.gain,
  releaseDelay: () => props.state.releaseDelay,
  noiseSuppression: () => props.state.noiseSuppression,
  muted: () => props.muted,
  deviceId,
  autoStart: props.autoStart,
  onVolume: (volume, speaking) => emit('sample', volume, speaking),
})
const {
  isListening,
  isStarting,
  isCalibrating,
  smoothedVolume,
  isSpeaking,
  deviceList,
  errorMessage,
  permissionState,
} = audio
// This component also runs in OBS, where a message provider is not guaranteed.
async function calibrate() {
  try {
    emit('change', await audio.calibrateNoise())
  } catch (error) {
    emit('error', error instanceof Error ? error.message : String(error))
  }
}
</script>
<template>
  <NSpace
    v-if="controls"
    vertical
    :size="12"
  >
    <NAlert
      v-if="errorMessage"
      type="warning"
      >{{ errorMessage }}</NAlert
    >
    <NText
      v-if="obs"
      depth="3"
      >这里选择的是当前 OBS 浏览器源的输入设备。网页管理页的设备选择不会同步到
      OBS。若无法采集，请使用控制页或客户端输入。</NText
    >
    <NFormItem
      :label="obs ? '当前 OBS 麦克风' : '本机麦克风（仅本地保存）'"
      :show-feedback="false"
      ><NSelect
        v-model:value="deviceId"
        :options="[
          { label: '系统默认麦克风', value: 'default' },
          ...deviceList.filter((d) => d.deviceId !== 'default').map((d) => ({ label: d.label, value: d.deviceId })),
        ]"
    /></NFormItem>
    <NText depth="3"
      >设备：{{ deviceList.find((d) => d.deviceId === deviceId)?.label || deviceId }} · 权限：{{ permissionState }} ·
      {{ isListening ? '采集中' : '未采集' }}</NText
    >
    <NSpace
      ><NButton
        size="small"
        :loading="isStarting"
        @click="isListening ? audio.stopListening() : audio.startListening()"
        >{{ isListening ? '停止麦克风' : '启动 / 重试麦克风' }}</NButton
      ><NButton
        size="small"
        @click="audio.refreshDevices()"
        >刷新设备</NButton
      ><NButton
        v-if="!obs"
        size="small"
        @click="audio.simulateSpeaking(true)"
        >模拟说话 1.5s</NButton
      ><NButton
        v-if="!obs"
        size="small"
        :disabled="disabled || !isListening"
        :loading="isCalibrating"
        @click="calibrate"
        >噪声校准</NButton
      ></NSpace
    >
    <NText v-if="isCalibrating">请保持安静，正在采样环境噪声（3 秒）…</NText>
    <NProgress
      type="line"
      :percentage="Math.round(smoothedVolume)"
      :status="isSpeaking ? 'success' : 'default'"
    />
  </NSpace>
</template>
<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
