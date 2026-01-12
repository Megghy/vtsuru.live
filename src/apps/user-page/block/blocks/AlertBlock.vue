<script setup lang="ts">
import { NAlert } from 'naive-ui'
import { computed } from 'vue'

const props = defineProps<{ blockProps: unknown, userInfo?: unknown, biliInfo?: unknown }>()

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

const propsObj = computed(() => asObject(props.blockProps) ?? {})

const type = computed<'default' | 'info' | 'success' | 'warning' | 'error'>(() => {
  const v = propsObj.value.type
  if (v === 'info' || v === 'success' || v === 'warning' || v === 'error' || v === 'default') return v
  return 'info'
})

const title = computed(() => (typeof propsObj.value.title === 'string' ? propsObj.value.title : ''))
const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const showIcon = computed(() => (typeof propsObj.value.showIcon === 'boolean' ? propsObj.value.showIcon : true))
const bordered = computed(() => (typeof propsObj.value.bordered === 'boolean' ? propsObj.value.bordered : false))
</script>

<template>
  <NAlert :type="type" :title="title || undefined" :show-icon="showIcon" :bordered="bordered">
    {{ text }}
  </NAlert>
</template>
