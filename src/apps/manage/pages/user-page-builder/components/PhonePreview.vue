<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { applyThemeCssVars, buildSiteTokens } from '@/shared/config/theme'

export type PreviewViewport = 'phone' | 'tablet' | 'desktop'

const props = withDefaults(defineProps<{
  isDark: boolean
  transparent?: boolean
  viewport?: PreviewViewport
}>(), {
  viewport: 'desktop',
})

const previewRoot = ref<HTMLElement | null>(null)

watchEffect(() => {
  if (!previewRoot.value) return
  applyThemeCssVars(buildSiteTokens(props.isDark), previewRoot.value)
})
</script>

<template>
  <div ref="previewRoot" class="responsive-preview" :class="`responsive-preview--${props.viewport}`">
    <div class="device" :class="`device--${props.viewport}`">
      <div v-if="props.viewport !== 'desktop'" class="device-bar" />
      <div class="screen" :class="{ transparent: !!props.transparent }">
        <div class="screen-bg">
          <slot name="background" />
        </div>
        <div class="screen-scroll">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.responsive-preview {
  display: flex;
  flex: 1;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

.device {
  width: min(100%, 390px);
  height: min(100%, 844px);
  min-height: 0;
  background: #111;
  border-radius: 24px;
  padding: 10px;
  box-sizing: border-box;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  transition:
    width 220ms ease,
    height 220ms ease,
    padding 220ms ease,
    border-radius 220ms ease,
    box-shadow 220ms ease;
}

.device--tablet {
  width: min(100%, 768px);
  height: min(100%, 1024px);
  border-radius: 18px;
}

.device--desktop {
  width: min(100%, 1180px);
  height: 100%;
  border-radius: 8px;
  padding: 6px;
}

.device-bar {
  width: 72px;
  height: 5px;
  margin: 1px auto 8px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.12);
}

.screen {
  position: relative;
  font-family: var(--vtsuru-page-font-family);
  background: var(--vtsuru-bg);
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  flex: 1;
  min-height: 0;
  transition: border-radius 220ms ease, background-color 180ms ease;
}

.device--desktop .screen {
  border-radius: 4px;
}

.screen.transparent {
  background: transparent;
}

.screen-bg {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

.screen-scroll {
  position: relative;
  z-index: 1;
  height: 100%;
  overflow: auto;
}
</style>
