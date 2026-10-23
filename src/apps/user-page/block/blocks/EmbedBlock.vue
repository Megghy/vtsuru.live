<script setup lang="ts">
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'
import { parseEmbedUrl } from '../embed'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const model = computed(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
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
  <BlockCard
    :framed="model.framed"
    :backgrounded="model.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div class="relative w-full pt-[56.25%] bg-muted">
      <iframe
        v-if="model.ok"
        class="absolute inset-0 size-full border-0"
        :src="model.src"
        :title="model.title"
        loading="lazy"
        :allow="model.allow"
        :sandbox="model.sandbox"
        referrerpolicy="no-referrer"
      />
      <div
        v-else
        class="absolute inset-0 flex flex-col justify-center gap-1.5 px-3.5 py-3 text-foreground bg-muted"
      >
        <div class="font-semibold text-[13px]">嵌入链接无效</div>
        <div class="text-xs leading-normal opacity-90 break-words">请使用支持的哔哩哔哩或 YouTube 视频链接</div>
      </div>
    </div>
  </BlockCard>
</template>
