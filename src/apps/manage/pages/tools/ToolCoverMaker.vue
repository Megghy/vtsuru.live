<script setup lang="ts">
import { EyeOffOutline, EyeOutline, ImageOutline, TextOutline, TrashOutline } from '@vicons/ionicons5'
import { useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onMounted, reactive, ref } from 'vue'

import CanvasEditor from '@/apps/manage/components/tools/CanvasEditor.vue'
import type { EditorLayer, ImageLayer, TextLayer } from '@/apps/manage/components/tools/CanvasEditor.vue'
import RemoveBgDialog from '@/apps/manage/components/tools/RemoveBgDialog.vue'
import { markFontUsed, useLocalFonts } from '@/composables/useLocalFonts'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

const message = useMessage()
const WIDTH = 1146
const HEIGHT = 717
const editorRef = ref<InstanceType<typeof CanvasEditor>>()

const { fontOptions, loading: fontsLoading, loadLocalFonts } = useLocalFonts()
onMounted(loadLocalFonts)

function onFontChange(val: string) {
  if (!selectedLayer.value || selectedLayer.value.type !== 'text') return
  ;(selectedLayer.value as TextLayer).fontFamily = val
  markFontUsed(val)
}

const bg = reactive({
  type: 'gradient' as 'solid' | 'gradient' | 'image',
  color: '#6366f1',
  gradientFrom: '#6366f1',
  gradientTo: '#ec4899',
  gradientAngle: 135,
  imageUrl: null as string | null,
})
const bgTypeOptions = [
  { label: '纯色', value: 'solid' },
  { label: '渐变', value: 'gradient' },
  { label: '图片', value: 'image' },
]
const alignOptions = [
  { label: '左', value: 'left' },
  { label: '中', value: 'center' },
  { label: '右', value: 'right' },
]

