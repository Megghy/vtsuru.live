<script setup lang="ts">
import type { PngtuberAccessory } from '@/shared/pngtuber/types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'

import PngtuberImageSlot from './PngtuberImageSlot.vue'

const props = defineProps<{ accessories: PngtuberAccessory[]; disabled: boolean }>()
const emit = defineEmits<{ change: [value: PngtuberAccessory[]] }>()

function patch(id: string, value: Partial<PngtuberAccessory>) {
  if (!props.disabled)
    emit(
      'change',
      props.accessories.map((a) => (a.id === id ? { ...a, ...value } : a)),
    )
}

function add() {
  if (props.disabled || props.accessories.length >= 12) return
  emit('change', [
    ...props.accessories,
    {
      id: crypto.randomUUID(),
      name: '配件',
      image: '',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      visible: 'always',
      front: true,
    },
  ])
}

const fields = [
  { key: 'x', label: '水平偏移', min: -2000, max: 2000, step: 1 },
  { key: 'y', label: '垂直偏移', min: -2000, max: 2000, step: 1 },
  { key: 'scale', label: '缩放', min: 0.05, max: 10, step: 0.05 },
  { key: 'rotation', label: '旋转角度', min: -360, max: 360, step: 1 },
] as const
</script>

<template>
  <div class="space-y-3">
    <Button
      variant="outline"
      class="w-full"
      :disabled="disabled || accessories.length >= 12"
      @click="add"
    >
      增加配件（{{ accessories.length }}/12）
    </Button>

    <div class="space-y-2">
      <details
        v-for="a in accessories"
        :key="a.id"
        class="group border rounded-md p-2.5 text-xs bg-muted/20"
      >
        <summary class="font-medium cursor-pointer list-none flex items-center justify-between text-foreground">
          <span>{{ a.name || '配件' }}</span>
          <span class="text-muted-foreground transition-transform group-open:rotate-180">▾</span>
        </summary>

        <div class="mt-3 pt-2.5 border-t space-y-3">
          <Input
            :value="a.name"
            placeholder="配件名称"
            :disabled="disabled"
            @input="patch(a.id, { name: ($event.target as HTMLInputElement).value })"
          />

          <PngtuberImageSlot
            :value="a.image"
            label="配件图片"
            :disabled="disabled"
            @change="patch(a.id, { image: $event })"
          />

          <div class="fields">
            <div
              v-for="f in fields"
              :key="f.key"
              class="space-y-1"
            >
              <label class="text-[11px] text-muted-foreground font-medium">{{ f.label }}</label>
              <NInputNumber
                :value="a[f.key]"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                size="small"
                :disabled="disabled"
                class="w-full"
                @update:value="(value) => value !== null && patch(a.id, { [f.key]: value })"
              />
            </div>
          </div>

          <Select
            :model-value="a.visible"
            :disabled="disabled"
            @update:model-value="patch(a.id, { visible: $event as any })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="always"
                class="text-xs"
                >始终显示</SelectItem
              >
              <SelectItem
                value="speaking"
                class="text-xs"
                >说话时显示</SelectItem
              >
              <SelectItem
                value="idle"
                class="text-xs"
                >静止时显示</SelectItem
              >
            </SelectContent>
          </Select>

          <div class="flex items-center justify-between gap-2 pt-1">
            <div class="flex items-center gap-2">
              <span class="text-xs">置于立绘前方</span>
              <Switch
                :checked="a.front"
                :disabled="disabled"
                @update:checked="patch(a.id, { front: $event })"
              />
            </div>

            <Popconfirm
              title="删除配件"
              :disabled="disabled"
              @positive-click="
                emit(
                  'change',
                  accessories.filter((item) => item.id !== a.id),
                )
              "
            >
              <template #trigger>
                <Button
                  size="xs"
                  variant="outline"
                  class="h-6 text-[11px] border-destructive/40 text-destructive hover:bg-destructive/10"
                  :disabled="disabled"
                >
                  删除配件
                </Button>
              </template>
              删除此配件？
            </Popconfirm>
          </div>
        </div>
      </details>
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
