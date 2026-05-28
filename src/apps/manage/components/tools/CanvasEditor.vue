<script setup lang="ts">
import Konva from 'konva'
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { get as idbGet, set as idbSet } from 'idb-keyval'

export type LayerType = 'image' | 'text'

export interface BaseLayer {
  id: string
  type: LayerType
  x: number
  y: number
  rotation: number
  scaleX: number
  scaleY: number
  visible: boolean
  name: string
}

export interface ImageLayer extends BaseLayer {
  type: 'image'
  src: string
  width: number
  height: number
  opacity: number
  stroke: string
  strokeWidth: number
  _img?: HTMLImageElement
}

export interface TextLayer extends BaseLayer {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  stroke: string
  strokeWidth: number
  align: 'left' | 'center' | 'right'
  bold: boolean
  italic: boolean
  underline: boolean
}

export type EditorLayer = ImageLayer | TextLayer

const props = defineProps<{
  width: number
  height: number
  backgroundColor: string
  backgroundGradient?: { from: string; to: string; angle: number } | null
  backgroundImage?: string | null
  storageKey?: string
}>()

const containerRef = ref<HTMLDivElement>()
const stageRef = ref<any>()
const transformerRef = ref<any>()
const layers = ref<EditorLayer[]>([])
const selectedId = ref<string | null>(null)
const containerWidth = ref(800)
const containerHeight = ref(500)

// Scale to fit both width and height, centered
const stageScale = computed(() => {
  const sx = containerWidth.value / props.width
  const sy = containerHeight.value / props.height
  return Math.min(sx, sy, 1)
})
const stagePixelW = computed(() => props.width * stageScale.value)
const stagePixelH = computed(() => props.height * stageScale.value)

// --- Background ---
const bgImageObj = ref<HTMLImageElement | null>(null)
watch(() => props.backgroundImage, (src) => {
  if (!src) { bgImageObj.value = null; return }
  const img = new Image()
  img.onload = () => { bgImageObj.value = img }
  img.src = src
}, { immediate: true })

const bgFill = computed(() => {
  if (props.backgroundGradient) {
    const { from, to, angle } = props.backgroundGradient
    const rad = (angle * Math.PI) / 180
    const cos = Math.cos(rad), sin = Math.sin(rad)
    const cx = props.width / 2, cy = props.height / 2
    const len = Math.max(props.width, props.height)
    return {
      fillLinearGradientStartPoint: { x: cx - cos * len / 2, y: cy - sin * len / 2 },
      fillLinearGradientEndPoint: { x: cx + cos * len / 2, y: cy + sin * len / 2 },
      fillLinearGradientColorStops: [0, from, 1, to],
    }
  }
  return { fill: props.backgroundColor }
})

// --- History (undo/redo) ---
const history = ref<string[]>([])
const historyIndex = ref(-1)
const maxHistory = 50

function snapshot() {
  const serialized = JSON.stringify(layers.value.map(l => {
    const { _img, ...rest } = l as any
    return rest
  }))
  if (historyIndex.value < history.value.length - 1) {
    history.value = history.value.slice(0, historyIndex.value + 1)
  }
  history.value.push(serialized)
  if (history.value.length > maxHistory) history.value.shift()
  historyIndex.value = history.value.length - 1
}

async function restoreSnapshot(json: string) {
  const parsed: EditorLayer[] = JSON.parse(json)
  for (const layer of parsed) {
    if (layer.type === 'image') {
      const img = new Image()
      await new Promise<void>(r => { img.onload = () => r(); img.src = layer.src })
      ;(layer as ImageLayer)._img = img
    }
  }
  layers.value = parsed
  selectedId.value = null
}

function undo() {
  if (historyIndex.value <= 0) return
  historyIndex.value--
  restoreSnapshot(history.value[historyIndex.value])
}

function redo() {
  if (historyIndex.value >= history.value.length - 1) return
  historyIndex.value++
  restoreSnapshot(history.value[historyIndex.value])
}

