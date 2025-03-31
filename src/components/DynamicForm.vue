<script setup lang="ts">
  import { getImageUploadModel } from '@/Utils';
  import { QueryPostAPI } from '@/api/query';
  import { ConfigItemDefinition, TemplateConfigImageItem } from '@/data/VTsuruTypes';
  import { FILE_BASE_URL, VTSURU_API_URL } from '@/data/constants';
  import { NButton, NColorPicker, NEmpty, NForm, NFormItem, NGrid, NInput, NInputNumber, NSlider, NUpload, UploadFileInfo, useMessage } from 'naive-ui';
  import { onMounted, ref } from 'vue';

  const message = useMessage();

  const props = defineProps<{
    name?: string;
    configData: any;
    config: ConfigItemDefinition[] | undefined;
  }>();

  const fileList = ref<{ [key: string]: UploadFileInfo[]; }>({});

  const isUploading = ref(false);

  function OnFileListChange(key: string, files: UploadFileInfo[]) {
    if (files.length == 1) {
      var file = files[0];
      if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
        message.error('文件大小不能超过10MB');
        fileList.value[key] = [];
      }
    }
  }
  async function onSubmit() {
    try {
      isUploading.value = true;
      let images = {} as {
        [key: string]: {
          existImages: string[],
          newImagesBase64: string[],
        };
      };
      for (const item of props.config!) {
        if (item.type == 'image') {
          const key = (item as TemplateConfigImageItem<any>).key;
          images[key] = await getImageUploadModel(fileList.value[key]);
        }
      }
      const resp = await QueryPostAPI<any>(VTSURU_API_URL + 'set-config', {
        name: props.name,
        json: JSON.stringify(props.configData),
        images: images,
        public: 'true',
      });
      if (resp.code == 200) {
        message.success('已保存设置');
        props.config?.forEach(item => {
          if (item.type === 'render') {
            item.onUploaded?.(props.configData[item.key], props.configData);
          }
          else {
            item.onUploaded?.call(item, props.configData[item.key], props.configData);
          }
        });
      } else {
        message.error('保存失败: ' + resp.message);
      }
    } catch (err) {
      message.error('保存失败: ' + err);
    }
    finally {
      isUploading.value = false;
    }
  }

  function getItems() { }
  onMounted(() => {
    props.config?.forEach(item => {
      if (item.default && !props.configData[item.key]) {
        props.configData[item.key] = item.default;
      }
      if (item.type == 'image') {
        const configItem = props.configData[item.key];
        if (configItem) {
          fileList.value[item.key] = configItem.map((i: string) => ({
            id: i,
            thumbnailUrl: FILE_BASE_URL + i,
            name: '',
            status: 'finished',
          }));
        }
        else {
          fileList.value[item.key] = [];
        }
      }
    });
  });
</script>

<template>
  <NEmpty
    v-if="!config || config.length == 0"
    description="此模板不支持配置"
  />
  <NForm v-else>
    <NGrid
      x-gap="10"
      y-gap="10"
      cols="1 600:2 1200:3 1600:4"
    >
      <NFormItemGi
        v-for="item in config"
        :key="item.name.toString()"
        :label="item.name.toString()"
      >
        <component
          :is="item.render(configData)"
          v-if="item.type == 'render'"
        />
        <template v-else-if="item.type == 'string'">
          <NInput
            :value="configData[item.key]"
            :placeholder="item.placeholder"
            @update:value="configData[item.key] = $event"
            :type="item.inputType"
          />
        </template>
        <NColorPicker
          v-else-if="item.type == 'color'"
          :value="configData[item.key]"
          :show-alpha="item.showAlpha ?? false"
          @update:value="configData[item.key] = $event"
        />
        <NInputNumber
          v-else-if="item.type == 'number'"
          :value="configData[item.key]"
          :min="item.min"
          @update:value="configData[item.key] = $event"
        />
        <NSlider
          v-else-if="item.type == 'sliderNumber'"
          :value="configData[item.key]"
          :min="item.min"
          :max="item.max"
          :step="item.step"
          @update:value="configData[item.key] = $event"
        />
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
      </NFormItemGi>
    </NGrid>

    <NButton
      type="primary"
      :loading="isUploading"
      @click="onSubmit"
    >
      提交
    </NButton>
  </NForm>
</template>
