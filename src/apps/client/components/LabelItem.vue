<script lang="ts" setup>
defineProps<{
  label: string
}>()
</script>

<template>
  <span class="label-item">
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
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  min-width: 0;
}

.label-item__label {
  font-size: 12px;
  color: var(--n-text-color-2);
  white-space: nowrap;
}

.label-item__value {
  display: inline-flex;
  justify-content: flex-end;
  align-items: center;
  min-width: 0;
}
</style>