function handleKeydown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo(); else undo()
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedId.value && document.activeElement === document.body) {
      removeLayer(selectedId.value)
    }
  }
}
// --- Layer operations ---
let idCounter = 0
function genId() { return `layer_${++idCounter}_${Date.now()}` }

async function addImageLayer(file: File) {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = url })
  const scale = Math.min(props.width * 0.6 / img.width, props.height * 0.6 / img.height, 1)
  const layer: ImageLayer = {
    id: genId(), type: 'image', name: file.name.replace(/\.[^.]+$/, ''),
    x: (props.width - img.width * scale) / 2, y: (props.height - img.height * scale) / 2,
    rotation: 0, scaleX: scale, scaleY: scale, visible: true,
    src: url, width: img.width, height: img.height, opacity: 1, stroke: '', strokeWidth: 0, _img: img,
  }
  layers.value.push(layer)
  selectedId.value = layer.id
  snapshot()
}

function addTextLayer(text = '双击编辑文字') {
  const layer: TextLayer = {
    id: genId(), type: 'text', name: `文字 ${layers.value.filter(l => l.type === 'text').length + 1}`,
    x: props.width * 0.2, y: props.height * 0.4,
    rotation: 0, scaleX: 1, scaleY: 1, visible: true,
    text, fontSize: Math.round(props.height * 0.08), fontFamily: 'sans-serif',
    fill: '#ffffff', stroke: '#000000', strokeWidth: 0,
    align: 'left', bold: true, italic: false, underline: false,
  }
  layers.value.push(layer)
  selectedId.value = layer.id
  snapshot()
}

function removeLayer(id: string) {
  const idx = layers.value.findIndex(l => l.id === id)
  if (idx < 0) return
  const layer = layers.value[idx]
  if (layer.type === 'image') URL.revokeObjectURL(layer.src)
  layers.value.splice(idx, 1)
  if (selectedId.value === id) selectedId.value = null
  snapshot()
}

async function replaceLayerImage(id: string, blob: Blob) {
  const layer = layers.value.find(l => l.id === id)
  if (!layer || layer.type !== 'image') return
  const url = URL.createObjectURL(blob)
  const img = new Image()
  await new Promise<void>(r => { img.onload = () => r(); img.src = url })
  URL.revokeObjectURL(layer.src)
  layer.src = url
  layer._img = img
  snapshot()
}

function moveLayer(id: string, direction: 'up' | 'down') {
  const idx = layers.value.findIndex(l => l.id === id)
  if (idx < 0) return
  const target = direction === 'up' ? idx + 1 : idx - 1
  if (target < 0 || target >= layers.value.length) return
  const temp = layers.value[idx]
  layers.value[idx] = layers.value[target]
  layers.value[target] = temp
  snapshot()
  nextTick(syncZOrder)
}

function reorderLayer(fromId: string, toId: string) {
  const fromIdx = layers.value.findIndex(l => l.id === fromId)
  const toIdx = layers.value.findIndex(l => l.id === toId)
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return
  const [item] = layers.value.splice(fromIdx, 1)
  layers.value.splice(toIdx, 0, item)
  snapshot()
  nextTick(syncZOrder)
}

function syncZOrder() {
  const stage = stageRef.value?.getStage() as Konva.Stage | undefined
  if (!stage) return
  const konvaLayer = stage.getLayers()[1]
  if (!konvaLayer) return
  layers.value.forEach((l, i) => {
    const node = konvaLayer.findOne(`#${l.id}`)
    if (node) node.zIndex(i)
  })
  konvaLayer.batchDraw()
}

// --- Stage interaction ---
function handleStageClick(e: any) {
  const stage = stageRef.value?.getStage()
  if (e.target === stage) {
    selectedId.value = null
    updateTransformer()
  }
}

function handleNodeClick(id: string) {
  selectedId.value = id
  updateTransformer()
}

