<script setup lang="ts">
import type { VNode } from 'vue'

import type { updateNoteItemContentType } from '@/shared/services/UpdateNote'
import { updateNotes } from '@/shared/services/UpdateNote'

const typeMeta = {
  fix: { label: '错误修复', color: 'info' },
  new: { label: '功能添加', color: 'success' },
  optimize: { label: '功能优化', color: 'warning' },
  other: { label: '其他', color: 'error' },
} as const

function renderContent(content: updateNoteItemContentType): VNode | string | undefined {
  if (Array.isArray(content)) {
    return h(
      'div',
      { style: { whiteSpace: 'pre-wrap' } },
      content.map((item) => renderContent(item)),
    )
  }
  const getContent = (c: unknown) => {
    if (typeof c === 'string') {
      return c
    }
    if (typeof c === 'function') {
      return c()
    }
  }
  return h('span', { style: { whiteSpace: 'pre-wrap' } }, getContent(content))
}
</script>

<template>
  <div class="update-note-list">
    <section
      v-for="item in updateNotes"
      :key="item.ver"
      class="update-note-version"
    >
      <h3>{{ item.date }}</h3>
      <article
        v-for="note in item.items"
        :key="typeof note.title === 'string' ? note.title : `${item.ver}-${note.type}`"
        class="update-note-item"
      >
        <UBadge
          :color="typeMeta[note.type].color"
          variant="subtle"
        >
          {{ typeMeta[note.type].label }}
        </UBadge>
        <div class="update-note-content">
          <h4 v-if="note.title">
            <component :is="typeof note.title === 'function' ? note.title() : renderContent(note.title)" />
          </h4>
          <component
            :is="renderContent(content)"
            v-for="(content, index) in note.content"
            :key="index"
          />
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.update-note-list {
  display: flex;
  max-height: min(72vh, 720px);
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;
  padding-right: 8px;
}

.update-note-version h3 {
  margin: 0 0 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--vtsuru-border);
  color: var(--vtsuru-fg);
  font-size: 14px;
}

.update-note-item {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
  padding: 10px 0;
}

.update-note-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
  color: var(--vtsuru-fg-toned);
  line-height: 1.65;
}

.update-note-content h4 {
  margin: 0;
  color: var(--vtsuru-fg);
  font-size: 14px;
}

@media (max-width: 640px) {
  .update-note-item {
    grid-template-columns: 1fr;
  }
}
</style>
