<script setup lang="ts">
import { NButton, NInput } from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{
  (e: 'send', text: string): void
  (e: 'stop'): void
}>()

const text = ref('')

function submit() {
  const value = text.value.trim()
  if (!value || props.loading) return
  emit('send', value)
  text.value = ''
}

function onKeydown(e: KeyboardEvent) {
  // Enter 发送, Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <div class="composer">
    <NInput
      v-model:value="text"
      type="textarea"
      placeholder="描述你想做的事, 例如: 帮我调整本周直播日程"
      :autosize="{ minRows: 1, maxRows: 4 }"
      :disabled="loading"
      class="composer__input"
      @keydown="onKeydown"
    />
    <NButton
      v-if="loading"
      type="error"
      tertiary
      class="composer__btn"
      @click="emit('stop')"
    >
      停止
    </NButton>
    <NButton
      v-else
      type="primary"
      class="composer__btn"
      :disabled="!text.trim()"
      @click="submit"
    >
      发送
    </NButton>
  </div>
</template>

<style scoped>
.composer { display: flex; gap: 8px; align-items: flex-end; }
.composer__input { flex: 1; min-width: 0; }
.composer__btn { flex: 0 0 auto; }
</style>
