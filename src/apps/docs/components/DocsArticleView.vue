<script setup lang="ts">
import { ArrowLeft, ArrowRight, ArrowUpRight, ChevronRight, ListTree } from 'lucide-vue-next'
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import '@/apps/docs/styles/docs-prose.css'
import { getDocBySlug, getDocCategory, getPrevNextDocs } from '@/apps/docs/registry'
import type { DocTocItem } from '@/apps/docs/types'
import { Button } from '@/shared/ui/button'
import { ImageLightbox, useHtmlImagePreview } from '@/shared/ui/image-preview'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'

import DocsShell from './DocsShell.vue'

const route = useRoute()
const router = useRouter()

const slug = computed(() => {
  const param = route.params.slug
  if (Array.isArray(param)) return param.join('/')
  return typeof param === 'string' ? param : ''
})

const entry = computed(() => getDocBySlug(slug.value))
const category = computed(() => (entry.value ? getDocCategory(entry.value.category) : undefined))
const neighbors = computed(() => getPrevNextDocs(slug.value))

const articleComponent = computed(() => {
  if (!entry.value) return null
  return defineAsyncComponent(entry.value.loadComponent)
})

// 页面标题同步文档标题
watch(
  entry,
  (doc) => {
    if (doc?.title) {
      document.title = `${doc.title} · 文档 · VTsuru`
    }
  },
  { immediate: true },
)

// 提取正文标题生成右侧 TOC + 滚动联动高亮
const contentRef = ref<HTMLElement | null>(null)
const headings = ref<DocTocItem[]>([])
const activeHeadingId = ref('')
let observer: IntersectionObserver | null = null

function disconnectObserver() {
  observer?.disconnect()
  observer = null
}

async function collectHeadings() {
  disconnectObserver()
  await nextTick()
  const root = contentRef.value
  if (!root) {
    headings.value = []
    return
  }
  const nodes = Array.from(root.querySelectorAll('h2[id], h3[id]')) as HTMLElement[]
  headings.value = nodes.map((el) => ({
    id: el.id,
    text: (el.textContent || '').trim(),
    level: el.tagName === 'H3' ? 3 : 2,
  }))
  activeHeadingId.value = headings.value[0]?.id ?? ''

  if (nodes.length > 0 && typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.find((item) => item.isIntersecting)
        if (visible?.target.id) {
          activeHeadingId.value = visible.target.id
        }
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0.1 },
    )
    nodes.forEach((node) => observer?.observe(node))
  }

  if (route.hash) {
    const targetId = decodeURIComponent(route.hash.slice(1))
    const targetEl = targetId ? document.getElementById(targetId) : null
    if (targetEl) {
      activeHeadingId.value = targetId
      targetEl.scrollIntoView({ block: 'start' })
    }
  }
}

watch(slug, () => {
  headings.value = []
  void collectHeadings()
})

onBeforeUnmount(disconnectObserver)

function scrollToHeading(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  activeHeadingId.value = id
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  history.replaceState(null, '', `#${encodeURIComponent(id)}`)
}

// 点击文章内任意 Markdown <img> 自动弹出站点灯箱
const { open: lightboxOpen, imgs: lightboxImgs, index: lightboxIndex, handleHtmlClick } = useHtmlImagePreview()
</script>

