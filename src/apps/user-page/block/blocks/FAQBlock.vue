<script setup lang="ts">
import { HelpCircleOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion'

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
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  return {
    accordion: typeof o.accordion === 'boolean' ? o.accordion : false,
    items: Array.isArray(o.items) ? o.items : [],
    title: typeof o.title === 'string' ? o.title : '常见问题',
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const items = computed(() => {
  const list = cfg.value.items ?? []
  return list
    .map((it) => ({
      q: typeof it?.q === 'string' ? it.q.trim() : '',
      a: typeof it?.a === 'string' ? it.a.trim() : '',
    }))
    .filter((it) => it.q.length > 0 || it.a.length > 0)
})
</script>

<template>
  <BlockCard
    class="faq-card"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
  >
    <template #header>
      <div class="flex items-center gap-2">
        <component :is="HelpCircleOutline" class="size-4.5 text-muted-foreground" />
        <span class="font-medium text-sm">{{ cfg.title }}</span>
      </div>
    </template>

    <div
      v-if="items.length === 0"
      class="placeholder text-xs text-muted-foreground py-3 px-1"
    >
      暂无内容
    </div>

    <Accordion
      v-else
      :type="cfg.accordion ? 'single' : 'multiple'"
      class="faq-collapse w-full flex flex-col gap-2 mt-1"
    >
      <AccordionItem
        v-for="(it, idx) in items"
        :key="idx"
        :value="String(idx)"
        class="faq-item border border-border rounded-lg bg-card/50 overflow-hidden"
      >
        <AccordionTrigger class="px-3 py-2.5 text-xs font-medium hover:no-underline">
          <span class="faq-q text-left">
            {{ it.q || `问题 ${idx + 1}` }}
          </span>
        </AccordionTrigger>
        <AccordionContent class="px-3 pb-3 pt-0 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {{ it.a }}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  </BlockCard>
</template>

<style scoped>
.faq-q {
  font-size: 13px;
  color: var(--vtsuru-block-fg);
}
</style>
