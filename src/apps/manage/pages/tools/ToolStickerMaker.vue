<script setup lang="ts">
import { ImageOutline, TextOutline, TrashOutline } from '@vicons/ionicons5'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onMounted, reactive, ref } from 'vue'

import CanvasEditor from '@/apps/manage/components/tools/CanvasEditor.vue'
import type { EditorLayer, ImageLayer, TextLayer } from '@/apps/manage/components/tools/CanvasEditor.vue'
import RemoveBgDialog from '@/apps/manage/components/tools/RemoveBgDialog.vue'
import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { useMessage } from '@/shared/utils'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Slider } from '@/shared/ui/slider'

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
const { isOverDropZone } = useDropZone(dropRef, { onDrop: (files) => files?.[0] && loadBg(files[0]) })
const { open: openBgPicker, onChange: onBgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onBgChange((files) => files?.[0] && loadBg(files[0]))

const { open: openImgPicker, onChange: onImgChange } = useFileDialog({ accept: 'image/*', multiple: false })
onImgChange((files) => {
  if (files?.[0]) editorRef.value?.addImageLayer(files[0])
})

function loadBg(file: File) {
  if (opts.bgImageUrl) URL.revokeObjectURL(opts.bgImageUrl)
  opts.bgImageUrl = URL.createObjectURL(file)
}

const selectedLayer = computed<EditorLayer | null>(() => {
  if (!editorRef.value?.selectedId) return null
  return editorRef.value.layers.find((l) => l.id === editorRef.value!.selectedId) ?? null
})

const sizeExceeded = computed(() => blobSize.value > 1024 * 1024)

const dragLayerId = ref<string | null>(null)
function onDragStart(id: string) {
  dragLayerId.value = id
}
function onDragOver(e: DragEvent) {
  e.preventDefault()
}
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
  trackManageToolSuccess('StickerMaker', 'download', {
    format: opts.format,
    bytes: blob.size,
  })
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
  trackManageToolSuccess('StickerMaker', 'remove-bg')
  message.success('已替换')
}
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <CardTitle class="text-base font-semibold">表情包制作</CardTitle>
      <div class="flex items-center gap-2">
        <span
          v-if="blobSize"
          class="text-xs"
          :class="sizeExceeded ? 'text-destructive font-medium' : 'text-emerald-600'"
        >
          {{ (blobSize / 1024).toFixed(1) }} KB
        </span>
        <Button :disabled="!opts.bgImageUrl" @click="download">
          下载
        </Button>
      </div>
    </CardHeader>

    <CardContent class="pt-0">
      <!-- Upload or Canvas -->
      <div
        v-if="!opts.bgImageUrl"
        ref="dropRef"
        class="drop-zone"
        :class="{ active: isOverDropZone }"
        @click="() => openBgPicker()"
      >
        <div class="flex flex-col items-center gap-2">
          <ImageOutline class="w-9 h-9 text-muted-foreground" />
          <span class="text-sm font-medium">拖拽或点击上传源图片</span>
          <span class="text-xs text-muted-foreground">
            将作为表情包背景
          </span>
        </div>
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
            <span class="font-medium text-foreground text-sm panel-title">
              设置
            </span>
            <div class="prop-row">
              <span>尺寸</span>
              <NInputNumber
                v-model="opts.size"
                :min="64"
                :max="512"
                :step="32"
                size="small"
                class="flex-1"
              />
            </div>
            <div class="prop-row">
              <span>格式</span>
              <Select v-model="opts.format">
                <SelectTrigger class="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="item in formatOptions"
                    :key="item.value"
                    :value="item.value"
                  >
                    {{ item.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div
              v-if="opts.format === 'jpeg'"
              class="prop-row"
            >
              <span>质量</span>
              <Slider
                :model-value="[opts.quality]"
                :min="0.1"
                :max="1"
                :step="0.05"
                class="flex-1"
                @update:model-value="(val) => { if (val?.[0] !== undefined) opts.quality = val[0] }"
              />
            </div>
            <Button variant="outline" class="w-full mt-1" @click="() => openBgPicker()"
            >
              更换背景图
            </Button>
          </div>

          <!-- Layers -->
          <div class="panel">
            <div class="flex justify-between items-center panel-title">
              <span class="font-medium text-foreground text-sm"> 图层 </span>
              <div class="flex items-center gap-1">
                <Button size="icon" variant="outline" class="h-6 w-6" @click="editorRef?.addTextLayer()">
                  <TextOutline class="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="outline" class="h-6 w-6" @click="() => openImgPicker()"
                >
                  <ImageOutline class="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
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
                @click="
                  () => {
                    if (editorRef) editorRef.selectedId = layer.id
                  }
                "
              >
                <TextOutline
                  v-if="layer.type === 'text'"
                  class="w-3.5 h-3.5 shrink-0"
                />
                <ImageOutline
                  v-else
                  class="w-3.5 h-3.5 shrink-0"
                />
                <span class="text-xs flex-1 truncate">
                  {{ layer.name }}
                </span>
                <Button size="icon" variant="ghost" class="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10" @click.stop="editorRef?.removeLayer(layer.id)">
                  <TrashOutline class="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Properties -->
          <div class="panel">
            <span class="font-medium text-foreground text-sm panel-title">
              属性
            </span>
            <div
              v-if="!selectedLayer"
              class="props-empty"
            >
              <span class="text-xs text-muted-foreground">
                选中图层编辑
              </span>
            </div>
            <template v-if="selectedLayer?.type === 'text'">
              <Input v-model="(selectedLayer as TextLayer).text" />
              <div class="prop-row">
                <span>字号</span>
                <NInputNumber
                  v-model="(selectedLayer as TextLayer).fontSize"
                  :min="8"
                  :max="120"
                  size="small"
                  class="w-[70px]"
                />
              </div>
              <div class="prop-row">
                <span>字体</span>
                <Select
                  :model-value="(selectedLayer as TextLayer).fontFamily"
                  @update:model-value="onFontChange"
                >
                  <SelectTrigger class="flex-1">
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
              <div class="prop-row">
                <span>样式</span>
                <div class="inline-flex rounded-md shadow-xs border border-input overflow-hidden">
                  <button
                    type="button"
                    class="h-7 px-2.5 text-xs font-bold transition-colors border-r border-input last:border-r-0 cursor-pointer"
                    :class="(selectedLayer as TextLayer).bold ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'"
                    @click="(selectedLayer as TextLayer).bold = !(selectedLayer as TextLayer).bold"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    class="h-7 px-2.5 text-xs italic transition-colors border-r border-input last:border-r-0 cursor-pointer"
                    :class="(selectedLayer as TextLayer).italic ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'"
                    @click="(selectedLayer as TextLayer).italic = !(selectedLayer as TextLayer).italic"
                  >
                    I
                  </button>
                  <button
                    type="button"
                    class="h-7 px-2.5 text-xs underline transition-colors cursor-pointer"
                    :class="(selectedLayer as TextLayer).underline ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'"
                    @click="(selectedLayer as TextLayer).underline = !(selectedLayer as TextLayer).underline"
                  >
                    U
                  </button>
                </div>
              </div>
              <div class="prop-row">
                <span>颜色</span>
                <ColorPicker
                  v-model="(selectedLayer as TextLayer).fill"
                  class="flex-1"
                />
              </div>
              <div class="prop-row">
                <span>描边</span>
                <ColorPicker
                  v-model="(selectedLayer as TextLayer).stroke"
                  class="flex-1"
                />
              </div>
              <div class="prop-row">
                <span>描边宽</span>
                <Slider
                  :model-value="[(selectedLayer as TextLayer).strokeWidth]"
                  :min="0"
                  :max="10"
                  class="flex-1"
                  @update:model-value="(val) => { if (val?.[0] !== undefined) (selectedLayer as TextLayer).strokeWidth = val[0] }"
                />
              </div>
            </template>
            <template v-if="selectedLayer?.type === 'image'">
              <div class="prop-row">
                <span>透明度</span>
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).opacity]"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  class="flex-1"
                  @update:model-value="(val) => { if (val?.[0] !== undefined) (selectedLayer as ImageLayer).opacity = val[0] }"
                />
              </div>
              <div class="prop-row">
                <span>描边</span>
                <ColorPicker
                  v-model="(selectedLayer as ImageLayer).stroke"
                  class="flex-1"
                />
              </div>
              <div class="prop-row">
                <span>描边宽</span>
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).strokeWidth]"
                  :min="0"
                  :max="10"
                  class="flex-1"
                  @update:model-value="(val) => { if (val?.[0] !== undefined) (selectedLayer as ImageLayer).strokeWidth = val[0] }"
                />
              </div>
              <Button variant="outline" class="w-full mt-1" @click="showRemoveBg = true">
                去背景
              </Button>
            </template>
          </div>
        </div>
      </template>
    </CardContent>
  </Card>

  <RemoveBgDialog
    :show="showRemoveBg"
    :source-url="removeBgSourceUrl"
    @confirm="onRemoveBgConfirm"
    @cancel="showRemoveBg = false"
  />
</template>

<style scoped>
.drop-zone {
  min-height: 300px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--border);
  border-radius: 12px;
  cursor: pointer;
  transition: border-color 0.2s;
}
.drop-zone:hover,
.drop-zone.active {
  border-color: var(--primary-color, #18a058);
}

.panels {
  display: grid;
  grid-template-columns: 180px 1fr 200px;
  gap: 12px;
  margin-top: 14px;
}
@media (max-width: 768px) {
  .panels {
    grid-template-columns: 1fr;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted);
}
.panel-title {
  margin-bottom: 2px;
}

.layer-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.layer-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
  border: 1px solid transparent;
}
.layer-item:hover {
  background: rgba(0, 0, 0, 0.03);
}
.layer-item.active {
  border-color: var(--primary-color, #18a058);
}
.layer-item.dragging {
  opacity: 0.4;
}

.props-empty {
  padding: 12px;
  text-align: center;
}
.prop-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.prop-row > span {
  font-size: 11px;
  color: var(--muted-foreground);
  width: 40px;
  flex-shrink: 0;
}
</style>
