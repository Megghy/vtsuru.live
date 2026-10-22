<script setup lang="ts">
import { computed } from 'vue'

import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'

import BlockCard from '../BlockCard.vue'

const props = defineProps<{ blockProps: unknown; userInfo?: unknown; biliInfo?: unknown }>()

function asObject(v: unknown): Record<string, any> | null {
  if (!v || typeof v !== 'object') return null
  if (Array.isArray(v)) return null
  return v as any
}

const propsObj = computed(() => asObject(props.blockProps) ?? {})

const variant = computed<'default' | 'destructive'>(() => {
  const v = propsObj.value.type
  return v === 'error' ? 'destructive' : 'default'
})

const title = computed(() => (typeof propsObj.value.title === 'string' ? propsObj.value.title : ''))
const text = computed(() => (typeof propsObj.value.text === 'string' ? propsObj.value.text : ''))
const framed = computed(() => (typeof propsObj.value.framed === 'boolean' ? propsObj.value.framed : true))
const backgrounded = computed(() =>
  typeof propsObj.value.backgrounded === 'boolean' ? propsObj.value.backgrounded : true,
)
</script>

<template>
  <BlockCard
    :framed="framed"
    :backgrounded="backgrounded"
    :content-style="{ padding: 0 }"
  >
    <Alert
      :variant="variant"
      class="vtsuru-alert rounded-none border-0"
    >
      <AlertTitle
        v-if="title"
        class="font-bold text-sm"
      >
        {{ title }}
      </AlertTitle>
      <AlertDescription class="alert-content text-xs">
        {{ text }}
      </AlertDescription>
    </Alert>
  </BlockCard>
</template>

<style scoped>
.alert-content {
  white-space: pre-wrap;
  line-height: 1.6;
}
</style>
