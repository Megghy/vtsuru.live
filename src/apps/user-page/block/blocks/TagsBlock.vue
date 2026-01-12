<script setup lang="ts">
import { NFlex, NTag } from 'naive-ui'
import { computed } from 'vue'

interface TagItem {
  text: string
  type?: 'default' | 'info' | 'success' | 'warning' | 'error'
  color?: string
}

interface BlockConfig {
  size?: 'small' | 'medium'
  rounded?: boolean
  items?: TagItem[]
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
  <NFlex justify="center" wrap style="gap: 10px">
    <NTag
      v-for="(it, idx) in items"
      :key="idx"
      :type="it.type"
      :round="cfg.rounded"
      :size="cfg.size"
      :color="it.color ? { color: it.color, textColor: '#fff', borderColor: it.color } : undefined"
    >
      {{ it.text }}
    </NTag>
  </NFlex>
</template>

