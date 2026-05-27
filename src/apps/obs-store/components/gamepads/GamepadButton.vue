<script setup lang="ts">
import type { Component } from 'vue'
import type { Position } from '@/types/gamepad'
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name?: string
  svg?: Component
  position?: Position
  isPressed?: boolean
}>(), {
  name: 'Button',
  svg: undefined,
  isPressed: false,
  position: () => ({ top: '0', left: '0', width: '5%' }),
})

const style = computed(() => ({
  top: props.position.top,
  left: props.position.left,
  width: props.position.width,
  height: props.position.height || 'auto',
}))
</script>

<template>
  <component
    :is="svg"
    v-if="svg"
    class="gamepad-btn"
    :class="{ pressed: isPressed }"
    :style="style"
  />
</template>

<style scoped>
.gamepad-btn {
  position: absolute;
  user-select: none;
  transition: transform 0.05s ease-out, opacity 0.05s ease-out;
}
.gamepad-btn.pressed {
  transform: scale(0.92);
  opacity: 0.7;
}
</style>
