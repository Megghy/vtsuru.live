<script setup lang="ts">
import { Delete24Regular, History24Regular, Image24Regular, LockClosed24Regular } from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { NButton, NDrawer, NDrawerContent, NEmpty, NIcon, NPopconfirm, NTag, NTime } from 'naive-ui'
import { computed } from 'vue'

import type { LocalQuestion } from './questionBoxHistory'

defineProps<{
  questions: LocalQuestion[]
}>()
const emit = defineEmits<{
  clear: []
  remove: [id: string]
}>()
const show = defineModel<boolean>('show', { required: true })
const { width } = useWindowSize()
const drawerWidth = computed(() => Math.min(440, width.value))
</script>

<template>
  <NDrawer
    v-model:show="show"
    :width="drawerWidth"
    placement="right"
  >
    <NDrawerContent closable>
      <template #header>
        <div class="drawer-heading">
          <span class="drawer-icon"><NIcon :component="History24Regular" /></span>
          <div>
            <strong>本地提问记录</strong>
            <span>仅保存在当前浏览器</span>
          </div>
        </div>
      </template>

      <div
        v-if="questions.length"
        class="history-list"
      >
        <article
          v-for="item in questions"
          :key="item.id"
          class="history-item"
        >
          <div class="history-meta">
            <span>提给 {{ item.targetUserName }}</span>
            <NTime
              :time="item.sendAt"
              type="relative"
            />
          </div>
          <p>{{ item.message }}</p>
          <div class="history-tags">
            <NTag
              v-if="item.tag"
              size="small"
              :bordered="false"
            >
              {{ item.tag }}
            </NTag>
            <span v-if="item.hasImage"><NIcon :component="Image24Regular" />包含图片</span>
            <span v-if="item.anonymousName"><NIcon :component="LockClosed24Regular" />{{ item.anonymousName }}</span>
          </div>
          <NButton
            quaternary
            circle
            size="small"
            class="delete-action"
            aria-label="删除这条本地记录"
            title="删除这条本地记录"
            @click="emit('remove', item.id)"
          >
            <template #icon><NIcon :component="Delete24Regular" /></template>
          </NButton>
        </article>
      </div>

      <NEmpty
        v-else
        class="history-empty"
        description="还没有本地提问记录"
      />

      <template
        v-if="questions.length"
        #footer
      >
        <NPopconfirm @positive-click="emit('clear')">
          <template #trigger>
            <NButton
              secondary
              type="error"
            >
              <template #icon><NIcon :component="Delete24Regular" /></template>
              清空本地记录
            </NButton>
          </template>
          清空后无法恢复
        </NPopconfirm>
      </template>
    </NDrawerContent>
  </NDrawer>
</template>

<style scoped>
.drawer-heading {
  display: flex;
  align-items: center;
  gap: 11px;
}

.drawer-icon {
  display: grid;
  width: 34px;
  height: 34px;
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-page-primary));
  background: var(--vtsuru-page-primary-soft);
  border-radius: 50%;
  place-items: center;
}

.drawer-heading > div {
  display: grid;
}

.drawer-heading strong {
  font-size: 15px;
}

.drawer-heading span:last-child {
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  font-size: 11px;
}

.history-list {
  display: grid;
  gap: 10px;
}

.history-item {
  position: relative;
  min-width: 0;
  padding: 14px 44px 14px 14px;
  background: var(--user-page-theme-surface-bg, var(--vtsuru-page-card-bg));
  border: var(--vtsuru-page-border);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.history-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  font-size: 11px;
}

.history-meta span:first-child {
  color: var(--vtsuru-surface-fg, var(--vtsuru-fg));
  font-weight: 600;
}

.history-item p {
  margin: 9px 0 10px;
  overflow-wrap: anywhere;
  color: var(--vtsuru-surface-fg, var(--vtsuru-fg));
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
}

.history-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  color: var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted));
  font-size: 11px;
}

.history-tags > span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.delete-action {
  position: absolute;
  top: 10px;
  right: 9px;
}

.history-empty {
  padding: 64px 16px;
}
</style>
