<script setup lang="ts">
import { FFmpeg } from '@ffmpeg/ffmpeg'
import coreURL from '@ffmpeg/core?url'
import wasmURL from '@ffmpeg/core/wasm?url'
import { fetchFile } from '@ffmpeg/util'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import {
  NAlert, NButton, NCard, NCollapseTransition, NFlex, NGrid, NGridItem, NInputNumber,
  NProgress, NRadioButton, NRadioGroup, NSelect, NSlider, NSwitch, NTabPane, NTabs, NTag, NText,
} from 'naive-ui'
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { formatDuration, formatFileSize } from '@/apps/manage/composables/formatters'
import MediaTrimmer from './MediaTrimmer.vue'
import {
  buildCommands, defaultSettings, formatMap, formats, positive, presets,
} from './mediaConvert'

const message = useMessage()
const ffmpeg = new FFmpeg()

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
const { isOverDropZone } = useDropZone(dropZoneRef, { onDrop: files => files && addFiles(files) })
const { open: openFilePicker, onChange } = useFileDialog({ accept: 'audio/*,video/*,.mkv,.flac,.opus,.ogg,.webm', multiple: true })
onChange(files => files && addFiles(Array.from(files)))

const selectedFormat = computed(() => formatMap.get(settings.format)!)
const formatOptions = formats.map(f => ({ label: f.label, value: f.value }))
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
const audioBitrateOptions = [64, 96, 128, 160, 192, 256, 320].map(v => ({ label: `${v} kbps`, value: v }))
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
const gifFpsOptions = [10, 12, 15, 20, 24].map(v => ({ label: `${v} FPS`, value: v }))
const gifWidthOptions = [240, 320, 480, 640].map(v => ({ label: `${v}px`, value: v }))
const videoCodecOptions = [
  { label: 'H.264（兼容性最好）', value: 'h264' },
  { label: 'H.265（同画质体积更小，编码慢）', value: 'h265' },
]
const videoPresetOptions = ['ultrafast', 'veryfast', 'faster', 'medium', 'slow'].map(v => ({ label: v, value: v }))
const rotateOptions = [
  { label: '不旋转', value: 0 },
  { label: '顺时针 90°', value: 90 },
  { label: '180°', value: 180 },
  { label: '逆时针 90°', value: 270 },
]
const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map(v => ({ label: `${v}x`, value: v }))
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

const hasVideoSource = computed(() => items.value.some(i => i.isVideo))
const doneItems = computed(() => items.value.filter(i => i.outputBlob))
const pendingItems = computed(() => items.value.filter(i => i.status === 'pending' || i.status === 'error'))
const totalOriginalSize = computed(() => items.value.reduce((s, i) => s + i.file.size, 0))
const totalOutputSize = computed(() => doneItems.value.reduce((s, i) => s + i.outputSize, 0))
const needsVideoSource = computed(() => selectedFormat.value.kind !== 'audio')
const invalidItems = computed(() => needsVideoSource.value ? items.value.filter(i => !i.isVideo) : [])
const canProcess = computed(() => pendingItems.value.length > 0 && !processing.value && !loadingCore.value)

const statusText = computed(() => {
  if (loadingCore.value) return '正在加载 FFmpeg 核心，首次使用会稍慢'
  if (processing.value && currentItem.value) return `正在处理：${currentItem.value.file.name}`
  return '所有处理都在浏览器本地完成，不会上传文件'
})

ffmpeg.on('progress', ({ progress }) => {
  if (currentItem.value) currentItem.value.progress = Math.max(1, Math.min(99, Math.round(progress * 100)))
})
ffmpeg.on('log', ({ message: msg }) => { lastLog.value = msg })

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
  const preset = presets.find(p => p.key === key)!
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
    await ffmpeg.load({ coreURL, wasmURL })
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
      const failed = queue.filter(i => i.status === 'error').length
      message[failed ? 'warning' : 'success'](failed ? `处理完成，${failed} 个文件失败` : '全部处理完成')
    }
  } catch (error) {
    if (!canceled) message.error(`FFmpeg 执行失败：${error instanceof Error ? error.message : error}`)
  } finally {
    processing.value = false
    currentItem.value = null
  }
}

// 单线程核心下 exec 会阻塞 worker，只能靠 terminate() 强制中断，之后重新 load 续用。
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
    const steps = buildCommands(inputName, outputName, settings, { start: item.trimStart, end: item.trimEnd }, item.duration ?? 0)
    for (const step of steps) {
      if (canceled) return
      const code = await ffmpeg.exec(step.args)
      if (code !== 0) throw new Error(`ffmpeg exited with code ${code}`)
    }
    if (settings.format === 'gif') written.push('palette.png')
    written.push(outputName)

    const data = await ffmpeg.readFile(outputName) as Uint8Array
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
function savingType(item: MediaItem) {
  return item.outputSize <= item.file.size ? 'success' : 'warning'
}
function statusType(item: MediaItem) {
  if (item.status === 'done') return 'success'
  if (item.status === 'error') return 'error'
  if (item.status === 'processing') return 'info'
  return 'default'
}
function statusLabel(item: MediaItem) {
  return ({ done: '完成', error: '失败', processing: '处理中', pending: '待处理' })[item.status]
}

