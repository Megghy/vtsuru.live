<script setup lang="ts">
import { ArrowDown20Filled, ArrowUp20Filled, Delete20Filled } from '@vicons/fluent'
import { ref, watch } from 'vue'

import type { DecorativeImageProperties } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { NumberField } from '@/shared/ui/number-field'
import { Slider } from '@/shared/ui/slider'

const props = defineProps<{
  images: DecorativeImageProperties[]
  pendingFiles: UploadImageItem[]
  disabled?: boolean
  maxFileSize: number
}>()

const emit = defineEmits<{
  'update:images': [images: DecorativeImageProperties[]]
  'update:pendingFiles': [files: UploadImageItem[]]
}>()

const selectedImageId = ref<number>()

watch(
  () => props.images,
  (images) => {
    if (selectedImageId.value && !images.some((image) => image.id === selectedImageId.value)) {
      selectedImageId.value = undefined
    }
  },
)

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
    <ImageUpload
      :model-value="pendingFiles"
      :max-files="20"
      :max-size="maxFileSize"
      :disabled="disabled"
      size="grid"
      placeholder="添加装饰图片"
      @update:model-value="emit('update:pendingFiles', $event)"
    />

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
