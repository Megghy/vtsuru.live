<script setup lang="ts">
import { NText } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

const model = computed(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const level = Number(o.level ?? 2)
  const text = String(o.text ?? '')
  const fontSize = level === 1 ? '28px' : level === 2 ? '22px' : '18px'
  return { level, text, fontSize }
})
</script>

<template>
  <NText
    strong
    style="display:block; margin: 6px 0"
    :style="{ fontSize: model.fontSize }"
  >
    {{ model.text }}
  </NText>
</template>
