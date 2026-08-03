<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAssistantStore } from '../store/useAssistantStore'

const store = useAssistantStore()

const editingId = ref<number | null>(null)
const editingTitle = ref('')
/** 会话标题搜索关键词 (本地过滤已加载的会话) */
const keyword = ref('')
const deleteTarget = ref<{ id: number; title: string }>()

const filteredConversations = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return store.conversations
  return store.conversations.filter((c) => c.title.toLowerCase().includes(kw))
})

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
  deleteTarget.value = { id, title }
}

async function deleteConversation() {
  if (!deleteTarget.value) return
  await store.deleteConversationById(deleteTarget.value.id)
  deleteTarget.value = undefined
}

/** 触底时加载下一页 (搜索状态下不自动加载, 避免与本地过滤混淆) */
function onScroll(e: Event) {
  if (keyword.value.trim()) return
  const el = e.target as HTMLElement
  if (el.scrollHeight - el.scrollTop - el.clientHeight <= 40) {
    void store.loadMoreConversations()
  }
}
</script>

<template>
  <div class="conv-list">
    <UButton
      class="conv-list__new"
      block
      variant="outline"
      icon="i-lucide-plus"
      @click="store.newConversation"
    >
      新对话
    </UButton>

    <UInput
      v-model="keyword"
      size="sm"
      placeholder="搜索会话"
      icon="i-lucide-search"
      class="conv-list__search"
    />

    <div
      class="conv-list__scroll"
      @scroll="onScroll"
    >
      <UIcon
        v-if="store.conversationsLoading && !store.conversations.length"
        name="i-lucide-loader-circle"
        class="conv-list__spin animate-spin"
      />
      <UEmpty
        v-else-if="!filteredConversations.length"
        :description="keyword.trim() ? '无匹配会话' : '暂无历史'"
        class="conv-list__empty"
      />

      <div
        v-for="conv in filteredConversations"
        :key="conv.id"
        class="conv-item"
        :class="{ 'conv-item--active': conv.id === store.currentConversationId }"
        @click="store.switchConversation(conv.id)"
      >
        <UInput
          v-if="editingId === conv.id"
          v-model="editingTitle"
          size="xs"
          autofocus
          @blur="commitRename"
          @keydown.enter="commitRename"
          @click.stop
        />
        <template v-else>
          <span class="conv-item__title">{{ conv.title }}</span>
          <span
            class="conv-item__actions"
            @click.stop
          >
            <UButton
              size="xs"
              variant="ghost"
              square
              icon="i-lucide-pencil"
              title="重命名"
              @click="startRename(conv.id, conv.title)"
            />
            <UButton
              size="xs"
              variant="ghost"
              square
              color="error"
              icon="i-lucide-trash-2"
              title="删除"
              @click="confirmDelete(conv.id, conv.title)"
            />
          </span>
        </template>
      </div>

      <UIcon
        v-if="store.conversationsLoadingMore"
        name="i-lucide-loader-circle"
        class="conv-list__more-spin animate-spin"
      />
    </div>

    <UModal
      :open="Boolean(deleteTarget)"
      title="删除会话"
      :description="deleteTarget ? `确定删除「${deleteTarget.title}」? 该会话的聊天记录将被清除。` : ''"
      @update:open="(open) => !open && (deleteTarget = undefined)"
    >
      <template #footer>
        <div class="conv-list__confirm-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="deleteTarget = undefined"
          >
            取消
          </UButton>
          <UButton
            color="error"
            @click="deleteConversation"
          >
            删除
          </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.conv-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}
.conv-list__new {
  flex: 0 0 auto;
}
.conv-list__search {
  flex: 0 0 auto;
}
.conv-list__scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
}
.conv-list__spin,
.conv-list__empty {
  display: flex;
  margin-top: 24px;
  margin-inline: auto;
}
.conv-list__more-spin {
  display: block;
  margin: 8px auto;
}
.conv-item {
  --conv-item-bg: transparent;
  --conv-item-text: var(--vtsuru-fg, var(--vtsuru-fg));
  --conv-item-ring: transparent;

  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 8px;
  margin-bottom: 2px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  background: var(--conv-item-bg);
  color: var(--conv-item-text);
  box-shadow: inset 0 0 0 1px var(--conv-item-ring);
  transition:
    background 0.15s,
    box-shadow 0.15s,
    color 0.15s;
}
.conv-item:hover {
  --conv-item-bg: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.1));
}
.conv-item--active {
  --conv-item-bg: var(--vtsuru-brand-soft, rgba(35, 173, 229, 0.1));
  --conv-item-ring: var(--vtsuru-brand-tint, rgba(35, 173, 229, 0.16));
}
.conv-item__title {
  flex: 1 1 0;
  min-width: 0;
  color: inherit;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.conv-item__actions {
  flex: 0 0 auto;
  display: none;
  align-items: center;
}
.conv-item:hover .conv-item__actions {
  display: flex;
}

.conv-list__confirm-actions {
  display: flex;
  width: 100%;
  justify-content: flex-end;
  gap: 8px;
}
</style>
