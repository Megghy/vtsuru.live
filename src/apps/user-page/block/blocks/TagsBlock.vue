<script setup lang="ts">
import { NFlex, NTag } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

interface TagItem {
  text: string
  type?: 'default' | 'info' | 'success' | 'warning' | 'error'
  color?: string
}

interface BlockConfig {
  size?: 'small' | 'medium'
  rounded?: boolean
  items?: TagItem[]
  framed?: boolean
  borderTitle?: string
  borderTitleAlign?: 'left' | 'center' | 'right'
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    size: (o.size === 'small' || o.size === 'medium') ? o.size : 'medium',
    rounded: typeof o.rounded === 'boolean' ? o.rounded : true,
    items: Array.isArray(o.items) ? o.items : [],
    framed: typeof o.framed === 'boolean' ? o.framed : false,
    borderTitle: typeof o.borderTitle === 'string' ? o.borderTitle : '',
    borderTitleAlign: (o.borderTitleAlign === 'left' || o.borderTitleAlign === 'center' || o.borderTitleAlign === 'right') ? o.borderTitleAlign : 'left',
  }
})

const items = computed(() => {
  const list = cfg.value.items ?? []
  return list
    .map((it) => {
      const text = typeof it?.text === 'string' ? it.text.trim() : ''
      const type = (it?.type === 'default' || it?.type === 'info' || it?.type === 'success' || it?.type === 'warning' || it?.type === 'error')
        ? it.type
        : undefined
      const color = typeof it?.color === 'string' ? it.color.trim() : ''
      return { text, type, color }
    })
    .filter(it => it.text.length > 0)
})
</script>

<template>
  <BlockCard :framed="cfg.framed" :border-title="cfg.framed ? cfg.borderTitle : ''" :border-title-align="cfg.borderTitleAlign">
    <NFlex justify="center" wrap style="gap: 8px">
      <NTag
        v-for="(it, idx) in items"
        :key="idx"
        :type="it.type"
        :round="cfg.rounded"
        :size="cfg.size"
        :bordered="false"
        class="vtsuru-tag"
        :color="it.color ? { color: it.color, textColor: '#fff', borderColor: 'transparent' } : undefined"
      >
        {{ it.text }}
      </NTag>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.vtsuru-tag {
  font-weight: 500;
  transition: all 0.2s ease;
  cursor: default;
}

/* Semi-transparent background for typed tags */
:deep(.n-tag--default-type) { background: var(--n-action-color) !important; color: var(--n-text-color-2) !important; }
:deep(.n-tag--info-type) { background: rgba(32, 128, 240, 0.1) !important; color: #2080f0 !important; }
:deep(.n-tag--success-type) { background: rgba(24, 160, 88, 0.1) !important; color: #18a058 !important; }
:deep(.n-tag--warning-type) { background: rgba(240, 160, 32, 0.1) !important; color: #f0a020 !important; }
:deep(.n-tag--error-type) { background: rgba(208, 48, 80, 0.1) !important; color: #d03050 !important; }

.vtsuru-tag:not(.n-tag--round) {
  border-radius: var(--vtsuru-page-radius);
}

.vtsuru-tag:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}
</style>
