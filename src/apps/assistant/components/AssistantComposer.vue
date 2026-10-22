<script setup lang="ts">
import { Dismiss12Regular, Image24Regular, Mic24Filled, Mic24Regular, Send24Filled, Stop24Filled } from '@vicons/fluent'
import { nextTick, onBeforeUnmount, ref } from 'vue'

import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{
  (e: 'send', text: string, images: string[]): void
  (e: 'stop'): void
}>()

const text = ref('')
/** 待发送图片 (base64 data URL) */
const images = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)

/** 把文本填入输入框并聚焦, 供预置操作点击使用 (不直接发送) */
async function fill(value: string) {
  text.value = value
  await nextTick()
  textareaRef.value?.focus()
}

defineExpose({ fill })

const MAX_IMAGES = 5
const MAX_SIZE = 8 * 1024 * 1024 // 单图 8MB

function submit() {
  const value = text.value.trim()
  if ((!value && !images.value.length) || props.loading) return
  emit('send', value, [...images.value])
  text.value = ''
  images.value = []
}

function onKeydown(e: KeyboardEvent) {
  // Enter 发送, Shift+Enter 换行
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    if (file.size > MAX_SIZE) continue
    if (images.value.length >= MAX_IMAGES) break
    images.value.push(await readAsDataUrl(file))
  }
}

function onPickFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) void addFiles(input.files)
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
  if (files.length) {
    e.preventDefault()
    void addFiles(files)
  }
}

function removeImage(index: number) {
  images.value.splice(index, 1)
}

// 语音输入: Web Speech API, 把识别结果追加到输入框 (浏览器不支持则隐藏按钮)
const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
const speechSupported = !!SpeechRecognitionCtor
const listening = ref(false)
let recognition: any = null
/** 本次会话开始前已有的文本, 识别结果在其后追加 */
let speechBaseText = ''

function toggleSpeech() {
  if (!speechSupported || props.loading) return
  if (listening.value) {
    recognition?.stop()
    return
  }

  recognition = new SpeechRecognitionCtor()
  recognition.lang = 'zh-CN'
  recognition.continuous = true
  recognition.interimResults = true
  speechBaseText = text.value ? text.value.trimEnd() + ' ' : ''

  recognition.onresult = (e: any) => {
    let transcript = ''
    for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript
    text.value = speechBaseText + transcript
  }
  recognition.onend = () => {
    listening.value = false
  }
  recognition.onerror = () => {
    listening.value = false
  }

  listening.value = true
  recognition.start()
}

onBeforeUnmount(() => recognition?.abort())
</script>

<template>
  <TooltipProvider>
    <div class="flex flex-col gap-2">
      <div
        v-if="images.length"
        class="flex gap-2 overflow-x-auto py-1"
      >
        <div
          v-for="(img, i) in images"
          :key="i"
          class="relative shrink-0 size-14 rounded-md overflow-hidden border border-border"
        >
          <img
            :src="img"
            alt="附件"
            class="size-full object-cover block"
          />
          <button
            class="absolute top-0.5 right-0.5 size-4 rounded-full bg-black/65 text-white border-0 cursor-pointer inline-flex-center p-0 hover:bg-black/85"
            type="button"
            title="移除"
            @click="removeImage(i)"
          >
            <component
              :is="Dismiss12Regular"
              class="size-3"
            />
          </button>
        </div>
      </div>

      <div class="flex gap-2 items-end">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-full text-muted-foreground hover:text-foreground"
              :disabled="loading || images.length >= MAX_IMAGES"
              @click="fileInput?.click()"
            >
              <component
                :is="Image24Regular"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>添加图片 (可粘贴截图), 最多 {{ MAX_IMAGES }} 张</TooltipContent>
        </Tooltip>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          hidden
          @change="onPickFiles"
        />

        <Tooltip v-if="speechSupported">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="size-8 rounded-full text-muted-foreground hover:text-foreground"
              :class="{ 'composer-mic-on text-primary!': listening }"
              :disabled="loading"
              @click="toggleSpeech"
            >
              <component
                :is="listening ? Mic24Filled : Mic24Regular"
                class="size-4"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{{ listening ? '点击停止语音输入' : '语音输入 (说话转文字)' }}</TooltipContent>
        </Tooltip>

        <Textarea
          ref="textareaRef"
          v-model="text"
          rows="1"
          placeholder="描述你想做的事, 或粘贴/上传日程截图让我识别"
          :disabled="loading"
          class="flex-1 min-w-0 min-h-[38px] max-h-32 text-xs resize-none py-2"
          @keydown="onKeydown"
          @paste="onPaste"
        />

        <Button
          v-if="loading"
          variant="destructive"
          class="h-[38px] px-3 flex items-center gap-1 shrink-0"
          @click="emit('stop')"
        >
          <component
            :is="Stop24Filled"
            class="size-3.5"
          />
          停止
        </Button>
        <Button
          v-else
          class="h-[38px] px-3 flex items-center gap-1 shrink-0"
          :disabled="!text.trim() && !images.length"
          @click="submit"
        >
          <component
            :is="Send24Filled"
            class="size-3.5"
          />
          发送
        </Button>
      </div>
    </div>
  </TooltipProvider>
</template>

<style scoped>
.composer-mic-on {
  animation: composer-mic-pulse 1.4s ease-in-out infinite;
}
@keyframes composer-mic-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.75;
  }
}
</style>
