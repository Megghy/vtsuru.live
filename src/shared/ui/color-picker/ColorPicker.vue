<script setup lang="ts">
import {
  ColorAreaArea,
  ColorAreaRoot,
  ColorAreaThumb,
  ColorFieldInput,
  ColorFieldRoot,
  ColorSliderRoot,
  ColorSliderThumb,
  ColorSliderTrack,
  ColorSwatch,
  ColorSwatchPickerItem,
  ColorSwatchPickerItemSwatch,
  ColorSwatchPickerRoot,
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import {
  DEFAULT_SOLID_SWATCHES,
  normalizePickerColor,
  parseUserColorInput,
  TRANSPARENT_SWATCH,
} from './colorUtils'

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
    swatches: undefined,
    size: 'small',
  },
)

const emit = defineEmits<{
  'update:modelValue': [val: string]
  'update:value': [val: string]
  change: [val: string]
}>()

const open = ref(false)

const effectiveSwatches = computed(() => {
  if (props.swatches) return props.swatches
  return props.showAlpha
    ? [TRANSPARENT_SWATCH, ...DEFAULT_SOLID_SWATCHES.slice(0, 11)]
    : [...DEFAULT_SOLID_SWATCHES]
})

const currentColor = computed({
  get: () => normalizePickerColor(props.value ?? props.modelValue, props.showAlpha),
  set: (val: string) => {
    const normalized = normalizePickerColor(val, props.showAlpha, currentColor.value)
    emit('update:modelValue', normalized)
    emit('update:value', normalized)
    emit('change', normalized)
  },
})

const textInput = ref(currentColor.value)

watch(
  currentColor,
  (val) => {
    textInput.value = val
  },
  { immediate: true },
)

function onTextCommit() {
  const parsed = parseUserColorInput(textInput.value, props.showAlpha)
  if (parsed) {
    currentColor.value = parsed
    textInput.value = parsed
  } else {
    textInput.value = currentColor.value
  }
}

function onSwatchUpdate(val: string | string[]) {
  const next = Array.isArray(val) ? val[0] : val
  if (next) {
    currentColor.value = next
  }
}
</script>

<template>
  <div class="inline-flex items-center">
    <Popover v-model:open="open">
      <PopoverTrigger as-child>
        <Button
          type="button"
          variant="outline"
          class="w-full justify-start gap-1.5 px-2 font-normal"
          :disabled="disabled"
        >
          <ColorSwatch
            :color="currentColor"
            class="size-4 shrink-0 rounded-xs border border-black/15 shadow-inner [background-image:linear-gradient(var(--reka-color-swatch-color),var(--reka-color-swatch-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,8px_8px]"
          />
          <span class="font-mono uppercase text-foreground min-w-[60px] text-left truncate">
            {{ currentColor }}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        class="w-64 p-3 space-y-3"
        align="start"
      >
        <ColorAreaRoot
          v-model="currentColor"
          color-space="hsb"
          x-channel="saturation"
          y-channel="brightness"
          :disabled="disabled"
          class="relative block h-36 w-full rounded-md border border-border overflow-hidden touch-none select-none cursor-crosshair"
        >
          <ColorAreaArea class="block size-full">
            <ColorAreaThumb
              class="block size-4 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            />
          </ColorAreaArea>
        </ColorAreaRoot>

        <div class="space-y-2">
          <ColorSliderRoot
            v-model="currentColor"
            channel="hue"
            color-space="hsb"
            :disabled="disabled"
            class="relative flex h-3.5 w-full touch-none select-none items-center"
          >
            <ColorSliderTrack class="relative h-2.5 w-full grow overflow-hidden rounded-full border border-black/10" />
            <ColorSliderThumb
              class="block size-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            />
          </ColorSliderRoot>

          <ColorSliderRoot
            v-if="showAlpha"
            v-model="currentColor"
            channel="alpha"
            color-space="hsb"
            :disabled="disabled"
            class="relative flex h-3.5 w-full touch-none select-none items-center"
          >
            <ColorSliderTrack class="relative h-2.5 w-full grow overflow-hidden rounded-full border border-black/10" />
            <ColorSliderThumb
              class="block size-4 rounded-full border-2 border-white bg-transparent shadow-[0_0_0_1px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
            />
          </ColorSliderRoot>
        </div>

        <div class="flex items-center gap-1.5">
          <ColorSwatch
            :color="currentColor"
            class="size-8 shrink-0 rounded-md border border-border shadow-inner [background-image:linear-gradient(var(--reka-color-swatch-color),var(--reka-color-swatch-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,8px_8px]"
          />
          <Input
            v-model="textInput"
            class="flex-1 min-w-0 font-mono uppercase px-2"
            :placeholder="showAlpha ? '#000000FF' : '#000000'"
            :disabled="disabled"
            @blur="onTextCommit"
            @keyup.enter="onTextCommit"
          />
          <ColorFieldRoot
            v-if="showAlpha"
            v-model="currentColor"
            channel="alpha"
            color-space="hsb"
            :disabled="disabled"
            class="w-14 shrink-0"
          >
            <ColorFieldInput
              aria-label="透明度百分比"
              class="flex h-[var(--control-h-sm)] w-full rounded-md border border-input bg-transparent px-1.5 py-1 text-center font-mono text-xs text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            />
          </ColorFieldRoot>
        </div>

        <div v-if="effectiveSwatches.length > 0">
          <ColorSwatchPickerRoot
            :model-value="currentColor"
            class="grid grid-cols-6 gap-1.5"
            @update:model-value="onSwatchUpdate"
          >
            <ColorSwatchPickerItem
              v-for="swatch in effectiveSwatches"
              :key="swatch"
              :value="swatch"
              :disabled="disabled"
              class="relative size-6 rounded-xs border border-black/15 hover:scale-105 transition-transform cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring overflow-hidden"
            >
              <ColorSwatchPickerItemSwatch
                class="block size-full [background-image:linear-gradient(var(--reka-color-swatch-color),var(--reka-color-swatch-color)),repeating-conic-gradient(#ccc_0%_25%,#fff_0%_50%)] [background-size:100%_100%,8px_8px]"
              />
            </ColorSwatchPickerItem>
          </ColorSwatchPickerRoot>
        </div>
      </PopoverContent>
    </Popover>
  </div>
</template>
