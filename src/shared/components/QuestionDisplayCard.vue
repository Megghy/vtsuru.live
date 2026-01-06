<script setup lang="ts">
import type { QAInfo, Setting_QuestionDisplay } from '@/api/api-models'
import { useDebounceFn, useScroll } from '@vueuse/core'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { QuestionDisplayAlign } from '@/api/api-models'

const props = defineProps<{
  question: QAInfo | undefined
  setting: Setting_QuestionDisplay

  showGreenBorder?: boolean
  css?: string
}>()
const emit = defineEmits<{ scroll: [value: { clientHeight: number, scrollHeight: number, scrollTop: number }] }>()
defineExpose({ setScroll, setScrollTop })
let styleElement: HTMLStyleElement
const cssDebounce = useDebounceFn(() => {
  if (styleElement) {
    styleElement.textContent = props.css ?? ''
    console.log('已更新CSS')
  }
}, 1000)
watch(() => props.css, cssDebounce)

const contentRef = ref()
useScroll(contentRef)

const align = computed(() => {
  switch (props.setting.align) {
    case QuestionDisplayAlign.Left:
      return 'left'
    case QuestionDisplayAlign.Right:
      return 'right'
    case QuestionDisplayAlign.Center:
      return 'center'
  }
  return 'left'
})
function setScrollTop(top: number) {
  contentRef.value?.scrollTo({
    top,
    behavior: 'smooth',
  })
}
function setScroll(value: { clientHeight: number, scrollHeight: number, scrollTop: number }) {
  if (contentRef.value.clientHeight == contentRef.value.scrollHeight) {
    setScrollTop(value.scrollTop)
  } else {
    const scrollRatio1 = value.scrollTop / (value.scrollHeight - value.clientHeight)
    const scrollTop = scrollRatio1 * (contentRef.value.scrollHeight - contentRef.value.clientHeight)
    setScrollTop(scrollTop)
  }
}
function scrollCallback() {
  emit('scroll', {
    clientHeight: contentRef.value?.clientHeight ?? 0,
    scrollHeight: contentRef.value?.scrollHeight ?? 0,
    scrollTop: contentRef.value?.scrollTop ?? 0,
  })
}

onMounted(() => {
  // 创建<style>元素并添加到<head>中
  styleElement = document.createElement('style')
  // 可能需要对 userStyleString 做安全处理以避免XSS攻击
  styleElement.textContent = props.css ?? ''
  document.head.appendChild(styleElement)

  contentRef.value?.addEventListener('scroll', scrollCallback)
})
onUnmounted(() => {
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement)
  }
  contentRef.value?.removeEventListener('scroll', scrollCallback)
})
</script>

<template>
  <div
    class="question-display-root"
    :style="{
      backgroundColor: `#${setting.borderColor}`,
      borderColor: setting.borderColor ? `#${setting.borderColor}` : undefined,
      borderWidth: setting.borderWidth ? `${setting.borderWidth}px` : undefined,
      borderTopWidth: setting.showUserName && question ? 0 : setting.borderWidth,
    }"
    :display="question ? 1 : 0"
  >
    <Transition
      name="scale"
      mode="out-in"
    >
      <div
        v-if="setting.showUserName && question"
        class="question-display-user-name"
        :style="{
          color: `#${setting.nameFontColor}`,
          fontSize: `${setting.nameFontSize}px`,
          fontWeight: setting.nameFontWeight ? setting.nameFontWeight : undefined,
          fontFamily: setting.nameFont,
        }"
      >
        {{ question?.sender?.name ?? '匿名用户' }}
      </div>
    </Transition>
    <div
      ref="contentRef"
      class="question-display-content"
      :style="{
        color: `#${setting.fontColor}`,
        backgroundColor: `#${setting.backgroundColor}`,
        fontSize: `${setting.fontSize}px`,
        fontWeight: setting.fontWeight ? setting.fontWeight : undefined,
        textAlign: align,
        fontFamily: setting.font,
      }"
      :is-empty="question ? 0 : 1"
      @scroll="scrollCallback"
    >
      <Transition
        name="fade"
        mode="out-in"
      >
        <template v-if="question">
          <div>
            <div class="question-display-text">
              {{ question?.question.message }}
            </div>
            <div v-if="setting.showImage && question?.questionImages && question.questionImages.length > 0" class="question-display-images">
              <img
                v-for="(img, index) in question.questionImages"
                :key="index"
                class="question-display-image"
                :src="img.path"
              >
            </div>
          </div>
        </template>
        <div
          v-else
          class="question-display-loading loading"
          :style="{ color: `#${setting.fontColor}` }"
        >
          <div :style="{ color: `#${setting.fontColor}` }" />
          <div />
          <div />
          <div />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.question-display-root {
  height: 100%;
  width: 100%;
  border-radius: 16px;
  border: 2px solid rgb(255, 255, 255); /* 修正 border 语法 */
  display: flex;
  flex-direction: column;
  border-style: solid;
  box-sizing: border-box;
  transition: all 0.3s ease;
  overflow: hidden; /* 防止圆角溢出 */
}

