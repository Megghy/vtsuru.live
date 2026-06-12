<script lang="ts" setup>
withDefaults(defineProps<{
  label: string
  labelPlacement?: 'left' | 'top'
}>(), {
  labelPlacement: 'left',
})
</script>

<template>
  <span class="label-item" :class="`label-item--${labelPlacement}`">
    <span class="label-item__label">
      {{ label }}
    </span>
    <span class="label-item__value">
      <slot />
    </span>
  </span>
</template>

<style scoped>
.label-item {
  display: flex;
  gap: 12px;
  padding: 6px 0;
  min-width: 0;
}

.label-item--left {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.label-item--top {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.label-item__label {
  font-size: 12px;
  color: var(--n-text-color-2);
}

.label-item--left .label-item__value {
  justify-content: flex-end;
}

.label-item__value {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}
</style>
