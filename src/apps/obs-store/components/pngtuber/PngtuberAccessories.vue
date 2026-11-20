<script setup lang="ts">
import CursorClick24Regular from '@vicons/fluent/es/CursorClick24Regular'
import { useDebounceFn } from '@vueuse/core'

import type { PngtuberAccessory } from '@/shared/pngtuber/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import PngtuberImageSlot from './PngtuberImageSlot.vue'

const props = defineProps<{
  accessories: PngtuberAccessory[]
  disabled: boolean
  selectedAccessoryId?: string
}>()
const emit = defineEmits<{
  change: [value: PngtuberAccessory[]]
  'locate-accessory': [id: string]
}>()

function patch(id: string, value: Partial<PngtuberAccessory>) {
  if (!props.disabled)
    emit(
      'change',
      props.accessories.map((a) => (a.id === id ? { ...a, ...value } : a)),
    )
}

const patchNameDebounced = useDebounceFn((id: string, name: string) => {
  patch(id, { name })
}, 300)

function add() {
  if (props.disabled || props.accessories.length >= 12) return
  const id = crypto.randomUUID()
  emit('change', [
    ...props.accessories,
    {
      id,
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
  emit('locate-accessory', id)
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

    <Accordion
      type="multiple"
      class="space-y-2 border-none"
    >
      <AccordionItem
        v-for="a in accessories"
        :key="a.id"
        :value="a.id"
        class="border rounded-md px-3 bg-muted/20 text-xs"
        :class="{ 'border-primary/60 bg-primary/5': selectedAccessoryId === a.id }"
      >
        <AccordionTrigger class="py-2.5 font-medium hover:no-underline">
          <span>{{ a.name || '配件' }}</span>
        </AccordionTrigger>

        <AccordionContent class="pt-2 pb-3 space-y-3">
          <div class="flex items-center gap-2">
            <Input
              :model-value="a.name"
              placeholder="配件名称"
              class="flex-1"
              :disabled="disabled"
              @input="patchNameDebounced(a.id, ($event.target as HTMLInputElement).value)"
            />
            <Button
              size="xs"
              :variant="selectedAccessoryId === a.id ? 'secondary' : 'outline'"
              class="gap-1 shrink-0"
              :disabled="disabled || !a.image"
              @click="emit('locate-accessory', a.id)"
            >
              <CursorClick24Regular class="size-3.5" />
              画布拖拽
            </Button>
          </div>

          <PngtuberImageSlot
            :value="a.image"
            label="配件图片"
            :disabled="disabled"
            @change="patch(a.id, { image: $event })"
          />

          <div class="fields">
            <FormField
              v-for="f in fields"
              :key="f.key"
              :label="f.label"
              class="min-w-0"
            >
              <NumberField
                :model-value="a[f.key]"
                :min="f.min"
                :max="f.max"
                :step="f.step"
                :disabled="disabled"
                class="w-full"
                @update:model-value="(value) => value !== null && patch(a.id, { [f.key]: value })"
              />
            </FormField>
          </div>

          <Select
            :model-value="a.visible"
            :disabled="disabled"
            @update:model-value="patch(a.id, { visible: $event as PngtuberAccessory['visible'] })"
          >
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="always">始终显示</SelectItem>
              <SelectItem value="speaking">说话时显示</SelectItem>
              <SelectItem value="idle">静止时显示</SelectItem>
            </SelectContent>
          </Select>

          <SettingRow
            title="置于立绘前方"
            variant="compact"
          >
            <Switch
              :checked="a.front"
              :disabled="disabled"
              @update:checked="patch(a.id, { front: $event })"
            />
          </SettingRow>

          <div class="flex justify-end">
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
                  class="border-destructive/40 text-destructive hover:bg-destructive/10"
                  :disabled="disabled"
                >
                  删除配件
                </Button>
              </template>
              删除此配件？
            </Popconfirm>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </div>
</template>

<style scoped>
.fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
</style>
