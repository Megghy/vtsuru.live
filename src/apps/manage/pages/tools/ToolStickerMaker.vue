<script setup lang="ts">
import { saveAs } from 'file-saver'
import { NButton, NButtonGroup, NCard, NColorPicker, NFlex, NIcon, NInput, NInputNumber, NSelect, NSlider, NText } from 'naive-ui'
import { computed, onMounted, reactive, ref } from 'vue'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { ImageOutline, TextOutline, TrashOutline } from '@vicons/ionicons5'
import CanvasEditor from '@/apps/manage/components/tools/CanvasEditor.vue'
import type { EditorLayer, ImageLayer, TextLayer } from '@/apps/manage/components/tools/CanvasEditor.vue'
import RemoveBgDialog from '@/apps/manage/components/tools/RemoveBgDialog.vue'
import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'

const message = useMessage()
const editorRef = ref<InstanceType<typeof CanvasEditor>>()
const blobSize = ref(0)

const { fontOptions, loading: fontsLoading, loadLocalFonts } = useLocalFonts()
onMounted(loadLocalFonts)

function onFontChange(val: string) {
  if (!selectedLayer.value || selectedLayer.value.type !== 'text') return
  ;(selectedLayer.value as TextLayer).fontFamily = val
  markFontUsed(val)
}

const opts = reactive({
  size: 300,
  format: 'png' as 'png' | 'jpeg',
  quality: 0.92,
  bgColor: '#ffffff',
  bgImageUrl: null as string | null,
})

const formatOptions = [
  { label: 'PNG', value: 'png' },
  { label: 'JPEG', value: 'jpeg' },
]

