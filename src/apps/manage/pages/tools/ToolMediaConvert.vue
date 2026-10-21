<script setup lang="ts">
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'

import { formatDuration, formatFileSize } from '@/apps/manage/composables/formatters'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { useMessage } from '@/shared/utils'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Progress } from '@/shared/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'

import { buildCommands, defaultSettings, formatMap, formats, positive, presets, type Rotate } from './mediaConvert'
import MediaTrimmer from './MediaTrimmer.vue'

const message = useMessage()
const ffmpeg = new FFmpeg()
const ffmpegCoreVersion = '0.12.10'
const ffmpegCoreBaseURL = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${ffmpegCoreVersion}/dist/umd`
const ffmpegCoreURLs = {
  coreURL: `${ffmpegCoreBaseURL}/ffmpeg-core.js`,
  wasmURL: `${ffmpegCoreBaseURL}/ffmpeg-core.wasm`,
}

type ProcessStatus = 'pending' | 'processing' | 'done' | 'error'

interface MediaItem {
  id: string
  file: File
  isVideo: boolean
  srcUrl: string
  poster: string
  width: number | null
  height: number | null
  duration: number | null
  trimStart: number | null
  trimEnd: number | null
  expanded: boolean
  progress: number
  status: ProcessStatus
  outputBlob: Blob | null
  outputKind: string | null
  outputName: string
  outputSize: number
  outputUrl: string
  error: string
}

const mediaFilePattern = /\.(?:aac|aiff|alac|ape|flac|m4a|m4v|mkv|mov|mp3|mp4|mpeg|oga|ogg|opus|wav|webm|wma)$/i
const videoFilePattern = /\.(?:m4v|mkv|mov|mp4|mpeg|webm)$/i

let nextItemId = 0

const items = ref<MediaItem[]>([])
const settings = reactive(defaultSettings())
const showAdvanced = ref(false)
const activePreset = ref<string | null>(null)
const loadingCore = ref(false)
const processing = ref(false)
const currentItem = ref<MediaItem | null>(null)
const processedCount = ref(0)
const lastLog = ref('')

let canceled = false

const dropZoneRef = ref<HTMLElement>()
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: (files) => files && addFiles(files) })
const { open: openFilePicker, onChange } = useFileDialog({
  accept: 'audio/*,video/*,.mkv,.flac,.opus,.ogg,.webm',
  multiple: true,
})
onChange((files) => files && addFiles(Array.from(files)))

const selectedFormat = computed(() => formatMap.get(settings.format)!)
const formatOptions = formats.map((f) => ({ label: f.label, value: f.value }))
const videoMaxWidthOptions = [
  { label: '保持原尺寸', value: null },
  { label: '最大 2160px', value: 2160 },
  { label: '最大 1440px', value: 1440 },
  { label: '最大 1080px', value: 1080 },
  { label: '最大 720px', value: 720 },
  { label: '最大 480px', value: 480 },
]
const videoFpsOptions = [
  { label: '保持原帧率', value: null },
  { label: '60 FPS', value: 60 },
  { label: '30 FPS', value: 30 },
  { label: '24 FPS', value: 24 },
]
const audioBitrateOptions = [64, 96, 128, 160, 192, 256, 320].map((v) => ({ label: `${v} kbps`, value: v }))
const sampleRateOptions = [
  { label: '保持原采样率', value: null },
  { label: '48 kHz', value: 48000 },
  { label: '44.1 kHz', value: 44100 },
  { label: '32 kHz', value: 32000 },
  { label: '22.05 kHz', value: 22050 },
]
const channelOptions = [
  { label: '保持原声道', value: 'keep' },
  { label: '单声道', value: 'mono' },
  { label: '双声道', value: 'stereo' },
]
const gifFpsOptions = [10, 12, 15, 20, 24].map((v) => ({ label: `${v} FPS`, value: v }))
const gifWidthOptions = [240, 320, 480, 640].map((v) => ({ label: `${v}px`, value: v }))
const videoCodecOptions = [
  { label: 'H.264（兼容性最好）', value: 'h264' },
  { label: 'H.265（同画质体积更小，编码慢）', value: 'h265' },
]
const videoPresetOptions = ['ultrafast', 'veryfast', 'faster', 'medium', 'slow'].map((v) => ({ label: v, value: v }))
const rotateOptions = [
  { label: '不旋转', value: 0 },
  { label: '顺时针 90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '逆时针 90°', value: 270 },
]
const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((v) => ({ label: `${v}x`, value: v }))
const highpassOptions = [
  { label: '关闭', value: null },
  { label: '80 Hz（去低频隆隆声）', value: 80 },
  { label: '120 Hz', value: 120 },
  { label: '200 Hz（去人声以下）', value: 200 },
]
const lowpassOptions = [
  { label: '关闭', value: null },
  { label: '15 kHz', value: 15000 },
  { label: '10 kHz（去高频嘶声）', value: 10000 },
  { label: '8 kHz（电话音质）', value: 8000 },
]

const hasVideoSource = computed(() => items.value.some((i) => i.isVideo))
const doneItems = computed(() => items.value.filter((i) => i.outputBlob))
const pendingItems = computed(() => items.value.filter((i) => i.status === 'pending' || i.status === 'error'))
const totalOriginalSize = computed(() => items.value.reduce((s, i) => s + i.file.size, 0))
const totalOutputSize = computed(() => doneItems.value.reduce((s, i) => s + i.outputSize, 0))
const needsVideoSource = computed(() => selectedFormat.value.kind !== 'audio')
const invalidItems = computed(() => (needsVideoSource.value ? items.value.filter((i) => !i.isVideo) : []))
const canProcess = computed(() => pendingItems.value.length > 0 && !processing.value && !loadingCore.value)

const statusText = computed(() => {
  if (loadingCore.value) return '正在加载 FFmpeg 核心，首次使用会稍慢'
  if (processing.value && currentItem.value) return `正在处理：${currentItem.value.file.name}`
  return '所有处理都在浏览器本地完成，不会上传文件'
})

ffmpeg.on('progress', ({ progress }) => {
  if (currentItem.value) currentItem.value.progress = Math.max(1, Math.min(99, Math.round(progress * 100)))
})
ffmpeg.on('log', ({ message: msg }) => {
  lastLog.value = msg
})

function isMediaFile(file: File) {
  return file.type.startsWith('audio/') || file.type.startsWith('video/') || mediaFilePattern.test(file.name)
}
function isVideoFile(file: File) {
  return file.type.startsWith('video/') || videoFilePattern.test(file.name)
}

function addFiles(files: File[]) {
  const mediaFiles = files.filter(isMediaFile)
  if (!mediaFiles.length) {
    message.warning('未检测到可处理的音视频文件')
    return
  }
  for (const file of mediaFiles) {
    const isVideo = isVideoFile(file)
    const item: MediaItem = {
      id: `${Date.now()}-${++nextItemId}`,
      file,
      isVideo,
      srcUrl: URL.createObjectURL(file),
      poster: '',
      width: null,
      height: null,
      duration: null,
      trimStart: null,
      trimEnd: null,
      expanded: false,
      progress: 0,
      status: 'pending',
      outputBlob: null,
      outputKind: null,
      outputName: '',
      outputSize: 0,
      outputUrl: '',
      error: '',
    }
    items.value.push(item)
    readMediaInfo(item)
  }
  if (!hasVideoSource.value && needsVideoSource.value) settings.format = 'mp3'
}

function readMediaInfo(item: MediaItem) {
  const el = item.isVideo ? document.createElement('video') : document.createElement('audio')
  el.preload = 'metadata'
  el.onloadedmetadata = () => {
    if (Number.isFinite(el.duration)) item.duration = el.duration
    if (item.isVideo) {
      const v = el as HTMLVideoElement
      item.width = v.videoWidth || null
      item.height = v.videoHeight || null
      capturePoster(item, v)
    }
  }
  el.src = item.srcUrl
}

function capturePoster(item: MediaItem, video: HTMLVideoElement) {
  video.muted = true
  video.currentTime = Math.min(1, (item.duration ?? 2) / 2)
  video.onseeked = () => {
    const canvas = document.createElement('canvas')
    const scale = Math.min(1, 320 / (video.videoWidth || 320))
    canvas.width = (video.videoWidth || 320) * scale
    canvas.height = (video.videoHeight || 180) * scale
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    item.poster = canvas.toDataURL('image/jpeg', 0.6)
    video.onseeked = null
  }
}

function applyPreset(key: string) {
  const preset = presets.find((p) => p.key === key)!
  if (preset.videoOnly && items.value.length && !hasVideoSource.value) {
    message.warning('当前没有视频源文件，无法使用该预设')
    return
  }
  Object.assign(settings, preset.patch)
  activePreset.value = key
}

async function loadCore() {
  if (ffmpeg.loaded) return
  loadingCore.value = true
  try {
    await ffmpeg.load(ffmpegCoreURLs)
  } finally {
    loadingCore.value = false
  }
}

async function processAll() {
  const queue = pendingItems.value
  if (!queue.length) {
    message.warning('没有待处理的文件')
    return
  }
  if (invalidItems.value.length) {
    message.warning('当前输出为视频/GIF，只支持视频源文件；音频文件请选择音频输出格式')
    return
  }

  canceled = false
  processing.value = true
  processedCount.value = 0
  lastLog.value = ''
  try {
    await loadCore()
    for (const item of queue) {
      if (canceled) break
      await processOne(item)
      processedCount.value++
    }
    if (canceled) {
      message.info('已取消处理')
    } else {
      const failed = queue.filter((i) => i.status === 'error').length
      const succeeded = queue.filter((i) => i.status === 'done').length
      if (succeeded > 0) {
        trackManageToolSuccess('MediaConvert', 'process', {
          format: settings.format,
          count: succeeded,
        })
      }
      message[failed ? 'warning' : 'success'](failed ? `处理完成，${failed} 个文件失败` : '全部处理完成')
    }
  } catch (error) {
    if (!canceled) message.error(`FFmpeg 执行失败：${error instanceof Error ? error.message : error}`)
  } finally {
    processing.value = false
    currentItem.value = null
  }
}

async function cancelAll() {
  canceled = true
  if (currentItem.value) {
    currentItem.value.status = 'pending'
    currentItem.value.progress = 0
  }
  ffmpeg.terminate()
}

async function processOne(item: MediaItem) {
  resetOutput(item)
  item.status = 'processing'
  item.progress = 1
  item.error = ''
  currentItem.value = item

  const ext = fileExtension(item.file.name)
  const inputName = `input-${item.id}.${ext}`
  const outputName = `output-${item.id}.${settings.format}`
  const written: string[] = [inputName]

  try {
    await ffmpeg.writeFile(inputName, await fetchFile(item.file))
    const steps = buildCommands(
      inputName,
      outputName,
      settings,
      { start: item.trimStart, end: item.trimEnd },
      item.duration ?? 0,
    )
    for (const step of steps) {
      if (canceled) return
      const code = await ffmpeg.exec(step.args)
      if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)
    }
    if (settings.format === 'gif') written.push('palette.png')
    written.push(outputName)

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array
    const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
    const blob = new Blob([buffer], { type: selectedFormat.value.mime })
    item.outputBlob = blob
    item.outputKind = selectedFormat.value.kind
    item.outputName = `${baseName(item.file.name)}.${settings.format}`
    item.outputSize = blob.size
    item.outputUrl = URL.createObjectURL(blob)
    item.progress = 100
    item.status = 'done'
  } catch (error) {
    if (canceled) return
    item.status = 'error'
    item.error = error instanceof Error ? error.message : String(error)
  } finally {
    if (!canceled) for (const path of written) await ffmpeg.deleteFile(path).catch(() => undefined)
  }
}

function downloadOne(item: MediaItem) {
  if (item.outputBlob) saveAs(item.outputBlob, item.outputName)
}

async function downloadAll() {
  if (!doneItems.value.length) {
    message.warning('没有可下载的文件')
    return
  }
  const zip = new JSZip()
  for (const item of doneItems.value) zip.file(item.outputName, item.outputBlob!)
  saveAs(await zip.generateAsync({ type: 'blob' }), 'converted_media.zip')
}

function removeItem(index: number) {
  const item = items.value[index]
  if (item.srcUrl) URL.revokeObjectURL(item.srcUrl)
  resetOutput(item)
  items.value.splice(index, 1)
}

function clearAll() {
  for (const item of items.value) {
    if (item.srcUrl) URL.revokeObjectURL(item.srcUrl)
    resetOutput(item)
  }
  items.value = []
}

function resetOutput(item: MediaItem) {
  if (item.outputUrl) URL.revokeObjectURL(item.outputUrl)
  item.outputBlob = null
  item.outputKind = null
  item.outputName = ''
  item.outputSize = 0
  item.outputUrl = ''
}

function fileExtension(name: string) {
  return name.match(/\.([^.]+)$/)?.[1] ?? 'media'
}
function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}
function formattedDuration(d: number | null) {
  return d ? formatDuration(d) : '--:--'
}
function trimmedHint(item: MediaItem) {
  if (item.trimStart == null && item.trimEnd == null) return ''
  const a = formatDuration(positive(item.trimStart))
  const b = item.trimEnd ? formatDuration(item.trimEnd) : '结尾'
  return `截取 ${a}-${b}`
}
function savingText(item: MediaItem) {
  const percent = Math.round((1 - item.outputSize / item.file.size) * 100)
  return `${percent >= 0 ? '-' : '+'}${Math.abs(percent)}%`
}
function savingVariant(item: MediaItem): 'secondary' | 'destructive' {
  return item.outputSize <= item.file.size ? 'secondary' : 'destructive'
}
function statusVariant(item: MediaItem): 'secondary' | 'destructive' | 'default' | 'outline' {
  if (item.status === 'done') return 'secondary'
  if (item.status === 'error') return 'destructive'
  if (item.status === 'processing') return 'default'
  return 'outline'
}
function statusLabel(item: MediaItem) {
  return { done: '完成', error: '失败', processing: '处理中', pending: '待处理' }[item.status]
}

onBeforeUnmount(() => {
  clearAll()
  if (ffmpeg.loaded) ffmpeg.terminate()
})
</script>

<template>
  <div class="media-page">
    <Card>
      <CardHeader class="flex flex-row items-center justify-between pb-4">
        <CardTitle class="text-base font-semibold">音视频转换与压缩</CardTitle>
        <span class="text-xs text-muted-foreground"> 浏览器本地处理 </span>
      </CardHeader>

      <CardContent class="pt-0">
        <div class="flex flex-col gap-4">
          <Alert>
            <AlertDescription class="text-xs">
              支持视频压缩、转 GIF、提取音频、格式互转与片段截取。全程在浏览器本地完成，不上传文件；大文件会占用较多内存和
              CPU。
            </AlertDescription>
          </Alert>

          <div class="preset-bar">
            <span class="preset-label text-xs text-muted-foreground">
              快捷预设
            </span>
            <div class="flex flex-wrap gap-2">
              <Button
                v-for="preset in presets"
                :key="preset.key"
                size="sm"
                :variant="activePreset === preset.key ? 'default' : 'outline'"
                class="h-7 text-xs"
                :title="preset.desc"
                @click="applyPreset(preset.key)"
              >
                {{ preset.label }}
              </Button>
            </div>
          </div>

          <button
            type="button"
            class="advanced-toggle text-xs text-foreground/80 hover:text-foreground text-left"
            @click="showAdvanced = !showAdvanced"
          >
            {{ showAdvanced ? '▾' : '▸' }} 高级设置（编码 / 画面 / 速度 / 音频）
          </button>

          <div
            v-if="showAdvanced"
            class="advanced-panel"
          >
            <div class="field">
              <span class="text-xs text-muted-foreground"> 输出格式 </span>
              <Select
                :model-value="settings.format"
                @update:model-value="(v) => { settings.format = v as any; activePreset = null }"
              >
                <SelectTrigger class="h-8 w-full text-xs">
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

            <Tabs default-value="audio">
              <TabsList class="w-full grid grid-cols-5 h-8">
                <TabsTrigger
                  v-if="selectedFormat.kind === 'video'"
                  value="video"
                  class="text-xs"
                >
                  编码
                </TabsTrigger>
                <TabsTrigger
                  v-if="selectedFormat.kind === 'gif'"
                  value="gif"
                  class="text-xs"
                >
                  GIF
                </TabsTrigger>
                <TabsTrigger
                  v-if="selectedFormat.kind !== 'audio'"
                  value="picture"
                  class="text-xs"
                >
                  画面
                </TabsTrigger>
                <TabsTrigger
                  v-if="selectedFormat.kind !== 'audio'"
                  value="speed"
                  class="text-xs"
                >
                  速度
                </TabsTrigger>
                <TabsTrigger
                  value="audio"
                  class="text-xs"
                >
                  音频
                </TabsTrigger>
              </TabsList>

              <!-- 视频编码 -->
              <TabsContent
                v-if="selectedFormat.kind === 'video'"
                value="video"
                class="space-y-3 pt-2"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div
                    v-if="settings.format === 'mp4'"
                    class="field"
                  >
                    <span class="text-xs text-muted-foreground"> 编码器 </span>
                    <Select v-model="settings.videoCodec">
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in videoCodecOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 最大宽度 </span>
                    <Select
                      :model-value="settings.videoMaxWidth === null ? 'null' : String(settings.videoMaxWidth)"
                      @update:model-value="(v) => (settings.videoMaxWidth = v === 'null' ? null : Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in videoMaxWidthOptions"
                          :key="String(opt.value)"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 帧率 </span>
                    <Select
                      :model-value="settings.videoFps === null ? 'null' : String(settings.videoFps)"
                      @update:model-value="(v) => (settings.videoFps = v === 'null' ? null : Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in videoFpsOptions"
                          :key="String(opt.value)"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div
                    v-if="settings.format === 'mp4'"
                    class="field"
                  >
                    <span class="text-xs text-muted-foreground"> 编码速度（越慢压缩越好） </span>
                    <Select v-model="settings.videoPreset">
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in videoPresetOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div class="flex justify-center mt-2">
                  <div class="inline-flex rounded-md border border-input p-0.5 bg-muted">
                    <button
                      type="button"
                      class="px-3 py-1 text-xs rounded transition-colors cursor-pointer"
                      :class="settings.rateMode === 'crf' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'"
                      @click="settings.rateMode = 'crf'"
                    >
                      画质优先 (CRF)
                    </button>
                    <button
                      type="button"
                      class="px-3 py-1 text-xs rounded transition-colors cursor-pointer"
                      :class="settings.rateMode === 'targetSize' ? 'bg-background shadow-xs font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'"
                      @click="settings.rateMode = 'targetSize'"
                    >
                      目标体积
                    </button>
                  </div>
                </div>

                <div
                  v-if="settings.rateMode === 'crf'"
                  class="slider-field"
                >
                  <span class="text-xs text-muted-foreground"> 视频质量 CRF：{{ settings.videoCrf }}（越小画质越高、体积越大） </span>
                  <Slider
                    :model-value="[settings.videoCrf]"
                    :min="18"
                    :max="36"
                    :step="1"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.videoCrf = val[0] }"
                  />
                </div>
                <div
                  v-else
                  class="field target-size"
                >
                  <span class="text-xs text-muted-foreground"> 目标体积（每个文件，MB） </span>
                  <NInputNumber
                    v-model="settings.targetSizeMb"
                    :min="1"
                    :max="2000"
                    :step="1"
                  />
                  <span class="text-xs text-muted-foreground">
                    按文件时长自动计算码率，适配 B 站群文件 / 动态大小限制
                  </span>
                </div>
              </TabsContent>

              <!-- GIF -->
              <TabsContent
                v-if="selectedFormat.kind === 'gif'"
                value="gif"
                class="space-y-3 pt-2"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> GIF 宽度 </span>
                    <Select
                      :model-value="String(settings.gifWidth)"
                      @update:model-value="(v) => (settings.gifWidth = Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in gifWidthOptions"
                          :key="opt.value"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> GIF 帧率 </span>
                    <Select
                      :model-value="String(settings.gifFps)"
                      @update:model-value="(v) => (settings.gifFps = Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in gifFpsOptions"
                          :key="opt.value"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 循环播放 </span>
                    <Switch
                      :checked="settings.gifLoop"
                      @update:checked="(v) => (settings.gifLoop = v)"
                    />
                  </div>
                </div>
              </TabsContent>

              <!-- 画面处理 -->
              <TabsContent
                v-if="selectedFormat.kind !== 'audio'"
                value="picture"
                class="space-y-3 pt-2"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 旋转 </span>
                    <Select
                      :model-value="String(settings.rotate)"
                      @update:model-value="(v) => (settings.rotate = Number(v) as Rotate)"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in rotateOptions"
                          :key="opt.value"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 水平翻转 </span>
                    <Switch
                      :checked="settings.flipH"
                      @update:checked="(v) => (settings.flipH = v)"
                    />
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 垂直翻转 </span>
                    <Switch
                      :checked="settings.flipV"
                      @update:checked="(v) => (settings.flipV = v)"
                    />
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 锐化 </span>
                    <Switch
                      :checked="settings.sharpen"
                      @update:checked="(v) => (settings.sharpen = v)"
                    />
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 去隔行（老录像） </span>
                    <Switch
                      :checked="settings.deinterlace"
                      @update:checked="(v) => (settings.deinterlace = v)"
                    />
                  </div>
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 亮度：{{ settings.brightness.toFixed(2) }} </span>
                  <Slider
                    :model-value="[settings.brightness]"
                    :min="-0.5"
                    :max="0.5"
                    :step="0.05"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.brightness = Number(val[0].toFixed(2)) }"
                  />
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 对比度：{{ settings.contrast.toFixed(2) }} </span>
                  <Slider
                    :model-value="[settings.contrast]"
                    :min="0.5"
                    :max="2"
                    :step="0.05"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.contrast = Number(val[0].toFixed(2)) }"
                  />
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 饱和度：{{ settings.saturation.toFixed(2) }} </span>
                  <Slider
                    :model-value="[settings.saturation]"
                    :min="0"
                    :max="3"
                    :step="0.1"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.saturation = Number(val[0].toFixed(1)) }"
                  />
                </div>
              </TabsContent>

              <!-- 速度 -->
              <TabsContent
                v-if="selectedFormat.kind !== 'audio'"
                value="speed"
                class="space-y-3 pt-2"
              >
                <div class="field">
                  <span class="text-xs text-muted-foreground"> 播放速度（音画同步） </span>
                  <Select
                    :model-value="String(settings.speed)"
                    @update:model-value="(v) => (settings.speed = Number(v))"
                  >
                    <SelectTrigger class="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="opt in speedOptions"
                        :key="opt.value"
                        :value="String(opt.value)"
                      >
                        {{ opt.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 画面淡入：{{ settings.videoFadeIn }} 秒 </span>
                  <Slider
                    :model-value="[settings.videoFadeIn]"
                    :min="0"
                    :max="5"
                    :step="0.5"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.videoFadeIn = val[0] }"
                  />
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 画面淡出：{{ settings.videoFadeOut }} 秒 </span>
                  <Slider
                    :model-value="[settings.videoFadeOut]"
                    :min="0"
                    :max="5"
                    :step="0.5"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.videoFadeOut = val[0] }"
                  />
                </div>
              </TabsContent>

              <!-- 音频 -->
              <TabsContent
                value="audio"
                class="space-y-3 pt-2"
              >
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 音频码率 </span>
                    <Select
                      :model-value="String(settings.audioBitrate)"
                      :disabled="settings.format === 'wav'"
                      @update:model-value="(v) => (settings.audioBitrate = Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in audioBitrateOptions"
                          :key="opt.value"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 采样率 </span>
                    <Select
                      :model-value="settings.sampleRate === null ? 'null' : String(settings.sampleRate)"
                      @update:model-value="(v) => (settings.sampleRate = v === 'null' ? null : Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in sampleRateOptions"
                          :key="String(opt.value)"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 声道 </span>
                    <Select v-model="settings.channelMode">
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in channelOptions"
                          :key="opt.value"
                          :value="opt.value"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 高通滤波 </span>
                    <Select
                      :model-value="settings.highpass === null ? 'null' : String(settings.highpass)"
                      @update:model-value="(v) => (settings.highpass = v === 'null' ? null : Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in highpassOptions"
                          :key="String(opt.value)"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div class="field">
                    <span class="text-xs text-muted-foreground"> 低通滤波 </span>
                    <Select
                      :model-value="settings.lowpass === null ? 'null' : String(settings.lowpass)"
                      @update:model-value="(v) => (settings.lowpass = v === 'null' ? null : Number(v))"
                    >
                      <SelectTrigger class="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem
                          v-for="opt in lowpassOptions"
                          :key="String(opt.value)"
                          :value="String(opt.value)"
                        >
                          {{ opt.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div
                    v-if="selectedFormat.kind === 'audio'"
                    class="field switch-field"
                  >
                    <span class="text-xs text-muted-foreground"> 保留元数据/封面 </span>
                    <Switch
                      :checked="settings.keepMetadata"
                      @update:checked="(v) => (settings.keepMetadata = v)"
                    />
                  </div>
                  <div class="field switch-field">
                    <span class="text-xs text-muted-foreground"> 响度标准化 </span>
                    <Switch
                      :checked="settings.loudnorm"
                      @update:checked="(v) => (settings.loudnorm = v)"
                    />
                  </div>
                </div>
                <div
                  v-if="!settings.loudnorm"
                  class="slider-field"
                >
                  <span class="text-xs text-muted-foreground"> 音量：{{ settings.volume }}% </span>
                  <Slider
                    :model-value="[settings.volume]"
                    :min="0"
                    :max="300"
                    :step="10"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.volume = val[0] }"
                  />
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 音频淡入：{{ settings.audioFadeIn }} 秒 </span>
                  <Slider
                    :model-value="[settings.audioFadeIn]"
                    :min="0"
                    :max="5"
                    :step="0.5"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.audioFadeIn = val[0] }"
                  />
                </div>
                <div class="slider-field">
                  <span class="text-xs text-muted-foreground"> 音频淡出：{{ settings.audioFadeOut }} 秒 </span>
                  <Slider
                    :model-value="[settings.audioFadeOut]"
                    :min="0"
                    :max="5"
                    :step="0.5"
                    @update:model-value="(val) => { if (val?.[0] !== undefined) settings.audioFadeOut = val[0] }"
                  />
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <Alert
            v-if="invalidItems.length"
            variant="destructive"
          >
            <AlertDescription class="text-xs">
              当前输出为视频/GIF，{{ invalidItems.length }} 个音频源文件无法处理；请改选音频输出格式。
            </AlertDescription>
          </Alert>

          <div
            ref="dropZoneRef"
            class="drop-zone"
            :class="{ active: isOverDropZone }"
            @click="openFilePicker()"
          >
            <span class="text-sm font-medium"> 拖拽音视频到此处，或点击选择 </span>
            <span class="text-xs text-muted-foreground">
              支持批量处理，转换期间请保持页面打开
            </span>
          </div>

          <div class="flex justify-between items-center flex-wrap gap-2">
            <span class="text-xs text-muted-foreground">
              {{ statusText }}
            </span>
            <div class="flex items-center gap-2">
              <Button
                v-if="processing"
                variant="destructive"
                size="sm"
                class="h-8 text-xs"
                @click="cancelAll"
              >
                取消处理
              </Button>
              <Button
                v-else
                size="sm"
                class="h-8 text-xs"
                :loading="loadingCore"
                :disabled="!canProcess"
                @click="processAll"
              >
                开始处理{{ pendingItems.length ? `（${pendingItems.length}）` : '' }}
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="h-8 text-xs"
                :disabled="!doneItems.length || processing"
                @click="downloadAll"
              >
                打包下载 ZIP
              </Button>
              <Button
                size="sm"
                variant="ghost"
                class="h-8 text-xs"
                :disabled="!items.length || processing"
                @click="clearAll"
              >
                清空
              </Button>
            </div>
          </div>

          <div
            v-if="processing"
            class="overall"
          >
            <div class="flex justify-between items-center text-xs text-muted-foreground">
              <span> 整体进度 {{ processedCount }} / {{ pendingItems.length + processedCount }} </span>
              <span class="last-log">
                {{ lastLog }}
              </span>
            </div>
            <Progress
              :model-value="Math.round((processedCount / Math.max(1, pendingItems.length + processedCount)) * 100)"
            />
          </div>

          <div
            v-if="items.length"
            class="summary"
          >
            <span class="text-xs text-muted-foreground"> 已添加 {{ items.length }} 个文件，原始 {{ formatFileSize(totalOriginalSize) }} </span>
            <span
              v-if="doneItems.length"
              class="text-xs text-muted-foreground"
            >
              已输出 {{ doneItems.length }} 个，结果 {{ formatFileSize(totalOutputSize) }}
            </span>
          </div>

          <div
            v-if="items.length"
            class="item-list"
          >
            <div
              v-for="(item, index) in items"
              :key="item.id"
              class="media-item"
            >
              <div
                class="item-thumb"
                :class="{ audio: !item.isVideo }"
              >
                <img
                  v-if="item.poster"
                  :src="item.poster"
                  alt=""
                />
                <span
                  v-else
                  class="thumb-icon"
                >
                  {{ item.isVideo ? '🎬' : '🎵' }}
                </span>
              </div>

              <div class="item-main">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="filename font-medium text-sm"
                    :title="item.file.name"
                  >
                    {{ item.file.name }}
                  </span>
                  <Tag
                    size="small"
                    :variant="statusVariant(item)"
                  >
                    {{ statusLabel(item) }}
                  </Tag>
                </div>

                <div class="flex items-center gap-3 flex-wrap meta text-xs text-muted-foreground">
                  <span>{{ item.isVideo ? '视频' : '音频' }}</span>
                  <span v-if="item.width">{{ item.width }}×{{ item.height }}</span>
                  <span>{{ formatFileSize(item.file.size) }}</span>
                  <span>{{ formattedDuration(item.duration) }}</span>
                  <span
                    v-if="trimmedHint(item)"
                    class="text-primary font-medium"
                  >
                    {{ trimmedHint(item) }}
                  </span>
                  <span
                    v-if="item.outputBlob"
                    :class="savingVariant(item) === 'secondary' ? 'text-emerald-600 font-medium' : 'text-amber-500 font-medium'"
                  >
                    → {{ formatFileSize(item.outputSize) }} ({{ savingText(item) }})
                  </span>
                </div>

                <Progress
                  v-if="item.status === 'processing'"
                  :model-value="item.progress"
                />
                <span
                  v-if="item.error"
                  class="error-text text-destructive text-xs"
                >
                  {{ item.error }}
                </span>

                <Button
                  size="sm"
                  variant="ghost"
                  class="trim-toggle h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                  @click="item.expanded = !item.expanded"
                >
                  {{ item.expanded ? '收起预览/截取' : '预览 / 截取片段' }}
                </Button>

                <div v-if="item.expanded">
                  <MediaTrimmer
                    v-model:start="item.trimStart"
                    v-model:end="item.trimEnd"
                    :src="item.srcUrl"
                    :is-video="item.isVideo"
                    :duration="item.duration"
                  />
                </div>

                <template v-if="item.outputUrl">
                  <span class="output-label text-xs text-muted-foreground">
                    输出预览
                  </span>
                  <img
                    v-if="item.outputKind === 'gif'"
                    :src="item.outputUrl"
                    class="preview"
                    alt=""
                  />
                  <video
                    v-else-if="item.outputKind === 'video'"
                    :src="item.outputUrl"
                    controls
                    class="preview"
                  />
                  <audio
                    v-else
                    :src="item.outputUrl"
                    controls
                    class="preview"
                  />
                </template>
              </div>

              <div class="item-actions flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  class="h-7 text-xs"
                  :disabled="!item.outputBlob"
                  @click="downloadOne(item)"
                >
                  下载
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  class="h-7 text-xs text-muted-foreground hover:text-destructive"
                  :disabled="processing"
                  @click="removeItem(index)"
                >
                  移除
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>

<style scoped>
.media-page {
  max-width: 1040px;
  margin: 0 auto;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.switch-field {
  justify-content: space-between;
}

.preset-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.preset-label {
  font-size: 13px;
}

.advanced-toggle {
  cursor: pointer;
  user-select: none;
  font-size: 13px;
}

.advanced-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px 2px;
}

.target-size {
  max-width: 280px;
}

.slider-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.drop-zone {
  display: flex;
  min-height: 120px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 28px;
  border: 2px dashed var(--border, #e0e0e0);
  border-radius: 10px;
  cursor: pointer;
  transition:
    border-color 0.2s,
    background 0.2s;
}

.drop-zone:hover,
.drop-zone.active {
  border-color: var(--primary-color, #18a058);
  background: rgba(24, 160, 88, 0.04);
}

.overall {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.last-log {
  max-width: 60%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--muted);
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.media-item {
  display: flex;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.item-thumb {
  flex: none;
  width: 96px;
  height: 64px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: 8px;
  background: #111;
}

.item-thumb.audio {
  background: var(--muted);
}

.item-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-icon {
  font-size: 24px;
}

.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filename {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta,
.error-text {
  font-size: 12px;
}

.trim-toggle {
  align-self: flex-start;
}

.output-label {
  font-size: 12px;
  margin-top: 4px;
}

.preview {
  width: 100%;
  max-height: 220px;
  border-radius: 8px;
  background: #111;
}

img.preview {
  width: auto;
  max-width: 100%;
  object-fit: contain;
  background: transparent;
}

.item-actions {
  flex: none;
  align-self: flex-start;
}

@media (max-width: 640px) {
  .summary,
  .media-item {
    flex-direction: column;
  }

  .item-thumb {
    width: 100%;
    height: 120px;
  }

  .item-actions {
    flex-direction: row !important;
    align-self: stretch;
  }
}
</style>
