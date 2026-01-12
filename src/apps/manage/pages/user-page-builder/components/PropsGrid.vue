<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  minItemWidth?: number
  gap?: number
  rowGap?: number
  colGap?: number
}>(), {
  minItemWidth: 180,
  gap: 12,
  rowGap: 1,
  colGap: 12,
})

const style = computed(() => ({
  gridTemplateColumns: `repeat(auto-fit, minmax(${props.minItemWidth}px, 1fr))`,
  columnGap: `${props.colGap ?? props.gap}px`,
  rowGap: `${props.rowGap ?? props.gap}px`,
}))
</script>

<template>
  <div class="props-grid" :style="style">
    <slot />
  </div>
</template>

<style scoped>
.props-grid {
  display: grid;
  align-items: start;
}
.props-grid > :deep(*) {
  min-width: 0;
}
.props-grid :deep(.n-form-item) {
  margin-bottom: 0;
}
.props-grid :deep(.span-full) {
  grid-column: 1 / -1;
}
</style>
