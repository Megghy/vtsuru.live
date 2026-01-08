<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const height = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const size = String(o.size ?? 'md')
  if (size === 'sm') return 8
  if (size === 'lg') return 24
  return 16
})
</script>

<template>
  <div :style="{ height: `${height}px` }" />
</template>
