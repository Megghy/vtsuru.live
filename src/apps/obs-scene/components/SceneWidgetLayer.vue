<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'

import { getObsComponentById } from '@/apps/obs-store/registry'

import type { VtsuruWidgetLayer } from '../types'
import { parseResolution } from '../types'

const props = defineProps<{
  layer: VtsuruWidgetLayer
  ownerUserId?: number
  mode: 'edit' | 'preview' | 'live'
}>()

const widgetComponents: Record<string, ReturnType<typeof defineAsyncComponent>> = {
  clock: defineAsyncComponent(() => import('@/apps/obs-store/components/clock/ClockDisplay.vue')),
  counter: defineAsyncComponent(() => import('@/apps/obs-store/components/counter/CounterDisplay.vue')),
  goal: defineAsyncComponent(() => import('@/apps/obs-store/components/goal/GoalDisplay.vue')),
  wheel: defineAsyncComponent(() => import('@/apps/obs-store/components/wheel/WheelDisplay.vue')),
  subtitle: defineAsyncComponent(() => import('@/apps/obs-store/components/subtitle/SubtitleDisplay.vue')),
  keycast: defineAsyncComponent(() => import('@/apps/obs-store/components/keycast/KeycastDisplay.vue')),
  'typing-cat': defineAsyncComponent(() => import('@/apps/obs-store/components/typing-cat/TypingCatDisplay.vue')),
  gamepad: defineAsyncComponent(() => import('@/apps/obs-store/components/gamepads/GamepadDisplay.vue')),
  pngtuber: defineAsyncComponent(() => import('./PngtuberSceneWidget.vue')),
}

const definition = computed(() => getObsComponentById(props.layer.widget.componentId))
const resolvedComponent = computed(() => widgetComponents[props.layer.widget.componentId])
const baseSize = computed(() => parseResolution(definition.value?.defaultResolution))

const scaleStyle = computed(() => {
  if (props.layer.widget.scaleMode !== 'fit') {
    return {
      width: '100%',
      height: '100%',
    }
  }
  const scaleX = props.layer.width / baseSize.value.width
  const scaleY = props.layer.height / baseSize.value.height
  const scale = Math.min(scaleX, scaleY)
  return {
    width: `${baseSize.value.width}px`,
    height: `${baseSize.value.height}px`,
    transform: `translate(-50%, -50%) scale(${scale})`,
    position: 'absolute' as const,
    left: '50%',
    top: '50%',
    transformOrigin: 'center center',
  }
})

const widgetRenderKey = computed(() => {
  const id = props.layer.widget.componentId
  if (id === 'gamepad') {
    const gp = props.layer.widget.gamepadParams
    return `gamepad-${gp?.type ?? 'xbox'}-${gp?.bodyId ?? ''}`
  }
  return id
})

const componentProps = computed(() => {
  const id = props.layer.widget.componentId
  const noShadow = Boolean(props.layer.disableShadow)
  if (id === 'gamepad') {
    const gp = props.layer.widget.gamepadParams
    const gpType = gp?.type === 'ps' || gp?.type === 'nintendo' ? gp.type : 'xbox'
    const rawViewBox = gp?.viewBox?.trim()
    return {
      inlineMode: true,
      type: gpType,
      bodyId: gp?.bodyId || undefined,
      pressedColor: gp?.pressedColor || null,
      viewBox: rawViewBox && rawViewBox !== '0 0 800 600' ? rawViewBox : undefined,
      stickSensitivity: gp?.stickSensitivity && gp.stickSensitivity > 1 ? gp.stickSensitivity : 15,
    }
  }
  return {
    channelId: props.layer.widget.channelId || 'default',
    userId: props.ownerUserId,
    inlineMode: true,
    noShadow,
  }
})
</script>

<template>
  <div class="relative w-full h-full overflow-hidden" :class="{ 'obs-widget-no-shadow': layer.disableShadow }">
    <div v-if="resolvedComponent" :style="scaleStyle" class="flex-center">
      <component :is="resolvedComponent" :key="widgetRenderKey" v-bind="componentProps" />
    </div>
    <div
      v-else
      class="w-full h-full flex-center bg-muted/60 text-muted-foreground text-xs border border-dashed border-border"
    >
      未知组件: {{ layer.widget.componentId }}
    </div>
  </div>
</template>

<style scoped>
/* 精准移除各 obs-store 组件的外框投影与 drop-shadow，同时保留 LED 点亮与辉光管灯丝等核心发光元素 */
.obs-widget-no-shadow :deep(*:not(.dot-led):not(.filament-digit):not(.apm-dot)) {
  box-shadow: none !important;
}

.obs-widget-no-shadow :deep(.avatar-image),
.obs-widget-no-shadow :deep(.wheel-pointer) {
  filter: none !important;
}

.obs-widget-no-shadow :deep(.minimal-clock-root),
.obs-widget-no-shadow :deep(.counter-prefix),
.obs-widget-no-shadow :deep(.counter-title),
.obs-widget-no-shadow :deep(.counter-value),
.obs-widget-no-shadow :deep(.goal-container),
.obs-widget-no-shadow :deep(.keycap-chip),
.obs-widget-no-shadow :deep(.keycast-apm-pill) {
  text-shadow: none !important;
}
</style>
