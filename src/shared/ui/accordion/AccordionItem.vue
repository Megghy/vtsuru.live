<script setup lang="ts">
import type { AccordionItemProps } from 'reka-ui'
import { AccordionItem, useForwardProps } from 'reka-ui'
import { computed, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<AccordionItemProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})

const forwarded = useForwardProps(delegatedProps)
</script>

<template>
  <AccordionItem v-bind="forwarded" :class="cn('border-b', props.class)">
    <slot />
  </AccordionItem>
</template>
