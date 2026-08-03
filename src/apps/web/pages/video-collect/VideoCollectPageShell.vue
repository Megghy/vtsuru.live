<script setup lang="ts">
import { toRef } from 'vue'

import type { VideoCollectTable } from '@/api/api-models'

import { useVideoCollectPageTheme } from './useVideoCollectPageTheme'

const props = defineProps<{
  table?: VideoCollectTable | null
}>()

const { effectiveIsDark, pageBackgroundClass, pageBackgroundVars, pageThemeVars } = useVideoCollectPageTheme(
  toRef(props, 'table'),
)
</script>

<template>
  <div
    class="video-collect-page page-root"
    :class="pageBackgroundClass"
    :style="[pageThemeVars, pageBackgroundVars]"
  >
    <slot :effective-is-dark="effectiveIsDark" />
  </div>
</template>

<style scoped>
.video-collect-page {
  --collect-fg: var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg)));
  --collect-muted: var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted)));
  --collect-subtle: var(--vtsuru-surface-fg-subtle, var(--collect-muted));
  --collect-surface: var(--user-page-theme-surface-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-surface)));
  --collect-surface-hover: var(--user-page-theme-surface-bg-hover, var(--vtsuru-page-card-bg-embedded));
  --collect-card: var(--vtsuru-page-card-bg, var(--collect-surface));
  --collect-border: var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)));
  --collect-accent: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary, var(--vtsuru-brand)));

  position: relative;
  min-width: 0;
  height: 100vh;
  height: 100svh;
  overflow-x: clip;
  overflow-y: auto;
  isolation: isolate;
  color: var(--collect-fg);
  background: var(--vtsuru-page-content-color, var(--vtsuru-bg));
  font-family: var(--vtsuru-page-font-family);
}

.video-collect-page.has-background {
  background: transparent;
}

.video-collect-page.has-background::before,
.video-collect-page.has-background::after {
  position: fixed;
  inset: 0;
  pointer-events: none;
  content: '';
}

.video-collect-page.has-background::before {
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  z-index: -2;
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-position: center;
  background-size: var(--user-page-bg-size, cover);
}

.video-collect-page.has-background::after {
  z-index: -1;
  background: var(--user-page-bg-scrim, transparent);
}

.video-collect-page.background-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}

.video-collect-page.background-glass::after {
  background: linear-gradient(var(--glass-surface-bg), var(--glass-surface-bg)), var(--user-page-bg-scrim, transparent);
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

@media (prefers-reduced-transparency: reduce) {
  .video-collect-page.background-glass::after {
    background: var(--collect-surface);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
</style>
