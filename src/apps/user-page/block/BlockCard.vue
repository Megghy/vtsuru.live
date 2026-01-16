<script setup lang="ts">
import { NCard } from 'naive-ui'
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  contentStyle?: string | CSSProperties
  headerStyle?: string | CSSProperties
  footerStyle?: string | CSSProperties
  wrapStyle?: string | CSSProperties
  framed?: boolean
  borderTitle?: string
  borderTitleAlign?: 'left' | 'center' | 'right'
}>(), {
  framed: true,
  borderTitleAlign: 'left',
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

const borderTitleText = computed(() => (typeof props.borderTitle === 'string' ? props.borderTitle.trim() : ''))
const showBorderTitle = computed(() => !isUnframed.value && borderTitleText.value.length > 0)
const borderTitleAlignClass = computed(() => {
  const v = props.borderTitleAlign
  if (v === 'center') return 'align-center'
  if (v === 'right') return 'align-right'
  return 'align-left'
})
</script>

<template>
  <div
    class="vtsuru-block-card-wrap"
    :class="{ unframed: isUnframed, 'has-border-title': showBorderTitle }"
    :style="[cardStyle, props.wrapStyle]"
  >
    <div v-if="showBorderTitle" class="border-title" :class="borderTitleAlignClass">
      <span class="border-title__text">
        {{ borderTitleText }}
      </span>
    </div>
    <NCard
      size="small"
      :bordered="!isUnframed"
      class="vtsuru-block-card"
      :class="{ unframed: isUnframed }"
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
  </div>
</template>

<style scoped>
.vtsuru-block-card-wrap {
  position: relative;
  display: flex;
  min-width: 0;
}

.border-title {
  position: absolute;
  top: 0;
  z-index: 3;
  pointer-events: none;
}

.border-title.align-left {
  left: 14px;
  transform: translateY(-50%);
}
.border-title.align-center {
  left: 50%;
  transform: translate(-50%, -50%);
}
.border-title.align-right {
  right: 14px;
  transform: translateY(-50%);
}

.border-title__text {
  position: relative;
  display: inline-block;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 16px;
  border-radius: 9999px;
  background: var(--user-page-ui-surface-bg, var(--n-card-color));
  color: var(--n-text-color, var(--vtsuru-page-text, currentColor));
  font-weight: 600;
  letter-spacing: 0.2px;
}

.vtsuru-block-card {
  flex: 1;
  min-width: 0;
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
