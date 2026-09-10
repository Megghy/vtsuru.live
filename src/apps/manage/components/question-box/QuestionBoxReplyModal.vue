<script setup lang="ts">
import { NButton, NCard, NCheckbox, NDivider, NFlex, NInput, NModal, NSpin, NText } from 'naive-ui'
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
  if (!useQB.currentQuestion || !replyMessage.value.trim() || useQB.isRepling) return
  await useQB.reply(useQB.currentQuestion.id, replyMessage.value.trim())
  show.value = false
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void submitReply()
  }
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    style="max-width: 90vw; width: 520px"
    title="回复提问"
    :mask-closable="false"
  >
    <template v-if="useQB.currentQuestion">
      <div class="reply-target-info">
        <NText depth="3">正在回复给：</NText>
        <NText strong>
          {{ useQB.currentQuestion.sender?.name || useQB.currentQuestion.anonymousName || '匿名用户' }}
        </NText>
      </div>

      <NCard
        size="small"
        embedded
        :bordered="false"
        style="margin-top: 8px; max-height: 140px; overflow-y: auto"
      >
        <NText style="white-space: pre-wrap">
          {{ useQB.currentQuestion.question?.message }}
        </NText>
      </NCard>

      <NDivider style="margin: 16px 0 12px" />

      <NFlex
        vertical
        :size="12"
      >
        <NInput
          v-model:value="replyMessage"
          placeholder="请输入回复内容 (支持 Ctrl + Enter 快捷发送)..."
          type="textarea"
          maxlength="10000"
          show-count
          clearable
          :autosize="{ minRows: 4, maxRows: 12 }"
          @keydown="handleKeydown"
        />

        <NSpin :show="useQB.isChangingPublic">
          <NCheckbox
            :checked="useQB.currentQuestion?.isPublic"
            @update:checked="(v) => useQB.setPublic(v)"
          >
            公开这条提问和我的回复 (其他人可在你的提问页看到)
          </NCheckbox>
        </NSpin>
      </NFlex>

      <NDivider style="margin: 16px 0 12px" />

      <NFlex
        justify="space-between"
        align="center"
      >
        <NText
          depth="3"
          style="font-size: 11px"
        >
          按 Ctrl + Enter 快捷发送
        </NText>

        <NFlex :size="8">
          <NButton @click="show = false"> 取消 </NButton>
          <NButton
            :loading="useQB.isRepling"
            :disabled="!replyMessage.trim()"
            type="primary"
            @click="submitReply"
          >
            {{ useQB.currentQuestion?.answer ? '修改回复' : '发送回复' }}
          </NButton>
        </NFlex>
      </NFlex>
    </template>
  </NModal>
</template>

<style scoped>
.reply-target-info {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
</style>
