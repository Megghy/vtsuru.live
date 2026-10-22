<script setup lang="ts">
import { ref, watch } from 'vue'

import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
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
  <Dialog v-model:open="show">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">回复提问</DialogTitle>
      </DialogHeader>

      <template v-if="useQB.currentQuestion">
        <div class="space-y-3 py-1">
          <div class="flex items-center gap-1.5 text-xs">
            <span class="text-muted-foreground">正在回复给：</span>
            <span class="font-semibold text-foreground">
              {{ useQB.currentQuestion.sender?.name || useQB.currentQuestion.anonymousName || '匿名用户' }}
            </span>
          </div>

          <div
            class="p-3 rounded-lg bg-muted/40 text-xs text-foreground whitespace-pre-wrap max-h-36 overflow-y-auto border border-border"
          >
            {{ useQB.currentQuestion.question?.message }}
          </div>

          <Separator />

          <div class="space-y-1.5">
            <Textarea
              v-model="replyMessage"
              placeholder="请输入回复内容 (支持 Ctrl + Enter 快捷发送)..."
              maxlength="10000"
              :rows="5"
              class="text-xs"
              @keydown="handleKeydown"
            />
          </div>
        </div>

        <DialogFooter class="flex items-center justify-between sm:justify-between w-full pt-2">
          <span class="text-[11px] text-muted-foreground">按 Ctrl + Enter 快捷发送</span>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              @click="show = false"
              >取消</Button
            >
            <Button
              :disabled="!replyMessage.trim() || useQB.isRepling"
              @click="submitReply"
            >
              {{ useQB.isRepling ? '发送中...' : useQB.currentQuestion?.answer ? '修改回复' : '发送回复' }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
