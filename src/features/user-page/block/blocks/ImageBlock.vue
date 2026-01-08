<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    url: typeof o.url === 'string' ? o.url : '',
    alt: typeof o.alt === 'string' ? o.alt : '',
  }
})
</script>

<template>
  <img
    :src="model.url"
    :alt="model.alt"
    referrerpolicy="no-referrer"
    style="width: 100%; border-radius: var(--vtsuru-page-radius); display: block"
  >
</template>
