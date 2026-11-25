<script setup lang="ts">
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-vue-next'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

import type { ResponseQAInfo, SettingQuestionDisplay } from '@/api/generated/model'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayTransition,
  QuestionDisplayVerticalAlign,
} from '@/api/generated/model'
import { normalizeGoogleFontFamily, useGoogleFont } from '@/apps/user-page/googleFonts'
import {
  formatColor,
  formatColorWithOpacity,
  formatShadow,
  formatTextShadow,
  questionSenderLabel,
} from '@/shared/questionDisplay'
import { fallbackImageOnError, transformImageUrl } from '@/shared/services/imageTransform'

const LOCAL_FONT_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'Microsoft YaHei',
  'Source Han Sans SC',
  'Source Han Serif SC',
  'PingFang SC',
  'STKaiti',
  'KaiTi',
  'SimSun',
  'SimHei',
])

function resolveLoadableGoogleFont(value: string | undefined) {
  if (!value || LOCAL_FONT_FAMILIES.has(value)) return undefined
  if (value.includes(',')) return undefined
  return normalizeGoogleFontFamily(value) || undefined
}

type DisplayStatus = 'loading' | 'empty' | 'ready' | 'stale' | 'error'

const props = withDefaults(
  defineProps<{
    question?: ResponseQAInfo
    setting: SettingQuestionDisplay
    status?: DisplayStatus
    showScrollbar?: boolean
    /** 网页展板控制台模式：允许点击图片打开/切换/关闭大图预览 */
    interactiveImages?: boolean
    /** 当前同步打开的大图索引（null 或 undefined 表示关闭） */
    activeImageIndex?: number | null
  }>(),
  {
    status: undefined,
    showScrollbar: false,
    interactiveImages: false,
    activeImageIndex: null,
  },
)

const emit = defineEmits<{
  scroll: [progress: number]
  imagePreviewChange: [index: number | null]
}>()

const contentRef = ref<HTMLElement>()
const failedImages = ref(new Set<string>())
const isOverflowing = ref(false)
const isScrolledToBottom = ref(false)

const status = computed<DisplayStatus>(() => {
  if (props.status) return props.status
  return props.question ? 'ready' : 'empty'
})
const hasQuestion = computed(() => Boolean(props.question) && status.value !== 'empty' && status.value !== 'loading')
const align = computed(() => {
  if (props.setting.align === QuestionDisplayAlign.Right) return 'right'
  if (props.setting.align === QuestionDisplayAlign.Center) return 'center'
  return 'left'
})
const verticalAlign = computed(() => {
  if (props.setting.verticalAlign === QuestionDisplayVerticalAlign.Center) return 'center'
  if (props.setting.verticalAlign === QuestionDisplayVerticalAlign.Bottom) return 'end'
  return 'start'
})
const transitionName = computed(() => {
  if (props.setting.transition === QuestionDisplayTransition.Slide) return 'question-display-slide'
  if (props.setting.transition === QuestionDisplayTransition.Scale) return 'question-display-scale'
  if (props.setting.transition === QuestionDisplayTransition.None) return 'question-display-none'
  return 'question-display-fade'
})
const imageLayout = computed(() =>
  props.setting.imageLayout === QuestionDisplayImageLayout.Grid ? 'is-grid' : 'is-contain',
)
const contentMaxWidth = computed(() => {
  const value = props.setting.contentMaxWidth ?? 34
  return value > 0 ? `${value}em` : '100%'
})

