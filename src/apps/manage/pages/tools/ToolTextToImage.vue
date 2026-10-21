<script setup lang="ts">
import { saveAs } from 'file-saver'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'

import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { canvasToBlob, useMessage } from '@/shared/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'

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
    if (!para) {
      lines.push('')
      continue
    }
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

async function download() {
  const canvas = canvasRef.value
  if (!canvas) return
  try {
    saveAs(await canvasToBlob(canvas), `text-image-${Date.now()}.png`)
    trackManageToolSuccess('TextToImage', 'download', {
      chars: text.value.length,
      width: style.maxWidth,
    })
    message.success('已保存')
  } catch {
    message.error('导出失败')
  }
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle class="text-base font-semibold">文字转图片</CardTitle>
      <Button
        :disabled="!text"
        size="sm"
        class="h-8 text-xs"
        @click="download"
      >
        下载 PNG
      </Button>
    </CardHeader>
    <CardContent class="pt-0">
      <div class="text-to-image-layout">
        <div class="controls-panel">
          <span class="text-xs text-muted-foreground mb-2 block">
            输入文本
          </span>
          <Textarea
            v-model="text"
            placeholder="在此粘贴长文本，将自动渲染为图片..."
            class="min-h-[140px]"
          />
          <div class="flex flex-col mt-4 gap-3">
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 字体 </span>
              <Select
                :model-value="style.fontFamily"
                @update:model-value="onFontChange"
              >
                <SelectTrigger class="h-8 flex-1 text-xs">
                  <SelectValue :placeholder="fontsLoading ? '加载字体中...' : '选择字体'" />
                </SelectTrigger>
                <SelectContent class="max-h-60">
                  <SelectItem
                    v-for="opt in fontOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 加粗 </span>
              <Switch
                :checked="style.bold"
                @update:checked="(v) => (style.bold = v)"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 水平对齐 </span>
              <Select v-model="style.textAlign">
                <SelectTrigger class="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in alignOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 垂直对齐 </span>
              <Select v-model="style.verticalAlign">
                <SelectTrigger class="h-8 w-[120px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="opt in vAlignOptions"
                    :key="opt.value"
                    :value="opt.value"
                  >
                    {{ opt.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 字号 </span>
              <Slider
                :model-value="[style.fontSize]"
                :min="14"
                :max="48"
                :step="1"
                class="flex-1"
                @update:model-value="(val) => { if (val?.[0] !== undefined) style.fontSize = val[0] }"
              />
              <NInputNumber
                v-model="style.fontSize"
                :min="14"
                :max="48"
                size="small"
                class="w-20"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 行高 </span>
              <Slider
                :model-value="[style.lineHeight]"
                :min="1.2"
                :max="2.5"
                :step="0.1"
                class="flex-1"
                @update:model-value="(val) => { if (val?.[0] !== undefined) style.lineHeight = Number(val[0].toFixed(1)) }"
              />
              <NInputNumber
                v-model="style.lineHeight"
                :min="1.2"
                :max="2.5"
                :step="0.1"
                size="small"
                class="w-20"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 内边距 </span>
              <Slider
                :model-value="[style.padding]"
                :min="16"
                :max="80"
                :step="4"
                class="flex-1"
                @update:model-value="(val) => { if (val?.[0] !== undefined) style.padding = val[0] }"
              />
              <NInputNumber
                v-model="style.padding"
                :min="16"
                :max="80"
                size="small"
                class="w-20"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 最大宽度 </span>
              <Slider
                :model-value="[style.maxWidth]"
                :min="400"
                :max="1200"
                :step="50"
                class="flex-1"
                @update:model-value="(val) => { if (val?.[0] !== undefined) style.maxWidth = val[0] }"
              />
              <NInputNumber
                v-model="style.maxWidth"
                :min="400"
                :max="1200"
                :step="50"
                size="small"
                class="w-24"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 文字颜色 </span>
              <ColorPicker
                v-model="style.color"
                class="flex-1"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 背景色 </span>
              <ColorPicker
                v-model="style.bgColor"
                class="flex-1"
              />
            </div>
            <div class="flex items-center gap-2">
              <span class="w-[70px] text-xs text-muted-foreground shrink-0"> 渐变终色 </span>
              <ColorPicker
                v-model="style.bgGradient"
                class="flex-1"
              />
            </div>
            <span class="text-xs text-muted-foreground">
              渐变终色留空则使用纯色背景
            </span>
          </div>
        </div>
        <div class="preview-panel">
          <span class="text-xs text-muted-foreground mb-2 block">
            预览
          </span>
          <div class="preview-scroll">
            <canvas ref="canvasRef" />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
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
  border: 1px solid var(--border, #e0e0e0);
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
