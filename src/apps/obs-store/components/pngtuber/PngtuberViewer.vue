<script setup lang="ts">
import { useClipboard, useDebounceFn } from '@vueuse/core'
import {
  ArrowUpload24Regular,
  Checkmark24Regular,
  Copy24Regular,
  Delete24Regular,
  Image24Regular,
  Lightbulb24Regular,
  Mic24Regular,
  MicOff24Regular,
  Open24Regular,
  Sparkle24Regular,
  Speaker224Regular,
  SpeakerOff24Regular,
} from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NColorPicker,
  NDivider,
  NFlex,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSlider,
  NSpace,
  NSwitch,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import {
  computed,
  onMounted,
  ref,
} from 'vue'

import {
  copyPngtuberIdleToSpeaking,
  deletePngtuberImage,
  uploadPngtuberImage,
} from '@/api/obs-store'
import type { PngtuberImageSlot } from '@/api/obs-store'
import { useObsBridge } from '@/apps/obs-store/sync'

import { compressAvatarImage } from './compressAvatar'
import PngtuberDisplay from './PngtuberDisplay.vue'
import { DEFAULT_PNGTUBER_STATE, sanitizePngtuberState } from './types'
import type {
  AnimationIntensity,
  IdleAnimationType,
  PngtuberState,
  SpeakingAnimationType,
} from './types'
import { useAudioReactive } from './useAudioReactive'

const message = useMessage()
const { copy, isSupported: isCopySupported } = useClipboard()

const channelId = ref<string>('default')
const copied = ref(false)

const {
  state,
  updateState,
} = useObsBridge<PngtuberState>({
  componentId: 'pngtuber',
  channelId: channelId.value,
  defaultState: DEFAULT_PNGTUBER_STATE,
  role: 'controller',
})

const viewState = computed(() => sanitizePngtuberState(state.value))

onMounted(() => {
  const cleaned = sanitizePngtuberState(state.value)
  if (cleaned.idleImage !== state.value.idleImage || cleaned.speakingImage !== state.value.speakingImage) {
    updateState({
      idleImage: cleaned.idleImage,
      speakingImage: cleaned.speakingImage,
    })
  }
})

const persistThreshold = useDebounceFn((val: number) => updateState({ threshold: val }), 200)
const persistGain = useDebounceFn((val: number) => updateState({ gain: val }), 200)
const persistRelease = useDebounceFn((val: number) => updateState({ releaseDelay: val }), 200)
const persistScale = useDebounceFn((val: number) => updateState({ scale: val }), 200)

function onThresholdInput(val: number) {
  state.value.threshold = val
  persistThreshold(val)
}
function onGainInput(val: number) {
  state.value.gain = val
  persistGain(val)
}
function onReleaseInput(val: number) {
  state.value.releaseDelay = val
  persistRelease(val)
}
function onScaleInput(val: number) {
  state.value.scale = val
  persistScale(val)
}

const {
  isListening,
  isSpeaking,
  smoothedVolume,
  errorMessage: audioErrorMessage,
  deviceList,
  startListening,
  stopListening,
  simulateSpeaking,
} = useAudioReactive({
  threshold: computed(() => state.value.threshold),
  gain: computed(() => state.value.gain),
  releaseDelay: computed(() => state.value.releaseDelay),
  deviceId: computed(() => state.value.deviceId),
})

function handleTestTrigger() {
  simulateSpeaking(true)
  setTimeout(() => {
    simulateSpeaking(false)
  }, 1500)
}

// 麦克风开关切换
async function toggleListening() {
  if (isListening.value) {
    stopListening()
    message.info('已停止麦克风监听')
  } else {
    const success = await startListening(state.value.deviceId)
    if (success) {
      message.success('已开启麦克风监听，说话即可驱动立绘')
    } else if (audioErrorMessage.value) {
      message.error(audioErrorMessage.value)
    }
  }
}

const uploading = ref<PngtuberImageSlot | null>(null)

function isHostedPngtuberUrl(url: string) {
  return /\/obs-store\/pngtuber\/image\/\d+\/(idle|speaking)/.test(url)
}

