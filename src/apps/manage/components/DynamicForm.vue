<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { UploadConfig } from '@/api/account'
import type { UploadFileResponse } from '@/api/api-models'
import { UserFileLocation } from '@/api/api-models'
import { uploadFiles, UploadStage } from '@/shared/services/fileUpload'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'
import type { ConfigItemDefinition, DecorativeImageProperties, RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { rgbaToString } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  name?: string
  configData: Record<string, any>
  config?: ConfigItemDefinition[]
  fillHeight?: boolean
}>()

const pendingFiles = ref<Record<string, File[]>>({})
const pendingDecorativeImages = ref<Record<string, File[]>>({})
const selectedImageId = ref<number | null>(null)
const isUploading = ref(false)
const showUploadModal = ref(false)
const uploadStage = ref('')
const uploadProgress = ref(0)
const totalFilesToUpload = ref(0)
const uploadedFilesCount = ref(0)

const visibleItems = computed(() => props.config?.filter((item) => !item.visibleWhen || item.visibleWhen(props.configData)) ?? [])

function selectOptions(item: ConfigItemDefinition) {
  if (item.type !== 'select') return []
  return typeof item.options === 'function' ? item.options(props.configData) : item.options
}

function arrayValue(key: string) {
  return Array.isArray(props.configData[key]) ? props.configData[key].join(', ') : ''
}

function setStringArray(key: string, value: string) {
  props.configData[key] = value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function setNumberArray(key: string, value: string) {
  props.configData[key] = value
    .split(',')
    .map((entry) => Number(entry.trim()))
    .filter(Number.isFinite)
}

function stringToRgba(value: string): RGBAColor {
  const rgba = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgba) {
    return { r: +rgba[1], g: +rgba[2], b: +rgba[3], a: rgba[4] === undefined ? 1 : +rgba[4] }
  }

  const source = value.replace('#', '')
  const hex = source.length <= 4 ? [...source].map((part) => part + part).join('') : source
  if (!/^[a-f\d]{6}(?:[a-f\d]{2})?$/i.test(hex)) return { r: 0, g: 0, b: 0, a: 1 }
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  }
}

function selectFiles(key: string, event: Event, decorative: boolean, limit?: number) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  if (files.some((file) => file.size > 10 * 1024 * 1024)) {
    showErrorToast('文件大小不能超过 10MB')
    input.value = ''
    return
  }

  const target = decorative ? pendingDecorativeImages.value : pendingFiles.value
  const selected = [...(target[key] ?? []), ...files]
  target[key] = limit ? selected.slice(0, limit) : selected
  input.value = ''
}

function removePendingFile(key: string, index: number, decorative: boolean) {
  const target = decorative ? pendingDecorativeImages.value : pendingFiles.value
  target[key] = (target[key] ?? []).filter((_, fileIndex) => fileIndex !== index)
}

function removeUploadedFile(key: string, id: number) {
  props.configData[key] = ((props.configData[key] as UploadFileResponse[]) ?? []).filter((file) => file.id !== id)
}

function updateImage(image: DecorativeImageProperties, key: string, property: keyof DecorativeImageProperties, value: number) {
  props.configData[key] = ((props.configData[key] as DecorativeImageProperties[]) ?? []).map((entry) =>
    entry.id === image.id ? { ...entry, [property]: value } : entry,
  )
}

function removeImage(key: string, id: number) {
  props.configData[key] = ((props.configData[key] as DecorativeImageProperties[]) ?? []).filter((image) => image.id !== id)
  if (selectedImageId.value === id) selectedImageId.value = null
}

function moveImage(key: string, id: number, offset: -1 | 1) {
  const images = [...((props.configData[key] as DecorativeImageProperties[]) ?? [])]
  const index = images.findIndex((image) => image.id === id)
  const destination = index + offset
  if (index < 0 || destination < 0 || destination >= images.length) return
  ;[images[index], images[destination]] = [images[destination], images[index]]
  props.configData[key] = images.map((image, imageIndex) => ({ ...image, zIndex: imageIndex + 1 }))
}

function updateProgress(stage: string, done: number, total: number) {
  uploadStage.value = stage
  uploadedFilesCount.value = done
  uploadProgress.value = total ? Math.round((done / total) * 100) : 0
}

async function uploadAllFiles() {
  const groups = [
    ...Object.entries(pendingFiles.value).map(([key, files]) => ({ key, files, decorative: false })),
    ...Object.entries(pendingDecorativeImages.value).map(([key, files]) => ({ key, files, decorative: true })),
  ].filter((group) => group.files.length)
  const total = groups.reduce((count, group) => count + group.files.length, 0)
  if (!total) return

  totalFilesToUpload.value = total
  showUploadModal.value = true
  let done = 0
  for (const group of groups) {
    const uploaded = await uploadFiles(group.files, undefined, UserFileLocation.Local)
    if (group.decorative) {
      const existing = (props.configData[group.key] as DecorativeImageProperties[]) ?? []
      const additions = uploaded.map((file, index): DecorativeImageProperties => ({
        ...file,
        x: 10 + index * 5,
        y: 10 + index * 5,
        width: 20,
        rotation: 0,
        opacity: 1,
        zIndex: existing.length + index + 1,
      }))
      props.configData[group.key] = [...existing, ...additions]
    } else {
      props.configData[group.key] = uploaded
    }
    done += group.files.length
    updateProgress(UploadStage.Success, done, total)
  }
  pendingFiles.value = {}
  pendingDecorativeImages.value = {}
  showUploadModal.value = false
}

