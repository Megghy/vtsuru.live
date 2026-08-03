<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'

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
  <div v-if="capturedError">
    <UEmpty
      status="error"
      :title="props.title || '渲染失败'"
      :description="capturedError.message || String(capturedError)"
    >
      <template #footer>
        <UButton @click="reset"> 重试 </UButton>
      </template>
    </UEmpty>
  </div>
  <slot v-else />
</template>
