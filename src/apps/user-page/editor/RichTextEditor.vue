<script setup lang="ts">
import type { IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
// @ts-ignore
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { onBeforeUnmount, shallowRef, watch } from 'vue'

import type { UploadFileResponse } from '@/api/api-models'
import { UserFileLocation, UserFileTypes } from '@/api/api-models'
import { uploadFiles } from '@/shared/services/fileUpload'
import { isDarkMode } from '@/shared/utils'

import '@/assets/editorDarkMode.css'
import '@wangeditor/editor/dist/css/style.css'

type InsertFnType = (url: string, alt: string, href: string) => void

const html = defineModel<string>('html', { required: true })
const imagesFile = defineModel<UploadFileResponse[]>('imagesFile', { default: () => [] })

const toast = useToast()

const editorRef = shallowRef()

const toolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect',
    '|',
    'bold',
    'italic',
    'underline',
    'through',
    'code',
    'clearStyle',
    '|',
    'color',
    'bgColor',
    'fontSize',
    'lineHeight',
    '|',
    'bulletedList',
    'numberedList',
    '|',
    'insertLink',
    'uploadImage',
    '|',
    'emotion',
    '|',
    'undo',
    'redo',
  ],
  modalAppendToBody: true,
}

const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入内容...',
  maxLength: 10000,
  MENU_CONF: {
    color: {
      colors: [
        '#000000',
        '#111827',
        '#374151',
        '#6b7280',
        '#9ca3af',
        '#ffffff',
        '#ef4444',
        '#f97316',
        '#f59e0b',
        '#22c55e',
        '#06b6d4',
        '#3b82f6',
        '#a855f7',
        '#ec4899',
      ],
    },
    bgColor: {
      colors: [
        '#ffffff',
        '#f3f4f6',
        '#e5e7eb',
        '#111827',
        '#000000',
        '#fee2e2',
        '#ffedd5',
        '#fef3c7',
        '#dcfce7',
        '#cffafe',
        '#dbeafe',
        '#f3e8ff',
        '#fce7f3',
      ],
    },
    fontSize: {
      fontSizeList: ['12px', '14px', '16px', { name: '18px', value: '18px' }, '20px', '24px', '32px'],
    },
    lineHeight: {
      lineHeightList: ['1', '1.4', '1.6', '1.8', '2', '2.2'],
    },
    emotion: {
      emotions: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 🤔 😭 😡 👍 👎 ❤️ ⭐️ ✨ 🎉'.split(' '),
    },
    uploadImage: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: 1,
      async customUpload(file: File, insertFn: InsertFnType) {
        try {
          toast.add({ title: '图片上传中', color: 'info' })
          const [result] = await uploadFiles(file, UserFileTypes.Image, UserFileLocation.Local)
          if (!imagesFile.value.some((x) => x.id === result.id)) imagesFile.value = [...imagesFile.value, result]
          insertFn(result.path, result.name || '', result.path)
          toast.add({ title: '图片上传成功', color: 'success' })
        } catch (e) {
          toast.add({ title: (e as Error).message || '图片上传失败', color: 'error' })
          throw e
        }
      },
    },
  },
}

function handleCreated(editor: unknown) {
  editorRef.value = editor
}

function extractImageSrcs(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return new Set<string>()
  const doc = new DOMParser().parseFromString(trimmed, 'text/html')
  const srcs = new Set<string>()
  doc.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src')
    if (src) srcs.add(src)
  })
  return srcs
}

watch(
  () => html.value,
  (v) => {
    const srcs = extractImageSrcs(v)
    const next = imagesFile.value.filter((f) => srcs.has(f.path))
    if (next.length !== imagesFile.value.length) imagesFile.value = next
  },
  { flush: 'post' },
)

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
})
</script>

<template>
  <div
    class="rich-text-editor"
    :class="{ 'dark-theme': isDarkMode }"
  >
    <Toolbar
      class="rich-text-editor__toolbar"
      :editor="editorRef"
      :default-config="toolbarConfig"
      mode="default"
    />
    <Editor
      v-model="html"
      style="height: 420px; overflow-y: hidden"
      :default-config="editorConfig"
      mode="default"
      @on-created="handleCreated"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  overflow: hidden;
  border: var(--vtsuru-page-border, 1px solid var(--vtsuru-border));
  border-radius: var(--vtsuru-page-radius, 8px);
}

.rich-text-editor__toolbar {
  border-bottom: var(--vtsuru-page-border, 1px solid var(--vtsuru-border));
}
</style>
