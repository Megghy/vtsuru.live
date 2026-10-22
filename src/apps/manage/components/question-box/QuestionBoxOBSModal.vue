<script setup lang="ts">
import { Copy24Regular, Open24Regular } from '@vicons/fluent'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import QuestionDisplayCard from '@/shared/components/QuestionDisplayCard.vue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { normalizeQuestionDisplaySetting } from '@/shared/questionDisplay'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const show = defineModel<boolean>('show', { required: true })
const accountInfo = useAccount()
const questionBox = useQuestionBox()
const router = useRouter()
const message = useMessage()

const savedCardSize = usePersistedStorage('Settings.QuestionDisplay.CardSize', { width: 720, height: 480 })
const setting = computed(() => normalizeQuestionDisplaySetting(accountInfo.value?.settings?.questionDisplay))
const obsUrl = computed(() =>
  buildObsSourceUrl({
    path: 'obs/question-display',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
  }),
)
const previewStyle = computed(() => ({ aspectRatio: `${savedCardSize.value.width} / ${savedCardSize.value.height}` }))

async function copyUrl() {
  if (!obsUrl.value) {
    message.error('请先登录后再复制 OBS 链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('OBS 链接已复制')
}

function openWorkbench() {
  show.value = false
  void router.push({ name: 'question-display' })
}
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">OBS 提问展示</DialogTitle>
      </DialogHeader>

      <div class="grid grid-cols-1 sm:grid-cols-5 gap-5 items-center py-2">
        <div class="sm:col-span-3 flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <div
            class="w-full overflow-hidden bg-[#34383c] border border-border rounded-md"
            :style="previewStyle"
          >
            <QuestionDisplayCard
              :question="questionBox.displayQuestion"
              :setting="setting"
              :status="questionBox.displayQuestion ? 'ready' : 'empty'"
            />
          </div>
          <span class="text-[11px]">{{ savedCardSize.width }} × {{ savedCardSize.height }}</span>
        </div>

        <div class="sm:col-span-2 space-y-3">
          <div class="space-y-1.5">
            <label class="text-xs text-muted-foreground">浏览器源链接</label>
            <Input readonly :model-value="obsUrl" placeholder="登录后可复制 OBS 链接" class="font-mono" />
          </div>
          <Button class="w-full gap-1.5" @click="copyUrl">
            <Copy24Regular class="size-4" />
            复制链接
          </Button>
          <Button variant="outline" class="w-full gap-1.5" @click="openWorkbench">
            <Open24Regular class="size-4" />
            打开展示页
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
