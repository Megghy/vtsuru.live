<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const text = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return typeof o.text === 'string' ? o.text : ''
})
</script>

<template>
  <BlockCard>
    <NText class="text-content">
      {{ text }}
    </NText>
  </BlockCard>
</template>

<style scoped>
.text-content {
  white-space: pre-wrap;
  display: block;
  line-height: 1.8;
  font-size: 14px;
  color: var(--n-text-color);
}
</style>
