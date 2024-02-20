<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { QAInfo, QuestionDisplayAlign, Setting_QuestionDisplay } from '@/api/api-models'
import { useDebounceFn, useStorage } from '@vueuse/core'

const props = defineProps<{
  question: QAInfo | undefined
  setting: Setting_QuestionDisplay

  showGreenBorder?: boolean
  css?: string
}>()
let styleElement: HTMLStyleElement
const cssDebounce = useDebounceFn(() => {
  if (styleElement) {
    styleElement.textContent = props.css ?? ''
    console.log('已更新CSS')
  }
}, 1000)
watch(() => props.css, cssDebounce)

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

onMounted(() => {
  // 创建<style>元素并添加到<head>中
  styleElement = document.createElement('style')
  // 可能需要对 userStyleString 做安全处理以避免XSS攻击
  styleElement.textContent = props.css ?? ''
  document.head.appendChild(styleElement)
})
onUnmounted(() => {
  if (styleElement && styleElement.parentNode) {
    styleElement.parentNode.removeChild(styleElement)
  }
})
</script>

<template>
  <div
    class="question-display-root"
    :style="{
      backgroundColor: '#' + setting.borderColor,
      borderColor: setting.borderColor ? '#' + setting.borderColor : undefined,
      borderWidth: setting.borderWidth ? setting.borderWidth + 'px' : undefined,
      borderTopWidth: 0,
    }"
    :display="question ? 1 : 0"
  >
    <div
      v-if="setting.showUserName"
      class="question-display-user-name"
      :style="{
        color: '#' + setting.nameFontColor,
        fontSize: setting.nameFontSize + 'px',
        fontWeight: setting.nameFontWeight ? setting.nameFontWeight : undefined,
        fontFamily: setting.nameFont,
      }"
    >
      {{ question?.sender?.name ?? '匿名用户' }}
    </div>
    <div
      class="question-display-content"
      :style="{
        color: '#' + setting.fontColor,
        backgroundColor: '#' + setting.backgroundColor,
        fontSize: setting.fontSize + 'px',
        fontWeight: setting.fontWeight ? setting.fontWeight : undefined,
        textAlign: align,
        fontFamily: setting.font,
      }"
    >
      <div class="question-display-text">
        {{ question?.question.message }}
      </div>
      <img
        class="question-display-image"
        v-if="setting.showImage && question?.question.image"
        :src="question?.question.image"
      />
    </div>
  </div>
</template>

<style scoped>
.question-display-root {
  height: 100%;
  width: 100%;
  border-radius: 16px;
  border: 2 solid rgb(255, 255, 255);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  border-style: solid;
  box-sizing: border-box;
}
.question-display-content {
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-evenly;
  padding: 24px;
}
.question-display-user-name {
  text-align: center;
  margin: 5px;
}
.question-display-text {
  min-height: 50px;
  transition: all 0.3s ease;
}
.question-display-image {
  max-width: 40%;
  max-height: 40%;
  margin: 0 auto;
}
</style>
