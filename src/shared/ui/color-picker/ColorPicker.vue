<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pipette } from 'lucide-vue-next'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Input } from '@/shared/ui/input'
import { Button } from '@/shared/ui/button'

const props = withDefaults(
  defineProps<{
    modelValue?: string | null
    value?: string | null
    disabled?: boolean
    showAlpha?: boolean
    modes?: Array<'hex' | 'rgb' | 'hsl'>
    swatches?: string[]
    size?: 'small' | 'medium' | 'large'
  }>(),
  {
    modelValue: '#000000',
    value: null,
    disabled: false,
    showAlpha: true,
    swatches: () => [
      '#000000', '#ffffff', '#ef4444', '#f97316', '#f59e0b', '#10b981',
      '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b',
    ],
    size: 'small',
  },
)

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'update:value': [val: string]
  change: [val: string]
}>()

const open = ref(false)

const currentColor = computed({
  get: () => props.value ?? props.modelValue ?? '#000000',
  set: (val: string) => {
    emit('update:modelValue', val)
    emit('update:value', val)
    emit('change', val)
  },
})

const textInput = ref(currentColor.value)

watch(
  () => currentColor.value,
  (val) => {
    textInput.value = val || '#000000'
  },
)

function onTextChange(e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(val)) {
    currentColor.value = val
  }
}

function onNativeColorChange(e: Event) {
  const val = (e.target as HTMLInputElement).value
  currentColor.value = val
}

function selectSwatch(swatch: string) {
  currentColor.value = swatch
}
</script>

<template>
  <div class="inline-flex items-center">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 h-8 px-2 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors cursor-pointer select-none disabled:opacity-50 disabled:pointer-events-none"
          :disabled="disabled"
        >
          <span
            class="size-4.5 rounded border border-black/15 shadow-inner"
            :style="{ backgroundColor: currentColor || 'transparent' }"
          />
          <span class="text-xs font-mono uppercase text-foreground min-w-[60px] text-left">
            {{ currentColor || '无' }}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent class="w-60 p-3 text-xs" align="start">
        <div class="space-y-3">
          <div class="flex items-center gap-2">
            <div class="relative size-8 shrink-0 overflow-hidden rounded border border-input shadow-inner">
              <input
                type="color"
                class="absolute -inset-2 size-12 cursor-pointer border-0 bg-transparent"
                :value="currentColor.slice(0, 7)"
                @input="onNativeColorChange"
              />
            </div>
            <Input v-model="textInput" class="font-mono uppercase" placeholder="#000000" @blur="onTextChange" @keyup.enter="onTextChange" />
          </div>

          <div v-if="swatches && swatches.length > 0">
            <div class="text-[11px] font-medium text-muted-foreground mb-1.5">预设颜色</div>
            <div class="grid grid-cols-6 gap-1.5">
              <button
                v-for="swatch in swatches"
                :key="swatch"
                type="button"
                class="size-6 rounded border border-black/10 hover:scale-110 transition-transform cursor-pointer shadow-sm"
                :style="{ backgroundColor: swatch }"
                @click="selectSwatch(swatch)"
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
