<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { UploadConfig } from '@/api/account'
import type { APIFileModel } from '@/api/generated/model'
import { FileStore, uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import type {
  ConfigItemDefinition,
  DecorativeImageProperties,
  RGBAColor,
  SelectOption,
} from '@/shared/types/VTsuruConfigTypes'
import { rgbaToString } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import {
  acquireFilePreviewUrl,
  fromRemoteImageList,
  getPendingUploadFiles,
  ImageUpload,
  releaseFilePreviewUrl,
  type UploadImageItem,
} from '@/shared/ui/image-upload'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

import DecorativeImageEditor from './DecorativeImageEditor.vue'

const props = defineProps<{
  name?: string
  configData: any
  config: ConfigItemDefinition[] | undefined
  isPublic?: boolean
  fillHeight?: boolean
}>()

const emit = defineEmits<{
  'saving-change': [saving: boolean]
  saved: []
}>()

const message = useMessage()

const fileList = ref<{ [key: string]: UploadImageItem[] }>({})
const decorativeFileList = ref<{ [key: string]: UploadImageItem[] }>({})
const filePreviews = new Map<File, { key: string; data: APIFileModel }>()
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

function isItemVisible(item: ConfigItemDefinition): boolean {
  if (!item.visibleWhen) return true
  try {
    return item.visibleWhen(props.configData)
  } catch (err) {
    console.error(`执行条件显示判断出错: ${err}`)
    return true
  }
}

const visibleItems = computed(() => {
  if (!props.config) return []
  return props.config.filter((item) => isItemVisible(item))
})

function getSelectOptions(item: ConfigItemDefinition): SelectOption[] {
  if (item.type !== 'select') return []
  const options = typeof item.options === 'function' ? item.options(props.configData) : item.options
  return options || []
}

const SELECT_CLEAR_VALUE = '__vtsuru_select_clear__'

function getSelectValue(item: ConfigItemDefinition): string {
  const val = props.configData[item.key]
  if (val === undefined || val === null || val === '') {
    return SELECT_CLEAR_VALUE
  }
  return String(val)
}

function setSelectValue(item: ConfigItemDefinition, value: unknown) {
  const strVal = String(value ?? '')
  if (strVal === SELECT_CLEAR_VALUE) {
    props.configData[item.key] = undefined
    return
  }
  const options = getSelectOptions(item)
  const match = options.find((opt) => String(opt.value) === strVal)
  props.configData[item.key] = match ? match.value : strVal
}

function getOptionSafeValue(val: unknown): string {
  if (val === undefined || val === null || val === '') {
    return SELECT_CLEAR_VALUE
  }
  return String(val)
}

function getUploadedFiles(key: string): APIFileModel[] {
  const files = props.configData[key]
  return Array.isArray(files) ? files : []
}

function toUploadFileList(files: APIFileModel[]): UploadImageItem[] {
  return fromRemoteImageList(files, '文件')
}

function syncUploadedFileList(key: string) {
  fileList.value[key] = toUploadFileList(getUploadedFiles(key))
}

function createPreviewFile(file: File): APIFileModel {
  return {
    id: nextPreviewId--,
    path: acquireFilePreviewUrl(file),
    name: file.name,
    hash: '',
    size: file.size,
  }
}

function releaseAllPreviews() {
  for (const file of filePreviews.keys()) releaseFilePreviewUrl(file)
  for (const file of decorativePreviews.keys()) releaseFilePreviewUrl(file)
  filePreviews.clear()
  decorativePreviews.clear()
}

function releaseUnusedPreviews() {
  const activeFiles = new Set<File>()
  for (const files of Object.values(fileList.value)) {
    for (const item of files) if (item.kind === 'local') activeFiles.add(item.file)
  }
  for (const files of Object.values(decorativeFileList.value)) {
    for (const item of files) if (item.kind === 'local') activeFiles.add(item.file)
  }
  for (const file of [...filePreviews.keys()]) {
    if (!activeFiles.has(file)) {
      releaseFilePreviewUrl(file)
      filePreviews.delete(file)
    }
  }
  for (const file of [...decorativePreviews.keys()]) {
    if (!activeFiles.has(file)) {
      releaseFilePreviewUrl(file)
      decorativePreviews.delete(file)
    }
  }
}

function onFileListChange(item: ConfigItemDefinition, files: UploadImageItem[]) {
  if (isUploading.value) return
  fileList.value[item.key] = files

  const existingUploaded = files
    .filter((entry) => entry.kind === 'remote')
    .map((entry) => getUploadedFiles(item.key).find((itemFile) => String(itemFile.id) === entry.id))
    .filter((file): file is APIFileModel => !!file)

  const previewItems: APIFileModel[] = []
  for (const entry of files) {
    if (entry.kind !== 'local') continue
    let preview = filePreviews.get(entry.file)
    if (!preview) {
      preview = { key: item.key, data: createPreviewFile(entry.file) }
      filePreviews.set(entry.file, preview)
    }
    previewItems.push(preview.data)
  }

  props.configData[item.key] = [...existingUploaded, ...previewItems]
  releaseUnusedPreviews()
}

function getDecorativeImages(key: string): DecorativeImageProperties[] {
  const images = props.configData[key]
  return Array.isArray(images) ? images : []
}

function updateDecorativeImages(key: string, images: DecorativeImageProperties[]) {
  props.configData[key] = images
  const activeIds = new Set(images.map((image) => image.id))
  const currentFiles = decorativeFileList.value[key] ?? []
  if (currentFiles.length) {
    decorativeFileList.value[key] = currentFiles.filter((item) => {
      if (item.kind !== 'local') return false
      const preview = decorativePreviews.get(item.file)
      return !preview || activeIds.has(preview.data.id)
    })
  }
  releaseUnusedPreviews()
}

function updateDecorativeFiles(key: string, files: UploadImageItem[]) {
  if (isUploading.value) return
  decorativeFileList.value[key] = files

  const currentImages = getDecorativeImages(key)
  const savedImages = currentImages.filter((image) => image.id > 0)
  const existingLocalById = new Map(currentImages.filter((image) => image.id <= 0).map((image) => [image.id, image]))
  const localImages: DecorativeImageProperties[] = []

  for (const item of files) {
    if (item.kind !== 'local') continue
    let preview = decorativePreviews.get(item.file)
    if (!preview) {
      const index = savedImages.length + localImages.length
      preview = {
        key,
        data: {
          ...createPreviewFile(item.file),
          x: 10 + index * 5,
          y: 10 + index * 5,
          width: 20,
          rotation: 0,
          opacity: 1,
          zIndex: index + 1,
        },
      }
      decorativePreviews.set(item.file, preview)
    } else {
      const latest = existingLocalById.get(preview.data.id)
      if (latest) preview.data = latest
    }
    localImages.push(preview.data)
  }

  props.configData[key] = [...savedImages, ...localImages].map((image, index) => ({
    ...image,
    zIndex: index + 1,
  }))
  releaseUnusedPreviews()
}

function updateUploadProgress(stage: string, done?: number, total?: number) {
  uploadStage.value = stage
  if (done !== undefined && total !== undefined && total > 0) {
    uploadedFilesCount.value = done
    uploadProgress.value = Math.round((done / total) * 100)
  }
}

async function uploadAllFiles() {
  const uploadGroups: { key: string; files: File[]; decorative: boolean }[] = []
  for (const [key, files] of Object.entries(fileList.value)) {
    const pendingFiles = getPendingUploadFiles(files)
    if (pendingFiles.length) uploadGroups.push({ key, files: pendingFiles, decorative: false })
  }
  for (const [key, files] of Object.entries(decorativeFileList.value)) {
    const pendingFiles = getPendingUploadFiles(files)
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
        const results = await uploadFiles(file, FileStore.Configs, (stage) => {
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
          decorativeFileList.value[group.key] = decorativeFileList.value[group.key].filter(
            (item) => !(item.kind === 'local' && item.file === file),
          )
          await nextTick()
          if (preview) {
            releaseFilePreviewUrl(file)
            decorativePreviews.delete(file)
          }
        } else {
          const preview = filePreviews.get(file)
          props.configData[group.key] = getUploadedFiles(group.key).map((item) =>
            item.id === preview?.data.id ? result : item,
          )
          const uploadedItem = toUploadFileList([result])[0]
          fileList.value[group.key] = fileList.value[group.key].map((item) =>
            item.kind === 'local' && item.file === file ? uploadedItem : item,
          )
          await nextTick()
          if (preview) {
            releaseFilePreviewUrl(file)
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

function stringToRgba(colorString: string | null | undefined): RGBAColor {
  const fallback: RGBAColor = { r: 0, g: 0, b: 0, a: 1 }
  if (!colorString) return fallback

  const rgba = colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] !== undefined ? +rgba[4] : 1 }
  }

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
  <Empty
    v-if="!config || config.length === 0"
    description="此模板不支持配置"
  />
  <form
    v-else
    class="flex flex-col w-full min-w-0"
    :class="{ 'h-full min-h-0': fillHeight }"
    @submit.prevent="onSubmit"
  >
    <!-- 分栏模式下置顶操作条 -->
    <div
      v-if="fillHeight"
      class="dynamic-form__header flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0"
    >
      <span class="text-xs font-semibold text-foreground">模板配置</span>
      <Button
        type="submit"
        :disabled="isUploading"
        class="h-7 text-xs px-3"
      >
        {{ isUploading ? '保存中...' : '提交' }}
      </Button>
    </div>

    <!-- 表单字段内容区 -->
    <div
      class="flex-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin"
      :class="fillHeight ? 'p-4' : 'pr-1'"
    >
      <div
        class="grid gap-4"
        :class="fillHeight ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'"
      >
        <div
          v-for="item in visibleItems"
          :key="item.name.toString()"
          class="space-y-1.5 min-w-0"
          :class="item.type === 'decorativeImages' || item.type === 'file' || fillHeight ? 'col-span-full' : ''"
        >
          <label class="text-xs font-medium text-foreground block">
            {{ item.name.toString() }}
          </label>

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

          <Input
            v-else-if="item.type === 'string'"
            v-model="configData[item.key]"
            :placeholder="item.placeholder"
            :type="item.inputType || 'text'"
          />

          <Select
            v-else-if="item.type === 'select'"
            :model-value="getSelectValue(item)"
            @update:model-value="setSelectValue(item, $event)"
          >
            <SelectTrigger>
              <SelectValue :placeholder="item.placeholder || '请选择'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-if="item.clearable"
                :value="SELECT_CLEAR_VALUE"
              >
                请选择
              </SelectItem>
              <SelectItem
                v-for="opt in getSelectOptions(item)"
                :key="String(opt.value)"
                :value="getOptionSafeValue(opt.value)"
                :disabled="opt.disabled"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <ColorPicker
            v-else-if="item.type === 'color'"
            :model-value="safeRgbaToString(configData[item.key])"
            :show-alpha="item.showAlpha ?? false"
            @update:model-value="configData[item.key] = stringToRgba($event)"
          />

          <NumberField
            v-else-if="item.type === 'number'"
            :model-value="configData[item.key]"
            :min="item.min"
            class="w-full"
            @update:model-value="configData[item.key] = $event"
          />

          <div
            v-else-if="item.type === 'sliderNumber'"
            class="space-y-1.5 pt-1"
          >
            <div class="flex justify-between text-[11px] text-muted-foreground">
              <span>数值</span>
              <span>{{ configData[item.key] ?? 0 }}</span>
            </div>
            <Slider
              :model-value="[configData[item.key] ?? 0]"
              :min="item.min ?? 0"
              :max="item.max ?? 100"
              :step="item.step ?? 1"
              @update:model-value="configData[item.key] = $event?.[0] ?? 0"
            />
          </div>

          <div
            v-else-if="item.type === 'boolean'"
            class="flex items-center gap-2 pt-1"
          >
            <Checkbox
              :checked="configData[item.key]"
              @update:checked="configData[item.key] = $event"
            />
            <span
              class="text-xs text-foreground cursor-pointer"
              @click="configData[item.key] = !configData[item.key]"
            >
              启用
            </span>
            <TooltipProvider v-if="item.description">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p class="text-xs">{{ item.description }}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <!-- 文件上传区 -->
          <div
            v-else-if="item.type === 'file'"
            class="space-y-2"
          >
            <ImageUpload
              :model-value="fileList[item.key] ?? []"
              :max-files="item.fileLimit"
              :max-size="MAX_FILE_SIZE"
              :accept="item.fileType?.length ? item.fileType : IMAGE_ACCEPT"
              :disabled="isUploading"
              size="grid"
              :grid-class="fillHeight ? 'grid-cols-3' : 'grid-cols-4 sm:grid-cols-6'"
              placeholder="上传文件"
              @update:model-value="(files) => onFileListChange(item, files)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗模式下置底操作条 -->
    <div
      v-if="!fillHeight"
      class="dynamic-form__footer flex justify-end pt-4 border-t border-border mt-4"
    >
      <Button
        type="submit"
        :disabled="isUploading"
      >
        {{ isUploading ? '保存中...' : '提交' }}
      </Button>
    </div>

    <!-- 上传进度模态框 -->
    <Dialog :open="showUploadModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">文件上传进度</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 py-2">
          <p class="text-xs text-muted-foreground">{{ uploadStage }}</p>
          <Progress
            :model-value="uploadProgress"
            class="h-2"
          />
          <p
            v-if="totalFilesToUpload > 0"
            class="text-xs text-muted-foreground"
          >
            {{ uploadedFilesCount }} / {{ totalFilesToUpload }} 个文件
          </p>
          <div
            v-if="uploadStage === UploadStage.Failed"
            class="flex justify-end pt-2"
          >
            <Button
              variant="outline"
              @click="showUploadModal = false"
            >
              关闭
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </form>
</template>
