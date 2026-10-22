<script setup lang="ts">
import { ArrowDown20Filled, ArrowUp20Filled, Delete20Filled, Image24Regular } from '@vicons/fluent'
import { X } from 'lucide-vue-next'
import { ref, watch } from 'vue'

import type { UploadFileInfo } from '@/shared/types/upload'
import type { DecorativeImageProperties } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Slider } from '@/shared/ui/slider'
import { useMessage } from '@/shared/utils'

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
const fileInputRef = ref<HTMLInputElement>()
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp', 'tiff', 'heic', 'heif'])

watch(
  () => props.images,
  (images) => {
    if (selectedImageId.value && !images.some((image) => image.id === selectedImageId.value)) {
      selectedImageId.value = undefined
    }
  },
)

function onFileInput(e: Event) {
  const target = e.target as HTMLInputElement
  if (!target.files || target.files.length === 0) return
  const newFiles: UploadFileInfo[] = []
  for (let i = 0; i < target.files.length; i++) {
    const file = target.files[i]
    newFiles.push({
      id: `${Date.now()}_${i}`,
      name: file.name,
      file,
      status: 'finished',
      url: URL.createObjectURL(file),
    })
  }
  target.value = ''
  onPendingFilesChange([...props.pendingFiles, ...newFiles])
}

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

function removePendingFile(index: number) {
  const next = [...props.pendingFiles]
  next.splice(index, 1)
  emit('update:pendingFiles', next)
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
  <div class="flex flex-col gap-3 w-full">
    <!-- 上传区域 -->
    <div class="grid grid-cols-4 sm:grid-cols-6 gap-2">
      <div
        v-for="(f, idx) in pendingFiles"
        :key="f.id"
        class="relative aspect-square rounded-md border border-border overflow-hidden group bg-muted/20"
      >
        <img
          :src="f.url"
          :alt="f.name"
          class="w-full h-full object-cover"
        />
        <button
          type="button"
          class="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          @click.stop="removePendingFile(idx)"
        >
          <X class="size-3" />
        </button>
      </div>

      <button
        v-if="pendingFiles.length < 20"
        type="button"
        class="aspect-square flex flex-col items-center justify-center rounded-md border border-dashed border-input hover:border-primary bg-background/50 hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-all cursor-pointer p-2 disabled:opacity-50 disabled:pointer-events-none"
        :disabled="disabled"
        @click="fileInputRef?.click()"
      >
        <Image24Regular class="size-6 mb-1 text-muted-foreground/60" />
        <span class="text-[11px]">添加装饰图片</span>
      </button>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept="image/*"
        class="hidden"
        @change="onFileInput"
      />
    </div>

    <p
      v-if="pendingFiles.length"
      class="text-[11px] text-muted-foreground"
    >
      {{ pendingFiles.length }} 张图片将在保存时上传，可在上方直接移除。
    </p>

    <Empty
      v-if="images.length === 0"
      size="small"
      description="暂无已保存的装饰图片"
    />

    <Card
      v-for="image in images"
      :key="image.id"
      class="cursor-pointer transition-all border"
      :class="selectedImageId === image.id ? 'border-primary ring-1 ring-primary/30' : 'hover:border-input'"
      @click="selectedImageId = selectedImageId === image.id ? undefined : image.id"
    >
      <CardHeader class="p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <img
              :src="image.path"
              :alt="image.name"
              class="size-10 rounded object-cover border border-border shrink-0"
            />
            <span class="text-xs font-medium text-foreground truncate max-w-[200px]">
              {{ image.name || `图片 #${image.id}` }}
            </span>
          </div>

          <div class="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground hover:text-foreground"
              title="下移一层"
              :disabled="disabled"
              @click.stop="moveImage(image.id, -1)"
            >
              <ArrowDown20Filled class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-muted-foreground hover:text-foreground"
              title="上移一层"
              :disabled="disabled"
              @click.stop="moveImage(image.id, 1)"
            >
              <ArrowUp20Filled class="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="size-6 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
              title="删除"
              :disabled="disabled"
              @click.stop="removeImage(image.id)"
            >
              <Delete20Filled class="size-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardFooter
        v-if="selectedImageId === image.id"
        class="p-3 pt-0 flex flex-col gap-3 border-t bg-muted/10"
      >
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-3">
          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground">X (%)</span>
            <NumberField
              :model-value="image.x"
              :disabled="disabled"
              :min="0"
              :max="100"
              class="w-full"
              @update:model-value="updateImage(image.id, { x: $event ?? 0 })"
            />
          </div>
          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground">Y (%)</span>
            <NumberField
              :model-value="image.y"
              :disabled="disabled"
              :min="0"
              :max="100"
              class="w-full"
              @update:model-value="updateImage(image.id, { y: $event ?? 0 })"
            />
          </div>
          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground">宽度 (%)</span>
            <NumberField
              :model-value="image.width"
              :disabled="disabled"
              :min="1"
              class="w-full"
              @update:model-value="updateImage(image.id, { width: $event ?? 1 })"
            />
          </div>
          <div class="space-y-1">
            <span class="text-[11px] text-muted-foreground">层级</span>
            <NumberField
              :model-value="image.zIndex"
              readonly
              class="w-full opacity-60"
            />
          </div>
        </div>

        <div class="space-y-1.5 w-full">
          <div class="flex justify-between text-[11px] text-muted-foreground">
            <span>旋转</span>
            <span>{{ image.rotation }}°</span>
          </div>
          <Slider
            :model-value="[image.rotation]"
            :disabled="disabled"
            :min="-180"
            :max="180"
            :step="1"
            @update:model-value="updateImage(image.id, { rotation: $event?.[0] ?? 0 })"
          />
        </div>

        <div class="space-y-1.5 w-full">
          <div class="flex justify-between text-[11px] text-muted-foreground">
            <span>透明度</span>
            <span>{{ Math.round(image.opacity * 100) }}%</span>
          </div>
          <Slider
            :model-value="[image.opacity]"
            :disabled="disabled"
            :min="0"
            :max="1"
            :step="0.01"
            @update:model-value="updateImage(image.id, { opacity: $event?.[0] ?? 1 })"
          />
        </div>
      </CardFooter>
    </Card>
  </div>
</template>
