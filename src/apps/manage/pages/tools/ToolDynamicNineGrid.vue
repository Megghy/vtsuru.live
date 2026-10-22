<script setup lang="ts">
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import ImgCutter from 'vue-img-cutter'

import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { canvasToBlob, useMessage } from '@/shared/utils'

type FitMode = 'stretch-width' | 'contain' | 'cover' | 'stretch'

interface AdditionalItem {
  file: File
  url: string
  fit: FitMode
  height: number // 0 = auto (stretch to tile width, keep ratio)
}

const message = useMessage()

const sourceFile = ref<File | null>(null)
const sourceUrl = useObjectUrl(sourceFile)
const croppedBlob = ref<Blob | null>(null)
const croppedUrl = useObjectUrl(croppedBlob)
const cellImages = ref<AdditionalItem[][]>(Array.from({ length: 9 }, () => []))
const finalBlobs = ref<Blob[]>([])
const finalUrls = computed(() => finalBlobs.value.map((b) => URL.createObjectURL(b)))
const isGenerating = ref(false)

const exportSettings = reactive({
  tileSize: 1024,
  format: 'png' as 'png' | 'jpeg',
  jpegQuality: 0.92,
  gap: 0,
})
const allowUpscale = ref(false)
const sourceSquareSize = ref(0)
const maxTileSize = computed(() =>
  sourceSquareSize.value ? Math.max(128, Math.floor(sourceSquareSize.value / 3)) : 4096,
)
const currentMaxTileSize = computed(() => (allowUpscale.value ? 4096 : maxTileSize.value))

watch([maxTileSize, allowUpscale], ([max, allow]) => {
  if (!allow && exportSettings.tileSize > max) exportSettings.tileSize = max
})

const formatOptions = [
  { label: 'PNG (无损)', value: 'png' },
  { label: 'JPEG (有损)', value: 'jpeg' },
]
const fitOptions: { label: string; value: FitMode }[] = [
  { label: '等宽自适应', value: 'stretch-width' },
  { label: '保持比例', value: 'contain' },
  { label: '裁剪填满', value: 'cover' },
  { label: '拉伸变形', value: 'stretch' },
]
// --- File input ---
const dropZoneRef = ref<HTMLElement>()
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: (files) => files?.[0] && onFilePicked(files[0]) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
onChange((files) => files?.[0] && onFilePicked(files[0]))

async function onFilePicked(file: File) {
  sourceFile.value = file
  finalBlobs.value = []
  cellImages.value = Array.from({ length: 9 }, () => [])
  croppedBlob.value = await applyCenterCrop(file)
  message.success('图片已准备就绪')
}

// --- Image processing ---
async function applyCenterCrop(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const size = Math.min(bmp.width, bmp.height)
  sourceSquareSize.value = size
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bmp, (bmp.width - size) / 2, (bmp.height - size) / 2, size, size, 0, 0, size, size)
  bmp.close()
  return canvasToBlob(canvas)
}

const imgCutterRef = ref<any>(null)
function openManualCrop() {
  if (!sourceUrl.value) return
  imgCutterRef.value?.handleOpen({ name: 'image.jpg', src: sourceUrl.value })
}

async function handleCutDown(result: any) {
  const blob = await fetch(result.dataURL).then((r) => r.blob())
  const bmp = await createImageBitmap(blob)
  sourceSquareSize.value = bmp.width
  bmp.close()
  croppedBlob.value = blob
  message.success('已应用裁剪')
}

