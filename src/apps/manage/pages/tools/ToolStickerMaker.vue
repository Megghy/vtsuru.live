<script setup lang="ts">
import ImageOutline from '@vicons/ionicons5/es/ImageOutline'
import TextOutline from '@vicons/ionicons5/es/TextOutline'
import TrashOutline from '@vicons/ionicons5/es/TrashOutline'
import { useDropZone, useFileDialog } from '@vueuse/core'
import { saveAs } from 'file-saver'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'

import CanvasEditor from '@/apps/manage/components/tools/CanvasEditor.vue'
import type { EditorLayer, ImageLayer, TextLayer } from '@/apps/manage/components/tools/CanvasEditor.vue'
import RemoveBgDialog from '@/apps/manage/components/tools/RemoveBgDialog.vue'
import { useLocalFonts, markFontUsed } from '@/composables/useLocalFonts'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { trackManageToolSuccess } from '@/shared/services/umami'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useMessage } from '@/shared/utils'

const message = useMessage()
const editorRef = ref<InstanceType<typeof CanvasEditor>>()
const blobSize = ref(0)

const { fontOptions, loadLocalFonts } = useLocalFonts()
const extraFontOptions = computed(() => fontOptions.value.filter((opt) => opt.value !== 'sans-serif'))
onMounted(loadLocalFonts)

