<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

import type { Position } from '@/types/gamepad'

interface Props {
  svg?: Component
  pressSvg?: Component
  position?: Position
  axes?: { x: number; y: number }
  sensitivity?: number
  isPressed?: boolean
  customColor?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  svg: undefined,
  pressSvg: undefined,
  position: () => ({ top: '0', left: '0', width: '13%' }),
  axes: () => ({ x: 0, y: 0 }),
  sensitivity: 12,
  isPressed: false,
  customColor: null,
})

// 活跃 SVG 组件：按下且提供了专属按下 SVG 时切换
const activeSvg = computed(() => {
  if (props.isPressed && props.pressSvg) {
    return props.pressSvg
  }
  return props.svg
})

const dynamicStyle = computed(() => {
  const tx = (props.axes.x * props.sensitivity).toFixed(2)
  const ty = (props.axes.y * props.sensitivity).toFixed(2)
  const scale = props.isPressed ? ' scale(0.92)' : ''

  const base: Record<string, string> = {
    top: props.position.top,
    left: props.position.left,
    width: props.position.width,
    height: props.position.height || 'auto',
    transform: `translate(${tx}px, ${ty}px)${scale}`,
  }

  if (props.isPressed) {
    base.opacity = '0.8'
    if (props.customColor) {
      base.filter = `drop-shadow(0 0 8px ${props.customColor})`
    }
  }

  return base
})
</script>

<template>
  <div
    v-if="activeSvg"
    class="gamepad-stick-wrapper"
    :class="{ 'is-pressed': isPressed }"
    :style="dynamicStyle"
  >
    <component
      :is="activeSvg"
      class="gamepad-stick-svg"
    />
  </div>
</template>

<style scoped>
.gamepad-stick-wrapper {
  position: absolute;
  user-select: none;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-origin: center center;
  /* 实时手柄采样：不添加 transform transition 以免造成输入迟滞感 */
  will-change: transform;
}

.gamepad-stick-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.gamepad-stick-wrapper.is-pressed {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.5));
}
</style>
