<script setup lang="ts">
import { Chat24Regular } from '@vicons/fluent'
import { NAvatar, NEmpty, NIcon, NImage, NPagination, NSpin, NTime } from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { QAInfo, UserInfo } from '@/api/api-models'
import { AVATAR_URL } from '@/shared/config'

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
    class="question-feed"
    :class="{ 'is-embedded': embedded }"
  >
    <div class="feed-toolbar">
      <header class="feed-header">
        <div>
          <span class="feed-kicker">PUBLIC REPLIES</span>
          <h2>公开问答</h2>
          <p>
            <template v-if="!questions.length">还没有公开内容</template>
            <template v-else-if="selectedTag">话题「{{ selectedTag }}」· {{ displayCount }} 条</template>
            <template v-else>已公开 {{ questions.length }} 条留言</template>
          </p>
        </div>
        <span
          :key="filterPulse"
          class="reply-count"
          :class="{ 'is-pulsing': filterPulse > 0 }"
        >
          {{ displayCount }}
        </span>
      </header>

      <div
        v-if="availableTags.length > 1"
        ref="filterRail"
        class="feed-filters"
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

    <NSpin :show="isLoading">
      <Transition
        name="feed-swap"
        mode="out-in"
      >
        <div
          v-if="pagedQuestions.length"
          :key="listKey"
          class="thread-stage"
        >
          <TransitionGroup
            name="question-thread"
            tag="div"
            class="thread-list"
          >
            <article
              v-for="(item, index) in pagedQuestions"
              :key="item.id"
              class="question-thread"
              :style="{ '--thread-index': index }"
            >
              <div class="question-marker">
                <NIcon :component="Chat24Regular" />
              </div>
              <div class="thread-content">
                <div class="question-meta">
                  <NTime
                    :time="item.sendAt"
                    type="relative"
                  />
                  <span v-if="item.tag">{{ item.tag }}</span>
                </div>
                <p class="question-message">{{ item.question.message }}</p>
                <div
                  v-if="item.questionImages?.length"
                  class="thread-images"
                >
                  <NImage
                    v-for="image in item.questionImages"
                    :key="image.path"
                    :src="image.path"
                    object-fit="cover"
                  />
                </div>

                <div
                  v-if="item.answer"
                  class="answer-block"
                >
                  <div class="answer-author">
                    <NAvatar
                      round
                      :size="28"
                      :src="
                        userInfo?.faceUrl ||
                        userInfo?.streamerInfo?.faceUrl ||
                        (userInfo?.biliId ? `${AVATAR_URL + userInfo.biliId}?size=64` : undefined)
                      "
                      :img-props="{ referrerpolicy: 'no-referrer', alt: `${userInfo?.name || '主播'} 的头像` }"
                    />
                    <strong>{{ userInfo?.name || '主播' }}</strong>
                    <span>的回复</span>
                    <NTime
                      v-if="item.answer.createdAt"
                      :time="item.answer.createdAt"
                      type="relative"
                    />
                  </div>
                  <p>{{ item.answer.message }}</p>
                  <div
                    v-if="item.answerImages?.length"
                    class="thread-images"
                  >
                    <NImage
                      v-for="image in item.answerImages"
                      :key="image.path"
                      :src="image.path"
                      object-fit="cover"
                    />
                  </div>
                </div>
              </div>
            </article>
          </TransitionGroup>
        </div>

        <NEmpty
          v-else-if="!isLoading"
          :key="`empty-${listKey}`"
          class="feed-empty"
          :description="selectedTag ? '该话题暂无公开回复' : '暂无公开回复'"
        />
      </Transition>
    </NSpin>

    <NPagination
      v-if="filteredQuestions.length > pageSize"
      v-model:page="page"
      :item-count="filteredQuestions.length"
      :page-size="pageSize"
      class="feed-pagination"
    />
  </section>
</template>

<style scoped>
.question-feed {
  --feed-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --feed-muted: var(
    --vtsuru-block-fg-muted,
    var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted)))
  );
  --feed-subtle: var(--vtsuru-block-fg-subtle, var(--vtsuru-surface-fg-subtle, var(--vtsuru-fg-muted)));
  --feed-bg: var(
    --vtsuru-block-bg-muted,
    var(--user-page-theme-surface-bg, var(--vtsuru-page-card-bg, var(--vtsuru-bg-elevated)))
  );
  --feed-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --feed-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));
  min-width: 0;
  color: var(--feed-fg);
  container-type: inline-size;
}

.question-feed.is-embedded .question-thread {
  padding: 16px 0;
  background: transparent;
  border: 0;
  border-top: 1px solid var(--feed-border);
  border-radius: 0;
  box-shadow: none;
}

.question-feed.is-embedded .thread-list {
  gap: 0;
}

.question-feed.is-embedded .feed-toolbar {
  padding: 0 0 16px;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  backdrop-filter: none;
}

