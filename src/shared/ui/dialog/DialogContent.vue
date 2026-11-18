<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import { X } from 'lucide-vue-next'
import type { DialogContentEmits, DialogContentProps } from 'reka-ui'
import { DialogClose, DialogContent, DialogOverlay, DialogPortal, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { useThemeScope } from '@/shared/config/theme/scope'
import { cn } from '@/shared/utils/cn'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps<DialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<DialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const themeStyle = useThemeScope()
</script>

<template>
  <DialogPortal>
    <DialogOverlay
      class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
    />
    <DialogContent
      v-bind="{ ...forwarded, ...$attrs }"
      :style="themeStyle"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto -translate-x-1/2 -translate-y-1/2 gap-4 rounded-lg border bg-popover p-6 text-popover-foreground shadow-lg backdrop-blur-md data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out',
          props.class,
        )
      "
    >
      <slot />

      <DialogClose
        class="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md border-0 opacity-60 ring-offset-background transition-all hover:opacity-100 hover:bg-accent/80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:pointer-events-none"
      >
        <X class="size-4" />
        <span class="sr-only">Close</span>
      </DialogClose>
    </DialogContent>
  </DialogPortal>
</template>
