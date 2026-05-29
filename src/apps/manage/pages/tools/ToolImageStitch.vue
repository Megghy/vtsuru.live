<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NAlert, NButton, NCard, NColorPicker, NFlex, NGrid, NGridItem, NInputNumber, NSelect, NSlider, NSwitch, NTag, NText } from 'naive-ui'
import Draggable from 'vuedraggable-es'
import { computed, onBeforeUnmount, reactive, ref, watchEffect } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { formatFileSize } from '@/apps/manage/composables/formatters'
import { canvasToBlob } from '@/shared/utils'

type LayoutMode = 'vertical' | 'horizontal' | 'grid'
type FitMode = 'contain' | 'cover' | 'stretch'
type OutputFormat = 'png' | 'jpeg' | 'webp'

interface StitchItem {
  id: string
  file: File
  url: string
  bitmap: ImageBitmap
  width: number
  height: number
}

interface Frame {
  item: StitchItem
  x: number
  y: number
  width: number
  height: number
}

const message = useMessage()
const items = ref<StitchItem[]>([])
const previewCanvas = ref<HTMLCanvasElement>()
const dropZoneRef = ref<HTMLElement>()
const selectedId = ref<string | null>(null)
const exporting = ref(false)
const previewScale = ref(1)
const lastExportSize = ref(0)

const settings = reactive({
  layout: 'vertical' as LayoutMode,
  outputWidth: 1080,
  stripHeight: 640,
  cellSize: 420,
  columns: 3,
  gap: 12,
  padding: 16,
  radius: 0,
  fit: 'cover' as FitMode,
  background: '#ffffff',
  transparent: false,
  format: 'png' as OutputFormat,
  quality: 0.92,
})

const layoutOptions = [
  { label: '竖向长图', value: 'vertical' },
  { label: '横向拼接', value: 'horizontal' },
  { label: '网格拼图', value: 'grid' },
]
const fitOptions = [
  { label: '裁剪填满', value: 'cover' },
  { label: '完整显示', value: 'contain' },
  { label: '拉伸铺满', value: 'stretch' },
]
const formatOptions = [
  { label: 'PNG (透明/无损)', value: 'png' },
  { label: 'JPEG (小体积)', value: 'jpeg' },
  { label: 'WebP (推荐)', value: 'webp' },
]
const layoutPresets = [
  { key: 'vertical', label: '长截图', desc: '条漫/截图流', layout: 'vertical' as LayoutMode },
  { key: 'horizontal', label: '横向对比', desc: '前后对照', layout: 'horizontal' as LayoutMode },
  { key: 'grid2', label: '双列网格', desc: '紧凑相册', layout: 'grid' as LayoutMode, columns: 2 },
  { key: 'grid3', label: '三列网格', desc: '动态配图', layout: 'grid' as LayoutMode, columns: 3 },
]

const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: files => files && addFiles(files) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'image/*', multiple: true })
onChange(files => files && addFiles(Array.from(files)))

const selectedItem = computed(() => items.value.find(item => item.id === selectedId.value) ?? null)
const selectedIndex = computed(() => items.value.findIndex(item => item.id === selectedId.value))
const canMoveSelectedUp = computed(() => selectedIndex.value > 0)
const canMoveSelectedDown = computed(() => selectedIndex.value >= 0 && selectedIndex.value < items.value.length - 1)
const layout = computed(calculateLayout)
const outputPixels = computed(() => layout.value.width * layout.value.height)
const outputTooLarge = computed(() => outputPixels.value > 80_000_000)
const outputSizeText = computed(() => `${layout.value.width} x ${layout.value.height} (${(outputPixels.value / 1_000_000).toFixed(1)} MP)`)
const exportExt = computed(() => settings.format === 'jpeg' ? 'jpg' : settings.format)

let nextId = 0
let renderTicket = 0

watchEffect(() => {
  const size = layout.value
  const signature = [
    size.width,
    size.height,
    settings.background,
    settings.transparent,
    settings.format,
    settings.radius,
    settings.fit,
    items.value.map(item => item.id).join(','),
  ].join('|')
  void signature
  const ticket = ++renderTicket
  requestAnimationFrame(() => {
    if (ticket === renderTicket) renderPreview()
  })
})

