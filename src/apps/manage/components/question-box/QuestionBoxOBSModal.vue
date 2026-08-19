<script setup lang="ts">
import { Copy24Regular, Open24Regular } from '@vicons/fluent'
import { NButton, NIcon, NInput, NModal, useMessage } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const questionBox = useQuestionBox()
const router = useRouter()
const message = useMessage()

const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const setting = computed(() => normalizeQuestionDisplaySetting(accountInfo.value?.settings?.questionDisplay))
const obsUrl = computed(() => `${CURRENT_HOST}obs/question-display?token=${accountInfo.value?.token ?? ''}`)
const previewStyle = computed(() => ({ aspectRatio: `${savedCardSize.value.width} / ${savedCardSize.value.height}` }))

async function copyUrl() {
  await copyToClipboard(obsUrl.value)
  message.success('OBS 链接已复制')
}

function openWorkbench() {
  show.value = false
  void router.push({ name: 'question-display' })
}
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    class="obs-quick-modal"
    title="OBS 提问展示"
    closable
  >
    <div class="quick-layout">
      <div class="quick-preview">
        <div
          class="preview-frame"
          :style="previewStyle"
        >
          <QuestionDisplayCard
            :question="questionBox.displayQuestion"
            :setting="setting"
            :status="questionBox.displayQuestion ? 'ready' : 'empty'"
          />
        </div>
        <span>{{ savedCardSize.width }} × {{ savedCardSize.height }}</span>
      </div>

      <div class="quick-actions">
        <label>
          <span>浏览器源链接</span>
          <NInput
            readonly
            type="password"
            show-password-on="click"
            :value="obsUrl"
          />
        </label>
        <NButton
          type="primary"
          @click="copyUrl"
        >
          <template #icon><NIcon :component="Copy24Regular" /></template>
          复制链接
        </NButton>
        <NButton
          secondary
          @click="openWorkbench"
        >
          <template #icon><NIcon :component="Open24Regular" /></template>
          打开展示页
        </NButton>
      </div>
    </div>
  </NModal>
</template>

<style scoped>
:global(.obs-quick-modal) {
  width: min(760px, 92vw);
}

.quick-layout {
  display: grid;
  grid-template-columns: minmax(280px, 1.25fr) minmax(220px, 0.75fr);
  gap: 20px;
  align-items: center;
}

.quick-preview {
  display: grid;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 11px;
  text-align: center;
}

.preview-frame {
  width: 100%;
  overflow: hidden;
  background: #34383c;
  border: 1px solid var(--vtsuru-border);
}

.quick-actions {
  display: grid;
  gap: 10px;
}

.quick-actions label {
  display: grid;
  gap: 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

@media (max-width: 640px) {
  .quick-layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