const rootStyle = computed<CSSProperties>(() => {
  const borderColor = formatColor(props.setting.borderColor) || 'transparent'
  const fontColor = formatColor(props.setting.fontColor) || 'inherit'
  return {
    '--card-border-color': borderColor,
    '--card-border-width': `${Math.max(0, props.setting.borderWidth ?? 0)}px`,
    '--card-radius': `${Math.max(0, props.setting.borderRadius ?? 16)}px`,
    '--card-padding': `${Math.max(0, props.setting.contentPadding ?? 24)}px`,
    '--card-image-max-height': `${Math.max(80, props.setting.imageMaxHeight || 320)}px`,
    '--card-content-max-width': contentMaxWidth.value,
    '--card-content-justify': verticalAlign.value,
    '--card-text-margin-inline': align.value === 'right' ? 'auto 0' : align.value === 'center' ? 'auto' : '0 auto',
    '--card-fg': fontColor,
    '--card-background': formatColorWithOpacity(props.setting.backgroundColor, props.setting.backgroundOpacity ?? 100),
    '--card-shadow': formatShadow(props.setting.shadow),
  }
})

const contentStyle = computed<CSSProperties>(() => ({
  color: formatColor(props.setting.fontColor),
  fontSize: `${Math.max(1, props.setting.fontSize ?? 20)}px`,
  fontWeight: props.setting.fontWeight || undefined,
  textAlign: align.value,
  fontFamily: props.setting.font || undefined,
  lineHeight: Math.max(1, props.setting.lineHeight ?? 1.5),
  letterSpacing: props.setting.letterSpacing ? `${props.setting.letterSpacing}em` : undefined,
  textShadow: formatTextShadow(props.setting.textShadow),
}))

const nameStyle = computed<CSSProperties>(() => {
  const customColor = formatColor(props.setting.nameFontColor)
  const fontColor = formatColor(props.setting.fontColor)
  const fallbackColor = fontColor ? `color-mix(in srgb, ${fontColor} 75%, transparent)` : undefined

  return {
    color: customColor || fallbackColor,
    fontSize: `${Math.max(1, props.setting.nameFontSize ?? 18)}px`,
    fontWeight: props.setting.nameFontWeight || undefined,
    textAlign: align.value,
    fontFamily: props.setting.nameFont || undefined,
    letterSpacing: props.setting.nameLetterSpacing ? `${props.setting.nameLetterSpacing}em` : undefined,
    textShadow: formatTextShadow(props.setting.textShadow),
  }
})

useGoogleFont(computed(() => resolveLoadableGoogleFont(props.setting.font)))
useGoogleFont(computed(() => resolveLoadableGoogleFont(props.setting.nameFont)))

const visibleImages = computed(() =>
  (props.question?.questionImages ?? []).filter((image) => image?.path && !failedImages.value.has(image.path)),
)
const displayedImages = computed(() => (props.setting.showImage ? visibleImages.value : []))
const senderLabel = computed(() => questionSenderLabel(props.question))
const showBrand = computed(() => props.setting.showBrand !== false)

const activeImage = computed(() => {
  if (props.activeImageIndex === null || props.activeImageIndex === undefined) return null
  if (props.activeImageIndex < 0 || props.activeImageIndex >= visibleImages.value.length) return null
  return visibleImages.value[props.activeImageIndex] ?? null
})

function openImage(index: number) {
  if (!props.interactiveImages) return
  emit('imagePreviewChange', index)
}

function closeImage() {
  if (!props.interactiveImages) return
  emit('imagePreviewChange', null)
}

function stepImage(delta: -1 | 1) {
  if (!props.interactiveImages || visibleImages.value.length <= 1 || props.activeImageIndex === null || props.activeImageIndex === undefined) return
  const next = (props.activeImageIndex + delta + visibleImages.value.length) % visibleImages.value.length
  emit('imagePreviewChange', next)
}

function onImageError(event: Event, path: string) {
  if (fallbackImageOnError(event, path)) return
  failedImages.value = new Set(failedImages.value).add(path)
}

function updateOverflowState() {
  const el = contentRef.value
  if (!el) {
    isOverflowing.value = false
    isScrolledToBottom.value = false
    return
  }
  const range = el.scrollHeight - el.clientHeight
  isOverflowing.value = range > 4
  isScrolledToBottom.value = isOverflowing.value && el.scrollTop >= range - 4
}

