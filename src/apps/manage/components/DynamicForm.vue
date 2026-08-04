<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import type { SelectOption, UploadFileInfo } from 'naive-ui'
import {
  NButton,
  NCheckbox,
  NColorPicker,
  NEmpty,
  NFlex,
  NForm,
  NGrid,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NProgress,
  NScrollbar,
  NSelect,
  NSlider,
  NText,
  NTooltip,
  NUpload,
  useMessage,
} from 'naive-ui'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { UploadConfig } from '@/api/account'
import type { UploadFileResponse } from '@/api/api-models'
import { UserFileLocation } from '@/api/api-models'
import { uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import type { ConfigItemDefinition, DecorativeImageProperties, RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import DecorativeImageEditor from './DecorativeImageEditor.vue'

const props = defineProps<{
  name?: string
  configData: any
  config: ConfigItemDefinition[] | undefined
  isPublic?: boolean
  // 撑满父容器高度: 表单区滚动, 提交按钮固定底部 (用于分栏布局)
  fillHeight?: boolean
}>()

const emit = defineEmits<{
  'saving-change': [saving: boolean]
  saved: []
}>()

const message = useMessage()

const fileList = ref<{ [key: string]: UploadFileInfo[] }>({})
const decorativeFileList = ref<{ [key: string]: UploadFileInfo[] }>({})
const filePreviews = new Map<File, { key: string; data: UploadFileResponse }>()
const decorativePreviews = new Map<File, { key: string; data: DecorativeImageProperties }>()
const MAX_FILE_SIZE = 10 * 1024 * 1024
const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.gif,.svg,.webp,.ico,.bmp,.tiff,.heic,.heif'
let nextPreviewId = -1

// 上传进度相关
const showUploadModal = ref(false)
const uploadStage = ref('')
const uploadProgress = ref(0)
const totalFilesToUpload = ref(0)
const uploadedFilesCount = ref(0)

const isUploading = ref(false)
let isActive = true

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
  return props.config.filter((item) => isItemVisible(item))
})

// 获取select组件的选项
function getSelectOptions(item: ConfigItemDefinition): SelectOption[] {
  if (item.type !== 'select') return []

  const options = typeof item.options === 'function' ? item.options(props.configData) : item.options

  return options || []
}

function getUploadedFiles(key: string): UploadFileResponse[] {
  const files = props.configData[key]
  return Array.isArray(files) ? files : []
}

function toUploadFileList(files: UploadFileResponse[]): UploadFileInfo[] {
  return files.map((file) => ({
    id: String(file.id),
    thumbnailUrl: file.path,
    name: file.name || '',
    status: 'finished',
  }))
}

function syncUploadedFileList(key: string) {
  fileList.value[key] = toUploadFileList(getUploadedFiles(key))
}

function createPreviewFile(file: File): UploadFileResponse {
  return {
    id: nextPreviewId--,
    path: URL.createObjectURL(file),
    name: file.name,
    hash: '',
    size: file.size,
  }
}

function releasePreview(preview: UploadFileResponse) {
  URL.revokeObjectURL(preview.path)
}

function releaseUnusedPreviews<T extends { key: string; data: UploadFileResponse }>(
  previews: Map<File, T>,
  key: string,
  activeFiles: Set<File>,
) {
  for (const [file, preview] of previews) {
    if (preview.key !== key || activeFiles.has(file)) continue
    releasePreview(preview.data)
    previews.delete(file)
  }
}

function releaseAllPreviews() {
  for (const preview of filePreviews.values()) releasePreview(preview.data)
  for (const preview of decorativePreviews.values()) releasePreview(preview.data)
  filePreviews.clear()
  decorativePreviews.clear()
}

function onFileListChange(item: ConfigItemDefinition, files: UploadFileInfo[]) {
  if (isUploading.value) return
  const extensions = item.type === 'file' && item.fileType?.length ? item.fileType : IMAGE_ACCEPT.split(',')
  const allowedExtensions = new Set(extensions.map((extension) => extension.replace('.', '').toLowerCase()))
  const fingerprints = new Set<string>()
  const acceptedFiles = files.filter((file) => {
    if (!file.file) return true
    const extension = file.name.split('.').pop()?.toLowerCase()
    const fingerprint = `${file.file.name}:${file.file.size}:${file.file.lastModified}`
    if (fingerprints.has(fingerprint)) return false
    fingerprints.add(fingerprint)
    return file.file.size <= MAX_FILE_SIZE && !!extension && allowedExtensions.has(extension)
  })
  if (acceptedFiles.length !== files.length) message.error('仅支持指定格式且不超过 10MB 的文件')

  const uploadedFiles = new Map(
    getUploadedFiles(item.key)
      .filter((file) => file.id >= 0)
      .map((file) => [String(file.id), file]),
  )
  const activeLocalFiles = new Set(acceptedFiles.flatMap((file) => (file.file ? [file.file] : [])))
  releaseUnusedPreviews(filePreviews, item.key, activeLocalFiles)
  const previewFiles = acceptedFiles.map((file) => {
    if (!file.file) return file
    let preview = filePreviews.get(file.file)
    if (!preview) {
      preview = { key: item.key, data: createPreviewFile(file.file) }
      filePreviews.set(file.file, preview)
    }
    return { ...file, url: preview.data.path, thumbnailUrl: preview.data.path }
  })
  fileList.value[item.key] = previewFiles
  props.configData[item.key] = previewFiles.flatMap((file) => {
    if (!file.file) {
      const uploaded = uploadedFiles.get(String(file.id))
      return uploaded ? [uploaded] : []
    }
    return [filePreviews.get(file.file)!.data]
  })
}

