<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import {
  QuestionDisplayAlign,
  QuestionDisplayImageLayout,
  QuestionDisplayShadow,
  QuestionDisplayTransition,
} from '@/api/api-models'
import { questionSenderLabel } from '@/shared/questionDisplay'

type DisplayStatus = 'loading' | 'empty' | 'ready' | 'stale' | 'error'

const props = withDefaults(
  defineProps<{
    question?: QAInfo
    setting: Setting_QuestionDisplay
    status?: DisplayStatus
  }>(),
  {
    status: undefined,
  },
)

const emit = defineEmits<{
  scroll: [progress: number]
}>()

const contentRef = ref<HTMLElement>()
const failedImages = ref(new Set<string>())

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
const transitionName = computed(() => {
  if (props.setting.transition === QuestionDisplayTransition.Slide) return 'question-display-slide'
  if (props.setting.transition === QuestionDisplayTransition.Scale) return 'question-display-scale'
  if (props.setting.transition === QuestionDisplayTransition.None) return 'question-display-none'
  return 'question-display-fade'
})
const imageLayout = computed(() =>
  props.setting.imageLayout === QuestionDisplayImageLayout.Grid ? 'is-grid' : 'is-contain',
)
const rootStyle = computed<CSSProperties>(() => ({
  '--card-border-color': color(props.setting.borderColor),
  '--card-border-width': `${Math.max(0, props.setting.borderWidth ?? 0)}px`,
  '--card-radius': `${Math.max(0, props.setting.borderRadius ?? 16)}px`,
  '--card-padding': `${Math.max(0, props.setting.contentPadding ?? 24)}px`,
  '--card-image-max-height': `${Math.max(80, props.setting.imageMaxHeight || 320)}px`,
  '--card-fg': color(props.setting.fontColor),
  '--card-background': colorWithOpacity(props.setting.backgroundColor, props.setting.backgroundOpacity ?? 100),
  '--card-shadow': shadow(props.setting.shadow),
}))
const contentStyle = computed<CSSProperties>(() => ({
  color: color(props.setting.fontColor),
  fontSize: `${Math.max(1, props.setting.fontSize ?? 20)}px`,
  fontWeight: props.setting.fontWeight || undefined,
  textAlign: align.value,
  fontFamily: props.setting.font || undefined,
  lineHeight: Math.max(1, props.setting.lineHeight ?? 1.5),
}))
const nameStyle = computed<CSSProperties>(() => ({
  color: color(props.setting.nameFontColor),
  fontSize: `${Math.max(1, props.setting.nameFontSize ?? 20)}px`,
  fontWeight: props.setting.nameFontWeight || undefined,
  fontFamily: props.setting.nameFont || undefined,
  textAlign: align.value,
}))
const visibleImages = computed(() =>
  (props.question?.questionImages ?? []).filter((image) => !failedImages.value.has(image.path)),
)
const displayedImages = computed(() => (props.setting.showImage ? visibleImages.value : []))
const senderLabel = computed(() => (props.question ? questionSenderLabel(props.question) : ''))
const showBrand = computed(() => props.setting.showBrand !== false)

function color(value: string | undefined) {
  if (!value) return undefined
  return value.startsWith('#') ? value : `#${value}`
}

function colorWithOpacity(value: string | undefined, opacity: number) {
  const hex = value?.replace('#', '')
  if (!hex || !/^[\da-f]{6}$/i.test(hex)) return 'transparent'
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16))
  return `rgb(${channels.join(' ')} / ${Math.max(0, Math.min(100, opacity))}%)`
}

function shadow(value: QuestionDisplayShadow) {
  if (value === QuestionDisplayShadow.Strong) return '0 16px 48px rgb(0 0 0 / 35%)'
  if (value === QuestionDisplayShadow.Soft) return '0 8px 24px rgb(0 0 0 / 18%)'
  return 'none'
}

function onImageError(path: string) {
  failedImages.value = new Set(failedImages.value).add(path)
}

