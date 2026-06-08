<script setup lang="ts">
import { useClipboard, useDropZone, useEventListener, useFileDialog } from '@vueuse/core'
import { NButton, NCard, NFlex, NSelect, NSpin, NText } from 'naive-ui'
import * as ort from 'onnxruntime-web'
import { nextTick, ref } from 'vue'
import { LANG_OPTIONS, useTranslate } from '@/composables/useTranslate'
import { trackManageToolSuccess } from '@/shared/services/umami'

ort.env.wasm.numThreads = 1
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/'

const message = useMessage()
const { copy } = useClipboard()
const { targetLang, translating, translate, mode, modeOptions } = useTranslate()

const MODEL_BASE = '/models/ocr'

let ocrInstance: Awaited<ReturnType<typeof import('esearch-ocr').init>> | null = null

interface OcrLine {
  text: string
  confidence: number
  box: [[number, number], [number, number], [number, number], [number, number]]
}

interface ImageTask {
  id: number
  file: File
  url: string
  processing: boolean
  lines: OcrLine[]
  fullText: string
  translatedText: string
}

const tasks = ref<ImageTask[]>([])
const activeTaskId = ref<number | null>(null)
const modelLoading = ref(false)
const hoveredLineIdx = ref<number | null>(null)
const dropZoneRef = ref<HTMLDivElement>()
const canvasRefs = ref<Map<number, HTMLCanvasElement>>(new Map())
const imgRefs = ref<Map<number, HTMLImageElement>>(new Map())

let nextId = 0

const { open: openFileDialog, onChange } = useFileDialog({ accept: 'image/*', multiple: true })
onChange(files => { if (files) addFiles(Array.from(files)) })
useDropZone(dropZoneRef, { onDrop: files => { if (files) addFiles(files) } })

useEventListener('paste', (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return
  const files: File[] = []
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  if (files.length) {
    e.preventDefault()
    addFiles(files)
  }
})

function addFiles(files: File[]) {
  const imgs = files.filter(f => f.type.startsWith('image/'))
  if (!imgs.length) return message.warning('未检测到图片文件')
  for (const file of imgs) {
    const task: ImageTask = {
      id: nextId++,
      file,
      url: URL.createObjectURL(file),
      processing: false,
      lines: [],
      fullText: '',
      translatedText: '',
    }
    tasks.value.push(task)
    if (activeTaskId.value === null) activeTaskId.value = task.id
  }
}

function removeTask(id: number) {
  const idx = tasks.value.findIndex(t => t.id === id)
  if (idx === -1) return
  URL.revokeObjectURL(tasks.value[idx].url)
  tasks.value.splice(idx, 1)
  if (activeTaskId.value === id) {
    activeTaskId.value = tasks.value[0]?.id ?? null
  }
}

async function loadDictionary(): Promise<string> {
  const resp = await fetch(`${MODEL_BASE}/ppocrv5_dict.txt`)
  return resp.text()
}

async function getOcr() {
  if (ocrInstance) return ocrInstance
  modelLoading.value = true
  try {
    const ocr = await import('esearch-ocr')
    const dict = await loadDictionary()
    ocrInstance = await ocr.init({
      det: { input: `${MODEL_BASE}/ppocr_v5_mobile_det.onnx` },
      rec: { input: `${MODEL_BASE}/ppocr_v5_mobile_rec.onnx`, decodeDic: dict, optimize: { space: false } },
      ort,
    })
    return ocrInstance
  } finally {
    modelLoading.value = false
  }
}

async function recognizeOne(task: ImageTask) {
  task.processing = true
  try {
    const ocr = await getOcr()
    const result = await ocr.ocr(task.url)
    task.lines = result.src.map(line => ({
      text: line.text,
      confidence: line.mean,
      box: line.box as OcrLine['box'],
    }))
    task.fullText = result.parragraphs.map(p => p.text).join('\n')
    await nextTick()
    drawOverlay(task.id)
    trackManageToolSuccess('Ocr', 'recognize', {
      lines: task.lines.length,
      chars: task.fullText.length,
    })
    return true
  } catch (e: any) {
    message.error(`识别失败: ${e?.message ?? e}`)
    return false
  } finally {
    task.processing = false
  }
}

async function recognizeAll() {
  const pending = tasks.value.filter(t => !t.lines.length && !t.processing)
  if (!pending.length) return message.info('没有待识别的图片')
  let succeeded = 0
  for (const task of pending) {
    if (await recognizeOne(task)) succeeded++
  }
  if (succeeded > 0) message.success(`已识别 ${succeeded} 张图片`)
  else message.warning('没有图片识别成功')
}

