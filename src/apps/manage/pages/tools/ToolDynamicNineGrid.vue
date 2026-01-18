<script setup lang="ts">
import type { UploadFileInfo } from 'naive-ui'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { NButton, NCard, NDivider, NH4, NInputNumber, NSelect, NFlex, NText, NUpload, NSwitch, useMessage } from 'naive-ui';
import { computed, ref, watch } from 'vue'
import ImgCutter from 'vue-img-cutter'

// 类型定义
interface ExportSettings {
  tileSize: number
  format: 'png' | 'jpeg'
  jpegQuality: number
}

const message = useMessage()

// 图片状态
const originalImage = ref<string | null>(null)
const croppedSquareImage = ref<string | null>(null)
const additionalImages = ref<(string | null)[]>(Array.from({ length: 9 }, () => null))
const finalImages = ref<string[]>([])
const finalBlobs = ref<Blob[]>([])
const lastHandledUploadId = ref<string | number | null>(null)

// 导出设置
const exportSettings = ref<ExportSettings>({
  tileSize: 1024,
  format: 'png',
  jpegQuality: 0.92,
})

const formatOptions: { label: string, value: 'png' | 'jpeg' }[] = [
  { label: 'PNG（无损）', value: 'png' },
  { label: 'JPEG（有损）', value: 'jpeg' },
]

const sourceSquareSize = ref<number | null>(null)
const maxTileSize = computed(() => {
  const s = sourceSquareSize.value
  if (!s) return 4096
  return Math.max(128, Math.floor(s / 3))
})
const allowUpscale = ref<boolean>(false)
const currentMaxTileSize = computed(() => allowUpscale.value ? 4096 : maxTileSize.value)
watch([maxTileSize, allowUpscale], ([max, allow]) => {
  if (!allow && exportSettings.value.tileSize > max) {
    exportSettings.value.tileSize = max
  }
})

// 状态标志
const isGenerating = ref<boolean>(false)

// 裁剪器引用
const imgCutterRef = ref<any>(null)

// 工具函数：加载图片为 DataURL
function loadImageAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 工具函数：加载图片元素
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function handleFileChange(data: { file: UploadFileInfo }) {
  const uploadFile = data.file
  if (uploadFile.status === 'removed') {
    if (lastHandledUploadId.value === uploadFile.id)
      lastHandledUploadId.value = null
    return
  }

  const file = uploadFile.file
  if (!file)
    return

  if (uploadFile.id && uploadFile.id === lastHandledUploadId.value)
    return

  lastHandledUploadId.value = uploadFile.id ?? null

  try {
    originalImage.value = await loadImageAsDataURL(file)
    await updateImageMetaAndDefaultCrop()
    // 重置状态
    finalImages.value = []
    additionalImages.value = Array.from({ length: 9 }, () => null)
  }
  catch (error) {
    console.error('加载图片失败:', error)
    message.error('加载图片失败，请重试')
  }
}

async function updateImageMetaAndDefaultCrop() {
  if (!originalImage.value)
    return

  try {
    const img = await loadImage(originalImage.value)
    // 如果不是正方形，提示用户可以手动裁剪
    if (img.width !== img.height) {
      message.info('检测到非正方形图片，已自动居中裁剪，您也可以开启手动裁剪模式')
    }
    await generatePreview()
  }
  catch (error) {
    console.error('处理图片失败:', error)
    message.error('处理图片失败')
  }
}

async function generatePreview() {
  if (!originalImage.value)
    return

  try {
    const img = await loadImage(originalImage.value)

    // 创建方形预览图
    const size = Math.min(img.width, img.height)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      message.error('无法创建画布')
      return
    }

    const offsetX = (img.width - size) / 2
    const offsetY = (img.height - size) / 2

    canvas.width = size
    canvas.height = size

    ctx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size)
    // 使用 PNG 格式保证无损质量
    sourceSquareSize.value = size
    croppedSquareImage.value = canvas.toDataURL('image/png')

    message.success('图片已准备就绪，可以查看九宫格预览')
  }
  catch (error) {
    console.error('生成预览失败:', error)
    message.error('生成预览失败')
  }
}

