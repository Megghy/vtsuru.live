<script setup lang="ts">
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { NButton, NCard, NFlex, NInputNumber, NSelect, NSwitch, NText } from 'naive-ui'
import { computed, reactive, ref, watch, watchEffect } from 'vue'
import ImgCutter from 'vue-img-cutter'
import { useDropZone, useFileDialog, useObjectUrl } from '@vueuse/core'
import { canvasToBlob } from '@/shared/utils'
import { trackManageToolSuccess } from '@/shared/services/umami'

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
const finalUrls = computed(() => finalBlobs.value.map(b => URL.createObjectURL(b)))
const isGenerating = ref(false)

const exportSettings = reactive({
  tileSize: 1024,
  format: 'png' as 'png' | 'jpeg',
  jpegQuality: 0.92,
  gap: 0,
})
const allowUpscale = ref(false)
const sourceSquareSize = ref(0)
const maxTileSize = computed(() => sourceSquareSize.value ? Math.max(128, Math.floor(sourceSquareSize.value / 3)) : 4096)
const currentMaxTileSize = computed(() => allowUpscale.value ? 4096 : maxTileSize.value)

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
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: files => files?.[0] && onFilePicked(files[0]) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
onChange(files => files?.[0] && onFilePicked(files[0]))

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
  const blob = await fetch(result.dataURL).then(r => r.blob())
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
  // stretch-width: scale to tile width, auto height
  return { height: Math.round((tileSize / bmp.width) * bmp.height), bmp }
}

function drawItem(ctx: CanvasRenderingContext2D, bmp: ImageBitmap, item: AdditionalItem, y: number, tileSize: number, h: number) {
  const fit = item.height > 0 ? item.fit : 'stretch-width'
  if (fit === 'stretch-width' || fit === 'stretch') {
    ctx.drawImage(bmp, 0, y, tileSize, h)
  } else if (fit === 'cover') {
    const scale = Math.max(tileSize / bmp.width, h / bmp.height)
    const sw = tileSize / scale; const sh = h / scale
    ctx.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, y, tileSize, h)
  } else {
    const scale = Math.min(tileSize / bmp.width, h / bmp.height)
    const dw = bmp.width * scale; const dh = bmp.height * scale
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

  // Pre-calculate all heights
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

// --- Downloads ---
function getFileName(i: number) {
  return `grid_${i + 1}.${exportSettings.format === 'jpeg' ? 'jpg' : 'png'}`
}
function downloadSingle(i: number) { saveAs(finalBlobs.value[i], getFileName(i)) }
async function downloadZip() {
  const zip = new JSZip()
  finalBlobs.value.forEach((blob, i) => zip.file(getFileName(i), blob))
  saveAs(await zip.generateAsync({ type: 'blob' }), 'dynamic-nine-grid.zip')
  message.success('ZIP 已开始下载')
}

// --- Cell image management ---
const hasAnyAdditional = computed(() => cellImages.value.some(arr => arr.length > 0))
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
  cellImages.value.forEach(arr => arr.forEach(item => URL.revokeObjectURL(item.url)))
  cellImages.value = Array.from({ length: 9 }, () => [])
}

function bgPosition(index: number) {
  return `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%`
}
function backToEdit() { finalBlobs.value = [] }

// --- Cell preview ---
const cellPreviewUrl = ref<string | null>(null)
const previewVersion = ref(0)

