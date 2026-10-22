<script setup lang="ts">
import type { IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
// @ts-ignore
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { onBeforeUnmount, shallowRef } from 'vue'

import { FileStore, uploadFiles } from '@/shared/services/fileUpload'
import { isDarkMode, toast } from '@/shared/utils'

import '@/assets/editorDarkMode.css'
import '@wangeditor/editor/dist/css/style.css' // 引入 css

type InsertFnType = (url: string, alt: string, href: string) => void

const props = defineProps({
  defaultValue: {
    type: String,
    default: '',
  },
  mode: {
    type: String,
    default: 'default',
  },
  maxLength: {
    type: Number,
    default: 10000,
  },
})

const editorRef = shallowRef()
const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: ['group-video', 'group-lineHeight', 'insertImage', 'fullScreen'],
}
const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入内容...',
  maxLength: props.maxLength,

  MENU_CONF: {
    uploadImage: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: 10,
      async customUpload(file: File, insertFn: InsertFnType) {
        try {
          toast.info('图片上传中')
          const [result] = await uploadFiles(file, FileStore.Forum)
          insertFn(result.path, result.name || '', result.path)
          toast.success('图片上传成功')
        } catch (e) {
          toast.error((e as Error).message || '图片上传失败')
          throw e
        }
      },
    },
  },
}

const value = defineModel<string>('value')

onBeforeUnmount(() => {
  const editor = editorRef.value
  if (editor == null) return
  editor.destroy()
})
function handleCreated(editor: unknown) {
  editorRef.value = editor
}
function getText() {
  return editorRef.value?.getText()
}
function getHtml() {
  return editorRef.value?.getHtml()
}

defineExpose({
  getText,
  getHtml,
})
</script>

<template>
  <div
    class="rounded-lg border border-border overflow-hidden"
    :class="{ 'dark-theme': isDarkMode }"
  >
    <Toolbar
      class="border-b border-border"
      :editor="editorRef"
      :default-config="toolbarConfig"
      :mode="mode"
    />
    <Editor
      v-model="value"
      style="height: 500px; overflow-y: hidden"
      :default-config="editorConfig"
      :mode="mode"
      @on-created="handleCreated"
    />
  </div>
</template>
