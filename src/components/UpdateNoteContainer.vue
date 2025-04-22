<script setup lang="ts">
import { updateNoteItemContentType, updateNotes } from '@/data/UpdateNote';
import { NDivider, NGrid } from 'naive-ui';
import { VNode } from 'vue';

function renderContent(content: updateNoteItemContentType): VNode | string | undefined {
  if (Array.isArray(content)) {
    return h('div', { style: { whiteSpace: 'pre-wrap' } }, content.map(item => renderContent(item)))
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
  <NScrollbar
    style="max-height: 80vh;"
    trigger="none"
  >
    <NFlex vertical>
      <div
        v-for="item in updateNotes"
        :key="item.ver"
      >
        <NDivider title-placement="left">
          {{ item.date }}
        </NDivider>
        <NGrid x-gap="10">
          <template
            v-for="note in item.items"
            :key="note.title"
          >
            <NGridItem span="6">
              <div style="">
                <NTag
                  v-if="note.type === 'fix'"
                  type="info"
                  round
                  :bordered="false"
                >
                  错误修复
                </NTag>
                <NTag
                  v-else-if="note.type === 'new'"
                  type="success"
                  round
                  :bordered="false"
                >
                  功能添加
                </NTag>
                <NTag
                  v-else-if="note.type === 'optimize'"
                  :color="{ textColor: '#000', color: '#f0ad4e', borderColor: '#f0ad4e' }"
                  round
                  :bordered="false"
                >
                  功能优化
                </NTag>
                <NTag
                  v-else-if="note.type === 'other'"
                  type="error"
                  round
                  :bordered="false"
                >
                  其他
                </NTag>
              </div>
            </NGridItem>
            <NGridItem span="18">
              <NFlex vertical>
                <template
                  v-for="content in note.content"
                  :key="content"
                >
                  <component :is="renderContent(content)" />
                </template>
              </NFlex>
            </NGridItem>
          </template>
        </NGrid>
      </div>
    </NFlex>
  </NScrollbar>
</template>