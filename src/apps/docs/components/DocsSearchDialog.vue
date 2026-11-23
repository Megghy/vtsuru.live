<script setup lang="ts">
import { BookOpen, CornerDownLeft, FileText, Search } from 'lucide-vue-next'
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { searchDocs } from '@/apps/docs/registry'
import type { DocSearchResult } from '@/apps/docs/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { ScrollArea } from '@/shared/ui/scroll-area'

const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const query = ref('')
const results = ref<DocSearchResult[]>([])
const activeIndex = ref(0)
const isSearching = ref(false)
const inputWrapperRef = ref<HTMLElement | null>(null)

let searchSeq = 0

async function runSearch(kw: string) {
  const seq = ++searchSeq
  isSearching.value = true
  try {
    const list = await searchDocs(kw)
    if (seq !== searchSeq) return
    results.value = list
    activeIndex.value = 0
  } finally {
    if (seq === searchSeq) isSearching.value = false
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) return
  query.value = ''
  await runSearch('')
  await nextTick()
  const input = inputWrapperRef.value?.querySelector('input')
  input?.focus()
})

watch(query, (kw) => {
  void runSearch(kw)
})

function selectResult(slug: string) {
  open.value = false
  void router.push({ name: 'docs-article', params: { slug: slug.split('/') } })
}

function handleKeydown(event: KeyboardEvent) {
  const len = results.value.length
  if (!len) return
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value + 1) % len
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    activeIndex.value = (activeIndex.value - 1 + len) % len
  } else if (event.key === 'Enter') {
    const item = results.value[activeIndex.value]
    if (item) {
      event.preventDefault()
      selectResult(item.entry.slug)
    }
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-w-xl p-0 gap-0 overflow-hidden"
      @keydown="handleKeydown"
    >
      <DialogTitle class="sr-only">搜索使用文档</DialogTitle>
      <DialogDescription class="sr-only">输入功能名称、OBS 挂件或配置关键词检索文档</DialogDescription>

      <div
        ref="inputWrapperRef"
        class="flex items-center gap-2 border-b border-border pl-3 pr-10 py-2.5"
      >
        <Search class="size-4 shrink-0 text-muted-foreground" />
        <Input
          v-model="query"
          placeholder="搜索功能说明、OBS 挂件、设置项或关键词..."
          class="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
        />
      </div>

      <ScrollArea class="max-h-[380px] [&_[data-reka-scroll-area-viewport]>div]:!block">
        <div
          v-if="results.length === 0 && !isSearching"
          class="flex-col-center gap-2 py-12 text-center text-muted-foreground"
        >
          <BookOpen class="size-6 opacity-40" />
          <div class="text-xs">未找到与「{{ query }}」相关的文档</div>
        </div>

        <div
          v-else
          class="p-2 space-y-1"
        >
          <button
            v-for="(item, idx) in results"
            :key="item.entry.slug"
            type="button"
            class="w-full flex items-start justify-between gap-3 rounded-md px-3 py-2 text-left transition-colors duration-150"
            :class="idx === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60'"
            @mouseenter="activeIndex = idx"
            @click="selectResult(item.entry.slug)"
          >
            <div class="flex items-start gap-2.5 min-w-0">
              <FileText class="size-4 shrink-0 mt-0.5 text-brand" />
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs font-semibold text-foreground">{{ item.entry.title }}</span>
                  <span class="rounded bg-muted px-1.5 py-0.2 text-[10px] text-muted-foreground">
                    {{ item.categoryTitle }}
                  </span>
                </div>
                <p
                  v-if="item.snippet"
                  class="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground"
                >
                  {{ item.snippet }}
                </p>
              </div>
            </div>
            <CornerDownLeft
              v-if="idx === activeIndex"
              class="size-3.5 shrink-0 mt-1 text-muted-foreground"
            />
          </button>
        </div>
      </ScrollArea>

      <div class="flex-between border-t border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span>支持全文正文检索</span>
        <span class="hidden sm:inline">↑↓ 选择 · Enter 打开</span>
      </div>
    </DialogContent>
  </Dialog>
</template>
