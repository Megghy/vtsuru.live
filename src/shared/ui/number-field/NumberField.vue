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

import { cn } from '@/shared/utils/cn'

defineOptions({ name: 'NumberField' })

const props = withDefaults(
  defineProps<
    NumberFieldRootProps & {
      class?: HTMLAttributes['class']
      size?: 'default' | 'sm' | 'xs' | 'lg'
      placeholder?: string
      showButtons?: boolean
    }
  >(),
  {
    size: 'sm',
    showButtons: true,
    step: 1,
  },
)

const emits = defineEmits<NumberFieldRootEmits>()
const delegatedProps = reactiveOmit(props, 'class', 'size', 'placeholder', 'showButtons')
const forwarded = useForwardPropsEmits(delegatedProps, emits)

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
        'inline-flex items-center rounded-md border border-input bg-background ring-offset-background transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50',
        sizeClasses[props.size] || sizeClasses.sm,
        props.class,
      )
    "
  >
    <NumberFieldDecrement
      v-if="showButtons"
      :class="
        cn(
          'inline-flex-center h-full shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30',
          btnPad[props.size],
        )
      "
    >
      <Minus :class="iconSize[props.size]" />
    </NumberFieldDecrement>
    <NumberFieldInput
      :placeholder="placeholder"
      :class="
        cn(
          'min-w-0 flex-1 bg-transparent text-center tabular-nums outline-none placeholder:text-muted-foreground [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
          showButtons ? 'px-0.5' : 'px-2.5',
        )
      "
    />
    <NumberFieldIncrement
      v-if="showButtons"
      :class="
        cn(
          'inline-flex-center h-full shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-30',
          btnPad[props.size],
        )
      "
    >
      <Plus :class="iconSize[props.size]" />
    </NumberFieldIncrement>
  </NumberFieldRoot>
</template>
