<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    minItemWidth?: number
    gap?: number
    rowGap?: number
    colGap?: number
  }>(),
  {
    minItemWidth: 150,
    gap: 8,
    rowGap: 6,
    colGap: 8,
  },
)

const style = computed(() => ({
  gridTemplateColumns: `repeat(auto-fit, minmax(${props.minItemWidth}px, 1fr))`,
  columnGap: `${props.colGap ?? props.gap}px`,
  rowGap: `${props.rowGap ?? props.gap}px`,
}))
</script>

<template>
  <div
    class="props-grid"
    :style="style"
  >
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
  --n-feedback-height: 0px;
  --n-feedback-padding: 0;
  --n-label-padding: 0 0 2px 0;
  --n-label-height: 18px;
}
.props-grid :deep(.n-form-item-label) {
  min-height: 18px !important;
  padding: 0 0 2px !important;
  line-height: 18px;
  font-size: 12px;
}
.props-grid :deep(.n-form-item-feedback-wrapper) {
  min-height: 0 !important;
  height: auto !important;
  padding: 0 !important;
}
.props-grid :deep(.n-form-item-feedback-wrapper:empty) {
  display: none;
}
.props-grid :deep(.n-form-item-feedback) {
  margin-top: 2px;
  font-size: 11px;
  line-height: 14px;
}
.props-grid :deep(.span-full) {
  grid-column: 1 / -1;
}
</style>
