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
const items = computed(() => (Array.isArray(propsObj.value.items) ? propsObj.value.items : []))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
const backgrounded = computed(() =>
  typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : true,
)
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
  >
    <div class="flex justify-center flex-wrap gap-2.5">
      <a
        v-for="(it, idx) in items"
        :key="idx"
        target="_blank"
        rel="noopener noreferrer"
        :href="it.url"
        class="vtsuru-link-tag inline-flex items-center justify-center text-xs h-8 px-4 font-medium transition-all"
        :aria-label="`${it.label || '打开链接'}（新窗口打开）`"
      >
        {{ it.label }}
      </a>
    </div>
  </BlockCard>
</template>

<style scoped>
.vtsuru-link-tag {
  border-radius: var(--vtsuru-page-radius);
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-border);
  background: var(--vtsuru-bg-elevated);
  color: var(--vtsuru-block-fg);
  text-decoration: none;
}

.vtsuru-link-tag:hover {
  background: var(--vtsuru-bg-muted);
  border-color: var(--vtsuru-page-primary, var(--vtsuru-brand));
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .vtsuru-link-tag {
    transition: none;
  }
  .vtsuru-link-tag:hover {
    transform: none;
  }
}
</style>
