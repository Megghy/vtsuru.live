<script setup lang="ts">
import { NText } from 'naive-ui';
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return o
}) 
const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
const backgrounded = computed(() => (typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : true))
</script>

<template>
  <BlockCard :framed="framed" :backgrounded="backgrounded">
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
