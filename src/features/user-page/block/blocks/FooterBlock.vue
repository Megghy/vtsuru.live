<script setup lang="ts">
import { NText } from 'naive-ui'
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
  <div style="text-align:center; padding: 10px 0">
    <NText depth="3">
      {{ text || 'Powered by vtsuru.live' }}
    </NText>
  </div>
</template>
