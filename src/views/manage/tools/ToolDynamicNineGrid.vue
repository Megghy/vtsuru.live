<script setup lang="ts">
import type { UploadFileInfo } from 'naive-ui'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { NButton, NCard, NH4, NInputNumber, NSelect, NSpace, NSwitch, NText, NUpload, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import VueCropper from 'vue-cropperjs'

const message = useMessage()

const originalImage = ref<string | null>(null)
const croppedSquareImage = ref<string | null>(null)

const additionalImages = ref<(string | null)[]>(Array.from({ length: 9 }, () => null))
const finalImages = ref<string[]>([])

// 导出设置
const tileSize = ref<number>(1024)
const exportFormat = ref<'png' | 'jpeg'>('png')
const jpegQuality = ref<number>(0.92)
const formatOptions: { label: string, value: 'png' | 'jpeg' }[] = [
  { label: 'PNG（无损）', value: 'png' },
  { label: 'JPEG（有损）', value: 'jpeg' },
]

const isGenerating = ref<boolean>(false)

// 裁剪相关
const enableManualCrop = ref<boolean>(false)
const cropperRef = ref<any>(null)

function handleFileChange(data: { file: UploadFileInfo }) {
  const file = data.file.file
  if (file) {
    const reader = new FileReader()
    reader.onload = async (e) => {
      originalImage.value = e.target?.result as string
      await updateImageMetaAndDefaultCrop()
      finalImages.value = [] // Reset final images
      additionalImages.value = Array.from({ length: 9 }, () => null) // Reset additional images
    }
    reader.readAsDataURL(file)
  }
}

async function updateImageMetaAndDefaultCrop() {
  if (!originalImage.value) return
  const img = new Image()
  img.src = originalImage.value
  await new Promise(resolve => img.onload = resolve)
  // 默认：如果不是正方形，打开手动裁剪；但也先生成一次中心裁剪的预览
  enableManualCrop.value = img.width !== img.height
  await generatePreview()
}

async function generatePreview() {
  if (!originalImage.value) return

  const img = new Image()
  img.src = originalImage.value
  await new Promise(resolve => img.onload = resolve)

  // 创建方形预览图
  const size = Math.min(img.width, img.height)
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')

  if (!tempCtx) return

  const offsetX = (img.width - size) / 2
  const offsetY = (img.height - size) / 2

  tempCanvas.width = size
  tempCanvas.height = size

  tempCtx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size)
  croppedSquareImage.value = tempCanvas.toDataURL()

  message.success('图片已准备就绪，可以查看九宫格预览')
}

function applyCrop() {
  if (!enableManualCrop.value || !cropperRef.value) return
  try {
    const canvas: HTMLCanvasElement = cropperRef.value.getCroppedCanvas({
      // 不做强制缩放，保持裁剪原分辨率
      fillColor: '#fff',
    })
    if (!canvas) {
      message.error('无法获取裁剪结果')
      return
    }
    croppedSquareImage.value = exportFormat.value === 'jpeg'
      ? canvas.toDataURL('image/jpeg', jpegQuality.value)
      : canvas.toDataURL('image/png')
    message.success('已应用裁剪')
  } catch (e) {
    console.error(e)
    message.error('裁剪失败，请重试')
  }
}

function resetCrop() {
  cropperRef.value?.reset?.()
}

// 预览瓦片背景位置（背景图按 300% 缩放，位置采用 0/50/100%）
function bgPosition(index: number) {
  const row = Math.floor(index / 3)
  const col = index % 3
  const x = col * 50
  const y = row * 50
  return `${x}% ${y}%`
}

