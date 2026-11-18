<script setup lang="ts">
import { defineAsyncComponent, ref, watch } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'
import { useQuestionBoxHistory } from '@/apps/user/components/question-box/questionBoxHistory'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { useMessage } from '@/shared/utils'

import type { CustomHtmlHostDialogState } from './useCustomHtmlBridge'

const LocalQuestionDrawer = defineAsyncComponent(
  () => import('@/apps/user/components/question-box/LocalQuestionDrawer.vue'),
)
const QuestionComposer = defineAsyncComponent(() => import('@/apps/user/components/question-box/QuestionComposer.vue'))

defineProps<{ dialog: CustomHtmlHostDialogState; userInfo?: ResponseUserInfo }>()
const history = useQuestionBoxHistory()
const showHistory = ref(false)
const hasOpenedHistory = ref(false)
watch(
  showHistory,
  (val) => {
    if (val) hasOpenedHistory.value = true
  },
  { immediate: true },
)
const message = useMessage()

function removeHistory(id: string) {
  history.remove(id)
  message.success('已删除本地记录')
}

function clearHistory() {
  history.clear()
  message.success('已清空本地记录')
}
</script>

<template>
  <Dialog
    :open="Boolean(dialog.song.value)"
    @update:open="
      (open) => {
        if (!open) dialog.confirmSong(false)
      }
    "
  >
    <DialogContent>
      <DialogHeader
        ><DialogTitle>确认点歌</DialogTitle
        ><DialogDescription>{{ dialog.song.value?.name }}</DialogDescription></DialogHeader
      >
      <DialogFooter>
        <Button
          variant="outline"
          @click="dialog.confirmSong(false)"
          >取消</Button
        >
        <Button @click="dialog.confirmSong(true)">确认点歌</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
  <Dialog v-model:open="dialog.questionOpen.value">
    <DialogContent class="max-h-[90dvh] overflow-y-auto scrollbar-thin">
      <DialogHeader
        ><DialogTitle>提问箱</DialogTitle
        ><DialogDescription class="sr-only">向主播提问</DialogDescription></DialogHeader
      >
      <QuestionComposer
        v-if="dialog.questionOpen.value"
        :user-info="userInfo"
        :tags="dialog.questionTags.value"
        :default-tag="dialog.questionTag.value"
        embedded
        @open-history="showHistory = true"
      />
    </DialogContent>
  </Dialog>
  <LocalQuestionDrawer
    v-if="hasOpenedHistory || showHistory"
    v-model:show="showHistory"
    :questions="history.questions.value"
    @remove="removeHistory"
    @clear="clearHistory"
  />
</template>
