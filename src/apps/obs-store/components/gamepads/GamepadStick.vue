<script setup lang="ts">
import type { Component } from 'vue'
import type { Position } from '@/types/gamepad'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  svg?: Component
  position?: Position
  axes?: { x: number; y: number }
  sensitivity?: number
}>(), {
  svg: undefined,
  axes: () => ({ x: 0, y: 0 }),
  position: () => ({ top: '0', left: '0', width: '5%' }),
  sensitivity: 15,
})

const style = computed(() => ({
  top: props.position.top,
  left: props.position.left,
  width: props.position.width,
  height: props.position.height || 'auto',
  transform: `translate(${props.axes.x * props.sensitivity}px, ${props.axes.y * props.sensitivity}px)`,
}))
</script>

<template>
  <component
    :is="svg"
    v-if="svg"
    class="gamepad-stick"
    :style="style"
  />
</template>

<style scoped>
.gamepad-stick {
  position: absolute;
  user-select: none;
  transition: transform 0.1s ease-out;
}
</style>
