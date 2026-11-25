<script setup lang="ts">
import type { TooltipContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { useSlots } from 'vue'

import Tooltip from './Tooltip.vue'
import TooltipContent from './TooltipContent.vue'
import TooltipTrigger from './TooltipTrigger.vue'

withDefaults(
  defineProps<{
    content?: string | null
    side?: TooltipContentProps['side']
    align?: TooltipContentProps['align']
    sideOffset?: number
    disabled?: boolean
    contentClass?: HTMLAttributes['class']
  }>(),
  {
    content: undefined,
    side: 'top',
    align: 'center',
    sideOffset: 4,
    disabled: false,
    contentClass: undefined,
  },
)

const slots = useSlots()
</script>

<template>
  <Tooltip v-if="!disabled && (content || slots.content)">
    <TooltipTrigger as-child>
      <slot />
    </TooltipTrigger>
    <TooltipContent
      :side="side"
      :align="align"
      :side-offset="sideOffset"
      :class="contentClass"
    >
      <slot name="content">
        {{ content }}
      </slot>
    </TooltipContent>
  </Tooltip>
  <slot v-else />
</template>
