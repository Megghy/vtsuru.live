<script setup lang="ts">
import { NumberFieldDecrement, type NumberFieldDecrementProps } from 'reka-ui'
import { Minus } from 'lucide-vue-next'
import { computed, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<NumberFieldDecrementProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <NumberFieldDecrement
    v-bind="delegatedProps"
    :class="
      cn(
        'absolute top-1/2 -translate-y-1/2 left-0 p-1.5 disabled:cursor-not-allowed disabled:opacity-30 text-muted-foreground hover:text-foreground cursor-pointer transition-colors',
        props.class,
      )
    "
  >
    <slot>
      <Minus class="size-3" />
    </slot>
  </NumberFieldDecrement>
</template>
