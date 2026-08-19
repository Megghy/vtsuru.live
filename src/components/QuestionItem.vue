<script setup lang="ts">
import { NButton, NCard, NCheckbox, NDivider, NFlex, NImage, NTag, NText, NTime, NTooltip } from 'naive-ui'
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

const isViolation = props.item.reviewResult?.isApproved === false
const showContent = ref(!isViolation)
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
    :class="{ 'is-unread': !item.isReaded }"
    hoverable
    size="small"
    bordered
  >
    <template #header>
      <NFlex
        :size="[4, 4]"
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
          v-if="!item.isReaded"
          type="warning"
          size="tiny"
        >
          未读
        </NTag>
        <NDivider
          v-if="!item.isReaded"
          vertical
        />
        <NText :depth="item.isAnonymous ? 3 : 1">
          {{ item.isAnonymous ? item.anonymousName || '匿名用户' : item.sender?.name }}
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
              type="success"
            >
              {{ item.tag }}
            </NTag>
          </template>
          标签/话题
        </NTooltip>
        <NDivider vertical />
        <NText
          depth="3"
          style="font-size: small"
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
            审查得分, 满分100, 越低越安全
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

    <NButton
      v-if="shouldClampMessage"
      class="question-item__message-toggle"
      text
      size="tiny"
      @click="showFullMessage = !showFullMessage"
    >
      {{ showFullMessage ? '收起内容' : '展开全部' }}
    </NButton>

    <template v-if="item.answer">
      <NDivider style="margin: 10px 0" />
      <NText depth="3">
        {{ item.answer.message }}
      </NText>
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
}

.question-item.is-unread {
  --question-item-bg: color-mix(in srgb, var(--vtsuru-brand-tint) 32%, var(--vtsuru-bg-elevated));
  --question-item-border: color-mix(in srgb, var(--vtsuru-brand) 32%, var(--vtsuru-border));
}

.question-item.is-unread::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--vtsuru-brand);
  content: '';
}

.question-item__images {
  margin-bottom: 8px;
}

.question-item__message {
  display: block;
  overflow-wrap: anywhere;
}

.question-item__message.is-clamped {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 6;
}

.question-item__message-toggle {
  margin-top: 6px;
}
</style>
