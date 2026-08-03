<script setup lang="ts">
import { ref, watch } from 'vue'

import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const useQB = useQuestionBox()
const replyMessage = ref('')

watch(show, (v) => {
  if (v && useQB.currentQuestion) {
    replyMessage.value = useQB.currentQuestion.answer?.message ?? ''
  }
})

async function submitReply() {
  if (!useQB.currentQuestion) return
  await useQB.reply(useQB.currentQuestion.id, replyMessage.value)
  show.value = false
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="回复提问"
    :ui="{ content: 'max-w-[90vw] sm:max-w-md' }"
  >
    <template #body>
      <div
        v-if="useQB.currentQuestion"
        class="question-box-reply-modal__body"
      >
        <p class="question-box-reply-modal__recipient">
          正在回复给: {{ useQB.currentQuestion.sender?.name || useQB.currentQuestion.anonymousName || '匿名用户' }}
        </p>
        <blockquote class="question-box-reply-modal__question">
          {{ useQB.currentQuestion.question?.message }}
        </blockquote>
        <UTextarea
          v-model="replyMessage"
          placeholder="请输入回复内容..."
          maxlength="1000"
          clearable
          autoresize
          :maxrows="8"
        />
        <UCheckbox
          :model-value="useQB.currentQuestion.isPublic"
          :disabled="useQB.isChangingPublic"
          label="公开这条提问和我的回复"
          @update:model-value="(value) => useQB.setPublic(value === true)"
        />
      </div>
    </template>
    <template #footer>
      <div class="question-box-reply-modal__footer">
        <UButton
          color="neutral"
          variant="outline"
          label="取消"
          @click="show = false"
        />
        <UButton
          :loading="useQB.isRepling"
          color="primary"
          @click="submitReply"
        >
          {{ useQB.currentQuestion?.answer ? '修改回复' : '发送回复' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.question-box-reply-modal__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.question-box-reply-modal__recipient {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.question-box-reply-modal__question {
  margin: 0;
  padding: 12px;
  color: var(--vtsuru-fg);
  line-height: 1.6;
  background: var(--vtsuru-bg-muted);
  border-left: 3px solid var(--vtsuru-brand);
  border-radius: var(--vtsuru-radius-control);
}

.question-box-reply-modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
