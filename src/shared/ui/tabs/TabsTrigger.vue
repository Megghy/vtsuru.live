<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { TabsTriggerProps } from 'reka-ui'
import { TabsTrigger, useForwardProps } from 'reka-ui'
import type { ComputedRef, HTMLAttributes } from 'vue'
import { computed, inject } from 'vue'

import { cn } from '@/shared/utils/cn'

export interface Props extends TabsTriggerProps {
  class?: HTMLAttributes['class']
  size?: 'default' | 'sm' | 'xs' | 'lg'
}

const props = defineProps<Props>()

const parentSize = inject<ComputedRef<'default' | 'sm' | 'xs' | 'lg' | undefined> | undefined>(
  'tabsListSize',
  undefined,
)

const resolvedSize = computed(() => props.size || parentSize?.value || 'sm')

const delegatedProps = reactiveOmit(props, 'class', 'size')
const forwardedProps = useForwardProps(delegatedProps)

const sizeClasses: Record<string, string> = {
  default: 'h-full px-3 text-sm',
  sm: 'h-full px-2.5 text-xs',
  xs: 'h-full px-2 text-xs',
  lg: 'h-full px-4 text-base',
}
</script>

<template>
  <TabsTrigger
    v-bind="forwardedProps"
    :class="
      cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm cursor-pointer',
        sizeClasses[resolvedSize] || sizeClasses.default,
        props.class,
      )
    "
  >
    <span class="truncate inline-flex items-center justify-center gap-1">
      <slot />
    </span>
  </TabsTrigger>
</template>
