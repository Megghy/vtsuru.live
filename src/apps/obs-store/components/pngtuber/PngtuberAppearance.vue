<script setup lang="ts">
import type { PngtuberState } from '@/shared/pngtuber/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

defineProps<{ state: PngtuberState; disabled: boolean }>()
const emit = defineEmits<{ change: [patch: Partial<PngtuberState>] }>()

const selects = [
  {
    key: 'speakingAnimation',
    label: '说话动效',
    options: [
      ['bounce', '弹跳'],
      ['jelly', '果冻'],
      ['shake', '晃动'],
      ['pulse', '脉冲'],
      ['float', '悬浮'],
      ['none', '无'],
    ],
  },
  {
    key: 'idleAnimation',
    label: '待机动效',
    options: [
      ['breathe', '呼吸'],
      ['sway', '微晃'],
      ['float', '漂浮'],
      ['none', '静止'],
    ],
  },
  {
    key: 'intensity',
    label: '动效强度',
    options: [
      ['subtle', '轻微'],
      ['normal', '标准'],
      ['energetic', '强烈'],
    ],
  },
  {
    key: 'motionMode',
    label: '动效触发',
    options: [
      ['loop', '循环'],
      ['onset', '开口触发'],
      ['volume', '跟随音量'],
    ],
  },
] as const

const numbers = [
  { key: 'scale', label: '立绘缩放', min: 0.1, max: 3, step: 0.05 },
  { key: 'transitionMs', label: '切图过渡（ms）', min: 0, max: 1000, step: 10 },
  { key: 'canvasWidth', label: '画布宽度', min: 100, max: 3840, step: 10 },
  { key: 'canvasHeight', label: '画布高度', min: 100, max: 3840, step: 10 },
  { key: 'padding', label: '画布留白', min: 0, max: 300, step: 1 },
  { key: 'blinkMin', label: '眨眼最短间隔（ms）', min: 500, max: 60000, step: 100 },
  { key: 'blinkMax', label: '眨眼最长间隔（ms）', min: 500, max: 60000, step: 100 },
  { key: 'blinkDuration', label: '闭眼时长（ms）', min: 50, max: 2000, step: 10 },
] as const

const switches = [
  ['flipH', '水平镜像'],
  ['idleDim', '静止时微暗'],
  ['shadow', '地面投影'],
  ['showGlow', '说话光晕'],
  ['blinkEnabled', '自动眨眼'],
  ['pixelated', '像素画渲染'],
] as const
</script>

<template>
  <Card class="p-3">
    <CardHeader class="p-0 pb-2">
      <CardTitle class="text-sm font-semibold">动效、眨眼与画布</CardTitle>
    </CardHeader>
    <CardContent class="p-0 space-y-3">
      <div class="fields">
        <div
          v-for="f in selects"
          :key="f.key"
          class="space-y-1"
        >
          <label class="text-xs text-muted-foreground font-medium">{{ f.label }}</label>
          <Select
            :model-value="state[f.key]"
            :disabled="disabled"
            @update:model-value="emit('change', { [f.key]: $event as any })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="[value, label] in f.options"
                :key="value"
                :value="value"
                class="text-xs"
              >
                {{ label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div
          v-for="f in numbers"
          :key="f.key"
          class="space-y-1"
        >
          <label class="text-xs text-muted-foreground font-medium">{{ f.label }}</label>
          <NInputNumber
            :value="state[f.key]"
            :disabled="disabled"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            class="w-full"
            @update:value="(value) => value !== null && emit('change', { [f.key]: value })"
          />
        </div>
      </div>

      <div class="fields">
        <div
          v-for="[key, label] in switches"
          :key="key"
          class="toggle flex items-center justify-between p-1.5 border rounded-md"
        >
          <span class="text-xs font-medium">{{ label }}</span>
          <Switch
            :checked="state[key]"
            :disabled="disabled"
            @update:checked="emit('change', { [key]: $event })"
          />
        </div>
      </div>

      <div
        v-if="state.showGlow"
        class="space-y-1"
      >
        <label class="text-xs text-muted-foreground font-medium">光晕颜色</label>
        <ColorPicker
          :model-value="state.glowColor"
          :disabled="disabled"
          @update:model-value="emit('change', { glowColor: $event })"
        />
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 640px) {
  .fields {
    grid-template-columns: 1fr;
  }
}
</style>
