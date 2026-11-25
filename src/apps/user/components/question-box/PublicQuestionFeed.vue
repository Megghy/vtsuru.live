<script setup lang="ts">
import { MessageSquare, Search, X } from 'lucide-vue-next'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { ResponseQAInfo, ResponseUserInfo } from '@/api/generated/model'
import PublicQuestionEntry from '@/apps/user/components/question-box/PublicQuestionEntry.vue'
import { groupQuestionThreads } from '@/shared/questionThread'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'

type PublicSortMode = 'default' | 'newest' | 'hottest'

const props = defineProps<{
  questions: ResponseQAInfo[]
  isLoading: boolean
  userInfo?: ResponseUserInfo
  embedded?: boolean
}>()

const page = ref(1)
const pageSize = 8
const selectedTag = ref<string | null>(null)
const searchKeyword = ref('')
const sortMode = ref<PublicSortMode>('default')
const filterPulse = ref(0)
const listPhase = ref(0)
const filterRail = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ top: '0px', height: '0px', width: '0px', transform: 'translateX(0px)', opacity: '0' })
let indicatorFrame = 0

const threads = computed(() => groupQuestionThreads(props.questions))
const availableTags = computed(() => [...new Set(threads.value.map((t) => t.root.tag).filter(Boolean) as string[])])

const filteredThreads = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  const list = threads.value.filter((t) => {
    if (selectedTag.value && t.root.tag !== selectedTag.value) return false
    if (!keyword) return true
    const entries = [t.root, ...t.followUps]
    return entries.some(
      (e) =>
        e.question?.message?.toLowerCase().includes(keyword) ||
        e.answer?.message?.toLowerCase().includes(keyword) ||
        e.tag?.toLowerCase().includes(keyword),
    )
  })

  if (sortMode.value === 'newest') {
    return list.toSorted((a, b) => b.root.sendAt - a.root.sendAt)
  }
  if (sortMode.value === 'hottest') {
    return list.toSorted((a, b) => {
      const diff = (b.root.likeCount ?? 0) - (a.root.likeCount ?? 0)
      return diff !== 0 ? diff : b.root.sendAt - a.root.sendAt
    })
  }
  return list.toSorted((a, b) => {
    if (Boolean(a.root.isPinned) !== Boolean(b.root.isPinned)) return a.root.isPinned ? -1 : 1
    return b.root.sendAt - a.root.sendAt
  })
})

