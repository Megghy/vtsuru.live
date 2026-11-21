<script setup lang="ts">
import { Check, Copy } from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { Button } from '@/shared/ui/button'

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
const isBack = computed(() => values.value.back === true)
const copyText = computed(() =>
  typeof values.value.copyText === 'string' && values.value.copyText.trim().length > 0 ? values.value.copyText : '',
)
const copiedMessage = computed(() =>
  typeof values.value.copiedMessage === 'string' && values.value.copiedMessage.trim()
    ? values.value.copiedMessage.trim()
    : '已复制到剪贴板',
)
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
const copied = ref(false)

async function handleCopy() {
  if (!copyText.value) return
  try {
    await navigator.clipboard.writeText(copyText.value)
    toast.success(copiedMessage.value)
    copied.value = true
    window.setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch {
    toast.error('复制失败，请手动复制')
  }
}
</script>

<template>
  <Button
    v-if="label && copyText"
    :variant="secondary ? 'outline' : 'default'"
    size="xs"
    class="gap-1"
    @click="handleCopy"
  >
    <component
      :is="copied ? Check : Copy"
      class="size-3"
    />
    {{ label }}
  </Button>
  <Button
    v-else-if="label && isBack"
    :variant="secondary ? 'outline' : 'default'"
    size="xs"
    @click="router.back()"
  >
    {{ label }}
  </Button>
  <Button
    v-else-if="label && internalPath"
    :variant="secondary ? 'outline' : 'default'"
    size="xs"
    @click="router.push(internalPath)"
  >
    {{ label }}
  </Button>
  <Button
    v-else-if="label && url"
    as="a"
    :variant="secondary ? 'outline' : 'default'"
    size="xs"
    class="text-inherit no-underline"
    :href="url"
    target="_blank"
    rel="noopener noreferrer"
  >
    {{ label }}
  </Button>
</template>
