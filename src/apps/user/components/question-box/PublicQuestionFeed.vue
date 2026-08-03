<script setup lang="ts">
import { Chat24Regular } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'

import type { QAInfo, UserInfo } from '@/api/api-models'
import PublicTime from '@/apps/user-page/PublicTime.vue'
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
const availableTags = computed(() => [...new Set(props.questions.map((item) => item.tag).filter(Boolean) as string[])])
const filteredQuestions = computed(() =>
  selectedTag.value ? props.questions.filter((item) => item.tag === selectedTag.value) : props.questions,
)
const pagedQuestions = computed(() => filteredQuestions.value.slice((page.value - 1) * pageSize, page.value * pageSize))

watch(selectedTag, () => (page.value = 1))
watch(
  () => props.questions.length,
  () => {
    const maxPage = Math.max(1, Math.ceil(filteredQuestions.value.length / pageSize))
    if (page.value > maxPage) page.value = maxPage
  },
)
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
          <p>{{ questions.length ? `已公开 ${questions.length} 条留言` : '还没有公开内容' }}</p>
        </div>
        <span class="reply-count">{{ questions.length }}</span>
      </header>

      <div
        v-if="availableTags.length > 1"
        class="feed-filters"
        aria-label="按话题筛选"
      >
        <button
          type="button"
          :class="{ 'is-active': selectedTag === null }"
          @click="selectedTag = null"
        >
          全部
        </button>
        <button
          v-for="tag in availableTags"
          :key="tag"
          type="button"
          :class="{ 'is-active': selectedTag === tag }"
          @click="selectedTag = tag"
        >
          {{ tag }}
        </button>
      </div>
    </div>

    <div :aria-busy="isLoading">
      <TransitionGroup
        v-if="pagedQuestions.length"
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
            <component :is="Chat24Regular" />
          </div>
          <div class="thread-content">
            <div class="question-meta">
              <PublicTime
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
              <img
                v-for="image in item.questionImages"
                :key="image.path"
                :src="image.path"
                alt="提问附图"
                loading="lazy"
              />
            </div>

            <div
              v-if="item.answer"
              class="answer-block"
            >
              <div class="answer-author">
                <UAvatar
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
                <PublicTime
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
                <img
                  v-for="image in item.answerImages"
                  :key="image.path"
                  :src="image.path"
                  alt="回复附图"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </article>
      </TransitionGroup>

      <UEmpty
        v-else-if="!isLoading"
        class="public-empty feed-empty"
        :description="selectedTag ? '该话题暂无公开回复' : '暂无公开回复'"
      />
    </div>

    <UPagination
      v-if="filteredQuestions.length > pageSize"
      v-model:page="page"
      :total="filteredQuestions.length"
      :items-per-page="pageSize"
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

.feed-filters {
  display: flex;
  gap: 6px;
  padding-top: 13px;
  overflow-x: auto;
  scrollbar-width: none;
}

.feed-filters::-webkit-scrollbar {
  display: none;
}

.feed-filters button {
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
    color 0.16s ease,
    background-color 0.16s ease,
    border-color 0.16s ease;
}

.feed-filters button:hover,
.feed-filters button.is-active {
  color: var(--vtsuru-page-primary-readable, var(--feed-accent));
  background: var(--vtsuru-page-primary-soft);
  border-color: var(--vtsuru-page-primary-border, var(--feed-accent));
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
  animation: thread-enter 0.38s calc(var(--thread-index) * 45ms) ease both;
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

.answer-author time {
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

.thread-images :deep(img) {
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

.question-thread-enter-active,
.question-thread-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.question-thread-enter-from,
.question-thread-leave-to {
  opacity: 0;
  transform: translateY(8px);
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

  .answer-author time {
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
    transform: translateY(10px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .question-thread {
    animation: none;
  }

  .question-thread-enter-active,
  .question-thread-leave-active,
  .feed-filters button {
    transition: none;
  }
}
</style>
