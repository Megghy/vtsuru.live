<script setup lang="ts">
import type { TooltipRootEmits, TooltipRootProps } from 'reka-ui'
import { injectTooltipProviderContext, TooltipProvider, TooltipRoot, useForwardPropsEmits } from 'reka-ui'

const props = defineProps<TooltipRootProps>()
const emits = defineEmits<TooltipRootEmits>()

const forwarded = useForwardPropsEmits(props, emits)
const hasProvider = injectTooltipProviderContext(null) !== null
</script>

<template>
  <TooltipProvider v-if="!hasProvider">
    <TooltipRoot v-bind="forwarded">
      <slot />
    </TooltipRoot>
  </TooltipProvider>
  <TooltipRoot
    v-else
    v-bind="forwarded"
  >
    <slot />
  </TooltipRoot>
</template>
