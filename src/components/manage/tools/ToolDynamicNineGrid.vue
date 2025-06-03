<template>
  <div class="dynamic-nine-grid-tool">
    <n-card title="动态九图生成器">
      <n-space vertical size="large">
        <div class="upload-section">
          <n-upload
            action="#"
            :show-file-list="false"
            @change="handleFileChange"
            accept="image/*"
          >
            <n-button type="primary">上传原始图片</n-button>
          </n-upload>
          <n-text depth="3" class="mt-1">
            请上传一张方形或长方形图片，将会自动分割成3x3的九宫格图片
          </n-text>
        </div>        <div v-if="originalImage" class="cropper-container">
          <div>
            <n-text>请确保您上传的图片是方形或近似方形，以获得最佳效果</n-text>
          </div>
          <div class="image-preview">
            <img :src="originalImage" alt="原始图片" class="original-image-preview" />
          </div>          <div class="cropper-controls">
            <n-button @click="generatePreview" type="primary">生成预览</n-button>
            <n-upload
              action="#"
              :show-file-list="false"
              @change="handleFileChange"
              accept="image/*"
            >
              <n-button type="warning">重新上传</n-button>
            </n-upload>
          </div>
        </div>        <div v-if="croppedSquareImage" class="preview-section">
          <n-h4>九宫格预览</n-h4>
          <n-text depth="3">
            九宫格预览显示了图片分割后的效果，每个格子都可以添加下方图片
          </n-text>

          <div class="whole-image-preview">
            <img :src="croppedSquareImage" alt="完整预览" class="whole-preview-img" />
            <div class="grid-overlay">
              <div v-for="i in 9" :key="`overlay-${i}`" class="grid-overlay-cell">
                <div class="cell-number">{{ i }}</div>
              </div>
            </div>
          </div>

          <div class="nine-grid-preview">
            <div
              v-for="i in 9"
              :key="`grid-${i}`"
              class="grid-item-container"
            >
              <div class="grid-image-container">
                <div class="grid-position-indicator">第{{ i }}格</div>
                <div class="grid-image-wrapper">
                  <img
                    :src="croppedSquareImage"
                    alt="九宫格预览"
                    class="grid-image-base"
                    :style="{
                      clipPath: generateClipPath(i-1),
                      transform: 'scale(3)',
                      transformOrigin: calculateTransformOrigin(i-1)
                    }"
                  />
                </div>
              </div>
              <div v-if="additionalImages[i-1]" class="additional-image-preview">
                <img :src="additionalImages[i-1] || ''" alt="附加图片" />
              </div>
              <div class="grid-controls">
                <n-upload
                  action="#"
                  :show-file-list="false"
                  @change="(data) => handleAdditionalImageChange(data, i - 1)"
                  accept="image/*"
                >
                  <n-button size="tiny">添加下方图片</n-button>
                </n-upload>
                <n-button
                  v-if="additionalImages[i-1]"
                  size="tiny"
                  type="error"
                  @click="() => removeAdditionalImage(i-1)"
                >
                  删除下方图片
                </n-button>
              </div>
            </div>
          </div>
          <div class="action-buttons">
            <n-button @click="generateFinalImages" type="success" class="mt-2">生成九张图片</n-button>
            <n-button @click="downloadAllImages" type="info" class="mt-2" :disabled="finalImages.length === 0">
              打包下载全部
            </n-button>
          </div>
        </div><div v-if="finalImages.length > 0" class="final-images-section">
          <n-h4>最终图片</n-h4>
          <n-text depth="3">
            以下是生成的九宫格图片，您可以单独下载每张图片
          </n-text>
          <div class="final-images-grid">
            <div v-for="(imgDataUrl, index) in finalImages" :key="`final-${index}`" class="final-image-item">
              <img :src="imgDataUrl" :alt="`最终图片 ${index + 1}`" />
              <div class="image-number">{{ index + 1 }}</div>
              <n-button size="small" @click="() => downloadImage(imgDataUrl, `grid_image_${index + 1}.png`)" class="download-button">
                下载
              </n-button>
            </div>
          </div>
        </div>

      </n-space>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { NCard, NButton, NUpload, NSpace, NH4, NText, useMessage } from 'naive-ui';
import type { UploadFileInfo } from 'naive-ui';
// 直接引入 vue-cropperjs，它应该会自动包含所需的 CSS
import VueCropper from 'vue-cropperjs';
import { useFileDialog } from '@vueuse/core';

const message = useMessage();

const originalImage = ref<string | null>(null);
const croppedSquareImage = ref<string | null>(null);
const cropperRef = ref<any>(null); // VueCropper Instance

const additionalImages = ref<(string | null)[]>(Array(9).fill(null));
const finalImages = ref<string[]>([]);

// 添加九宫格位置控制变量
const gridPositions = ref<{ x: number, y: number }[]>(
  Array(9).fill(null).map(() => ({ x: 0, y: 0 }))
);

const { files, open, reset } = useFileDialog({
  accept: 'image/*',
  multiple: false,
});

const handleFileChange = (data: { file: UploadFileInfo }) => {
  const file = data.file.file;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      originalImage.value = e.target?.result as string;
      generatePreview();
      finalImages.value = []; // Reset final images
      additionalImages.value = Array(9).fill(null); // Reset additional images
    };
    reader.readAsDataURL(file);
  }
};

