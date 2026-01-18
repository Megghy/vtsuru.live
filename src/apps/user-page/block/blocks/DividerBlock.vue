<script setup lang="ts">
import { NDivider } from 'naive-ui';
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()
const propsObj = computed<Record<string, any>>(() => {
  if (!props.blockProps || typeof props.blockProps !== 'object' || Array.isArray(props.blockProps)) return {}
  return props.blockProps as any
})

const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))

const titlePlacement = computed<'left' | 'center' | 'right'>(() => {
  const v = propsObj.value.titlePlacement
  if (v === 'left' || v === 'right' || v === 'center') return v
  return 'center'
})

function clampMargin(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  if (n < 0) return 0
  if (n > 80) return 80
  return n
}

const dividerStyle = computed(() => {
  const mt = clampMargin(propsObj.value.marginTop)
  const mb = clampMargin(propsObj.value.marginBottom)
  return {
    marginTop: mt === null ? undefined : `${mt}px`,
    marginBottom: mb === null ? undefined : `${mb}px`,
  }
})
</script>

<template>
  <NDivider v-if="text" :title-placement="titlePlacement" :style="dividerStyle">
    {{ text }}
  </NDivider>
  <NDivider v-else :style="dividerStyle" />
</template>
