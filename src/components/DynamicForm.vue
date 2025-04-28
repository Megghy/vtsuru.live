<script setup lang="ts">
  import { getImageUploadModel } from '@/Utils';
import { QueryPostAPI } from '@/api/query';
import { ConfigItemDefinition, DecorativeImageProperties, TemplateConfigImageItem, RGBAColor, rgbaToString } from '@/data/VTsuruTypes';
import { FILE_BASE_URL, VTSURU_API_URL } from '@/data/constants';
import { ArrowDown20Filled, ArrowUp20Filled, Delete20Filled } from '@vicons/fluent';
import { Info24Filled } from '@vicons/fluent';
import { NButton, NCard, NCheckbox, NColorPicker, NEmpty, NFlex, NForm, NGrid, NIcon, NInput, NInputNumber, NScrollbar, NSlider, NSpace, NTooltip, NUpload, UploadFileInfo, useMessage } from 'naive-ui';
import { h } from 'vue';
import { onMounted, ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

  const message = useMessage();

  const props = defineProps<{
    name?: string;
    configData: any;
    config: ConfigItemDefinition[] | undefined;
  }>();

  const fileList = ref<{ [key: string]: UploadFileInfo[]; }>({});
  const selectedImageId = ref<string | null>(null);

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

  // --- 颜色转换辅助函数 ---
  function stringToRgba(colorString: string | null | undefined): RGBAColor {
    const defaultColor: RGBAColor = { r: 0, g: 0, b: 0, a: 1 }; // 默认黑色不透明
    if (!colorString) return defaultColor;

    try {
      // 尝试匹配 rgba(r, g, b, a)
      const rgbaMatch = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (rgbaMatch) {
        return {
          r: parseInt(rgbaMatch[1], 10),
          g: parseInt(rgbaMatch[2], 10),
          b: parseInt(rgbaMatch[3], 10),
          a: rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1,
        };
      }

      // 尝试匹配 #RRGGBBAA
      const hex8Match = colorString.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (hex8Match) {
        return {
            r: parseInt(hex8Match[1], 16),
            g: parseInt(hex8Match[2], 16),
            b: parseInt(hex8Match[3], 16),
            a: parseInt(hex8Match[4], 16) / 255,
        };
      }

       // 尝试匹配 #RRGGBB
      const hex6Match = colorString.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
      if (hex6Match) {
          return {
              r: parseInt(hex6Match[1], 16),
              g: parseInt(hex6Match[2], 16),
              b: parseInt(hex6Match[3], 16),
              a: 1, // Hex6 doesn't have alpha, assume 1
          };
      }

      // 尝试匹配 #RGBA
        const shortHex4Match = colorString.match(/^#?([a-f\d])([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortHex4Match) {
            return {
                r: parseInt(shortHex4Match[1] + shortHex4Match[1], 16),
                g: parseInt(shortHex4Match[2] + shortHex4Match[2], 16),
                b: parseInt(shortHex4Match[3] + shortHex4Match[3], 16),
                a: parseInt(shortHex4Match[4] + shortHex4Match[4], 16) / 255,
            };
        }

        // 尝试匹配 #RGB
        const shortHex3Match = colorString.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (shortHex3Match) {
            return {
                r: parseInt(shortHex3Match[1] + shortHex3Match[1], 16),
                g: parseInt(shortHex3Match[2] + shortHex3Match[2], 16),
                b: parseInt(shortHex3Match[3] + shortHex3Match[3], 16),
                a: 1, // Hex3 doesn't have alpha, assume 1
            };
        }

      console.warn(`无法解析颜色字符串: "${colorString}", 已返回默认颜色`);
      return defaultColor;
    } catch (e) {
        console.error(`解析颜色字符串 "${colorString}" 时出错:`, e);
        return defaultColor;
    }
  }

  // 确保 rgbaToString 也能处理 null/undefined
  const safeRgbaToString = (color: RGBAColor | null | undefined): string => {
      return rgbaToString(color ?? { r: 0, g: 0, b: 0, a: 1 }); // 提供默认值以防万一
  }

  // 装饰图片功能
  const updateImageProp = (id: string, prop: keyof DecorativeImageProperties, value: any, key: string) => {
    const images = props.configData[key] as DecorativeImageProperties[];
    const index = images.findIndex(img => img.id === id);
    if (index !== -1) {
      const updatedImages = [...images];
      updatedImages[index] = { ...updatedImages[index], [prop]: value };
      props.configData[key] = updatedImages;
    }
  };

  const removeImage = (id: string, key: string) => {
    const images = props.configData[key] as DecorativeImageProperties[];
    props.configData[key] = images.filter(img => img.id !== id);
    if (selectedImageId.value === id) {
      selectedImageId.value = null;
    }
  };

  const changeZIndex = (id: string, direction: 'up' | 'down', key: string) => {
    const images = props.configData[key] as DecorativeImageProperties[];
    const index = images.findIndex(img => img.id === id);
    if (index === -1) return;
    const newImages = [...images];
    if (direction === 'up' && index < newImages.length - 1) {
      [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]];
    } else if (direction === 'down' && index > 0) {
      [newImages[index], newImages[index - 1]] = [newImages[index - 1], newImages[index]];
    }
    newImages.forEach((img, i) => img.zIndex = i + 1);
    props.configData[key] = newImages;
  };

  const renderDecorativeImages = (key: string) => {
    // 获取全局处理器
    const uploadHandler = (window as any).$upload;
    const messageHandler = (window as any).$message ?? message;

    return h(NFlex, { vertical: true, size: 'large' }, () => [
      // 上传按钮
      h(NUpload, {
        multiple: true, accept: 'image/*', showFileList: false,
        'onUpdate:fileList': (fileList: UploadFileInfo[]) => {
          if (uploadHandler?.upload && fileList.length > 0) {
            const filesToUpload = fileList.map(f => f.file).filter((f): f is File => f instanceof File);
            if (filesToUpload.length > 0) {
              uploadHandler.upload(filesToUpload, '/api/file/upload')
                .then((results: any[]) => {
                  const newImages: DecorativeImageProperties[] = results.map((result: any, index: number) => ({
                    id: uuidv4(), src: result.url, x: 10 + index * 5, y: 10 + index * 5,
                    width: 20, rotation: 0, opacity: 1,
                    zIndex: (props.configData[key]?.length ?? 0) + index + 1,
                  }));
                  const currentImages = props.configData[key] as DecorativeImageProperties[] || [];
                  props.configData[key] = [...currentImages, ...newImages];
                })
                .catch((error: any) => {
                  console.error("图片上传失败:", error);
                  messageHandler?.error("图片上传失败: " + (error?.message ?? error));
                });
            }
          }
          return [];
        },
      }, { default: () => h(NButton, null, () => '添加装饰图片') }),

      // 图片列表
      h(NScrollbar, { style: { maxHeight: '300px', marginTop: '10px' } }, () => {
        const images = props.configData[key] as DecorativeImageProperties[] || [];
        return images.length > 0
          ? images.map((img: DecorativeImageProperties) => {
            const isSelected = selectedImageId.value === img.id;
            return h(NCard, {
              key: img.id, size: 'small', hoverable: true,
              style: { marginBottom: '10px', cursor: 'pointer', border: isSelected ? '2px solid var(--primary-color)' : '1px solid #eee' },
              onClick: () => selectedImageId.value = img.id
            }, {
              default: () => h(NFlex, { justify: 'space-between', align: 'center' }, () => [
                h(NFlex, { align: 'center', size: 'small' }, () => [
                  h('img', { src: FILE_BASE_URL + img.src, style: { width: '40px', height: '40px', objectFit: 'contain', marginRight: '10px', backgroundColor: '#f0f0f0' } }),
                  h('span', `ID: ...${img.id.slice(-4)}`)
                ]),
                h(NSpace, null, () => [
                  h(NButton, { size: 'tiny', circle: true, secondary: true, title: '上移一层', onClick: (e: Event) => { e.stopPropagation(); changeZIndex(img.id, 'up', key); } }, { icon: () => h(NIcon, { component: ArrowUp20Filled }) }),
                  h(NButton, { size: 'tiny', circle: true, secondary: true, title: '下移一层', onClick: (e: Event) => { e.stopPropagation(); changeZIndex(img.id, 'down', key); } }, { icon: () => h(NIcon, { component: ArrowDown20Filled }) }),
                  h(NButton, { size: 'tiny', circle: true, type: 'error', ghost: true, title: '删除', onClick: (e: Event) => { e.stopPropagation(); removeImage(img.id, key); } }, { icon: () => h(NIcon, { component: Delete20Filled }) })
                ])
              ]),
              footer: () => isSelected ? h(NFlex, { vertical: true, size: 'small', style: { marginTop: '10px' } }, () => [
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, 'X (%):'), h(NInputNumber, { value: img.x, size: 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'x', v ?? 0, key), min: 0, max: 100, step: 1 })]),
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, 'Y (%):'), h(NInputNumber, { value: img.y, size: 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'y', v ?? 0, key), min: 0, max: 100, step: 1 })]),
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '宽度(%):'), h(NInputNumber, { value: img.width, size: 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'width', v ?? 1, key), min: 1, step: 1 })]),
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '旋转(°):'), h(NInputNumber, { value: img.rotation, size: 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'rotation', v ?? 0, key), min: -360, max: 360, step: 1 }), h(NSlider, { value: img.rotation, 'onUpdate:value': (v: number | number[]) => updateImageProp(img.id, 'rotation', Array.isArray(v) ? v[0] : v ?? 0, key), min: -180, max: 180, step: 1, style: { marginLeft: '10px', flexGrow: 1 } })]),
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '透明度:'), h(NInputNumber, { value: img.opacity, size: 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'opacity', v ?? 0, key), min: 0, max: 1, step: 0.01 }), h(NSlider, { value: img.opacity, 'onUpdate:value': (v: number | number[]) => updateImageProp(img.id, 'opacity', Array.isArray(v) ? v[0] : v ?? 0, key), min: 0, max: 1, step: 0.01, style: { marginLeft: '10px', flexGrow: 1 } })]),
                h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '层级:'), h(NInputNumber, { value: img.zIndex, size: 'small', readonly: true })]),
              ]) : null
            })
          })
          : h(NEmpty, { description: '暂无装饰图片' })
      }),
    ]);
  };

  function getItems() { }
  onMounted(() => {
    props.config?.forEach(item => {
      console.log(props.configData)
      if (item.default && !(item.key in props.configData)) {
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
        <component
          :is="renderDecorativeImages(item.key)"
          v-else-if="item.type == 'decorativeImages'"
        />
        <template v-else-if="item.type == 'string'">
          <NInput
            :value="configData[item.key]"
            :placeholder="item.placeholder"
            :type="item.inputType"
            @update:value="configData[item.key] = $event"
          />
        </template>
        <NColorPicker
          v-else-if="item.type == 'color'"
          :value="safeRgbaToString(configData[item.key])"
          :show-alpha="item.showAlpha ?? false"
          @update:value="configData[item.key] = stringToRgba($event)"
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
        <template v-else-if="item.type == 'boolean'">
          <NCheckbox
            :checked="configData[item.key]"
            @update:checked="configData[item.key] = $event"
          >
            启用
          </NCheckbox>
          <NTooltip
            v-if="item.description"
            placement="top"
          >
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            {{ item.description }}
          </NTooltip>
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
