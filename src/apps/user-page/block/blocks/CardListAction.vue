<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

const props = defineProps<{
  action: unknown
  userName?: string
  secondary?: boolean
}>()

const values = computed<Record<string, unknown>>(() =>
  props.action && typeof props.action === 'object' && !Array.isArray(props.action)
    ? (props.action as Record<string, unknown>)
    : {},
)
const label = computed(() => (typeof values.value.label === 'string' ? values.value.label.trim() : ''))
const page = computed(() => (typeof values.value.page === 'string' ? values.value.page.trim() : ''))
const url = computed(() => {
  if (typeof values.value.url !== 'string') return ''
  try {
    const parsed = new URL(values.value.url)
    return parsed.protocol === 'https:' ? parsed.toString() : ''
  } catch {
    return ''
  }
})
const internalPath = computed(() => {
  if (!props.userName || !page.value) return ''
  if (page.value === 'home') return `/@${props.userName}`
  return /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/.test(page.value) ? `/@${props.userName}/${page.value}` : ''
})
const router = useRouter()
</script>

<template>
  <UButton
    v-if="label && internalPath"
    size="sm"
    :color="secondary ? 'neutral' : 'primary'"
    :secondary="secondary"
    @click="router.push(internalPath)"
  >
    {{ label }}
  </UButton>
  <UButton
    v-else-if="label && url"
    size="sm"
    :color="secondary ? 'neutral' : 'primary'"
    :secondary="secondary"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ label }}
  </UButton>
</template>
