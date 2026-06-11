<script setup lang="ts">
import type { SelectOption, UploadFileInfo } from 'naive-ui'
import type { UploadFileResponse } from '@/api/api-models'
import type { ConfigItemDefinition, DecorativeImageProperties, RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { ArrowDown20Filled, ArrowUp20Filled, Delete20Filled, Info24Filled } from '@vicons/fluent'
import { NButton, NCard, NCheckbox, NColorPicker, NEmpty, NFlex, NForm, NGrid, NIcon, NInput, NInputNumber, NModal, NProgress, NScrollbar, NSelect, NSlider, NText, NTooltip, NUpload, useMessage, useThemeVars } from 'naive-ui';
import { computed, h, onMounted, ref } from 'vue'
import { UploadConfig } from '@/api/account'
import { UserFileLocation } from '@/api/api-models'
import { uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { rgbaToString } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  name?: string
  configData: any
  config: ConfigItemDefinition[] | undefined
  // 撑满父容器高度: 表单区滚动, 提交按钮固定底部 (用于分栏布局)
  fillHeight?: boolean
}>()

const message = useMessage()
const themeVars = useThemeVars()

const fileList = ref<{ [key: string]: UploadFileInfo[] }>({})
// 新增实际文件列表，用于存储待上传的文件
const pendingFiles = ref<{ [key: string]: File[] }>({})
// 新增装饰图片待上传文件
const pendingDecorativeImages = ref<{ [key: string]: File[] }>({})

// 上传进度相关
const showUploadModal = ref(false)
const uploadStage = ref('')
const uploadProgress = ref(0)
const totalFilesToUpload = ref(0)
const uploadedFilesCount = ref(0)

const selectedImageId = ref<number | null>(null)

const isUploading = ref(false)

// 检查配置项是否应该显示
function isItemVisible(item: ConfigItemDefinition): boolean {
  if (!item.visibleWhen) return true
  try {
    return item.visibleWhen(props.configData)
  } catch (err) {
    console.error(`执行条件显示判断出错: ${err}`)
    return true // 错误时默认显示
  }
}

// 计算属性：过滤出应该显示的配置项
const visibleItems = computed(() => {
  if (!props.config) return []
  return props.config.filter(item => isItemVisible(item))
})

// 获取select组件的选项
function getSelectOptions(item: ConfigItemDefinition): SelectOption[] {
  if (item.type !== 'select') return []

  const options = typeof item.options === 'function'
    ? item.options(props.configData)
    : item.options

  return options || []
}

function OnFileListChange(key: string, files: UploadFileInfo[]) {
  if (files.length == 1) {
    const file = files[0]
    if ((file.file?.size ?? 0) > 10 * 1024 * 1024) {
      message.error('文件大小不能超过10MB')
      fileList.value[key] = []
      return
    }

    // 存储文件以便于稍后上传
    if (file.file) {
      if (!pendingFiles.value[key]) {
        pendingFiles.value[key] = []
      }
      pendingFiles.value[key].push(file.file)
    }
  }
}

// 更新上传进度
function updateUploadProgress(stage: string, done?: number, total?: number) {
  uploadStage.value = stage
  if (total !== undefined) totalFilesToUpload.value = total
  if (done !== undefined) {
    uploadedFilesCount.value = done
    uploadProgress.value = totalFilesToUpload.value ? Math.floor((done / totalFilesToUpload.value) * 100) : 0
  }
}

async function uploadAllFiles() {
  // 收集所有待上传分组 (普通文件 + 装饰图片)
  const uploadGroups: { key: string, files: File[], decorative: boolean }[] = []
  for (const key in pendingFiles.value) {
    if (pendingFiles.value[key]?.length) uploadGroups.push({ key, files: pendingFiles.value[key], decorative: false })
  }
  for (const key in pendingDecorativeImages.value) {
    if (pendingDecorativeImages.value[key]?.length) uploadGroups.push({ key, files: pendingDecorativeImages.value[key], decorative: true })
  }

  const total = uploadGroups.reduce((n, g) => n + g.files.length, 0)
  if (total === 0) return true

  totalFilesToUpload.value = total
  uploadedFilesCount.value = 0
  uploadProgress.value = 0
  showUploadModal.value = true

  let done = 0
  try {
    // 串行上传, 每完成一组才推进进度, 保证进度条准确
    for (const g of uploadGroups) {
      const results = await uploadFiles(g.files, undefined, UserFileLocation.Local, (stage) => {
        if (stage === UploadStage.Failed) message.error(`${g.key} 文件上传失败`)
      })

      if (g.decorative) {
        const current = (props.configData[g.key] as DecorativeImageProperties[]) || []
        const newImages: DecorativeImageProperties[] = results.map((result, index) => ({
          id: Number(result.id),
          path: result.path,
          name: result.name,
          hash: result.hash,
          src: result.path,
          x: 10 + index * 5,
          y: 10 + index * 5,
          width: 20,
          rotation: 0,
          opacity: 1,
          zIndex: current.length + index + 1,
        }))
        props.configData[g.key] = [...current, ...newImages]
      } else {
        props.configData[g.key] = results
      }

      done += g.files.length
      updateUploadProgress(UploadStage.Success, done, total)
    }

    setTimeout(() => { showUploadModal.value = false }, 500)
    pendingFiles.value = {}
    pendingDecorativeImages.value = {}
    return true
  } catch (error) {
    message.error(`文件上传失败: ${error instanceof Error ? error.message : String(error)}`)
    updateUploadProgress(UploadStage.Failed)
    setTimeout(() => { showUploadModal.value = false }, 2000)
    return false
  }
}

async function onSubmit() {
  try {
    isUploading.value = true

    // 先上传所有文件
    const uploadSuccess = await uploadAllFiles()
    if (!uploadSuccess) {
      isUploading.value = false
      return
    }

    const success = await UploadConfig(props.name || '', props.configData, true)

    if (success) {
      message.success('已保存设置')
      props.config?.forEach((item) => {
        const onUploaded = item.onUploaded as undefined | ((data: any, config: any) => void)
        onUploaded?.(props.configData[item.key], props.configData)
      })
    } else {
      message.error('保存失败')
    }
  } catch (err) {
    message.error(`保存失败: ${err}`)
  } finally {
    isUploading.value = false
  }
}

// --- 颜色转换 ---
// NColorPicker 统一输出 rgba()/hex 字符串, 这里解析回 RGBAColor 对象存储
function stringToRgba(colorString: string | null | undefined): RGBAColor {
  const fallback: RGBAColor = { r: 0, g: 0, b: 0, a: 1 }
  if (!colorString) return fallback

  const rgba = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? +rgba[4] : 1 }
  }

  // #RGB / #RGBA / #RRGGBB / #RRGGBBAA
  const hex = colorString.replace('#', '')
  const expand = (s: string) => s.length <= 4 ? [...s].map(c => c + c).join('') : s
  const full = expand(hex)
  if (/^[a-f\d]{6}([a-f\d]{2})?$/i.test(full)) {
    return {
      r: Number.parseInt(full.slice(0, 2), 16),
      g: Number.parseInt(full.slice(2, 4), 16),
      b: Number.parseInt(full.slice(4, 6), 16),
      a: full.length === 8 ? Number.parseInt(full.slice(6, 8), 16) / 255 : 1,
    }
  }

  return fallback
}

