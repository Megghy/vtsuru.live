<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { ToggleGroupRootEmits, ToggleGroupRootProps } from 'reka-ui'
import { ToggleGroupRoot, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { provide } from 'vue'

import { cn } from '@/shared/utils/cn'

import { type ToggleGroupVariants, toggleGroupVariants } from './toggleGroup'

export interface Props extends ToggleGroupRootProps {
  class?: HTMLAttributes['class']
  size?: ToggleGroupVariants['size']
}

const props = withDefaults(defineProps<Props>(), {
  size: 'sm',
})

const emits = defineEmits<ToggleGroupRootEmits>()

provide('toggleGroupSize', props.size)

const delegatedProps = reactiveOmit(props, 'class', 'size')
const forwarded = useForwardPropsEmits(delegatedProps, emits)
</script>

<template>
  <ToggleGroupRoot
    v-bind="forwarded"
    :class="cn(toggleGroupVariants({ size }), props.class)"
  >
    <slot />
  </ToggleGroupRoot>
</template>
