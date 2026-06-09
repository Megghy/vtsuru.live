<script setup lang="ts">
import { Sparkle24Regular } from '@vicons/fluent'
import { NIcon, NScrollbar, NSpin } from 'naive-ui'
import { nextTick, ref, watch } from 'vue'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantComposer from './AssistantComposer.vue'
import AssistantMessageList from './AssistantMessageList.vue'

const store = useAssistantStore()
const scrollRef = ref<InstanceType<typeof NScrollbar> | null>(null)

const suggestions = [
  '帮我看看这周的直播日程',
  '下周三晚上8点加一场杂谈',
  '最近30天的粉丝增长怎么样',
  '帮我起草一条提问箱回复',
]

async function scrollToBottom() {
  await nextTick()
  scrollRef.value?.scrollTo({ top: 999999, behavior: 'smooth' })
}

watch(
  () => store.messages.map(m =>
    `${m.id}:${m.text.length}:${m.usage?.totalTokens ?? 0}:${m.process.map(s => s.kind === 'reasoning' ? `r${s.text.length}` : `t${s.tool.id}:${s.tool.status}:${s.tool.summary?.length ?? 0}:${s.tool.error?.length ?? 0}`).join('|')}:${m.actions.length}`,
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
      <div v-else-if="store.messagesLoading" class="chat-window__loading">
        <NSpin size="medium" />
      </div>
      <div v-else class="chat-window__welcome">
        <div class="chat-window__welcome-icon">
          <NIcon :component="Sparkle24Regular" size="26" />
        </div>
        <div class="chat-window__welcome-title">
          有什么可以帮你的?
        </div>
        <div class="chat-window__welcome-sub">
          用自然语言管理日程、查询数据, 或上传截图让我识别
        </div>
        <div class="chat-window__suggestions">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="chat-window__chip"
            :disabled="store.sending"
            @click="onSend(s, [])"
          >
            {{ s }}
          </button>
        </div>
      </div>
    </NScrollbar>

    <div class="chat-window__composer">
      <AssistantComposer :loading="store.sending" @send="onSend" @stop="store.abortPending" />
    </div>
  </div>
</template>

<style scoped>
.chat-window { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.chat-window__scroll { flex: 1 1 0; min-height: 0; }
.chat-window__loading {
  display: flex; align-items: center; justify-content: center;
  padding: 64px 16px;
}
.chat-window__composer {
  flex: 0 0 auto; padding-top: 10px; margin-top: 6px;
  border-top: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
}

.chat-window__welcome {
  display: flex; flex-direction: column; align-items: center;
  gap: 8px; padding: 48px 16px 24px; text-align: center;
}
.chat-window__welcome-icon {
  display: flex; align-items: center; justify-content: center;
  width: 52px; height: 52px; margin-bottom: 4px;
  border-radius: 16px;
  color: var(--vtsuru-brand, #23ade5);
  background: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.1));
}
.chat-window__welcome-title {
  font-size: 16px; font-weight: 600;
  color: var(--vtsuru-fg, var(--n-text-color));
}
.chat-window__welcome-sub {
  font-size: 13px; max-width: 360px; line-height: 1.5;
  color: var(--vtsuru-fg-muted, var(--n-text-color-3));
}
.chat-window__suggestions {
  display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
  margin-top: 12px; max-width: 440px;
}
.chat-window__chip {
  padding: 7px 13px; border-radius: 999px;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.2));
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.05));
  color: var(--vtsuru-fg, var(--n-text-color));
  font-size: 13px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s, transform 0.1s;
}
.chat-window__chip:hover:not(:disabled) {
  border-color: var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.5));
  background: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.08));
}
.chat-window__chip:active:not(:disabled) { transform: scale(0.97); }
.chat-window__chip:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
