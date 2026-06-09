<script setup lang="ts">
import { NButton, NSpin, NText } from 'naive-ui'
import type { ScheduleEditItem } from '../api/assistant'
import type { AssistantMessage } from '../store/useAssistantStore'
import AssistantActionCard from './AssistantActionCard.vue'

defineProps<{ messages: AssistantMessage[] }>()
const emit = defineEmits<{
  (e: 'retry', messageId: string): void
  (e: 'confirm', messageId: string, actionId: string): void
  (e: 'reject', messageId: string, actionId: string): void
  (e: 'save', messageId: string, actionId: string, items: ScheduleEditItem[]): void
}>()
</script>

<template>
  <div class="msg-list">
    <div
      v-for="msg in messages"
      :key="msg.id"
      class="msg-row"
      :class="`msg-row--${msg.role}`"
    >
      <div class="msg-bubble" :class="`msg-bubble--${msg.role}`">
        <NSpin v-if="msg.role === 'assistant' && msg.status === 'sending' && !msg.text" size="small" />
        <NText v-if="msg.text" class="msg-text">{{ msg.text }}</NText>

        <div v-if="msg.status === 'error'" class="msg-error">
          <NText type="error" class="msg-error__text">{{ msg.error ?? '出错了' }}</NText>
          <NButton size="tiny" type="error" tertiary @click="emit('retry', msg.id)">重试</NButton>
        </div>

        <AssistantActionCard
          v-for="action in msg.actions"
          :key="action.id"
          :action="action"
          @confirm="emit('confirm', msg.id, action.id)"
          @reject="emit('reject', msg.id, action.id)"
          @save="patch => emit('save', msg.id, action.id, patch)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-list { display: flex; flex-direction: column; gap: 12px; padding: 4px; }
.msg-row { display: flex; }
.msg-row--user { justify-content: flex-end; }
.msg-row--assistant { justify-content: flex-start; }
.msg-bubble {
  max-width: 88%; min-width: 0;
  padding: 8px 12px; border-radius: 10px;
  display: flex; flex-direction: column; gap: 6px;
  word-break: break-word; overflow-wrap: anywhere;
}
.msg-bubble--user { background: var(--n-color-target, rgba(99, 226, 183, 0.16)); }
.msg-bubble--assistant { background: var(--n-action-color, rgba(128, 128, 128, 0.08)); width: 100%; }
.msg-text { font-size: 14px; white-space: pre-wrap; }
.msg-error { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.msg-error__text { font-size: 13px; }
</style>
