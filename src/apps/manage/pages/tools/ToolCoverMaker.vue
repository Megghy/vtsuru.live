<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NButtonGroup, NColorPicker, NFlex, NIcon, NInput, NInputNumber, NSelect, NSlider, NText } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useFileDialog } from '@vueuse/core'
import { ImageOutline, TextOutline, TrashOutline, EyeOutline, EyeOffOutline } from '@vicons/ionicons5'
import CanvasEditor from '@/apps/manage/components/tools/CanvasEditor.vue'
import type { EditorLayer, ImageLayer, TextLayer } from '@/apps/manage/components/tools/CanvasEditor.vue'
import RemoveBgDialog from '@/apps/manage/components/tools/RemoveBgDialog.vue'
import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'

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
onBgChange(files => {
  if (!files?.[0]) return
  if (bg.imageUrl) URL.revokeObjectURL(bg.imageUrl)
  bg.imageUrl = URL.createObjectURL(files[0])
  bg.type = 'image'
})

const { open: openImgPicker, onChange: onImgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onImgChange(files => { if (files?.[0]) editorRef.value?.addImageLayer(files[0]) })

const selectedLayer = computed<EditorLayer | null>(() => {
  if (!editorRef.value?.selectedId) return null
  return editorRef.value.layers.find(l => l.id === editorRef.value!.selectedId) ?? null
})

const dragLayerId = ref<string | null>(null)
function onDragStart(id: string) { dragLayerId.value = id }
function onDragOver(e: DragEvent, id: string) { e.preventDefault() }
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
  message.success('已下载')
}
async function exportProject() {
  if (!editorRef.value) return
  const json = await editorRef.value.exportJSON()
  const blob = new Blob([json], { type: 'application/json' })
  saveAs(blob, `cover-project-${Date.now()}.json`)
  message.success('项目已导出')
}

