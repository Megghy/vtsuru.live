<script setup lang="ts">
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const file = (o.imageFile && typeof o.imageFile === 'object' && !Array.isArray(o.imageFile)) ? o.imageFile : null
  return {
    url: (file && typeof file.path === 'string' && file.path) ? file.path : (typeof o.url === 'string' ? o.url : ''),
    alt: typeof o.alt === 'string' ? o.alt : '',
    maxWidth: typeof o.maxWidth === 'string' ? o.maxWidth : '',
    maxHeight: typeof o.maxHeight === 'string' ? o.maxHeight : '',
  }
})
</script>

<template>
  <BlockCard :content-style="{ padding: 0 }">
    <img
      :src="model.url"
      :alt="model.alt"
      referrerpolicy="no-referrer"
      :style="{
        width: '100%',
        height: 'auto',
        maxWidth: model.maxWidth?.trim() ? model.maxWidth.trim() : undefined,
        maxHeight: model.maxHeight?.trim() ? model.maxHeight.trim() : undefined,
        display: 'block',
      }"
    >
  </BlockCard>
</template>
