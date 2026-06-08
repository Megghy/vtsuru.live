<script setup lang="ts">
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { NButton, NCard, NFlex, NProgress, NSelect, NSlider, NSpin, NSwitch, NText, NTooltip } from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { useRemoveBg } from '@/composables/useRemoveBg'
import { trackManageToolSuccess } from '@/shared/services/umami'

const message = useMessage()
const { options, supported, webgpuSupported, progress, checkSupport, preloadModel, processRemoveBg } = useRemoveBg()

const originalUrl = ref<string>()
const resultUrl = ref<string>()
const processing = ref(false)
const preloading = ref(false)
const dropZoneRef = ref<HTMLDivElement>()

const modeOptions = [
  { label: '去背景', value: 'remove-bg', description: '移除背景，保留前景主体' },
  { label: '去前景', value: 'remove-fg', description: '移除前景主体，保留背景' },
  { label: '生成蒙版', value: 'mask', description: '输出前景的黑白 Alpha 蒙版' },
]
const modelOptions = [
  { label: 'quint8 · 最快 (~40MB)', value: 'isnet_quint8', description: '量化模型，速度最快，精度略低' },
  { label: 'fp16 · 均衡 (~80MB)', value: 'isnet_fp16', description: '半精度模型，速度与精度均衡（推荐）' },
  { label: 'isnet · 最精细 (~170MB)', value: 'isnet', description: '全精度模型，效果最好但下载和处理较慢' },
]
const deviceOptions = computed(() => [
  { label: 'CPU', value: 'cpu', description: '兼容性最好，所有浏览器支持' },
  { label: 'GPU (WebGPU)', value: 'gpu', disabled: !webgpuSupported.value, description: webgpuSupported.value ? '使用显卡加速，速度更快' : '当前浏览器不支持 WebGPU' },
])
const formatOptions = [
  { label: 'PNG (无损)', value: 'image/png' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'WebP', value: 'image/webp' },
]

const progressPercent = computed(() => {
  if (!progress.value || !progress.value.total) return 0
  return Math.round((progress.value.current / progress.value.total) * 100)
})

const { open: openFileDialog, onChange } = useFileDialog({ accept: 'image/*', multiple: false })
onChange((files) => { if (files?.[0]) handleFile(files[0]) })
useDropZone(dropZoneRef, { onDrop: (files) => { if (files?.[0]) handleFile(files[0]) } })

onMounted(checkSupport)

function handleFile(file: File) {
  originalUrl.value = URL.createObjectURL(file)
  resultUrl.value = undefined
}

const fileExt = computed(() => {
  if (options.format === 'image/jpeg') return 'jpg'
  if (options.format === 'image/webp') return 'webp'
  return 'png'
})

async function process() {
  if (!originalUrl.value) return
  processing.value = true
  try {
    const resp = await fetch(originalUrl.value)
    const blob = await resp.blob()
    const result = await processRemoveBg(blob)
    resultUrl.value = URL.createObjectURL(result)
    trackManageToolSuccess('RemoveBg', 'process', {
      mode: options.mode,
      model: options.model,
      device: options.device,
      format: fileExt.value,
    })
    message.success('处理完成')
  } catch (e: any) {
    message.error(`处理失败: ${e?.message ?? e}`)
  } finally {
    processing.value = false
  }
}

async function handlePreload() {
  preloading.value = true
  try {
    await preloadModel()
    message.success('模型已预加载')
  } catch (e: any) {
    message.error(`预加载失败: ${e?.message ?? e}`)
  } finally {
    preloading.value = false
  }
}

function download() {
  if (!resultUrl.value) return
  saveAs(resultUrl.value, `result-${Date.now()}.${fileExt.value}`)
}
</script>