const dropRef = ref<HTMLElement>()
const { isOverDropZone } = useDropZone(dropRef, { onDrop: files => files?.[0] && loadBg(files[0]) })
const { open: openBgPicker, onChange: onBgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onBgChange(files => files?.[0] && loadBg(files[0]))

const { open: openImgPicker, onChange: onImgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onImgChange(files => { if (files?.[0]) editorRef.value?.addImageLayer(files[0]) })

function loadBg(file: File) {
  if (opts.bgImageUrl) URL.revokeObjectURL(opts.bgImageUrl)
  opts.bgImageUrl = URL.createObjectURL(file)
}

const selectedLayer = computed<EditorLayer | null>(() => {
  if (!editorRef.value?.selectedId) return null
  return editorRef.value.layers.find(l => l.id === editorRef.value!.selectedId) ?? null
})

const sizeExceeded = computed(() => blobSize.value > 1024 * 1024)

const dragLayerId = ref<string | null>(null)
function onDragStart(id: string) { dragLayerId.value = id }
function onDragOver(e: DragEvent) { e.preventDefault() }
function onDrop(id: string) {
  if (dragLayerId.value && dragLayerId.value !== id) editorRef.value?.reorderLayer(dragLayerId.value, id)
  dragLayerId.value = null
}

async function download() {
  if (!editorRef.value) return
  const mime = opts.format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const blob = await editorRef.value.exportImage(mime, opts.format === 'jpeg' ? opts.quality : undefined)
  blobSize.value = blob.size
  saveAs(blob, `sticker-${Date.now()}.${opts.format === 'jpeg' ? 'jpg' : 'png'}`)
  message.success('已下载')
}

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
  <NCard title="表情包制作">
    <template #header-extra>
      <NFlex :size="8" align="center">
        <NText v-if="blobSize" :type="sizeExceeded ? 'error' : 'success'" style="font-size:12px">
          {{ (blobSize / 1024).toFixed(1) }} KB
        </NText>
        <NButton type="primary" :disabled="!opts.bgImageUrl" @click="download">
          下载
        </NButton>
      </NFlex>
    </template>

    <!-- Upload or Canvas -->
    <div v-if="!opts.bgImageUrl" ref="dropRef" class="drop-zone" :class="{ active: isOverDropZone }" @click="() => openBgPicker()">
      <NFlex vertical align="center" :size="8">
        <NIcon :component="ImageOutline" size="36" />
        <NText>拖拽或点击上传源图片</NText>
        <NText depth="3" style="font-size:12px">
          将作为表情包背景
        </NText>
      </NFlex>
    </div>

    <template v-else>
      <CanvasEditor
        ref="editorRef"
        :width="opts.size"
        :height="opts.size"
        :background-color="opts.bgColor"
        :background-image="opts.bgImageUrl"
        storage-key="tool-sticker-maker"
      />

      <!-- Panels -->
      <div class="panels">
        <!-- Settings -->
        <div class="panel">
          <NText strong class="panel-title">
            设置
          </NText>
          <div class="prop-row">
            <span>尺寸</span><NInputNumber v-model:value="opts.size" :min="64" :max="512" :step="32" size="small" style="flex:1" />
          </div>
          <div class="prop-row">
            <span>格式</span><NSelect v-model:value="opts.format" :options="formatOptions" size="small" style="flex:1" />
          </div>
          <div v-if="opts.format === 'jpeg'" class="prop-row">
            <span>质量</span><NSlider v-model:value="opts.quality" :min="0.1" :max="1" :step="0.05" style="flex:1" />
          </div>
          <NButton size="small" tertiary block @click="() => openBgPicker()">
            更换背景图
          </NButton>
        </div>

        <!-- Layers -->
        <div class="panel">
          <NFlex justify="space-between" align="center" class="panel-title">
            <NText strong>
              图层
            </NText>
            <NFlex :size="4">
              <NButton size="tiny" @click="editorRef?.addTextLayer()">
                <template #icon>
                  <NIcon :component="TextOutline" size="14" />
                </template>
              </NButton>
              <NButton size="tiny" @click="() => openImgPicker()">
                <template #icon>
                  <NIcon :component="ImageOutline" size="14" />
                </template>
              </NButton>
            </NFlex>
          </NFlex>
          <div class="layer-list">
            <div
              v-for="layer in [...(editorRef?.layers ?? [])].reverse()"
              :key="layer.id"
              class="layer-item"
              :class="{ active: editorRef?.selectedId === layer.id, dragging: dragLayerId === layer.id }"
              draggable="true"
              @dragstart="onDragStart(layer.id)"
              @dragover="onDragOver($event)"
              @drop="onDrop(layer.id)"
              @click="() => { if (editorRef) editorRef.selectedId = layer.id }"
            >
              <NIcon :component="layer.type === 'text' ? TextOutline : ImageOutline" size="13" />
              <NText style="font-size:12px; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">
                {{ layer.name }}
              </NText>
              <NButton size="tiny" quaternary type="error" @click.stop="editorRef?.removeLayer(layer.id)">
                <template #icon>
                  <NIcon :component="TrashOutline" size="12" />
                </template>
              </NButton>
            </div>
          </div>
        </div>

        <!-- Properties -->
        <div class="panel">
          <NText strong class="panel-title">
            属性
          </NText>
          <div v-if="!selectedLayer" class="props-empty">
            <NText depth="3" style="font-size:12px">
              选中图层编辑
            </NText>
          </div>
          <template v-if="selectedLayer?.type === 'text'">
            <NInput v-model:value="(selectedLayer as TextLayer).text" size="small" />
            <div class="prop-row">
              <span>字号</span><NInputNumber v-model:value="(selectedLayer as TextLayer).fontSize" :min="8" :max="120" size="small" style="width:70px" />
            </div>
            <div class="prop-row">
              <span>字体</span><NSelect :value="(selectedLayer as TextLayer).fontFamily" :options="fontOptions" :loading="fontsLoading" filterable size="small" style="flex:1" @update:value="onFontChange" />
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
              <span>描边宽</span><NSlider v-model:value="(selectedLayer as TextLayer).strokeWidth" :min="0" :max="10" style="flex:1" />
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
              <span>描边宽</span><NSlider v-model:value="(selectedLayer as ImageLayer).strokeWidth" :min="0" :max="10" style="flex:1" />
            </div>
            <NButton size="small" block @click="showRemoveBg = true">
              去背景
            </NButton>
          </template>
        </div>
      </div>
    </template>
  </NCard>
  <RemoveBgDialog :show="showRemoveBg" :source-url="removeBgSourceUrl" @confirm="onRemoveBgConfirm" @cancel="showRemoveBg = false" />
</template>

<style scoped>
.drop-zone {
  min-height: 300px; display: flex; align-items: center; justify-content: center;
  border: 2px dashed var(--n-border-color); border-radius: 12px; cursor: pointer;
  transition: border-color 0.2s;
}
.drop-zone:hover, .drop-zone.active { border-color: var(--primary-color, #18a058); }

.panels { display: grid; grid-template-columns: 180px 1fr 200px; gap: 12px; margin-top: 14px; }
@media (max-width: 768px) { .panels { grid-template-columns: 1fr; } }

.panel {
  display: flex; flex-direction: column; gap: 8px;
  padding: 10px; border: 1px solid var(--n-border-color);
  border-radius: 8px; background: var(--n-color-embedded);
}
.panel-title { font-size: 13px; margin-bottom: 2px; }

.layer-list { display: flex; flex-direction: column; gap: 2px; }
.layer-item {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; border-radius: 4px; cursor: pointer;
  border: 1px solid transparent;
}
.layer-item:hover { background: rgba(0,0,0,0.03); }
.layer-item.active { border-color: var(--primary-color, #18a058); }
.layer-item.dragging { opacity: 0.4; }

.props-empty { padding: 12px; text-align: center; }
.prop-row { display: flex; align-items: center; gap: 6px; }
.prop-row > span { font-size: 11px; color: var(--n-text-color-3); width: 40px; flex-shrink: 0; }
</style>