function emitScroll() {
  const element = contentRef.value
  if (!element) return
  const range = element.scrollHeight - element.clientHeight
  emit('scroll', range > 0 ? element.scrollTop / range : 0)
  updateOverflowState()
}

function setScrollProgress(progress: number) {
  const element = contentRef.value
  if (!element) return
  const range = element.scrollHeight - element.clientHeight
  if (range <= 0) {
    updateOverflowState()
    return
  }
  const targetTop = Math.max(0, Math.min(1, progress)) * range
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  element.scrollTo({
    top: targetTop,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  })
  updateOverflowState()
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && contentRef.value) {
    resizeObserver = new ResizeObserver(updateOverflowState)
    resizeObserver.observe(contentRef.value)
  }
  updateOverflowState()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.question?.id,
  () => {
    failedImages.value = new Set()
    if (contentRef.value) {
      contentRef.value.scrollTop = 0
    }
    setTimeout(updateOverflowState, 50)
  },
)

defineExpose({ setScrollProgress })
</script>

<template>
  <div
    class="question-display-root"
    :class="`is-${status}`"
    :style="rootStyle"
    :aria-busy="status === 'loading'"
  >
    <div class="question-display-frame">
      <div class="question-display-body">
        <Transition
          :name="transitionName"
          mode="out-in"
        >
          <div
            :key="question?.id ?? status"
            class="question-display-inner"
          >
            <div
              v-if="setting.showUserName && hasQuestion"
              class="question-display-user-name"
              :style="nameStyle"
            >
              {{ senderLabel }}
            </div>

            <div class="question-display-content-wrapper">
              <div
                ref="contentRef"
                class="question-display-content"
                :class="[
                  props.showScrollbar ? 'scrollbar-thin' : 'no-scrollbar',
                  {
                    'has-images': displayedImages.length > 0,
                    'has-single-image': displayedImages.length === 1,
                  },
                ]"
                :style="contentStyle"
                @scroll="emitScroll"
              >
                <template v-if="hasQuestion && question">
                  <div class="question-display-text">{{ question.question.message }}</div>
                  <div
                    v-if="displayedImages.length"
                    class="question-display-images"
                    :class="imageLayout"
                  >
                    <div
                      v-for="(image, imgIdx) in displayedImages"
                      :key="image.path"
                      class="question-display-image-wrap"
                      :class="{
                        'is-interactive': interactiveImages,
                        'is-active-preview': activeImageIndex === imgIdx,
                      }"
                      @click="openImage(imgIdx)"
                    >
                      <img
                        class="question-display-image"
                        :src="transformImageUrl(image.path, 'card')"
                        alt=""
                        loading="lazy"
                        @error="onImageError($event, image.path)"
                      />
                      <span
                        v-if="interactiveImages"
                        class="question-display-image-hint"
                      >
                        <ZoomIn class="size-3.5" />
                        放大同步到 OBS
                      </span>
                    </div>
                  </div>
                </template>
                <span
                  v-else
                  class="question-display-empty"
                  role="status"
                  aria-label="当前没有展示提问"
                >
                  <span
                    class="question-display-empty-loader"
                    aria-hidden="true"
                  >
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
              </div>

              <div
                v-if="hasQuestion && isOverflowing && !isScrolledToBottom"
                class="overflow-indicator"
                aria-hidden="true"
              />
            </div>
          </div>
        </Transition>
      </div>

      <div
        v-if="showBrand"
        class="question-display-brand"
      >
        vtsuru.live
      </div>

      <!-- 同步放大图片覆层（展板与 OBS 浏览器源共用） -->
      <Transition name="question-display-lightbox">
        <div
          v-if="hasQuestion && activeImage"
          class="question-display-lightbox"
          :class="{ 'is-interactive': interactiveImages }"
          @click.self="closeImage"
        >
          <img
            :key="activeImage.path"
            class="question-display-lightbox-img"
            :src="activeImage.path"
            alt=""
            @error="onImageError($event, activeImage.path)"
          />

          <div
            v-if="visibleImages.length > 1"
            class="question-display-lightbox-counter"
          >
            {{ (activeImageIndex ?? 0) + 1 }} / {{ visibleImages.length }}
          </div>

          <template v-if="interactiveImages">
            <button
              type="button"
              class="question-display-lightbox-btn is-close"
              aria-label="关闭同步大图"
              @click="closeImage"
            >
              <X class="size-4" />
            </button>
            <button
              v-if="visibleImages.length > 1"
              type="button"
              class="question-display-lightbox-btn is-prev"
              aria-label="上一张图片"
              @click="stepImage(-1)"
            >
              <ChevronLeft class="size-5" />
            </button>
            <button
              v-if="visibleImages.length > 1"
              type="button"
              class="question-display-lightbox-btn is-next"
              aria-label="下一张图片"
              @click="stepImage(1)"
            >
              <ChevronRight class="size-5" />
            </button>
          </template>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.question-display-root {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  container-type: size;
}

