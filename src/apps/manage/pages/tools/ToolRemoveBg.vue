<script setup lang="ts">
import './tool-page.css'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref } from 'vue'

import { useRemoveBg } from '@/composables/useRemoveBg'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

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
  {
    label: 'GPU (WebGPU)',
    value: 'gpu',
    disabled: !webgpuSupported.value,
    description: webgpuSupported.value ? '使用显卡加速，速度更快' : '当前浏览器不支持 WebGPU',
  },
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
onChange((files) => {
  if (files?.[0]) handleFile(files[0])
})
useDropZone(dropZoneRef, {
  onDrop: (files) => {
    if (files?.[0]) handleFile(files[0])
  },
})

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
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle class="text-base font-semibold">AI 图像分割</CardTitle>
      <div class="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="outline"
                :loading="preloading"
                @click="handlePreload"
              >
                预加载模型
              </Button>
            </TooltipTrigger>
            <TooltipContent>提前下载模型文件，避免首次处理时等待</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          :disabled="!resultUrl"
          @click="download"
        >
          下载结果
        </Button>
      </div>
    </CardHeader>

    <CardContent class="pt-0">
      <div class="flex flex-col gap-4">
        <span
          v-if="supported === false"
          class="text-xs text-destructive"
        >
          当前浏览器不支持（需要 WebAssembly）
        </span>

        <!-- Settings row -->
        <div class="settings-grid">
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">处理模式</span>
            <Select v-model="options.mode">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in modeOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">模型精度（首次使用需下载）</span>
            <Select v-model="options.model">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in modelOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">计算设备</span>
            <Select v-model="options.device">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in deviceOptions"
                  :key="item.value"
                  :value="item.value"
                  :disabled="item.disabled"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <span
              v-if="webgpuSupported === false"
              class="text-[10px] text-muted-foreground leading-tight"
            >
              当前浏览器不支持 WebGPU。Chrome 113+ 默认启用；Edge/Firefox 需在
              <code>chrome://flags</code> 或 <code>about:config</code> 中开启 WebGPU 标志
            </span>
          </div>
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">输出格式</span>
            <Select v-model="options.format">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="item in formatOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">输出质量 {{ Math.round(options.quality * 100) }}%</span>
            <Slider
              :model-value="[options.quality]"
              :min="0.1"
              :max="1"
              :step="0.05"
              @update:model-value="
                (val) => {
                  if (val?.[0] !== undefined) options.quality = val[0]
                }
              "
            />
          </div>
          <div class="setting-item">
            <span class="text-[11px] text-muted-foreground">后台处理 (Web Worker)</span>
            <div class="pt-1">
              <Switch
                :checked="options.proxyToWorker"
                @update:checked="(v) => (options.proxyToWorker = v)"
              />
            </div>
            <span class="text-[10px] text-muted-foreground leading-tight"> 开启后处理不会阻塞页面操作 </span>
          </div>
        </div>

        <!-- Upload -->
        <div
          v-if="!originalUrl"
          ref="dropZoneRef"
          class="upload-zone"
          @click="openFileDialog()"
        >
          <span class="text-xs text-muted-foreground"> 拖拽图片到此处，或点击选择文件 </span>
        </div>

        <!-- Working area -->
        <template v-else>
          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              @click="openFileDialog()"
            >
              重新选择
            </Button>
            <Button
              :loading="processing"
              :disabled="processing || supported === false"
              @click="process"
            >
              {{ modeOptions.find((m) => m.value === options.mode)?.label ?? '处理' }}
            </Button>
          </div>

          <div
            v-if="progress && progress.total"
            class="flex flex-col gap-1"
          >
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>{{ progress.key }}</span>
              <span>{{ progressPercent }}%</span>
            </div>
            <Progress :model-value="progressPercent" />
          </div>

          <Spin
            :show="processing"
            :description="progress ? undefined : '正在处理...'"
          >
            <div class="preview-row">
              <div class="preview-item">
                <span class="text-xs text-muted-foreground">原图</span>
                <img
                  :src="originalUrl"
                  class="preview-img"
                />
              </div>
              <div
                v-if="resultUrl"
                class="preview-item"
              >
                <span class="text-xs text-muted-foreground">结果</span>
                <img
                  :src="resultUrl"
                  class="preview-img tool-checkerboard"
                />
              </div>
            </div>
          </Spin>
        </template>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
}
.setting-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.upload-zone {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 200px;
  border: 2px dashed var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.upload-zone:hover {
  border-color: var(--primary-color, #18a058);
}
.preview-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.preview-item {
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.preview-img {
  max-width: 100%;
  max-height: 400px;
  object-fit: contain;
  border-radius: 6px;
  border: 1px solid var(--border);
}
</style>