async function handleFileUpload(type: PngtuberImageSlot, file?: File) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    message.error('请选择图片文件')
    return
  }

  uploading.value = type
  try {
    const compressed = await compressAvatarImage(file)
    const result = await uploadPngtuberImage(type, compressed)
    updateState(type === 'idle' ? { idleImage: result.url } : { speakingImage: result.url })
    message.success(type === 'idle' ? '已上传静止立绘' : '已上传说话立绘')
  } catch (error) {
    message.error(error instanceof Error ? error.message : '上传失败')
  } finally {
    uploading.value = null
  }
}

// 拖拽上传支持
const isDraggingIdle = ref(false)
const isDraggingSpeaking = ref(false)

function onDragOver(type: 'idle' | 'speaking', e: DragEvent) {
  e.preventDefault()
  if (type === 'idle') isDraggingIdle.value = true
  else isDraggingSpeaking.value = true
}

function onDragLeave(type: 'idle' | 'speaking') {
  if (type === 'idle') isDraggingIdle.value = false
  else isDraggingSpeaking.value = false
}

function onDrop(type: 'idle' | 'speaking', e: DragEvent) {
  e.preventDefault()
  if (type === 'idle') isDraggingIdle.value = false
  else isDraggingSpeaking.value = false

  const files = e.dataTransfer?.files
  if (files && files[0]) {
    handleFileUpload(type, files[0])
  }
}

async function clearCustomImage(type: PngtuberImageSlot) {
  const current = type === 'idle' ? state.value.idleImage : state.value.speakingImage
  const other = type === 'idle' ? state.value.speakingImage : state.value.idleImage
  const currentPath = current.split('?')[0]
  if (isHostedPngtuberUrl(current) && currentPath !== other.split('?')[0]) {
    try {
      await deletePngtuberImage(type)
    } catch {
      // 本地状态仍清除
    }
  }
  updateState(type === 'idle' ? { idleImage: '' } : { speakingImage: '' })
  message.info(type === 'idle' ? '已清除静止立绘' : '已清除说话立绘')
}

async function copyIdleToSpeaking() {
  if (!state.value.idleImage) {
    message.error('还没有静止立绘')
    return
  }
  if (isHostedPngtuberUrl(state.value.idleImage)) {
    try {
      const result = await copyPngtuberIdleToSpeaking()
      updateState({ speakingImage: result.url })
      message.success('已将静止立绘复制为说话立绘')
    } catch (error) {
      message.error(error instanceof Error ? error.message : '复制失败')
    }
    return
  }
  updateState({ speakingImage: state.value.idleImage })
  message.success('已将静止立绘复制为说话立绘')
}

// 动效选项列表
const speakingAnimationOptions = [
  { label: '元气弹跳 (Bounce)', value: 'bounce' as SpeakingAnimationType },
  { label: '果冻形变 (Jelly)', value: 'jelly' as SpeakingAnimationType },
  { label: '左右晃动 (Shake)', value: 'shake' as SpeakingAnimationType },
  { label: '脉冲放大 (Pulse)', value: 'pulse' as SpeakingAnimationType },
  { label: '平缓悬浮 (Float)', value: 'float' as SpeakingAnimationType },
  { label: '无动画 (仅切图)', value: 'none' as SpeakingAnimationType },
]

const idleAnimationOptions = [
  { label: '舒缓呼吸 (Breathe)', value: 'breathe' as IdleAnimationType },
  { label: '轻微微晃 (Sway)', value: 'sway' as IdleAnimationType },
  { label: '慢速漂浮 (Float)', value: 'float' as IdleAnimationType },
  { label: '完全静止 (None)', value: 'none' as IdleAnimationType },
]

const intensityOptions = [
  { label: '轻微', value: 'subtle' as AnimationIntensity },
  { label: '标准', value: 'normal' as AnimationIntensity },
  { label: '强烈', value: 'energetic' as AnimationIntensity },
]

// 预览背景
const previewBg = ref<'checker' | 'dark' | 'green' | 'transparent'>('checker')

