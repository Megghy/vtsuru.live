<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { computed } from 'vue'

import type { PngtuberState } from '@/shared/pngtuber/types'
import { useAudioReactive } from '@/shared/pngtuber/useAudioReactive'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

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

const currentDeviceLabel = computed(() => {
  return deviceList.value.find((d) => d.deviceId === deviceId.value)?.label || deviceId.value
})
</script>

<template>
  <div
    v-if="controls"
    class="space-y-3"
  >
    <Alert
      v-if="errorMessage"
      class="border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-2 px-2.5"
    >
      <AlertDescription class="text-xs m-0">
        {{ errorMessage }}
      </AlertDescription>
    </Alert>

    <div
      v-if="obs"
      class="text-xs text-muted-foreground leading-relaxed"
    >
      这里选择的是当前 OBS 浏览器源的输入设备。网页管理页的设备选择不会同步到
      OBS。若无法采集，请使用控制页或客户端输入。
    </div>

    <div class="space-y-1">
      <label class="text-xs text-muted-foreground font-medium">
        {{ obs ? '当前 OBS 麦克风' : '本机麦克风（仅本地保存）' }}
      </label>
      <Select v-model="deviceId">
        <SelectTrigger class="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            value="default"
            class="text-xs"
            >系统默认麦克风</SelectItem
          >
          <SelectItem
            v-for="d in deviceList.filter((item) => item.deviceId !== 'default')"
            :key="d.deviceId"
            :value="d.deviceId"
            class="text-xs"
          >
            {{ d.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="text-xs text-muted-foreground">
      设备：{{ currentDeviceLabel }} · 权限：{{ permissionState }} ·
      {{ isListening ? '采集中' : '未采集' }}
    </div>

    <div class="flex items-center gap-2 flex-wrap">
      <Button
        variant="outline"
        :disabled="isStarting"
        @click="isListening ? audio.stopListening() : audio.startListening()"
      >
        {{ isListening ? '停止麦克风' : '启动 / 重试麦克风' }}
      </Button>
      <Button
        variant="outline"
        @click="audio.refreshDevices()"
      >
        刷新设备
      </Button>
      <Button
        v-if="!obs"
        variant="outline"
        @click="audio.simulateSpeaking(true)"
      >
        模拟说话 1.5s
      </Button>
      <Button
        v-if="!obs"
        variant="outline"
        :disabled="disabled || !isListening || isCalibrating"
        @click="calibrate"
      >
        噪声校准
      </Button>
    </div>

    <div
      v-if="isCalibrating"
      class="text-xs text-amber-500"
    >
      请保持安静，正在采样环境噪声（3 秒）…
    </div>

    <div class="space-y-1">
      <Progress
        :model-value="Math.round(smoothedVolume)"
        class="h-2"
        :class="isSpeaking ? '[&>div]:bg-emerald-500' : ''"
      />
    </div>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