function handleDragEnd(id: string, e: any) {
  const layer = layers.value.find(l => l.id === id)
  if (layer) { layer.x = e.target.x(); layer.y = e.target.y() }
  snapshot()
}

function handleTransformEnd(id: string, e: any) {
  const node = e.target
  const layer = layers.value.find(l => l.id === id)
  if (layer) {
    layer.x = node.x(); layer.y = node.y()
    layer.rotation = node.rotation()
    layer.scaleX = node.scaleX(); layer.scaleY = node.scaleY()
  }
  snapshot()
}

function updateTransformer() {
  const tr = transformerRef.value?.getNode()
  if (!tr) return
  const stage = stageRef.value?.getStage()
  if (!stage) return
  if (!selectedId.value) { tr.nodes([]); return }
  const node = stage.findOne(`#${selectedId.value}`)
  tr.nodes(node ? [node] : [])
}

watch(selectedId, () => nextTick(updateTransformer))

// --- Export ---
async function exportImage(mime = 'image/png', quality?: number): Promise<Blob> {
  const stage = stageRef.value?.getStage() as Konva.Stage
  const oldScale = { x: stage.scaleX(), y: stage.scaleY() }
  const oldSize = { width: stage.width(), height: stage.height() }
  stage.scale({ x: 1, y: 1 })
  stage.size({ width: props.width, height: props.height })
  const dataUrl = stage.toDataURL({ mimeType: mime, quality, pixelRatio: 1 })
  stage.scale(oldScale)
  stage.size(oldSize)
  const res = await fetch(dataUrl)
  return res.blob()
}

// --- Resize observer ---
function updateContainerSize() {
  if (!containerRef.value) return
  containerWidth.value = containerRef.value.clientWidth
  containerHeight.value = containerRef.value.clientHeight
}

let resizeObs: ResizeObserver | null = null
onMounted(async () => {
  updateContainerSize()
  resizeObs = new ResizeObserver(updateContainerSize)
  resizeObs.observe(containerRef.value!)
  document.addEventListener('keydown', handleKeydown)
  await loadFromIDB()
  snapshot()
})
onUnmounted(() => {
  resizeObs?.disconnect()
  document.removeEventListener('keydown', handleKeydown)
})

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

// --- Serialization (for IDB + export/import) ---
interface SerializedLayer {
  id: string; type: LayerType; x: number; y: number; rotation: number
  scaleX: number; scaleY: number; visible: boolean; name: string
  stroke?: string; strokeWidth?: number
  // image
  src?: string; width?: number; height?: number; opacity?: number; dataUrl?: string
  // text
  text?: string; fontSize?: number; fontFamily?: string; fill?: string
  align?: string; bold?: boolean
  italic?: boolean; underline?: boolean
}

function serializeLayers(): SerializedLayer[] {
  return layers.value.map(l => {
    const { _img, ...rest } = l as any
    if (l.type === 'image') {
      // Convert blob URL to dataURL for persistence
      const canvas = document.createElement('canvas')
      canvas.width = l.width; canvas.height = l.height
      const ctx = canvas.getContext('2d')!
      if (_img) ctx.drawImage(_img, 0, 0)
      return { ...rest, dataUrl: canvas.toDataURL() }
    }
    return rest
  })
}

async function deserializeLayers(data: SerializedLayer[]): Promise<EditorLayer[]> {
  const result: EditorLayer[] = []
  for (const item of data) {
    if (item.type === 'image') {
      const src = item.dataUrl || item.src || ''
      const img = new Image()
      await new Promise<void>(r => { img.onload = () => r(); img.onerror = () => r(); img.src = src })
      const url = item.dataUrl ? src : item.src!
      result.push({ ...item, type: 'image', src: url, width: item.width!, height: item.height!, opacity: item.opacity ?? 1, stroke: item.stroke ?? '', strokeWidth: item.strokeWidth ?? 0, _img: img } as ImageLayer)
    } else {
      result.push(item as unknown as TextLayer)
    }
  }
  return result
}