function drawOverlay(taskId: number, highlightIdx?: number | null) {
  const canvas = canvasRefs.value.get(taskId)
  const img = imgRefs.value.get(taskId)
  const task = tasks.value.find(t => t.id === taskId)
  if (!canvas || !img || !task || !task.lines.length) return

  const rect = img.getBoundingClientRect()
  canvas.width = rect.width
  canvas.height = rect.height
  const scaleX = rect.width / img.naturalWidth
  const scaleY = rect.height / img.naturalHeight

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  for (const [idx, line] of task.lines.entries()) {
    const isHighlight = idx === highlightIdx
    ctx.beginPath()
    const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = line.box
    ctx.moveTo(x0 * scaleX, y0 * scaleY)
    ctx.lineTo(x1 * scaleX, y1 * scaleY)
    ctx.lineTo(x2 * scaleX, y2 * scaleY)
    ctx.lineTo(x3 * scaleX, y3 * scaleY)
    ctx.closePath()
    ctx.fillStyle = isHighlight ? 'rgba(24, 160, 88, 0.3)' : 'rgba(24, 160, 88, 0.08)'
    ctx.fill()
    ctx.strokeStyle = isHighlight ? 'rgba(24, 160, 88, 0.9)' : 'rgba(24, 160, 88, 0.4)'
    ctx.lineWidth = isHighlight ? 2 : 1
    ctx.stroke()
  }
}

function onLineHover(taskId: number, idx: number | null) {
  hoveredLineIdx.value = idx
  drawOverlay(taskId, idx)
}

function setCanvasRef(taskId: number, el: any) {
  if (el) canvasRefs.value.set(taskId, el)
  else canvasRefs.value.delete(taskId)
}
function setImgRef(taskId: number, el: any) {
  if (el) imgRefs.value.set(taskId, el)
  else imgRefs.value.delete(taskId)
}

async function copyAll() {
  const allText = tasks.value.filter(t => t.fullText).map(t => t.fullText).join('\n\n')
  if (!allText) return
  await copy(allText)
  message.success('已复制全部文字')
}

async function copyOne(task: ImageTask) {
  if (!task.fullText) return
  await copy(task.fullText)
  message.success('已复制')
}

async function translateTask(task: ImageTask) {
  if (!task.fullText) return message.warning('请先识别文字')
  try {
    task.translatedText = await translate(task.fullText)
    trackManageToolSuccess('Ocr', 'translate', {
      mode: mode.value,
      target_lang: targetLang.value,
      chars: task.fullText.length,
    })
  } catch (e: any) {
    message.error(`翻译失败: ${e?.message ?? e}`)
  }
}
</script>

<template>
  <NCard title="文字识别 (OCR)">
    <template #header-extra>
      <NFlex :size="8" align="center">
        <NButton size="small" :disabled="tasks.every(t => !t.lines.length)" @click="copyAll">
          复制全部
        </NButton>
        <NButton size="small" type="primary" :loading="tasks.some(t => t.processing)" @click="recognizeAll">
          {{ modelLoading ? '加载模型中...' : '全部识别' }}
        </NButton>
      </NFlex>
    </template>

    <NFlex vertical :size="14">
      <!-- Upload bar -->
      <div ref="dropZoneRef" class="upload-bar" @click="openFileDialog()">
        <NText depth="3" style="font-size: 12px">
          {{ tasks.length ? '+ 添加更多图片' : '拖拽图片、点击选择或 Ctrl+V 粘贴截图' }}
        </NText>
        <NText v-if="!tasks.length" depth="3" style="font-size: 11px">
          基于 PP-OCRv5，支持中英日韩，首次加载模型约 21MB
        </NText>
      </div>

      <!-- Image tabs -->
      <div v-if="tasks.length > 1" class="tab-bar">
        <button
          v-for="task in tasks" :key="task.id" class="tab-btn"
          :class="{ active: task.id === activeTaskId }" @click="activeTaskId = task.id"
        >
          <span class="tab-name">{{ task.file.name.slice(0, 14) }}</span>
          <span v-if="task.lines.length" class="tab-badge">✓</span>
        </button>
      </div>

      <!-- Active task content -->
      <template v-for="task in tasks" :key="task.id">
        <div v-show="task.id === activeTaskId" class="task-panel">
          <NFlex :size="8" align="center" class="task-toolbar">
            <NButton size="small" type="primary" :loading="task.processing" @click="recognizeOne(task)">
              {{ task.processing ? (modelLoading ? '加载模型...' : '识别中...') : '开始识别' }}
            </NButton>
            <NButton size="small" :disabled="!task.fullText" @click="copyOne(task)">
              复制文字
            </NButton>
            <NButton size="small" quaternary type="error" @click="removeTask(task.id)">
              移除
            </NButton>
          </NFlex>

          <NSpin :show="task.processing" :description="modelLoading ? '正在加载模型...' : '正在识别...'">
            <div class="split-layout">
              <div class="split-left">
                <div class="img-container">
                  <img
                    :ref="(el) => setImgRef(task.id, el)" :src="task.url" class="preview-img"
                    @load="() => { if (task.lines.length) drawOverlay(task.id) }"
                  >
                  <canvas :ref="(el) => setCanvasRef(task.id, el)" class="overlay-canvas" />
                </div>
              </div>
              <div v-if="task.lines.length" class="split-right">
                <textarea v-model="task.fullText" class="result-textarea" placeholder="识别结果（可编辑）" />
                <NFlex :size="6" align="center" class="translate-bar">
                  <NText depth="3" style="font-size: 11px">
                    翻译为
                  </NText>
                  <NSelect v-model:value="targetLang" :options="LANG_OPTIONS" size="tiny" style="width: 100px" />
                  <NText depth="3" style="font-size: 11px">
                    使用
                  </NText>
                  <NSelect v-model:value="mode" :options="modeOptions" size="tiny" style="width: 110px" />
                  <NButton size="tiny" :loading="translating" :disabled="!task.fullText" @click="translateTask(task)">
                    翻译
                  </NButton>
                </NFlex>
                <textarea v-if="task.translatedText" v-model="task.translatedText" class="result-textarea translated" readonly placeholder="翻译结果" />
                <details class="line-details">
                  <summary class="line-summary">
                    逐行结果（{{ task.lines.length }} 行，悬停可高亮原图区域）
                  </summary>
                  <div class="line-list">
                    <div
                      v-for="(line, idx) in task.lines" :key="idx" class="line-item"
                      :class="{ active: hoveredLineIdx === idx && activeTaskId === task.id }"
                      @mouseenter="onLineHover(task.id, idx)"
                      @mouseleave="onLineHover(task.id, null)"
                    >
                      <span class="line-text">{{ line.text }}</span>
                      <span class="line-conf">{{ (line.confidence * 100).toFixed(0) }}%</span>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </NSpin>
        </div>
      </template>
    </NFlex>
  </NCard>
