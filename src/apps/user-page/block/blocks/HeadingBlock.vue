<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed } from 'vue'
import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const level = Number(o.level ?? 2)
  const text = String(o.text ?? '')
  const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px'
  return { level, text, fontSize }
})
</script>

<template>
  <BlockCard>
    <div class="heading-wrapper" :class="`level-${model.level}`">
      <NText
        strong
        class="heading-text"
        :style="{ fontSize: model.fontSize }"
      >
        {{ model.text }}
      </NText>
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
  line-height: 1.2;
  letter-spacing: -0.02em;
}

/* Subtle accent for H1/H2 */
.level-1::before, .level-2::before {
  content: "";
  position: absolute;
  left: 0;
  top: 4px;
  bottom: 4px;
  width: 4px;
  background: var(--n-primary-color);
  border-radius: 99px;
  opacity: 0.8;
}

@media (max-width: 600px) {
  .level-1::before, .level-2::before {
    left: -8px;
  }
}
</style>
