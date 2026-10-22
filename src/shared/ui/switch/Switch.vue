<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { SwitchRootEmits, SwitchRootProps } from 'reka-ui'
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface SwitchProps extends SwitchRootProps {
  class?: HTMLAttributes['class']
  checked?: boolean
  size?: 'default' | 'sm'
}

export type SwitchEmits = SwitchRootEmits & {
  'update:checked': [value: boolean]
}

const props = withDefaults(defineProps<SwitchProps>(), {
  size: 'sm',
})
const emits = defineEmits<SwitchEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'checked', 'size')

const resolvedModelValue = computed(() => {
  if (props.modelValue !== undefined) return props.modelValue
  if (props.checked !== undefined) return props.checked
  return undefined
})

const rootProps = computed(() => ({
  ...delegatedProps,
  modelValue: resolvedModelValue.value,
}))

const forwarded = useForwardPropsEmits(rootProps, emits)

function handleUpdateModelValue(val: boolean) {
  emits('update:modelValue', val)
  emits('update:checked', val)
}

const rootSizes: Record<string, string> = {
  default: 'h-6 w-11',
  sm: 'h-5 w-9',
}

const thumbSizes: Record<string, string> = {
  default: 'h-5 w-5 data-[state=checked]:translate-x-5',
  sm: 'h-4 w-4 data-[state=checked]:translate-x-4',
}
</script>

<template>
  <SwitchRoot
    v-bind="forwarded"
    @update:model-value="handleUpdateModelValue"
    :class="
      cn(
        'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        rootSizes[props.size] || rootSizes.default,
        props.class,
      )
    "
  >
    <SwitchThumb
      :class="
        cn(
          'pointer-events-none block rounded-full bg-background shadow-lg ring-0 transition-transform',
          thumbSizes[props.size] || thumbSizes.default,
        )
      "
    >
      <slot name="thumb" />
    </SwitchThumb>
  </SwitchRoot>
</template>
