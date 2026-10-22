<script setup lang="ts">
import { Chat24Regular } from '@vicons/fluent'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { QAInfo, UserInfo } from '@/api/api-models'
import { AVATAR_URL } from '@/shared/config'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Empty } from '@/shared/ui/empty'
import { Pagination } from '@/shared/ui/pagination'
import { Spin } from '@/shared/ui/spin'

function formatRelativeTime(val: number | string | Date | undefined | null) {
  if (!val) return ''
  try {
    const d = typeof val === 'number' ? new Date(val > 1e11 ? val : val * 1000) : new Date(val)
    return formatDistanceToNow(d, { addSuffix: true, locale: zhCN })
  } catch {
    return String(val)
  }
}

const props = defineProps<{
  questions: QAInfo[]
  isLoading: boolean
  userInfo?: UserInfo
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

const availableTags = computed(() => [...new Set(props.questions.map((item) => item.tag).filter(Boolean) as string[])])
const filteredQuestions = computed(() =>
  selectedTag.value ? props.questions.filter((item) => item.tag === selectedTag.value) : props.questions,
)
const pagedQuestions = computed(() => filteredQuestions.value.slice((page.value - 1) * pageSize, page.value * pageSize))
const displayCount = computed(() => filteredQuestions.value.length)
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
    const maxPage = Math.max(1, Math.ceil(filteredQuestions.value.length / pageSize))
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
            <template v-else>已公开 {{ questions.length }} 条留言</template>
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
        <button
          type="button"
          :class="{ 'is-active': selectedTag === null }"
          @click="selectTag(null)"
        >
          全部
        </button>
        <button
          v-for="tag in availableTags"
          :key="tag"
          type="button"
          :class="{ 'is-active': selectedTag === tag }"
          @click="selectTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <Spin :show="isLoading">
      <Transition
        name="feed-swap"
        mode="out-in"
      >
        <div
          v-if="pagedQuestions.length"
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
              v-for="(item, index) in pagedQuestions"
              :key="item.id"
              class="question-thread grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 bg-card border border-border rounded-lg shadow-sm backdrop-blur-sm @[max-width:480px]:grid-cols-[minmax(0,1fr)] @[max-width:480px]:p-3.5"
              :class="{ '!p-4 !px-0 !bg-transparent !border-0 !border-t !border-border !rounded-none !shadow-none': embedded }"
              :style="{ '--thread-index': index }"
            >
              <div class="size-8 shrink-0 rounded-full bg-primary/10 border border-primary/20 text-primary flex-center @[max-width:480px]:size-7">
                <Chat24Regular class="size-4" />
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-xs text-muted-foreground/70">
                  <span class="max-w-[260px] truncate px-2 py-0.5 rounded-full border border-border bg-secondary/50 text-muted-foreground">{{ formatRelativeTime(item.sendAt) }}</span>
                  <span v-if="item.tag" class="max-w-[260px] truncate px-2 py-0.5 rounded-full border border-border bg-secondary/50 text-muted-foreground">{{ item.tag }}</span>
                </div>
                <p class="m-0 mt-2 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{{ item.question.message }}</p>
                <div
                  v-if="item.questionImages?.length"
                  class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 mt-2.5 @[max-width:480px]:grid-cols-2"
                >
                  <img
                    v-for="image in item.questionImages"
                    :key="image.path"
                    :src="image.path"
                    alt=""
                    class="w-full aspect-[4/3] object-cover rounded-md border border-border bg-secondary/50 cursor-pointer"
                    loading="lazy"
                  />
                </div>

                <div
                  v-if="item.answer"
                  class="relative mt-4 p-3.5 bg-secondary/40 border-l-3 border-primary rounded-md @[max-width:480px]:p-3"
                >
                  <div class="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground @[max-width:480px]:flex-wrap">
                    <Avatar class="size-7 rounded-full">
                      <AvatarImage
                        :src="
                          userInfo?.faceUrl ||
                          userInfo?.streamerInfo?.faceUrl ||
                          (userInfo?.biliId ? `${AVATAR_URL + userInfo.biliId}?size=64` : undefined)
                        "
                        referrerpolicy="no-referrer"
                        :alt="`${userInfo?.name || '主播'} 的头像`"
                      />
                      <AvatarFallback>{{ (userInfo?.name || '主')[0] }}</AvatarFallback>
                    </Avatar>
                    <strong class="truncate font-semibold text-primary">{{ userInfo?.name || '主播' }}</strong>
                    <span>的回复</span>
                    <span
                      v-if="item.answer.createdAt"
                      class="text-xs text-muted-foreground/70 ml-auto @[max-width:480px]:w-full @[max-width:480px]:ml-8"
                    >
                      {{ formatRelativeTime(item.answer.createdAt) }}
                    </span>
                  </div>
                  <p class="m-0 mt-2 text-sm leading-relaxed break-words whitespace-pre-wrap">{{ item.answer.message }}</p>
                  <div
                    v-if="item.answerImages?.length"
                    class="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2 mt-2.5 @[max-width:480px]:grid-cols-2"
                  >
                    <img
                      v-for="image in item.answerImages"
                      :key="image.path"
                      :src="image.path"
                      alt=""
                      class="w-full aspect-[4/3] object-cover rounded-md border border-border bg-secondary/50 cursor-pointer"
                      loading="lazy"
                    />
                  </div>
                </div>
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
      v-if="filteredQuestions.length > pageSize"
      v-model:page="page"
      :total="filteredQuestions.length"
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
