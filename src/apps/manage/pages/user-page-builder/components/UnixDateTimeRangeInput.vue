<script setup lang="ts">
import { computed } from 'vue'

import UnixDateTimeInput from './UnixDateTimeInput.vue'

const props = defineProps<{ modelValue: [number, number] | null }>()
const emit = defineEmits<{ 'update:modelValue': [value: [number, number] | null] }>()

const start = computed({
  get: () => props.modelValue?.[0] ?? null,
  set: (value: number | null) =>
    emit('update:modelValue', value === null ? null : [value, props.modelValue?.[1] ?? value]),
})
const end = computed({
  get: () => props.modelValue?.[1] ?? null,
  set: (value: number | null) =>
    emit('update:modelValue', value === null ? null : [props.modelValue?.[0] ?? value, value]),
})
</script>

<template>
  <div class="date-time-range">
    <UnixDateTimeInput v-model="start" />
    <span>至</span>
    <UnixDateTimeInput v-model="end" />
  </div>
</template>

<style scoped>
.date-time-range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
}
</style>
