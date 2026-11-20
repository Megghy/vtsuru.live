<script setup lang="ts">
import { computed } from 'vue'

import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Slider } from '@/shared/ui/slider'

import type { ObsLayerMaskShape } from '../utils/maskShapes'
import { getMaskShapePreset, MASK_SHAPE_PRESETS } from '../utils/maskShapes'

const props = withDefaults(
  defineProps<{
    maskShape?: ObsLayerMaskShape
    borderRadius?: number
    maxLayerSide?: number
  }>(),
  {
    maskShape: 'none',
    borderRadius: 0,
    maxLayerSide: 400,
  },
)

const emit = defineEmits<{
  'update:maskShape': [value: ObsLayerMaskShape]
  'update:borderRadius': [value: number]
  commit: []
}>()

const activePreset = computed(() => getMaskShapePreset(props.maskShape))

const sliderMax = computed(() => {
  const half = Math.max(40, Math.floor(props.maxLayerSide / 2))
  return Math.min(240, half)
})

const radiusSliderValue = computed<number[]>({
  get: () => [Math.min(sliderMax.value, Math.max(0, props.borderRadius ?? 0))],
  set: (v) => {
    emit('update:borderRadius', Math.max(0, Math.round(v[0] ?? 0)))
  },
})

function selectShape(id: ObsLayerMaskShape) {
  if (id === props.maskShape) return
  emit('update:maskShape', id)
  const preset = getMaskShapePreset(id)
  if (preset.defaultRadius && (!props.borderRadius || props.borderRadius <= 0)) {
    emit('update:borderRadius', preset.defaultRadius)
  }
  emit('commit')
}

function onRadiusNumberUpdate(val: number | undefined) {
  if (val === undefined || !Number.isFinite(val)) return
  emit('update:borderRadius', Math.max(0, Math.min(500, Math.round(val))))
  emit('commit')
}
</script>

<template>
  <div class="space-y-3">
    <FormField label="形状遮罩" :extra="activePreset.label">
      <div class="grid grid-cols-7 gap-1">
        <button
          v-for="preset in MASK_SHAPE_PRESETS"
          :key="preset.id"
          type="button"
          :title="preset.label"
          :aria-label="preset.label"
          :aria-pressed="activePreset.id === preset.id"
          class="flex-center h-7.5 rounded-md border transition-colors cursor-pointer"
          :class="
            activePreset.id === preset.id
              ? 'border-primary bg-primary/15 text-primary'
              : 'border-border bg-control/60 text-muted-foreground hover:text-foreground hover:bg-muted/60'
          "
          @click="selectShape(preset.id)"
        >
          <svg
            viewBox="0 0 24 24"
            class="size-4 shrink-0"
            fill="currentColor"
            fill-opacity="0.22"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linejoin="round"
          >
            <path :d="preset.previewPath" />
          </svg>
        </button>
      </div>
    </FormField>

    <FormField
      v-if="activePreset.supportsRadius"
      :label="activePreset.radiusLabel || '圆角大小 (px)'"
    >
      <div class="flex items-center gap-2">
        <Slider
          v-model="radiusSliderValue"
          class="flex-1 min-w-0"
          :min="0"
          :max="sliderMax"
          :step="1"
          @value-commit="emit('commit')"
        />
        <NumberField
          class="w-24 shrink-0"
          :model-value="borderRadius ?? 0"
          :min="0"
          :max="500"
          @update:model-value="onRadiusNumberUpdate"
        />
      </div>
    </FormField>
  </div>
</template>
