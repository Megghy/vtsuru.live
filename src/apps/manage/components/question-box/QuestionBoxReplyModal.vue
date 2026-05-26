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
  if (!useQB.currentQuestion) return
  await useQB.reply(useQB.currentQuestion.id, replyMessage.value)
  show.value = false
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    style="max-width: 90vw; width: 500px"
    title="回复提问"
    :mask-closable="false"
  >
    <template v-if="useQB.currentQuestion">
      <NText>正在回复给: {{ useQB.currentQuestion.sender?.name || useQB.currentQuestion.anonymousName || '匿名用户' }}</NText>
      <NCard size="small" :bordered="false" style="margin-top: 5px; background-color: var(--n-action-color);">
        {{ useQB.currentQuestion.question?.message }}
      </NCard>
      <NDivider style="margin: 15px 0;" />
      <NFlex vertical>
        <NInput
          v-model:value="replyMessage"
          placeholder="请输入回复内容..."
          type="textarea"
          maxlength="1000"
          show-count
          clearable
          :autosize="{ minRows: 3, maxRows: 8 }"
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
      <NDivider style="margin: 15px 0;" />
      <NFlex justify="end">
        <NButton @click="show = false">
          取消
        </NButton>
        <NButton
          :loading="useQB.isRepling"
          type="primary"
          @click="submitReply"
        >
          {{ useQB.currentQuestion?.answer ? '修改回复' : '发送回复' }}
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>
