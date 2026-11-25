<script setup lang="ts">
import { ImagePlus, X } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import QuestionThreadContext from '@/components/QuestionThreadContext.vue'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { ImagePreview } from '@/shared/ui/image-preview'
import { Separator } from '@/shared/ui/separator'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'
import { useQuestionBox } from '@/store/useQuestionBox'

const MAX_REPLY_IMAGES = 9
const MAX_IMAGE_SIZE = 10 * 1024 * 1024
const QUICK_PHRASES = ['收到啦，谢谢提问！', '直播间已经读过啦~', '好问题，安排上了！']

interface PendingImage {
  file: File
  previewUrl: string
}

const show = defineModel<boolean>('show', { required: true })
const useQB = useQuestionBox()
const message = useMessage()

const replyMessage = ref('')
const pendingImages = ref<PendingImage[]>([])
const fileInputRef = ref<HTMLInputElement>()
const threadContext = computed(() => (useQB.currentQuestion ? useQB.threadContext(useQB.currentQuestion) : []))

function draftKey(id: number) {
  return `vtsuru-qa-reply-draft:${id}`
}

function revokePendingImages() {
  for (const item of pendingImages.value) {
    URL.revokeObjectURL(item.previewUrl)
  }
  pendingImages.value = []
}

watch(show, (open) => {
  if (open && useQB.currentQuestion) {
    revokePendingImages()
    const savedDraft = localStorage.getItem(draftKey(useQB.currentQuestion.id))
    replyMessage.value = savedDraft ?? useQB.currentQuestion.answer?.message ?? ''
  } else if (!open) {
    revokePendingImages()
  }
})

watch(replyMessage, (val) => {
  const id = useQB.currentQuestion?.id
  if (!show.value || !id) return
  if (val.trim()) {
    localStorage.setItem(draftKey(id), val)
  } else {
    localStorage.removeItem(draftKey(id))
  }
})

function appendFiles(fileList: FileList | File[]) {
  const incoming = Array.from(fileList)
  for (const file of incoming) {
    if (!file.type.startsWith('image/')) {
      message.warning(`「${file.name}」不是有效的图片格式`)
      continue
    }
    if (file.size > MAX_IMAGE_SIZE) {
      message.warning(`图片「${file.name}」不能超过 10MB`)
      continue
    }
    if (pendingImages.value.length >= MAX_REPLY_IMAGES) {
      message.warning(`最多只能附加 ${MAX_REPLY_IMAGES} 张图片`)
      break
    }
    pendingImages.value.push({
      file,
      previewUrl: URL.createObjectURL(file),
    })
  }
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) {
    appendFiles(input.files)
  }
  input.value = ''
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length) appendFiles(files)
}

function removePendingImage(index: number) {
  const [removed] = pendingImages.value.splice(index, 1)
  if (removed) URL.revokeObjectURL(removed.previewUrl)
}

function applyQuickPhrase(phrase: string) {
  replyMessage.value = replyMessage.value.trim() ? `${replyMessage.value.trim()}\n${phrase}` : phrase
}

async function submitReply() {
  if (!useQB.currentQuestion || !replyMessage.value.trim() || useQB.isRepling) return
  const targetId = useQB.currentQuestion.id
  const ok = await useQB.reply(
    targetId,
    replyMessage.value.trim(),
    pendingImages.value.map((p) => p.file),
  )
  if (ok) {
    localStorage.removeItem(draftKey(targetId))
    revokePendingImages()
    show.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    void submitReply()
  }
}

onBeforeUnmount(revokePendingImages)
</script>