.question-display-frame {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex: 1 1 100%;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: clamp(10px, 2.5cqh, 18px);
  padding: var(--card-padding);
  overflow: hidden;
  background: var(--card-background);
  border: var(--card-border-width) solid var(--card-border-color, transparent);
  border-radius: var(--card-radius);
  box-shadow: var(--card-shadow);
  transition:
    background-color 0.2s ease,
    border-color 0.2s ease,
    border-width 0.2s ease,
    box-shadow 0.2s ease;
}

.question-display-body {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  width: 100%;
}

.question-display-inner {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  gap: clamp(10px, 2.5cqh, 18px);
}

.question-display-user-name {
  flex: none;
  min-width: 0;
  padding-bottom: 10px;
  overflow: hidden;
  border-bottom: 1px solid color-mix(in srgb, currentcolor 22%, transparent);
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.question-display-content-wrapper {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.question-display-content {
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  justify-content: var(--card-content-justify, start);
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.overflow-indicator {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 48px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, var(--card-background));
  opacity: 0.92;
  transition: opacity 0.2s ease;
}

.question-display-text {
  width: 100%;
  white-space: pre-wrap;
}

.question-display-content:not(.has-images) .question-display-text {
  width: min(100%, var(--card-content-max-width, 34em));
  margin-inline: var(--card-text-margin-inline, 0 auto);
}

.question-display-images {
  box-sizing: border-box;
  display: grid;
  width: 100%;
  gap: 10px;
}

.question-display-images.is-contain {
  grid-template-columns: minmax(0, 1fr);
  place-items: center;
}

.question-display-images.is-grid {
  grid-template-columns: repeat(auto-fit, minmax(min(160px, 100%), 1fr));
}

.question-display-image-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
}

.question-display-images.is-grid .question-display-image-wrap {
  width: 100%;
}

.question-display-image-wrap.is-interactive {
  cursor: zoom-in;
}

.question-display-image-hint {
  position: absolute;
  right: 10px;
  bottom: 10px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgb(15 23 42 / 76%);
  color: #fff;
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: 11px;
  line-height: 1;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.question-display-image-wrap.is-interactive:hover .question-display-image-hint {
  opacity: 1;
}

.question-display-image {
  box-sizing: border-box;
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: var(--card-image-max-height);
  padding: 6px;
  background: color-mix(in srgb, var(--card-border-color, transparent) 10%, rgb(127 127 127 / 8%));
  border: 1px solid color-mix(in srgb, var(--card-border-color, transparent) 24%, rgb(127 127 127 / 15%));
  border-radius: min(10px, calc(var(--card-radius) * 0.55));
  object-fit: contain;
}

.question-display-images.is-grid .question-display-image {
  width: 100%;
  height: min(var(--card-image-max-height), 240px);
  padding: 0;
  object-fit: cover;
}

@container (min-width: 560px) {
  .question-display-content.has-single-image {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(220px, 42%);
    align-items: stretch;
  }

  .question-display-content.has-single-image .question-display-text {
    align-self: center;
  }

  .question-display-content.has-single-image .question-display-images,
  .question-display-content.has-single-image .question-display-image-wrap,
  .question-display-content.has-single-image .question-display-image {
    min-height: 0;
  }

  .question-display-content.has-single-image .question-display-images {
    height: 100%;
  }
}

.question-display-lightbox {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(12px, 3cqh, 24px);
  background: rgb(10 14 23 / 86%);
  backdrop-filter: blur(6px);
  border-radius: inherit;
}

.question-display-lightbox-img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: min(10px, calc(var(--card-radius) * 0.55));
  box-shadow: 0 12px 36px rgb(0 0 0 / 45%);
}

.question-display-lightbox-counter {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  border-radius: 999px;
  background: rgb(15 23 42 / 72%);
  color: rgb(255 255 255 / 92%);
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
  line-height: 1;
  user-select: none;
}

.question-display-lightbox-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 999px;
  background: rgb(15 23 42 / 75%);
  color: #fff;
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    transform 0.15s ease;
}

