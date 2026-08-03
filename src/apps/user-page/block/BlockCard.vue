<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    contentStyle?: string | CSSProperties
    headerStyle?: string | CSSProperties
    footerStyle?: string | CSSProperties
    wrapStyle?: string | CSSProperties
    framed?: boolean
    backgrounded?: boolean
    borderTitle?: string
    borderTitleAlign?: 'left' | 'center' | 'right'
  }>(),
  {
    framed: true,
    backgrounded: true,
    borderTitleAlign: 'left',
  },
)

const resolvedContentStyle = computed<string | CSSProperties>(() => {
  return props.contentStyle ?? { padding: 'var(--vtsuru-page-spacing)' }
})
const isUnframed = computed(() => props.framed === false)
const isUnbackgrounded = computed(() => props.backgrounded === false)

const palette = computed(() => {
  const foreground = 'var(--vtsuru-surface-fg)'
  return {
    foreground,
    muted: isUnbackgrounded.value
      ? 'color-mix(in srgb, var(--vtsuru-page-text) 72%, transparent)'
      : 'var(--vtsuru-surface-fg-muted)',
    subtle: isUnbackgrounded.value
      ? 'color-mix(in srgb, var(--vtsuru-page-text) 55%, transparent)'
      : 'var(--vtsuru-surface-fg-subtle)',
    mutedBackground: isUnbackgrounded.value ? 'var(--vtsuru-bg-muted)' : 'var(--user-page-ui-surface-bg-hover)',
  }
})

const cardStyle = computed<CSSProperties>(() => ({
  '--vtsuru-block-fg': palette.value.foreground,
  '--vtsuru-block-fg-muted': palette.value.muted,
  '--vtsuru-block-fg-subtle': palette.value.subtle,
  '--vtsuru-block-bg-muted': palette.value.mutedBackground,
  '--vtsuru-block-border': 'var(--user-page-border-color, var(--vtsuru-border))',
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
    :class="{ unframed: isUnframed, unbackgrounded: isUnbackgrounded, 'has-border-title': showBorderTitle }"
    :style="props.wrapStyle"
  >
    <div
      v-if="showBorderTitle"
      class="border-title"
      :class="borderTitleAlignClass"
    >
      <span class="border-title__text">
        {{ borderTitleText }}
      </span>
    </div>
    <section
      class="vtsuru-block-card"
      :class="{ unframed: isUnframed, unbackgrounded: isUnbackgrounded }"
      :style="cardStyle"
    >
      <header
        v-if="$slots.header || $slots['header-extra']"
        class="vtsuru-block-card__header"
        :style="props.headerStyle"
      >
        <div class="vtsuru-block-card__title">
          <slot name="header" />
        </div>
        <div class="vtsuru-block-card__extra">
          <slot name="header-extra" />
        </div>
      </header>
      <div
        v-if="$slots.default"
        class="vtsuru-block-card__body"
        :style="resolvedContentStyle"
      >
        <slot />
      </div>
      <footer
        v-if="$slots.footer"
        class="vtsuru-block-card__footer"
        :style="props.footerStyle"
      >
        <slot name="footer" />
      </footer>
    </section>
  </div>
</template>

<style scoped>
.vtsuru-block-card-wrap {
  position: relative;
  display: flex;
  height: 100%;
  min-width: 0;
}

.border-title {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 3;
  pointer-events: none;
  display: flex;
  transform: translateY(-50%);
}

.border-title.align-left {
  justify-content: flex-start;
  padding-left: var(--vtsuru-page-spacing, 14px);
}
.border-title.align-center {
  justify-content: center;
}
.border-title.align-right {
  justify-content: flex-end;
  padding-right: var(--vtsuru-page-spacing, 14px);
}

.border-title__text {
  position: relative;
  display: inline-block;
  padding: 0;
  font-size: 12px;
  line-height: 1;
  color: var(--vtsuru-block-fg);
  font-weight: 600;
  letter-spacing: 0.2px;
  opacity: 0.9;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.12);
}

.vtsuru-block-card {
  flex: 1;
  min-width: 0;
  border-radius: var(--vtsuru-page-radius);
  color: var(--vtsuru-block-fg);
  background: var(--vtsuru-page-card-bg, var(--user-page-theme-surface-bg, var(--vtsuru-bg-muted)));
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: var(--vtsuru-page-border);
  box-shadow: var(--vtsuru-page-shadow);
  overflow: hidden;
}

.vtsuru-block-card.unframed {
  border: 0;
  box-shadow: none;
}

.vtsuru-block-card.unbackgrounded {
  color: var(--vtsuru-block-fg);
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
}

.vtsuru-block-card-wrap.unbackgrounded .border-title__text {
  color: var(--vtsuru-block-fg);
}

.vtsuru-block-card__header,
.vtsuru-block-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--vtsuru-page-spacing);
  padding: var(--vtsuru-page-spacing);
  border-bottom: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
}

.vtsuru-block-card__footer {
  border-top: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
  border-bottom: 0;
}

.vtsuru-block-card__title,
.vtsuru-block-card__extra,
.vtsuru-block-card__body {
  min-width: 0;
}
</style>