<template>
  <DocsShell>
    <div
      v-if="!entry"
      class="mx-auto max-w-2xl px-4 py-16 text-center space-y-4"
    >
      <h1 class="text-xl font-bold text-foreground">未找到该文档页面</h1>
      <p class="text-xs text-muted-foreground">对应文档路径不存在或已被移动。</p>
      <Button @click="router.push({ name: 'docs-index' })">返回文档中心</Button>
    </div>

    <div
      v-else
      class="mx-auto flex w-full max-w-[1120px] gap-8 px-4 py-6 sm:px-8 sm:py-8"
    >
      <!-- 主阅读区 -->
      <article class="flex-1 min-w-0 max-w-3xl">
        <!-- 面包屑 -->
        <nav
          aria-label="面包屑"
          class="mb-4 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"
        >
          <RouterLink
            :to="{ name: 'docs-index' }"
            class="hover:text-foreground transition-colors"
          >
            文档中心
          </RouterLink>
          <ChevronRight class="size-3.5 opacity-60" />
          <span>{{ category?.title }}</span>
          <ChevronRight class="size-3.5 opacity-60" />
          <span class="font-medium text-foreground">{{ entry.title }}</span>
        </nav>

        <!-- 文档头 -->
        <header class="mb-6 space-y-2.5 border-b border-border pb-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-sm bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">
                {{ category?.title }}
              </span>
              <span
                v-if="entry.badge"
                class="rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
              >
                {{ entry.badge }}
              </span>
            </div>

            <Button
              v-if="entry.manageRoute"
              variant="outline"
              size="xs"
              class="gap-1"
              @click="router.push({ name: entry.manageRoute })"
            >
              <span>{{ entry.manageLabel || '前往配置' }}</span>
              <ArrowUpRight class="size-3.5" />
            </Button>
          </div>

          <h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {{ entry.title }}
          </h1>
          <p
            v-if="entry.description"
            class="text-xs sm:text-sm leading-relaxed text-muted-foreground"
          >
            {{ entry.description }}
          </p>
        </header>

        <!-- Markdown 正文（异步懒加载） -->
        <div
          ref="contentRef"
          @click="handleHtmlClick"
        >
          <Suspense @resolve="collectHeadings">
            <component
              :is="articleComponent"
              :key="entry.slug"
            />
            <template #fallback>
              <div class="flex-center py-16">
                <Spin />
              </div>
            </template>
          </Suspense>
        </div>

        <Separator class="my-8" />

        <!-- 上一篇 / 下一篇 -->
        <nav
          aria-label="文档翻页"
          class="grid gap-3 sm:grid-cols-2"
        >
          <RouterLink
            v-if="neighbors.prev"
            :to="{ name: 'docs-article', params: { slug: neighbors.prev.slug.split('/') } }"
            class="card-interactive flex flex-col gap-1 rounded-lg border border-border bg-card p-3.5 text-left"
          >
            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <ArrowLeft class="size-3" />
              上一篇
            </span>
            <span class="text-xs font-semibold text-foreground">{{ neighbors.prev.title }}</span>
          </RouterLink>
          <div v-else />

          <RouterLink
            v-if="neighbors.next"
            :to="{ name: 'docs-article', params: { slug: neighbors.next.slug.split('/') } }"
            class="card-interactive flex flex-col items-end gap-1 rounded-lg border border-border bg-card p-3.5 text-right"
          >
            <span class="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              下一篇
              <ArrowRight class="size-3" />
            </span>
            <span class="text-xs font-semibold text-foreground">{{ neighbors.next.title }}</span>
          </RouterLink>
        </nav>
      </article>

      <!-- 右侧本页大纲 (TOC) -->
      <aside
        v-if="headings.length > 0"
        class="hidden xl:block w-[210px] shrink-0"
      >
        <div class="sticky top-20">
          <div class="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <ListTree class="size-3.5" />
            <span>本页目录</span>
          </div>
          <ScrollArea class="max-h-[calc(100vh-8rem)] [&_[data-reka-scroll-area-viewport]>div]:!block">
            <ul class="space-y-1 border-l border-border pl-3 text-xs">
              <li
                v-for="item in headings"
                :key="item.id"
                :class="item.level === 3 ? 'pl-2.5' : ''"
              >
                <a
                  :href="`#${item.id}`"
                  class="block truncate py-0.5 transition-colors duration-150"
                  :class="
                    activeHeadingId === item.id
                      ? 'font-semibold text-brand'
                      : 'text-muted-foreground hover:text-foreground'
                  "
                  @click.prevent="scrollToHeading(item.id)"
                >
                  {{ item.text }}
                </a>
              </li>
            </ul>
          </ScrollArea>
        </div>
      </aside>
    </div>

    <ImageLightbox
      v-model:open="lightboxOpen"
      :imgs="lightboxImgs"
      :index="lightboxIndex"
    />
  </DocsShell>
</template>
