<script setup lang="ts">
import type { SelectTriggerProps as _SelectTriggerProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { ChevronDown } from "lucide-vue-next"
import { SelectIcon, SelectTrigger, useForwardProps } from "reka-ui"
import { cn } from '@/shared/utils/cn'

export interface SelectTriggerProps extends _SelectTriggerProps {
  class?: HTMLAttributes["class"]
  size?: 'default' | 'sm' | 'xs' | 'lg'
}

const props = withDefaults(defineProps<SelectTriggerProps>(), {
  size: 'sm',
})

const delegatedProps = reactiveOmit(props, "class", "size")

const forwardedProps = useForwardProps(delegatedProps)

const sizeClasses: Record<string, string> = {
  default: 'h-control-default px-3 py-2 text-sm',
  sm: 'h-control-sm px-2.5 py-1.5 text-xs',
  xs: 'h-control-xs px-2 py-1 text-xs',
  lg: 'h-control-lg px-4 py-2 text-base',
}
</script>

<template>
  <SelectTrigger
    v-bind="forwardedProps"
    :class="cn(
      'flex w-full items-center justify-between rounded-md border border-input bg-background ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:truncate text-start',
      sizeClasses[props.size] || sizeClasses.default,
      props.class,
    )"
  >
    <slot />
    <SelectIcon as-child>
      <ChevronDown class="w-4 h-4 opacity-50 shrink-0" />
    </SelectIcon>
  </SelectTrigger>
</template>
