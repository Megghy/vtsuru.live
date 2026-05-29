<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NCard, NColorPicker, NFlex, NInput, NInputNumber, NSelect, NSlider, NSwitch, NText } from 'naive-ui'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'

const message = useMessage()

const text = ref('')
const canvasRef = ref<HTMLCanvasElement>()

const { fontOptions, loading: fontsLoading, loadLocalFonts } = useLocalFonts()
onMounted(loadLocalFonts)

const style = reactive({
  fontSize: 24,
  lineHeight: 1.8,
  color: '#333333',
  bgColor: '#ffffff',
  bgGradient: '',
  padding: 40,
  maxWidth: 800,
  fontFamily: 'sans-serif',
  textAlign: 'left' as 'left' | 'center' | 'right',
  verticalAlign: 'top' as 'top' | 'center' | 'bottom',
  bold: false,
})

function onFontChange(val: string) {
  style.fontFamily = val
  markFontUsed(val)
}

const alignOptions = [
  { label: '左对齐', value: 'left' },
  { label: '居中', value: 'center' },
  { label: '右对齐', value: 'right' },
]
const vAlignOptions = [
  { label: '顶部', value: 'top' },
  { label: '垂直居中', value: 'center' },
  { label: '底部', value: 'bottom' },
]

function getFont() {
  const family = style.fontFamily
  const weight = style.bold ? 'bold ' : ''
  return `${weight}${style.fontSize}px ${family}`
}

function wrapLines(ctx: CanvasRenderingContext2D, content: string, maxLineWidth: number): string[] {
  const paragraphs = content.split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    if (!para) { lines.push(''); continue }
    let current = ''
    for (const char of para) {
      const test = current + char
      if (ctx.measureText(test).width > maxLineWidth && current) {
        lines.push(current)
        current = char
      } else {
        current = test
      }
    }
    if (current) lines.push(current)
  }
  return lines
}

function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')!
  const maxLineWidth = style.maxWidth - style.padding * 2
  ctx.font = getFont()
  const lines = wrapLines(ctx, text.value || '在此输入文本...', maxLineWidth)
  const lineHeightPx = style.fontSize * style.lineHeight
  const textBlockHeight = lines.length * lineHeightPx
  const minHeight = Math.ceil(textBlockHeight + style.padding * 2)
  const height = minHeight

  canvas.width = style.maxWidth
  canvas.height = height

  // background
  if (style.bgGradient) {
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, style.bgColor)
    grad.addColorStop(1, style.bgGradient)
    ctx.fillStyle = grad
  } else {
    ctx.fillStyle = style.bgColor
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // text
  ctx.font = getFont()
  ctx.fillStyle = style.color
  ctx.textBaseline = 'top'
  ctx.textAlign = style.textAlign

  let xBase: number
  if (style.textAlign === 'center') xBase = style.maxWidth / 2
  else if (style.textAlign === 'right') xBase = style.maxWidth - style.padding
  else xBase = style.padding

  let yStart = style.padding
  if (style.verticalAlign === 'center') yStart = (height - textBlockHeight) / 2
  else if (style.verticalAlign === 'bottom') yStart = height - textBlockHeight - style.padding

  lines.forEach((line, i) => {
    ctx.fillText(line, xBase, yStart + i * lineHeightPx)
  })
}

watch([text, style], () => nextTick(render), { deep: true, immediate: true })

function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) { message.error('导出失败'); return }
    saveAs(blob, `text-image-${Date.now()}.png`)
    message.success('已保存')
  }, 'image/png')
}
</script>

<template>
  <NCard title="文字转图片" segmented>
    <template #header-extra>
      <NButton type="primary" :disabled="!text" @click="download">
        下载 PNG
      </NButton>
    </template>
    <div class="text-to-image-layout">
      <div class="controls-panel">
        <NText depth="3" style="margin-bottom: 8px; display: block">
          输入文本
        </NText>
        <NInput
          v-model:value="text"
          type="textarea"
          placeholder="在此粘贴长文本，将自动渲染为图片..."
          :autosize="{ minRows: 6, maxRows: 16 }"
        />
        <NFlex vertical style="margin-top: 16px; gap: 12px">
          <NFlex align="center">
            <NText style="width: 70px">
              字体
            </NText>
            <NSelect :value="style.fontFamily" :options="fontOptions" :loading="fontsLoading" filterable style="flex: 1" @update:value="onFontChange" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              加粗
            </NText>
            <NSwitch v-model:value="style.bold" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              水平对齐
            </NText>
            <NSelect v-model:value="style.textAlign" :options="alignOptions" style="width: 120px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              垂直对齐
            </NText>
            <NSelect v-model:value="style.verticalAlign" :options="vAlignOptions" style="width: 120px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              字号
            </NText>
            <NSlider v-model:value="style.fontSize" :min="14" :max="48" :step="1" style="flex: 1" />
            <NInputNumber v-model:value="style.fontSize" :min="14" :max="48" size="small" style="width: 80px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              行高
            </NText>
            <NSlider v-model:value="style.lineHeight" :min="1.2" :max="2.5" :step="0.1" style="flex: 1" />
            <NInputNumber v-model:value="style.lineHeight" :min="1.2" :max="2.5" :step="0.1" size="small" style="width: 80px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              内边距
            </NText>
            <NSlider v-model:value="style.padding" :min="16" :max="80" :step="4" style="flex: 1" />
            <NInputNumber v-model:value="style.padding" :min="16" :max="80" size="small" style="width: 80px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              最大宽度
            </NText>
            <NSlider v-model:value="style.maxWidth" :min="400" :max="1200" :step="50" style="flex: 1" />
            <NInputNumber v-model:value="style.maxWidth" :min="400" :max="1200" :step="50" size="small" style="width: 100px" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              文字颜色
            </NText>
            <NColorPicker v-model:value="style.color" style="flex: 1" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              背景色
            </NText>
            <NColorPicker v-model:value="style.bgColor" style="flex: 1" />
          </NFlex>
          <NFlex align="center">
            <NText style="width: 70px">
              渐变终色
            </NText>
            <NColorPicker v-model:value="style.bgGradient" style="flex: 1" />
          </NFlex>
          <NText depth="3" style="font-size: 12px">
            渐变终色留空则使用纯色背景
          </NText>
        </NFlex>
      </div>
      <div class="preview-panel">
        <NText depth="3" style="margin-bottom: 8px; display: block">
          预览
        </NText>
        <div class="preview-scroll">
          <canvas ref="canvasRef" />
        </div>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.text-to-image-layout {
  display: flex;
  gap: 24px;
  min-height: 500px;
}
.controls-panel {
  flex: 0 0 420px;
  overflow-y: auto;
}
.preview-panel {
  flex: 1;
  min-width: 0;
}
.preview-scroll {
  overflow: auto;
  max-height: 70vh;
  border: 1px solid var(--n-border-color, #e0e0e0);
  border-radius: 4px;
  padding: 8px;
  background: #f5f5f5;
}
.preview-scroll canvas {
  display: block;
  max-width: 100%;
  height: auto;
}
</style>