function handleAdditionalImageChange(data: { file: UploadFileInfo }, index: number) {
  const file = data.file.file
  if (file) {
    const reader = new FileReader()
    reader.onload = (e) => {
      additionalImages.value[index] = e.target?.result as string
    }
    reader.readAsDataURL(file)
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
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    message.error('无法创建画布')
    isGenerating.value = false
    return
  }

  // 加载源图片（优先使用正方形预览）
  const srcImg = new Image()
  srcImg.src = sourceUrl
  await new Promise(resolve => srcImg.onload = resolve)

  // 源图的正方形区域
  const s = Math.min(srcImg.width, srcImg.height)
  const offX = (srcImg.width - s) / 2
  const offY = (srcImg.height - s) / 2
  const cellSrcSize = s / 3 // 每格源区域尺寸

  try {
    for (let i = 0; i < 9; i++) {
      const row = Math.floor(i / 3)
      const col = i % 3
      const srcX = offX + col * cellSrcSize
      const srcY = offY + row * cellSrcSize

      // 附加图片（如果有）
      let additionalImg: HTMLImageElement | null = null
      let additionalHeight = 0
      if (additionalImages.value[i]) {
        additionalImg = new Image()
        additionalImg.src = additionalImages.value[i] as string
        await new Promise(resolve => additionalImg!.onload = resolve)
        additionalHeight = (tileSize.value / additionalImg.width) * additionalImg.height
      }

      // 画布尺寸
      canvas.width = tileSize.value
      canvas.height = tileSize.value + additionalHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 绘制主图格子
      ctx.drawImage(
        srcImg,
        srcX,
        srcY,
        cellSrcSize,
        cellSrcSize,
        0,
        0,
        tileSize.value,
        tileSize.value,
      )

      // 绘制附加图片
      if (additionalImg) {
        ctx.drawImage(
          additionalImg,
          0,
          tileSize.value,
          tileSize.value,
          additionalHeight,
        )
      }

      // 导出设置
      const mime = exportFormat.value === 'png' ? 'image/png' : 'image/jpeg'
      const dataUrl = exportFormat.value === 'jpeg'
        ? canvas.toDataURL(mime, jpegQuality.value)
        : canvas.toDataURL(mime)
      finalImages.value.push(dataUrl)
    }
    message.success('九宫格图片已生成！可以单独下载每张图片')
  } catch (e) {
    console.error(e)
    message.error('生成过程中出现问题，请重试')
  } finally {
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
    finalImages.value.forEach((dataUrl, index) => {
      const blob = dataUrlToBlob(dataUrl)
      zip.file(getFileName(index), blob)
    })
    const content = await zip.generateAsync({ type: 'blob' })
    saveAs(content, 'dynamic-nine-grid.zip')
    message.success('ZIP 已开始下载')
  } catch (e) {
    console.error(e)
    message.error('打包失败，请重试')
  }
}

// 下载文件名（根据导出格式）
function getFileName(index: number) {
  const ext = exportFormat.value === 'png' ? 'png' : 'jpg'
  return `grid_image_${index + 1}.${ext}`
}
</script>

<template>
  <div class="dynamic-nine-grid-tool">
    <NCard title="动态九图生成器">
      <NSpace vertical size="large">
        <div class="upload-section">
          <NUpload
            action="#"
            :show-file-list="false"
            accept="image/*"
            @change="handleFileChange"
          >
            <NButton type="primary">
              上传原始图片
            </NButton>
          </NUpload>
          <NText depth="3" class="mt-1">
            请上传一张方形或长方形图片，将会自动分割成3x3的九宫格图片
          </NText>
        </div>
        <div v-if="originalImage" class="two-column-layout">
          <div class="left-pane">
            <div class="cropper-container">
              <div class="cropper-toolbar">
                <div class="toolbar-left">
                  <NText depth="3">
                    手动裁剪
                  </NText>
                  <NSwitch v-model:value="enableManualCrop" />
                </div>
                <div class="toolbar-actions">
                  <NButton size="small" tertiary @click="generatePreview">
                    自动中心裁剪
                  </NButton>
                  <NButton size="small" type="primary" :disabled="!enableManualCrop" @click="applyCrop">
                    应用裁剪
                  </NButton>
                  <NButton size="small" :disabled="!enableManualCrop" @click="resetCrop">
                    重置裁剪
                  </NButton>
                  <NUpload
                    action="#"
                    :show-file-list="false"
                    accept="image/*"
                    @change="handleFileChange"
                  >
                    <NButton size="small" type="warning">
                      重新选择图片
                    </NButton>
                  </NUpload>
                </div>
              </div>
              <div class="image-preview">
                <VueCropper
                  v-if="enableManualCrop"
                  ref="cropperRef"
                  :src="originalImage || ''"
                  :aspect-ratio="1"
                  :view-mode="1"
                  :auto-crop-area="1"
                  :background="false"
                  :responsive="true"
                  style="width: 100%; height: 480px;"
                />
                <img v-else :src="originalImage || ''" alt="原始图片" class="original-image-preview">
              </div>
            </div>
          </div>

          <div v-if="croppedSquareImage" class="right-pane">
            <div class="preview-section">
              <NH4>九宫格预览</NH4>
              <NText depth="3">
                九宫格预览显示了图片分割后的效果，每个格子都可以添加下方图片
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

              <!-- 导出设置 -->
              <div class="export-settings">
                <NText depth="3">
                  导出设置：
                </NText>
                <div class="export-item">
                  <NText depth="3">
                    单张边长
                  </NText>
                  <NInputNumber v-model:value="tileSize" :min="128" :max="4096" :step="128" />
                  <NText depth="3">
                    px
                  </NText>
                </div>
                <div class="export-item">
                  <NText depth="3">
                    格式
                  </NText>
                  <NSelect v-model:value="exportFormat" :options="formatOptions" style="min-width: 120px" />
                </div>
                <div v-if="exportFormat === 'jpeg'" class="export-item">
                  <NText depth="3">
                    JPEG质量
                  </NText>
                  <NInputNumber v-model:value="jpegQuality" :min="0.1" :max="1" :step="0.05" />
                </div>
                <div class="export-item">
                  <NButton tertiary size="small" :disabled="!hasAnyAdditional" @click="removeAllAdditionalImages">
                    清空所有下方图片
                  </NButton>
                </div>
              </div>

              <div class="nine-grid-preview">
                <div
                  v-for="i in 9"
                  :key="`grid-${i}`"
                  class="grid-item-container"
                >
                  <div class="grid-image-container">
                    <div class="grid-position-indicator">
                      第{{ i }}格
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
                      <NButton size="tiny">
                        添加下方图片
                      </NButton>
                    </NUpload>
                    <NButton
                      v-if="additionalImages[i - 1]"
                      size="tiny"
                      type="error"
                      @click="() => removeAdditionalImage(i - 1)"
                    >
                      删除下方图片
                    </NButton>
                  </div>
                </div>
              </div>
              <div class="action-buttons">
                <NButton type="success" class="mt-2" :loading="isGenerating" @click="generateFinalImages">
                  生成九张图片
                </NButton>
                <NButton type="info" class="mt-2" :disabled="finalImages.length === 0 || isGenerating" @click="downloadAllAsZip">
                  打包下载 ZIP
                </NButton>
              </div>
            </div>
          </div>
        </div>
        <div v-if="finalImages.length > 0" class="final-images-section">
          <NH4>最终图片</NH4>
          <NText depth="3">
            以下是生成的九宫格图片，您可以单独下载每张图片
          </NText>
          <div class="final-images-grid">
            <div v-for="(imgDataUrl, index) in finalImages" :key="`final-${index}`" class="final-image-item">
              <img :src="imgDataUrl" :alt="`最终图片 ${index + 1}`">
              <div class="image-number">
                {{ index + 1 }}
              </div>
              <NButton size="small" class="download-button" @click="() => downloadImage(imgDataUrl, getFileName(index))">
                下载
              </NButton>
            </div>
          </div>
        </div>
      </NSpace>
    </NCard>
  </div>
