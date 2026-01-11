<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const propsObj = computed<Record<string, any>>(() => {
  if (!props.blockProps || typeof props.blockProps !== 'object' || Array.isArray(props.blockProps)) return {}
  return props.blockProps as any
})

const items = computed(() => (Array.isArray(propsObj.value.items) ? propsObj.value.items : []))

const direction = computed<'vertical' | 'horizontal'>(() => (propsObj.value.direction === 'horizontal' ? 'horizontal' : 'vertical'))
const gap = computed(() => {
  const v = Number(propsObj.value.gap)
  if (!Number.isFinite(v)) return 10
  if (v < 0) return 0
  if (v > 32) return 32
  return v
})

const buttonType = computed(() => {
  const v = propsObj.value.type
  if (v === 'primary' || v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default') return v
  return 'primary'
})

const variant = computed<'solid' | 'secondary' | 'tertiary' | 'quaternary' | 'ghost'>(() => {
  const v = propsObj.value.variant
  if (v === 'secondary' || v === 'tertiary' || v === 'quaternary' || v === 'ghost' || v === 'solid') return v
  return 'solid'
})

const align = computed<'start' | 'center' | 'end'>(() => {
  const v = propsObj.value.align
  if (v === 'center' || v === 'end' || v === 'start') return v
  return 'start'
})

const fullWidth = computed(() => {
  const v = propsObj.value.fullWidth
  if (typeof v === 'boolean') return v
  return direction.value === 'vertical'
})

const flexJustify = computed<'start' | 'center' | 'end'>(() => (direction.value === 'horizontal' ? align.value : 'start'))
const flexAlign = computed<'start' | 'center' | 'end'>(() => (direction.value === 'vertical' ? align.value : 'start'))
</script>

<template>
  <NFlex
    :vertical="direction === 'vertical'"
    :wrap="direction === 'horizontal'"
    :justify="flexJustify"
    :align="flexAlign"
    :style="{ gap: `${gap}px` }"
  >
    <NButton
      v-for="(it, idx) in items"
      :key="idx"
      tag="a"
      :type="buttonType as any"
      :secondary="variant === 'secondary'"
      :tertiary="variant === 'tertiary'"
      :quaternary="variant === 'quaternary'"
      :ghost="variant === 'ghost'"
      target="_blank"
      rel="noopener noreferrer"
      :href="it.url"
      :style="fullWidth ? 'width: 100%' : undefined"
    >
      {{ it.label }}
    </NButton>
  </NFlex>
</template>