async function addFiles(files: File[]) {
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  if (!imageFiles.length) {
    message.warning('未检测到图片文件')
    return
  }

  for (const file of imageFiles) {
    try {
      const bitmap = await createImageBitmap(file)
      const item: StitchItem = {
        id: `${Date.now()}-${++nextId}`,
        file,
        url: URL.createObjectURL(file),
        bitmap,
        width: bitmap.width,
        height: bitmap.height,
      }
      items.value.push(item)
      selectedId.value = item.id
    } catch {
      message.error(`图片读取失败：${file.name}`)
    }
  }
}

function applyPreset(preset: typeof layoutPresets[number]) {
  settings.layout = preset.layout
  if (preset.layout === 'vertical') {
    settings.outputWidth = 1080
    settings.gap = 0
    settings.padding = 0
  }
  if (preset.layout === 'horizontal') {
    settings.stripHeight = 640
    settings.gap = 16
    settings.padding = 16
  }
  if (preset.layout === 'grid') {
    settings.columns = preset.columns ?? settings.columns
    settings.cellSize = preset.columns === 2 ? 560 : 420
    settings.gap = 12
    settings.padding = 16
    settings.fit = 'cover'
  }
}

function calculateLayout() {
  const frames: Frame[] = []
  if (!items.value.length) return { width: 0, height: 0, frames }

  const gap = settings.gap
  const padding = settings.padding

  if (settings.layout === 'vertical') {
    const width = settings.outputWidth
    const contentWidth = Math.max(1, width - padding * 2)
    let y = padding
    for (const item of items.value) {
      const height = Math.round(contentWidth * item.height / item.width)
      frames.push({ item, x: padding, y, width: contentWidth, height })
      y += height + gap
    }
    return { width, height: y - gap + padding, frames }
  }

  if (settings.layout === 'horizontal') {
    const contentHeight = settings.stripHeight
    let x = padding
    for (const item of items.value) {
      const width = Math.round(contentHeight * item.width / item.height)
      frames.push({ item, x, y: padding, width, height: contentHeight })
      x += width + gap
    }
    return { width: x - gap + padding, height: contentHeight + padding * 2, frames }
  }

  const columns = Math.max(1, Math.min(settings.columns, items.value.length))
  const rows = Math.ceil(items.value.length / columns)
  const cell = settings.cellSize
  for (const [index, item] of items.value.entries()) {
    const col = index % columns
    const row = Math.floor(index / columns)
    frames.push({ item, x: padding + col * (cell + gap), y: padding + row * (cell + gap), width: cell, height: cell })
  }
  return {
    width: padding * 2 + columns * cell + (columns - 1) * gap,
    height: padding * 2 + rows * cell + (rows - 1) * gap,
    frames,
  }
}

function renderPreview() {
  const canvas = previewCanvas.value
  const size = layout.value
  if (!canvas || !size.width || !size.height) return

  const scale = Math.min(1, 760 / size.width, 680 / size.height)
  previewScale.value = scale
  drawToCanvas(canvas, scale)
}

function drawToCanvas(canvas: HTMLCanvasElement, scale: number) {
  const size = layout.value
  canvas.width = Math.max(1, Math.round(size.width * scale))
  canvas.height = Math.max(1, Math.round(size.height * scale))

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(scale, 0, 0, scale, 0, 0)
  ctx.clearRect(0, 0, size.width, size.height)
  if (!settings.transparent || settings.format === 'jpeg') {
    ctx.fillStyle = settings.background
    ctx.fillRect(0, 0, size.width, size.height)
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  for (const frame of size.frames) {
    drawFrame(ctx, frame)
  }
}

function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame) {
  const radius = Math.min(settings.radius, frame.width / 2, frame.height / 2)
  ctx.save()
  if (radius > 0) {
    roundedRect(ctx, frame.x, frame.y, frame.width, frame.height, radius)
    ctx.clip()
  }

  if (settings.layout === 'grid') {
    drawImageFit(ctx, frame.item.bitmap, frame, settings.fit)
  } else {
    ctx.drawImage(frame.item.bitmap, frame.x, frame.y, frame.width, frame.height)
  }
  ctx.restore()
}

