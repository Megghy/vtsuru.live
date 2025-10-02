<script setup lang="ts">
import type { Position } from '@/types/gamepad'
import { computed } from 'vue'

interface Props {
  svg?: string // SVG URL
  position?: Position
  axes?: { x: number, y: number }
}

const props = withDefaults(defineProps<Props>(), {
  svg: undefined,
  axes: () => ({ x: 0, y: 0 }),
  position: () => ({ top: '0', left: '0', width: '5%' }),
})

// 计算实际样式，加入摇杆位移
const transformedStyle = computed(() => {
  const moveScale = 15 // 摇杆移动的最大距离（以像素为单位）
  const translateX = props.axes.x * moveScale
  const translateY = props.axes.y * moveScale

  return {
    top: props.position?.top,
    left: props.position?.left,
    width: props.position?.width,
    height: props.position?.height || 'auto',
    transform: `translate(${translateX}px, ${translateY}px)`,
  }
})
</script>

<template>
  <img
    v-if="svg"
    :src="svg"
    class="gamepad-component gamepad-stick"
    :style="transformedStyle"
  >
</template>

<style scoped>
.gamepad-component {
  position: absolute;
  user-select: none;
  transition: transform 0.1s ease-out;
}
</style>