.feed-toolbar {
  margin-bottom: 12px;
  padding: 16px 18px;
  background: var(--feed-bg);
  border: var(--vtsuru-page-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

.feed-header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 20px;
  margin: 0;
}

.feed-header h2,
.feed-header p {
  margin: 0;
}

.feed-header h2 {
  font-size: 19px;
  line-height: 1.4;
}

.feed-header p {
  margin-top: 3px;
  color: var(--feed-muted);
  font-size: 12px;
}

.feed-kicker {
  display: block;
  margin-bottom: 2px;
  color: var(--feed-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
}

.reply-count {
  color: var(--feed-subtle);
  font-size: 28px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.reply-count.is-pulsing {
  animation: count-pop 0.42s cubic-bezier(0.22, 1.4, 0.36, 1);
}

.feed-filters {
  position: relative;
  display: flex;
  gap: 6px;
  padding-top: 13px;
  overflow-x: auto;
  scrollbar-width: none;
}

.feed-filters::-webkit-scrollbar {
  display: none;
}

.filter-indicator {
  position: absolute;
  top: 13px;
  left: 0;
  z-index: 0;
  height: 29px;
  background: var(--vtsuru-page-primary-soft);
  border: 1px solid var(--vtsuru-page-primary-border, var(--feed-accent));
  border-radius: 999px;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--feed-accent) 12%, transparent);
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
  color: var(--feed-muted);
  font: inherit;
  font-size: 12px;
  background: transparent;
  border: 1px solid var(--feed-border);
  border-radius: 999px;
  cursor: pointer;
  transition:
    color 0.18s ease,
    background-color 0.18s ease,
    border-color 0.18s ease,
    transform 0.18s ease;
}

.feed-filters button:hover {
  color: var(--vtsuru-page-primary-readable, var(--feed-accent));
  border-color: var(--vtsuru-page-primary-border, var(--feed-accent));
  transform: translateY(-1px);
}

.feed-filters button.is-active {
  color: var(--vtsuru-page-primary-readable, var(--feed-accent));
  background: transparent;
  border-color: transparent;
}

.thread-stage {
  min-width: 0;
}

.thread-list {
  display: grid;
  gap: 12px;
}

.question-thread {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 12px;
  min-width: 0;
  padding: 18px;
  background: var(--feed-bg);
  border: var(--vtsuru-page-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  animation: thread-enter 0.48s calc(var(--thread-index) * 55ms) cubic-bezier(0.22, 1, 0.36, 1) both;
}

.question-marker {
  display: grid;
  width: 32px;
  height: 32px;
  color: var(--vtsuru-page-primary-readable, var(--feed-accent));
  background: var(--vtsuru-page-primary-soft);
  border: 1px solid var(--vtsuru-page-primary-border, var(--feed-accent));
  border-radius: 50%;
  place-items: center;
}

.thread-content {
  min-width: 0;
}

.question-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--feed-subtle);
  font-size: 11px;
}

.question-meta > span {
  max-width: min(100%, 260px);
  padding: 2px 7px;
  overflow: hidden;
  color: var(--feed-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
  background: var(--vtsuru-page-card-bg-embedded, transparent);
  border: 1px solid var(--feed-border);
  border-radius: 999px;
}

.question-message,
.answer-block p {
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.question-message {
  margin-top: 9px;
  font-size: 15px;
  line-height: 1.7;
}

.answer-block {
  position: relative;
  margin-top: 16px;
  padding: 14px 16px;
  background: var(--vtsuru-page-card-bg-embedded, color-mix(in srgb, var(--feed-bg) 82%, transparent));
  border-left: 3px solid var(--feed-accent);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.answer-author {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  color: var(--feed-muted);
  font-size: 11px;
}

.answer-author strong {
  overflow: hidden;
  color: var(--vtsuru-page-primary-readable, var(--feed-accent));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.answer-author .n-time {
  margin-left: auto;
  color: var(--feed-subtle);
}

.answer-block p {
  margin-top: 9px;
  font-size: 14px;
  line-height: 1.65;
}

.thread-images {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 7px;
  margin-top: 11px;
}

.thread-images :deep(.n-image) {
  width: 100%;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--vtsuru-page-card-bg-embedded, var(--feed-bg));
  border: 1px solid var(--feed-border);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.thread-images :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feed-empty {
  padding: 42px 16px;
  background: var(--feed-bg);
  border: var(--vtsuru-page-border);
  border-radius: var(--vtsuru-page-radius, 8px);
}

.feed-pagination {
  justify-content: center;
  margin-top: 18px;
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

@container (max-width: 480px) {
  .question-thread {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 14px;
  }

  .question-marker {
    width: 28px;
    height: 28px;
  }

  .answer-block {
    padding: 12px;
  }

  .answer-author {
    flex-wrap: wrap;
  }

  .answer-author .n-time {
    width: 100%;
    margin-left: 34px;
  }

  .thread-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
    color: var(--feed-accent);
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