function onFontChange(val: string | null) {
  if (!selectedLayer.value || selectedLayer.value.type !== 'text') return
  const next = val || 'sans-serif'
  ;(selectedLayer.value as TextLayer).fontFamily = next
  if (val) markFontUsed(val)
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

onUnmounted(() => {
  if (opts.bgImageUrl) {
    URL.revokeObjectURL(opts.bgImageUrl)
    opts.bgImageUrl = null
  }
})

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
      <CardTitle class="text-base">表情包制作</CardTitle>
      <div class="flex items-center gap-2">
        <span
          v-if="blobSize"
          class="text-xs"
          :class="sizeExceeded ? 'text-destructive font-medium' : 'text-emerald-600'"
        >
          {{ (blobSize / 1024).toFixed(1) }} KB
        </span>
        <Button
          :disabled="!opts.bgImageUrl"
          @click="download"
        >
          下载
        </Button>
      </div>
    </CardHeader>

    <CardContent>
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
          <span class="text-xs text-muted-foreground"> 将作为表情包背景 </span>
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
            <span class="font-medium text-foreground text-sm panel-title"> 设置 </span>
            <SettingRow
              title="尺寸"
              variant="none"
            >
              <NumberField
                v-model="opts.size"
                :min="64"
                :max="512"
                :step="32"
                class="w-24"
              />
            </SettingRow>
            <SettingRow
              title="格式"
              variant="none"
            >
              <Select v-model="opts.format">
                <SelectTrigger class="w-24">
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
            </SettingRow>
            <FormField
              v-if="opts.format === 'jpeg'"
              label="质量"
              :extra="`${Math.round(opts.quality * 100)}%`"
            >
              <Slider
                :model-value="[opts.quality]"
                :min="0.1"
                :max="1"
                :step="0.05"
                @update:model-value="
                  (val) => {
                    if (val?.[0] !== undefined) opts.quality = val[0]
                  }
                "
              />
            </FormField>
            <Button
              variant="outline"
              class="w-full mt-1"
              @click="() => openBgPicker()"
            >
              更换背景图
            </Button>
          </div>

          <!-- Layers -->
          <div class="panel">
            <div class="flex justify-between items-center panel-title">
              <span class="font-medium text-foreground text-sm"> 图层 </span>
              <div class="flex items-center gap-1">
                <Button
                  size="icon-xs"
                  variant="outline"
                  @click="editorRef?.addTextLayer()"
                >
                  <TextOutline class="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="icon-xs"
                  variant="outline"
                  @click="() => openImgPicker()"
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
                <Button
                  size="icon"
                  variant="ghost"
                  class="h-5 w-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  @click.stop="editorRef?.removeLayer(layer.id)"
                >
                  <TrashOutline class="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>

          <!-- Properties -->
          <div class="panel">
            <span class="font-medium text-foreground text-sm panel-title"> 属性 </span>
            <div
              v-if="!selectedLayer"
              class="props-empty"
            >
              <span class="text-xs text-muted-foreground"> 选中图层编辑 </span>
            </div>
            <template v-if="selectedLayer?.type === 'text'">
              <Input v-model="(selectedLayer as TextLayer).text" />
              <SettingRow
                title="字号"
                variant="none"
              >
                <NumberField
                  v-model="(selectedLayer as TextLayer).fontSize"
                  :min="8"
                  :max="120"
                  class="w-24"
                />
              </SettingRow>
              <FormField label="字体">
                <GoogleFontPicker
                  :model-value="(selectedLayer as TextLayer).fontFamily === 'sans-serif' ? null : (selectedLayer as TextLayer).fontFamily"
                  :extra-options="extraFontOptions"
                  :show-preview="false"
                  @update:model-value="onFontChange"
                />
              </FormField>
              <SettingRow
                title="样式"
                variant="none"
              >
                <ToggleGroup
                  type="multiple"
                  size="xs"
                  :model-value="
                    [
                      (selectedLayer as TextLayer).bold ? 'bold' : '',
                      (selectedLayer as TextLayer).italic ? 'italic' : '',
                      (selectedLayer as TextLayer).underline ? 'underline' : '',
                    ].filter(Boolean)
                  "
                  @update:model-value="
                    (val) => {
                      const arr = (val as string[]) || []
                      const l = selectedLayer as TextLayer
                      l.bold = arr.includes('bold')
                      l.italic = arr.includes('italic')
                      l.underline = arr.includes('underline')
                    }
                  "
                >
                  <ToggleGroupItem
                    value="bold"
                    class="px-2.5 font-bold"
                  >
                    B
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="italic"
                    class="px-2.5 italic"
                  >
                    I
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="underline"
                    class="px-2.5 underline"
                  >
                    U
                  </ToggleGroupItem>
                </ToggleGroup>
              </SettingRow>
              <SettingRow
                title="颜色"
                variant="none"
              >
                <ColorPicker
                  v-model="(selectedLayer as TextLayer).fill"
                  class="w-28"
                />
              </SettingRow>
              <SettingRow
                title="描边"
                variant="none"
              >
                <ColorPicker
                  v-model="(selectedLayer as TextLayer).stroke"
                  class="w-28"
                />
              </SettingRow>
              <FormField
                label="描边宽"
                :extra="(selectedLayer as TextLayer).strokeWidth"
              >
                <Slider
                  :model-value="[(selectedLayer as TextLayer).strokeWidth]"
                  :min="0"
                  :max="10"
                  @update:model-value="
                    (val) => {
                      if (val?.[0] !== undefined) (selectedLayer as TextLayer).strokeWidth = val[0]
                    }
                  "
                />
              </FormField>
            </template>
            <template v-if="selectedLayer?.type === 'image'">
              <FormField
                label="透明度"
                :extra="`${Math.round((selectedLayer as ImageLayer).opacity * 100)}%`"
              >
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).opacity]"
                  :min="0"
                  :max="1"
                  :step="0.05"
                  @update:model-value="
                    (val) => {
                      if (val?.[0] !== undefined) (selectedLayer as ImageLayer).opacity = val[0]
                    }
                  "
                />
              </FormField>
              <SettingRow
                title="描边"
                variant="none"
              >
                <ColorPicker
                  v-model="(selectedLayer as ImageLayer).stroke"
                  class="w-28"
                />
              </SettingRow>
              <FormField
                label="描边宽"
                :extra="(selectedLayer as ImageLayer).strokeWidth"
              >
                <Slider
                  :model-value="[(selectedLayer as ImageLayer).strokeWidth]"
                  :min="0"
                  :max="10"
                  @update:model-value="
                    (val) => {
                      if (val?.[0] !== undefined) (selectedLayer as ImageLayer).strokeWidth = val[0]
                    }
                  "
                />
              </FormField>
              <Button
                variant="outline"
                class="w-full mt-1"
                @click="showRemoveBg = true"
              >
                去背景
              </Button>
            </template>
          </div>
        </div>
      </template>
    </CardContent>

    <RemoveBgDialog
      :show="showRemoveBg"
      :source-url="removeBgSourceUrl"
      @confirm="onRemoveBgConfirm"
      @cancel="showRemoveBg = false"
    />
  </Card>
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
</style>
