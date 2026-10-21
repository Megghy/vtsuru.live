<script setup lang="ts">
import { NumberFieldIncrement, type NumberFieldIncrementProps } from 'reka-ui'
import { Plus } from 'lucide-vue-next'
import { computed, type HTMLAttributes } from 'vue'

import { cn } from '@/shared/utils/cn'

const props = defineProps<NumberFieldIncrementProps & { class?: HTMLAttributes['class'] }>()

const delegatedProps = computed(() => {
  const { class: _, ...delegated } = props
  return delegated
})
</script>

<template>
  <NumberFieldIncrement
    v-bind="delegatedProps"
    :class="
      cn(
        'absolute top-1/2 -translate-y-1/2 right-0 p-1.5 disabled:cursor-not-allowed disabled:opacity-30 text-muted-foreground hover:text-foreground cursor-pointer transition-colors',
        props.class,
      )
    "
  >
    <slot>
      <Plus class="size-3" />
    </slot>
  </NumberFieldIncrement>
</template>
