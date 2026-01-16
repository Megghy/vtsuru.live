<script setup lang="ts">
import { NCollapse, NCollapseItem, NText, NIcon } from 'naive-ui'
import { computed } from 'vue'
import { HelpCircleOutline, ChevronDownOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface FAQItem {
  q?: string
  a?: string
}

interface BlockConfig {
  accordion?: boolean
  items?: FAQItem[]
  title?: string
  framed?: boolean
}

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  return {
    accordion: typeof o.accordion === 'boolean' ? o.accordion : false,
    items: Array.isArray(o.items) ? o.items : [],
    title: typeof o.title === 'string' ? o.title : '常见问题',
    framed: typeof o.framed === 'boolean' ? o.framed : true,
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
  <BlockCard class="faq-card" :framed="cfg.framed">
    <template #header>
      <NFlex align="center" style="gap: 8px">
        <NIcon size="18" depth="2">
          <HelpCircleOutline />
        </NIcon>
        <span>{{ cfg.title }}</span>
      </NFlex>
    </template>

    <NText v-if="items.length === 0" depth="3" class="placeholder">
      暂无内容
    </NText>

    <NCollapse v-else :accordion="cfg.accordion" class="faq-collapse" arrow-placement="right">
      <template #arrow>
        <NIcon><ChevronDownOutline /></NIcon>
      </template>
      <NCollapseItem
        v-for="(it, idx) in items"
        :key="idx"
        :name="String(idx)"
        class="faq-item"
      >
        <template #header>
          <NText strong class="faq-q">
            {{ it.q || `问题 ${idx + 1}` }}
          </NText>
        </template>
        <div class="faq-a">
          {{ it.a }}
        </div>
      </NCollapseItem>
    </NCollapse>
  </BlockCard>
</template>

<style scoped>
.placeholder {
  display: block;
  padding: 12px 4px;
}

.faq-collapse {
  margin-top: -8px;
}

:deep(.faq-item) {
  margin-top: 8px !important;
  border: 1px solid var(--n-divider-color) !important;
  border-radius: var(--vtsuru-page-radius) !important;
  transition: all 0.2s ease;
  overflow: hidden;
}

:deep(.faq-item.n-collapse-item--active) {
  background: var(--n-action-color);
}

:deep(.faq-item .n-collapse-item__header) {
  padding: 12px 16px !important;
}

.faq-q {
  font-size: 14px;
}

.faq-a {
  padding: 0 16px 16px 16px;
  white-space: pre-wrap;
  color: var(--n-text-color-2);
  line-height: 1.6;
  font-size: 14px;
}
</style>