function drawImageFit(ctx: CanvasRenderingContext2D, image: ImageBitmap, frame: Frame, fit: FitMode) {
  if (fit === 'stretch') {
    ctx.drawImage(image, frame.x, frame.y, frame.width, frame.height)
    return
  }

  const scale = fit === 'cover'
    ? Math.max(frame.width / image.width, frame.height / image.height)
    : Math.min(frame.width / image.width, frame.height / image.height)
  const width = image.width * scale
  const height = image.height * scale
  ctx.drawImage(image, frame.x + (frame.width - width) / 2, frame.y + (frame.height - height) / 2, width, height)
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

async function exportImage() {
  if (!items.value.length) {
    message.warning('请先添加图片')
    return
  }
  if (outputTooLarge.value) {
    message.warning('输出画布过大，请降低尺寸或减少图片后再导出')
    return
  }

  exporting.value = true
  try {
    const canvas = document.createElement('canvas')
    drawToCanvas(canvas, 1)
    const mime = settings.format === 'jpeg' ? 'image/jpeg' : `image/${settings.format}`
    const blob = await canvasToBlob(canvas, mime, settings.format === 'png' ? undefined : settings.quality)
    lastExportSize.value = blob.size
    saveAs(blob, `stitched-${Date.now()}.${exportExt.value}`)
    message.success(`已导出 ${formatFileSize(blob.size)}`)
  } catch (error) {
    message.error(`导出失败：${error instanceof Error ? error.message : error}`)
  } finally {
    exporting.value = false
  }
}

function moveSelected(delta: number) {
  const from = selectedIndex.value
  const to = from + delta
  if (from < 0 || to < 0 || to >= items.value.length) return
  const [item] = items.value.splice(from, 1)
  items.value.splice(to, 0, item)
}

function sortByName() {
  items.value = [...items.value].sort((a, b) => a.file.name.localeCompare(b.file.name, 'zh-CN', { numeric: true }))
}

function removeItem(id: string) {
  const index = items.value.findIndex(item => item.id === id)
  if (index < 0) return
  releaseItem(items.value[index])
  items.value.splice(index, 1)
  if (selectedId.value === id) selectedId.value = items.value[Math.min(index, items.value.length - 1)]?.id ?? null
}

function clearAll() {
  items.value.forEach(releaseItem)
  items.value = []
  selectedId.value = null
  lastExportSize.value = 0
}

function releaseItem(item: StitchItem) {
  URL.revokeObjectURL(item.url)
  item.bitmap.close()
}

onBeforeUnmount(clearAll)
</script>

<template>
  <div class="stitch-page">
    <NCard title="图片拼接">
      <template #header-extra>
        <NFlex align="center" :size="8">
          <NText v-if="lastExportSize" depth="3">
            上次导出 {{ formatFileSize(lastExportSize) }}
          </NText>
          <NButton type="primary" :loading="exporting" :disabled="!items.length || outputTooLarge" @click="exportImage">
            导出图片
          </NButton>
        </NFlex>
      </template>

      <div v-if="!items.length" ref="dropZoneRef" class="empty-drop" :class="{ active: isOverDropZone }" @click="openFilePicker()">
        <NText style="font-size: 16px">
          拖拽图片到这里，或点击选择
        </NText>
        <NText depth="3">
          支持长图、横向对比图和多列网格拼图
        </NText>
      </div>

      <div v-else class="workspace">
        <section class="preview-panel">
          <div class="preview-toolbar">
            <div>
              <NText strong>
                实时预览
              </NText>
              <NText depth="3" class="preview-meta">
                {{ outputSizeText }}，预览 {{ Math.round(previewScale * 100) }}%
              </NText>
            </div>
            <NButton size="small" secondary @click="openFilePicker()">
              添加图片
            </NButton>
          </div>

          <NAlert v-if="outputTooLarge" type="warning" :show-icon="false">
            当前画布超过 80MP，导出可能导致浏览器卡死，请降低尺寸或图片数量。
          </NAlert>

          <div ref="dropZoneRef" class="preview-shell manage-checkerboard" :class="{ active: isOverDropZone }" @click.self="openFilePicker()">
            <canvas ref="previewCanvas" class="preview-canvas" />
          </div>
        </section>

        <aside class="control-panel">
          <div class="panel-block">
            <NText strong>
              布局预设
            </NText>
            <div class="preset-grid">
              <button
                v-for="preset in layoutPresets"
                :key="preset.key"
                class="preset-card"
                :class="{ active: settings.layout === preset.layout && (preset.columns ? settings.columns === preset.columns : true) }"
                type="button"
                @click="applyPreset(preset)"
              >
                <span class="preset-visual" :class="preset.key">
                  <i v-for="n in 4" :key="n" />
                </span>
                <span>{{ preset.label }}</span>
                <small>{{ preset.desc }}</small>
              </button>
            </div>
          </div>

          <div class="panel-block">
            <NText strong>
              画布参数
            </NText>
            <NGrid cols="2" :x-gap="10" :y-gap="10">
              <NGridItem>
                <label class="field">
                  <span>布局</span>
                  <NSelect v-model:value="settings.layout" :options="layoutOptions" size="small" />
                </label>
              </NGridItem>
              <NGridItem>
                <label class="field">
                  <span>格式</span>
                  <NSelect v-model:value="settings.format" :options="formatOptions" size="small" />
                </label>
              </NGridItem>
              <NGridItem v-if="settings.layout === 'vertical'">
                <label class="field">
                  <span>输出宽度</span>
                  <NInputNumber v-model:value="settings.outputWidth" :min="320" :max="6000" :step="20" size="small" />
                </label>
              </NGridItem>
              <NGridItem v-if="settings.layout === 'horizontal'">
                <label class="field">
                  <span>图片高度</span>
                  <NInputNumber v-model:value="settings.stripHeight" :min="120" :max="4000" :step="20" size="small" />
                </label>
              </NGridItem>
              <NGridItem v-if="settings.layout === 'grid'">
                <label class="field">
                  <span>列数</span>
                  <NInputNumber v-model:value="settings.columns" :min="1" :max="8" size="small" />
                </label>
              </NGridItem>
              <NGridItem v-if="settings.layout === 'grid'">
                <label class="field">
                  <span>单格尺寸</span>
                  <NInputNumber v-model:value="settings.cellSize" :min="120" :max="2400" :step="20" size="small" />
                </label>
              </NGridItem>
              <NGridItem>
                <label class="field">
                  <span>间距</span>
                  <NInputNumber v-model:value="settings.gap" :min="0" :max="200" size="small" />
                </label>
              </NGridItem>
              <NGridItem>
                <label class="field">
                  <span>边距</span>
                  <NInputNumber v-model:value="settings.padding" :min="0" :max="300" size="small" />
                </label>
              </NGridItem>
              <NGridItem v-if="settings.layout === 'grid'">
                <label class="field">
                  <span>填充方式</span>
                  <NSelect v-model:value="settings.fit" :options="fitOptions" size="small" />
                </label>
              </NGridItem>
              <NGridItem>
                <label class="field">
                  <span>圆角</span>
                  <NInputNumber v-model:value="settings.radius" :min="0" :max="300" size="small" />
                </label>
              </NGridItem>
            </NGrid>

            <div class="field quality-field">
              <span>导出质量 {{ Math.round(settings.quality * 100) }}%</span>
              <NSlider v-model:value="settings.quality" :disabled="settings.format === 'png'" :min="0.2" :max="1" :step="0.02" />
            </div>

            <div class="color-row">
              <label class="field color-field">
                <span>背景色</span>
                <NColorPicker v-model:value="settings.background" size="small" :disabled="settings.transparent && settings.format !== 'jpeg'" />
              </label>
              <NFlex align="center" :size="8">
                <NSwitch v-model:value="settings.transparent" size="small" :disabled="settings.format === 'jpeg'" />
                <NText depth="3">
                  透明背景
                </NText>
              </NFlex>
            </div>
          </div>

          <div class="panel-block">
            <NFlex justify="space-between" align="center">
              <NText strong>
                图片顺序
              </NText>
              <NFlex :size="6">
                <NButton size="tiny" @click="sortByName">
                  按文件名
                </NButton>
                <NButton size="tiny" tertiary @click="clearAll">
                  清空
                </NButton>
              </NFlex>
            </NFlex>

            <Draggable v-model="items" item-key="id" handle=".drag-handle" :animation="150" class="image-list">
              <template #item="{ element, index }">
                <div class="image-row" :class="{ active: selectedId === element.id }" @click="selectedId = element.id">
                  <span class="drag-handle" title="拖拽排序">{{ index + 1 }}</span>
                  <img :src="element.url" alt="" class="thumb">
                  <div class="image-row__body">
                    <NText class="image-name" :title="element.file.name">
                      {{ element.file.name }}
                    </NText>
                    <NText depth="3" class="image-meta">
                      {{ element.width }} x {{ element.height }} · {{ formatFileSize(element.file.size) }}
                    </NText>
                  </div>
                  <NButton size="tiny" quaternary type="error" @click.stop="removeItem(element.id)">
                    删除
                  </NButton>
                </div>
              </template>
            </Draggable>

            <div v-if="selectedItem" class="selected-box">
              <NFlex align="center" justify="space-between">
                <NTag size="small" :bordered="false">
                  已选中
                </NTag>
                <NFlex :size="6">
                  <NButton size="tiny" :disabled="!canMoveSelectedUp" @click="moveSelected(-1)">
                    上移
                  </NButton>
                  <NButton size="tiny" :disabled="!canMoveSelectedDown" @click="moveSelected(1)">
                    下移
                  </NButton>
                </NFlex>
              </NFlex>
              <NText depth="3" class="selected-name">
                {{ selectedItem.file.name }}
              </NText>
            </div>
          </div>
        </aside>
      </div>
    </NCard>
  </div>
</template>

<style scoped>
.stitch-page {
  max-width: 1180px;
  margin: 0 auto;
}

.empty-drop {
  min-height: 360px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: 2px dashed var(--n-border-color);
  border-radius: 14px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}

.empty-drop:hover,
.empty-drop.active,
.preview-shell.active {
  border-color: var(--primary-color, #18a058);
  background-color: rgba(24, 160, 88, 0.04);
}

.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 16px;
  align-items: start;
}

.preview-panel,
.control-panel,
.panel-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.preview-meta,
.image-meta,
.selected-name {
  display: block;
  font-size: 12px;
}

.preview-shell {
  min-height: 520px;
  display: grid;
  place-items: center;
  overflow: auto;
  padding: 16px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
}

.preview-canvas {
  max-width: 100%;
  border-radius: 8px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.12);
}

