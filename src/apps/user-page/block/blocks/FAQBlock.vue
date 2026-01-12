<script setup lang="ts">
import { NCard, NCollapse, NCollapseItem, NText } from 'naive-ui'
import { computed } from 'vue'

interface FAQItem {
  q?: string
  a?: string
}

interface BlockConfig {
  accordion?: boolean
  items?: FAQItem[]
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    accordion: typeof o.accordion === 'boolean' ? o.accordion : false,
    items: Array.isArray(o.items) ? o.items : [],
  }
})

const items = computed(() => {
  const list = cfg.value.items ?? []
  return list
    .map((it) => ({
      q: typeof it?.q === 'string' ? it.q.trim() : '',
      a: typeof it?.a === 'string' ? it.a.trim() : '',
    }))
    .filter(it => it.q.length > 0 || it.a.length > 0)
})
</script>

<template>
  <NCard size="small">
    <template #header>
      FAQ
    </template>

    <NText v-if="items.length === 0" depth="3">
      暂无内容
    </NText>

    <NCollapse v-else :accordion="cfg.accordion">
      <NCollapseItem
        v-for="(it, idx) in items"
        :key="idx"
        :title="it.q || `问题 ${idx + 1}`"
        :name="String(idx)"
      >
        <div style="white-space: pre-wrap">
          {{ it.a }}
        </div>
      </NCollapseItem>
    </NCollapse>
  </NCard>
</template>

