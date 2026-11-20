<script setup lang="ts">
import ArrowDown20Filled from '@vicons/fluent/es/ArrowDown20Filled'
import ArrowUp20Filled from '@vicons/fluent/es/ArrowUp20Filled'
import Delete20Filled from '@vicons/fluent/es/Delete20Filled'
import { ref, watch } from 'vue'

import type { DecorativeImageProperties } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Card, CardFooter, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { ImagePreview } from '@/shared/ui/image-preview'
import { ImageUpload, type UploadImageItem } from '@/shared/ui/image-upload'
import { NumberField } from '@/shared/ui/number-field'
import { Slider } from '@/shared/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
      v-for="(image, idx) in images"
      :key="image.id"
      class="cursor-pointer transition-all border"
      :class="selectedImageId === image.id ? 'border-primary ring-1 ring-primary/30' : 'hover:border-input'"
      @click="selectedImageId = selectedImageId === image.id ? undefined : image.id"
    >
      <CardHeader class="p-3">
        <div class="flex-between">
          <div class="flex items-center gap-2.5 min-w-0">
            <ImagePreview
              :src="image.path"
              :alt="image.name || `图片 #${image.id}`"
              :gallery="images"
              :index="idx"
              wrapper-class="shrink-0"
            >
              <template #default="{ open, thumbSrc, onError }">
                <button
                  type="button"
                  class="size-10 rounded overflow-hidden border border-border shrink-0 cursor-zoom-in p-0 bg-muted/20 focus:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  :aria-label="`放大查看 ${image.name || `图片 #${image.id}`}`"
                  @click.stop="open()"
                >
                  <img
                    :src="thumbSrc || undefined"
                    :alt="image.name"
                    class="size-full object-cover"
                    @error="onError"
                  />
                </button>
              </template>
            </ImagePreview>
            <span class="text-xs font-medium text-foreground truncate max-w-[200px]">
              {{ image.name || `图片 #${image.id}` }}
            </span>
          </div>

          <TooltipProvider>
            <div class="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground"
                    aria-label="下移一层"
                    :disabled="disabled"
                    @click.stop="moveImage(image.id, -1)"
                  >
                    <ArrowDown20Filled class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>下移一层</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-muted-foreground"
                    aria-label="上移一层"
                    :disabled="disabled"
                    @click.stop="moveImage(image.id, 1)"
                  >
                    <ArrowUp20Filled class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>上移一层</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    class="text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                    aria-label="删除"
                    :disabled="disabled"
                    @click.stop="removeImage(image.id)"
                  >
                    <Delete20Filled class="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>删除</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardFooter
        v-if="selectedImageId === image.id"
        class="p-3 flex flex-col gap-3 border-t bg-muted/10"
      >
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full pt-3">
          <FormField
            label="X (%)"
            class="min-w-0"
          >
            <NumberField
              :model-value="image.x"
              :disabled="disabled"
              :min="0"
              :max="100"
              class="w-full"
              @update:model-value="updateImage(image.id, { x: $event ?? 0 })"
            />
          </FormField>
          <FormField
            label="Y (%)"
            class="min-w-0"
          >
            <NumberField
              :model-value="image.y"
              :disabled="disabled"
              :min="0"
              :max="100"
              class="w-full"
              @update:model-value="updateImage(image.id, { y: $event ?? 0 })"
            />
          </FormField>
          <FormField
            label="宽度 (%)"
            class="min-w-0"
          >
            <NumberField
              :model-value="image.width"
              :disabled="disabled"
              :min="1"
              class="w-full"
              @update:model-value="updateImage(image.id, { width: $event ?? 1 })"
            />
          </FormField>
          <FormField
            label="层级"
            class="min-w-0"
          >
            <NumberField
              :model-value="image.zIndex"
              readonly
              class="w-full opacity-60"
            />
          </FormField>
        </div>

        <FormField
          label="旋转"
          :extra="`${image.rotation}°`"
          class="w-full"
        >
          <Slider
            :model-value="[image.rotation]"
            :disabled="disabled"
            :min="-180"
            :max="180"
            :step="1"
            @update:model-value="updateImage(image.id, { rotation: $event?.[0] ?? 0 })"
          />
        </FormField>

        <FormField
          label="透明度"
          :extra="`${Math.round(image.opacity * 100)}%`"
          class="w-full"
        >
          <Slider
            :model-value="[image.opacity]"
            :disabled="disabled"
            :min="0"
            :max="1"
            :step="0.01"
            @update:model-value="updateImage(image.id, { opacity: $event?.[0] ?? 1 })"
          />
        </FormField>
      </CardFooter>
    </Card>
  </div>
</template>
