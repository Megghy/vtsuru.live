<script setup lang="ts">
import { Delete24Regular, History24Regular, Image24Regular, LockClosed24Regular } from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'

import type { LocalQuestion } from './questionBoxHistory'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/shared/ui/sheet'

defineProps<{
  questions: LocalQuestion[]
}>()
const emit = defineEmits<{
  clear: []
  remove: [id: string]
}>()
const show = defineModel<boolean>('show', { required: true })

function formatRelativeTime(time: number) {
  try {
    return formatDistanceToNow(new Date(time), { addSuffix: true, locale: zhCN })
  } catch {
    return String(time)
  }
}
</script>

<template>
  <Sheet
    :open="show"
    @update:open="show = $event"
  >
    <SheetContent side="right" class="w-full sm:max-w-md p-0 flex flex-col">
      <SheetHeader class="px-5 py-4 border-b border-border/80">
        <div class="drawer-heading flex items-center gap-3">
          <span class="drawer-icon size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <component :is="History24Regular" class="size-5" />
          </span>
          <div>
            <SheetTitle class="text-base font-semibold">本地提问记录</SheetTitle>
            <span class="text-xs text-muted-foreground">仅保存在当前浏览器</span>
          </div>
        </div>
      </SheetHeader>

      <div class="flex-1 min-h-0 overflow-y-auto p-5">
        <div
          v-if="questions.length"
          class="history-list space-y-3"
        >
          <article
            v-for="item in questions"
            :key="item.id"
            class="history-item relative p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2 group"
          >
            <div class="history-meta flex items-center justify-between text-xs text-muted-foreground">
              <span>提给 {{ item.targetUserName }}</span>
              <span class="text-[11px]">{{ formatRelativeTime(item.sendAt) }}</span>
            </div>
            <p class="text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words pr-6">{{ item.message }}</p>
            <div class="history-tags flex items-center gap-2 text-xs flex-wrap">
              <Badge
                v-if="item.tag"
                variant="secondary"
                class="text-[10px] h-4.5 px-1.5 font-normal"
              >
                {{ item.tag }}
              </Badge>
              <span v-if="item.hasImage" class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <component :is="Image24Regular" class="size-3" />
                包含图片
              </span>
              <span v-if="item.anonymousName" class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <component :is="LockClosed24Regular" class="size-3" />
                {{ item.anonymousName }}
              </span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              class="delete-action absolute top-2 right-2 size-6 rounded-full text-muted-foreground opacity-60 hover:opacity-100 hover:text-destructive hover:bg-destructive/10"
              aria-label="删除这条本地记录"
              title="删除这条本地记录"
              @click="emit('remove', item.id)"
            >
              <component :is="Delete24Regular" class="size-3.5" />
            </Button>
          </article>
        </div>

        <Empty
          v-else
          class="history-empty py-16"
          description="还没有本地提问记录"
        />
      </div>

      <SheetFooter
        v-if="questions.length"
        class="px-5 py-3 border-t border-border/80 flex items-center justify-end"
      >
        <Popconfirm
          title="清空后无法恢复，确定要清空全部记录吗？"
          positive-text="确认清空"
          negative-text="取消"
          @positive-click="emit('clear')"
        >
          <template #trigger>
            <Button
              variant="destructive"
              size="sm"
              class="text-xs flex items-center gap-1.5"
            >
              <component :is="Delete24Regular" class="size-3.5" />
              清空本地记录
            </Button>
          </template>
          清空后无法恢复
        </Popconfirm>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
.history-item {
  transition: all 0.15s ease;
}
</style>
