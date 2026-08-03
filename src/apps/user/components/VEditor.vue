<script setup lang="ts">
import type { IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
// @ts-ignore
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { onBeforeUnmount, shallowRef } from 'vue'

import type { APIRoot } from '@/api/api-models'
import { GetHeaders } from '@/api/query'
import { VTSURU_API_URL } from '@/shared/config'
import { isDarkMode } from '@/shared/utils'

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
const toast = useToast()

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
        const formData = new FormData() // 创建一个FormData实例。
        toast.add({ title: '图片上传中', color: 'info' })
        formData.append('file', file)
        const resp = await fetch(`${VTSURU_API_URL}image/upload`, {
          method: 'POST',
          body: formData,
          headers: GetHeaders(),
        })
        if (resp.ok) {
          const data = (await resp.json()) as APIRoot<string>
          if (data.code == 200) {
            insertFn(data.data, '', '')
          } else {
            toast.add({ title: `图片上传失败: ${data.message}`, color: 'error' })
          }
        } else {
          toast.add({ title: `图片上传失败: ${resp.statusText}`, color: 'error' })
        }
      },
      onProgress(progress: number) {
        console.log(progress)
      },
      onSuccess(file: File, res: any) {
        console.log(`${file.name} 上传成功`, res)
        toast.add({ title: '图片上传成功', color: 'success' })
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
onMounted(() => {
  // editorRef.value?.setHtml(props.defaultValue)
})
function handleCreated(editor: unknown) {
  editorRef.value = editor // 记录 editor 实例，重要！
}
function getText() {
  return editorRef.value?.getText()
}
function getHtml() {
  return editorRef.value?.getText()
}

defineExpose({
  getText,
  getHtml,
})
</script>

<template>
  <div
    class="v-editor"
    :class="{ 'dark-theme': isDarkMode }"
  >
    <Toolbar
      class="v-editor__toolbar"
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

<style scoped>
.v-editor {
  overflow: hidden;
  border: var(--vtsuru-page-border, 1px solid var(--vtsuru-border));
  border-radius: var(--vtsuru-page-radius, 8px);
}

.v-editor__toolbar {
  border-bottom: var(--vtsuru-page-border, 1px solid var(--vtsuru-border));
}
</style>
