<script setup lang="ts">
import { NEmpty, NScrollbar } from 'naive-ui'
import { nextTick, ref, watch } from 'vue'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantComposer from './AssistantComposer.vue'
import AssistantMessageList from './AssistantMessageList.vue'

const store = useAssistantStore()
const scrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)

async function scrollToBottom() {
  await nextTick()
  scrollRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
}

watch(
  () => store.messages.map(m =>
    `${m.id}:${m.text.length}:${m.reasoning?.length ?? 0}:${m.usage?.totalTokens ?? 0}:${m.tools.map(t => `${t.id}:${t.status}:${t.summary?.length ?? 0}:${t.error?.length ?? 0}`).join('|')}:${m.actions.length}`,
  ).join(),
  scrollToBottom,
)

function onSend(text: string, images: string[]) {
  store.send(text, images)
}
</script>

<template>
  <div class="chat-window">
    <NScrollbar ref="scrollRef" class="chat-window__scroll">
      <AssistantMessageList
        v-if="store.messages.length"
        :messages="store.messages"
        :busy="store.sending"
        @retry="store.retry"
        @rerun="store.rerun"
        @edit-user="store.editAndRerun"
        @confirm="store.confirmAction"
        @reject="store.rejectActionById"
        @save="store.saveActionEdit"
      />
      <NEmpty v-else class="chat-window__empty" description="问我点什么, 比如帮你整理直播日程" />
    </NScrollbar>

    <div class="chat-window__composer">
      <AssistantComposer :loading="store.sending" @send="onSend" @stop="store.abortPending" />
    </div>
  </div>
</template>

<style scoped>
.chat-window { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.chat-window__scroll { flex: 1 1 0; min-height: 0; }
.chat-window__empty { margin-top: 48px; }
.chat-window__composer {
  flex: 0 0 auto; padding-top: 10px; margin-top: 6px;
  border-top: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
}
</style>