<template>
  <Dialog v-model:open="show">
    <DialogContent class="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
      <DialogHeader>
        <DialogTitle class="text-sm">{{ useQB.currentQuestion?.answer ? '修改回复' : '回复提问' }}</DialogTitle>
      </DialogHeader>

      <template v-if="useQB.currentQuestion">
        <div class="space-y-3 py-1">
          <div class="flex-between gap-2 text-xs">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-muted-foreground shrink-0">正在回复给：</span>
              <span class="font-semibold text-foreground truncate">
                {{ useQB.currentQuestion.isAnonymous ? useQB.currentQuestion.anonymousName || '匿名用户' : useQB.currentQuestion.sender?.name || '观众' }}
              </span>
            </div>
            <span
              v-if="useQB.currentQuestion.tag"
              class="text-[11px] text-muted-foreground shrink-0"
            >
              #{{ useQB.currentQuestion.tag }}
            </span>
          </div>

          <QuestionThreadContext
            v-if="threadContext.length"
            :items="threadContext"
            answer-label="我的回复"
            class="max-h-36 overflow-y-auto scrollbar-thin"
          />

          <div
            class="p-3 rounded-lg bg-muted/40 text-xs text-foreground whitespace-pre-wrap break-words max-h-36 overflow-y-auto scrollbar-thin border border-border"
          >
            {{ useQB.currentQuestion.question?.message }}
          </div>

          <div
            v-if="useQB.currentQuestion.questionImages && useQB.currentQuestion.questionImages.length > 0"
            class="flex items-center gap-2 flex-wrap"
          >
            <ImagePreview
              v-for="(img, imgIdx) in useQB.currentQuestion.questionImages"
              :key="img.id || imgIdx"
              :src="img.path || ''"
              :alt="img.name || '提问附图'"
              :gallery="useQB.currentQuestion.questionImages"
              :index="imgIdx"
              class="h-16 w-20"
            />
          </div>

          <Separator />

          <div class="space-y-2">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="text-[11px] text-muted-foreground">快捷短语：</span>
              <Button
                v-for="phrase in QUICK_PHRASES"
                :key="phrase"
                type="button"
                variant="outline"
                size="xs"
                @click="applyQuickPhrase(phrase)"
              >
                {{ phrase }}
              </Button>
            </div>

            <Textarea
              v-model="replyMessage"
              placeholder="请输入回复内容（支持粘贴图片、Ctrl + Enter 快捷发送，草稿自动暂存）..."
              maxlength="10000"
              :rows="5"
              @keydown="handleKeydown"
              @paste="onPaste"
            />

            <div class="flex-between gap-2 text-[11px] text-muted-foreground">
              <div class="flex items-center gap-2">
                <input
                  ref="fileInputRef"
                  type="file"
                  accept="image/*"
                  multiple
                  class="hidden"
                  @change="onFileChange"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  class="gap-1"
                  :disabled="pendingImages.length >= MAX_REPLY_IMAGES"
                  @click="fileInputRef?.click()"
                >
                  <ImagePlus class="size-3.5" />
                  添加附图 ({{ pendingImages.length }}/{{ MAX_REPLY_IMAGES }})
                </Button>
                <span
                  v-if="useQB.currentQuestion.answerImages?.length && !pendingImages.length"
                  class="text-muted-foreground"
                >
                  已附 {{ useQB.currentQuestion.answerImages.length }} 张图（上传新图将替换）
                </span>
              </div>
              <span class="tabular-nums">{{ replyMessage.length }} / 10000</span>
            </div>

            <div
              v-if="pendingImages.length > 0"
              class="flex items-center gap-2 flex-wrap pt-1"
            >
              <div
                v-for="(item, idx) in pendingImages"
                :key="item.previewUrl"
                class="relative group rounded-md overflow-hidden border border-border size-16 bg-muted/40"
              >
                <img
                  :src="item.previewUrl"
                  alt=""
                  class="size-full object-cover"
                />
                <button
                  type="button"
                  aria-label="移除图片"
                  class="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/70 text-white flex-center opacity-90 hover:opacity-100"
                  @click="removePendingImage(idx)"
                >
                  <X class="size-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter class="flex-between sm:justify-between w-full pt-2">
          <span class="text-[11px] text-muted-foreground">按 Ctrl + Enter 快捷发送</span>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              @click="show = false"
            >
              取消
            </Button>
            <Button
              :disabled="!replyMessage.trim() || useQB.isRepling"
              :loading="useQB.isRepling"
              @click="submitReply"
            >
              {{ useQB.currentQuestion?.answer ? '保存修改' : '发送回复' }}
            </Button>
          </div>
        </DialogFooter>
      </template>
    </DialogContent>
  </Dialog>
</template>