<template>
  <NCard title="AI 图像分割">
    <template #header-extra>
      <NFlex :size="8" align="center">
        <NTooltip>
          <template #trigger>
            <NButton size="small" tertiary :loading="preloading" @click="handlePreload">
              预加载模型
            </NButton>
          </template>
          提前下载模型文件，避免首次处理时等待
        </NTooltip>
        <NButton :disabled="!resultUrl" type="primary" size="small" @click="download">
          下载结果
        </NButton>
      </NFlex>
    </template>

    <NFlex vertical :size="16">
      <NText v-if="supported === false" type="error">
        当前浏览器不支持（需要 WebAssembly）
      </NText>

      <!-- Settings row -->
      <div class="settings-grid">
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            处理模式
          </NText>
          <NSelect v-model:value="options.mode" :options="modeOptions" size="small" />
        </div>
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            模型精度（首次使用需下载）
          </NText>
          <NSelect v-model:value="options.model" :options="modelOptions" size="small" />
        </div>
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            计算设备
          </NText>
          <NSelect v-model:value="options.device" :options="deviceOptions" size="small" />
          <NText v-if="webgpuSupported === false" depth="3" style="font-size:10px; line-height:1.3">
            当前浏览器不支持 WebGPU。Chrome 113+ 默认启用；Edge/Firefox 需在
            <code>chrome://flags</code> 或 <code>about:config</code> 中开启 WebGPU 标志
          </NText>
        </div>
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            输出格式
          </NText>
          <NSelect v-model:value="options.format" :options="formatOptions" size="small" />
        </div>
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            输出质量 {{ Math.round(options.quality * 100) }}%
          </NText>
          <NSlider v-model:value="options.quality" :min="0.1" :max="1" :step="0.05" />
        </div>
        <div class="setting-item">
          <NText depth="3" style="font-size:11px">
            后台处理 (Web Worker)
          </NText>
          <NSwitch v-model:value="options.proxyToWorker" />
          <NText depth="3" style="font-size:10px; line-height:1.3">
            开启后处理不会阻塞页面操作
          </NText>
        </div>
      </div>

      <!-- Upload -->
      <div v-if="!originalUrl" ref="dropZoneRef" class="upload-zone" @click="openFileDialog()">
        <NText depth="3">
          拖拽图片到此处，或点击选择文件
        </NText>
      </div>

      <!-- Working area -->
      <template v-else>
        <NFlex :size="8" align="center">
          <NButton size="small" secondary @click="openFileDialog()">
            重新选择
          </NButton>
          <NButton size="small" type="primary" :loading="processing" :disabled="processing || supported === false" @click="process">
            {{ modeOptions.find(m => m.value === options.mode)?.label ?? '处理' }}
          </NButton>
        </NFlex>

        <NProgress v-if="progress && progress.total" :percentage="progressPercent" :show-indicator="true" status="info">
          <NText style="font-size:11px">
            {{ progress.key }} {{ progressPercent }}%
          </NText>
        </NProgress>

        <NSpin :show="processing" :description="progress ? undefined : '正在处理...'">
          <div class="preview-row">
            <div class="preview-item">
              <NText depth="3" style="font-size:12px">
                原图
              </NText>
              <img :src="originalUrl" class="preview-img">
            </div>
            <div v-if="resultUrl" class="preview-item">
              <NText depth="3" style="font-size:12px">
                结果
              </NText>
              <img :src="resultUrl" class="preview-img manage-checkerboard">
            </div>
          </div>
        </NSpin>
      </template>
    </NFlex>
  </NCard>
</template>

<style scoped>
.settings-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px; padding: 12px; border: 1px solid var(--n-border-color);
  border-radius: 8px; background: var(--n-color-embedded);
}
.setting-item { display: flex; flex-direction: column; gap: 4px; }
.upload-zone {
  display: flex; justify-content: center; align-items: center;
  height: 200px; border: 2px dashed var(--n-border-color);
  border-radius: 8px; cursor: pointer; transition: border-color 0.2s;
}
.upload-zone:hover { border-color: var(--primary-color, #18a058); }
.preview-row { display: flex; gap: 16px; flex-wrap: wrap; }
.preview-item { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: 6px; }
.preview-img {
  max-width: 100%; max-height: 400px; object-fit: contain;
  border-radius: 6px; border: 1px solid var(--n-border-color);
}
</style>