.control-panel {
  position: sticky;
  top: 12px;
}

.panel-block {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  background: var(--n-color);
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.preset-card {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 2px 8px;
  align-items: center;
  padding: 8px;
  text-align: left;
  color: inherit;
  background: var(--n-color);
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  cursor: pointer;
}

.preset-card.active {
  border-color: var(--primary-color, #18a058);
  box-shadow: 0 0 0 2px rgba(24, 160, 88, 0.12);
}

.preset-card small {
  grid-column: 2;
  color: var(--n-text-color-disabled);
}

.preset-visual {
  grid-row: span 2;
  width: 34px;
  height: 34px;
  display: grid;
  gap: 3px;
}

.preset-visual i {
  display: block;
  border-radius: 3px;
  background: var(--primary-color, #18a058);
  opacity: 0.78;
}

.preset-visual.vertical { grid-template-rows: repeat(4, 1fr); }
.preset-visual.horizontal { grid-template-columns: repeat(4, 1fr); }
.preset-visual.grid2 { grid-template-columns: repeat(2, 1fr); }
.preset-visual.grid3 { grid-template-columns: repeat(2, 1fr); }

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--n-text-color-3);
}

.quality-field {
  margin-top: 10px;
}

.color-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: end;
}

.color-field {
  min-width: 0;
}

.image-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow: auto;
}

.image-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--n-border-color);
  border-radius: 10px;
  cursor: pointer;
}

.image-row.active {
  border-color: var(--primary-color, #18a058);
  background: rgba(24, 160, 88, 0.05);
}

.drag-handle {
  width: 24px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  color: var(--n-text-color-3);
  background: var(--n-color-embedded);
  cursor: grab;
  user-select: none;
}

.thumb {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 8px;
  background: var(--n-color-embedded);
}

.image-row__body {
  flex: 1;
  min-width: 0;
}

.image-name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
}

.selected-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 10px;
  background: var(--n-color-embedded);
}

@media (max-width: 960px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .control-panel {
    position: static;
  }
}

@media (max-width: 640px) {
  .preview-toolbar,
  .color-row {
    grid-template-columns: 1fr;
    flex-direction: column;
  }

  .preset-grid {
    grid-template-columns: 1fr;
  }
}
</style>
