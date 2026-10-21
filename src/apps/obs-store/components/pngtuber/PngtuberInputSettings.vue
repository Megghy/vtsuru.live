<script setup lang="ts">
import type { PngtuberState } from '@/shared/pngtuber/types'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

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
  <div class="space-y-3">
    <Select
      :model-value="state.inputMode"
      :disabled="disabled"
      @update:model-value="emit('change', { inputMode: $event as any })"
    >
      <SelectTrigger class="h-8 text-xs w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="microphone" class="text-xs">麦克风（各展示端独立采集）</SelectItem>
        <SelectItem value="controller" class="text-xs">控制页麦克风（同步音量）</SelectItem>
        <SelectItem value="client" class="text-xs">客户端麦克风</SelectItem>
        <SelectItem value="obs" class="text-xs">OBS 音量（客户端连接）</SelectItem>
      </SelectContent>
    </Select>

    <Alert class="py-2 px-2.5 bg-muted/40 border-muted">
      <AlertDescription class="text-xs text-muted-foreground m-0 leading-relaxed">
        {{
          state.inputMode === 'microphone'
            ? '本页麦克风仅供本地预览。OBS 浏览器源独立采集，请在 OBS 诊断页面选择当前设备。'
            : state.inputMode === 'controller'
              ? '保持本页打开并启动麦克风，音量将同步到同频道展示端。'
              : state.inputMode === 'client'
                ? '需要启动 VTsuru 客户端，并在客户端开启该频道的麦克风输入。'
                : '需要启动 VTsuru 客户端并连接 OBS，由客户端提供 OBS 音量。'
        }}
      </AlertDescription>
    </Alert>

    <div class="fields">
      <div
        v-for="f in fields"
        :key="f.key"
        class="space-y-1"
      >
        <label class="text-[11px] text-muted-foreground font-medium">{{ f.label }}</label>
        <NInputNumber
          :value="state[f.key]"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :disabled="disabled"
          size="small"
          class="w-full"
          @update:value="(value) => value !== null && emit('change', { [f.key]: value })"
        />
      </div>
    </div>

    <div class="flex items-center justify-between p-1.5 border rounded-md">
      <span class="text-xs font-medium">噪声抑制</span>
      <Switch
        :checked="state.noiseSuppression"
        :disabled="disabled"
        @update:checked="emit('change', { noiseSuppression: $event })"
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