// --- Tile generation ---
async function calcItemHeight(item: AdditionalItem, tileSize: number): Promise<{ height: number; bmp: ImageBitmap }> {
  const bmp = await createImageBitmap(item.file)
  if (item.height > 0) return { height: item.height, bmp }
  return { height: Math.round((tileSize / bmp.width) * bmp.height), bmp }
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  bmp: ImageBitmap,
  item: AdditionalItem,
  y: number,
  tileSize: number,
  h: number,
) {
  const fit = item.height > 0 ? item.fit : 'stretch-width'
  if (fit === 'stretch-width' || fit === 'stretch') {
    ctx.drawImage(bmp, 0, y, tileSize, h)
  } else if (fit === 'cover') {
    const scale = Math.max(tileSize / bmp.width, h / bmp.height)
    const sw = tileSize / scale
    const sh = h / scale
    ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, y, tileSize, h)
  } else {
    const scale = Math.min(tileSize / bmp.width, h / bmp.height)
    const dw = bmp.width * scale
    const dh = bmp.height * scale
    ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, (tileSize - dw) / 2, y + (h - dh) / 2, dw, dh)
  }
}

async function renderTile(src: ImageBitmap, index: number, cellSize: number): Promise<Blob> {
  const row = Math.floor(index / 3)
  const col = index % 3
  const tileSize = exportSettings.tileSize
  const mime = exportSettings.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = exportSettings.format === 'jpeg' ? exportSettings.jpegQuality : undefined
  const items = cellImages.value[index]
  const gap = exportSettings.gap

  const resolved: { bmp: ImageBitmap; height: number; item: AdditionalItem }[] = []
  for (const item of items) {
    const { bmp, height } = await calcItemHeight(item, tileSize)
    resolved.push({ bmp, height, item })
  }
  const totalAdditional = resolved.reduce((sum, r) => sum + r.height, 0) + Math.max(0, resolved.length - 1) * gap

  const canvas = document.createElement('canvas')
  canvas.width = tileSize
  canvas.height = tileSize + (totalAdditional > 0 ? totalAdditional + gap : 0)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, col * cellSize, row * cellSize, cellSize, cellSize, 0, 0, tileSize, tileSize)

  let y = tileSize + gap
  for (const { bmp, height, item } of resolved) {
    drawItem(ctx, bmp, item, y, tileSize, height)
    bmp.close()
    y += height + gap
  }
  return canvasToBlob(canvas, mime, quality)
}

async function generateTiles() {
  const blob = croppedBlob.value
  if (!blob) return message.error('请先上传图片')
  isGenerating.value = true
  try {
    const src = await createImageBitmap(blob)
    const cellSize = Math.min(src.width, src.height) / 3
    const results: Blob[] = []
    for (let i = 0; i < 9; i++) results.push(await renderTile(src, i, cellSize))
    src.close()
    finalBlobs.value = results
    trackManageToolSuccess('DynamicNineGrid', 'generate', {
      format: exportSettings.format,
      cells: results.length,
      tile_size: exportSettings.tileSize,
    })
    message.success('九宫格图片已生成')
  } catch (e) {
    console.error(e)
    message.error('生成失败，请重试')
  } finally {
    isGenerating.value = false
  }
}

function getFileName(i: number) {
  return `grid_${i + 1}.${exportSettings.format === 'jpeg' ? 'jpg' : 'png'}`
}
function downloadSingle(i: number) {
  saveAs(finalBlobs.value[i], getFileName(i))
}
async function downloadZip() {
  const zip = new JSZip()
  finalBlobs.value.forEach((blob, i) => zip.file(getFileName(i), blob))
  saveAs(await zip.generateAsync({ type: 'blob' }), 'dynamic-nine-grid.zip')
  message.success('ZIP 已开始下载')
}

const hasAnyAdditional = computed(() => cellImages.value.some((arr) => arr.length > 0))
const expandedCell = ref<number | null>(null)

function addImageToCell(cellIndex: number) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.multiple = true
  input.onchange = () => {
    if (!input.files) return
    for (const file of input.files) {
      cellImages.value[cellIndex].push({ file, url: URL.createObjectURL(file), fit: 'stretch-width', height: 0 })
    }
  }
  input.click()
}
function removeImageFromCell(cellIndex: number, imgIndex: number) {
  URL.revokeObjectURL(cellImages.value[cellIndex][imgIndex].url)
  cellImages.value[cellIndex].splice(imgIndex, 1)
}
function clearAllCellImages() {
  cellImages.value.forEach((arr) => arr.forEach((item) => URL.revokeObjectURL(item.url)))
  cellImages.value = Array.from({ length: 9 }, () => [])
}

