<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { computed, ref } from 'vue'

import { formatFileSize } from '@/apps/manage/composables/formatters'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Slider } from '@/shared/ui/slider'
import { useMessage } from '@/shared/utils'

const message = useMessage()

interface ImageItem {
  file: File
  originalSize: number
  compressedBlob: Blob | null
  compressedSize: number
  thumbUrl: string
  processing: boolean
}

const items = ref<ImageItem[]>([])
const format = ref<'png' | 'jpeg' | 'webp'>('webp')
const quality = ref(80)
const maxWidth = ref<number | null>(null)
const maxHeight = ref<number | null>(null)

const formatOptions = [
  { label: 'PNG (无损)', value: 'png' },
  { label: 'JPEG (有损)', value: 'jpeg' },
  { label: 'WebP (有损)', value: 'webp' },
]
const isLossy = computed(() => format.value !== 'png')

const dropZoneRef = ref<HTMLElement>()
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: (files) => files && addFiles(files) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'image/*', multiple: true })
onChange((files) => files && addFiles(Array.from(files)))

function addFiles(files: File[]) {
  const imgs = files.filter((f) => f.type.startsWith('image/'))
  if (!imgs.length) return message.warning('未检测到图片文件')
  for (const file of imgs) {
    const thumb = URL.createObjectURL(file)
    items.value.push({
      file,
      originalSize: file.size,
      compressedBlob: null,
      compressedSize: 0,
      thumbUrl: thumb,
      processing: false,
    })
  }
  processAll()
}

async function compressOne(item: ImageItem) {
  item.processing = true
  try {
    const bmp = await createImageBitmap(item.file)
    let w = bmp.width
    let h = bmp.height
    if (maxWidth.value && w > maxWidth.value) {
      h = Math.round(h * (maxWidth.value / w))
      w = maxWidth.value
    }
    if (maxHeight.value && h > maxHeight.value) {
      w = Math.round(w * (maxHeight.value / h))
      h = maxHeight.value
    }
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const
    const q = isLossy.value ? quality.value / 100 : undefined
    const blob = await canvas.convertToBlob({ type: mimeMap[format.value], quality: q })
    item.compressedBlob = blob
    item.compressedSize = blob.size
  } catch {
    message.error(`处理失败: ${item.file.name}`)
  } finally {
    item.processing = false
  }
}

async function processAll() {
  await compressItems(items.value.filter((i) => !i.compressedBlob))
}

async function reprocessAll() {
  items.value.forEach((i) => {
    i.compressedBlob = null
    i.compressedSize = 0
  })
  await compressItems(items.value)
}

async function compressItems(targetItems: ImageItem[]) {
  await Promise.all(targetItems.map(compressOne))
  const succeeded = targetItems.filter((i) => i.compressedBlob).length
  if (succeeded > 0) {
    trackManageToolSuccess('ImageCompress', 'compress', {
      format: format.value,
      count: succeeded,
    })
  }
}

function downloadOne(item: ImageItem) {
  if (!item.compressedBlob) return
  const ext = format.value
  const name = item.file.name.replace(/\.[^.]+$/, '') + `.${ext}`
  saveAs(item.compressedBlob, name)
}

async function downloadAll() {
  const ready = items.value.filter((i) => i.compressedBlob)
  if (!ready.length) return message.warning('没有可下载的文件')
  const zip = new JSZip()
  for (const item of ready) {
    const ext = format.value
    const name = item.file.name.replace(/\.[^.]+$/, '') + `.${ext}`
    zip.file(name, item.compressedBlob!)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  saveAs(blob, `compressed_images.zip`)
}

function removeItem(idx: number) {
  URL.revokeObjectURL(items.value[idx].thumbUrl)
  items.value.splice(idx, 1)
}

function clearAll() {
  items.value.forEach((i) => URL.revokeObjectURL(i.thumbUrl))
  items.value = []
}
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>图片压缩与格式转换</CardTitle>
        <CardDescription>批量压缩、调整尺寸、转换格式</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Controls -->
        <div class="flex flex-wrap items-center gap-4 text-xs">
          <div class="flex items-center gap-2">
            <span class="text-muted-foreground">格式</span>
            <select
              v-model="format"
              class="h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none"
            >
              <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div v-if="isLossy" class="flex items-center gap-2">
            <span class="text-muted-foreground">质量</span>
            <div class="w-28">
              <Slider
                :model-value="[quality]"
                :min="10"
                :max="100"
                :step="5"
                @update:model-value="quality = $event?.[0] ?? quality"
              />
            </div>
            <span class="w-10 text-right font-mono">{{ quality }}%</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-muted-foreground">最大宽度</span>
            <div class="w-24">
              <NInputNumber
                v-model="maxWidth"
                :min="0"
                placeholder="不限"
              />
            </div>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-muted-foreground">最大高度</span>
            <div class="w-24">
              <NInputNumber
                v-model="maxHeight"
                :min="0"
                placeholder="不限"
              />
            </div>
          </div>

          <Button
            v-if="items.length"
            size="sm"
            variant="outline"
            @click="reprocessAll"
          >
            重新压缩
          </Button>
        </div>

        <!-- Drop zone -->
        <div
          ref="dropZoneRef"
          class="flex flex-col items-center justify-center gap-1 p-8 rounded-lg border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 cursor-pointer transition-colors"
          :class="{ 'border-primary bg-primary/5': isOverDropZone }"
          @click="() => openFilePicker()"
        >
          <span class="text-sm font-medium text-foreground">拖拽图片到此处，或点击选择</span>
          <span class="text-xs text-muted-foreground">支持多张图片同时上传</span>
        </div>

        <!-- Results -->
        <template v-if="items.length">
          <div class="flex justify-between items-center pt-2">
            <span class="text-xs text-muted-foreground">共 {{ items.length }} 张图片</span>
            <div class="flex gap-2">
              <Button
                size="sm"
                @click="downloadAll"
              >
                打包下载 ZIP
              </Button>
              <Button
                size="sm"
                variant="outline"
                @click="clearAll"
              >
                清空
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <div
              v-for="(item, idx) in items"
              :key="idx"
              class="border border-border rounded-lg p-2 flex flex-col gap-2 bg-card text-xs"
            >
              <div class="w-full h-28 bg-muted/40 rounded flex items-center justify-center overflow-hidden">
                <img
                  :src="item.thumbUrl"
                  class="max-h-full max-w-full object-contain"
                  alt=""
                />
              </div>
              <div class="flex flex-col gap-0.5 min-w-0">
                <span class="font-medium truncate" :title="item.file.name">{{ item.file.name }}</span>
                <span v-if="item.compressedBlob" class="text-[11px] text-muted-foreground">
                  {{ formatFileSize(item.originalSize) }} → {{ formatFileSize(item.compressedSize) }}
                  <span :class="item.compressedSize < item.originalSize ? 'text-emerald-500 font-semibold' : 'text-amber-500'">
                    ({{ item.compressedSize < item.originalSize ? '-' : '+'
                    }}{{ Math.abs(Math.round((1 - item.compressedSize / item.originalSize) * 100)) }}%)
                  </span>
                </span>
                <span v-else-if="item.processing" class="text-[11px] text-muted-foreground">处理中...</span>
              </div>
              <div class="flex justify-between items-center mt-auto pt-1">
                <Button
                  size="xs"
                  variant="outline"
                  :disabled="!item.compressedBlob"
                  @click="downloadOne(item)"
                >
                  下载
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="text-destructive"
                  @click="removeItem(idx)"
                >
                  移除
                </Button>
              </div>
            </div>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
