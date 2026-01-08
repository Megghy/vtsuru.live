<script setup lang="ts">
import { computed } from 'vue'
import { parseEmbedUrl } from '../embed'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const url = String(o.url ?? '')
  const title = typeof o.title === 'string' ? o.title : undefined
  return parseEmbedUrl(url, title)
})
</script>

<template>
  <div class="embed-wrapper">
    <iframe
      class="embed-frame"
      :src="model.src"
      :title="model.title"
      loading="lazy"
      allowfullscreen
      :allow="model.allow"
      :sandbox="model.sandbox"
      referrerpolicy="no-referrer"
    />
  </div>
</template>

<style scoped>
.embed-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
  background: rgba(0, 0, 0, 0.04);
}
.embed-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
