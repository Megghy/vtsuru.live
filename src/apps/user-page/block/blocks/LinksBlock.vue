<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const propsObj = computed<Record<string, any>>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return o
})
const items = computed(() => (Array.isArray(propsObj.value.items) ? propsObj.value.items : []))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
</script>

<template>
  <BlockCard :framed="framed">
    <NFlex
      justify="center"
      wrap
      style="gap: 10px"
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
        class="vtsuru-link-tag"
      >
        {{ it.label }}
      </NButton>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.vtsuru-link-tag {
  border-radius: var(--vtsuru-page-radius);
  padding: 0 16px;
  font-weight: 500;
  border: 1px solid var(--n-divider-color);
  background: var(--n-card-color);
  transition: all 0.2s ease;
}

.vtsuru-link-tag:hover {
  background: var(--n-action-color);
  border-color: var(--n-primary-color-hover);
  transform: translateY(-1px);
}
</style>
