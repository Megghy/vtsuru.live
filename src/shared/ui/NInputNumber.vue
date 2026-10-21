<script setup lang="ts">
import { computed, ref, useAttrs, useSlots } from 'vue'

defineOptions({ inheritAttrs: false, name: 'NInputNumber' })

const props = withDefaults(
  defineProps<{
    modelValue?: number | null
    value?: number | null
    min?: number
    max?: number
    step?: number
    disabled?: boolean
    readonly?: boolean
    placeholder?: string
    size?: 'tiny' | 'small' | 'medium' | 'large'
    showButton?: boolean
    buttonPlacement?: 'right' | 'both'
  }>(),
  {
    modelValue: null,
    value: null,
    step: 1,
    disabled: false,
    readonly: false,
    showButton: true,
    buttonPlacement: 'right',
    size: 'small',
  },
)

const emit = defineEmits<{
  'update:modelValue': [val: number | null]
  'update:value': [val: number | null]
  change: [val: number | null]
}>()

const inputRef = ref<HTMLInputElement>()

defineExpose({
  focus: () => inputRef.value?.focus(),
  blur: () => inputRef.value?.blur(),
  select: () => inputRef.value?.select(),
})

const currentValue = computed({
  get: () => (props.value !== null && props.value !== undefined ? props.value : props.modelValue),
  set: (val: number | null) => {
    emit('update:modelValue', val)
    emit('update:value', val)
    emit('change', val)
  },
})

function onInput(e: Event) {
  const target = e.target as HTMLInputElement
  const text = target.value.trim()
  if (text === '') {
    currentValue.value = null
    return
  }
  const n = Number(text)
  if (!Number.isNaN(n)) {
    let next = n
    if (props.min !== undefined && next < props.min) next = props.min
    if (props.max !== undefined && next > props.max) next = props.max
    currentValue.value = next
  }
}

function change(dir: 1 | -1) {
  if (props.disabled || props.readonly) return
  let next: number
  if (currentValue.value == null) {
    next = props.min !== undefined ? Math.max(0, props.min) : 0
  } else {
    next = currentValue.value + dir * (props.step || 1)
  }
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  currentValue.value = next
}

const minusDisabled = computed(() => {
  if (props.disabled || props.readonly) return true
  return props.min !== undefined && currentValue.value != null && currentValue.value <= props.min
})

const addDisabled = computed(() => {
  if (props.disabled || props.readonly) return true
  return props.max !== undefined && currentValue.value != null && currentValue.value >= props.max
})

const sizeClasses = computed(() => {
  switch (props.size) {
    case 'tiny':
      return 'h-6 text-xs px-1.5'
    case 'small':
      return 'h-7.5 text-xs px-2'
    case 'large':
      return 'h-10 text-sm px-3'
    default:
      return 'h-8.5 text-xs px-2.5'
  }
})
</script>

<template>
  <div
    class="relative inline-flex items-center rounded-md border border-input bg-background transition-colors focus-within:ring-1 focus-within:ring-ring"
    :class="[
      sizeClasses,
      disabled ? 'opacity-50 cursor-not-allowed bg-muted/50' : '',
      $attrs.class,
    ]"
  >
    <button
      v-if="showButton && buttonPlacement === 'both'"
      type="button"
      tabindex="-1"
      class="inline-flex items-center justify-center w-5 h-5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors select-none"
      :disabled="minusDisabled"
      aria-label="减少"
      @mousedown.prevent
      @click="change(-1)"
    >
      −
    </button>

    <slot name="prefix" />

    <input
      ref="inputRef"
      type="number"
      class="w-full bg-transparent text-foreground placeholder:text-muted-foreground outline-none border-0 text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      :value="currentValue ?? ''"
      :min="min"
      :max="max"
      :step="step"
      :disabled="disabled"
      :readonly="readonly"
      :placeholder="placeholder"
      @input="onInput"
    />

    <slot name="suffix" />

    <div v-if="showButton && buttonPlacement !== 'both'" class="flex items-center gap-0.5 ml-1">
      <button
        type="button"
        tabindex="-1"
        class="inline-flex items-center justify-center w-4.5 h-4.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors select-none"
        :disabled="minusDisabled"
        aria-label="减少"
        @mousedown.prevent
        @click="change(-1)"
      >
        −
      </button>
      <button
        type="button"
        tabindex="-1"
        class="inline-flex items-center justify-center w-4.5 h-4.5 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none transition-colors select-none"
        :disabled="addDisabled"
        aria-label="增加"
        @mousedown.prevent
        @click="change(1)"
      >
        +
      </button>
    </div>
  </div>
</template>