// --- IDB persistence ---
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (!props.storageKey) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    await idbSet(props.storageKey!, serializeLayers())
  }, 500)
}

watch(layers, scheduleSave, { deep: true })

async function loadFromIDB() {
  if (!props.storageKey) return
  const data = await idbGet<SerializedLayer[]>(props.storageKey)
  if (data?.length) {
    layers.value = await deserializeLayers(data)
  }
}

// --- Export / Import JSON ---
async function exportJSON(): Promise<string> {
  return JSON.stringify({ version: 1, width: props.width, height: props.height, layers: serializeLayers() }, null, 2)
}

async function importJSON(json: string) {
  const data = JSON.parse(json)
  if (data.layers) {
    layers.value = await deserializeLayers(data.layers)
    snapshot()
  }
}

defineExpose({ layers, selectedId, addImageLayer, addTextLayer, removeLayer, moveLayer, reorderLayer, exportImage, undo, redo, canUndo, canRedo, exportJSON, importJSON, replaceLayerImage })
</script>

<template>
  <div ref="containerRef" class="canvas-editor">
    <div class="canvas-stage-wrap" :style="{ width: stagePixelW + 'px', height: stagePixelH + 'px' }">
      <v-stage ref="stageRef" :config="{ width: stagePixelW, height: stagePixelH, scaleX: stageScale, scaleY: stageScale }" @click="handleStageClick" @tap="handleStageClick">
        <v-layer>
          <v-rect v-if="!bgImageObj" :config="{ x: 0, y: 0, width: props.width, height: props.height, listening: false, ...bgFill }" />
          <v-image v-if="bgImageObj" :config="{ x: 0, y: 0, width: props.width, height: props.height, image: bgImageObj, listening: false }" />
        </v-layer>
        <v-layer>
          <template v-for="(layer, idx) in layers" :key="layer.id">
            <v-image
              v-if="layer.type === 'image' && layer.visible"
              :config="{ id: layer.id, x: layer.x, y: layer.y, width: layer.width, height: layer.height, image: layer._img, rotation: layer.rotation, scaleX: layer.scaleX, scaleY: layer.scaleY, opacity: layer.opacity, stroke: layer.stroke || undefined, strokeWidth: layer.strokeWidth, zIndex: idx, draggable: true }"
              @click="handleNodeClick(layer.id)" @tap="handleNodeClick(layer.id)"
              @dragend="handleDragEnd(layer.id, $event)" @transformend="handleTransformEnd(layer.id, $event)"
            />
            <v-text
              v-if="layer.type === 'text' && layer.visible"
              :config="{ id: layer.id, x: layer.x, y: layer.y, text: layer.text, fontSize: layer.fontSize, fontFamily: layer.fontFamily, fontStyle: [layer.bold ? 'bold' : '', layer.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal', textDecoration: layer.underline ? 'underline' : '', fill: layer.fill, stroke: layer.stroke, strokeWidth: layer.strokeWidth, fillAfterStrokeEnabled: true, align: layer.align, rotation: layer.rotation, scaleX: layer.scaleX, scaleY: layer.scaleY, zIndex: idx, draggable: true }"
              @click="handleNodeClick(layer.id)" @tap="handleNodeClick(layer.id)"
              @dragend="handleDragEnd(layer.id, $event)" @transformend="handleTransformEnd(layer.id, $event)"
            />
          </template>
          <v-transformer ref="transformerRef" :config="{ rotateEnabled: true, enabledAnchors: ['top-left', 'top-right', 'bottom-left', 'bottom-right'] }" />
        </v-layer>
      </v-stage>
    </div>
  </div>
</template>

<style scoped>
.canvas-editor {
  width: 100%;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
  padding: 12px;
  background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
    linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  background-color: #fafafa;
}
.canvas-stage-wrap {
  box-shadow: 0 2px 12px rgba(0,0,0,0.1);
  border-radius: 4px;
  overflow: hidden;
}
</style>
