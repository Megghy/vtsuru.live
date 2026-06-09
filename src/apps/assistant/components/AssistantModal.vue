<script setup lang="ts">
import { NButton, NFlex, NModal, NTag, NText } from 'naive-ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAssistantStore } from '../store/useAssistantStore'
import AssistantChatWindow from './AssistantChatWindow.vue'

const store = useAssistantStore()
const route = useRoute()

const ctx = computed(() => store.context)

function onClose() {
  store.close()
}
</script>

<template>
  <NModal
    v-model:show="store.visible"
    preset="card"
    class="assistant-modal"
    :title="undefined"
    :bordered="false"
    :mask-closable="false"
    @after-leave="onClose"
  >
    <template #header>
      <NFlex align="center" :size="8" :wrap="false" class="assistant-modal__header">
        <NText class="assistant-modal__brand">AI 助手</NText>
        <NTag size="small" :bordered="false" type="info">{{ ctx.title || '管理后台' }}</NTag>
      </NFlex>
    </template>
    <template #header-extra>
      <NButton size="tiny" quaternary @click="store.reset">清空</NButton>
    </template>

    <div class="assistant-modal__ctx">
      <NText depth="3" class="assistant-modal__ctx-line">
        route: {{ ctx.routeName || route.name?.toString() || '-' }} · path: {{ ctx.path || route.path }}
      </NText>
    </div>

    <div class="assistant-modal__body">
      <AssistantChatWindow />
    </div>
  </NModal>
</template>

<style scoped>
.assistant-modal__header { min-width: 0; }
.assistant-modal__brand { font-size: 15px; font-weight: 600; }
.assistant-modal__ctx {
  padding: 0 0 8px;
  border-bottom: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
  margin-bottom: 8px;
}
.assistant-modal__ctx-line { font-size: 12px; word-break: break-all; }
.assistant-modal__body { height: min(60vh, 520px); min-height: 280px; }
:deep(.n-card__content) { display: flex; flex-direction: column; }
</style>

<!-- 非 scoped：class 透传到 NModal 内部 card 元素上，scoped 属性无法命中 -->
<style>
.assistant-modal {
  width: 560px;
  max-width: calc(100vw - 32px);
}
@media (max-width: 640px) {
  .assistant-modal {
    width: calc(100vw - 24px);
  }
  .assistant-modal .assistant-modal__body {
    height: 66vh;
  }
}
</style>
