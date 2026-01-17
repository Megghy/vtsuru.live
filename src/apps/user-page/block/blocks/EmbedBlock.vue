<script setup lang="ts">
import { computed } from 'vue'
import { parseEmbedUrl } from '../embed'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const url = String(o.url ?? '')
  const title = typeof o.title === 'string' ? o.title : undefined
  const framed = typeof o.framed === 'boolean' ? o.framed : true
  const backgrounded = typeof o.backgrounded === 'boolean' ? o.backgrounded : true
  try {
    return { ok: true as const, framed, backgrounded, ...parseEmbedUrl(url, title), rawUrl: url, errorMessage: '' }
  } catch (e) {
    return {
      ok: false as const,
      framed,
      backgrounded,
      provider: 'youtube' as const,
      src: 'about:blank',
      allow: '',
      sandbox: '',
      title: title || '嵌入视频',
      rawUrl: url,
      errorMessage: (e as Error).message || String(e),
    }
  }
})
</script>

<template>
  <BlockCard :framed="model.framed" :backgrounded="model.backgrounded" :content-style="{ padding: 0 }">
    <div class="embed-wrapper">
      <iframe
        v-if="model.ok"
        class="embed-frame"
        :src="model.src"
        :title="model.title"
        loading="lazy"
        allowfullscreen
        :allow="model.allow"
        :sandbox="model.sandbox"
        referrerpolicy="no-referrer"
      />
      <div v-else class="embed-placeholder">
        <div class="embed-placeholder__title">
          嵌入链接无效
        </div>
        <div class="embed-placeholder__desc">
          {{ model.errorMessage }}
        </div>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.embed-wrapper {
  position: relative;
  width: 100%;
  padding-top: 56.25%;
  background: var(--n-fill-color);
}
.embed-frame {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.embed-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  padding: 12px 14px;
  color: var(--n-text-color);
  background: var(--n-action-color);
}

.embed-placeholder__title {
  font-weight: 650;
  font-size: 13px;
}

.embed-placeholder__desc {
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.9;
  word-break: break-word;
}
</style>
