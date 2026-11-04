<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from 'reka-ui'
import { SelectRoot } from 'reka-ui'
import { computed } from 'vue'

import { SELECT_EMPTY_VALUE } from './index'

const props = defineProps<SelectRootProps>()
const emit = defineEmits<SelectRootEmits>()

function toRekaValue(val: any) {
  if (val === '') return SELECT_EMPTY_VALUE
  if (Array.isArray(val)) {
    return val.map((v) => (v === '' ? SELECT_EMPTY_VALUE : v))
  }
  return val
}

function fromRekaValue(val: any) {
  if (val === SELECT_EMPTY_VALUE) return ''
  if (Array.isArray(val)) {
    return val.map((v) => (v === SELECT_EMPTY_VALUE ? '' : v))
  }
  return val
}

const mappedProps = computed(() => {
  const res: any = { ...props }
  if ('modelValue' in props && props.modelValue !== undefined) {
    res.modelValue = toRekaValue(props.modelValue)
  }
  if ('defaultValue' in props && props.defaultValue !== undefined) {
    res.defaultValue = toRekaValue(props.defaultValue)
  }
  return res
})

function onUpdateModelValue(val: any) {
  emit('update:modelValue', fromRekaValue(val))
}
</script>

<template>
  <SelectRoot
    v-bind="mappedProps"
    @update:model-value="onUpdateModelValue"
  >
    <slot />
  </SelectRoot>
</template>
