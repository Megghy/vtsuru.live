<script setup lang="ts">
import { reactiveOmit } from '@vueuse/core'
import type { AlertDialogContentEmits, AlertDialogContentProps } from 'reka-ui'
import { AlertDialogContent, AlertDialogOverlay, AlertDialogPortal, useForwardPropsEmits } from 'reka-ui'
import type { HTMLAttributes } from 'vue'

import { useThemeScope } from '@/shared/config/theme/scope'
import { cn } from '@/shared/utils/cn'

const props = defineProps<AlertDialogContentProps & { class?: HTMLAttributes['class'] }>()
const emits = defineEmits<AlertDialogContentEmits>()

const delegatedProps = reactiveOmit(props, 'class')

const forwarded = useForwardPropsEmits(delegatedProps, emits)
const themeStyle = useThemeScope()
</script>

<template>
  <AlertDialogPortal>
    <AlertDialogOverlay
      class="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out"
    />
    <AlertDialogContent
      v-bind="forwarded"
      :style="themeStyle"
      :class="
        cn(
          'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 border bg-popover p-6 text-popover-foreground shadow-lg backdrop-blur-md data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out sm:rounded-lg',
          props.class,
        )
      "
    >
      <slot />
    </AlertDialogContent>
  </AlertDialogPortal>
</template>