function updateDecorativeFiles(key: string, files: UploadFileInfo[]) {
  if (isUploading.value) return
  const activeLocalFiles = new Set(files.flatMap((file) => (file.file ? [file.file] : [])))
  releaseUnusedPreviews(decorativePreviews, key, activeLocalFiles)
  const savedImages = getDecorativeImages(key).filter((image) => image.id >= 0)
  const localImages = files.flatMap((item, index) => {
    if (!item.file) return []
    let preview = decorativePreviews.get(item.file)
    if (!preview) {
      preview = {
        key,
        data: {
          ...createPreviewFile(item.file),
          x: 10 + (savedImages.length + index) * 5,
          y: 10 + (savedImages.length + index) * 5,
          width: 20,
          rotation: 0,
          opacity: 1,
          zIndex: savedImages.length + index + 1,
        },
      }
      decorativePreviews.set(item.file, preview)
    }
    return [getDecorativeImages(key).find((image) => image.id === preview.data.id) ?? preview.data]
  })
  decorativeFileList.value[key] = files.map((item) => {
    if (!item.file) return item
    const path = decorativePreviews.get(item.file)!.data.path
    return { ...item, url: path, thumbnailUrl: path }
  })
  props.configData[key] = [...savedImages, ...localImages]
}

function updateDecorativeImages(key: string, images: DecorativeImageProperties[]) {
  props.configData[key] = images
  const retainedIds = new Set(images.map((image) => image.id))
  decorativeFileList.value[key] = (decorativeFileList.value[key] ?? []).filter((item) => {
    if (!item.file) return false
    const preview = decorativePreviews.get(item.file)
    if (!preview || retainedIds.has(preview.data.id)) return true
    releasePreview(preview.data)
    decorativePreviews.delete(item.file)
    return false
  })
}

function getDecorativeImages(key: string): DecorativeImageProperties[] {
  const images = props.configData[key]
  return Array.isArray(images) ? images : []
}

function getPendingFiles(files: UploadFileInfo[]) {
  return files.flatMap((item) => (item.file ? [item.file] : []))
}

function getFileAccept(item: ConfigItemDefinition) {
  if (item.type !== 'file' || !item.fileType?.length) return IMAGE_ACCEPT
  return item.fileType.map((extension) => (extension.startsWith('.') ? extension : `.${extension}`)).join(',')
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
  const uploadGroups: { key: string; files: File[]; decorative: boolean }[] = []
  for (const [key, files] of Object.entries(fileList.value)) {
    const pendingFiles = getPendingFiles(files)
    if (pendingFiles.length) uploadGroups.push({ key, files: pendingFiles, decorative: false })
  }
  for (const [key, files] of Object.entries(decorativeFileList.value)) {
    const pendingFiles = getPendingFiles(files)
    if (pendingFiles.length) uploadGroups.push({ key, files: pendingFiles, decorative: true })
  }

  const total = uploadGroups.reduce((n, g) => n + g.files.length, 0)
  if (total === 0) return true

  totalFilesToUpload.value = total
  uploadedFilesCount.value = 0
  uploadProgress.value = 0
  showUploadModal.value = true

  let done = 0
  try {
    for (const group of uploadGroups) {
      for (const file of group.files) {
        updateUploadProgress(`${file.name} · ${UploadStage.Preparing}`, done, total)
        const results = await uploadFiles(file, undefined, UserFileLocation.Local, (stage) => {
          updateUploadProgress(`${file.name} · ${stage}`, done, total)
        })
        if (results.length !== 1) throw new Error(`${file.name} 上传结果数量异常`)
        const [result] = results

        if (group.decorative) {
          const preview = decorativePreviews.get(file)
          const current = getDecorativeImages(group.key)
          const currentPreview = current.find((image) => image.id === preview?.data.id)
          const nextImage: DecorativeImageProperties = {
            ...result,
            id: Number(result.id),
            x: currentPreview?.x ?? 10 + current.length * 5,
            y: currentPreview?.y ?? 10 + current.length * 5,
            width: currentPreview?.width ?? 20,
            rotation: currentPreview?.rotation ?? 0,
            opacity: currentPreview?.opacity ?? 1,
            zIndex: currentPreview?.zIndex ?? current.length + 1,
          }
          props.configData[group.key] = current.map((image) => (image.id === preview?.data.id ? nextImage : image))
          decorativeFileList.value[group.key] = decorativeFileList.value[group.key].filter((item) => item.file !== file)
          await nextTick()
          if (preview) {
            releasePreview(preview.data)
            decorativePreviews.delete(file)
          }
        } else {
          const preview = filePreviews.get(file)
          props.configData[group.key] = getUploadedFiles(group.key).map((item) =>
            item.id === preview?.data.id ? result : item,
          )
          const uploadedItem = toUploadFileList([result])[0]
          fileList.value[group.key] = fileList.value[group.key].map((item) =>
            item.file === file ? uploadedItem : item,
          )
          await nextTick()
          if (preview) {
            releasePreview(preview.data)
            filePreviews.delete(file)
          }
        }

        done++
        updateUploadProgress(UploadStage.Success, done, total)
      }
    }

    showUploadModal.value = false
    return true
  } catch (error) {
    message.error(`文件上传失败: ${error instanceof Error ? error.message : String(error)}`)
    updateUploadProgress(UploadStage.Failed)
    return false
  }
}

