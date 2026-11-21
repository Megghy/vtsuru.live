<script setup lang="ts">
import { ArrowUpRight, Radio } from 'lucide-vue-next'
import { useRouter } from 'vue-router'

import { ACCOUNT, isLoggedIn } from '@/api/account'
import ThemeToggleButton from '@/shared/components/ThemeToggleButton.vue'
import { Button } from '@/shared/ui/button'
import vtb from '@/svgs/ic_vtuber.svg'

import type { IndexSectionId } from './useIndexMotion'

defineProps<{
  isScrolled: boolean
  scrollProgress: number
  activeSectionId: IndexSectionId
  liveCount: number
}>()

const router = useRouter()

const navAnchors = [
  { id: 'flagship', href: '#flagship', label: '核心能力' },
  { id: 'obs-widgets', href: '#obs-widgets', label: 'OBS 挂件' },
  { id: 'features', href: '#features', label: '全站功能' },
  { id: 'streamers', href: '#streamers', label: '主播广场' },
] as const

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <header
    class="sticky top-0 z-40 transition-all duration-300"
    :class="
      isScrolled
        ? 'bg-background/82 backdrop-blur-lg border-b border-border/80 shadow-xs'
        : 'bg-transparent border-b border-transparent'
    "
  >
    <div
      class="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 transition-[height] duration-300"
      :class="isScrolled ? 'h-13' : 'h-15'"
    >
      <button
        type="button"
        class="group inline-flex items-center gap-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1 py-0.5"
        aria-label="返回顶部"
        @click="scrollToTop"
      >
        <span
          class="flex size-8 items-center justify-center rounded-lg bg-brand/12 ring-1 ring-brand/25 transition-transform duration-200 group-hover:scale-105"
          :class="isScrolled ? 'scale-95' : 'scale-100'"
        >
          <vtb class="size-5" />
        </span>
        <span class="flex flex-col leading-none">
          <span class="text-sm font-bold tracking-tight text-foreground">VTSURU.LIVE</span>
          <span class="text-[10px] text-muted-foreground mt-0.5">主播工具与互动工作台</span>
        </span>
      </button>

      <nav
        aria-label="页面导航"
        class="hidden md:flex items-center gap-1 rounded-full p-1 transition-colors duration-200"
        :class="isScrolled ? 'bg-muted/55 ring-1 ring-border/70' : ''"
      >
        <a
          v-for="item in navAnchors"
          :key="item.href"
          :href="item.href"
          class="rounded-full px-3 py-1 text-xs font-medium transition-all duration-200"
          :class="
            activeSectionId === item.id
              ? 'bg-card text-brand shadow-xs ring-1 ring-border/70 font-semibold'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          "
        >
          {{ item.label }}
        </a>
      </nav>

      <div class="flex items-center gap-2">
        <Button
          variant="ghost"
          class="hidden sm:inline-flex gap-1.5 text-muted-foreground hover:text-foreground"
          @click="router.push({ name: 'live-directory' })"
        >
          <Radio
            class="size-3.5"
            :class="liveCount > 0 ? 'text-emerald-500' : ''"
          />
          <span>直播与关注</span>
          <span
            v-if="liveCount > 0"
            class="rounded-full bg-emerald-500/15 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums"
          >
            {{ liveCount }}
          </span>
        </Button>

        <ThemeToggleButton variant="ghost" />

        <Button
          class="gap-1"
          @click="router.push({ name: 'manage-index' })"
        >
          <span v-if="isLoggedIn">
            进入工作台<span
              v-if="ACCOUNT.name"
              class="hidden sm:inline opacity-80 font-normal"
            >
              · {{ ACCOUNT.name }}
            </span>
          </span>
          <span v-else>进入后台</span>
          <ArrowUpRight class="size-3.5" />
        </Button>
      </div>
    </div>

    <!-- 顶部极细滚动进度条 -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        class="h-full origin-left bg-gradient-to-r from-brand via-sky-400 to-pink-400/90 transition-opacity duration-200"
        :style="{
          transform: `scaleX(${scrollProgress})`,
          opacity: isScrolled ? 0.9 : 0,
        }"
      />
    </div>
  </header>
</template>
