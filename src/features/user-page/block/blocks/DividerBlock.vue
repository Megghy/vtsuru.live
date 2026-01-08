<script setup lang="ts">
import { NDivider } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const text = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return typeof o.text === 'string' ? o.text : ''
})
</script>

<template>
  <NDivider v-if="text">
    {{ text }}
  </NDivider>
  <NDivider v-else />
</template>