const generatePreview = async () => {
  if (!originalImage.value) return;

  const img = new Image();
  img.src = originalImage.value;
  await new Promise(resolve => img.onload = resolve);

  // 创建方形预览图
  const size = Math.min(img.width, img.height);
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');

  if (!tempCtx) return;

  const offsetX = (img.width - size) / 2;
  const offsetY = (img.height - size) / 2;

  tempCanvas.width = size;
  tempCanvas.height = size;

  tempCtx.drawImage(img, offsetX, offsetY, size, size, 0, 0, size, size);
  croppedSquareImage.value = tempCanvas.toDataURL();

  message.success('图片已准备就绪，可以查看九宫格预览');
};

const onCropperReady = () => {
  if (cropperRef.value) {
    // 设置裁剪区域为方形
    const containerData = cropperRef.value.cropper.getContainerData();
    const size = Math.min(containerData.width, containerData.height) * 0.8;

    cropperRef.value.cropper.setCropBoxData({
      left: (containerData.width - size) / 2,
      top: (containerData.height - size) / 2,
      width: size,
      height: size
    });

    message.success('可以调整裁剪区域');
  }
};

const cropImage = () => {
  if (cropperRef.value) {
    croppedSquareImage.value = cropperRef.value.getCroppedCanvas({
      imageSmoothingQuality: 'high',
    }).toDataURL();

    message.success('图片裁剪成功！');
  }
};

const handleAdditionalImageChange = (data: { file: UploadFileInfo }, index: number) => {
  const file = data.file.file;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      additionalImages.value[index] = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};

const generateFinalImages = async () => {
  if (!originalImage.value) {
    message.error('请先上传一张图片');
    return;
  }
  finalImages.value = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    message.error('无法创建画布');
    return;
  }

  // 加载原始图片
  const originalImg = new Image();
  originalImg.src = originalImage.value;
  await new Promise(resolve => originalImg.onload = resolve);

  // 确保图片是正方形的
  const size = Math.min(originalImg.width, originalImg.height);
  const offsetX = (originalImg.width - size) / 2;
  const offsetY = (originalImg.height - size) / 2;

  // 每个格子的尺寸
  const gridSize = size / 3;

  // 为每个格子生成图片
  for (let i = 0; i < 9; i++) {
    // 计算当前格子在原图中的位置
    const row = Math.floor(i / 3);
    const col = i % 3;
    const srcX = offsetX + col * gridSize;
    const srcY = offsetY + row * gridSize;

    // 加载额外图片（如果有）
    let additionalImg: HTMLImageElement | null = null;
    let additionalHeight = 0;

    if (additionalImages.value[i]) {
      additionalImg = new Image();
      additionalImg.src = additionalImages.value[i] as string;
      await new Promise(resolve => additionalImg!.onload = resolve);

      // 计算额外图片等比例缩放后的高度
      additionalHeight = (gridSize / additionalImg.width) * additionalImg.height;
    }

    // 设置画布尺寸
    canvas.width = gridSize;
    canvas.height = gridSize + additionalHeight;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 绘制九宫格中的一格
    ctx.drawImage(
      originalImg,
      srcX, srcY, gridSize, gridSize, // 从原图截取的区域
      0, 0, gridSize, gridSize // 绘制到画布的位置和大小
    );

    // 如果有额外图片，绘制在下方
    if (additionalImg) {
      ctx.drawImage(
        additionalImg,
        0, gridSize, gridSize, additionalHeight
      );
    }

    // 保存生成的图片
    finalImages.value.push(canvas.toDataURL('image/png'));
  }

  message.success('九宫格图片已生成！可以单独下载每张图片');
};

const downloadImage = (dataUrl: string, filename: string) => {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

const resetCropper = () => {
  if (cropperRef.value) {
    cropperRef.value.cropper.reset();
    message.info('已重置裁剪区域');
  }
};

const removeAdditionalImage = (index: number) => {
  additionalImages.value[index] = null;
  message.success('已删除附加图片');
};

const downloadAllImages = () => {
  if (finalImages.value.length === 0) {
    message.error('请先生成九宫格图片');
    return;
  }

  // 创建一个 zip 文件的替代方案
  // 这里我们简单地连续下载所有图片
  finalImages.value.forEach((dataUrl, index) => {
    setTimeout(() => {
      downloadImage(dataUrl, `grid_image_${index + 1}.png`);
    }, index * 300); // 避免浏览器阻止多次下载，添加延迟
  });

  message.success('正在下载所有图片...');
};

// 生成CSS clip-path以显示图片的特定部分
const generateClipPath = (index: number) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const startX = col * 33.33;
  const startY = row * 33.33;
  const endX = startX + 33.33;
  const endY = startY + 33.33;

  return `polygon(${startX}% ${startY}%, ${endX}% ${startY}%, ${endX}% ${endY}%, ${startX}% ${endY}%)`;
};

// 计算图片的transform-origin，确保正确缩放
const calculateTransformOrigin = (index: number) => {
  const row = Math.floor(index / 3);
  const col = index % 3;
  const originX = col * 50; // 使用百分比
  const originY = row * 50;

  return `${originX}% ${originY}%`;
};

</script>

<style scoped>
.dynamic-nine-grid-tool {
  max-width: 900px;
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

.grid-image-base {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform-origin: 0 0;
}

.additional-image-preview {
  width: 100%;
  padding-top: 4px;
}

.additional-image-preview img {
  width: 100%;
  display: block;
  border-top: 1px solid #eee;
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

.grid-image-base {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.original-image-preview {
  max-width: 100%;
  height: auto;
  border-radius: 4px;
  border: 1px solid #ddd;
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