function safeRgbaToString(color: RGBAColor | null | undefined): string {
  return rgbaToString(color ?? { r: 0, g: 0, b: 0, a: 1 })
}

// 装饰图片功能
function updateImageProp(id: number, prop: keyof DecorativeImageProperties, value: any, key: string) {
  const images = props.configData[key] as DecorativeImageProperties[]
  const index = images.findIndex(img => img.id === id)
  if (index !== -1) {
    const updatedImages = [...images]
    updatedImages[index] = { ...updatedImages[index], [prop]: value }
    props.configData[key] = updatedImages
  }
}

function removeImage(id: number, key: string) {
  const images = props.configData[key] as DecorativeImageProperties[]
  props.configData[key] = images.filter(img => img.id !== id)
  if (selectedImageId.value === id) {
    selectedImageId.value = null
  }
}

function changeZIndex(id: number, direction: 'up' | 'down', key: string) {
  const images = props.configData[key] as DecorativeImageProperties[]
  const index = images.findIndex(img => img.id === id)
  if (index === -1) return
  const newImages = [...images]
  if (direction === 'up' && index < newImages.length - 1) {
    [newImages[index], newImages[index + 1]] = [newImages[index + 1], newImages[index]]
  } else if (direction === 'down' && index > 0) {
    [newImages[index], newImages[index - 1]] = [newImages[index - 1], newImages[index]]
  }
  newImages.forEach((img, i) => img.zIndex = i + 1)
  props.configData[key] = newImages
}