</template>

<style scoped>
.upload-bar {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  padding: 14px; border: 2px dashed var(--n-border-color);
  border-radius: 8px; cursor: pointer; transition: border-color 0.2s, background 0.2s;
}
.upload-bar:hover { border-color: var(--primary-color, #18a058); background: rgba(24, 160, 88, 0.03); }

.tab-bar {
  display: flex; gap: 4px; flex-wrap: wrap;
  padding: 4px; background: var(--n-color-embedded); border-radius: 6px;
}
.tab-btn {
  display: flex; align-items: center; gap: 4px;
  padding: 4px 10px; border: none; border-radius: 4px;
  font-size: 12px; cursor: pointer; background: transparent; color: inherit;
  transition: background 0.15s;
}
.tab-btn:hover { background: rgba(0, 0, 0, 0.05); }
.tab-btn.active { background: var(--primary-color, #18a058); color: #fff; }
.tab-name { max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tab-badge { font-size: 10px; }

.task-panel { display: flex; flex-direction: column; gap: 10px; }
.task-toolbar { padding-bottom: 4px; border-bottom: 1px solid var(--n-border-color); }

.split-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; min-height: 200px; }
@media (max-width: 768px) { .split-layout { grid-template-columns: 1fr; } }

.split-left { display: flex; flex-direction: column; }
.split-right { display: flex; flex-direction: column; gap: 8px; min-width: 0; }

.img-container { position: relative; flex: 1; }
.preview-img {
  width: 100%; max-height: 520px; object-fit: contain; display: block;
  border-radius: 6px; border: 1px solid var(--n-border-color); background: var(--n-color-embedded);
}
.overlay-canvas { position: absolute; top: 0; left: 0; pointer-events: none; border-radius: 6px; }

.result-textarea {
  width: 100%; min-height: 240px; max-height: 450px; resize: vertical; flex: 1;
  padding: 12px; border-radius: 6px; font-size: 14px; line-height: 1.8;
  border: 1px solid var(--n-border-color); background: var(--n-color-embedded);
  font-family: inherit; color: inherit; outline: none;
}
.result-textarea:focus { border-color: var(--primary-color, #18a058); }

.line-details { border-radius: 6px; border: 1px solid var(--n-border-color); }
.line-summary {
  padding: 8px 12px; font-size: 12px; cursor: pointer; user-select: none;
  color: var(--n-text-color-3); list-style: none;
}
.line-summary::-webkit-details-marker { display: none; }
.line-summary::before { content: '▶ '; font-size: 10px; }
.line-details[open] .line-summary::before { content: '▼ '; }
.line-list { overflow-y: auto; max-height: 260px; display: flex; flex-direction: column; gap: 1px; padding: 4px; }
.line-item {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 8px; border-radius: 4px; font-size: 12px; cursor: default;
  transition: background 0.12s;
}
.line-item:hover, .line-item.active { background: rgba(24, 160, 88, 0.1); }
.line-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.line-conf { flex: none; font-size: 11px; opacity: 0.5; }

.translate-bar { padding: 4px 0; }
.result-textarea.translated { min-height: 120px; background: rgba(24, 160, 88, 0.03); }
</style>
