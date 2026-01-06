<script setup lang="ts">
import type { Component } from 'vue'
import type { Position } from '@/types/gamepad'
import { computed } from 'vue'

interface Props {
  name?: string
  svg?: Component // 改为接受组件而非URL字符串
  position?: Position
  isPressed?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  name: 'Button',
  svg: undefined,
  isPressed: false,
  position: () => ({ top: '0', left: '0', width: '5%' }),
})

const positionStyle = computed(() => ({
  top: props.position?.top,
  left: props.position?.left,
  width: props.position?.width,
  height: props.position?.height || 'auto',
}))
</script>

<template>
  <component
    :is="svg"
    v-if="svg"
    class="gamepad-component gamepad-button" :class="[{ pressed: isPressed }]"
    :style="positionStyle"
  />
</template>

<style scoped>
.gamepad-component {
  position: absolute;
  user-select: none;
  transition: transform 0.05s ease-out, opacity 0.05s ease-out;
}
.gamepad-button.pressed {
  transform: scale(0.92);
  opacity: 0.7;
}
</style>