.question-display-content {
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
  /* justify-content: space-evenly;  移除这个，让内容自然排列，长内容更友好 */
  padding: 24px;
  overflow-y: auto; /* 明确只在Y轴滚动 */
  overflow-x: hidden;
}

.question-display-user-name {
  text-align: center;
  margin: 8px 5px;
  min-height: 32px; /* 使用 min-height 避免文字被切 */
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  flex-shrink: 0; /* 防止被压缩 */
}

.question-display-text {
  min-height: 50px;
  white-space: pre-wrap;
  line-height: 1.6; /* 增加行高，提高可读性 */
  word-break: break-word; /* 防止长单词溢出 */
}

.question-display-images {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 16px;
  width: 100%;
}

.question-display-image {
  max-width: 100%;
  max-height: 200px;
  border-radius: 8px;
  object-fit: contain; /* 确保图片完整显示 */
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1); /* 轻微阴影 */
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 6px; /* 变细 */
  height: 6px;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.3);
}

::-webkit-scrollbar-track {
  background: transparent;
}
</style>

<style scoped>
.loading,
.loading>div {
  position: relative;
  box-sizing: border-box;
}

.loading {
  display: block;
  margin: 0 auto;
  font-size: 0;
}

.loading.la-dark {
  color: #333;
}

.loading>div {
  display: inline-block;
  float: none;
  background-color: currentColor;
  border: 0 solid currentColor;
}

.loading {
  width: 40px;
  height: 10px;
}

.loading>div {
  width: 10px;
  height: 10px;
  border-radius: 100%;
}

.loading>div:first-child {
  transform: translateX(0%);
  animation: ball-newton-cradle-left 1.5s 0s ease-out infinite;
}

.loading>div:last-child {
  transform: translateX(0%);
  animation: ball-newton-cradle-right 1.5s 0s ease-out infinite;
}

.loading.la-sm {
  width: 20px;
  height: 4px;
}

.loading.la-sm>div {
  width: 4px;
  height: 4px;
}

.loading.la-2x {
  width: 80px;
  height: 20px;
}

.loading.la-2x>div {
  width: 20px;
  height: 20px;
}

.loading.la-3x {
  width: 120px;
  height: 30px;
}

.loading.la-3x>div {
  width: 30px;
  height: 30px;
}

@keyframes ball-newton-cradle-left {
  25% {
    transform: translateX(-200%);
    animation-timing-function: ease-in;
  }

  50% {
    transform: translateX(0%);
  }
}

@keyframes ball-newton-cradle-right {
  50% {
    transform: translateX(0%);
  }

  75% {
    transform: translateX(200%);
    animation-timing-function: ease-in;
  }

  100% {
    transform: translateX(0%);
  }
}

.loading>div:first-child {
  animation: ball-newton-cradle-left 1.5s 0s ease-in-out infinite;
}

.loading>div:last-child {
  animation: ball-newton-cradle-right 1.5s 0s ease-in-out infinite;
}
</style>