function bgPosition(index: number) {
  return `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`
}
function backToEdit() {
  finalBlobs.value = []
}

const cellPreviewUrl = ref<string | null>(null)
const previewVersion = ref(0)

watchEffect(async () => {
  const idx = expandedCell.value
  const _v = previewVersion.value
  void _v
  if (idx === null || !croppedBlob.value) {
    cellPreviewUrl.value = null
    return
  }
  const items = cellImages.value[idx]
  if (items.length === 0) {
    cellPreviewUrl.value = null
    return
  }

  const previewSize = 200
  const _deps = items.map((it) => `${it.fit}-${it.height}`)
  void _deps
  const gap = Math.round((exportSettings.gap * previewSize) / exportSettings.tileSize)

  try {
    const src = await createImageBitmap(croppedBlob.value)
    const cellSize = src.width / 3
    const col = idx % 3
    const row = Math.floor(idx / 3)

    const resolved: { bmp: ImageBitmap; h: number; item: AdditionalItem }[] = []
    for (const item of items) {
      const bmp = await createImageBitmap(item.file)
      const h =
        item.height > 0
          ? Math.round((item.height * previewSize) / exportSettings.tileSize)
          : Math.round((previewSize / bmp.width) * bmp.height)
      resolved.push({ bmp, h, item })
    }
    const totalExtra = resolved.reduce((s, r) => s + r.h, 0) + Math.max(0, resolved.length - 1) * gap

    const canvas = document.createElement('canvas')
    canvas.width = previewSize
    canvas.height = previewSize + (totalExtra > 0 ? totalExtra + gap : 0)
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(src, col * cellSize, row * cellSize, cellSize, cellSize, 0, 0, previewSize, previewSize)
    src.close()

    let y = previewSize + gap
    for (const { bmp, h, item } of resolved) {
      drawItem(ctx, bmp, item, y, previewSize, h)
      bmp.close()
      y += h + gap
    }

    if (cellPreviewUrl.value) URL.revokeObjectURL(cellPreviewUrl.value)
    cellPreviewUrl.value = URL.createObjectURL(await canvasToBlob(canvas))
  } catch {
    cellPreviewUrl.value = null
  }
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-4">
    <Card>
      <CardHeader>
        <CardTitle>动态九图生成器</CardTitle>
        <CardDescription>将图片分割为 3×3 九宫格，适用于B站动态</CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <!-- Upload -->
        <Transition
          name="fade"
          mode="out-in"
        >
          <div
            v-if="!sourceFile"
            ref="dropZoneRef"
            class="flex flex-col items-center justify-center gap-2 p-12 rounded-xl border-2 border-dashed border-border hover:border-primary cursor-pointer transition-colors"
            :class="{ 'border-primary bg-primary/5': isOverDropZone }"
            @click="() => openFilePicker()"
          >
            <svg
              class="w-12 h-12 text-muted-foreground"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                x="6"
                y="6"
                width="36"
                height="36"
                rx="4"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
              />
              <path
                d="M6 32l10-10 8 8 8-12 10 14"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                cx="18"
                cy="18"
                r="3"
                stroke="currentColor"
                stroke-width="2.5"
              />
            </svg>
            <span class="text-sm font-medium text-foreground">拖拽图片到此处，或点击选择</span>
            <span class="text-xs text-muted-foreground">支持 PNG / JPEG / WebP 格式</span>
          </div>
        </Transition>

        <!-- Edit mode -->
        <Transition
          name="fade"
          mode="out-in"
        >
          <div
            v-if="sourceFile && finalBlobs.length === 0"
            class="space-y-6"
          >
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              <div class="flex flex-col items-center">
                <div class="relative w-64 h-64 border border-border rounded-lg overflow-hidden bg-muted/40">
                  <img
                    v-if="croppedUrl"
                    :src="croppedUrl"
                    alt="裁剪预览"
                    class="w-full h-full object-cover"
                  />
                  <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                    <div
                      v-for="i in 9"
                      :key="i"
                      class="border border-white/40 flex items-center justify-center"
                    >
                      <span class="text-xs font-bold text-white/80 drop-shadow">{{ i }}</span>
                    </div>
                  </div>
                </div>
                <div class="flex gap-2 mt-3">
                  <Button
                    variant="outline"
                    @click="onFilePicked(sourceFile!)"
                    >居中裁剪</Button
                  >
                  <Button @click="openManualCrop">手动裁剪</Button>
                  <Button
                    variant="ghost"
                    @click="() => openFilePicker()"
                    >重新选择</Button
                  >
                </div>
              </div>

              <!-- Export settings -->
              <div class="space-y-3 p-4 rounded-lg border border-border bg-card text-xs">
                <h4 class="font-semibold text-sm text-foreground">导出设置</h4>
                <div class="space-y-3">
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">单张尺寸</span>
                    <div class="flex items-center gap-1.5 w-32">
                      <NInputNumber
                        v-model="exportSettings.tileSize"
                        :min="128"
                        :max="currentMaxTileSize"
                        :step="128"
                      />
                      <span class="text-muted-foreground">px</span>
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">允许放大</span>
                    <Switch v-model:checked="allowUpscale" />
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">格式</span>
                    <div class="w-32">
                      <Select v-model="exportSettings.format">
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            v-for="opt in formatOptions"
                            :key="opt.value"
                            :value="opt.value"
                          >
                            {{ opt.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div
                    v-if="exportSettings.format === 'jpeg'"
                    class="flex items-center justify-between"
                  >
                    <span class="text-muted-foreground">质量</span>
                    <div class="w-32">
                      <NInputNumber
                        v-model="exportSettings.jpegQuality"
                        :min="0.1"
                        :max="1"
                        :step="0.05"
                      />
                    </div>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-muted-foreground">图片间距</span>
                    <div class="flex items-center gap-1.5 w-32">
                      <NInputNumber
                        v-model="exportSettings.gap"
                        :min="0"
                        :max="200"
                        :step="4"
                      />
                      <span class="text-muted-foreground">px</span>
                    </div>
                  </div>
                </div>
                <span class="block text-[11px] text-muted-foreground pt-1">
                  建议最大: {{ maxTileSize }}px（基于源图）
                </span>
              </div>
            </div>

            <!-- Nine grid editor -->
            <div class="space-y-3">
              <div class="flex justify-between items-center">
                <h4 class="font-semibold text-sm text-foreground">九宫格编辑</h4>
                <Button
                  v-if="hasAnyAdditional"
                  size="xs"
                  variant="ghost"
                  @click="clearAllCellImages"
                >
                  清空所有附加
                </Button>
              </div>
              <span class="text-xs text-muted-foreground block">
                点击格子添加附加图片，每格可添加多张，将按顺序拼接在主图下方
              </span>

              <div class="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                <div
                  v-for="i in 9"
                  :key="i"
                  class="aspect-square rounded border border-border cursor-pointer relative overflow-hidden transition-all"
                  :class="{ 'ring-2 ring-primary border-transparent': expandedCell === i - 1 }"
                  @click="expandedCell = expandedCell === i - 1 ? null : i - 1"
                >
                  <div
                    class="w-full h-full bg-cover"
                    :style="{ backgroundImage: `url(${croppedUrl})`, backgroundPosition: bgPosition(i - 1) }"
                  >
                    <span class="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">{{ i }}</span>
                    <span
                      v-if="cellImages[i - 1].length"
                      class="absolute bottom-1 right-1 bg-primary text-primary-foreground text-[10px] px-1 rounded font-bold"
                    >
                      {{ cellImages[i - 1].length }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Cell editor panel -->
              <div
                v-if="expandedCell !== null"
                class="p-4 rounded-lg border border-border bg-card space-y-3"
              >
                <div class="flex justify-between items-center">
                  <span class="text-xs font-semibold">第 {{ expandedCell + 1 }} 格 · 附加图片</span>
                  <Button
                    size="xs"
                    variant="ghost"
                    @click="expandedCell = null"
                    >收起</Button
                  >
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div class="space-y-2">
                    <div
                      v-if="cellImages[expandedCell].length === 0"
                      class="text-xs text-muted-foreground py-4 text-center"
                    >
                      暂无附加图片，点击下方按钮添加
                    </div>
                    <div
                      v-for="(item, j) in cellImages[expandedCell]"
                      :key="j"
                      class="flex items-center gap-2 p-1.5 rounded border border-border bg-background text-xs"
                    >
                      <img
                        :src="item.url"
                        class="w-10 h-10 object-cover rounded shrink-0"
                        alt=""
                      />
                      <div class="w-24">
                        <Select v-model="item.fit">
                          <SelectTrigger size="xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem
                              v-for="opt in fitOptions"
                              :key="opt.value"
                              :value="opt.value"
                            >
                              {{ opt.label }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div class="flex items-center gap-1 w-20">
                        <NInputNumber
                          v-model="item.height"
                          :min="0"
                          :max="4096"
                          :step="32"
                        />
                      </div>
                      <span
                        v-if="item.height === 0"
                        class="text-[11px] text-muted-foreground"
                        >自适应</span
                      >
                      <Button
                        size="xs"
                        variant="ghost"
                        class="text-destructive ml-auto"
                        @click="removeImageFromCell(expandedCell!, j)"
                      >
                        ×
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      class="w-full border-dashed"
                      @click="addImageToCell(expandedCell!)"
                    >
                      + 添加图片
                    </Button>
                  </div>

                  <div
                    v-if="cellPreviewUrl"
                    class="flex flex-col items-center"
                  >
                    <span class="text-xs text-muted-foreground mb-2">效果预览</span>
                    <img
                      :src="cellPreviewUrl"
                      alt="预览"
                      class="max-w-[200px] border border-border rounded shadow-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- Action bar -->
            <div class="flex justify-center pt-2">
              <Button
                size="lg"
                class="px-8"
                :disabled="isGenerating"
                @click="generateTiles"
              >
                {{ isGenerating ? '生成中...' : '生成九宫格' }}
              </Button>
            </div>
          </div>
        </Transition>

        <!-- Results -->
        <Transition
          name="fade"
          mode="out-in"
        >
          <div
            v-if="finalBlobs.length > 0"
            class="space-y-4"
          >
            <div class="flex justify-between items-center">
              <h4 class="font-semibold text-sm text-foreground">生成结果</h4>
              <div class="flex gap-2">
                <Button
                  variant="outline"
                  @click="backToEdit"
                  >返回编辑</Button
                >
                <Button @click="downloadZip">打包下载 ZIP</Button>
              </div>
            </div>
            <div class="grid grid-cols-3 gap-3 max-w-md mx-auto">
              <div
                v-for="(url, i) in finalUrls"
                :key="i"
                class="relative rounded border border-border overflow-hidden group cursor-pointer"
                @click="downloadSingle(i)"
              >
                <img
                  :src="url"
                  :alt="`图片 ${i + 1}`"
                  class="w-full h-full object-contain"
                />
                <span class="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-1 rounded">{{ i + 1 }}</span>
                <div
                  class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <span class="text-white text-xs font-medium">下载</span>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </CardContent>
    </Card>

    <ImgCutter
      ref="imgCutterRef"
      :is-modal="true"
      :show-choose-btn="false"
      rate="1:1"
      :original-graph="true"
      file-type="png"
      :quality="1"
      @cut-down="handleCutDown"
    />
  </div>
</template>
