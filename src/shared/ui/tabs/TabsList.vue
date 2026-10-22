<script setup lang="ts">
import type { TabsListProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TabsList } from "reka-ui"
import { computed, provide } from "vue"
import { cn } from '@/shared/utils/cn'

export interface Props extends TabsListProps {
  class?: HTMLAttributes["class"]
  size?: 'default' | 'sm' | 'xs' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
})

provide('tabsListSize', computed(() => props.size))

const delegatedProps = reactiveOmit(props, "class", "size")

const sizeClasses: Record<string, string> = {
  default: 'h-control-default p-1',
  sm: 'h-control-sm p-0.5',
  xs: 'h-control-xs p-0.5',
  lg: 'h-control-lg p-1',
}
</script>

<template>
  <TabsList v-bind="delegatedProps" :class="cn( 'inline-flex items-center justify-center rounded-md bg-muted text-muted-foreground', sizeClasses[props.size] || sizeClasses.default, props.class, )" >
    <slot />
  </TabsList>
</template>
