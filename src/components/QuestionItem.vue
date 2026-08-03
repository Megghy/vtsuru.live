<script setup lang="ts">
import { format, formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ref } from 'vue'

import type { QAInfo } from '@/api/api-models'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = defineProps<{
  item: QAInfo
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{ select: [id: number] }>()
const questionBox = useQuestionBox()
const isViolation = props.item.reviewResult?.isApproved === false
const showContent = ref(!isViolation)

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'var(--vtsuru-bg-muted)'
  const clamped = Math.max(0, Math.min(100, score))
  return `hsl(${120 * (clamped / 100)}, 50%, 45%)`
}

function formatRelativeTime(timestamp: number) {
  return formatDistanceToNow(timestamp, { addSuffix: true, locale: zhCN })
}

function formatTime(timestamp: number) {
  return format(timestamp, 'yyyy-MM-dd HH:mm:ss')
}
</script>

<template>
  <UCard
    v-if="item"
    class="question-item"
    :class="{ 'question-item--unread': !item.isReaded }"
  >
    <template #header>
      <div class="question-item__header">
        <div class="question-item__meta">
          <UCheckbox
            v-if="selectable"
            :model-value="selected"
            @update:model-value="emit('select', item.id)"
            @click.stop
          />
          <UBadge
            v-if="!item.isReaded"
            color="warning"
            variant="subtle"
            size="xs"
            label="未读"
          />
          <span :class="{ 'question-item__sender--muted': item.isAnonymous }">
            {{ item.isAnonymous ? item.anonymousName || '匿名用户' : item.sender?.name }}
          </span>
          <UBadge
            v-if="item.isSenderRegisted"
            color="info"
            variant="subtle"
            size="xs"
            label="已注册"
          />
          <UBadge
            v-if="item.isPublic"
            color="success"
            variant="subtle"
            size="xs"
            label="公开"
          />
          <UTooltip
            v-if="item.tag"
            text="标签/话题"
          >
            <UBadge
              color="success"
              variant="soft"
              size="xs"
              :label="item.tag"
            />
          </UTooltip>
          <UTooltip :text="formatTime(item.sendAt)">
            <time class="question-item__time">{{ formatRelativeTime(item.sendAt) }}</time>
          </UTooltip>
          <template v-if="item.reviewResult?.violationType?.length">
            <UBadge
              v-for="violationType in item.reviewResult.violationType"
              :key="violationType"
              color="error"
              variant="subtle"
              size="xs"
              :label="questionBox.getViolationString(violationType)"
            />
          </template>
          <UTooltip
            v-if="item.reviewResult?.saftyScore !== undefined"
            text="审查得分，满分100，越低越安全"
          >
            <span
              class="question-item__score"
              :style="{ background: getScoreColor(item.reviewResult.saftyScore) }"
            >
              得分: {{ item.reviewResult.saftyScore }}
            </span>
          </UTooltip>
        </div>
        <slot
          name="header-extra"
          :item="item"
        />
      </div>
    </template>

    <div
      v-if="item.questionImages?.length"
      class="question-item__images"
    >
      <a
        v-for="(image, index) in item.questionImages"
        :key="index"
        :href="image.path"
        target="_blank"
        rel="noreferrer"
      >
        <img
          :src="image.path"
          alt="提问图片"
          loading="lazy"
        />
      </a>
    </div>

    <p
      class="question-item__message"
      :class="{ 'question-item__message--hidden': isViolation && !showContent }"
      @click="isViolation && (showContent = !showContent)"
    >
      {{ item.question?.message }}
    </p>

    <template v-if="item.answer">
      <USeparator />
      <p class="question-item__answer">{{ item.answer.message }}</p>
    </template>

    <template #footer>
      <slot
        name="footer"
        :item="item"
      />
    </template>
  </UCard>
</template>

<style scoped>
.question-item--unread {
  box-shadow: inset 3px 0 var(--vtsuru-brand);
}

.question-item__header,
.question-item__meta,
.question-item__images {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.question-item__header {
  justify-content: space-between;
}

.question-item__sender--muted,
.question-item__time,
.question-item__answer {
  color: var(--vtsuru-fg-muted);
}

.question-item__time {
  font-size: 12px;
}

.question-item__score {
  padding: 2px 6px;
  border-radius: var(--vtsuru-radius-control);
  color: var(--vtsuru-fg-inverted);
  font-size: 12px;
}

.question-item__images {
  margin-bottom: 12px;
}

.question-item__images img {
  display: block;
  width: auto;
  height: 100px;
  max-width: min(100%, 220px);
  object-fit: cover;
  border-radius: var(--vtsuru-radius-control);
}

.question-item__message,
.question-item__answer {
  margin: 0;
  white-space: pre-wrap;
}

.question-item__message--hidden {
  cursor: pointer;
  filter: blur(3.7px);
}
</style>
