<script setup lang="ts">
import { ChatbubbleEllipsesOutline } from '@vicons/ionicons5'
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'
import { normalizeTextAppearance, textAppearanceClass } from '../textAppearance'

import '../textAppearance.css'

interface BlockConfig {
  text?: string
  author?: string
  align?: 'left' | 'center' | 'right'
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

const propsObj = computed(() =>
  props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
    ? (props.blockProps as Record<string, unknown>)
    : {},
)

const cfg = computed<BlockConfig>(() => {
  const o = propsObj.value as any
  const align = o.align === 'left' || o.align === 'center' || o.align === 'right' ? o.align : 'center'
  return {
    text: typeof o.text === 'string' ? o.text : '',
    author: typeof o.author === 'string' ? o.author : '',
    align,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const appearance = computed(() => normalizeTextAppearance(propsObj.value))
const fxClass = computed(() => textAppearanceClass(appearance.value))
</script>

<template>
  <BlockCard
    class="relative"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <div class="absolute -top-2.5 left-2.5 opacity-5 text-muted-foreground pointer-events-none z-0">
      <component
        :is="ChatbubbleEllipsesOutline"
        class="size-20"
      />
    </div>
    <div
      class="px-2 py-4 relative z-1 h-full flex flex-col justify-center"
      :style="{ textAlign: cfg.align }"
    >
      <div
        v-if="cfg.text"
        class="block text-xl font-serif font-bold leading-normal whitespace-pre-wrap italic text-foreground"
        :class="[fxClass, fxClass.includes('vtsuru-text-fx--typewriter') ? 'whitespace-nowrap' : '']"
      >
        “{{ cfg.text }}”
      </div>
      <div
        v-else
        class="block font-sans not-italic font-normal text-sm text-muted-foreground"
      >
        未设置内容
      </div>
      <div
        v-if="cfg.author"
        class="block mt-4 text-sm font-medium text-muted-foreground"
      >
        —— {{ cfg.author }}
      </div>
    </div>
  </BlockCard>
</template>
