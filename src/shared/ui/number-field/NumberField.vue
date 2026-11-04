<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { Minus, Plus } from 'lucide-vue-next'
import type { NumberFieldRootEmits, NumberFieldRootProps } from 'reka-ui'
import {
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldRoot,
  useForwardPropsEmits,
} from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@/shared/utils/cn'

defineOptions({ name: 'NumberField' })

export type NumberFieldProps = Omit<NumberFieldRootProps, 'min' | 'max' | 'step' | 'modelValue' | 'defaultValue'> & {
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm' | 'xs' | 'lg'
  placeholder?: string
  showButtons?: boolean
  min?: number | string
  max?: number | string
  step?: number | string
  modelValue?: number | string | null
  defaultValue?: number | string
}

const props = withDefaults(
  defineProps<NumberFieldProps>(),
  {
    size: 'sm',
    showButtons: true,
    step: 1,
  },
)

const emits = defineEmits<NumberFieldRootEmits>()
const delegatedProps = reactiveOmit(props, 'class', 'size', 'placeholder', 'showButtons', 'min', 'max', 'step', 'modelValue', 'defaultValue')

const normalizedProps = computed(() => ({
  ...delegatedProps,
  min: props.min !== undefined && props.min !== '' ? Number(props.min) : undefined,
  max: props.max !== undefined && props.max !== '' ? Number(props.max) : undefined,
  step: props.step !== undefined && props.step !== '' ? Number(props.step) : 1,
  modelValue: props.modelValue !== undefined && props.modelValue !== null && props.modelValue !== '' ? Number(props.modelValue) : (props.modelValue as any),
  defaultValue: props.defaultValue !== undefined && props.defaultValue !== '' ? Number(props.defaultValue) : undefined,
}))

const forwarded = useForwardPropsEmits(normalizedProps, emits)

const sizeClasses: Record<string, string> = {
  default: 'h-control-default text-sm',
  sm: 'h-control-sm text-xs',
  xs: 'h-control-xs text-xs',
  lg: 'h-control-lg text-base',
}

const btnPad: Record<string, string> = {
  default: 'px-2',
  sm: 'px-1.5',
  xs: 'px-1',
  lg: 'px-2.5',
}

const iconSize: Record<string, string> = {
  default: 'size-3.5',
  sm: 'size-3',
  xs: 'size-3',
  lg: 'size-4',
}
</script>

<template>
  <NumberFieldRoot
    v-bind="forwarded"
    :class="
      cn(
        'inline-flex items-center w-full rounded-md border border-input bg-background ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        sizeClasses[props.size] || sizeClasses.sm,
        props.class,
      )
    "
  >
    <NumberFieldDecrement
      v-if="showButtons"
      :class="
        cn(
          'inline-flex-center h-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-90 transition-all rounded-sm cursor-pointer select-none disabled:pointer-events-none disabled:opacity-30',
          btnPad[props.size],
        )
      "
    >
      <Minus :class="iconSize[props.size]" />
    </NumberFieldDecrement>
    <slot name="prefix" />
    <NumberFieldInput
      :placeholder="placeholder"
      :class="
        cn(
          'w-full min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          showButtons ? 'px-0.5' : 'px-2.5',
        )
      "
    />
    <slot name="suffix" />
    <NumberFieldIncrement
      v-if="showButtons"
      :class="
        cn(
          'inline-flex-center h-full shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted/50 active:scale-90 transition-all rounded-sm cursor-pointer select-none disabled:pointer-events-none disabled:opacity-30',
          btnPad[props.size],
        )
      "
    >
      <Plus :class="iconSize[props.size]" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