async function handleCutDown(result: any) {
  try {
    const img = await loadImage(result.dataURL)
    sourceSquareSize.value = img.width
    croppedSquareImage.value = result.dataURL
    message.success('已应用裁剪')
  }
  catch (error) {
    console.error('裁剪失败:', error)
    message.error('裁剪失败，请重试')
  }
}

function openManualCrop() {
  if (!originalImage.value)
    return
  // 使用 handleOpen 方法打开裁剪器
  imgCutterRef.value?.handleOpen({
    name: 'image.jpg',
    src: originalImage.value,
  })
}


// 预览瓦片背景位置（背景图按 300% 缩放，位置采用 0/50/100%）
function bgPosition(index: number) {
  const row = Math.floor(index / 3)
  const col = index % 3
  const x = col * 50
  const y = row * 50
  return `${x}% ${y}%`
}

async function handleAdditionalImageChange(data: { file: UploadFileInfo }, index: number) {
  const file = data.file.file
  if (!file)
    return

  try {
    additionalImages.value[index] = await loadImageAsDataURL(file)
    message.success(`第 ${index + 1} 格的附加图片已添加`)
  }
  catch (error) {
    console.error('加载附加图片失败:', error)
    message.error('加载附加图片失败')
  }
}

async function generateFinalImages() {
  const sourceUrl = croppedSquareImage.value || originalImage.value
  if (!sourceUrl) {
    message.error('请先上传一张图片')
    return
  }

  isGenerating.value = true
  finalImages.value = []
  finalBlobs.value = []

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    message.error('无法创建画布')
    isGenerating.value = false
    return
  }

  try {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    let useBitmap = false
    let srcImg: HTMLImageElement | ImageBitmap
    if ('createImageBitmap' in window) {
      try {
        const blob = dataUrlToBlob(sourceUrl)
        const bmp = await createImageBitmap(blob)
        srcImg = bmp
        useBitmap = true
      } catch {
        srcImg = await loadImage(sourceUrl)
      }
    } else {
      srcImg = await loadImage(sourceUrl)
    }

    // 源图的正方形区域
    const baseW = useBitmap ? (srcImg as ImageBitmap).width : (srcImg as HTMLImageElement).width
    const baseH = useBitmap ? (srcImg as ImageBitmap).height : (srcImg as HTMLImageElement).height
    const size = Math.min(baseW, baseH)
    const offsetX = (baseW - size) / 2
    const offsetY = (baseH - size) / 2
    const cellSize = size / 3 // 每格源区域尺寸

    // 生成九张图片
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const srcX = offsetX + col * cellSize
      const srcY = offsetY + row * cellSize

      // 处理附加图片
      let additionalImg: HTMLImageElement | null = null
      let additionalHeight = 0

      if (additionalImages.value[i]) {
        additionalImg = await loadImage(additionalImages.value[i] as string)
        additionalHeight = (exportSettings.value.tileSize / additionalImg.width) * additionalImg.height
      }

      // 设置画布尺寸
      canvas.width = exportSettings.value.tileSize
      canvas.height = exportSettings.value.tileSize + additionalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制主图格子
      ctx.drawImage(
        srcImg as CanvasImageSource,
        srcX,
        srcY,
        cellSize,
        cellSize,
        0,
        0,
        exportSettings.value.tileSize,
        exportSettings.value.tileSize,
      )

      // 绘制附加图片
      if (additionalImg) {
        ctx.drawImage(
          additionalImg,
          0,
          exportSettings.value.tileSize,
          exportSettings.value.tileSize,
          additionalHeight,
        )
      }

      // 导出图片
      const mime = exportSettings.value.format === 'png' ? 'image/png' : 'image/jpeg'
      const dataUrl = exportSettings.value.format === 'jpeg'
        ? canvas.toDataURL(mime, exportSettings.value.jpegQuality)
        : canvas.toDataURL(mime)
      finalImages.value.push(dataUrl)
      try {
        const blob: Blob = await new Promise((resolve, reject) => {
          const quality = exportSettings.value.format === 'jpeg' ? exportSettings.value.jpegQuality : undefined
          canvas.toBlob((b) => b ? resolve(b) : reject(new Error('toBlob failed')), mime, quality as number | undefined)
        })
        finalBlobs.value.push(blob)
      } catch {
        finalBlobs.value.push(dataUrlToBlob(dataUrl))
      }
    }

    message.success('九宫格图片已生成！')
  }
  catch (error) {
    console.error('生成图片失败:', error)
    message.error('生成过程中出现问题，请重试')
  }
  finally {
    isGenerating.value = false
  }
}