.question-display-lightbox-btn:hover {
  background: rgb(30 41 59 / 92%);
  transform: scale(1.06);
}

.question-display-lightbox-btn.is-close {
  top: 12px;
  right: 12px;
}

.question-display-lightbox-btn.is-prev {
  top: 50%;
  left: 12px;
  transform: translateY(-50%);
}

.question-display-lightbox-btn.is-prev:hover {
  transform: translateY(-50%) scale(1.06);
}

.question-display-lightbox-btn.is-next {
  top: 50%;
  right: 12px;
  transform: translateY(-50%);
}

.question-display-lightbox-btn.is-next:hover {
  transform: translateY(-50%) scale(1.06);
}

.question-display-lightbox-enter-active,
.question-display-lightbox-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.question-display-lightbox-enter-from,
.question-display-lightbox-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

.question-display-empty {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: 100%;
  color: var(--card-fg);
  opacity: 0.65;
}

.question-display-empty-loader {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.question-display-empty-loader i {
  width: 8px;
  height: 8px;
  background: currentcolor;
  border-radius: 50%;
  opacity: 0.35;
  animation: question-display-empty-bounce 1.1s infinite ease-in-out;
}

.question-display-empty-loader i:nth-child(1) {
  animation-delay: -0.05s;
}

.question-display-empty-loader i:nth-child(2) {
  animation-delay: -0.125s;
}

.question-display-empty-loader i:nth-child(3) {
  animation-delay: -0.2s;
}

.question-display-empty-loader i:nth-child(4) {
  animation-delay: -0.275s;
}

@keyframes question-display-empty-bounce {
  0%,
  100% {
    opacity: 0.35;
    transform: translateY(0) scale(0.78);
  }

  50% {
    opacity: 0.95;
    transform: translateY(-6px) scale(1.12);
  }
}

.question-display-brand {
  flex: none;
  color: color-mix(in srgb, var(--card-fg) 38%, transparent);
  font-family: ui-sans-serif, system-ui, sans-serif;
  font-size: clamp(9px, 1.6cqh, 11px);
  line-height: 1;
  text-align: right;
  user-select: none;
}

.question-display-fade-enter-active,
.question-display-fade-leave-active,
.question-display-slide-enter-active,
.question-display-slide-leave-active,
.question-display-scale-enter-active,
.question-display-scale-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.question-display-fade-enter-from,
.question-display-fade-leave-to {
  opacity: 0;
}

.question-display-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.question-display-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.question-display-scale-enter-from,
.question-display-scale-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .question-display-root,
  .question-display-fade-enter-active,
  .question-display-fade-leave-active,
  .question-display-slide-enter-active,
  .question-display-slide-leave-active,
  .question-display-scale-enter-active,
  .question-display-scale-leave-active,
  .question-display-lightbox-enter-active,
  .question-display-lightbox-leave-active {
    transition: none;
  }
}
</style>
