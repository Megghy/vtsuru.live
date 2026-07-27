<script setup lang="ts">
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const level = [1, 2, 3].includes(Number(o.level)) ? Number(o.level) as 1 | 2 | 3 : 2
  const text = String(o.text ?? '')
  const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px'
  const framed = typeof o.framed === 'boolean' ? o.framed : true
  const backgrounded = typeof o.backgrounded === 'boolean' ? o.backgrounded : true
  return { level, text, fontSize, framed, backgrounded }
})

const headingTag = computed(() => `h${model.value.level}` as 'h1' | 'h2' | 'h3')
</script>

<template>
  <BlockCard :framed="model.framed" :backgrounded="model.backgrounded">
    <div class="heading-wrapper" :class="`level-${model.level}`">
      <component
        :is="headingTag"
        class="heading-text"
        :style="{ fontSize: model.fontSize }"
      >
        {{ model.text }}
      </component>
    </div>
  </BlockCard>
</template>

<style scoped>
.heading-wrapper {
  position: relative;
  padding-left: 12px;
}

.heading-wrapper.level-1 {
  padding-left: 14px;
}

.heading-text {
  display: block;
  margin: 0;
  color: var(--vtsuru-fg);
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: 0;
}

/* Subtle accent for H1/H2 */
.level-1::before, .level-2::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 4px;
  background: var(--vtsuru-brand-soft);
  border-radius: 99px;
  opacity: 0.8;
}

@media (max-width: 600px) {
  .level-1::before, .level-2::before {
    left: -8px;
  }
}
</style>
