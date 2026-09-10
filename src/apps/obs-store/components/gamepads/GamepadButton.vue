<script setup lang="ts">
import type { Component } from 'vue'
import { computed } from 'vue'

import type { Position } from '@/types/gamepad'

interface Props {
  name?: string
  svg?: Component
  position?: Position
  isPressed?: boolean
  value?: number
  isTrigger?: boolean
  customColor?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  name: 'Button',
  svg: undefined,
  position: () => ({ top: '0', left: '0', width: '6%' }),
  isPressed: false,
  value: 0,
  isTrigger: false,
  customColor: null,
})

const dynamicStyle = computed(() => {
  const base: Record<string, string> = {
    top: props.position.top,
    left: props.position.left,
    width: props.position.width,
    height: props.position.height || 'auto',
  }

  if (props.isTrigger) {
    // 线性扳机 (LT / RT / L2 / R2)：根据 0.0 ~ 1.0 的模拟量进行下压行程动画与渐变
    const val = Math.max(0, Math.min(1, props.value || (props.isPressed ? 1 : 0)))
    const translateY = (val * 8).toFixed(1)
    const opacity = (0.7 + val * 0.3).toFixed(2)
    base.transform = `translateY(${translateY}px)`
    base.opacity = opacity
    if (val > 0.05 && props.customColor) {
      base.filter = `drop-shadow(0 0 ${val * 6}px ${props.customColor})`
    }
  } else if (props.isPressed) {
    // 普通按键按下
    base.transform = 'scale(0.92)'
    base.opacity = '0.75'
    if (props.customColor) {
      base.filter = `drop-shadow(0 0 8px ${props.customColor})`
    }
  }

  return base
})
</script>

<template>
  <div
    v-if="svg"
    class="gamepad-btn-wrapper"
    :class="{
      'is-pressed': isPressed,
      'is-trigger': isTrigger,
    }"
    :style="dynamicStyle"
    :title="name"
  >
    <component
      :is="svg"
      class="gamepad-btn-svg"
    />
  </div>
</template>

<style scoped>
.gamepad-btn-wrapper {
  position: absolute;
  user-select: none;
  pointer-events: none;
  display: flex;
  justify-content: center;
  align-items: center;
  transform-origin: center center;
  transition: transform 0.04s ease-out, opacity 0.04s ease-out, filter 0.04s ease-out;
}

.gamepad-btn-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.gamepad-btn-wrapper.is-pressed:not(.is-trigger) {
  filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.6));
}
</style>