function downloadImage(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// 计算是否存在任一附加图片
const hasAnyAdditional = computed(() => additionalImages.value.some(Boolean))

function removeAllAdditionalImages() {
  if (!hasAnyAdditional.value) return
  additionalImages.value = Array.from({ length: 9 }, () => null)
  message.success('已清空所有附加图片')
}

function removeAdditionalImage(index: number) {
  additionalImages.value[index] = null
  message.success('已删除附加图片')
}

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

async function downloadAllAsZip() {
  if (finalImages.value.length === 0) {
    message.error('请先生成九宫格图片')
    return
  }
  try {
    const zip = new JSZip()
    if (finalBlobs.value.length === finalImages.value.length && finalBlobs.value.length > 0) {
      finalBlobs.value.forEach((blob, index) => {
        zip.file(getFileName(index), blob)
      })
    } else {
      finalImages.value.forEach((dataUrl, index) => {
        const blob = dataUrlToBlob(dataUrl)
        zip.file(getFileName(index), blob)
      })
    }
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'dynamic-nine-grid.zip')
    message.success('ZIP 已开始下载')
  } catch (e) {
    console.error(e)
    message.error('打包失败，请重试')
  }
}

// 下载文件名
function getFileName(index: number) {
  const ext = exportSettings.value.format === 'png' ? 'png' : 'jpg'
  return `grid_${index + 1}.${ext}`
}
</script>

