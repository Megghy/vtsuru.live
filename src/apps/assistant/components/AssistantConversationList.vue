<script setup lang="ts">
import { Add16Regular, Delete16Regular, Edit16Regular, Search16Regular } from '@vicons/fluent'
import { computed, ref } from 'vue'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'

import { useAssistantStore } from '../store/useAssistantStore'

const store = useAssistantStore()

const editingId = ref<number | null>(null)
const editingTitle = ref('')
/** 会话标题搜索关键词 (本地过滤已加载的会话) */
const keyword = ref('')

const deleteTarget = ref<{ id: number; title: string } | null>(null)

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

async function handleDelete() {
  if (!deleteTarget.value) return
  await store.deleteConversationById(deleteTarget.value.id)
  deleteTarget.value = null
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
  <div class="flex flex-col h-full min-h-0 gap-2">
    <Button
      variant="outline"
      class="conv-list__new w-full border-dashed flex items-center justify-center gap-1.5"
      @click="store.newConversation"
    >
      <component
        :is="Add16Regular"
        class="size-3.5"
      />
      新对话
    </Button>

    <div class="relative conv-list__search">
      <component
        :is="Search16Regular"
        class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        size="xs"
        v-model="keyword"
        placeholder="搜索会话"
        class="pl-8"
      />
    </div>

    <div
      class="conv-list__scroll overflow-y-auto flex-1 min-h-0 pr-1 space-y-1"
      @scroll="onScroll"
    >
      <div
        v-if="store.conversationsLoading && !store.conversations.length"
        class="conv-list__spin flex justify-center py-6"
      >
        <Spin />
      </div>

      <Empty
        v-else-if="!filteredConversations.length"
        :description="keyword.trim() ? '无匹配会话' : '暂无历史'"
        class="conv-list__empty py-6 text-xs"
      />

      <div
        v-for="conv in filteredConversations"
        :key="conv.id"
        class="conv-item group flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition select-none"
        :class="
          conv.id === store.currentConversationId
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-foreground hover:bg-muted/60'
        "
        @click="store.switchConversation(conv.id)"
      >
        <Input
          v-if="editingId === conv.id"
          v-model="editingTitle"
          autofocus
          class="h-6 px-1.5"
          @blur="commitRename"
          @keydown.enter="commitRename"
          @click.stop
        />
        <template v-else>
          <span class="conv-item__title truncate flex-1 min-w-0">{{ conv.title }}</span>
          <span
            class="conv-item__actions flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition"
            @click.stop
          >
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground hover:text-foreground"
              title="重命名"
              @click="startRename(conv.id, conv.title)"
            >
              <component
                :is="Edit16Regular"
                class="size-3"
              />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-destructive hover:bg-destructive/10"
              title="删除"
              @click="confirmDelete(conv.id, conv.title)"
            >
              <component
                :is="Delete16Regular"
                class="size-3"
              />
            </Button>
          </span>
        </template>
      </div>

      <div
        v-if="store.conversationsLoadingMore"
        class="conv-list__more-spin flex justify-center py-2"
      >
        <Spin />
      </div>
    </div>

    <!-- 删除确认弹窗 -->
    <AlertDialog
      :open="Boolean(deleteTarget)"
      @update:open="!$event && (deleteTarget = null)"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="text-sm font-semibold">删除会话</AlertDialogTitle>
          <AlertDialogDescription class="text-xs">
            确定删除「{{ deleteTarget?.title }}」? 该会话的聊天记录将被清除。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click="handleDelete"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