const pagedThreads = computed(() => filteredThreads.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const displayCount = computed(() => filteredThreads.value.length)
const listKey = computed(() => `${selectedTag.value ?? 'all'}:${sortMode.value}:${page.value}:${listPhase.value}`)

function selectTag(tag: string | null) {
  if (selectedTag.value === tag) return
  selectedTag.value = tag
  filterPulse.value += 1
  listPhase.value += 1
}

function updateIndicator() {
  const rail = filterRail.value
  if (!rail) {
    indicatorStyle.value = { top: '0px', height: '0px', width: '0px', transform: 'translateX(0px)', opacity: '0' }
    return
  }
  const active = rail.querySelector<HTMLElement>('.is-active')
  if (!active) {
    indicatorStyle.value = { ...indicatorStyle.value, opacity: '0' }
    return
  }
  indicatorStyle.value = {
    top: `${active.offsetTop}px`,
    height: `${active.offsetHeight}px`,
    width: `${active.offsetWidth}px`,
    transform: `translateX(${active.offsetLeft - rail.scrollLeft}px)`,
    opacity: '1',
  }
}

function scheduleIndicator() {
  cancelAnimationFrame(indicatorFrame)
  indicatorFrame = requestAnimationFrame(() => {
    void nextTick(updateIndicator)
  })
}

watch([selectedTag, searchKeyword, sortMode], () => {
  page.value = 1
  scheduleIndicator()
})
watch(
  () => props.questions.length,
  () => {
    const maxPage = Math.max(1, Math.ceil(filteredThreads.value.length / pageSize))
    if (page.value > maxPage) page.value = maxPage
    scheduleIndicator()
  },
)
watch(availableTags, scheduleIndicator, { flush: 'post' })
watch(page, scheduleIndicator)

onBeforeUnmount(() => cancelAnimationFrame(indicatorFrame))
</script>

<template>
  <section
    class="min-w-0 text-card-foreground @container"
    :class="{ 'is-embedded': embedded }"
  >
    <div
      class="mb-3 p-4 bg-card border border-border rounded-lg shadow-sm backdrop-blur-sm transition-all"
      :class="{ '!p-0 !bg-transparent !border-0 !shadow-none !backdrop-blur-none': embedded }"
      :data-site-surface="embedded ? undefined : 'card'"
    >
      <header class="flex items-end justify-between gap-4 m-0">
        <div class="min-w-0">
          <span class="block mb-0.5 text-[10px] font-bold text-primary tracking-normal">PUBLIC REPLIES</span>
          <h2 class="m-0 text-lg font-semibold leading-snug">公开问答</h2>
          <p class="m-0 mt-0.5 text-xs text-muted-foreground">
            <template v-if="!questions.length">还没有公开内容</template>
            <template v-else-if="selectedTag">话题「{{ selectedTag }}」· {{ displayCount }} 条</template>
            <template v-else>已公开 {{ threads.length }} 条留言</template>
          </p>
        </div>
        <span
          :key="filterPulse"
          class="reply-count text-2xl tabular-nums leading-none text-muted-foreground/60 shrink-0"
          :class="{ 'is-pulsing': filterPulse > 0 }"
        >
          {{ displayCount }}
        </span>
      </header>

      <!-- 搜索与排序栏 -->
      <div
        v-if="questions.length > 0"
        class="flex items-center gap-2 mt-3 flex-wrap"
      >
        <div class="relative flex-1 min-w-[160px]">
          <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchKeyword"
            placeholder="搜索公开问答..."
            class="pl-8 pr-7"
          />
          <button
            v-if="searchKeyword"
            type="button"
            aria-label="清除搜索"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            @click="searchKeyword = ''"
          >
            <X class="size-3.5" />
          </button>
        </div>

        <Select
          :model-value="sortMode"
          @update:model-value="sortMode = $event as PublicSortMode"
        >
          <SelectTrigger class="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">置顶优先</SelectItem>
            <SelectItem value="newest">最新发布</SelectItem>
            <SelectItem value="hottest">最多同问</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- 话题筛选条 -->
      <div
        v-if="availableTags.length > 0"
        ref="filterRail"
        class="feed-filters relative flex gap-1.5 pt-3 overflow-x-auto no-scrollbar"
        aria-label="按话题筛选"
        @scroll.passive="scheduleIndicator"
      >
        <span
          class="filter-indicator"
          :style="indicatorStyle"
        />
        <Button
          variant="outline"
          size="xs"
          class="rounded-full font-normal"
          :class="{ 'is-active': selectedTag === null }"
          @click="selectTag(null)"
        >
          全部
        </Button>
        <Button
          v-for="tag in availableTags"
          :key="tag"
          variant="outline"
          size="xs"
          class="rounded-full font-normal"
          :class="{ 'is-active': selectedTag === tag }"
          @click="selectTag(tag)"
        >
          {{ tag }}
        </Button>
      </div>
    </div>

    <Spin :show="isLoading">
      <Transition
        name="feed-swap"
        mode="out-in"
      >
        <div
          v-if="pagedThreads.length"
          :key="listKey"
          class="min-w-0"
        >
          <TransitionGroup
            name="question-thread"
            tag="div"
            class="grid gap-3"
            :class="{ '!gap-0': embedded }"
          >
            <article
              v-for="(thread, index) in pagedThreads"
              :key="thread.root.id"
              class="question-thread grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 bg-card border border-border rounded-lg shadow-sm backdrop-blur-sm @[max-width:480px]:grid-cols-[minmax(0,1fr)] @[max-width:480px]:p-3.5"
              :class="{
                '!p-4 !px-0 !bg-transparent !border-0 !border-t !border-border !rounded-none !shadow-none': embedded,
              }"
              :data-site-surface="embedded ? undefined : 'card'"
              :style="{ '--thread-index': index }"
            >
              <div
                class="size-8 shrink-0 rounded-full bg-primary/10 border border-primary/20 text-primary flex-center @[max-width:480px]:size-7"
              >
                <MessageSquare class="size-4" />
              </div>
              <div class="min-w-0">
                <PublicQuestionEntry
                  :item="thread.root"
                  :user-info="userInfo"
                />
                <ol
                  v-if="thread.followUps.length"
                  class="m-0 mt-4 p-0 pl-3.5 list-none space-y-4 border-l-2 border-border"
                >
                  <li
                    v-for="(followUp, followIdx) in thread.followUps"
                    :key="followUp.id"
                  >
                    <PublicQuestionEntry
                      :item="followUp"
                      :user-info="userInfo"
                      :label="`追问 ${followIdx + 1}`"
                    />
                  </li>
                </ol>
              </div>
            </article>
          </TransitionGroup>
        </div>

        <Empty
          v-else-if="!isLoading"
          :key="`empty-${listKey}`"
          class="p-10 bg-card border border-border rounded-lg"
          :description="searchKeyword ? '未找到匹配的公开问答' : selectedTag ? '该话题暂无公开回复' : '暂无公开回复'"
        />
      </Transition>
    </Spin>

    <Pagination
      v-if="filteredThreads.length > pageSize"
      v-model:page="page"
      :total="filteredThreads.length"
      :page-size="pageSize"
      class="justify-center mt-4.5"
    />
  </section>
</template>

<style scoped>
.reply-count.is-pulsing {
  animation: count-pop 0.42s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.filter-indicator {
  position: absolute;
  left: 0;
  z-index: 0;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  border: 1px solid var(--primary);
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
  pointer-events: none;
  transition:
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.18s ease;
}

.feed-filters button {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  color: var(--muted-foreground);
  background: transparent;
  border-color: var(--border);
  transition:
    color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.feed-filters button:hover {
  color: var(--primary);
  border-color: var(--primary);
  transform: translateY(-1px);
}

.feed-filters button.is-active {
  color: var(--primary);
  background: transparent;
  border-color: transparent;
}

.question-thread {
  animation: thread-enter 0.32s calc(var(--thread-index) * 35ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.feed-swap-enter-active,
.feed-swap-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.feed-swap-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.feed-swap-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

.question-thread-enter-active,
.question-thread-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.question-thread-enter-from,
.question-thread-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.question-thread-move {
  transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes thread-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}

@keyframes count-pop {
  0% {
    transform: scale(0.88);
    color: var(--primary);
  }
  55% {
    transform: scale(1.1);
  }
  100% {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .question-thread,
  .reply-count.is-pulsing {
    animation: none;
  }

  .filter-indicator,
  .feed-filters button,
  .feed-swap-enter-active,
  .feed-swap-leave-active,
  .question-thread-enter-active,
  .question-thread-leave-active,
  .question-thread-move {
    transition: none;
  }
}
</style>