function renderDecorativeImages(key: string) {
  return h(NFlex, { vertical: true, size: 'large' }, () => [
    // 上传按钮
    h(NUpload, {
      'multiple': true,
      'accept': 'image/*',
      'showFileList': false,
      'onUpdate:fileList': (fileList: UploadFileInfo[]) => {
        if (fileList.length > 0) {
          const filesToUpload = fileList.map(f => f.file).filter((f): f is File => f instanceof File)
          if (filesToUpload.length > 0) {
            // 不立即上传，而是存储起来等待提交时上传
            if (!pendingDecorativeImages.value[key]) {
              pendingDecorativeImages.value[key] = []
            }
            pendingDecorativeImages.value[key].push(...filesToUpload)
            message.success(`已选择 ${filesToUpload.length} 个装饰图片，提交时会自动上传`)
          }
        }
        return []
      },
    }, { default: () => h(NButton, null, () => '添加装饰图片') }),

    // 图片列表
    h(NScrollbar, { style: { maxHeight: '300px', marginTop: '10px' } }, () => {
      const images = props.configData[key] as DecorativeImageProperties[] || []
          return images.length > 0
        ? images.map((img: DecorativeImageProperties) => {
            const isSelected = selectedImageId.value === img.id
            return h(NCard, {
              key: img.id,
              size: 'small',
              hoverable: true,
              style: { marginBottom: '10px', cursor: 'pointer', border: isSelected ? `2px solid ${themeVars.value.primaryColor}` : `1px solid ${themeVars.value.borderColor}` },
              onClick: () => selectedImageId.value = img.id,
            }, {
              default: () => h(NFlex, { justify: 'space-between', align: 'center' }, () => [
                h(NFlex, { align: 'center', size: 'small' }, () => [
                  h('img', { src: img.path, style: { width: '40px', height: '40px', objectFit: 'contain', marginRight: '10px', backgroundColor: themeVars.value.inputColor } }),
                  h('span', `ID: ${img.id}`),
                ]),
                h(NFlex, null, () => [
                  h(NButton, { size: 'tiny', circle: true, secondary: true, title: '上移一层', onClick: (e: Event) => {
                    e.stopPropagation(); changeZIndex(img.id, 'up', key)
                  } }, { icon: () => h(NIcon, { component: ArrowUp20Filled }) }),
                  h(NButton, { size: 'tiny', circle: true, secondary: true, title: '下移一层', onClick: (e: Event) => {
                    e.stopPropagation(); changeZIndex(img.id, 'down', key)
                  } }, { icon: () => h(NIcon, { component: ArrowDown20Filled }) }),
                  h(NButton, { size: 'tiny', circle: true, type: 'error', ghost: true, title: '删除', onClick: (e: Event) => {
                    e.stopPropagation(); removeImage(img.id, key)
                  } }, { icon: () => h(NIcon, { component: Delete20Filled }) }),
                ]),
              ]),
              footer: () => isSelected
                ? h(NFlex, { vertical: true, size: 'small', style: { marginTop: '10px' } }, () => [
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, 'X (%):'), h(NInputNumber, { 'value': img.x, 'size': 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'x', v ?? 0, key), 'min': 0, 'max': 100, 'step': 1 })]),
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, 'Y (%):'), h(NInputNumber, { 'value': img.y, 'size': 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'y', v ?? 0, key), 'min': 0, 'max': 100, 'step': 1 })]),
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '宽度(%):'), h(NInputNumber, { 'value': img.width, 'size': 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'width', v ?? 1, key), 'min': 1, 'step': 1 })]),
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '旋转(°):'), h(NInputNumber, { 'value': img.rotation, 'size': 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'rotation', v ?? 0, key), 'min': -360, 'max': 360, 'step': 1 }), h(NSlider, { 'value': img.rotation, 'onUpdate:value': (v: number | number[]) => updateImageProp(img.id, 'rotation', Array.isArray(v) ? v[0] : v ?? 0, key), 'min': -180, 'max': 180, 'step': 1, 'style': { marginLeft: '10px', flexGrow: 1 } })]),
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '透明度:'), h(NInputNumber, { 'value': img.opacity, 'size': 'small', 'onUpdate:value': (v: number | null) => updateImageProp(img.id, 'opacity', v ?? 0, key), 'min': 0, 'max': 1, 'step': 0.01 }), h(NSlider, { 'value': img.opacity, 'onUpdate:value': (v: number | number[]) => updateImageProp(img.id, 'opacity', Array.isArray(v) ? v[0] : v ?? 0, key), 'min': 0, 'max': 1, 'step': 0.01, 'style': { marginLeft: '10px', flexGrow: 1 } })]),
                    h(NFlex, { align: 'center' }, () => [h('span', { style: { width: '50px' } }, '层级:'), h(NInputNumber, { value: img.zIndex, size: 'small', readonly: true })]),
                  ])
                : null,
            })
          })
        : h(NEmpty, { description: '暂无装饰图片' })
    }),
  ])
}

onMounted(() => {
  props.config?.forEach((item) => {
    if (item.default && !(item.key in props.configData)) {
      props.configData[item.key] = item.default
    }
    if (item.type === 'file') {
      const configItem = props.configData[item.key]
      if (configItem) {
        fileList.value[item.key] = configItem.map((uploadedFile: UploadFileResponse) => ({
          id: uploadedFile.id,
          thumbnailUrl: uploadedFile.path,
          name: uploadedFile.name || '',
          status: 'finished',
        }))
      } else {
        fileList.value[item.key] = []
      }
    }
  })
})
</script>

