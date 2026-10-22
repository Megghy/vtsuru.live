<script setup lang="ts">
import { computed } from 'vue'

import BlockCard from '../BlockCard.vue'
import { getHeadingAnchorId } from '../sectionNavigation'
import { normalizeTextAppearance, textAppearanceClass } from '../textAppearance'

import '../textAppearance.css'

const props = defineProps<{ blockProps: unknown; blockId?: string; userInfo?: unknown; biliInfo?: unknown }>()

const model = computed(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as any)
      : {}
  const level = [1, 2, 3].includes(Number(o.level)) ? (Number(o.level) as 1 | 2 | 3) : 2
  const text = String(o.text ?? '')
  const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px'
  const framed = typeof o.framed === 'boolean' ? o.framed : true
  const backgrounded = typeof o.backgrounded === 'boolean' ? o.backgrounded : true
  return { level, text, fontSize, framed, backgrounded }
})

const appearance = computed(() =>
  normalizeTextAppearance(
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, unknown>)
      : {},
  ),
)
const fxClass = computed(() => textAppearanceClass(appearance.value))
const headingTag = computed(() => `h${model.value.level}` as 'h1' | 'h2' | 'h3')
const anchorId = computed(() => (props.blockId ? getHeadingAnchorId(props.blockId) : undefined))
</script>

<template>
  <BlockCard
    :framed="model.framed"
    :backgrounded="model.backgrounded"
  >
    <div class="@container min-w-0">
      <div
        class="heading-accent relative"
        :class="model.level === 1 ? 'pl-3.5' : 'pl-3'"
      >
        <component
          :is="headingTag"
          :id="anchorId"
          data-user-page-section="true"
          class="block m-0 text-foreground font-bold leading-tight scroll-mt-6"
          :class="fxClass"
          :style="{ fontSize: model.fontSize }"
        >
          {{ model.text }}
        </component>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.heading-accent::before {
  content: '';
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 4px;
  background: var(--primary);
  opacity: 0.35;
  border-radius: 99px;
}
@container (max-width: 600px) {
  .heading-accent::before {
    left: -8px;
  }
}
</style>
