<script setup lang="ts">
import { ArrowRight, BookOpen, Compass, Cpu, Layers, LayoutGrid, Radio, Search, Sparkles, TrendingUp } from 'lucide-vue-next'
import type { Component } from 'vue'
import { ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { DOC_GROUPS } from '@/apps/docs/registry'
import type { DocCategoryId } from '@/apps/docs/types'
import { Button } from '@/shared/ui/button'

import DocsSearchDialog from './DocsSearchDialog.vue'
import DocsShell from './DocsShell.vue'

const router = useRouter()
const searchOpen = ref(false)

const categoryIcons: Record<DocCategoryId, Component> = {
  'getting-started': Sparkles,
  obs: Layers,
  live: Radio,
  client: Cpu,
  page: LayoutGrid,
  ops: TrendingUp,
}
</script>

<template>
  <DocsShell>
    <div class="mx-auto max-w-4xl px-4 py-8 sm:px-8 sm:py-10 space-y-8">
      <!-- 顶部引导区 -->
      <section class="rounded-xl border border-border bg-card p-6 sm:p-8">
        <div class="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand">
          <BookOpen class="size-3.5" />
          VTsuru 使用说明书
        </div>
        <h1 class="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          从第一次开播到全套直播间与小窝搭建
        </h1>
        <p class="mt-2 max-w-2xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
          站点越做越大，功能多到有时候连我自己都快记不住开关藏在哪了——于是干脆写了这份说明书。重点功能都有示意图或可点击的小演示，遇到实在没看懂的地方随时去工单或群里戳我。
        </p>

        <div class="mt-5 flex flex-wrap items-center gap-2.5">
          <Button
            class="gap-1.5"
            @click="router.push({ name: 'docs-article', params: { slug: ['getting-started', 'quick-start'] } })"
          >
            <span>5 分钟快速上手</span>
            <ArrowRight class="size-3.5" />
          </Button>
          <Button
            variant="outline"
            class="gap-1.5"
            @click="searchOpen = true"
          >
            <Search class="size-3.5" />
            <span>搜索功能说明</span>
          </Button>
          <Button
            variant="ghost"
            class="gap-1.5 text-muted-foreground"
            @click="router.push({ name: 'manage-index' })"
          >
            <Compass class="size-3.5" />
            <span>前往工作台</span>
          </Button>
        </div>
      </section>

      <!-- 按分类组织的功能文档网格 -->
      <section class="space-y-6">
        <div
          v-for="group in DOC_GROUPS"
          :key="group.id"
          class="space-y-3"
        >
          <div class="flex items-center gap-2">
            <span class="flex size-7 items-center justify-center rounded-md bg-brand-soft text-brand">
              <component
                :is="categoryIcons[group.id]"
                class="size-4"
              />
            </span>
            <div>
              <h2 class="text-sm font-semibold text-foreground">{{ group.title }}</h2>
              <p class="text-[11px] text-muted-foreground">{{ group.description }}</p>
            </div>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <RouterLink
              v-for="doc in group.items"
              :key="doc.slug"
              :to="{ name: 'docs-article', params: { slug: doc.slug.split('/') } }"
              class="card-interactive group flex flex-col justify-between rounded-lg border border-border bg-card p-4"
            >
              <div>
                <div class="flex-between gap-2">
                  <span class="text-sm font-semibold text-foreground group-hover:text-brand transition-colors">
                    {{ doc.title }}
                  </span>
                  <span
                    v-if="doc.badge"
                    class="shrink-0 rounded-sm bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-brand"
                  >
                    {{ doc.badge }}
                  </span>
                </div>
                <p
                  v-if="doc.description"
                  class="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground"
                >
                  {{ doc.description }}
                </p>
              </div>

              <div class="mt-3 flex items-center gap-1 text-[11px] font-medium text-brand">
                <span>阅读说明</span>
                <ArrowRight class="size-3 transition-transform duration-150 group-hover:translate-x-0.5" />
              </div>
            </RouterLink>
          </div>
        </div>
      </section>
    </div>

    <DocsSearchDialog v-model:open="searchOpen" />
  </DocsShell>
</template>
