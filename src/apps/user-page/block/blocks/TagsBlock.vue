<script setup lang="ts">
import { NFlex, NTag } from 'naive-ui';
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
  backgrounded?: boolean
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
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : false,
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

function getContrastColor(color: string) {
  const value = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i)?.[1]
  if (!value) return 'var(--vtsuru-fg)'
  const hex = value.length === 3 ? [...value].map(char => char + char).join('') : value
  const [red, green, blue] = [0, 2, 4].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16))
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000
  return luminance >= 150 ? '#111111' : '#ffffff'
}
</script>

<template>
  <BlockCard :framed="cfg.framed" :backgrounded="cfg.backgrounded" :border-title="cfg.framed ? cfg.borderTitle : ''" :border-title-align="cfg.borderTitleAlign">
    <NFlex justify="center" wrap style="gap: 8px">
      <NTag
        v-for="(it, idx) in items"
        :key="idx"
        :type="it.type"
        :round="cfg.rounded"
        :size="cfg.size"
        :bordered="false"
        class="vtsuru-tag"
        :color="it.color ? { color: it.color, textColor: getContrastColor(it.color), borderColor: 'transparent' } : undefined"
      >
        {{ it.text }}
      </NTag>
    </NFlex>
  </BlockCard>
</template>

<style scoped>
.vtsuru-tag {
  font-weight: 500;
  transition: filter 0.2s ease, transform 0.2s ease;
  cursor: default;
}

/* Semi-transparent background for typed tags */
:deep(.n-tag--default-type) { background: var(--vtsuru-bg-muted) !important; color: var(--vtsuru-fg-muted) !important; }

.vtsuru-tag:not(.n-tag--round) {
  border-radius: var(--vtsuru-page-radius);
}

.vtsuru-tag:hover {
  filter: brightness(0.95);
  transform: translateY(-1px);
}

@media (prefers-reduced-motion: reduce) {
  .vtsuru-tag { transition: none; }
  .vtsuru-tag:hover { transform: none; }
}
</style>
