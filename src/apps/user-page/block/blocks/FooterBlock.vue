<script setup lang="ts">
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  return o
})

const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : false))
const backgrounded = computed(() =>
  typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : false,
)
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
  >
    <div class="footer">
      <span class="footer-text">
        {{ text || 'Powered by vtsuru.live' }}
      </span>
    </div>
  </BlockCard>
</template>

<style scoped>
.footer {
  text-align: center;
}

.footer-text {
  color: var(--vtsuru-fg-muted);
}
</style>
