<script setup lang="ts">
import type { Setting_QuestionDisplay } from '@/api/api-models'
import { NAlert, NButton, NDivider, NInput, NInputGroup, NModal, useThemeVars  } from 'naive-ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAccount } from '@/api/account'
import { useQuestionBox } from '@/store/useQuestionBox'
import { CURRENT_HOST } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'
import { usePersistedStorage } from '@/shared/storage/persist'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const useQB = useQuestionBox()
const themeVars = useThemeVars()
const router = useRouter()

const savedCardSize = usePersistedStorage<{ width: number, height: number }>('Settings.QuestionDisplay.CardSize', {
  width: 400,
  height: 400,
})

const setting = computed((): Setting_QuestionDisplay => {
  return accountInfo.value?.settings?.questionDisplay ?? {} as Setting_QuestionDisplay
})
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    closable
    style="max-width: 90vw; width: auto;"
    title="OBS 组件预览与链接"
    content-style="display: flex; align-items: center; justify-content: center; flex-direction: column;"
  >
    <NAlert type="info" :show-icon="false" style="margin-bottom: 15px;">
      下方是实时预览效果。管理展示内容请前往
      <NButton text type="primary" @click="show = false; router.push({ name: 'question-display' })">
        展示管理页
      </NButton>
    </NAlert>

    <div
      :style="{
        width: `${savedCardSize.width}px`,
        height: `${savedCardSize.height}px`,
        border: `1px dashed ${themeVars.borderColor}`,
        overflow: 'hidden',
        position: 'relative',
      }"
    >
      <QuestionDisplayCard :question="useQB.displayQuestion" :setting="setting" />
    </div>

    <NDivider title-placement="left" style="margin-top: 20px; margin-bottom: 10px;">
      OBS 浏览器源链接
    </NDivider>
    <NInputGroup>
      <NInput readonly :value="`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`" />
      <NButton secondary @click="copyToClipboard(`${CURRENT_HOST}obs/question-display?token=${accountInfo?.token}`)">
        复制
      </NButton>
    </NInputGroup>

    <NDivider style="margin-top: 20px; margin-bottom: 15px;" />
    <NButton type="primary" @click="show = false; router.push({ name: 'question-display' })">
      前往展示管理页
    </NButton>
  </NModal>
</template>
