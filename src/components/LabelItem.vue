<template>
  <span class="label-item">
    <p>
      {{ label }}
    </p>
    <slot />
  </span>
</template>

<script lang="ts" setup>
defineProps<{
  label: string;
}>();
</script>

<style scoped>
.label-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem;
  gap: 0.5rem;
}
</style>
