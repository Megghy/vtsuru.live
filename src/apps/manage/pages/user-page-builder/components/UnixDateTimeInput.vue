<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ modelValue: number | null; dateOnly?: boolean; placeholder?: string }>(), {
  dateOnly: false,
  placeholder: '',
})
const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

const inputValue = computed({
  get: () => {
    if (props.modelValue === null) return ''
    const date = new Date(props.modelValue)
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString()
    return props.dateOnly ? local.slice(0, 10) : local.slice(0, 16)
  },
  set: (value: string) => emit('update:modelValue', value ? new Date(value).getTime() : null),
})
</script>

<template>
  <UInput
    v-model="inputValue"
    :type="dateOnly ? 'date' : 'datetime-local'"
    :placeholder="placeholder"
  />
</template>
