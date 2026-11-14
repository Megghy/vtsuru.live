<script setup lang="ts">
import Chat24Regular from '@vicons/fluent/es/Chat24Regular'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { ResponseQAInfo, ResponseUserInfo } from '@/api/generated/model'
import PublicQuestionEntry from '@/apps/user/components/question-box/PublicQuestionEntry.vue'
import { groupQuestionThreads } from '@/shared/questionThread'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Spin } from '@/shared/ui/spin'

const props = defineProps<{
  questions: ResponseQAInfo[]
  isLoading: boolean
  userInfo?: ResponseUserInfo
  embedded?: boolean
}>()

const page = ref(1)
const pageSize = 8
const selectedTag = ref<string | null>(null)
const filterPulse = ref(0)
const listPhase = ref(0)
const filterRail = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ width: '0px', transform: 'translateX(0px)', opacity: '0' })
let indicatorFrame = 0

const threads = computed(() => groupQuestionThreads(props.questions))
const availableTags = computed(() => [...new Set(threads.value.map((t) => t.root.tag).filter(Boolean) as string[])])
const filteredThreads = computed(() =>
  selectedTag.value ? threads.value.filter((t) => t.root.tag === selectedTag.value) : threads.value,
)
const pagedThreads = computed(() => filteredThreads.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const displayCount = computed(() => filteredThreads.value.length)
const listKey = computed(() => `${selectedTag.value ?? 'all'}:${page.value}:${listPhase.value}`)

function selectTag(tag: string | null) {
  if (selectedTag.value === tag) return
  selectedTag.value = tag
  filterPulse.value += 1
  listPhase.value += 1
}

function updateIndicator() {
  const rail = filterRail.value
  if (!rail) {
    indicatorStyle.value = { width: '0px', transform: 'translateX(0px)', opacity: '0' }
    return
  }
  const active = rail.querySelector<HTMLElement>('.is-active')
  if (!active) {
    indicatorStyle.value = { ...indicatorStyle.value, opacity: '0' }
    return
  }
  indicatorStyle.value = {
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

watch(selectedTag, () => {
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
    >
      <header class="flex items-end justify-between gap-5 m-0">
        <div>
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
          class="reply-count text-2xl tabular-nums leading-none text-muted-foreground/60"
          :class="{ 'is-pulsing': filterPulse > 0 }"
        >
          {{ displayCount }}
        </span>
      </header>

      <div
        v-if="availableTags.length > 1"
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
              :style="{ '--thread-index': index }"
            >
              <div
                class="size-8 shrink-0 rounded-full bg-primary/10 border border-primary/20 text-primary flex-center @[max-width:480px]:size-7"
              >
                <Chat24Regular class="size-4" />
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
          :description="selectedTag ? '该话题暂无公开回复' : '暂无公开回复'"
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
  top: 13px;
  left: 0;
  z-index: 0;
  height: 29px;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  border: 1px solid var(--primary);
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 12%, transparent);
  pointer-events: none;
  transition:
    width 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.2s ease;
}

.feed-filters button {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  min-height: 29px;
  padding: 3px 10px;
  color: var(--muted-foreground);
  font: inherit;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
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
  animation: thread-enter 0.48s calc(var(--thread-index) * 55ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.feed-swap-enter-active,
.feed-swap-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.34s cubic-bezier(0.22, 1, 0.36, 1),
    filter 0.28s ease;
}

.feed-swap-enter-from {
  opacity: 0;
  filter: blur(4px);
  transform: translateY(18px) scale(0.985);
}

.feed-swap-leave-to {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(-12px) scale(0.98);
}

.question-thread-enter-active,
.question-thread-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

.question-thread-enter-from,
.question-thread-leave-to {
  opacity: 0;
  transform: translateY(14px) scale(0.98);
}

.question-thread-move {
  transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
}

@keyframes thread-enter {
  from {
    opacity: 0;
    transform: translateY(16px) scale(0.97);
  }
}

@keyframes count-pop {
  0% {
    transform: scale(0.86);
    color: var(--primary);
  }
  55% {
    transform: scale(1.12);
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

  .feed-swap-enter-from,
  .feed-swap-leave-to,
  .question-thread-enter-from,
  .question-thread-leave-to {
    filter: none;
    transform: none;
  }
}
</style>
