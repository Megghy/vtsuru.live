<script setup lang="ts">
import { ChevronDown12Regular, ChevronUp12Regular, Tv20Regular } from '@vicons/fluent'
import { NCard, NCheckbox, NDivider, NFlex, NIcon, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui'
import { computed, ref } from 'vue'

import type { QAInfo } from '@/api/api-models'
import { useQuestionBox } from '@/store/useQuestionBox'

const props = defineProps<{
  item: QAInfo
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{ (e: 'select', id: number): void }>()
const useQA = useQuestionBox()

const isViolation = computed(() => props.item.reviewResult?.isApproved === false)
const isDisplaying = computed(() => useQA.displayQuestion?.id === props.item.id)
const showContent = ref(!isViolation.value)
const showFullMessage = ref(false)
const message = computed(() => props.item.question?.message ?? '')
const shouldClampMessage = computed(() => message.value.length > 240)

function getScoreColor(score: number | undefined): string {
  if (score === undefined) return 'grey'
  const clamped = Math.max(0, Math.min(100, score))
  const hue = 120 * (clamped / 100)
  return `hsl(${hue}, 50%, 45%)`
}
</script>

<template>
  <NCard
    v-if="item"
    class="question-item"
    :class="{
      'is-unread': !item.isReaded,
      'is-displaying': isDisplaying,
    }"
    hoverable
    size="small"
    bordered
  >
    <template #header>
      <NFlex
        :size="[6, 6]"
        align="center"
        wrap
      >
        <NCheckbox
          v-if="selectable"
          :checked="selected"
          style="margin-right: 4px"
          @update:checked="emit('select', item.id)"
          @click.stop
        />

        <NTag
          v-if="isDisplaying"
          type="success"
          size="small"
          round
          class="displaying-tag"
        >
          <template #icon>
            <NIcon :component="Tv20Regular" />
          </template>
          OBS 展示中
        </NTag>

        <NTag
          v-if="!item.isReaded"
          type="warning"
          size="tiny"
        >
          未读
        </NTag>

        <NDivider
          v-if="!item.isReaded || isDisplaying"
          vertical
        />

        <NText
          :depth="item.isAnonymous ? 3 : 1"
          strong
        >
          {{ item.isAnonymous ? item.anonymousName || '匿名用户' : item.sender?.name || '观众' }}
        </NText>

        <NTag
          v-if="item.isSenderRegisted"
          size="small"
          type="info"
          :bordered="false"
        >
          已注册
        </NTag>

        <NTag
          v-if="item.isPublic"
          size="small"
          type="success"
          :bordered="false"
        >
          公开
        </NTag>

        <NTooltip v-if="item.tag">
          <template #trigger>
            <NTag
              size="small"
              type="primary"
            >
              {{ item.tag }}
            </NTag>
          </template>
          标签/话题
        </NTooltip>

        <NDivider vertical />

        <NText
          depth="3"
          style="font-size: 12px"
        >
          <NTooltip>
            <template #trigger>
              <NTime
                :time="item.sendAt"
                :to="Date.now()"
                type="relative"
              />
            </template>
            <NTime :time="item.sendAt" />
          </NTooltip>
        </NText>

        <template v-if="item.reviewResult && item.reviewResult.violationType?.length > 0">
          <NDivider vertical />
          <NFlex
            size="small"
            wrap
          >
            <NTag
              v-for="v in item.reviewResult.violationType"
              :key="v"
              size="small"
              type="error"
              :bordered="false"
            >
              {{ useQA.getViolationString(v) }}
            </NTag>
          </NFlex>
        </template>

        <template v-if="item.reviewResult && item.reviewResult.saftyScore !== undefined">
          <NDivider vertical />
          <NTooltip>
            <template #trigger>
              <NTag
                size="small"
                :style="{
                  backgroundColor: getScoreColor(item.reviewResult.saftyScore),
                  color: 'white',
                  borderColor: 'transparent',
                }"
              >
                得分: {{ item.reviewResult.saftyScore }}
              </NTag>
            </template>
            审查得分, 满分100, 越高越安全
          </NTooltip>
        </template>
      </NFlex>
    </template>

    <template #footer>
      <slot
        name="footer"
        :item="item"
      />
    </template>

    <template #header-extra>
      <slot
        name="header-extra"
        :item="item"
      />
    </template>

    <template v-if="item.questionImages && item.questionImages.length > 0">
      <NFlex
        class="question-item__images"
        size="small"
      >
        <NImage
          v-for="(img, index) in item.questionImages"
          :key="index"
          :src="img.path"
          height="100"
          lazy
        />
      </NFlex>
    </template>

    <NText
      class="question-item__message"
      :class="{ 'is-clamped': shouldClampMessage && !showFullMessage }"
      :style="{
        filter: isViolation && !showContent ? 'blur(3.7px)' : '',
        cursor: isViolation && !showContent ? 'pointer' : '',
        whiteSpace: 'pre-wrap',
      }"
      @click="isViolation ? (showContent = !showContent) : null"
    >
      {{ message }}
    </NText>

    <button
      v-if="shouldClampMessage"
      type="button"
      class="question-item__message-toggle"
      @click="showFullMessage = !showFullMessage"
    >
      <NIcon
        :component="showFullMessage ? ChevronUp12Regular : ChevronDown12Regular"
        :size="12"
      />
      {{ showFullMessage ? '收起内容' : '展开全部' }}
    </button>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0" />
      <div class="question-item__answer-box">
        <span class="answer-label">我的回复：</span>
        <NText depth="2">
          {{ item.answer.message }}
        </NText>
      </div>
    </template>
  </NCard>
</template>

<style scoped>
.question-item {
  --question-item-bg: var(--vtsuru-bg-elevated);
  --question-item-border: var(--vtsuru-border);
  position: relative;
  overflow: hidden;
  border-color: var(--question-item-border);
  background: var(--question-item-bg);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.question-item.is-displaying {
  border-color: var(--vtsuru-brand);
  box-shadow: 0 0 0 1px var(--vtsuru-brand);
}

.displaying-tag {
  font-weight: 600;
  animation: pulse-soft 2s infinite ease-in-out;
}

@keyframes pulse-soft {
  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.75;
  }
}

.question-item__images {
  margin-bottom: 10px;
}

.question-item__message {
  display: block;
  font-size: 14px;
  line-height: 1.6;
}

.question-item__message.is-clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}

.question-item__message-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  margin-top: 6px;
  font-size: 12px;
  color: var(--vtsuru-brand);
  background: none;
  border: none;
  cursor: pointer;
}

.question-item__message-toggle:hover {
  text-decoration: underline;
}

.question-item__answer-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 12px;
  background: var(--vtsuru-bg-muted);
  border-radius: 6px;
  font-size: 13px;
}

.answer-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
}
</style>
