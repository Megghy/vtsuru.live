<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { Setting_QuestionDisplay } from '@/api/api-models'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const useQB = useQuestionBox()
const router = useRouter()

const savedCardSize = usePersistedStorage<{ width: number; height: number }>('Settings.QuestionDisplay.CardSize', {
  width: 400,
  height: 400,
})

const setting = computed((): Setting_QuestionDisplay => {
  return accountInfo.value?.settings?.questionDisplay ?? ({} as Setting_QuestionDisplay)
})

function openQuestionDisplay() {
  show.value = false
  router.push({ name: 'question-display' })
}
</script>

<template>
  <UModal
    v-model:open="show"
    title="OBS 组件预览与链接"
    :ui="{ content: 'max-w-[90vw] w-fit' }"
  >
    <template #body>
      <div class="question-box-obs-modal__body">
        <UAlert
          color="info"
          variant="soft"
        >
          <template #description>
            下方是实时预览效果。管理展示内容请前往
            <UButton
              color="primary"
              variant="link"
              label="展示管理页"
              @click="openQuestionDisplay"
            />
          </template>
        </UAlert>

        <div
          :style="{
            width: `${savedCardSize.width}px`,
            height: `${savedCardSize.height}px`,
            border: '1px dashed var(--vtsuru-border)',
          }"
          class="question-box-obs-modal__preview"
        >
          <QuestionDisplayCard
            :question="useQB.displayQuestion"
            :setting="setting"
          />
        </div>
      </div>
    </template>
    <template #footer>
      <div class="question-box-obs-modal__footer">
        <UFieldGroup class="question-box-obs-modal__url">
          <UInput
            readonly
            :model-value="`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`"
          />
          <UButton
            color="neutral"
            variant="soft"
            label="复制"
            @click="copyToClipboard(`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`)"
          />
        </UFieldGroup>
        <UButton
          color="primary"
          label="前往展示管理页"
          @click="openQuestionDisplay"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.question-box-obs-modal__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.question-box-obs-modal__preview {
  position: relative;
  overflow: hidden;
}

.question-box-obs-modal__footer {
  display: flex;
  align-items: center;
  gap: 10px;
}

.question-box-obs-modal__url {
  flex: 1;
}
</style>
