<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { Check } from 'lucide-vue-next'
import type { CheckboxRootEmits, CheckboxRootProps } from 'reka-ui'
import { CheckboxIndicator, CheckboxRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { computed } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface CheckboxProps extends CheckboxRootProps {
  class?: HTMLAttributes['class']
  checked?: boolean | 'indeterminate'
}

export type CheckboxEmits = CheckboxRootEmits & {
  'update:checked': [value: boolean]
}

const props = defineProps<CheckboxProps>()
const emits = defineEmits<CheckboxEmits>()

const delegatedProps = reactiveOmit(props, 'class', 'checked')

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

function handleUpdateModelValue(val: boolean | 'indeterminate') {
  emits('update:modelValue', val)
  emits('update:checked', val === true)
}
</script>

<template>
  <CheckboxRoot
    v-bind="forwarded"
    :model-value="resolvedModelValue"
    @update:model-value="handleUpdateModelValue"
    :class="
      cn(
        'grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        props.class,
      )
    "
  >
    <CheckboxIndicator class="grid place-content-center text-current">
      <slot>
        <Check class="h-4 w-4" />
      </slot>
    </CheckboxIndicator>
  </CheckboxRoot>
</template>
