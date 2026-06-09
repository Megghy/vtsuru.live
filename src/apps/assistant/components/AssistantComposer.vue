<script setup lang="ts">
import { Image24Regular, Dismiss12Regular, Send24Filled, Stop24Filled } from '@vicons/fluent'
import { NButton, NIcon, NInput, NTooltip } from 'naive-ui'
import { nextTick, ref } from 'vue'

const props = defineProps<{ loading: boolean }>()
const emit = defineEmits<{
  (e: 'send', text: string, images: string[]): void
  (e: 'stop'): void
}>()

const text = ref('')
/** 待发送图片 (base64 data URL) */
const images = ref<string[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const inputRef = ref<InstanceType<typeof NInput> | null>(null)

/** 把文本填入输入框并聚焦, 供预置操作点击使用 (不直接发送) */
async function fill(value: string) {
  text.value = value
  await nextTick()
  inputRef.value?.focus()
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
</script>

<template>
  <div class="composer">
    <div v-if="images.length" class="composer__previews">
      <div v-for="(img, i) in images" :key="i" class="composer__preview">
        <img :src="img" alt="附件">
        <button class="composer__preview-del" type="button" title="移除" @click="removeImage(i)">
          <NIcon :component="Dismiss12Regular" />
        </button>
      </div>
    </div>

    <div class="composer__row">
      <NTooltip>
        <template #trigger>
          <NButton
            class="composer__attach"
            quaternary
            circle
            :disabled="loading || images.length >= MAX_IMAGES"
            @click="fileInput?.click()"
          >
            <template #icon>
              <NIcon :component="Image24Regular" />
            </template>
          </NButton>
        </template>
        添加图片 (可粘贴截图), 最多 {{ MAX_IMAGES }} 张
      </NTooltip>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        multiple
        hidden
        @change="onPickFiles"
      >
      <NInput
        ref="inputRef"
        v-model:value="text"
        type="textarea"
        placeholder="描述你想做的事, 或粘贴/上传日程截图让我识别"
        :autosize="{ minRows: 1, maxRows: 4 }"
        :disabled="loading"
        class="composer__input"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <NButton
        v-if="loading"
        type="error"
        tertiary
        class="composer__btn"
        @click="emit('stop')"
      >
        <template #icon>
          <NIcon :component="Stop24Filled" />
        </template>
        停止
      </NButton>
      <NButton
        v-else
        type="primary"
        class="composer__btn"
        :disabled="!text.trim() && !images.length"
        @click="submit"
      >
        <template #icon>
          <NIcon :component="Send24Filled" />
        </template>
        发送
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.composer { display: flex; flex-direction: column; gap: 8px; }
.composer__row { display: flex; gap: 8px; align-items: flex-end; }
.composer__input { flex: 1; min-width: 0; }
.composer__btn, .composer__attach { flex: 0 0 auto; }

.composer__previews { display: flex; flex-wrap: wrap; gap: 8px; }
.composer__preview {
  position: relative; width: 56px; height: 56px;
  border-radius: 8px; overflow: hidden;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.2));
}
.composer__preview img { width: 100%; height: 100%; object-fit: cover; }
.composer__preview-del {
  position: absolute; top: 0; right: 0;
  width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  border: none; border-bottom-left-radius: 6px;
  background: rgba(0, 0, 0, 0.55); color: #fff;
  font-size: 12px; cursor: pointer; padding: 0;
}
</style>