<template>
  <div class="dynamic-nine-grid-tool">
    <NCard title="动态九图生成器">
      <NFlex vertical :size="24">
        <!-- 上传区域 -->
        <section class="upload-section">
          <NUpload
            action="#"
            :show-file-list="false"
            accept="image/*"
            @change="handleFileChange"
          >
            <NButton type="primary" size="large">
              选择图片
            </NButton>
          </NUpload>
          <NText depth="3" style="margin-top: 8px">
            上传一张图片，将会自动分割成 3×3 九宫格
          </NText>
        </section>

        <template v-if="originalImage">
          <NDivider />

          <!-- 导出设置 -->
          <section>
            <NH4 style="margin: 0 0 12px 0">
              导出设置
            </NH4>
            <div class="settings-grid">
              <div class="setting-item">
                <NText depth="3">
                  单张尺寸
                </NText>
                <div style="display: flex; align-items: center; gap: 8px">
                  <NInputNumber v-model:value="exportSettings.tileSize" :min="128" :max="currentMaxTileSize" :step="128" style="width: 140px" />
                  <NText depth="3">
                    px
                  </NText>
                  <NText depth="3">
                    建议最大: {{ maxTileSize }} px
                  </NText>
                </div>
              </div>

              <div class="setting-item">
                <NText depth="3">
                  允许放大
                </NText>
                <NSwitch v-model:value="allowUpscale" />
              </div>

              <div class="setting-item">
                <NText depth="3">
                  格式
                </NText>
                <NSelect v-model:value="exportSettings.format" :options="formatOptions" style="width: 160px" />
              </div>

              <div v-if="exportSettings.format === 'jpeg'" class="setting-item">
                <NText depth="3">
                  质量
                </NText>
                <NInputNumber v-model:value="exportSettings.jpegQuality" :min="0.1" :max="1" :step="0.05" style="width: 120px" />
              </div>
            </div>
          </section>

          <NDivider />

          <!-- 裁剪区域 -->
          <div class="two-column-layout">
            <section class="left-section">
              <div class="section-header">
                <NH4 style="margin: 0">
                  图片裁剪
                </NH4>
              </div>

              <div class="cropper-wrapper">
                <img :src="originalImage || ''" alt="原始图片" class="original-image-preview">
              </div>

              <div class="cropper-actions">
                <NButton size="small" @click="generatePreview">
                  居中裁剪
                </NButton>
                <NButton size="small" type="primary" @click="openManualCrop">
                  手动裁剪
                </NButton>
                <NUpload
                  action="#"
                  :show-file-list="false"
                  accept="image/*"
                  @change="handleFileChange"
                >
                  <NButton size="small">
                    重新选择
                  </NButton>
                </NUpload>
              </div>

              <!-- ImgCutter 组件 -->
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
            </section>

            <section v-if="croppedSquareImage" class="right-section">
              <NH4 style="margin: 0 0 12px 0">
                完整预览
              </NH4>
              <NText depth="3" style="margin-bottom: 12px; display: block">
                以下是裁剪后的完整图片，网格线显示了九宫格的分割位置
              </NText>

              <div class="whole-image-preview">
                <img :src="croppedSquareImage" alt="完整预览" class="whole-preview-img">
                <div class="grid-overlay">
                  <div v-for="i in 9" :key="`overlay-${i}`" class="grid-overlay-cell">
                    <div class="cell-number">
                      {{ i }}
                    </div>
                  </div>
                </div>
              </div>

              <NH4 style="margin: 16px 0 12px 0">
                九宫格编辑
              </NH4>
              <NText depth="3" style="margin-bottom: 12px; display: block">
                每个格子可以添加附加图片，附加图片会显示在主图下方
              </NText>

              <div class="nine-grid-preview">
                <div
                  v-for="i in 9"
                  :key="`grid-${i}`"
                  class="grid-item-container"
                >
                  <div class="grid-image-container">
                    <div class="grid-position-indicator">
                      {{ i }}
                    </div>
                    <div class="grid-image-wrapper">
                      <div
                        class="grid-bg-tile"
                        :style="{ backgroundImage: `url(${croppedSquareImage})`, backgroundPosition: bgPosition(i - 1) }"
                      />
                    </div>
                  </div>
                  <div v-if="additionalImages[i - 1]" class="additional-image-preview">
                    <img :src="additionalImages[i - 1] || ''" alt="附加图片">
                  </div>
                  <div class="grid-controls">
                    <NUpload
                      action="#"
                      :show-file-list="false"
                      accept="image/*"
                      @change="(data) => handleAdditionalImageChange(data, i - 1)"
                    >
                      <NButton size="tiny" quaternary>
                        添加图片
                      </NButton>
                    </NUpload>
                    <NButton
                      v-if="additionalImages[i - 1]"
                      size="tiny"
                      type="error"
                      quaternary
                      @click="() => removeAdditionalImage(i - 1)"
                    >
                      移除
                    </NButton>
                  </div>
                </div>
              </div>

              <div class="action-buttons">
                <NButton
                  v-if="hasAnyAdditional"
                  size="small"
                  @click="removeAllAdditionalImages"
                >
                  清空所有附加图片
                </NButton>
              </div>
            </section>
          </div>

          <NDivider />

          <!-- 生成按钮 -->
          <div class="generate-section">
            <NButton
              type="primary"
              size="large"
              :loading="isGenerating"
              :disabled="!croppedSquareImage"
              @click="generateFinalImages"
            >
              生成九宫格图片
            </NButton>
            <NButton
              size="large"
              :disabled="finalImages.length === 0 || isGenerating"
              @click="downloadAllAsZip"
            >
              打包下载 ZIP
            </NButton>
          </div>
        </template>
        <!-- 最终结果 -->
        <template v-if="finalImages.length > 0">
          <NDivider />

          <section>
            <NH4 style="margin: 0 0 12px 0">
              生成结果
            </NH4>
            <NText depth="3" style="margin-bottom: 16px; display: block">
              共生成 {{ finalImages.length }} 张图片，可单独下载
            </NText>
            <div class="final-images-grid">
              <div v-for="(imgDataUrl, index) in finalImages" :key="`final-${index}`" class="final-image-item">
                <img :src="imgDataUrl" :alt="`图片 ${index + 1}`">
                <div class="image-number">
                  {{ index + 1 }}
                </div>
                <NButton size="small" class="download-button" @click="() => downloadImage(imgDataUrl, getFileName(index))">
                  下载
                </NButton>
              </div>
            </div>
          </section>
        </template>
      </NFlex>
    </NCard>
  </div>
