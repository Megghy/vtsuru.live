<script setup lang="ts">
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const propsObj = computed<Record<string, any>>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return o
})

const height = computed(() => {
  const o = propsObj.value
  const size = String(o.size ?? 'md')
  if (size === 'sm') return 8
  if (size === 'lg') return 24
  return 16
})

const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : false))
</script>

<template>
  <BlockCard v-if="framed" :framed="true" :content-style="{ padding: 0 }">
    <div :style="{ height: `${height}px` }" />
  </BlockCard>
  <div v-else :style="{ height: `${height}px` }" />
</template>