onBeforeUnmount(() => {
  clearAll()
  if (ffmpeg.loaded) ffmpeg.terminate()
})
</script>

<template>
  <div class="media-page">
    <NCard title="音视频转换与压缩">
      <template #header-extra>
        <NText depth="3">
          本地 ffmpeg.wasm 处理
        </NText>
      </template>

      <NFlex vertical :size="16">
        <NAlert type="info" :show-icon="false">
          支持视频压缩、转 GIF、提取音频、格式互转与片段截取。全程在浏览器本地完成，不上传文件；大文件会占用较多内存和 CPU。
        </NAlert>

        <div class="preset-bar">
          <NText depth="3" class="preset-label">
            快捷预设
          </NText>
          <NFlex :size="8" wrap>
            <NButton
              v-for="preset in presets" :key="preset.key" size="small"
              :type="activePreset === preset.key ? 'primary' : 'default'"
              :title="preset.desc" @click="applyPreset(preset.key)"
            >
              {{ preset.label }}
            </NButton>
          </NFlex>
        </div>

        <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
          <NText depth="2">
            {{ showAdvanced ? '▾' : '▸' }} 高级设置（编码 / 画面 / 速度 / 音频）
          </NText>
        </div>

        <NCollapseTransition :show="showAdvanced">
          <div class="advanced-panel">
            <div class="field">
              <NText depth="3">
                输出格式
              </NText>
              <NSelect v-model:value="settings.format" :options="formatOptions" @update:value="activePreset = null" />
            </div>

            <NTabs type="segment" size="small" animated>
              <!-- 视频编码 -->
              <NTabPane v-if="selectedFormat.kind === 'video'" name="video" tab="编码">
                <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
                  <NGridItem v-if="settings.format === 'mp4'">
                    <div class="field">
                      <NText depth="3">
                        编码器
                      </NText>
                      <NSelect v-model:value="settings.videoCodec" :options="videoCodecOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        最大宽度
                      </NText>
                      <NSelect v-model:value="settings.videoMaxWidth" :options="videoMaxWidthOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        帧率
                      </NText>
                      <NSelect v-model:value="settings.videoFps" :options="videoFpsOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem v-if="settings.format === 'mp4'">
                    <div class="field">
                      <NText depth="3">
                        编码速度（越慢压缩越好）
                      </NText>
                      <NSelect v-model:value="settings.videoPreset" :options="videoPresetOptions" />
                    </div>
                  </NGridItem>
                </NGrid>

                <div class="rate-mode">
                  <NRadioGroup v-model:value="settings.rateMode" size="small">
                    <NRadioButton value="crf">
                      画质优先 (CRF)
                    </NRadioButton>
                    <NRadioButton value="targetSize">
                      目标体积
                    </NRadioButton>
                  </NRadioGroup>
                </div>

                <div v-if="settings.rateMode === 'crf'" class="slider-field">
                  <NText depth="3">
                    视频质量 CRF：{{ settings.videoCrf }}（越小画质越高、体积越大）
                  </NText>
                  <NSlider v-model:value="settings.videoCrf" :min="18" :max="36" :step="1" />
                </div>
                <div v-else class="field target-size">
                  <NText depth="3">
                    目标体积（每个文件，MB）
                  </NText>
                  <NInputNumber v-model:value="settings.targetSizeMb" :min="1" :max="2000" :step="1" />
                  <NText depth="3" style="font-size: 12px">
                    按文件时长自动计算码率，适配 B 站群文件 / 动态大小限制
                  </NText>
                </div>
              </NTabPane>

              <!-- GIF -->
              <NTabPane v-if="selectedFormat.kind === 'gif'" name="gif" tab="GIF">
                <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        GIF 宽度
                      </NText>
                      <NSelect v-model:value="settings.gifWidth" :options="gifWidthOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        GIF 帧率
                      </NText>
                      <NSelect v-model:value="settings.gifFps" :options="gifFpsOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        循环播放
                      </NText>
                      <NSwitch v-model:value="settings.gifLoop" />
                    </div>
                  </NGridItem>
                </NGrid>
              </NTabPane>

              <!-- 画面处理 -->
              <NTabPane v-if="selectedFormat.kind !== 'audio'" name="picture" tab="画面">
                <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        旋转
                      </NText>
                      <NSelect v-model:value="settings.rotate" :options="rotateOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        水平翻转
                      </NText>
                      <NSwitch v-model:value="settings.flipH" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        垂直翻转
                      </NText>
                      <NSwitch v-model:value="settings.flipV" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        锐化
                      </NText>
                      <NSwitch v-model:value="settings.sharpen" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        去隔行（老录像）
                      </NText>
                      <NSwitch v-model:value="settings.deinterlace" />
                    </div>
                  </NGridItem>
                </NGrid>
                <div class="slider-field">
                  <NText depth="3">
                    亮度：{{ settings.brightness.toFixed(2) }}
                  </NText>
                  <NSlider v-model:value="settings.brightness" :min="-0.5" :max="0.5" :step="0.05" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    对比度：{{ settings.contrast.toFixed(2) }}
                  </NText>
                  <NSlider v-model:value="settings.contrast" :min="0.5" :max="2" :step="0.05" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    饱和度：{{ settings.saturation.toFixed(2) }}
                  </NText>
                  <NSlider v-model:value="settings.saturation" :min="0" :max="3" :step="0.1" />
                </div>
              </NTabPane>

              <!-- 速度 -->
              <NTabPane v-if="selectedFormat.kind !== 'audio'" name="speed" tab="速度">
                <div class="field">
                  <NText depth="3">
                    播放速度（音画同步）
                  </NText>
                  <NSelect v-model:value="settings.speed" :options="speedOptions" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    画面淡入：{{ settings.videoFadeIn }} 秒
                  </NText>
                  <NSlider v-model:value="settings.videoFadeIn" :min="0" :max="5" :step="0.5" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    画面淡出：{{ settings.videoFadeOut }} 秒
                  </NText>
                  <NSlider v-model:value="settings.videoFadeOut" :min="0" :max="5" :step="0.5" />
                </div>
              </NTabPane>

              <!-- 音频 -->
              <NTabPane name="audio" tab="音频">
                <NGrid cols="1 s:2 m:3" responsive="screen" :x-gap="12" :y-gap="12">
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        音频码率
                      </NText>
                      <NSelect v-model:value="settings.audioBitrate" :options="audioBitrateOptions" :disabled="settings.format === 'wav'" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        采样率
                      </NText>
                      <NSelect v-model:value="settings.sampleRate" :options="sampleRateOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        声道
                      </NText>
                      <NSelect v-model:value="settings.channelMode" :options="channelOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        高通滤波
                      </NText>
                      <NSelect v-model:value="settings.highpass" :options="highpassOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field">
                      <NText depth="3">
                        低通滤波
                      </NText>
                      <NSelect v-model:value="settings.lowpass" :options="lowpassOptions" />
                    </div>
                  </NGridItem>
                  <NGridItem v-if="selectedFormat.kind === 'audio'">
                    <div class="field switch-field">
                      <NText depth="3">
                        保留元数据/封面
                      </NText>
                      <NSwitch v-model:value="settings.keepMetadata" />
                    </div>
                  </NGridItem>
                  <NGridItem>
                    <div class="field switch-field">
                      <NText depth="3">
                        响度标准化
                      </NText>
                      <NSwitch v-model:value="settings.loudnorm" />
                    </div>
                  </NGridItem>
                </NGrid>
                <div v-if="!settings.loudnorm" class="slider-field">
                  <NText depth="3">
                    音量：{{ settings.volume }}%
                  </NText>
                  <NSlider v-model:value="settings.volume" :min="0" :max="300" :step="10" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    音频淡入：{{ settings.audioFadeIn }} 秒
                  </NText>
                  <NSlider v-model:value="settings.audioFadeIn" :min="0" :max="5" :step="0.5" />
                </div>
                <div class="slider-field">
                  <NText depth="3">
                    音频淡出：{{ settings.audioFadeOut }} 秒
                  </NText>
                  <NSlider v-model:value="settings.audioFadeOut" :min="0" :max="5" :step="0.5" />
                </div>
              </NTabPane>
            </NTabs>
          </div>
        </NCollapseTransition>

        <NAlert v-if="invalidItems.length" type="warning" :show-icon="false">
          当前输出为视频/GIF，{{ invalidItems.length }} 个音频源文件无法处理；请改选音频输出格式。
        </NAlert>

        <div ref="dropZoneRef" class="drop-zone" :class="{ active: isOverDropZone }" @click="openFilePicker()">
          <NText style="font-size: 15px">
            拖拽音视频到此处，或点击选择
          </NText>
          <NText depth="3" style="font-size: 13px">
            支持批量处理，转换期间请保持页面打开
          </NText>
        </div>

        <NFlex justify="space-between" align="center" wrap>
          <NText depth="3">
            {{ statusText }}
          </NText>
          <NFlex :size="8">
            <NButton v-if="processing" type="error" @click="cancelAll">
              取消处理
            </NButton>
            <NButton v-else type="primary" :loading="loadingCore" :disabled="!canProcess" @click="processAll">
              开始处理{{ pendingItems.length ? `（${pendingItems.length}）` : '' }}
            </NButton>
            <NButton :disabled="!doneItems.length || processing" @click="downloadAll">
              打包下载 ZIP
            </NButton>
            <NButton tertiary :disabled="!items.length || processing" @click="clearAll">
              清空
            </NButton>
          </NFlex>
        </NFlex>

        <div v-if="processing" class="overall">
          <NFlex justify="space-between" align="center">
            <NText depth="3">
              整体进度 {{ processedCount }} / {{ pendingItems.length + processedCount }}
            </NText>
            <NText depth="3" class="last-log">
              {{ lastLog }}
            </NText>
          </NFlex>
          <NProgress
            type="line"
            :percentage="Math.round((processedCount / Math.max(1, pendingItems.length + processedCount)) * 100)"
            :show-indicator="false"
          />
        </div>

        <div v-if="items.length" class="summary">
          <NText depth="3">
            已添加 {{ items.length }} 个文件，原始 {{ formatFileSize(totalOriginalSize) }}
          </NText>
          <NText v-if="doneItems.length" depth="3">
            已输出 {{ doneItems.length }} 个，结果 {{ formatFileSize(totalOutputSize) }}
          </NText>
        </div>

        <div v-if="items.length" class="item-list">
          <div v-for="(item, index) in items" :key="item.id" class="media-item">
            <div class="item-thumb" :class="{ audio: !item.isVideo }">
              <img v-if="item.poster" :src="item.poster" alt="">
              <NText v-else depth="3" class="thumb-icon">
                {{ item.isVideo ? '🎬' : '🎵' }}
              </NText>
            </div>

            <div class="item-main">
              <NFlex align="center" :size="8" wrap>
                <NText strong class="filename" :title="item.file.name">
                  {{ item.file.name }}
                </NText>
                <NTag size="small" :type="statusType(item)" :bordered="false">
                  {{ statusLabel(item) }}
                </NTag>
              </NFlex>

              <NFlex :size="12" wrap class="meta">
                <NText depth="3">
                  {{ item.isVideo ? '视频' : '音频' }}
                </NText>
                <NText v-if="item.width" depth="3">
                  {{ item.width }}×{{ item.height }}
                </NText>
                <NText depth="3">
                  {{ formatFileSize(item.file.size) }}
                </NText>
                <NText depth="3">
                  {{ formattedDuration(item.duration) }}
                </NText>
                <NText v-if="trimmedHint(item)" depth="3" type="info">
                  {{ trimmedHint(item) }}
                </NText>
                <NText v-if="item.outputBlob" :type="savingType(item)">
                  → {{ formatFileSize(item.outputSize) }} ({{ savingText(item) }})
                </NText>
              </NFlex>

              <NProgress v-if="item.status === 'processing'" type="line" :percentage="item.progress" :show-indicator="false" />
              <NText v-if="item.error" type="error" class="error-text">
                {{ item.error }}
              </NText>

              <NButton size="tiny" quaternary class="trim-toggle" @click="item.expanded = !item.expanded">
                {{ item.expanded ? '收起预览/截取' : '预览 / 截取片段' }}
              </NButton>

              <NCollapseTransition :show="item.expanded">
                <MediaTrimmer
                  v-model:start="item.trimStart" v-model:end="item.trimEnd"
                  :src="item.srcUrl" :is-video="item.isVideo" :duration="item.duration"
                />
              </NCollapseTransition>

              <template v-if="item.outputUrl">
                <NText depth="3" class="output-label">
                  输出预览
                </NText>
                <img v-if="item.outputKind === 'gif'" :src="item.outputUrl" class="preview" alt="">
                <video v-else-if="item.outputKind === 'video'" :src="item.outputUrl" controls class="preview" />
                <audio v-else :src="item.outputUrl" controls class="preview" />
              </template>
            </div>

            <NFlex vertical class="item-actions" :size="6">
              <NButton size="small" :disabled="!item.outputBlob" @click="downloadOne(item)">
                下载
              </NButton>
              <NButton size="small" tertiary :disabled="processing" @click="removeItem(index)">
                移除
              </NButton>
            </NFlex>
          </div>
        </div>
      </NFlex>
    </NCard>
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

.rate-mode {
  display: flex;
  justify-content: center;
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
  border: 2px dashed var(--n-border-color, #e0e0e0);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
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
  background: var(--n-color-embedded);
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
  border: 1px solid var(--n-border-color);
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
  background: var(--n-color-embedded);
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







