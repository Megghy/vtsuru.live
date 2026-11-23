<script setup lang="ts">
import { useEventListener } from '@vueuse/core'
import { ArrowUpRight, BookOpen, Home, Menu, Search } from 'lucide-vue-next'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isLoggedIn } from '@/api/account'
import ThemeToggleButton from '@/shared/components/ThemeToggleButton.vue'
import { Button } from '@/shared/ui/button'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import vtb from '@/svgs/ic_vtuber.svg'

import DocsSearchDialog from './DocsSearchDialog.vue'
import DocsSidebarNav from './DocsSidebarNav.vue'

const router = useRouter()
const searchOpen = ref(false)
const mobileNavOpen = ref(false)

useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
    return
  }
  event.preventDefault()
  searchOpen.value = true
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col">
    <header class="sticky top-0 z-40 h-13 border-b border-border bg-background/88 backdrop-blur-md">
      <div class="mx-auto flex h-full w-full max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <div class="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="icon-xs"
            class="lg:hidden shrink-0"
            aria-label="打开文档目录"
            @click="mobileNavOpen = true"
          >
            <Menu class="size-4" />
          </Button>

          <RouterLink
            :to="{ name: 'docs-index' }"
            class="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:opacity-90 shrink-0"
          >
            <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-brand-soft ring-1 ring-brand/25">
              <vtb class="size-4" />
            </span>
            <span class="text-sm font-bold tracking-tight text-foreground whitespace-nowrap">VTSURU</span>
            <span class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <BookOpen class="size-3 shrink-0 text-brand" />
              <span>文档</span>
            </span>
          </RouterLink>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="xs"
            class="gap-1.5 text-muted-foreground sm:w-48 justify-between"
            @click="searchOpen = true"
          >
            <span class="inline-flex items-center gap-1.5">
              <Search class="size-3.5" />
              <span class="hidden sm:inline">搜索文档...</span>
            </span>
            <kbd class="hidden sm:inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px]">
              /
            </kbd>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            class="hidden sm:inline-flex gap-1 text-muted-foreground hover:text-foreground"
            @click="router.push({ name: 'index' })"
          >
            <Home class="size-3.5" />
            <span>首页</span>
          </Button>

          <ThemeToggleButton variant="ghost" />

          <Button
            size="xs"
            class="gap-1"
            @click="router.push({ name: 'manage-index' })"
          >
            <span>{{ isLoggedIn ? '工作台' : '登录后台' }}</span>
            <ArrowUpRight class="size-3.5" />
          </Button>
        </div>
      </div>
    </header>

    <div class="mx-auto flex w-full max-w-[1400px] flex-1 min-w-0">
      <!-- 桌面端左侧文档目录 -->
      <aside class="hidden lg:flex w-[248px] shrink-0 border-r border-border">
        <div class="sticky top-13 h-[calc(100vh-3.25rem)] w-full flex flex-col">
          <ScrollArea class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
            <DocsSidebarNav />
          </ScrollArea>
        </div>
      </aside>

      <!-- 主阅读区 + 可选右侧 TOC 槽位 -->
      <main class="flex-1 min-w-0">
        <slot />
      </main>
    </div>

    <!-- 移动端抽屉目录 -->
    <Sheet v-model:open="mobileNavOpen">
      <SheetContent
        side="left"
        class="w-[272px] p-0 flex flex-col gap-0"
      >
        <SheetHeader class="border-b border-border px-4 py-3 text-left">
          <SheetTitle class="text-sm font-semibold">文档目录</SheetTitle>
        </SheetHeader>
        <ScrollArea class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
          <DocsSidebarNav @navigate="mobileNavOpen = false" />
        </ScrollArea>
      </SheetContent>
    </Sheet>

    <DocsSearchDialog v-model:open="searchOpen" />
  </div>
</template>
