<script setup lang="ts">
import { getImageUploadModel } from '@/Utils';
import { QueryPostAPI } from '@/api/query';
import { TemplateConfig, TemplateConfigImageItem } from '@/data/VTsuruTypes'
import { FILE_BASE_URL, VTSURU_API_URL } from '@/data/constants';
import { NButton, NEmpty, NForm, NFormItem, NInput, NUpload, UploadFileInfo, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'

const message = useMessage()

const props = defineProps<{
  configData: any
  config: TemplateConfig<any> | undefined
}>()

const fileList = ref<{ [key: string]: UploadFileInfo[] }>({})

const isUploading = ref(false)

function OnFileListChange(key: string, files: UploadFileInfo[]) {
  if (files.length == 1) {
    var file = files[0]
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      fileList.value[key] = []
    }
  }
}
async function onSubmit() {
  try {
    isUploading.value = true
    let images = {} as {
      [key: string]: {
        existImages: string[],
        newImagesBase64: string[],
      }
    }
    for (const item of props.config!.items) {
      if (item.type == 'image') {
        const key = (item as TemplateConfigImageItem<any>).key
        images[key] = await getImageUploadModel(fileList.value[key])
      }
    }
    const resp = await QueryPostAPI<any>(VTSURU_API_URL + 'set-config', {
      name: props.config!.name,
      json: JSON.stringify(props.configData),
      images: images,
    })
    if (resp.code == 200) {
      message.success('已保存至服务器')
      props.config?.items.forEach(item => {
        switch (item.type) {
          case 'image':
            item.onUploaded?.(resp.data[item.key], props.configData)
            break
        }
      })
    } else {
      message.error('保存失败: ' + resp.message)
    }
  } catch (err) {
    message.error('保存失败: ' + err)
  }
  finally {
    isUploading.value = false
  }
}

function getItems() { }
onMounted(() => {
  props.config?.items.forEach(item => {
    if (item.type == 'image') {
      const configItem = props.configData[item.key]
      if (configItem) {
        fileList.value[item.key] = configItem.map((i: string) => ({
          id: i,
          thumbnailUrl: FILE_BASE_URL + i,
          name: '',
          status: 'finished',
        }))
      }
      else {
        fileList.value[item.key] = []
      }
    }
  })
})
</script>

<template>
  <NEmpty
    v-if="!config"
    description="此模板不支持配置"
  />
  <NForm v-else>
    <NFormItem
      v-for="item in config.items"
      :key="item.name.toString()"
      :label="item.name.toString()"
    >
      <component
        :is="item.render(configData)"
        v-if="item.type == 'render'"
      />
      <template v-else-if="item.type == 'string'">
        <NInput
          v-if="item.data"
          :value="configData[item.key]"
          @update:value="configData[item.key] = $event"
        />
        <NInput
          v-else
          v-model:value="configData[item.key]"
        />
      </template>
      <NUpload
        v-else-if="item.type == 'image'"
        v-model:file-list="fileList[item.key]"
        accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico"
        list-type="image-card"
        :default-upload="false"
        :max="item.imageLimit"
        im
        @update:file-list="file => OnFileListChange(item.key, file)"
      >
        上传图片
      </NUpload>
    </NFormItem>
    <NFormItem>
      <NButton
        type="primary"
        :loading="isUploading"
        @click="onSubmit"
      >
        提交
      </NButton>
    </NFormItem>
  </NForm>
</template>
