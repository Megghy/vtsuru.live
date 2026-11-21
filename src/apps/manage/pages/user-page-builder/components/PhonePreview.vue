<script setup lang="ts">
import { useResizeObserver } from '@vueuse/core'
import { computed, ref } from 'vue'

import { buildSiteTokens, getThemeCssVars } from '@/shared/config/theme'
import { provideThemeScope } from '@/shared/config/theme/scope'

export type PreviewViewport = 'phone' | 'tablet' | 'desktop'

const DESKTOP_VIRTUAL_WIDTH = 1180
const PREVIEW_PADDING_PX = 24

const props = withDefaults(
  defineProps<{
    isDark: boolean
    transparent?: boolean
    viewport?: PreviewViewport
    fitDesktop?: boolean
  }>(),
  {
    viewport: 'desktop',
    fitDesktop: true,
  },
)

const previewStyle = computed(() => getThemeCssVars(buildSiteTokens(props.isDark)))
provideThemeScope(previewStyle)

const containerEl = ref<HTMLElement | null>(null)
const containerWidth = ref(0)
const containerHeight = ref(0)

useResizeObserver(containerEl, ([entry]) => {
  containerWidth.value = Math.max(0, Math.floor(entry.contentRect.width) - PREVIEW_PADDING_PX)
  containerHeight.value = Math.max(0, Math.floor(entry.contentRect.height) - PREVIEW_PADDING_PX)
})

const desktopScale = computed(() => {
  if (props.viewport !== 'desktop' || !props.fitDesktop) return 1
  if (containerWidth.value <= 0 || containerWidth.value >= DESKTOP_VIRTUAL_WIDTH) return 1
  return Math.max(0.28, Number((containerWidth.value / DESKTOP_VIRTUAL_WIDTH).toFixed(3)))
})

const scaleFrameStyle = computed(() => {
  if (desktopScale.value >= 1) return undefined
  const scale = desktopScale.value
  return {
    width: `${Math.round(DESKTOP_VIRTUAL_WIDTH * scale)}px`,
    height: containerHeight.value > 0 ? `${containerHeight.value}px` : '100%',
  }
})

const desktopDeviceStyle = computed(() => {
  if (desktopScale.value >= 1) return undefined
  const scale = desktopScale.value
  return {
    width: `${DESKTOP_VIRTUAL_WIDTH}px`,
    height:
      containerHeight.value > 0 ? `${Math.round(containerHeight.value / scale)}px` : `${Math.round(100 / scale)}%`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
})
</script>

<template>
  <div
    ref="containerEl"
    :style="previewStyle"
    class="responsive-preview"
    :class="`responsive-preview--${props.viewport}`"
  >
    <div
      class="device-scale-frame"
      :class="{ 'is-scaled': desktopScale < 1 }"
      :style="scaleFrameStyle"
    >
      <div
        class="device"
        :class="`device--${props.viewport}`"
        :style="desktopDeviceStyle"
      >
        <div
          v-if="props.viewport !== 'desktop'"
          class="device-bar"
        />
        <div
          class="screen"
          :class="{ transparent: !!props.transparent }"
        >
          <div class="screen-bg">
            <slot name="background" />
          </div>
          <div class="screen-scroll">
            <slot />
          </div>
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

.device-scale-frame {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
}

.device-scale-frame.is-scaled {
  position: relative;
  display: block;
}

.device {
  width: min(100%, 390px);
  height: min(100%, 844px);
  min-height: 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  padding: 10px;
  box-sizing: border-box;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  flex: 0 0 auto;
  transition:
    transform 180ms ease,
    opacity 180ms ease;
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
  background: var(--background);
  border-radius: 16px;
  overflow: hidden;
  padding: 0;
  flex: 1;
  min-height: 0;
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