// OBS URL 计算
const obsRelativeUrl = computed(() => {
  const p = new URLSearchParams()
  if (channelId.value && channelId.value !== 'default') {
    p.set('channel', channelId.value)
  }
  const queryStr = p.toString()
  return `/obs-store/pngtuber${queryStr ? `?${queryStr}` : ''}`
})

const obsAbsoluteUrl = computed(() => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${obsRelativeUrl.value}`
  }
  return obsRelativeUrl.value
})

async function copyObsUrl() {
  if (!isCopySupported.value) {
    message.error('当前浏览器不支持自动复制，请手动选中复制')
    return
  }
  try {
    await copy(obsAbsoluteUrl.value)
    copied.value = true
    message.success('OBS 浏览器源链接已复制到剪贴板！')
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    message.error('复制失败，请手动复制')
  }
}

function openObsWindow() {
  if (typeof window !== 'undefined') {
    window.open(obsRelativeUrl.value, '_blank')
  }
}

// 外链 URL 弹窗/直接输入状态
const idleUrlInput = ref('')
const speakingUrlInput = ref('')

function applyUrlImage(type: PngtuberImageSlot) {
  const raw = type === 'idle' ? idleUrlInput.value.trim() : speakingUrlInput.value.trim()
  if (!raw) return
  if (!/^https?:\/\//i.test(raw)) {
    message.error('请输入 http(s) 图片链接')
    return
  }
  updateState(type === 'idle' ? { idleImage: raw } : { speakingImage: raw })
  if (type === 'idle') idleUrlInput.value = ''
  else speakingUrlInput.value = ''
  message.success(type === 'idle' ? '已应用静止立绘外链' : '已应用说话立绘外链')
}
</script>

<template>
  <div class="pngtuber-viewer-root">
    <!-- 主控制台栅格布局 -->
    <div class="workbench-layout">
      <!-- 左侧：参数调节面板 -->
      <div class="config-pane">
        <!-- 1. 麦克风与说话检测卡片 -->
        <NCard
          size="small"
          class="workbench-card audio-control-card"
          :bordered="false"
        >
          <template #header>
            <NFlex
              align="center"
              justify="space-between"
              style="width: 100%"
            >
              <NFlex
                align="center"
                :size="8"
              >
                <NIcon
                  size="18"
                  :color="isListening ? '#10b981' : '#94a3b8'"
                >
                  <Mic24Regular v-if="isListening" />
                  <MicOff24Regular v-else />
                </NIcon>
                <span class="card-title">麦克风监听与声音判定</span>
              </NFlex>
              <NFlex
                align="center"
                :size="8"
              >
                <NTag
                  v-if="isListening"
                  type="success"
                  size="small"
                  round
                >
                  监听中
                </NTag>
                <NTag
                  v-else
                  type="default"
                  size="small"
                  round
                >
                  未开启
                </NTag>
              </NFlex>
            </NFlex>
          </template>

          <NSpace
            vertical
            :size="14"
          >
            <NAlert
              v-if="audioErrorMessage"
              type="warning"
              :title="audioErrorMessage"
              :bordered="false"
            />
            <!-- 启动开关与测试按钮 -->
            <NFlex
              align="center"
              justify="space-between"
            >
              <NButton
                :type="isListening ? 'error' : 'primary'"
                secondary
                size="medium"
                style="flex: 1"
                @click="toggleListening"
              >
                <template #icon>
                  <NIcon>
                    <MicOff24Regular v-if="isListening" />
                    <Mic24Regular v-else />
                  </NIcon>
                </template>
                {{ isListening ? '停止麦克风监听' : '开启麦克风监听' }}
              </NButton>

              <NButton
                size="medium"
                type="info"
                ghost
                @click="handleTestTrigger"
              >
                <template #icon>
                  <NIcon><Sparkle24Regular /></NIcon>
                </template>
                模拟说话 1.5s
              </NButton>
            </NFlex>

            <!-- 麦克风设备选择 -->
            <NFormItem
              label="音频输入设备"
              :show-feedback="false"
            >
              <NSelect
                v-model:value="state.deviceId"
                size="small"
                :options="deviceList.map((d) => ({ label: d.label, value: d.deviceId }))"
                placeholder="默认麦克风"
                @update:value="(val) => updateState({ deviceId: val })"
              />
            </NFormItem>

            <!-- 实时电平表与触发阈值刻度 -->
            <div class="meter-container">
              <div class="meter-header">
                <span class="meter-label">实时音量电平: {{ Math.round(smoothedVolume) }}%</span>
                <span
                  class="meter-status"
                  :class="{ 'is-active': isSpeaking }"
                >
                  <NIcon
                    size="14"
                    style="vertical-align: -2px; margin-right: 4px"
                  >
                    <Speaker224Regular v-if="isSpeaking" />
                    <SpeakerOff24Regular v-else />
                  </NIcon>
                  {{ isSpeaking ? '说话中 (Active)' : '待机中 (Idle)' }}
                </span>
              </div>

              <!-- 动态电平条 -->
              <div class="meter-track">
                <!-- 实际音量电平 -->
                <div
                  class="meter-fill"
                  :class="{ 'is-exceeded': smoothedVolume >= state.threshold }"
                  :style="{ width: `${Math.min(100, Math.max(0, smoothedVolume))}%` }"
                />
                <!-- 阈值红线指示器 -->
                <div
                  class="meter-threshold-line"
                  :style="{ left: `${state.threshold}%` }"
                >
                  <span class="threshold-tag">{{ state.threshold }}%</span>
                </div>
              </div>
            </div>

            <!-- 音量阈值调节 -->
            <NFormItem
              label="说话判定阈值 (超过即切换说话立绘)"
              :show-feedback="false"
            >
              <NFlex
                align="center"
                style="width: 100%"
                :size="12"
              >
                <NSlider
                  :value="state.threshold"
                  :min="1"
                  :max="100"
                  :step="1"
                  style="flex: 1"
                  @update:value="(val) => onThresholdInput(Number(val))"
                />
                <NInputNumber
                  :value="state.threshold"
                  size="small"
                  :min="1"
                  :max="100"
                  style="width: 76px"
                  @update:value="(val) => onThresholdInput(val || 15)"
                />
              </NFlex>
            </NFormItem>

            <!-- 麦克风增益与释放延时 -->
            <NGrid
              :cols="2"
              :x-gap="12"
            >
              <NGridItem>
                <NFormItem
                  label="麦克风增益"
                  :show-feedback="false"
                >
                  <NInputNumber
                    :value="state.gain"
                    size="small"
                    :min="0.5"
                    :max="3.0"
                    :step="0.1"
                    style="width: 100%"
                    @update:value="(val) => onGainInput(val || 1.0)"
                  />
                </NFormItem>
              </NGridItem>
              <NGridItem>
                <NFormItem
                  label="消抖保持延时"
                  :show-feedback="false"
                >
                  <NInputNumber
                    :value="state.releaseDelay"
                    size="small"
                    :min="50"
                    :max="1000"
                    :step="50"
                    style="width: 100%"
                    @update:value="(val) => onReleaseInput(val || 220)"
                  >
                    <template #suffix>
                      ms
                    </template>
                  </NInputNumber>
                </NFormItem>
              </NGridItem>
            </NGrid>
          </NSpace>
        </NCard>

        <!-- 2. 上传立绘图片卡片 -->
        <NCard
          size="small"
          class="workbench-card"
          :bordered="false"
        >
          <template #header>
            <NFlex
              align="center"
              justify="space-between"
            >
              <span class="card-title">立绘图片配置</span>
              <NText
                depth="3"
                style="font-size: 12px"
              >
                上传后会压缩为 WebP，也可直接填外链
              </NText>
            </NFlex>
          </template>

          <NSpace
            vertical
            :size="14"
          >
            <NGrid
              :cols="2"
              :x-gap="12"
            >
              <!-- 1. 静止/闭嘴立绘 -->
              <NGridItem>
                <div
                  class="avatar-dropzone"
                  :class="{ 'is-dragging': isDraggingIdle, 'has-image': !!state.idleImage, 'is-uploading': uploading === 'idle' }"
                  @dragover="(e) => onDragOver('idle', e)"
                  @dragleave="() => onDragLeave('idle')"
                  @drop="(e) => onDrop('idle', e)"
                >
                  <div class="dropzone-header">
                    <NFlex
                      align="center"
                      :size="4"
                    >
                      <NIcon size="14"><Image24Regular /></NIcon>
                      <span class="dropzone-title">静止 / 闭嘴立绘</span>
                    </NFlex>
                    <NButton
                      v-if="state.idleImage"
                      text
                      type="error"
                      size="tiny"
                      @click="clearCustomImage('idle')"
                    >
                      <template #icon>
                        <NIcon><Delete24Regular /></NIcon>
                      </template>
                      清除
                    </NButton>
                  </div>

                  <div class="dropzone-body">
                    <div
                      v-if="state.idleImage"
                      class="preview-thumb-wrap"
                    >
                      <img
                        :src="state.idleImage"
                        alt="Idle"
                        class="thumb-img"
                      >
                    </div>
                    <div
                      v-else
                      class="empty-upload-hint"
                    >
                      <NIcon
                        size="28"
                        color="var(--vtsuru-fg-muted)"
                      >
                        <Image24Regular />
                      </NIcon>
                      <span class="hint-text">拖拽或点击上传</span>
                    </div>
                  </div>

                  <label class="dropzone-upload-btn">
                    <NIcon size="14"><ArrowUpload24Regular /></NIcon>
                    <span>{{ state.idleImage ? '更换立绘' : '选择图片' }}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style="display: none"
                      @change="(e: Event) => { const el = e.target as HTMLInputElement; handleFileUpload('idle', el.files?.[0]); el.value = '' }"
                    >
                  </label>

                  <!-- 外链快速输入 -->
                  <div class="url-input-row">
                    <NInputGroup>
                      <NInput
                        v-model:value="idleUrlInput"
                        size="tiny"
                        placeholder="或输入图片 URL..."
                        @keyup.enter="applyUrlImage('idle')"
                      />
                      <NButton
                        size="tiny"
                        type="primary"
                        ghost
                        :disabled="!idleUrlInput.trim()"
                        @click="applyUrlImage('idle')"
                      >
                        确定
                      </NButton>
                    </NInputGroup>
                  </div>
                </div>
              </NGridItem>

              <!-- 2. 说话/张嘴立绘 -->
              <NGridItem>
                <div
                  class="avatar-dropzone"
                  :class="{ 'is-dragging': isDraggingSpeaking, 'has-image': !!state.speakingImage, 'is-uploading': uploading === 'speaking' }"
                  @dragover="(e) => onDragOver('speaking', e)"
                  @dragleave="() => onDragLeave('speaking')"
                  @drop="(e) => onDrop('speaking', e)"
                >
                  <div class="dropzone-header">
                    <NFlex
                      align="center"
                      :size="4"
                    >
                      <NIcon size="14"><Speaker224Regular /></NIcon>
                      <span class="dropzone-title">说话 / 张嘴立绘</span>
                    </NFlex>
                    <NFlex :size="4">
                    <NButton
                      v-if="state.idleImage"
                      text
                      size="tiny"
                      :disabled="uploading === 'speaking'"
                      @click="copyIdleToSpeaking"
                    >
                      用静止立绘
                    </NButton>
                    <NButton
                      v-if="state.speakingImage"
                      text
                      type="error"
                      size="tiny"
                      @click="clearCustomImage('speaking')"
                    >
                      <template #icon>
                        <NIcon><Delete24Regular /></NIcon>
                      </template>
                      清除
                    </NButton>
                    </NFlex>
                  </div>

                  <div class="dropzone-body">
                    <div
                      v-if="state.speakingImage"
                      class="preview-thumb-wrap"
                    >
                      <img
                        :src="state.speakingImage"
                        alt="Speaking"
                        class="thumb-img"
                      >
                    </div>
                    <div
                      v-else
                      class="empty-upload-hint"
                    >
                      <NIcon
                        size="28"
                        color="var(--vtsuru-fg-muted)"
                      >
                        <Image24Regular />
                      </NIcon>
                      <span class="hint-text">拖拽或点击上传</span>
                    </div>
                  </div>

                  <label class="dropzone-upload-btn">
                    <NIcon size="14"><ArrowUpload24Regular /></NIcon>
                    <span>{{ state.speakingImage ? '更换立绘' : '选择图片' }}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style="display: none"
                      @change="(e: Event) => { const el = e.target as HTMLInputElement; handleFileUpload('speaking', el.files?.[0]); el.value = '' }"
                    >
                  </label>

                  <!-- 外链快速输入 -->
                  <div class="url-input-row">
                    <NInputGroup>
                      <NInput
                        v-model:value="speakingUrlInput"
                        size="tiny"
                        placeholder="或输入图片 URL..."
                        @keyup.enter="applyUrlImage('speaking')"
                      />
                      <NButton
                        size="tiny"
                        type="primary"
                        ghost
                        :disabled="!speakingUrlInput.trim()"
                        @click="applyUrlImage('speaking')"
                      >
                        确定
                      </NButton>
                    </NInputGroup>
                  </div>
                </div>
              </NGridItem>
            </NGrid>
          </NSpace>
        </NCard>

        <!-- 3. 动效与动画参数配置卡片 -->
        <NCard
          size="small"
          class="workbench-card"
          :bordered="false"
        >
          <template #header>
            <span class="card-title">动效类型与动作参数</span>
          </template>

          <NSpace
            vertical
            :size="12"
          >
            <!-- 说话动作 -->
            <NFormItem
              label="说话动效 (Speaking)"
              :show-feedback="false"
            >
              <NSelect
                v-model:value="state.speakingAnimation"
                size="small"
                :options="speakingAnimationOptions"
                @update:value="(val) => updateState({ speakingAnimation: val })"
              />
            </NFormItem>

            <!-- 待机动作 -->
            <NFormItem
              label="静止待机动效 (Idle)"
              :show-feedback="false"
            >
              <NSelect
                v-model:value="state.idleAnimation"
                size="small"
                :options="idleAnimationOptions"
                @update:value="(val) => updateState({ idleAnimation: val })"
              />
            </NFormItem>

            <!-- 动效幅度/强度 -->
            <NFormItem
              label="动效弹跳/形变强度"
              :show-feedback="false"
            >
              <NRadioGroup
                v-model:value="state.intensity"
                size="small"
                @update:value="(val) => updateState({ intensity: val })"
              >
                <NRadioButton
                  v-for="opt in intensityOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </NRadioButton>
              </NRadioGroup>
            </NFormItem>

            <NDivider style="margin: 6px 0" />

            <!-- 外观细节开关 -->
            <NGrid
              :cols="2"
              :x-gap="12"
              :y-gap="8"
            >
              <NGridItem>
                <NFlex
                  align="center"
                  justify="space-between"
                  class="setting-toggle-row"
                >
                  <span>水平翻转镜像</span>
                  <NSwitch
                    v-model:value="state.flipH"
                    size="small"
                    @update:value="(val) => updateState({ flipH: val })"
                  />
                </NFlex>
              </NGridItem>

              <NGridItem>
                <NFlex
                  align="center"
                  justify="space-between"
                  class="setting-toggle-row"
                >
                  <span>静止时微暗</span>
                  <NSwitch
                    v-model:value="state.idleDim"
                    size="small"
                    @update:value="(val) => updateState({ idleDim: val })"
                  />
                </NFlex>
              </NGridItem>

              <NGridItem>
                <NFlex
                  align="center"
                  justify="space-between"
                  class="setting-toggle-row"
                >
                  <span>地面立体软投影</span>
                  <NSwitch
                    v-model:value="state.shadow"
                    size="small"
                    @update:value="(val) => updateState({ shadow: val })"
                  />
                </NFlex>
              </NGridItem>

              <NGridItem>
                <NFlex
                  align="center"
                  justify="space-between"
                  class="setting-toggle-row"
                >
                  <span>说话发光光晕</span>
                  <NSwitch
                    v-model:value="state.showGlow"
                    size="small"
                    @update:value="(val) => updateState({ showGlow: val })"
                  />
                </NFlex>
              </NGridItem>
            </NGrid>

            <!-- 光晕颜色 -->
            <NFormItem
              v-if="state.showGlow"
              label="说话外发光颜色"
              :show-feedback="false"
            >
              <NColorPicker
                :value="state.glowColor"
                size="small"
                :show-alpha="false"
                @update:value="(val) => updateState({ glowColor: val })"
              />
            </NFormItem>

            <!-- 整体缩放 -->
            <NFormItem
              label="画面缩放比例"
              :show-feedback="false"
            >
              <NFlex
                align="center"
                style="width: 100%"
                :size="12"
              >
                <NSlider
                  :value="state.scale"
                  :min="0.4"
                  :max="1.8"
                  :step="0.05"
                  style="flex: 1"
                  @update:value="(val) => onScaleInput(Number(val))"
                />
                <span style="font-size: 12px; min-width: 40px">{{ Math.round((state.scale || 1) * 100) }}%</span>
              </NFlex>
            </NFormItem>
          </NSpace>
        </NCard>
      </div>

      <!-- 右侧：实时预览舞台与 OBS 链接集成 -->
      <div class="stage-pane">
        <NCard
          size="small"
          class="workbench-card stage-card"
          :bordered="false"
        >
          <template #header>
            <NFlex
              align="center"
              justify="space-between"
            >
              <span class="card-title">OBS 画面实时监视器</span>
              <NRadioGroup
                v-model:value="previewBg"
                size="small"
              >
                <NRadioButton value="checker">
                  透明棋盘
                </NRadioButton>
                <NRadioButton value="dark">
                  暗色
                </NRadioButton>
                <NRadioButton value="green">
                  绿幕
                </NRadioButton>
              </NRadioGroup>
            </NFlex>
          </template>

          <!-- 监视器舞台 -->
          <div
            class="live-preview-viewport"
            :class="`bg-${previewBg}`"
          >
            <!-- 说话状态悬浮徽标 -->
            <div
              class="preview-state-badge"
              :class="{ 'is-speaking': isSpeaking }"
            >
              <span class="badge-dot" />
              <span>{{ isSpeaking ? '说话中 (Speaking)' : '待机中 (Idle)' }}</span>
            </div>

            <!-- 内嵌组件渲染 -->
            <PngtuberDisplay
              :state="viewState"
              :is-speaking="isSpeaking"
              inline-mode
            />
          </div>

          <!-- OBS 源链接集成卡片 -->
          <div class="obs-link-box">
            <div class="obs-link-header">
              <span class="obs-link-title">OBS 浏览器源链接</span>
              <NText
                depth="3"
                style="font-size: 12px"
              >
                推荐分辨率: 400 × 500 px
              </NText>
            </div>
            <NFlex
              align="center"
              :size="8"
            >
              <NInput
                :value="obsAbsoluteUrl"
                readonly
                size="small"
                style="flex: 1"
              />
              <NButton
                type="primary"
                size="small"
                @click="copyObsUrl"
              >
                <template #icon>
                  <NIcon>
                    <Checkmark24Regular v-if="copied" />
                    <Copy24Regular v-else />
                  </NIcon>
                </template>
                {{ copied ? '已复制' : '复制' }}
              </NButton>
              <NButton
                secondary
                size="small"
                @click="openObsWindow"
              >
                <template #icon>
                  <NIcon><Open24Regular /></NIcon>
                </template>
                打开
              </NButton>
            </NFlex>

            <div class="obs-tips">
              <NIcon
                size="14"
                color="#f59e0b"
                style="vertical-align: -2px; margin-right: 4px"
              >
                <Lightbulb24Regular />
              </NIcon>
              在 OBS 添加浏览器源并粘贴上方链接。浏览器源会自己采集麦克风，请在源属性里允许音频。控制台麦克风只用于预览调参。
            </div>
          </div>
        </NCard>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pngtuber-viewer-root {
  width: 100%;
  box-sizing: border-box;
}

.workbench-layout {
  display: grid;
  grid-template-columns: minmax(360px, 460px) minmax(380px, 1fr);
  gap: 16px;
  align-items: start;
}

@media (max-width: 960px) {
  .workbench-layout {
    grid-template-columns: 1fr;
  }
}

.config-pane {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.stage-pane {
  position: sticky;
  top: 16px;
}

.workbench-card {
  background: var(--vtsuru-bg-elevated);
  border-radius: 10px;
  border: 1px solid var(--vtsuru-border);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

/* =========================================================================
 * 实时音量电平表
 * ========================================================================= */
.meter-container {
  background: var(--vtsuru-bg-muted);
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--vtsuru-border);
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 12px;
}

.meter-label {
  font-weight: 500;
  color: var(--vtsuru-fg);
}

.meter-status {
  font-weight: 600;
  color: var(--vtsuru-fg-muted);
  transition: color 0.15s ease;
}

.meter-status.is-active {
  color: #10b981;
}

.meter-track {
  position: relative;
  width: 100%;
  height: 12px;
  background: rgba(148, 163, 184, 0.2);
  border-radius: 6px;
  overflow: visible;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, #38bdf8 0%, #34d399 70%, #f59e0b 100%);
  border-radius: 6px;
  transition: width 0.05s ease-out;
}

.meter-fill.is-exceeded {
  background: linear-gradient(90deg, #34d399 0%, #10b981 60%, #ef4444 100%);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
}

.meter-threshold-line {
  position: absolute;
  top: -4px;
  bottom: -4px;
  width: 2px;
  background: #ef4444;
  transform: translateX(-50%);
  z-index: 5;
  box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
}

.threshold-tag {
  position: absolute;
  top: -16px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #ef4444;
  font-weight: 700;
  line-height: 1;
}

/* =========================================================================
 * 拖拽上传卡片 (Dropzone)
 * ========================================================================= */
.avatar-dropzone {
  background: var(--vtsuru-bg-muted);
  border: 1.5px dashed var(--vtsuru-border);
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.18s ease;
}

.avatar-dropzone.is-dragging {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.avatar-dropzone.has-image {
  border-style: solid;
  border-color: var(--vtsuru-border);
}

.avatar-dropzone.is-uploading {
  opacity: 0.65;
  pointer-events: none;
}

.dropzone-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.dropzone-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.dropzone-body {
  width: 100%;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--vtsuru-bg);
  border-radius: 6px;
  margin-bottom: 8px;
  overflow: hidden;
}

.preview-thumb-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  box-sizing: border-box;
}

.thumb-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.empty-upload-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.hint-text {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.dropzone-upload-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  padding: 5px 0;
  background: var(--vtsuru-bg-elevated);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  font-size: 11px;
  color: var(--vtsuru-fg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.dropzone-upload-btn:hover {
  border-color: #38bdf8;
  color: #0284c7;
}

.url-input-row {
  margin-top: 6px;
  width: 100%;
}

/* =========================================================================
 * 监视器舞台与 OBS 卡片
 * ========================================================================= */
.setting-toggle-row {
  font-size: 12px;
  color: var(--vtsuru-fg);
  padding: 4px 0;
}

.live-preview-viewport {
  position: relative;
  width: 100%;
  height: 480px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--vtsuru-border);
}

.live-preview-viewport.bg-checker {
  background-color: #f1f5f9;
  background-image:
    linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.live-preview-viewport.bg-dark {
  background-color: #0f172a;
}

.live-preview-viewport.bg-green {
  background-color: #00ff00;
}

.preview-state-badge {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(6px);
  color: #ffffff;
  border-radius: 9999px;
  font-size: 11px;
  font-weight: 500;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
}

.preview-state-badge.is-speaking .badge-dot {
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

.obs-link-box {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--vtsuru-border);
}

.obs-link-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.obs-link-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.obs-tips {
  margin-top: 8px;
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
  line-height: 1.5;
}
</style>
