<script setup lang="ts">
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import { NButton, useMessage } from 'naive-ui';
const props = defineProps<{
  compoent: any
  fileName: string
  buttonText?: string
}>()

const message = useMessage()

function saveCompoent() {
  if (!props.compoent) {
    message.error('未找到要保存的组件')
    return
  }
  html2canvas(props.compoent, {
    width: props.compoent.clientWidth, // dom 原始宽度
    height: props.compoent.clientHeight,
    backgroundColor: null,
    scrollY: 0, // html2canvas默认绘制视图内的页面，需要把scrollY，scrollX设置为0
    scrollX: 0,
    useCORS: true, // 支持跨域，但好像没什么用
    allowTaint: true, // 允许跨域（默认false）
    scale: window.devicePixelRatio,
  }).then((canvas) => {
    canvas.toBlob(
      (data) => {
        saveAs(data!, `${props.fileName}.png`)
      },
      'image/png',
      1,
    )
  })
}
</script>

<template>
  <NButton
    type="primary"
    secondary
    @click="saveCompoent"
  >
    {{ buttonText ?? '保存为图片' }}
  </NButton>
</template>
