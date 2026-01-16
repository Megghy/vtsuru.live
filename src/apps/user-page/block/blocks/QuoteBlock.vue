<script setup lang="ts">
import { NText, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { ChatbubbleEllipsesOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  text?: string
  author?: string
  align?: 'left' | 'center' | 'right'
  framed?: boolean
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
    framed: typeof o.framed === 'boolean' ? o.framed : true,
  }
})
</script>

<template>
  <BlockCard class="quote-card" :framed="cfg.framed" :content-style="{ padding: 0 }">
    <div class="quote-bg-icon">
      <NIcon><ChatbubbleEllipsesOutline /></NIcon>
    </div>
    <div class="quote" :style="{ textAlign: cfg.align }">
      <NText v-if="cfg.text" class="quote-text">
        “{{ cfg.text }}”
      </NText>
      <NText v-else depth="3" class="quote-text placeholder">
        未设置内容
      </NText>
      <NText v-if="cfg.author" depth="3" class="quote-author">
        —— {{ cfg.author }}
      </NText>
    </div>
  </BlockCard>
</template>

<style scoped>
.quote-card {
  position: relative;
}

.quote-card :deep(.n-card__content) {
  height: 100%;
}

.quote-bg-icon {
  position: absolute;
  top: -10px;
  left: 10px;
  font-size: 80px;
  opacity: 0.05;
  color: var(--n-text-color);
  pointer-events: none;
  z-index: 0;
}

.quote {
  padding: 16px 8px;
  position: relative;
  z-index: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.quote-text {
  display: block;
  font-size: 20px;
  font-family: serif; /* Elegant for quotes */
  font-weight: 700;
  line-height: 1.5;
  white-space: pre-wrap;
  font-style: italic;
}

.quote-text.placeholder {
  font-family: inherit;
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
}

.quote-author {
  display: block;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 500;
  opacity: 0.8;
}
</style>
