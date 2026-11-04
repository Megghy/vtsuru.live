<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { Check } from 'lucide-vue-next'
import type { SelectItemProps } from 'reka-ui'
import { SelectItem, SelectItemIndicator, SelectItemText, useForwardProps } from 'reka-ui'
import { computed, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

import { SELECT_EMPTY_VALUE } from './index'

const props = defineProps<SelectItemProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...rest } = props
  if (rest.value === '') {
    return { ...rest, value: SELECT_EMPTY_VALUE }
  }
  return rest
})

const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <SelectItem
    v-bind="forwardedProps"
    :class="
      cn(
        'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-xs outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        props.class,
      )
    "
  >
    <span class="absolute left-2 flex-center size-3.5">
      <SelectItemIndicator>
        <Check class="h-4 w-4" />
      </SelectItemIndicator>
    </span>

    <SelectItemText>
      <slot />
    </SelectItemText>
  </SelectItem>
</template>