<template>
  <NEmpty
    v-if="!config || config.length === 0"
    description="此模板不支持配置"
  />
  <NForm v-else :class="{ 'dynamic-form--fill': fillHeight }">
    <div class="dynamic-form__footer">
      <NButton
        type="primary"
        :loading="isUploading"
        @click="onSubmit"
      >
        提交
      </NButton>
    </div>

    <NScrollbar class="dynamic-form__scroll">
      <NGrid
        x-gap="12"
        y-gap="16"
        cols="1 600:2 1200:3 1600:4"
      >
        <NFormItemGi
          v-for="item in visibleItems"
          :key="item.name.toString()"
          :label="item.name.toString()"
          class="dynamic-form__item"
        >
          <component
            :is="item.render(configData)"
            v-if="item.type === 'render'"
          />
          <component
            :is="renderDecorativeImages(item.key)"
            v-else-if="item.type === 'decorativeImages'"
          />
          <NInput
            v-else-if="item.type === 'string'"
            :value="configData[item.key]"
            :placeholder="item.placeholder"
            :type="item.inputType"
            @update:value="configData[item.key] = $event"
          />
          <NSelect
            v-else-if="item.type === 'select'"
            :value="configData[item.key]"
            :options="getSelectOptions(item)"
            :placeholder="item.placeholder"
            :clearable="item.clearable"
            @update:value="configData[item.key] = $event"
          />
          <NColorPicker
            v-else-if="item.type === 'color'"
            :value="safeRgbaToString(configData[item.key])"
            :show-alpha="item.showAlpha ?? false"
            @update:value="configData[item.key] = stringToRgba($event)"
          />
          <NInputNumber
            v-else-if="item.type === 'number'"
            :value="configData[item.key]"
            :min="item.min"
            style="width: 100%"
            @update:value="configData[item.key] = $event"
          />
          <NSlider
            v-else-if="item.type === 'sliderNumber'"
            :value="configData[item.key]"
            :min="item.min"
            :max="item.max"
            :step="item.step"
            @update:value="configData[item.key] = $event"
          />
          <NFlex v-else-if="item.type === 'boolean'" align="center" :size="6">
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
                <NIcon :component="Info24Filled" :depth="3" />
              </template>
              {{ item.description }}
            </NTooltip>
          </NFlex>
          <NUpload
            v-else-if="item.type === 'file'"
            v-model:file-list="fileList[item.key]"
            accept=".png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.mp3,.mp4,.pdf,.doc,.docx"
            list-type="image-card"
            :default-upload="false"
            :max="item.fileLimit"
            @update:file-list="file => OnFileListChange(item.key, file)"
          >
            上传文件
          </NUpload>
        </NFormItemGi>
      </NGrid>
    </NScrollbar>

    <!-- 上传进度模态框 -->
    <NModal
      v-model:show="showUploadModal"
      preset="card"
      title="文件上传进度"
      :mask-closable="false"
      :closable="false"
      style="width: 400px"
    >
      <NFlex
        vertical
        size="large"
      >
        <NText>{{ uploadStage }}</NText>
        <NProgress
          type="line"
          :percentage="uploadProgress"
          indicator-placement="inside"
          :show-indicator="true"
        />
        <NText v-if="totalFilesToUpload > 0">
          {{ uploadedFilesCount }} / {{ totalFilesToUpload }} 个文件
        </NText>
      </NFlex>
    </NModal>
  </NForm>
</template>

<style scoped>
/* 表单整体用 flex column, 便于用 order 控制提交栏位置 */
.n-form {
  display: flex;
  flex-direction: column;
}

/* 非 fill: 提交栏在底部 */
.dynamic-form__footer {
  order: 1;
  margin-top: 12px;
}

.dynamic-form__scroll {
  order: 0;
}

.dynamic-form__item :deep(.n-form-item-blank) {
  min-height: unset;
}

/* fill 模式: 撑满父高, 提交栏置顶, 下方表单滚动 */
.dynamic-form--fill {
  height: 100%;
  min-height: 0;
}

.dynamic-form--fill .dynamic-form__footer {
  flex-shrink: 0;
  order: -1;
  margin-top: 0;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color, rgba(148, 163, 184, 0.22));
}

.dynamic-form--fill .dynamic-form__footer :deep(.n-button) {
  width: 100%;
}

.dynamic-form--fill .dynamic-form__scroll {
  flex: 1 1 0;
  min-height: 0;
}

.dynamic-form--fill .dynamic-form__scroll :deep(.n-scrollbar-content) {
  padding-right: 8px;
}
</style>