watchEffect(async () => {
  const idx = expandedCell.value
  const _v = previewVersion.value
  void _v
  if (idx === null || !croppedBlob.value) { cellPreviewUrl.value = null; return }
  const items = cellImages.value[idx]
  if (items.length === 0) { cellPreviewUrl.value = null; return }

  const previewSize = 200
  // Read all reactive deps so watchEffect re-triggers on changes
  const _deps = items.map(it => `${it.fit}-${it.height}`)
  void _deps
  const gap = Math.round(exportSettings.gap * previewSize / exportSettings.tileSize)

  try {
    const src = await createImageBitmap(croppedBlob.value)
    const cellSize = src.width / 3
    const col = idx % 3; const row = Math.floor(idx / 3)

    // Calculate total height
    const resolved: { bmp: ImageBitmap; h: number; item: AdditionalItem }[] = []
    for (const item of items) {
      const bmp = await createImageBitmap(item.file)
      const h = item.height > 0
        ? Math.round(item.height * previewSize / exportSettings.tileSize)
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
  } catch { cellPreviewUrl.value = null }
})
</script>

<template>
  <div class="nine-grid-page">
    <NCard title="动态九图生成器">
      <template #header-extra>
        <NText depth="3">
          将图片分割为 3×3 九宫格，适用于B站动态
        </NText>
      </template>

      <!-- Upload -->
      <Transition name="fade" mode="out-in">
        <div v-if="!sourceFile" ref="dropZoneRef" class="drop-zone" :class="{ active: isOverDropZone }" @click="() => openFilePicker()">
          <div class="drop-zone-content">
            <svg class="drop-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="6" y="6" width="36" height="36" rx="4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
              <path d="M6 32l10-10 8 8 8-12 10 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              <circle cx="18" cy="18" r="3" stroke="currentColor" stroke-width="2.5" />
            </svg>
            <NText style="font-size: 15px">
              拖拽图片到此处，或点击选择
            </NText>
            <NText depth="3" style="font-size: 13px">
              支持 PNG / JPEG / WebP 格式
            </NText>
          </div>
        </div>
      </Transition>

      <!-- Edit mode -->
      <Transition name="fade" mode="out-in">
        <div v-if="sourceFile && finalBlobs.length === 0" class="edit-section">
          <div class="crop-settings-row">
            <div class="crop-section">
              <div class="crop-preview">
                <img v-if="croppedUrl" :src="croppedUrl" alt="裁剪预览" class="crop-img">
                <div class="grid-overlay">
                  <div v-for="i in 9" :key="i" class="grid-overlay-cell">
                    <span class="cell-num">{{ i }}</span>
                  </div>
                </div>
              </div>
              <NFlex justify="center" :size="8" style="margin-top: 12px">
                <NButton size="small" @click="onFilePicked(sourceFile!)">
                  居中裁剪
                </NButton>
                <NButton size="small" type="primary" @click="openManualCrop">
                  手动裁剪
                </NButton>
                <NButton size="small" tertiary @click="() => openFilePicker()">
                  重新选择
                </NButton>
              </NFlex>
            </div>
            <div class="settings-panel">
              <NText tag="h4" class="section-title">
                导出设置
              </NText>
              <div class="settings-list">
                <div class="setting-row">
                  <NText depth="3">
                    单张尺寸
                  </NText>
                  <NFlex align="center" :size="6">
                    <NInputNumber v-model:value="exportSettings.tileSize" :min="128" :max="currentMaxTileSize" :step="128" style="width: 120px" />
                    <NText depth="3" style="font-size: 12px">
                      px
                    </NText>
                  </NFlex>
                </div>
                <div class="setting-row">
                  <NText depth="3">
                    允许放大
                  </NText><NSwitch v-model:value="allowUpscale" />
                </div>
                <div class="setting-row">
                  <NText depth="3">
                    格式
                  </NText><NSelect v-model:value="exportSettings.format" :options="formatOptions" style="width: 130px" />
                </div>
                <div v-if="exportSettings.format === 'jpeg'" class="setting-row">
                  <NText depth="3">
                    质量
                  </NText><NInputNumber v-model:value="exportSettings.jpegQuality" :min="0.1" :max="1" :step="0.05" style="width: 100px" />
                </div>
                <div class="setting-row">
                  <NText depth="3">
                    图片间距
                  </NText>
                  <NFlex align="center" :size="6">
                    <NInputNumber v-model:value="exportSettings.gap" :min="0" :max="200" :step="4" style="width: 100px" />
                    <NText depth="3" style="font-size: 12px">
                      px
                    </NText>
                  </NFlex>
                </div>
              </div>
              <NText depth="3" style="font-size: 12px; margin-top: 12px; display: block">
                建议最大: {{ maxTileSize }}px（基于源图）
              </NText>
            </div>
          </div>
          <!-- TEMPLATE_GRID_EDITOR -->
          <!-- Nine Grid Editor -->
          <div class="grid-editor-header">
            <NText tag="h4" class="section-title">
              九宫格编辑
            </NText>
            <NButton v-if="hasAnyAdditional" size="tiny" quaternary @click="clearAllCellImages">
              清空所有附加
            </NButton>
          </div>
          <NText depth="3" style="font-size: 13px; margin-bottom: 12px; display: block">
            点击格子添加附加图片，每格可添加多张，将按顺序拼接在主图下方
          </NText>
          <div class="nine-grid">
            <div v-for="i in 9" :key="i" class="tile-card" :class="{ selected: expandedCell === i - 1 }" @click="expandedCell = expandedCell === i - 1 ? null : i - 1">
              <div class="tile-main" :style="{ backgroundImage: `url(${croppedUrl})`, backgroundPosition: bgPosition(i - 1) }">
                <span class="tile-badge">{{ i }}</span>
                <span v-if="cellImages[i - 1].length" class="tile-count">{{ cellImages[i - 1].length }}</span>
              </div>
            </div>
          </div>

          <!-- Cell editor (below grid) -->
          <div v-if="expandedCell !== null" class="cell-editor-panel">
            <NFlex justify="space-between" align="center" style="margin-bottom: 10px">
              <NText strong>
                第 {{ expandedCell + 1 }} 格 · 附加图片
              </NText>
              <NButton size="tiny" quaternary @click="expandedCell = null">
                收起
              </NButton>
            </NFlex>
            <div class="cell-editor-body">
              <div class="cell-editor-list">
                <div v-if="cellImages[expandedCell].length === 0" class="cell-editor-empty">
                  <NText depth="3" style="font-size: 13px">
                    暂无附加图片，点击下方按钮添加
                  </NText>
                </div>
                <div v-for="(item, j) in cellImages[expandedCell]" :key="j" class="cell-img-row">
                  <img :src="item.url" class="cell-img-thumb" alt="">
                  <NSelect v-model:value="item.fit" :options="fitOptions" size="tiny" style="width: 110px" />
                  <NFlex align="center" :size="4">
                    <NInputNumber v-model:value="item.height" :min="0" :max="4096" :step="32" size="tiny" style="width: 80px" />
                    <NText v-if="item.height === 0" depth="3" style="font-size: 11px">
                      自适应
                    </NText>
                  </NFlex>
                  <NButton size="tiny" quaternary type="error" @click="removeImageFromCell(expandedCell!, j)">
                    ×
                  </NButton>
                </div>
                <NButton size="small" dashed style="width: 100%; margin-top: 8px" @click="addImageToCell(expandedCell!)">
                  + 添加图片
                </NButton>
              </div>
              <div v-if="cellPreviewUrl" class="cell-preview">
                <NText depth="3" style="font-size: 12px; margin-bottom: 6px; display: block">
                  效果预览
                </NText>
                <img :src="cellPreviewUrl" alt="预览" class="cell-preview-img">
              </div>
            </div>
          </div>

          <!-- Action bar -->
          <div class="action-bar">
            <NButton type="primary" size="large" :loading="isGenerating" @click="generateTiles">
              生成九宫格
            </NButton>
          </div>
        </div>
      </Transition>
      <!-- TEMPLATE_RESULTS -->
      <!-- Results -->
      <Transition name="fade" mode="out-in">
        <div v-if="finalBlobs.length > 0" class="results-section">
          <NFlex justify="space-between" align="center" style="margin-bottom: 16px">
            <NText tag="h4" class="section-title">
              生成结果
            </NText>
            <NFlex :size="8">
              <NButton size="small" tertiary @click="backToEdit">
                返回编辑
              </NButton>
              <NButton type="primary" size="small" @click="downloadZip">
                打包下载 ZIP
              </NButton>
            </NFlex>
          </NFlex>
          <div class="result-grid">
            <div v-for="(url, i) in finalUrls" :key="i" class="result-item">
              <img :src="url" :alt="`图片 ${i + 1}`">
              <span class="tile-badge">{{ i + 1 }}</span>
              <div class="result-hover-overlay" @click="downloadSingle(i)">
                <span>下载</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </NCard>
    <ImgCutter ref="imgCutterRef" :is-modal="true" :show-choose-btn="false" rate="1:1" :original-graph="true" file-type="png" :quality="1" @cut-down="handleCutDown" />
  </div>
</template>
<style scoped>
.section-title { margin: 0; font-size: 16px; font-weight: 600; }

.drop-zone {
  display: flex; align-items: center; justify-content: center;
  min-height: 220px; border: 2px dashed var(--n-border-color);
  border-radius: 12px; cursor: pointer; transition: all 0.25s ease;
}
.drop-zone:hover, .drop-zone.active {
  border-color: var(--primary-color, #18a058);
  background: color-mix(in srgb, var(--primary-color, #18a058) 4%, transparent);
}
.drop-zone.active { border-style: solid; }
.drop-zone-content { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.drop-icon { width: 48px; height: 48px; color: var(--n-text-color-3); transition: color 0.2s; }
.drop-zone:hover .drop-icon { color: var(--primary-color, #18a058); }

.edit-section, .results-section { animation: slideUp 0.3s ease; }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

.crop-settings-row {
  display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, auto);
  gap: 24px; align-items: start;
}
@media (max-width: 768px) { .crop-settings-row { grid-template-columns: 1fr; } }

.crop-section { display: flex; flex-direction: column; align-items: center; }
.crop-preview {
  position: relative; width: 100%; max-width: 380px; aspect-ratio: 1;
  border-radius: 10px; overflow: hidden; border: 1px solid var(--n-border-color);
  box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.crop-img { width: 100%; height: 100%; object-fit: cover; display: block; }
.grid-overlay {
  position: absolute; inset: 0; display: grid;
  grid-template-columns: repeat(3, 1fr); grid-template-rows: repeat(3, 1fr);
  pointer-events: none;
}
.grid-overlay-cell { border: 1px dashed rgba(255,255,255,0.6); position: relative; }
.cell-num {
  position: absolute; top: 4px; left: 4px;
  background: rgba(0,0,0,0.55); color: #fff;
  width: 18px; height: 18px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 600;
}

.settings-panel {
  padding: 20px; border: 1px solid var(--n-border-color);
  border-radius: 10px; background: var(--n-color-embedded); align-self: start;
}
.settings-list { display: flex; flex-direction: column; gap: 14px; }
.setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
/* --- Nine Grid --- */
.grid-editor-header { display: flex; align-items: center; justify-content: space-between; margin: 28px 0 4px; }
.nine-grid, .result-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 10px; max-width: 540px; margin: 0 auto;
}
.tile-card {
  position: relative; border: 1px solid var(--n-border-color);
  border-radius: 8px; overflow: hidden; transition: box-shadow 0.2s, transform 0.2s;
  cursor: pointer;
}
.tile-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
.tile-card.selected { outline: 2px solid var(--primary-color, #18a058); outline-offset: -2px; }
.tile-main {
  position: relative; width: 100%; aspect-ratio: 1;
  background-size: 300% 300%; background-repeat: no-repeat;
}
.tile-badge {
  position: absolute; top: 5px; left: 5px;
  background: rgba(0,0,0,0.6); color: #fff;
  font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px; z-index: 2;
}
.tile-count {
  position: absolute; top: 5px; right: 5px;
  background: var(--primary-color, #18a058); color: #fff;
  font-size: 10px; font-weight: 600; padding: 2px 6px; border-radius: 4px; z-index: 2;
}
.tile-hover-overlay, .result-hover-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.45); color: #fff; font-size: 13px; font-weight: 500;
  opacity: 0; transition: opacity 0.2s; cursor: pointer;
}
.result-item:hover .result-hover-overlay { opacity: 1; }

/* --- Cell Editor Panel --- */
.cell-editor-panel {
  max-width: 540px; margin: 12px auto 0;
  padding: 14px; border: 1px solid var(--n-border-color);
  border-radius: 8px; background: var(--n-color-embedded);
}
.cell-editor-body { display: flex; gap: 16px; align-items: flex-start; }
.cell-editor-list { flex: 1; min-width: 0; }
.cell-editor-empty { padding: 12px 0; text-align: center; }
.cell-img-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }
.cell-img-row + .cell-img-row { border-top: 1px solid var(--n-border-color); }
.cell-img-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }
.cell-preview { flex-shrink: 0; width: 120px; }
.cell-preview-img {
  width: 100%; border-radius: 6px;
  border: 1px solid var(--n-border-color);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

/* --- Action Bar --- */
.action-bar {
  position: sticky; bottom: 0;
  display: flex; justify-content: center; align-items: center; gap: 12px;
  margin-top: 28px; padding: 16px 0;
  background: color-mix(in srgb, var(--n-color) 85%, transparent);
  backdrop-filter: blur(8px); border-top: 1px solid var(--n-border-color); z-index: 10;
}

/* --- Results --- */
.result-item {
  position: relative; border: 1px solid var(--n-border-color);
  border-radius: 8px; overflow: hidden; transition: box-shadow 0.2s, transform 0.2s;
}
.result-item:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
.result-item img { width: 100%; display: block; }

/* --- Transitions --- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.fade-enter-from { opacity: 0; transform: translateY(6px); }
.fade-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