async function submit() {
  isUploading.value = true
  try {
    await uploadAllFiles()
    const saved = await UploadConfig(props.name ?? '', props.configData, true)
    if (!saved) throw new Error('服务端未保存配置')
    props.config?.forEach((item) => {
      const onUploaded = item.onUploaded as undefined | ((value: unknown, config: Record<string, any>) => void)
      onUploaded?.(props.configData[item.key], props.configData)
    })
    showSuccessToast('已保存设置')
  } catch (error) {
    showUploadModal.value = false
    showErrorToast(`保存失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isUploading.value = false
  }
}

onMounted(() => {
  props.config?.forEach((item) => {
    if (!(item.key in props.configData) && item.default !== undefined) props.configData[item.key] = structuredClone(item.default)
  })
})
</script>

<template>
  <UEmpty v-if="!config?.length" icon="i-lucide-settings-2" title="此模板不支持配置" />
  <form v-else class="dynamic-form" :class="{ 'dynamic-form--fill': fillHeight }" @submit.prevent="submit">
    <div class="dynamic-form__actions">
      <UButton type="submit" icon="i-lucide-save" :loading="isUploading" block>保存设置</UButton>
    </div>

    <div class="dynamic-form__content">
      <UFormField v-for="item in visibleItems" :key="item.key" :label="String(item.name)" class="dynamic-form__field">
        <component :is="item.render(configData)" v-if="item.type === 'render'" />

        <template v-else-if="item.type === 'decorativeImages'">
          <label class="file-picker">
            <UIcon name="i-lucide-images" />
            添加装饰图片
            <input type="file" accept="image/*" multiple @change="selectFiles(item.key, $event, true)" />
          </label>
          <div v-if="pendingDecorativeImages[item.key]?.length" class="pending-files">
            <UButton v-for="(file, index) in pendingDecorativeImages[item.key]" :key="`${file.name}-${index}`" color="neutral" variant="soft" size="xs" trailing-icon="i-lucide-x" @click="removePendingFile(item.key, index, true)">{{ file.name }}</UButton>
          </div>
          <UEmpty v-if="!configData[item.key]?.length" icon="i-lucide-image" title="暂无装饰图片" />
          <div v-else class="image-list">
            <article v-for="image in configData[item.key] as DecorativeImageProperties[]" :key="image.id" class="image-card" :class="{ 'image-card--selected': selectedImageId === image.id }" @click="selectedImageId = image.id">
              <header>
                <img :src="image.path" :alt="image.name" />
                <span>{{ image.name || `图片 ${image.id}` }}</span>
                <div class="image-card__actions">
                  <UButton icon="i-lucide-arrow-up" color="neutral" variant="ghost" size="xs" aria-label="上移一层" @click.stop="moveImage(item.key, image.id, 1)" />
                  <UButton icon="i-lucide-arrow-down" color="neutral" variant="ghost" size="xs" aria-label="下移一层" @click.stop="moveImage(item.key, image.id, -1)" />
                  <UButton icon="i-lucide-trash-2" color="error" variant="ghost" size="xs" aria-label="删除" @click.stop="removeImage(item.key, image.id)" />
                </div>
              </header>
              <div v-if="selectedImageId === image.id" class="image-properties">
                <UFormField label="X (%)"><UInputNumber :model-value="image.x" :min="0" :max="100" @update:model-value="updateImage(image, item.key, 'x', $event ?? 0)" /></UFormField>
                <UFormField label="Y (%)"><UInputNumber :model-value="image.y" :min="0" :max="100" @update:model-value="updateImage(image, item.key, 'y', $event ?? 0)" /></UFormField>
                <UFormField label="宽度 (%)"><UInputNumber :model-value="image.width" :min="1" :max="100" @update:model-value="updateImage(image, item.key, 'width', $event ?? 1)" /></UFormField>
                <UFormField label="旋转"><USlider :model-value="image.rotation" :min="-180" :max="180" @update:model-value="updateImage(image, item.key, 'rotation', $event)" /></UFormField>
                <UFormField label="透明度"><USlider :model-value="image.opacity" :min="0" :max="1" :step="0.01" @update:model-value="updateImage(image, item.key, 'opacity', $event)" /></UFormField>
              </div>
            </article>
          </div>
        </template>

        <UTextarea v-else-if="item.type === 'string' && item.inputType === 'textarea'" v-model="configData[item.key]" :placeholder="item.placeholder" autoresize />
        <UInput v-else-if="item.type === 'string'" v-model="configData[item.key]" :type="item.inputType === 'password' ? 'password' : 'text'" :placeholder="item.placeholder" />
        <USelect v-else-if="item.type === 'select'" v-model="configData[item.key]" :items="selectOptions(item)" :placeholder="item.placeholder" />
        <UColorPicker v-else-if="item.type === 'color'" :model-value="rgbaToString(configData[item.key])" @update:model-value="configData[item.key] = stringToRgba($event)" />
        <UInputNumber v-else-if="item.type === 'number'" v-model="configData[item.key]" :min="item.min" :max="item.max" />
        <div v-else-if="item.type === 'sliderNumber'" class="slider-field">
          <USlider v-model="configData[item.key]" :min="item.min" :max="item.max" :step="item.step" />
          <UInputNumber v-model="configData[item.key]" :min="item.min" :max="item.max" :step="item.step" />
        </div>
        <UCheckbox v-else-if="item.type === 'boolean'" v-model="configData[item.key]" label="启用" :description="item.description" />
        <UInput v-else-if="item.type === 'stringArray'" :model-value="arrayValue(item.key)" placeholder="使用逗号分隔" @update:model-value="setStringArray(item.key, $event)" />
        <UInput v-else-if="item.type === 'numberArray'" :model-value="arrayValue(item.key)" placeholder="使用逗号分隔" @update:model-value="setNumberArray(item.key, $event)" />

        <template v-else-if="item.type === 'file'">
          <label class="file-picker">
            <UIcon name="i-lucide-upload" />
            选择文件
            <input type="file" :accept="item.fileType?.join(',')" :multiple="(item.fileLimit ?? 1) > 1" @change="selectFiles(item.key, $event, false, item.fileLimit)" />
          </label>
          <div class="pending-files">
            <UButton v-for="file in configData[item.key] as UploadFileResponse[]" :key="file.id" color="neutral" variant="soft" size="xs" trailing-icon="i-lucide-x" @click="removeUploadedFile(item.key, file.id)">{{ file.name }}</UButton>
            <UButton v-for="(file, index) in pendingFiles[item.key]" :key="`${file.name}-${index}`" color="primary" variant="soft" size="xs" trailing-icon="i-lucide-x" @click="removePendingFile(item.key, index, false)">{{ file.name }}</UButton>
          </div>
        </template>
      </UFormField>
    </div>

    <UModal v-model:open="showUploadModal" title="文件上传进度" :dismissible="false">
      <template #body>
        <div class="upload-progress">
          <span>{{ uploadStage }}</span>
          <UProgress :model-value="uploadProgress" />
          <span>{{ uploadedFilesCount }} / {{ totalFilesToUpload }} 个文件</span>
        </div>
      </template>
    </UModal>
  </form>
</template>

<style scoped>
.dynamic-form { display: flex; flex-direction: column; gap: 1rem; }
.dynamic-form--fill { height: 100%; min-height: 0; }
.dynamic-form__actions { flex: none; }
.dynamic-form__content { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: 1rem; overflow: auto; padding-right: .25rem; }
.dynamic-form--fill .dynamic-form__content { flex: 1; min-height: 0; }
.dynamic-form__field { min-width: 0; }
.file-picker { display: inline-flex; cursor: pointer; align-items: center; gap: .5rem; border: 1px solid var(--vtsuru-border); border-radius: .5rem; padding: .5rem .75rem; color: var(--vtsuru-fg); background: var(--vtsuru-bg-elevated); }
.file-picker input { position: absolute; width: 1px; height: 1px; opacity: 0; }
.pending-files { display: flex; flex-wrap: wrap; gap: .4rem; margin-top: .6rem; }
.image-list { display: grid; gap: .6rem; margin-top: .75rem; }
.image-card { border: 1px solid var(--vtsuru-border); border-radius: .65rem; padding: .65rem; background: var(--vtsuru-bg-elevated); }
.image-card--selected { border-color: var(--vtsuru-brand); box-shadow: 0 0 0 1px var(--vtsuru-brand); }
.image-card header { display: flex; align-items: center; gap: .65rem; }
.image-card img { width: 2.5rem; height: 2.5rem; object-fit: contain; border-radius: .35rem; background: var(--vtsuru-bg-muted); }
.image-card header span { min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.image-card__actions { display: flex; }
.image-properties { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .75rem; margin-top: .75rem; padding-top: .75rem; border-top: 1px solid var(--vtsuru-border); }
.slider-field { display: grid; grid-template-columns: 1fr 6rem; align-items: center; gap: .75rem; }
.upload-progress { display: grid; gap: .75rem; }
@media (max-width: 640px) { .image-properties { grid-template-columns: 1fr; } }
</style>
