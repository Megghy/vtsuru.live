<script setup lang="ts">
import { NCard, NText } from 'naive-ui'
import { computed } from 'vue'

interface BlockConfig {
  text?: string
  author?: string
  align?: 'left' | 'center' | 'right'
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const align = (o.align === 'left' || o.align === 'center' || o.align === 'right') ? o.align : 'center'
  return {
    text: typeof o.text === 'string' ? o.text : '',
    author: typeof o.author === 'string' ? o.author : '',
    align,
  }
})
</script>

<template>
  <NCard size="small">
    <div class="quote" :style="{ textAlign: cfg.align }">
      <NText v-if="cfg.text" class="quote-text">
        “{{ cfg.text }}”
      </NText>
      <NText v-else depth="3">
        未设置内容
      </NText>
      <NText v-if="cfg.author" depth="3" class="quote-author">
        —— {{ cfg.author }}
      </NText>
    </div>
  </NCard>
</template>

<style scoped>
.quote {
  padding: 6px 4px;
}
.quote-text {
  display: block;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.3;
  white-space: pre-wrap;
}
.quote-author {
  display: block;
  margin-top: 10px;
}
</style>

