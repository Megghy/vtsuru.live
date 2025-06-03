<template>
  <div class="dynamic-nine-grid-generator p-4">
    <n-h2>动态九宫格图片生成器</n-h2>
    <n-space vertical :size="20">
      <n-upload
        action="#"
        :show-file-list="false"
        @change="handleImageUpload"
        accept="image/*"
      >
        <n-button type="primary">上传图片</n-button>
      </n-upload>

      <div v-if="originalImageSrc" class="image-preview-area">
        <n-h3>原图预览</n-h3>
        <img ref="originalImageRef" :src="originalImageSrc" alt="Original Image" class="original-image-preview" @load="onImageLoad"/>
      </div>

      <div v-if="cropper" class="cropper-controls">
         <n-h3>裁剪区域 (选择一个正方形区域作为小图)</n-h3>
        <div ref="cropperContainerRef" class="cropper-container"></div>
        <n-button @click="cropImage" type="info" class="mt-2">确认裁剪区域</n-button>
      </div>


      <div v-if="croppedImageSrc" class="cropped-image-preview-area">
        <n-h3>单张小图预览</n-h3>
        <img :src="croppedImageSrc" alt="Cropped Tile" class="cropped-tile-preview" />
      </div>

      <div v-if="croppedImageSrc" class="grid-customization">
        <n-h3>九宫格生成与自定义</n-h3>
        <n-space vertical>
          <n-text>点击下方小图进行自定义内容添加。</n-text>
          <div class="nine-grid-preview-container">
            <div
              v-for="index in 9"
              :key="index"
              class="grid-cell"
              @click="selectCellForCustomization(index -1)"
              :class="{ 'selected-cell': selectedCellIndex === index -1 }"
            >
              <img :src="gridImages[index-1]?.finalSrc || croppedImageSrc" :alt="`Grid ${index}`" />
              <div v-if="gridImages[index-1]?.customContent" class="custom-content-indicator">有自定义</div>
            </div>
          </div>
        </n-space>
      </div>

      <n-modal v-model:show="showCustomizationModal" preset="card" title="自定义小图内容" style="width: 600px;">
        <n-space vertical v-if="selectedCellIndex !== null && gridImages[selectedCellIndex]">
            <n-h4>当前编辑: 第 {{ selectedCellIndex + 1 }} 张小图</n-h4>
            <img :src="gridImages[selectedCellIndex].baseSrc" alt="Base for customization" class="customization-base-preview"/>
            <n-upload
                action="#"
                :show-file-list="false"
                @change="handleAddCustomImage"
                accept="image/*"
                list-type="image-card"
            >
                <n-button>添加自定义图片</n-button>
            </n-upload>
            <div v-if="gridImages[selectedCellIndex].customImages.length > 0" class="custom-images-preview">
                <n-h5>已添加的自定义图片:</n-h5>
                <n-image-group>
                    <n-space>
                        <n-image
                            v-for="(img, idx) in gridImages[selectedCellIndex].customImages"
                            :key="idx"
                            width="100"
                            :src="img.src"
                            :alt="`Custom ${idx + 1}`"
                        />
                    </n-space>
                </n-image-group>
                <n-button @click="clearCustomImages(selectedCellIndex)" type="warning" size="small" class="mt-2">清空自定义图片</n-button>
            </div>
            <n-button @click="applyCellCustomization" type="primary">应用自定义</n-button>
        </n-space>
      </n-modal>

      <n-button v-if="croppedImageSrc" @click="generateAndDownloadNineGrid" type="success" :loading="isGenerating">
        生成并下载九宫格图片
      </n-button>
      <n-text v-if="isGenerating">正在生成图片，请稍候...</n-text>
    </n-space>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue';
import {
  NButton,
  NSpace,
  NUpload,
  NH2,
  NH3,
  NText,
  NModal,
  NImageGroup,
  NImage,
  NH4,
  NH5,
  useMessage
} from 'naive-ui';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { useFileDialog, useBase64, useLocalStorage } from '@vueuse/core';
import html2canvas from 'html2canvas'; // 用于将DOM元素转为图片

