<script setup lang="ts">
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { NButton, NCard, NFlex, NInputNumber, NSelect, NSlider, NText } from 'naive-ui'
import { computed, ref } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'

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
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: files => files && addFiles(files) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'image/*', multiple: true })
onChange(files => files && addFiles(Array.from(files)))

function addFiles(files: File[]) {
  const imgs = files.filter(f => f.type.startsWith('image/'))
  if (!imgs.length) return message.warning('未检测到图片文件')
  for (const file of imgs) {
    const thumb = URL.createObjectURL(file)
    items.value.push({ file, originalSize: file.size, compressedBlob: null, compressedSize: 0, thumbUrl: thumb, processing: false })
  }
  processAll()
}

async function compressOne(item: ImageItem) {
  item.processing = true
  try {
    const bmp = await createImageBitmap(item.file)
    let w = bmp.width; let h = bmp.height
    if (maxWidth.value && w > maxWidth.value) { h = Math.round(h * (maxWidth.value / w)); w = maxWidth.value }
    if (maxHeight.value && h > maxHeight.value) { w = Math.round(w * (maxHeight.value / h)); h = maxHeight.value }
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bmp, 0, 0, w, h)
    bmp.close()
    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' } as const
    const q = isLossy.value ? quality.value / 100 : undefined
    const blob = await canvas.convertToBlob({ type: mimeMap[format.value], quality: q })
    item.compressedBlob = blob
    item.compressedSize = blob.size
  } catch (e) {
    message.error(`处理失败: ${item.file.name}`)
  } finally {
    item.processing = false
  }
}

async function processAll() {
  await Promise.all(items.value.filter(i => !i.compressedBlob).map(compressOne))
}

async function reprocessAll() {
  items.value.forEach(i => { i.compressedBlob = null; i.compressedSize = 0 })
  await Promise.all(items.value.map(compressOne))
}

function downloadOne(item: ImageItem) {
  if (!item.compressedBlob) return
  const ext = format.value
  const name = item.file.name.replace(/\.[^.]+$/, '') + `.${ext}`
  saveAs(item.compressedBlob, name)
}

async function downloadAll() {
  const ready = items.value.filter(i => i.compressedBlob)
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
  items.value.forEach(i => URL.revokeObjectURL(i.thumbUrl))
  items.value = []
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
</script>

<template>
  <div class="compress-page">
    <NCard title="图片压缩与格式转换">
      <template #header-extra>
        <NText depth="3">
          批量压缩、调整尺寸、转换格式
        </NText>
      </template>

      <!-- Controls -->
      <NFlex align="center" :wrap="true" :size="16" style="margin-bottom: 16px">
        <NFlex align="center" :size="8">
          <NText depth="3">
            格式
          </NText>
          <NSelect v-model:value="format" :options="formatOptions" style="width: 140px" />
        </NFlex>
        <NFlex v-if="isLossy" align="center" :size="8">
          <NText depth="3">
            质量
          </NText>
          <NSlider v-model:value="quality" :min="10" :max="100" :step="5" style="width: 120px" />
          <NText style="width: 36px; text-align: right">
            {{ quality }}%
          </NText>
        </NFlex>
        <NFlex align="center" :size="8">
          <NText depth="3">
            最大宽度
          </NText>
          <NInputNumber v-model:value="maxWidth" :min="0" placeholder="不限" clearable style="width: 110px" />
        </NFlex>
        <NFlex align="center" :size="8">
          <NText depth="3">
            最大高度
          </NText>
          <NInputNumber v-model:value="maxHeight" :min="0" placeholder="不限" clearable style="width: 110px" />
        </NFlex>
        <NButton v-if="items.length" size="small" @click="reprocessAll">
          重新压缩
        </NButton>
      </NFlex>

      <!-- Drop zone -->
      <div ref="dropZoneRef" class="drop-zone" :class="{ active: isOverDropZone }" @click="() => openFilePicker()">
        <NText style="font-size: 15px">
          拖拽图片到此处，或点击选择
        </NText>
        <NText depth="3" style="font-size: 13px">
          支持多张图片同时上传
        </NText>
      </div>

      <!-- Results -->
      <template v-if="items.length">
        <NFlex justify="space-between" align="center" style="margin: 16px 0 8px">
          <NText depth="3">
            共 {{ items.length }} 张图片
          </NText>
          <NFlex :size="8">
            <NButton size="small" type="primary" @click="downloadAll">
              打包下载 ZIP
            </NButton>
            <NButton size="small" tertiary @click="clearAll">
              清空
            </NButton>
          </NFlex>
        </NFlex>

        <div class="image-grid">
          <div v-for="(item, idx) in items" :key="idx" class="image-card">
            <img :src="item.thumbUrl" class="thumb" alt="">
            <div class="info">
              <NText class="filename" :title="item.file.name">
                {{ item.file.name }}
              </NText>
              <NText v-if="item.compressedBlob" depth="3" style="font-size: 12px">
                {{ formatSize(item.originalSize) }} → {{ formatSize(item.compressedSize) }}
                <NText :type="item.compressedSize < item.originalSize ? 'success' : 'warning'" style="font-size: 12px">
                  ({{ item.compressedSize < item.originalSize ? '-' : '+' }}{{ Math.abs(Math.round((1 - item.compressedSize / item.originalSize) * 100)) }}%)
                </NText>
              </NText>
              <NText v-else-if="item.processing" depth="3" style="font-size: 12px">
                处理中...
              </NText>
            </div>
            <NFlex :size="4" class="actions">
              <NButton size="tiny" :disabled="!item.compressedBlob" @click="downloadOne(item)">
                下载
              </NButton>
              <NButton size="tiny" tertiary @click="removeItem(idx)">
                移除
              </NButton>
            </NFlex>
          </div>
        </div>
      </template>
    </NCard>
  </div>
</template>

<style scoped>
.compress-page {
  max-width: 960px;
  margin: 0 auto;
}
.drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 32px;
  border: 2px dashed var(--n-border-color, #e0e0e0);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.drop-zone:hover,
.drop-zone.active {
  border-color: var(--n-color-target, #18a058);
  background: rgba(24, 160, 88, 0.04);
}
.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.image-card {
  border: 1px solid var(--n-border-color, #e0e0e0);
  border-radius: 6px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.thumb {
  width: 100%;
  height: 120px;
  object-fit: contain;
  border-radius: 4px;
  background: #f5f5f5;
}
.info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.filename { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.actions { margin-top: auto; }
</style>