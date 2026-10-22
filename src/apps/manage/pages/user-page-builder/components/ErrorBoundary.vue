<script setup lang="ts">
import { AlertCircle } from 'lucide-vue-next'
import { onErrorCaptured, ref } from 'vue'

import { Button } from '@/shared/ui/button'

const props = defineProps<{
  title?: string
}>()

const capturedError = ref<Error | null>(null)

function reset() {
  capturedError.value = null
}

onErrorCaptured((e) => {
  capturedError.value = e as Error
  return false
})
</script>

<template>
  <div v-if="capturedError" class="p-6 text-center space-y-4">
    <div class="inline-flex items-center justify-center size-12 rounded-full bg-destructive/10 text-destructive mb-2">
      <AlertCircle class="size-6" />
    </div>
    <div class="text-base font-semibold text-foreground">
      {{ props.title || '渲染失败' }}
    </div>
    <div class="text-xs text-muted-foreground max-w-md mx-auto break-words">
      {{ capturedError.message || String(capturedError) }}
    </div>
    <div>
      <Button variant="outline" @click="reset"> 重试 </Button>
    </div>
  </div>
  <slot v-else />
</template>
