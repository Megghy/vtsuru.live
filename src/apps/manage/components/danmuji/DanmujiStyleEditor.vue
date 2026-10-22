<script setup lang="ts">
import type { DanmujiStyle } from '@/shared/danmujiStyle'
import { Checkbox } from '@/shared/ui/checkbox'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

const style = defineModel<DanmujiStyle>({ required: true })
const presets = [
  { label: '经典列表', value: 'classic' },
  { label: '气泡', value: 'bubble' },
  { label: '极简', value: 'minimal' },
]
</script>

<template>
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">外观预设</label>
      <Select v-model="style.preset">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="p in presets"
            :key="p.value"
            :value="p.value"
          >
            {{ p.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">字号</label>
      <NInputNumber
        :value="style.fontSize"
        :min="10"
        :max="72"
        @update:value="
          (value) => {
            if (value !== null) style.fontSize = value
          }
        "
      />
    </div>

    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">不透明度</label>
      <NInputNumber
        :value="style.opacity"
        :min="0"
        :max="1"
        :step="0.1"
        @update:value="
          (value) => {
            if (value !== null) style.opacity = value
          }
        "
      />
    </div>

    <div class="space-y-1">
      <label class="text-xs text-muted-foreground">消息保留秒数（0 为不隐藏）</label>
      <NInputNumber
        :value="style.autoHide"
        :min="0"
        :max="3600"
        @update:value="
          (value) => {
            if (value !== null) style.autoHide = value
          }
        "
      />
    </div>

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

    <div
      v-if="style.pinned"
      class="col-span-full space-y-1 pt-1"
    >
      <label class="text-xs text-muted-foreground">置顶礼物最低金额（元）</label>
      <NInputNumber
        :value="style.pinnedMinPrice"
        :min="0"
        :max="100000"
        @update:value="
          (value) => {
            if (value !== null) style.pinnedMinPrice = value
          }
        "
      />
    </div>
  </div>
</template>