function emitScroll() {
  const element = contentRef.value
  if (!element) return
  const range = element.scrollHeight - element.clientHeight
  emit('scroll', range > 0 ? element.scrollTop / range : 0)
}

function setScrollProgress(progress: number) {
  const element = contentRef.value
  if (!element) return
  const range = element.scrollHeight - element.clientHeight
  element.scrollTo({
    top: Math.max(0, Math.min(1, progress)) * range,
    behavior: 'auto',
  })
}

watch(
  () => props.question?.id,
  () => {
    failedImages.value = new Set()
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
    <Transition
      :name="transitionName"
      mode="out-in"
    >
      <div
        :key="question?.id ?? status"
        class="question-display-frame"
      >
        <div
          v-if="setting.showUserName && hasQuestion"
          class="question-display-user-name"
          :style="nameStyle"
        >
          {{ senderLabel }}
        </div>

        <div
          ref="contentRef"
          class="question-display-content"
          :class="{
            'has-images': displayedImages.length > 0,
            'has-single-image': displayedImages.length === 1,
          }"
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
              <img
                v-for="image in displayedImages"
                :key="image.path"
                class="question-display-image"
                :src="image.path"
                alt=""
                loading="lazy"
                @error="onImageError(image.path)"
              />
            </div>
          </template>
          <span
            v-else
            class="question-display-empty"
          >
            <span>当前没有展示提问</span>
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
          v-if="hasQuestion && showBrand"
          class="question-display-brand"
        >
          vtsuru.live
        </div>
      </div>
    </Transition>
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
  box-sizing: border-box;
  display: flex;
  flex: none;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: clamp(12px, 3cqh, 22px);
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

.question-display-content {
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  gap: clamp(14px, 3cqh, 24px);
  padding: 0;
  overflow: auto;
  overflow-wrap: anywhere;
  overscroll-behavior: contain;
  scrollbar-color: color-mix(in srgb, var(--card-fg) 26%, transparent) transparent;
  scrollbar-width: thin;
}

.question-display-content::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.question-display-content::-webkit-scrollbar-track {
  background: transparent;
}

.question-display-content::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--card-fg) 26%, transparent);
  border-radius: 3px;
}

.question-display-content::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--card-fg) 42%, transparent);
}

.question-display-text {
  width: 100%;
  white-space: pre-wrap;
}

.question-display-content:not(.has-images) .question-display-text {
  width: min(100%, 34em);
  margin-inline: auto;
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

.question-display-image {
  box-sizing: border-box;
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: var(--card-image-max-height);
  padding: 6px;
  background: color-mix(in srgb, var(--card-border-color) 10%, rgb(127 127 127 / 8%));
  border: 1px solid color-mix(in srgb, var(--card-border-color) 24%, transparent);
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
  .question-display-content.has-single-image .question-display-image {
    min-height: 0;
  }

  .question-display-content.has-single-image .question-display-images {
    height: 100%;
  }
}

.question-display-empty {
  display: flex;
  flex: 1;
  min-height: 1px;
  flex-direction: column;
  color: color-mix(in srgb, var(--card-fg) 44%, transparent);
  font-size: 0.9em;
  align-items: center;
  justify-content: center;
  gap: 12px;
  text-align: center;
  user-select: none;
}

.question-display-empty-loader {
  display: flex;
  width: 58px;
  height: 16px;
  align-items: center;
  justify-content: space-between;
}

.question-display-empty-loader i {
  display: block;
  width: 10px;
  height: 10px;
  background: color-mix(in srgb, var(--card-fg) 46%, transparent);
  border-radius: 50%;
  animation: question-display-empty-bounce 1.1s ease-in-out infinite;
}

.question-display-empty-loader i:nth-child(2) {
  animation-delay: -0.825s;
}

.question-display-empty-loader i:nth-child(3) {
  animation-delay: -0.55s;
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
    opacity 0.2s ease,
    transform 0.2s ease;
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
  .question-display-scale-leave-active {
    transition: none;
  }
}
</style>
