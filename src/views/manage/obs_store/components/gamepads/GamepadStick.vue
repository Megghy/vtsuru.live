<template>
  <component
    :is="svg"
    v-if="svg"
    :class="['gamepad-component', 'gamepad-stick']"
    :style="transformedStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import type { Position } from '@/types/gamepad';

interface Props {
  svg?: Component; // 改为接受组件而非URL字符串
  position?: Position;
  axes?: { x: number; y: number };
}

const props = withDefaults(defineProps<Props>(), {
  svg: undefined,
  axes: () => ({ x: 0, y: 0 }),
  position: () => ({ top: '0', left: '0', width: '5%' })
});

// 计算实际样式，加入摇杆位移
const transformedStyle = computed(() => {
  const moveScale = 15; // 摇杆移动的最大距离（以像素为单位）
  const translateX = props.axes.x * moveScale;
  const translateY = props.axes.y * moveScale;

  return {
    top: props.position?.top,
    left: props.position?.left,
    width: props.position?.width,
    height: props.position?.height || 'auto',
    transform: `translate(${translateX}px, ${translateY}px)`
  };
});
</script>

<style scoped>
.gamepad-component {
  position: absolute;
  user-select: none;
  transition: transform 0.1s ease-out;
}
</style>