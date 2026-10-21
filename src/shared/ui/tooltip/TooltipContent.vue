<script setup lang="ts">
import { useThemeScope } from '@/shared/config/theme/scope'
import type { TooltipContentEmits, TooltipContentProps } from "reka-ui"
import type { HTMLAttributes } from "vue"
import { reactiveOmit } from "@vueuse/core"
import { TooltipContent, TooltipPortal, useForwardPropsEmits } from "reka-ui"
import { cn } from '@/shared/utils/cn'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<TooltipContentProps & { class?: HTMLAttributes["class"] }>(), {
  sideOffset: 4,
})

const emits = defineEmits<TooltipContentEmits>()

const delegatedProps = reactiveOmit(props, "class")

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const themeStyle = useThemeScope()
</script>

<template>
  <TooltipPortal>
    <TooltipContent :style="themeStyle" v-bind="{ ...forwarded, ...$attrs }" :class="cn('z-50 overflow-hidden rounded-md border-[length:var(--ui-border-width,1px)] [border-style:var(--ui-border-style,solid)] bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-[var(--ui-shadow,0_4px_12px_rgb(0_0_0/0.12))] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2', props.class)">
      <slot />
    </TooltipContent>
  </TooltipPortal>
</template>