</template>

<style scoped>
.dynamic-nine-grid-tool {
  max-width: 1200px;
  margin: auto;
  padding: 20px 0;
}

.upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background-color: rgba(0, 0, 0, 0.02);
}

.cropper-container {
  margin: 1rem 0;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 15px;
  background-color: #fafafa;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.image-preview {
  max-height: 480px;
  overflow: auto;
}

.two-column-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .two-column-layout {
    grid-template-columns: 1fr;
  }
}

.left-pane, .right-pane {
  width: 100%;
}

.cropper-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.toolbar-left {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.cropper-controls {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  justify-content: center;
}

.preview-section {
  margin: 1.5rem 0;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fafafa;
}

.nine-grid-preview {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  padding: 10px;
  background-color: #f0f0f0;
  border-radius: 8px;
  margin: 1rem auto;
  max-width: 600px;
}

.grid-item-container {
  position: relative;
  display: flex;
  flex-direction: column;
  background-color: white;
  border-radius: 4px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  border: 1px solid #e0e0e0;
}

.grid-image-container {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.grid-position-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  background-color: rgba(0, 0, 0, 0.5);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 2px;
  z-index: 2;
}

/* 以背景图方式渲染九宫格，避免 clip-path 带来的渲染开销 */
.grid-bg-tile {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-repeat: no-repeat;
  background-size: 300% 300%;
}

.additional-image-preview {
  width: 100%;
  padding-top: 4px;
}

.additional-image-preview img {
  width: 100%;
  display: block;
  border-top: 1px solid #eee;
  max-height: 160px;
  object-fit: contain;
}

.grid-controls {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 5px;
  background-color: #f9f9f9;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 15px;
}

.final-images-section {
  margin-top: 1.5rem;
  padding: 15px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background-color: #fafafa;
}

.final-images-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 15px;
  margin-top: 15px;
}

.final-image-item {
  position: relative;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  overflow: hidden;
  background-color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.final-image-item img {
  width: 100%;
  height: auto;
  display: block;
}

.image-number {
  position: absolute;
  top: 5px;
  left: 5px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.whole-image-preview {
  position: relative;
  margin: 20px auto;
  max-width: 300px;
  border: 2px solid #333;
}

.whole-preview-img {
  width: 100%;
  height: auto;
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
  border: 1px dashed rgba(255, 255, 255, 0.7);
  position: relative;
  box-sizing: border-box;
}

.cell-number {
  position: absolute;
  top: 5px;
  left: 5px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.grid-image-wrapper {
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  position: relative;
  overflow: hidden;
}

.export-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  align-items: center;
  padding: 8px 10px;
  margin: 8px 0 12px;
  border: 1px dashed #e0e0e6;
  border-radius: 8px;
  background-color: #f9fafb;
}
.export-item {
  display: inline-flex;
  gap: 8px;
  align-items: center;
}

.original-image-preview {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid #ddd;
  max-height: 480px;
  object-fit: contain;
}

.download-button {
  margin: 8px 0;
}

.mt-1 {
  margin-top: 0.5rem;
}

.mt-2 {
  margin-top: 1rem;
}
</style>
