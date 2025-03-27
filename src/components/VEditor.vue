<script setup lang="ts">
import { isDarkMode } from '@/Utils'
import { APIRoot } from '@/api/api-models'
import { GetHeaders } from '@/api/query'
import '@/assets/editorDarkMode.css'
import { BASE_URL, VTSURU_API_URL } from '@/data/constants'
import { DomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import '@wangeditor/editor/dist/css/style.css' // 引入 css
import { NotificationReactive, useMessage } from 'naive-ui'
import { onBeforeUnmount, ref, shallowRef, onMounted } from 'vue'

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
const message = useMessage()

const editorRef = shallowRef()
const toolbar = DomEditor.getToolbar(editorRef.value)
const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: ['group-video', 'group-lineHeight', 'insertImage', 'fullScreen'],
}
const uploadProgressRef = ref<NotificationReactive>()
const editorConfig: Partial<IEditorConfig> = {
  placeholder: '请输入内容...',
  maxLength: props.maxLength,

  MENU_CONF: {
    uploadImage: {
      maxFileSize: 10 * 1024 * 1024,
      maxNumberOfFiles: 10,
      async customUpload(file: File, insertFn: InsertFnType) {
        const formData = new FormData() //创建一个FormData实例。
        message.info('图片上传中')
        formData.append('file', file)
        const resp = await fetch(VTSURU_API_URL + 'image/upload', {
          method: 'POST',
          body: formData,
          headers: GetHeaders(),
        })
        if (resp.ok) {
          const data = (await resp.json()) as APIRoot<string>
          if (data.code == 200) {
            insertFn(data.data, '', '')
          } else {
            message.error('图片上传失败: ' + data.message)
          }
        } else {
          message.error('图片上传失败: ' + resp.statusText)
        }
      },
      onProgress(progress: number) {
        console.log(progress)
      },
      onSuccess(file: File, res: any) {
        console.log(`${file.name} 上传成功`, res)
        message.success('图片上传成功')
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
  //editorRef.value?.setHtml(props.defaultValue)
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
    :class="{ 'dark-theme': isDarkMode }"
    style="border: 1px solid #ccc"
  >
    <Toolbar
      ref="toolbarRef"
      style="border-bottom: 1px solid #ccc"
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