const message = useMessage();

interface GridImageData {
  baseSrc: string; // 裁剪后的基础图片
  customImages: { src: string, file: File }[]; // 用户为这个格子添加的自定义图片
  finalSrc: string | null; // 最终合成的图片 (base + custom)
}

const originalImageSrc = ref<string | null>(null);
const originalImageRef = ref<HTMLImageElement | null>(null);
const cropperContainerRef = ref<HTMLDivElement | null>(null);
const cropper = ref<Cropper | null>(null);
const croppedImageSrc = ref<string | null>(null); // 存储裁剪后的单张小图数据URL

const gridImages = ref<GridImageData[]>([]); // 存储9张小图的数据，包括自定义内容
const showCustomizationModal = ref(false);
const selectedCellIndex = ref<number | null>(null);
const isGenerating = ref(false);

// 使用localStorage存储一些可复用设置，例如裁剪比例等，如果需要的话
// const cropperAspectRatio = useLocalStorage('Setting.Tools.DynamicNineGridGenerator.cropperAspectRatio', 1); // 强制1:1

const handleImageUpload = (options: { file: { file: File } }) => {
  const file = options.file.file;
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      originalImageSrc.value = e.target?.result as string;
      croppedImageSrc.value = null; // 清空之前的裁剪
      gridImages.value = [];
      if (cropper.value) {
        cropper.value.destroy();
        cropper.value = null;
      }
    };
    reader.readAsDataURL(file);
  }
};

const onImageLoad = () => {
  nextTick(() => {
    if (originalImageRef.value && cropperContainerRef.value) {
      if (cropper.value) {
        cropper.value.destroy();
      }
      // 先清空容器再初始化，避免重复
      cropperContainerRef.value.innerHTML = '';
      const imgElement = originalImageRef.value.cloneNode() as HTMLImageElement;
      cropperContainerRef.value.appendChild(imgElement);

      cropper.value = new Cropper(imgElement, {
        aspectRatio: 1, // 固定为正方形裁剪
        viewMode: 1,
        dragMode: 'move',
        background: false,
        autoCropArea: 0.8,
        responsive: true,
        crop(event) {
          // console.log(event.detail.x);
        },
      });
    }
  });
};

const cropImage = () => {
  if (cropper.value) {
    const croppedCanvas = cropper.value.getCroppedCanvas();
    if (croppedCanvas) {
      croppedImageSrc.value = croppedCanvas.toDataURL();
      // 初始化九宫格图片数据
      gridImages.value = Array(9).fill(null).map(() => ({
        baseSrc: croppedImageSrc.value!,
        customImages: [],
        finalSrc: croppedImageSrc.value!, // 初始时finalSrc与baseSrc相同
      }));
      message.success('图片裁剪成功!');
    } else {
      message.error('无法裁剪图片，请重试');
    }
  }
};

const selectCellForCustomization = (index: number) => {
  selectedCellIndex.value = index;
  if (!gridImages.value[index]) { // 以防万一
     gridImages.value[index] = {
        baseSrc: croppedImageSrc.value!,
        customImages: [],
        finalSrc: croppedImageSrc.value!,
      };
  }
  showCustomizationModal.value = true;
};

const handleAddCustomImage = (options: { file: { file: File } }) => {
  const file = options.file.file;
  if (file && selectedCellIndex.value !== null) {
    const reader = new FileReader();
    reader.onload = (e) => {
      gridImages.value[selectedCellIndex.value!]?.customImages.push({ src: e.target?.result as string, file });
    };
    reader.readAsDataURL(file);
  }
};

const clearCustomImages = (index: number) => {
    if (gridImages.value[index]) {
        gridImages.value[index].customImages = [];
        // 需要重新合成或标记为待合成
        applyCellCustomization();
    }
};

