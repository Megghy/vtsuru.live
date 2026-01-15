<script setup lang="ts">
import { NCard } from 'naive-ui'
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  contentStyle?: string | CSSProperties
  headerStyle?: string | CSSProperties
  footerStyle?: string | CSSProperties
  framed?: boolean
}>(), {
  framed: true,
})

const resolvedContentStyle = computed<string | CSSProperties>(() => {
  return props.contentStyle ?? { padding: 'var(--vtsuru-page-spacing)' }
})
const isUnframed = computed(() => props.framed === false)

const cardStyle = computed<CSSProperties>(() => ({
  '--n-border-color': isUnframed.value
    ? 'transparent'
    : 'var(--vtsuru-card-border-color, var(--user-page-border-color, var(--n-divider-color)))',
}))
</script>

<template>
  <NCard
    size="small"
    :bordered="!isUnframed"
    class="vtsuru-block-card"
    :class="{ unframed: isUnframed }"
    :style="cardStyle"
    :content-style="resolvedContentStyle"
    :header-style="props.headerStyle"
    :footer-style="props.footerStyle"
  >
    <template v-if="$slots.header" #header>
      <slot name="header" />
    </template>
    <template v-if="$slots['header-extra']" #header-extra>
      <slot name="header-extra" />
    </template>
    <template v-if="$slots.default">
      <slot />
    </template>
    <template v-if="$slots.footer" #footer>
      <slot name="footer" />
    </template>
  </NCard>
</template>

<style scoped>
.vtsuru-block-card {
  border-radius: var(--vtsuru-page-radius);
  background: var(--n-card-color);
  box-shadow:
    0 1px 0 rgba(0, 0, 0, 0.02),
    0 10px 30px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.vtsuru-block-card.unframed {
  box-shadow: none;
}

.vtsuru-block-card :deep(.n-card-header) {
  padding: 12px var(--vtsuru-page-spacing);
  border-bottom: 1px solid var(--n-divider-color);
}

.vtsuru-block-card :deep(.n-card__content) {
  min-width: 0;
}
</style>
