<script setup lang="ts">
import type { BlockNode } from '@/apps/user-page/block/schema'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

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
  <div class="space-y-3">
    <PropsGrid>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground flex items-center gap-1">
          内容 <span class="text-destructive">*</span>
        </label>
        <Textarea
          v-model="blockProps.content"
          maxlength="500"
          placeholder="文本或 https 链接"
          class="text-xs min-h-[60px]"
        />
      </div>
      <div class="span-full space-y-1">
        <label class="text-xs text-muted-foreground">标题</label>
        <Input
          v-model="blockProps.title"
          maxlength="100"
          placeholder="可选"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">尺寸</label>
        <NumberField
          v-model="blockProps.size"
          :min="128"
          :max="512"
          :step="16"
          class="w-full"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">纠错等级</label>
        <Select v-model="blockProps.level">
          <SelectTrigger>
            <SelectValue placeholder="纠错等级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="opt in levelOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">前景色</label>
        <ColorPicker
          v-model:value="blockProps.foreground"
          :show-alpha="false"
          :modes="['hex']"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">背景色</label>
        <ColorPicker
          v-model:value="blockProps.background"
          :show-alpha="false"
          :modes="['hex']"
        />
      </div>
      <div class="space-y-1">
        <label class="text-xs text-muted-foreground">边距</label>
        <NumberField
          v-model="blockProps.margin"
          :min="0"
          :max="32"
          :step="1"
          class="w-full"
        />
      </div>
    </PropsGrid>
  </div>
</template>