async function onSubmit() {
  if (isUploading.value) return
  if (!props.name) {
    message.error('缺少配置名称，无法保存')
    return
  }
  try {
    isUploading.value = true
    emit('saving-change', true)

    const uploadSuccess = await uploadAllFiles()
    if (!uploadSuccess || !isActive) return

    const success = await UploadConfig(props.name, props.configData, props.isPublic ?? true)
    if (!isActive) return

    if (success) {
      message.success('已保存设置')
      props.config?.forEach((item) => {
        const onUploaded = item.onUploaded as undefined | ((data: any, config: any) => void)
        onUploaded?.(props.configData[item.key], props.configData)
      })
      emit('saved')
    } else {
      message.error('保存失败')
    }
  } catch (err) {
    message.error(`保存失败: ${err}`)
  } finally {
    isUploading.value = false
    emit('saving-change', false)
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
  const expand = (s: string) => (s.length <= 4 ? [...s].map((c) => c + c).join('') : s)
  const full = expand(hex)
  if (/^[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(full)) {
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

function initializeForm() {
  releaseAllPreviews()
  fileList.value = {}
  decorativeFileList.value = {}
  props.config?.forEach((item) => {
    if (item.default !== undefined && !(item.key in props.configData)) {
      props.configData[item.key] = structuredClone(item.default)
    }
    if (item.type === 'file') {
      syncUploadedFileList(item.key)
    } else if (item.type === 'decorativeImages') {
      decorativeFileList.value[item.key] = []
    }
  })
}

watch([() => props.name, () => props.configData, () => props.config], initializeForm, { immediate: true })

onBeforeUnmount(() => {
  isActive = false
  releaseAllPreviews()
  if (isUploading.value) emit('saving-change', false)
})
</script>

<template>
  <NEmpty
    v-if="!config || config.length === 0"
    description="此模板不支持配置"
  />
  <NForm
    v-else
    :disabled="isUploading"
    :class="{ 'dynamic-form--fill': fillHeight }"
  >
    <div class="dynamic-form__footer">
      <NButton
        type="primary"
        :loading="isUploading"
        @click="onSubmit"
      >
        提交
      </NButton>
    </div>

    <NScrollbar
      class="dynamic-form__scroll"
      :inert="isUploading"
    >
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
          <DecorativeImageEditor
            v-else-if="item.type === 'decorativeImages'"
            :images="getDecorativeImages(item.key)"
            :pending-files="decorativeFileList[item.key] ?? []"
            :disabled="isUploading"
            :max-file-size="MAX_FILE_SIZE"
            @update:images="updateDecorativeImages(item.key, $event)"
            @update:pending-files="updateDecorativeFiles(item.key, $event)"
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
          <NFlex
            v-else-if="item.type === 'boolean'"
            align="center"
            :size="6"
          >
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
                <NIcon
                  :component="Info24Filled"
                  :depth="3"
                />
              </template>
              {{ item.description }}
            </NTooltip>
          </NFlex>
          <NUpload
            v-else-if="item.type === 'file'"
            v-model:file-list="fileList[item.key]"
            :accept="getFileAccept(item)"
            list-type="image-card"
            :default-upload="false"
            :max="item.fileLimit"
            @update:file-list="(files) => onFileListChange(item, files)"
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
          :status="uploadStage === UploadStage.Failed ? 'error' : undefined"
        />
        <NText v-if="totalFilesToUpload > 0"> {{ uploadedFilesCount }} / {{ totalFilesToUpload }} 个文件 </NText>
        <NButton
          v-if="uploadStage === UploadStage.Failed"
          @click="showUploadModal = false"
        >
          关闭
        </NButton>
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
  border-bottom: 1px solid var(--vtsuru-border, rgba(148, 163, 184, 0.22));
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
