<script setup lang="ts">
import { h } from 'vue'
import type { VNode } from 'vue'

import type { updateNoteItemContentType } from '@/shared/services/UpdateNote'
import { updateNotes } from '@/shared/services/UpdateNote'
import { Badge } from '@/shared/ui/badge'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'

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
  <ScrollArea class="max-h-[80vh] pr-4">
    <div class="flex flex-col gap-6">
      <div
        v-for="item in updateNotes"
        :key="item.ver"
        class="space-y-3"
      >
        <div class="flex items-center gap-3">
          <span class="text-sm font-semibold text-foreground">{{ item.date }}</span>
          <Separator class="flex-1" />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-3 text-xs">
          <template
            v-for="note in item.items"
            :key="typeof note.title === 'string' ? note.title : 'note'"
          >
            <div class="flex items-start">
              <Badge
                v-if="note.type === 'fix'"
                variant="secondary"
                class="text-[10px] h-5"
              >
                错误修复
              </Badge>
              <Badge
                v-else-if="note.type === 'new'"
                class="text-[10px] h-5"
              >
                功能添加
              </Badge>
              <Badge
                v-else-if="note.type === 'optimize'"
                variant="outline"
                class="text-[10px] h-5"
              >
                功能优化
              </Badge>
              <Badge
                v-else-if="note.type === 'other'"
                variant="destructive"
                class="text-[10px] h-5"
              >
                其他
              </Badge>
            </div>
            <div class="flex flex-col gap-1 text-muted-foreground leading-relaxed">
              <template
                v-for="(content, cIdx) in note.content"
                :key="cIdx"
              >
                <component :is="renderContent(content)" />
              </template>
            </div>
          </template>
        </div>
      </div>
    </div>
  </ScrollArea>
</template>