const { open: openImportPicker, onChange: onImportChange } = useFileDialog({ accept: '.json', multiple: false })
onImportChange(async (files) => {
  if (!files?.[0] || !editorRef.value) return
  const text = await files[0].text()
  await editorRef.value.importJSON(text)
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
  message.success('已替换')
}
</script>

<template>
  <div class="editor-layout">
    <!-- Toolbar -->
    <div class="editor-toolbar">
      <NFlex :size="8" align="center">
        <NText strong>
          直播封面
        </NText>
        <NText depth="3" style="font-size:12px">
          {{ WIDTH }}×{{ HEIGHT }}
        </NText>
      </NFlex>
      <NFlex :size="6" align="center">
        <NButton size="small" :disabled="!editorRef?.canUndo" @click="editorRef?.undo()">
          撤销
        </NButton>
        <NButton size="small" :disabled="!editorRef?.canRedo" @click="editorRef?.redo()">
          重做
        </NButton>
        <NButton size="small" tertiary @click="exportProject">
          导出项目
        </NButton>
        <NButton size="small" tertiary @click="() => openImportPicker()">
          导入项目
        </NButton>
        <NButton size="small" type="primary" @click="download">
          下载 PNG
        </NButton>
      </NFlex>
    </div>

    <div class="editor-body">
      <!-- Left panel: layers -->
      <div class="editor-panel panel-left">
        <div class="panel-section">
          <NFlex justify="space-between" align="center" class="panel-header">
            <NText strong style="font-size:13px">
              图层
            </NText>
            <NFlex :size="2">
              <NButton size="tiny" quaternary @click="editorRef?.addTextLayer()">
                <template #icon>
                  <NIcon :component="TextOutline" size="14" />
                </template>
              </NButton>
              <NButton size="tiny" quaternary @click="() => openImgPicker()">
                <template #icon>
                  <NIcon :component="ImageOutline" size="14" />
                </template>
              </NButton>
            </NFlex>
          </NFlex>
          <div class="layer-list">
            <div v-if="!editorRef?.layers.length" class="layer-empty">
              <NText depth="3" style="font-size:11px">
                添加图层开始编辑
              </NText>
            </div>
            <div
              v-for="layer in [...(editorRef?.layers ?? [])].reverse()"
              :key="layer.id"
              class="layer-item"
              :class="{ active: editorRef?.selectedId === layer.id, dragging: dragLayerId === layer.id }"
              draggable="true"
              @dragstart="onDragStart(layer.id)"
              @dragover="onDragOver($event, layer.id)"
              @drop="onDrop(layer.id)"
              @click="() => { if (editorRef) editorRef.selectedId = layer.id }"
            >
              <NIcon :component="layer.type === 'text' ? TextOutline : ImageOutline" size="13" />
              <span class="layer-name">{{ layer.name }}</span>
              <NButton size="tiny" quaternary @click.stop="layer.visible = !layer.visible">
                <template #icon>
                  <NIcon :component="layer.visible ? EyeOutline : EyeOffOutline" size="11" />
                </template>
              </NButton>
              <NButton size="tiny" quaternary @click.stop="editorRef?.moveLayer(layer.id, 'up')">
                ↑
              </NButton>
              <NButton size="tiny" quaternary @click.stop="editorRef?.moveLayer(layer.id, 'down')">
                ↓
              </NButton>
              <NButton size="tiny" quaternary type="error" @click.stop="editorRef?.removeLayer(layer.id)">
                <template #icon>
                  <NIcon :component="TrashOutline" size="11" />
                </template>
              </NButton>
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
          :background-gradient="bg.type === 'gradient' ? { from: bg.gradientFrom, to: bg.gradientTo, angle: bg.gradientAngle } : null"
          :background-image="bg.type === 'image' ? bg.imageUrl : null"
          storage-key="tool-cover-maker"
        />
      </div>

      <!-- Right panel: properties -->
      <div class="editor-panel panel-right">
        <!-- RIGHT_PANEL_CONTENT -->
        <!-- Background -->
        <div class="panel-section">
          <NText strong style="font-size:13px" class="panel-header">
            背景
          </NText>
          <NSelect v-model:value="bg.type" :options="bgTypeOptions" size="small" />
          <NColorPicker v-if="bg.type === 'solid'" v-model:value="bg.color" size="small" />
          <template v-if="bg.type === 'gradient'">
            <NFlex :size="6">
              <NColorPicker v-model:value="bg.gradientFrom" size="small" style="flex:1" /><NColorPicker v-model:value="bg.gradientTo" size="small" style="flex:1" />
            </NFlex>
            <NFlex align="center" :size="6">
              <NText depth="3" style="font-size:11px">
                角度
              </NText><NSlider v-model:value="bg.gradientAngle" :min="0" :max="360" style="flex:1" />
            </NFlex>
          </template>
          <NButton v-if="bg.type === 'image'" size="small" block @click="() => openBgPicker()">
            选择背景图
          </NButton>
        </div>

        <!-- Properties -->
        <div class="panel-section">
          <NText strong style="font-size:13px" class="panel-header">
            属性
          </NText>
          <div v-if="!selectedLayer" class="props-empty">
            <NText depth="3" style="font-size:11px">
              选中图层编辑属性
            </NText>
          </div>
          <template v-if="selectedLayer?.type === 'text'">
            <NInput v-model:value="(selectedLayer as TextLayer).text" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" size="small" />
            <div class="prop-row">
              <span>字号</span><NInputNumber v-model:value="(selectedLayer as TextLayer).fontSize" :min="12" :max="300" size="small" style="width:70px" />
            </div>
            <div class="prop-row">
              <span>字体</span><NSelect :value="(selectedLayer as TextLayer).fontFamily" :options="fontOptions" :loading="fontsLoading" filterable size="small" style="flex:1" @update:value="onFontChange" />
            </div>
            <div class="prop-row">
              <span>对齐</span><NSelect v-model:value="(selectedLayer as TextLayer).align" :options="alignOptions" size="small" style="width:70px" />
            </div>
            <div class="prop-row">
              <span>样式</span>
              <NButtonGroup size="small">
                <NButton :type="(selectedLayer as TextLayer).bold ? 'primary' : 'default'" style="font-weight:bold" @click="(selectedLayer as TextLayer).bold = !(selectedLayer as TextLayer).bold">
                  B
                </NButton>
                <NButton :type="(selectedLayer as TextLayer).italic ? 'primary' : 'default'" style="font-style:italic" @click="(selectedLayer as TextLayer).italic = !(selectedLayer as TextLayer).italic">
                  I
                </NButton>
                <NButton :type="(selectedLayer as TextLayer).underline ? 'primary' : 'default'" style="text-decoration:underline" @click="(selectedLayer as TextLayer).underline = !(selectedLayer as TextLayer).underline">
                  U
                </NButton>
              </NButtonGroup>
            </div>
            <div class="prop-row">
              <span>颜色</span><NColorPicker v-model:value="(selectedLayer as TextLayer).fill" size="small" style="flex:1" />
            </div>
            <div class="prop-row">
              <span>描边</span><NColorPicker v-model:value="(selectedLayer as TextLayer).stroke" size="small" style="flex:1" />
            </div>
            <div class="prop-row">
              <span>描边宽</span><NSlider v-model:value="(selectedLayer as TextLayer).strokeWidth" :min="0" :max="20" style="flex:1" />
            </div>
          </template>
          <template v-if="selectedLayer?.type === 'image'">
            <div class="prop-row">
              <span>透明度</span><NSlider v-model:value="(selectedLayer as ImageLayer).opacity" :min="0" :max="1" :step="0.05" style="flex:1" />
            </div>
            <div class="prop-row">
              <span>描边</span><NColorPicker v-model:value="(selectedLayer as ImageLayer).stroke" size="small" style="flex:1" />
            </div>
            <div class="prop-row">
              <span>描边宽</span><NSlider v-model:value="(selectedLayer as ImageLayer).strokeWidth" :min="0" :max="20" style="flex:1" />
            </div>
            <NButton size="small" block @click="showRemoveBg = true">
              去背景
            </NButton>
          </template>
        </div>
      </div>
    </div>
  </div>
  <RemoveBgDialog :show="showRemoveBg" :source-url="removeBgSourceUrl" @confirm="onRemoveBgConfirm" @cancel="showRemoveBg = false" />
</template>
<style scoped>
.editor-layout {
  display: flex; flex-direction: column;
  height: calc(100vh - 100px); min-height: 500px;
}
.editor-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 12px; border-bottom: 1px solid var(--n-border-color);
  flex-shrink: 0;
}
.editor-body {
  display: flex; flex: 1; min-height: 0; overflow: hidden;
}
.editor-panel {
  width: 220px; flex-shrink: 0; overflow-y: auto;
  border-color: var(--n-border-color); padding: 10px;
  display: flex; flex-direction: column; gap: 4px;
}
.panel-left { border-right: 1px solid var(--n-border-color); }
.panel-right { border-left: 1px solid var(--n-border-color); }
.editor-canvas { flex: 1; min-width: 0; display: flex; }

.panel-section { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--n-border-color); margin-bottom: 8px; }
.panel-section:last-child { border-bottom: none; margin-bottom: 0; }
.panel-header { margin-bottom: 4px; }

.layer-list { display: flex; flex-direction: column; gap: 1px; }
.layer-empty { padding: 12px; text-align: center; }
.layer-item {
  display: flex; align-items: center; gap: 3px;
  padding: 3px 4px; border-radius: 4px; cursor: pointer;
  border: 1px solid transparent; font-size: 12px;
}
.layer-item:hover { background: var(--n-color-embedded); }
.layer-item.active { border-color: var(--primary-color, #18a058); background: color-mix(in srgb, var(--primary-color) 6%, transparent); }
.layer-item.dragging { opacity: 0.4; }
.layer-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }

.props-empty { padding: 12px; text-align: center; }
.prop-row { display: flex; align-items: center; gap: 6px; }
.prop-row > span { font-size: 11px; color: var(--n-text-color-3); width: 40px; flex-shrink: 0; }

@media (max-width: 768px) {
  .editor-body { flex-direction: column; }
  .editor-panel { width: 100%; border: none; border-bottom: 1px solid var(--n-border-color); }
}
</style>
