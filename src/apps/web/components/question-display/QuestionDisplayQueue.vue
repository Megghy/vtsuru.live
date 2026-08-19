<script setup lang="ts">
import { ArrowSync24Regular, Checkmark24Regular, Dismiss24Regular, Eye24Regular, Search24Regular } from '@vicons/fluent'
import { Heart, HeartOutline } from '@vicons/ionicons5'
import { NButton, NCheckbox, NEmpty, NIcon, NInput, NScrollbar, NSelect, NTag, NTime, NTooltip } from 'naive-ui'
import { computed } from 'vue'

import type { QAInfo } from '@/api/api-models'
import { questionSenderLabel } from '@/shared/questionDisplay'

const props = defineProps<{
  questions: QAInfo[]
  currentId?: number
  tags: string[]
  loading: boolean
}>()

const emit = defineEmits<{
  refresh: []
  show: [question: QAInfo]
  clear: []
  read: [question: QAInfo]
  favorite: [question: QAInfo, value: boolean]
}>()

const search = defineModel<string>('search', { required: true })
const tag = defineModel<string | undefined>('tag', { required: true })
const onlyUnread = defineModel<boolean>('onlyUnread', { required: true })
const onlyFavorite = defineModel<boolean>('onlyFavorite', { required: true })

const tagOptions = computed(() => props.tags.map((value) => ({ label: value, value })))
</script>

<template>
  <section class="queue-panel">
    <header class="queue-heading">
      <div>
        <h1>提问队列</h1>
        <span>{{ questions.length }} 条</span>
      </div>
      <NTooltip>
        <template #trigger>
          <NButton
            circle
            secondary
            :loading="loading"
            aria-label="刷新提问队列"
            @click="emit('refresh')"
          >
            <template #icon><NIcon :component="ArrowSync24Regular" /></template>
          </NButton>
        </template>
        刷新提问队列
      </NTooltip>
    </header>

    <div class="queue-filters">
      <NInput
        v-model:value="search"
        clearable
        placeholder="搜索提问内容"
      >
        <template #prefix><NIcon :component="Search24Regular" /></template>
      </NInput>
      <NSelect
        v-model:value="tag"
        :options="tagOptions"
        clearable
        filterable
        placeholder="全部话题"
      />
      <div class="filter-flags">
        <NCheckbox v-model:checked="onlyUnread">仅未读</NCheckbox>
        <NCheckbox v-model:checked="onlyFavorite">仅收藏</NCheckbox>
      </div>
    </div>

    <NScrollbar class="queue-scroll">
      <div
        v-if="questions.length"
        class="queue-list"
      >
        <article
          v-for="item in questions"
          :key="item.id"
          class="queue-item"
          :class="{ 'is-current': item.id === currentId, 'is-unread': !item.isReaded }"
        >
          <button
            type="button"
            class="question-main"
            @click="item.id === currentId ? emit('clear') : emit('show', item)"
          >
            <span class="question-meta">
              <strong>{{ questionSenderLabel(item) }}</strong>
              <NTime
                :time="item.sendAt"
                type="relative"
              />
            </span>
            <span class="question-text">{{ item.question.message }}</span>
            <span class="question-flags">
              <NTag
                v-if="item.id === currentId"
                size="tiny"
                type="success"
                :bordered="false"
              >
                正在展示
              </NTag>
              <NTag
                v-else-if="!item.isReaded"
                size="tiny"
                type="warning"
                :bordered="false"
              >
                未读
              </NTag>
              <NTag
                v-if="item.tag"
                size="tiny"
                :bordered="false"
              >
                {{ item.tag }}
              </NTag>
              <span v-if="item.questionImages?.length">{{ item.questionImages.length }} 张图片</span>
            </span>
          </button>

          <div class="question-actions">
            <NTooltip>
              <template #trigger>
                <NButton
                  quaternary
                  circle
                  size="small"
                  :type="item.id === currentId ? 'error' : 'primary'"
                  :aria-label="item.id === currentId ? '清空当前展示' : '展示这条提问'"
                  @click="item.id === currentId ? emit('clear') : emit('show', item)"
                >
                  <template #icon>
                    <NIcon :component="item.id === currentId ? Dismiss24Regular : Eye24Regular" />
                  </template>
                </NButton>
              </template>
              {{ item.id === currentId ? '清空当前展示' : '展示这条提问' }}
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  quaternary
                  circle
                  size="small"
                  :disabled="item.isReaded"
                  aria-label="标记为已读"
                  @click="emit('read', item)"
                >
                  <template #icon><NIcon :component="Checkmark24Regular" /></template>
                </NButton>
              </template>
              标记为已读
            </NTooltip>
            <NTooltip>
              <template #trigger>
                <NButton
                  quaternary
                  circle
                  size="small"
                  :type="item.isFavorite ? 'error' : 'default'"
                  :aria-label="item.isFavorite ? '取消收藏' : '收藏'"
                  @click="emit('favorite', item, !item.isFavorite)"
                >
                  <template #icon><NIcon :component="item.isFavorite ? Heart : HeartOutline" /></template>
                </NButton>
              </template>
              {{ item.isFavorite ? '取消收藏' : '收藏' }}
            </NTooltip>
          </div>
        </article>
      </div>
      <NEmpty
        v-else
        class="queue-empty"
        size="small"
      >
        没有符合条件的提问
      </NEmpty>
    </NScrollbar>
  </section>
</template>

<style scoped>
.queue-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  background: var(--vtsuru-bg-elevated);
  border-right: 1px solid var(--vtsuru-border);
}

.queue-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
  padding: 16px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.queue-heading h1,
.queue-heading span {
  margin: 0;
}

.queue-heading h1 {
  color: var(--vtsuru-fg);
  font-size: 16px;
  line-height: 1.35;
}

.queue-heading span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.queue-filters {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.filter-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.queue-scroll {
  min-height: 0;
}

.queue-list {
  display: grid;
}

.queue-item {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  border-bottom: 1px solid var(--vtsuru-border);
  transition: background-color 0.18s ease;
}

.queue-item:hover {
  background: var(--vtsuru-bg-muted);
}

.queue-item.is-current {
  background: var(--vtsuru-brand-tint);
  box-shadow: inset 3px 0 0 var(--vtsuru-brand);
}

.question-main {
  min-width: 0;
  padding: 13px 8px 13px 16px;
  color: inherit;
  text-align: left;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.question-meta,
.question-flags {
  display: flex;
  align-items: center;
  min-width: 0;
}

.question-meta {
  justify-content: space-between;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.question-meta strong {
  overflow: hidden;
  color: var(--vtsuru-fg);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-text {
  display: -webkit-box;
  margin-top: 6px;
  overflow: hidden;
  color: var(--vtsuru-fg);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.question-flags {
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
}

.question-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 8px 8px 8px 0;
}

.queue-empty {
  padding: 64px 16px;
}

@media (max-width: 760px) {
  .queue-panel {
    border-right: 0;
  }
}
</style>
