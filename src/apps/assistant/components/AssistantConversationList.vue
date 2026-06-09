<script setup lang="ts">
import { Add16Regular, Edit16Regular, Delete16Regular } from '@vicons/fluent'
import { NButton, NEmpty, NIcon, NInput, NScrollbar, NSpin, useDialog } from 'naive-ui'
import { ref } from 'vue'
import { useAssistantStore } from '../store/useAssistantStore'

const store = useAssistantStore()
const dialog = useDialog()

const editingId = ref<number | null>(null)
const editingTitle = ref('')

function startRename(id: number, title: string) {
  editingId.value = id
  editingTitle.value = title
}

async function commitRename() {
  const id = editingId.value
  const title = editingTitle.value.trim()
  editingId.value = null
  if (id === null || !title) return
  await store.renameConversationById(id, title)
}

function confirmDelete(id: number, title: string) {
  dialog.warning({
    title: '删除会话',
    content: `确定删除「${title}」? 该会话的聊天记录将被清除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => store.deleteConversationById(id),
  })
}
</script>

<template>
  <div class="conv-list">
    <NButton class="conv-list__new" dashed block @click="store.newConversation">
      <template #icon>
        <NIcon :component="Add16Regular" />
      </template>
      新对话
    </NButton>

    <NScrollbar class="conv-list__scroll">
      <NSpin v-if="store.conversationsLoading && !store.conversations.length" size="small" class="conv-list__spin" />
      <NEmpty v-else-if="!store.conversations.length" size="small" description="暂无历史" class="conv-list__empty" />

      <div
        v-for="conv in store.conversations"
        :key="conv.id"
        class="conv-item"
        :class="{ 'conv-item--active': conv.id === store.currentConversationId }"
        @click="store.switchConversation(conv.id)"
      >
        <NInput
          v-if="editingId === conv.id"
          v-model:value="editingTitle"
          size="tiny"
          autofocus
          @blur="commitRename"
          @keydown.enter="commitRename"
          @click.stop
        />
        <template v-else>
          <span class="conv-item__title">{{ conv.title }}</span>
          <span class="conv-item__actions" @click.stop>
            <NButton size="tiny" quaternary circle title="重命名" @click="startRename(conv.id, conv.title)">
              <template #icon>
                <NIcon :component="Edit16Regular" />
              </template>
            </NButton>
            <NButton size="tiny" quaternary circle type="error" title="删除" @click="confirmDelete(conv.id, conv.title)">
              <template #icon>
                <NIcon :component="Delete16Regular" />
              </template>
            </NButton>
          </span>
        </template>
      </div>
    </NScrollbar>
  </div>
</template>

<style scoped>
.conv-list { display: flex; flex-direction: column; height: 100%; min-height: 0; gap: 8px; }
.conv-list__new { flex: 0 0 auto; }
.conv-list__scroll { flex: 1 1 0; min-height: 0; }
.conv-list__spin, .conv-list__empty { margin-top: 24px; }
.conv-item {
  --conv-item-bg: transparent;
  --conv-item-text: var(--vtsuru-fg, var(--n-text-color));
  --conv-item-ring: transparent;

  display: flex; align-items: center; gap: 4px;
  padding: 7px 8px; margin-bottom: 2px; border-radius: 8px;
  cursor: pointer; font-size: 13px;
  background: var(--conv-item-bg);
  color: var(--conv-item-text);
  box-shadow: inset 0 0 0 1px var(--conv-item-ring);
  transition: background 0.15s, box-shadow 0.15s, color 0.15s;
}
.conv-item:hover {
  --conv-item-bg: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.1));
}
.conv-item--active {
  --conv-item-bg: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.1));
  --conv-item-ring: var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.16));
}
.conv-item__title {
  flex: 1 1 0; min-width: 0;
  color: inherit;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.conv-item__actions { flex: 0 0 auto; display: none; align-items: center; }
.conv-item:hover .conv-item__actions { display: flex; }
</style>