</template>

<style scoped>
.dynamic-nine-grid-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
  border: 2px dashed var(--n-border-color);
  border-radius: var(--n-border-radius);
}

.settings-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: center;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.two-column-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

@media (max-width: 1024px) {
  .two-column-layout {
    grid-template-columns: 1fr;
  }
}

.left-section, .right-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.cropper-wrapper {
  border-radius: var(--n-border-radius);
  overflow: hidden;
  border: 1px solid var(--n-border-color);
  max-height: 520px;
}

.original-image-preview {
  width: 100%;
  max-height: 480px;
  object-fit: contain;
  display: block;
}

.cropper-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.whole-image-preview {
  position: relative;
  margin: 0 auto 16px;
  width: min(100%, 420px);
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  overflow: hidden;
}

.whole-preview-img {
  width: 100%;
  display: block;
}

.grid-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  pointer-events: none;
}

.grid-overlay-cell {
  border: 1px dashed rgba(255, 255, 255, 0.8);
}

.cell-number {
  position: absolute;
  top: 6px;
  left: 6px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 600;
}

.nine-grid-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 16px;
  border-radius: var(--n-border-radius);
  border: 1px solid var(--n-border-color);
  margin-top: 8px;
}

.grid-item-container {
  display: flex;
  flex-direction: column;
  border-radius: var(--n-border-radius);
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}

.grid-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.grid-position-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  background-color: rgba(0, 0, 0, 0.65);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 6px;
  border-radius: var(--n-border-radius);
  z-index: 2;
}

.grid-image-wrapper {
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  position: relative;
}

.grid-bg-tile {
  position: absolute;
  inset: 0;
  background-repeat: no-repeat;
  background-size: 300% 300%;
}

.additional-image-preview {
  width: 100%;
  padding-top: 6px;
}

.additional-image-preview img {
  width: 100%;
  display: block;
  border-top: 1px solid var(--n-border-color);
  max-height: 120px;
  object-fit: contain;
}

.grid-controls {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
}

.action-buttons, .generate-section {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.final-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 20px;
}

.final-image-item {
  position: relative;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  overflow: hidden;
}

.final-image-item img {
  width: 100%;
  display: block;
}

.image-number {
  position: absolute;
  top: 8px;
  left: 8px;
  background-color: rgba(0, 0, 0, 0.7);
  color: white;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.download-button {
  margin: 10px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

@media (max-width: 768px) {
  .dynamic-nine-grid-tool {
    padding: 16px;
  }

  .settings-grid {
    flex-direction: column;
    align-items: flex-start;
  }

  .original-image-preview {
    max-height: 320px;
  }

  .nine-grid-preview {
    padding: 12px;
    gap: 6px;
  }

  .final-images-grid {
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: 12px;
  }
}
</style>
