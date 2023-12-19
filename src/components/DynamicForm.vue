<script setup lang="ts">
import { TemplateConfig } from '@/data/VTsuruTypes'
import { NButton, NEmpty, NForm, NFormItem, NInput, NUpload, UploadFileInfo, useMessage } from 'naive-ui'
import { ref } from 'vue'

const message = useMessage()

const props = defineProps<{
  configData: any
  config: TemplateConfig<any> | undefined
}>()

const fileList = ref<UploadFileInfo[]>([])

function OnFileListChange(files: UploadFileInfo[]) {
  console.log(props.configData)
  if (files.length == 1) {
    var file = files[0]
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      fileList.value = []
    }
  }
}
function onSubmit() {
  console.log(props.configData)
}

function getItems() {}
</script>

<template>
  <NEmpty v-if="!config" description="此模板不支持配置" />
  <NForm v-else>
    <NFormItem v-for="item in config.items" :key="item.name" :label="item.name">
      <component v-if="item.type == 'render'" :is="item.render(configData)"></component>
      <template v-else-if="item.type == 'string'">
        <NInput :value="item.data.get(configData)" @update:value="item.data.set(configData, $event)" />
      </template>
      <NUpload
        v-else-if="item.type == 'image'"
        accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
        list-type="image-card"
        :default-upload="false"
        v-model:file-list="fileList"
        @update:file-list="OnFileListChange"
        :max="item.imageLimit"
      >
        上传图片
      </NUpload>
    </NFormItem>
    <NFormItem>
      <NButton type="primary" @click="onSubmit">提交</NButton>
    </NFormItem>
  </NForm>
</template>