const applyCellCustomization = async () => {
  if (selectedCellIndex.value === null || !gridImages.value[selectedCellIndex.value]) {
    showCustomizationModal.value = false;
    return;
  }

  const cell = gridImages.value[selectedCellIndex.value];
  const baseImg = new Image();
  baseImg.src = cell.baseSrc;

  await new Promise(resolve => baseImg.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    message.error('无法获取Canvas绘图上下文');
    showCustomizationModal.value = false;
    return;
  }

  let totalHeight = baseImg.height;
  const customImageElements: HTMLImageElement[] = [];

  for (const customImgData of cell.customImages) {
    const img = new Image();
    img.src = customImgData.src;
    await new Promise(resolve => img.onload = resolve);
    totalHeight += img.height;
    customImageElements.push(img);
  }

  canvas.width = baseImg.width; // 宽度以基础裁剪图为准
  canvas.height = totalHeight;

  ctx.drawImage(baseImg, 0, 0);

  let currentY = baseImg.height;
  for (const img of customImageElements) {
    ctx.drawImage(img, 0, currentY);
    currentY += img.height;
  }

  cell.finalSrc = canvas.toDataURL();
  message.success(`第 ${selectedCellIndex.value + 1} 张小图自定义已应用`);
  showCustomizationModal.value = false;
  selectedCellIndex.value = null;
};


const generateAndDownloadNineGrid = async () => {
  if (!croppedImageSrc.value || gridImages.value.some(img => !img.finalSrc)) {
    message.error('请先上传并裁剪图片，并确保所有小图都已处理。');
    return;
  }
  isGenerating.value = true;
  message.info("开始生成九宫格大图，请稍候...");

  // 确保所有finalSrc都是最新的
  for (let i = 0; i < gridImages.value.length; i++) {
      if (!gridImages.value[i].finalSrc) { // 如果有未处理的（理论上不应该，因为applyCellCustomization会处理）
          await applyCellCustomizationInternal(i); // 复用一个内部的合成逻辑
      }
  }

  // 创建一个临时的容器来渲染九宫格
  const tempGridContainer = document.createElement('div');
  tempGridContainer.style.display = 'grid';
  tempGridContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
  tempGridContainer.style.gridTemplateRows = 'repeat(3, 1fr)';
  tempGridContainer.style.gap = '4px'; // B站动态图片间隔
  tempGridContainer.style.position = 'absolute'; // 防止影响当前页面布局
  tempGridContainer.style.left = '-9999px'; // 移出视口

  const imageLoadPromises = gridImages.value.map((imgData, index) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.src = imgData.finalSrc!;
      img.onload = () => {
        // 为了确保html2canvas能正确处理，我们获取图片的原始宽高
        // 但在网格布局中，它们会被调整。这里主要是为了加载。
        resolve(img);
      };
      img.onerror = reject;
    });
  });

  try {
    const loadedImages = await Promise.all(imageLoadPromises);
    let maxWidth = 0;
    let maxHeight = 0;

    loadedImages.forEach(img => {
        const cellDiv = document.createElement('div');
        cellDiv.style.width = `${img.naturalWidth}px`; // 使用图片原始宽度
        cellDiv.style.height = `${img.naturalHeight}px`; // 使用图片原始高度
        const cellImg = img.cloneNode() as HTMLImageElement;
        cellDiv.appendChild(cellImg);
        tempGridContainer.appendChild(cellDiv);
        maxWidth = Math.max(maxWidth, img.naturalWidth);
        maxHeight = Math.max(maxHeight, img.naturalHeight);
    });

    // 设置容器的总宽高，基于最大单图尺寸乘以3，再加上gap
    tempGridContainer.style.width = `${maxWidth * 3 + 4 * 2}px`;
    tempGridContainer.style.height = `${maxHeight * 3 + 4 * 2}px`;


    document.body.appendChild(tempGridContainer);

    // 等待一小段时间确保DOM更新和图片渲染
    await new Promise(resolve => setTimeout(resolve, 100));

    const canvas = await html2canvas(tempGridContainer, {
      useCORS: true,
      backgroundColor: null, // 透明背景
      logging: true,
      scale: window.devicePixelRatio, // 提高清晰度
       onclone: (clonedDoc) => { // 确保克隆的文档中的图片也使用原始尺寸
        const clonedImgs = clonedDoc.querySelectorAll('.nine-grid-preview-container img');
        clonedImgs.forEach((clonedImgElem ) => {
          const originalImg = Array.from(tempGridContainer.querySelectorAll('img')).find(orig => orig.src === (clonedImgElem as HTMLImageElement).src);
          if (originalImg) {
            (clonedImgElem as HTMLImageElement).style.width = `${originalImg.naturalWidth}px`;
            (clonedImgElem as HTMLImageElement).style.height = `${originalImg.naturalHeight}px`;
          }
        });
      }
    });

    document.body.removeChild(tempGridContainer);

    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'nine-grid-combined.png';
    link.href = dataUrl;
    link.click();
    message.success('九宫格图片已生成并开始下载！');
  } catch (error) {
    console.error("Error generating nine grid image:", error);
    message.error('生成九宫格图片失败，详情请查看控制台。');
  } finally {
    isGenerating.value = false;
  }
};

