<script setup lang="ts">
import type { AccordionTriggerProps } from 'reka-ui'
import { AccordionHeader, AccordionTrigger } from 'reka-ui'
import { ChevronDown } from 'lucide-vue-next'
import { computed, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<AccordionTriggerProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <AccordionHeader class="flex">
    <AccordionTrigger
      v-bind="delegatedProps"
      :class="
        cn(
          'flex flex-1 items-center justify-between py-3 text-xs font-medium transition-colors hover:text-foreground/80 [&[data-state=open]>svg]:rotate-180 cursor-pointer',
          props.class,
        )
      "
    >
      <slot />
      <slot name="icon">
        <ChevronDown
          class="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
        />
      </slot>
    </AccordionTrigger>
  </AccordionHeader>
</template>
