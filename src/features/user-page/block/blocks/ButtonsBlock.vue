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
    vertical
    style="gap: 10px"
  >
    <NButton
      v-for="(it, idx) in items"
      :key="idx"
      tag="a"
      type="primary"
      target="_blank"
      rel="noopener noreferrer"
      :href="it.url"
      style="width: 100%"
    >
      {{ it.label }}
    </NButton>
  </NFlex>
</template>