// 内部合成逻辑，避免重复代码
async function applyCellCustomizationInternal(cellIndex: number) {
  const cell = gridImages.value[cellIndex];
  if (!cell) return;

  const baseImg = new Image();
  baseImg.src = cell.baseSrc;
  await new Promise(resolve => baseImg.onload = resolve);

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  let totalHeight = baseImg.height;
  const customImageElements: HTMLImageElement[] = [];

  for (const customImgData of cell.customImages) {
    const img = new Image();
    img.src = customImgData.src;
    await new Promise(resolve => img.onload = resolve);
    totalHeight += img.height;
    customImageElements.push(img);
  }

  canvas.width = baseImg.width;
  canvas.height = totalHeight;
  ctx.drawImage(baseImg, 0, 0);
  let currentY = baseImg.height;
  for (const img of customImageElements) {
    ctx.drawImage(img, 0, currentY);
    currentY += img.height;
  }
  cell.finalSrc = canvas.toDataURL();
}


watch(originalImageSrc, (newSrc) => {
  if (newSrc) {
    // 图片加载后初始化Cropper
  } else {
    if (cropper.value) {
      cropper.value.destroy();
      cropper.value = null;
    }
    croppedImageSrc.value = null;
    gridImages.value = [];
  }
});

</script>

<style scoped>
.dynamic-nine-grid-generator {
  max-width: 800px;
  margin: auto;
}

.original-image-preview, .cropped-tile-preview, .customization-base-preview {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
  margin-top: 10px;
}

.cropper-container {
  width: 100%;
  max-height: 500px; /* 限制cropper的高度 */
  margin-top: 10px;
  border: 1px solid #ccc;
}

/* cropperjs 的默认样式可能需要调整，确保它在 naive-ui 环境下正确显示 */
:deep(.cropper-view-box),
:deep(.cropper-face) {
  border-radius: 0; /* 如果需要直角 */
}

.nine-grid-preview-container {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 4px; /* B站动态图片间隔 */
  border: 1px solid #ddd;
  padding: 4px;
  background-color: #f0f0f0;
  max-width: 400px; /* 控制预览区域大小 */
  margin-top: 10px;
}

.grid-cell {
  border: 1px solid #ccc;
  background-color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  cursor: pointer;
  aspect-ratio: 1 / 1; /* 保持小格子为正方形，根据内容可能会被撑开 */
}

.grid-cell img {
  max-width: 100%;
  max-height: 100%;
  object-fit: cover; /* 确保图片填满单元格，可能会裁剪 */
}
.grid-cell.selected-cell {
  border: 2px solid #18a058; /* Naive UI 主题色 */
  box-shadow: 0 0 5px #18a058;
}

.custom-content-indicator {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background-color: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  padding: 1px 3px;
  border-radius: 3px;
}

.mt-2 {
  margin-top: 8px;
}
.custom-images-preview .n-image {
    border: 1px solid #eee;
    margin: 2px;
}
</style>