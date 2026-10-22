<script setup lang="ts">
import type { CSSProperties } from 'vue'
import { computed } from 'vue'

import { provideThemeScope, type ThemeStyle } from '@/shared/config/theme/scope'

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
  const foreground = isUnbackgrounded.value ? 'var(--foreground)' : 'var(--card-foreground)'
  return {
    foreground,
    muted: isUnbackgrounded.value
      ? 'var(--muted-foreground)'
      : 'color-mix(in srgb, var(--card-foreground) 75%, transparent)',
    mutedBackground: isUnbackgrounded.value ? 'var(--muted)' : 'var(--secondary)',
  }
})

const cardStyle = computed<ThemeStyle>(() => ({
  '--foreground': palette.value.foreground,
  '--card-foreground': palette.value.foreground,
  '--muted-foreground': palette.value.muted,
  '--muted': palette.value.mutedBackground,
}))

provideThemeScope(
  computed(() => ({
    ...cardStyle.value,
    ...(isUnbackgrounded.value
      ? {
          '--foreground': 'var(--foreground)',
          '--card-foreground': 'var(--foreground)',
          '--muted-foreground': 'var(--muted-foreground)',
        }
      : {}),
  })),
)

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
    class="vtsuru-block-card relative flex flex-col h-full min-w-0 rounded-[var(--radius)] text-card-foreground bg-card border shadow-[var(--ui-shadow,none)] overflow-hidden backdrop-blur-[var(--user-page-card-blur,12px)]"
    :class="{
      'overflow-visible': showBorderTitle,
      '!border-0 !shadow-none': isUnframed,
      '!bg-transparent !shadow-none backdrop-blur-none': isUnbackgrounded,
    }"
    :style="[props.wrapStyle, cardStyle]"
  >
    <div
      v-if="showBorderTitle"
      class="absolute top-0 left-0 right-0 z-[3] pointer-events-none flex -translate-y-1/2"
      :class="{
        'justify-start pl-[var(--vtsuru-page-spacing,14px)]': borderTitleAlignClass === 'align-left',
        'justify-center': borderTitleAlignClass === 'align-center',
        'justify-end pr-[var(--vtsuru-page-spacing,14px)]': borderTitleAlignClass === 'align-right',
      }"
    >
      <span class="relative inline-block text-xs leading-none text-foreground font-semibold tracking-wide opacity-90 [text-shadow:0_1px_0_rgba(0,0,0,0.12)]">
        {{ borderTitleText }}
      </span>
    </div>
    <div
      v-if="$slots.header || $slots['header-extra']"
      class="flex items-center justify-between p-[var(--vtsuru-page-spacing)] border-b border-border"
      :style="props.headerStyle"
    >
      <div class="flex-1 min-w-0">
        <slot name="header" />
      </div>
      <div
        v-if="$slots['header-extra']"
        class="shrink-0 ml-2"
      >
        <slot name="header-extra" />
      </div>
    </div>
    <div
      class="min-w-0 flex-1"
      :style="resolvedContentStyle"
    >
      <slot />
    </div>
    <div
      v-if="$slots.footer"
      class="p-[var(--vtsuru-page-spacing)] border-t border-border"
      :style="props.footerStyle"
    >
      <slot name="footer" />
    </div>
  </div>
</template>


