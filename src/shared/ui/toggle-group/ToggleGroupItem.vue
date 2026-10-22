<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { ToggleGroupItemProps } from 'reka-ui'
import { ToggleGroupItem, useForwardProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { inject } from 'vue'

import { cn } from '@/shared/utils/cn'

import { type ToggleGroupItemVariants, toggleGroupItemVariants } from './toggleGroup'

export interface Props extends ToggleGroupItemProps {
  class?: HTMLAttributes['class']
  size?: ToggleGroupItemVariants['size']
}

const parentSize = inject<ToggleGroupItemVariants['size']>('toggleGroupSize', 'sm')

const props = defineProps<Props>()

const delegatedProps = reactiveOmit(props, 'class', 'size')
const forwardedProps = useForwardProps(delegatedProps)
</script>

<template>
  <ToggleGroupItem
    v-bind="forwardedProps"
    :class="cn(toggleGroupItemVariants({ size: props.size || parentSize }), props.class)"
  >
    <slot />
  </ToggleGroupItem>
</template>
