<script setup lang="ts">
import type { SelectRootEmits, SelectRootProps } from 'reka-ui'
import { SelectRoot, useForwardPropsEmits } from 'reka-ui'
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

const forwarded = useForwardPropsEmits(props, emit)

const mappedProps = computed(() => {
  const res: any = { ...forwarded.value }
  if ('modelValue' in res && res.modelValue !== undefined) {
    res.modelValue = toRekaValue(res.modelValue)
  }
  if ('defaultValue' in res && res.defaultValue !== undefined) {
    res.defaultValue = toRekaValue(res.defaultValue)
  }
  res['onUpdate:modelValue'] = (val: any) => {
    emit('update:modelValue', fromRekaValue(val))
  }
  return res
})
</script>

<template>
  <SelectRoot v-bind="mappedProps">
    <slot />
  </SelectRoot>
</template>