const { open: openBgPicker, onChange: onBgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onBgChange((files) => {
  if (!files?.[0]) return
  if (bg.imageUrl) URL.revokeObjectURL(bg.imageUrl)
  bg.imageUrl = URL.createObjectURL(files[0])
  bg.type = 'image'
})

const { open: openImgPicker, onChange: onImgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onImgChange((files) => {
  if (files?.[0]) editorRef.value?.addImageLayer(files[0])
})

const selectedLayer = computed<EditorLayer | null>(() => {
  if (!editorRef.value?.selectedId) return null
  return editorRef.value.layers.find((l) => l.id === editorRef.value!.selectedId) ?? null
})

const dragLayerId = ref<string | null>(null)
function onDragStart(id: string) {
  dragLayerId.value = id
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
}
function onDrop(id: string) {
  if (dragLayerId.value && dragLayerId.value !== id) {
    editorRef.value?.reorderLayer(dragLayerId.value, id)
  }
  dragLayerId.value = null
}

async function download() {
  if (!editorRef.value) return
  const blob = await editorRef.value.exportImage()
  saveAs(blob, `cover-${Date.now()}.png`)
  trackManageToolSuccess('CoverMaker', 'download', {
    bytes: blob.size,
  })
  message.success('已下载')
}
async function exportProject() {
  if (!editorRef.value) return
  const json = await editorRef.value.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  saveAs(blob, `cover-project-${Date.now()}.json`)
  trackManageToolSuccess('CoverMaker', 'export-project')
  message.success('项目已导出')
}

const { open: openImportPicker, onChange: onImportChange } = useFileDialog({ accept: '.json', multiple: false })
onImportChange(async (files) => {
  if (!files?.[0] || !editorRef.value) return
  const text = await files[0].text()
  await editorRef.value.importJSON(text)
  trackManageToolSuccess('CoverMaker', 'import-project')
  message.success('项目已导入')
})

const showRemoveBg = ref(false)
const removeBgSourceUrl = computed(() => {
  if (!selectedLayer.value || selectedLayer.value.type !== 'image') return null
  return (selectedLayer.value as ImageLayer).src
})
async function onRemoveBgConfirm(blob: Blob) {
  showRemoveBg.value = false
  if (!editorRef.value || !selectedLayer.value) return
  await editorRef.value.replaceLayerImage(selectedLayer.value.id, blob)
  trackManageToolSuccess('CoverMaker', 'remove-bg')
  message.success('已替换')
}
</script>

<template>
  <div class="editor-layout">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <div class="flex items-center gap-2">
        <span class="font-semibold text-sm">直播封面</span>
        <span class="text-xs text-muted-foreground">{{ WIDTH }}×{{ HEIGHT }}</span>
      </div>
      <div class="flex items-center gap-1.5">
        <Button
          variant="outline"
          :disabled="!editorRef?.canUndo"
          @click="editorRef?.undo()"
        >
          撤销
        </Button>
        <Button
          variant="outline"
          :disabled="!editorRef?.canRedo"
          @click="editorRef?.redo()"
        >
          重做
        </Button>
        <Button
          variant="ghost"
          @click="exportProject"
        >
          导出项目
        </Button>
        <Button
          variant="ghost"
          @click="() => openImportPicker()"
        >
          导入项目
        </Button>
        <Button @click="download"> 下载 PNG </Button>
      </div>
    </div>

    <div class="editor-body">
      <!-- Left panel: layers -->
      <div class="editor-panel panel-left">
        <div class="panel-section">
          <div class="flex items-center justify-between panel-header">
            <span class="text-xs font-semibold">图层</span>
            <div class="flex gap-0.5">
              <Button
                size="icon"
                variant="ghost"
                class="size-6 p-0"
                @click="editorRef?.addTextLayer()"
              >
                <component
                  :is="TextOutline"
                  class="size-3.5"
                />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-6 p-0"
                @click="() => openImgPicker()"
              >
                <component
                  :is="ImageOutline"
                  class="size-3.5"
                />
              </Button>
            </div>
          </div>
          <div class="layer-list">
            <div
              v-if="!editorRef?.layers.length"
              class="layer-empty"
            >
              <span class="text-[11px] text-muted-foreground">添加图层开始编辑</span>
            </div>
            <div
              v-for="layer in [...(editorRef?.layers ?? [])].reverse()"
              :key="layer.id"
              class="layer-item"
              :class="{ active: editorRef?.selectedId === layer.id, dragging: dragLayerId === layer.id }"
              draggable="true"
              @dragstart="onDragStart(layer.id)"
              @dragover="onDragOver"
              @drop="onDrop(layer.id)"
              @click="
                () => {
                  if (editorRef) editorRef.selectedId = layer.id
                }
              "
            >
              <component
                :is="layer.type === 'text' ? TextOutline : ImageOutline"
                class="size-3.5 shrink-0"
              />
              <span class="layer-name">{{ layer.name }}</span>
              <Button
                size="icon"
                variant="ghost"
                class="size-5 p-0"
                @click.stop="layer.visible = !layer.visible"
              >
                <component
                  :is="layer.visible ? EyeOutline : EyeOffOutline"
                  class="size-3"
                />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-5 p-0"
                @click.stop="editorRef?.moveLayer(layer.id, 'up')"
              >
                ↑
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-5 p-0"
                @click.stop="editorRef?.moveLayer(layer.id, 'down')"
              >
                ↓
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-5 p-0 text-destructive"
                @click.stop="editorRef?.removeLayer(layer.id)"
              >
                <component
                  :is="TrashOutline"
                  class="size-3"
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Center: Canvas -->
      <div class="editor-canvas">
        <CanvasEditor
          ref="editorRef"
          :width="WIDTH"
          :height="HEIGHT"
          :background-color="bg.color"
          :background-gradient="
            bg.type === 'gradient' ? { from: bg.gradientFrom, to: bg.gradientTo, angle: bg.gradientAngle } : null
          "
          :background-image="bg.type === 'image' ? bg.imageUrl : null"
          storage-key="tool-cover-maker"
        />
      </div>

      <!-- Right panel: properties -->
      <div class="editor-panel panel-right text-xs">
        <!-- Background -->
        <div class="panel-section">
          <span class="text-xs font-semibold panel-header">背景</span>
          <Select v-model="bg.type">
            <SelectTrigger size="xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in bgTypeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <ColorPicker
            v-if="bg.type === 'solid'"
            v-model="bg.color"
          />
          <template v-if="bg.type === 'gradient'">
            <div class="flex gap-1.5">
              <ColorPicker
                v-model="bg.gradientFrom"
                class="flex-1"
              />
              <ColorPicker
                v-model="bg.gradientTo"
                class="flex-1"
              />
            </div>
            <div class="flex items-center gap-2 pt-1">
              <span class="text-[11px] text-muted-foreground w-8 shrink-0">角度</span>
              <div class="flex-1">
                <Slider
                  :model-value="[bg.gradientAngle]"
                  :min="0"
                  :max="360"
                  @update:model-value="bg.gradientAngle = $event?.[0] ?? bg.gradientAngle"
                />
              </div>
              <span class="w-8 text-right font-mono text-[11px]">{{ bg.gradientAngle }}°</span>
            </div>
          </template>
          <Button
            v-if="bg.type === 'image'"
            variant="outline"
            class="w-full"
            @click="() => openBgPicker()"
          >
            选择背景图
          </Button>
        </div>

        <!-- Properties -->
        <div class="panel-section">
          <span class="text-xs font-semibold panel-header">属性</span>
          <div
            v-if="!selectedLayer"
            class="props-empty py-4 text-center"
          >
            <span class="text-[11px] text-muted-foreground">选中图层编辑属性</span>
          </div>
          <template v-if="selectedLayer?.type === 'text'">
            <Textarea
              v-model="(selectedLayer as TextLayer).text"
              class="text-xs min-h-[60px]"
            />
            <div class="prop-row">
              <span class="text-muted-foreground">字号</span>
              <div class="w-20">
                <NInputNumber
                  v-model="(selectedLayer as TextLayer).fontSize"
                  :min="12"
                  :max="300"
                />
              </div>
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">字体</span>
              <div class="flex-1">
                <Select
                  :model-value="(selectedLayer as TextLayer).fontFamily"
                  @update:model-value="onFontChange(String($event))"
                >
                  <SelectTrigger size="xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
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
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">对齐</span>
              <div class="w-20">
                <Select v-model="(selectedLayer as TextLayer).align">
                  <SelectTrigger size="xs">
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
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">样式</span>
              <div class="flex border border-border rounded overflow-hidden">
                <button
                  type="button"
                  class="px-2 py-0.5 text-xs font-bold"
                  :class="(selectedLayer as TextLayer).bold ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="(selectedLayer as TextLayer).bold = !(selectedLayer as TextLayer).bold"
                >
                  B
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 text-xs italic border-x border-border"
                  :class="(selectedLayer as TextLayer).italic ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'"
                  @click="(selectedLayer as TextLayer).italic = !(selectedLayer as TextLayer).italic"
                >
                  I
                </button>
                <button
                  type="button"
                  class="px-2 py-0.5 text-xs underline"
                  :class="
                    (selectedLayer as TextLayer).underline ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  "
                  @click="(selectedLayer as TextLayer).underline = !(selectedLayer as TextLayer).underline"
                >
                  U
                </button>
              </div>
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">颜色</span>
              <ColorPicker
                v-model="(selectedLayer as TextLayer).fill"
                class="flex-1"
              />
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">描边</span>
              <ColorPicker
                v-model="(selectedLayer as TextLayer).stroke"
                class="flex-1"
              />
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">描边宽</span>
              <div class="flex-1 flex items-center gap-2">
                <Slider
                  :model-value="[(selectedLayer as TextLayer).strokeWidth]"
                  :min="0"
                  :max="20"
                  @update:model-value="
                    (selectedLayer as TextLayer).strokeWidth = $event?.[0] ?? (selectedLayer as TextLayer).strokeWidth
                  "
                />
                <span class="font-mono text-[11px] w-4">{{ (selectedLayer as TextLayer).strokeWidth }}</span>
              </div>
            </div>
          </template>
          <template v-if="selectedLayer?.type === 'image'">
            <div class="prop-row">
              <span class="text-muted-foreground">透明度</span>
              <div class="flex-1 flex items-center gap-2">
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).opacity]"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  @update:model-value="
                    (selectedLayer as ImageLayer).opacity = $event?.[0] ?? (selectedLayer as ImageLayer).opacity
                  "
                />
                <span class="font-mono text-[11px] w-6"
                  >{{ Math.round((selectedLayer as ImageLayer).opacity * 100) }}%</span
                >
              </div>
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">描边</span>
              <ColorPicker
                v-model="(selectedLayer as ImageLayer).stroke"
                class="flex-1"
              />
            </div>
            <div class="prop-row">
              <span class="text-muted-foreground">描边宽</span>
              <div class="flex-1 flex items-center gap-2">
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).strokeWidth]"
                  :min="0"
                  :max="20"
                  @update:model-value="
                    (selectedLayer as ImageLayer).strokeWidth = $event?.[0] ?? (selectedLayer as ImageLayer).strokeWidth
                  "
                />
                <span class="font-mono text-[11px] w-4">{{ (selectedLayer as ImageLayer).strokeWidth }}</span>
              </div>
            </div>
            <Button
              variant="outline"
              class="w-full mt-2"
              @click="showRemoveBg = true"
            >
              去背景
            </Button>
          </template>
        </div>
      </div>
    </div>
  </div>
  <RemoveBgDialog
    :show="showRemoveBg"
    :source-url="removeBgSourceUrl"
    @confirm="onRemoveBgConfirm"
    @cancel="showRemoveBg = false"
  />
</template>

<style scoped>
.editor-layout {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 100px);
  min-height: 500px;
}
.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.editor-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.editor-panel {
  width: 220px;
  flex-shrink: 0;
  overflow-y: auto;
  border-color: var(--border);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.panel-left {
  border-right: 1px solid var(--border);
}
.panel-right {
  border-left: 1px solid var(--border);
}
.editor-canvas {
  flex: 1;
  min-width: 0;
  display: flex;
}

.panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 8px;
}
.panel-section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
.panel-header {
  margin-bottom: 4px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.layer-empty {
  padding: 16px 0;
  text-align: center;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.layer-item:hover {
  background: var(--muted);
}
.layer-item.active {
  background: var(--muted);
  border-color: var(--primary);
}
.layer-item.dragging {
  opacity: 0.5;
}
.layer-name {
  flex: 1;
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prop-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
</style>
