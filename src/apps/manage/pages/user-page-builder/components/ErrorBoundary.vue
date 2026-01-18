<script setup lang="ts">
import { NButton, NResult } from 'naive-ui';
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
    <NResult
      status="error"
      :title="props.title || '渲染失败'"
      :description="capturedError.message || String(capturedError)"
    >
      <template #footer>
        <NButton @click="reset">
          重试
        </NButton>
      </template>
    </NResult>
  </div>
  <slot v-else />
</template>

