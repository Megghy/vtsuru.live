<script setup lang="ts">
import { ArrowDown20Filled, ArrowUp20Filled, Delete20Filled } from '@vicons/fluent'
import type { UploadFileInfo } from 'naive-ui'
import { NButton, NCard, NEmpty, NFlex, NIcon, NInputNumber, NSlider, NText, NUpload, useMessage } from 'naive-ui'
import { ref, watch } from 'vue'

import type { DecorativeImageProperties } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  images: DecorativeImageProperties[]
  pendingFiles: UploadFileInfo[]
  disabled?: boolean
  maxFileSize: number
}>()

const emit = defineEmits<{
  'update:images': [images: DecorativeImageProperties[]]
  'update:pendingFiles': [files: UploadFileInfo[]]
}>()

const message = useMessage()
const selectedImageId = ref<number>()
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'heic', 'heif'])

watch(
  () => props.images,
  (images) => {
    if (selectedImageId.value && !images.some((image) => image.id === selectedImageId.value)) {
      selectedImageId.value = undefined
    }
  },
)

function onPendingFilesChange(files: UploadFileInfo[]) {
  const fingerprints = new Set<string>()
  const accepted = files.filter((item) => {
    if (!item.file) return false
    const extension = item.name.split('.').pop()?.toLowerCase()
    const fingerprint = `${item.file.name}:${item.file.size}:${item.file.lastModified}`
    if (fingerprints.has(fingerprint)) return false
    fingerprints.add(fingerprint)
    return item.file.size <= props.maxFileSize && !!extension && IMAGE_EXTENSIONS.has(extension)
  })
  if (accepted.length !== files.length) message.error('仅支持不超过 10MB 的图片文件')
  emit('update:pendingFiles', accepted)
}

function updateImage(id: number, values: Partial<DecorativeImageProperties>) {
  emit(
    'update:images',
    props.images.map((image) => (image.id === id ? { ...image, ...values } : image)),
  )
}

function removeImage(id: number) {
  emit(
    'update:images',
    props.images.filter((image) => image.id !== id),
  )
}

function moveImage(id: number, offset: -1 | 1) {
  const currentIndex = props.images.findIndex((image) => image.id === id)
  const targetIndex = currentIndex + offset
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= props.images.length) return

  const images = [...props.images]
  ;[images[currentIndex], images[targetIndex]] = [images[targetIndex], images[currentIndex]]
  emit(
    'update:images',
    images.map((image, index) => ({ ...image, zIndex: index + 1 })),
  )
}
</script>

<template>
  <NFlex
    vertical
    :size="12"
    style="width: 100%"
  >
    <NUpload
      :file-list="pendingFiles"
      :disabled="disabled"
      accept="image/*"
      multiple
      list-type="image-card"
      :default-upload="false"
      :max="20"
      @update:file-list="onPendingFilesChange"
    >
      添加装饰图片
    </NUpload>

    <NText
      v-if="pendingFiles.length"
      depth="3"
      class="pending-note"
    >
      {{ pendingFiles.length }} 张图片将在保存时上传，可在上方直接移除。
    </NText>

    <NEmpty
      v-if="images.length === 0"
      size="small"
      description="暂无已保存的装饰图片"
    />

    <NCard
      v-for="image in images"
      :key="image.id"
      size="small"
      :class="['image-card', { 'image-card--selected': selectedImageId === image.id }]"
      @click="selectedImageId = selectedImageId === image.id ? undefined : image.id"
    >
      <NFlex
        justify="space-between"
        align="center"
        :wrap="false"
      >
        <NFlex
          align="center"
          :wrap="false"
          class="image-summary"
        >
          <img
            :src="image.path"
            :alt="image.name"
          />
          <NText class="image-name">{{ image.name || `图片 #${image.id}` }}</NText>
        </NFlex>
        <NFlex :wrap="false">
          <NButton
            circle
            secondary
            size="tiny"
            title="下移一层"
            :disabled="disabled"
            @click.stop="moveImage(image.id, -1)"
          >
            <template #icon><NIcon :component="ArrowDown20Filled" /></template>
          </NButton>
          <NButton
            circle
            secondary
            size="tiny"
            title="上移一层"
            :disabled="disabled"
            @click.stop="moveImage(image.id, 1)"
          >
            <template #icon><NIcon :component="ArrowUp20Filled" /></template>
          </NButton>
          <NButton
            circle
            secondary
            type="error"
            size="tiny"
            title="删除"
            :disabled="disabled"
            @click.stop="removeImage(image.id)"
          >
            <template #icon><NIcon :component="Delete20Filled" /></template>
          </NButton>
        </NFlex>
      </NFlex>

      <template
        v-if="selectedImageId === image.id"
        #footer
      >
        <div class="property-grid">
          <label>
            <span>X (%)</span>
            <NInputNumber
              :value="image.x"
              :disabled="disabled"
              :min="0"
              :max="100"
              size="small"
              @update:value="updateImage(image.id, { x: $event ?? 0 })"
            />
          </label>
          <label>
            <span>Y (%)</span>
            <NInputNumber
              :value="image.y"
              :disabled="disabled"
              :min="0"
              :max="100"
              size="small"
              @update:value="updateImage(image.id, { y: $event ?? 0 })"
            />
          </label>
          <label>
            <span>宽度 (%)</span>
            <NInputNumber
              :value="image.width"
              :disabled="disabled"
              :min="1"
              size="small"
              @update:value="updateImage(image.id, { width: $event ?? 1 })"
            />
          </label>
          <label>
            <span>层级</span>
            <NInputNumber
              :value="image.zIndex"
              size="small"
              readonly
            />
          </label>
        </div>
        <label class="slider-row">
          <span>旋转 {{ image.rotation }}°</span>
          <NSlider
            :value="image.rotation"
            :disabled="disabled"
            :min="-180"
            :max="180"
            @update:value="updateImage(image.id, { rotation: Array.isArray($event) ? $event[0] : $event })"
          />
        </label>
        <label class="slider-row">
          <span>透明度 {{ Math.round(image.opacity * 100) }}%</span>
          <NSlider
            :value="image.opacity"
            :disabled="disabled"
            :min="0"
            :max="1"
            :step="0.01"
            @update:value="updateImage(image.id, { opacity: Array.isArray($event) ? $event[0] : $event })"
          />
        </label>
      </template>
    </NCard>
  </NFlex>
</template>

<style scoped>
.pending-note {
  margin-top: -4px;
}

.image-card {
  cursor: pointer;
  border: 1px solid var(--vtsuru-border);
  transition: border-color 160ms ease;
}

.image-card--selected {
  border-color: var(--vtsuru-brand);
}

.image-summary {
  min-width: 0;
}

.image-summary img {
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  object-fit: contain;
  background: var(--vtsuru-bg-muted);
  border-radius: 6px;
}

.image-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.property-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.property-grid label,
.slider-row {
  display: grid;
  gap: 6px;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}

.slider-row {
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  margin-top: 10px;
}

@media (max-width: 560px) {
  .property-grid {
    grid-template-columns: 1fr;
  }
}
</style>
