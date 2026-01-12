<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const items = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return Array.isArray(o.items) ? o.items : []
})
</script>

<template>
  <NFlex
    justify="center"
    wrap
    style="gap: 8px"
  >
    <NButton
      v-for="(it, idx) in items"
      :key="idx"
      tag="a"
      type="info"
      secondary
      target="_blank"
      rel="noopener noreferrer"
      :href="it.url"
    >
      {{ it.label }}
    </NButton>
  </NFlex>
</template>
