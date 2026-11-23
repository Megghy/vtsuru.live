<script setup lang="ts">
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  Copy,
  FolderInput,
  FolderOpen,
  FolderOutput,
  Group,
  Maximize2,
  Settings2,
  Trash2,
  Ungroup,
  Upload,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { uploadObsSceneAsset } from '@/api/obs-scene'
import { controllerBodies } from '@/apps/obs-store/data/gamepadConfigs'
import { getObsComponentById } from '@/apps/obs-store/registry'
import GoogleFontPicker from '@/shared/components/GoogleFontPicker.vue'
import { SYSTEM_CHINESE_FONT_OPTIONS } from '@/shared/questionDisplayPresets'
import type { RpcObsFilterCapabilities, RpcObsSceneItemRef, RpcVtsStatus } from '@/shared/rpc/contract'
import type { GamepadType } from '@/types/gamepad'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { ColorPicker } from '@/shared/ui/color-picker'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { ScrollArea } from '@/shared/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsSceneTransition, WidgetConfigMode } from '../types'
import { CANVAS_PRESETS, formatCleanWidgetName, isBridgeWidget, isSafeHttpUrl } from '../types'
import { isLayerInGlobalScope } from '../utils/groupTree'
import { getMaskShapePreset } from '../utils/maskShapes'
import SceneExtraLayerInspector from './SceneExtraLayerInspector.vue'
import SceneHelpTip from './SceneHelpTip.vue'
import SceneMaskShapePicker from './SceneMaskShapePicker.vue'
import SceneObsModuleInspector from './SceneObsModuleInspector.vue'
import SceneObsNativeFilterPanel from './SceneObsNativeFilterPanel.vue'
import SceneObsSourceInspector from './SceneObsSourceInspector.vue'
import SceneVfxInspector from './SceneVfxInspector.vue'

const props = defineProps<{
  obsScenes: string[]
  obsConnected?: boolean
  obsSceneItems?: RpcObsSceneItemRef[]
  vtsStatus?: RpcVtsStatus | null
  filterCapabilities?: RpcObsFilterCapabilities
}>()

const emit = defineEmits<{
  openWidgetConfig: [layerId: string]
  openQuestionDisplayConfig: [layerId: string]
  openDanmujiConfig: [layerId: string]
  refreshObsSources: []
  captureSourcePreview: [sourceName: string]
  syncLayoutToObs: []
  syncSceneFilters: []
  syncSourceFilters: [layerId: string]
  refreshFilterCapabilities: []
  testVtsAction: [layerId: string]
  openObsLink: []
  openSetupGuide: [tab: 'obs-layout' | 'model-capture']
}>()

const store = useObsSceneEditorStore()
const uploadingImage = ref(false)
const switchingConfigMode = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
const advancedPanels = ref<string[]>([])

const layer = computed(() => store.selectedLayer)
const maskShapeSummary = computed(() => {
  if (!layer.value) return ''
  const preset = getMaskShapePreset(layer.value.maskShape)
  const radius = layer.value.borderRadius ?? 0
  if (preset.supportsRadius && radius > 0) {
    return `${preset.label} · ${radius}px`
  }
  return preset.label
})
const obsModuleLayer = computed(() => (layer.value?.type === 'obs-module' ? layer.value : null))
const obsSourceLayer = computed(() => (layer.value?.type === 'obs-source' ? layer.value : null))
const vfxLayer = computed(() => (layer.value?.type === 'vfx' ? layer.value : null))
const extraLayer = computed(() =>
  layer.value && (layer.value.type === 'marquee' || layer.value.type === 'slideshow')
    ? layer.value
    : null,
)
const supportsShadowToggle = computed(() => {
  const t = layer.value?.type
  return t === 'vtsuru-widget' || t === 'obs-module' || t === 'text' || t === 'marquee'
})
const DEFAULT_SCENE_FONT_FAMILY = 'system-ui, -apple-system, sans-serif'

const textFontValue = computed(() => {
  if (layer.value?.type !== 'text') return null
  const value = layer.value.text.fontFamily?.trim()
  return !value || value === DEFAULT_SCENE_FONT_FAMILY ? null : value
})

function updateTextFont(value: string | null) {
  if (layer.value?.type !== 'text') return
  layer.value.text.fontFamily = value || DEFAULT_SCENE_FONT_FAMILY
  store.pushHistory()
}

const imageLayer = computed(() => (layer.value?.type === 'image' ? layer.value : null))
const videoLayer = computed(() => (layer.value?.type === 'video' ? layer.value : null))
const iframeLayer = computed(() => (layer.value?.type === 'iframe' ? layer.value : null))
const groupLayer = computed(() => (layer.value?.type === 'group' ? layer.value : null))
const activeScene = computed(() => store.activeScene)

const isGlobalLayer = computed(() => {
  if (!layer.value) return false
  return isLayerInGlobalScope(store.doc, layer.value.id)
})

const widgetDef = computed(() => {
  if (!layer.value || layer.value.type !== 'vtsuru-widget') return null
  return getObsComponentById(layer.value.widget.componentId) ?? null
})

const gamepadBodyOptions = computed(() => {
  if (!layer.value || layer.value.type !== 'vtsuru-widget' || layer.value.widget.componentId !== 'gamepad') {
    return []
  }
  const gpType = layer.value.widget.gamepadParams?.type ?? 'xbox'
  return controllerBodies[gpType] ?? []
})

const activeGamepadBodyId = computed(() => {
  if (!layer.value || layer.value.type !== 'vtsuru-widget' || !layer.value.widget.gamepadParams) return ''
  const current = layer.value.widget.gamepadParams.bodyId
  if (gamepadBodyOptions.value.some((b) => b.id === current)) return current
  return gamepadBodyOptions.value[0]?.id ?? ''
})

function onGamepadTypeChange(val: unknown) {
  if (!layer.value || layer.value.type !== 'vtsuru-widget' || !layer.value.widget.gamepadParams) return
  const nextType: GamepadType = val === 'ps' || val === 'nintendo' ? val : 'xbox'
  layer.value.widget.gamepadParams.type = nextType
  layer.value.widget.gamepadParams.bodyId = controllerBodies[nextType]?.[0]?.id ?? ''
  layer.value.widget.gamepadParams.viewBox = ''
  store.pushHistory()
}

function onGamepadBodyChange(val: unknown) {
  if (!layer.value || layer.value.type !== 'vtsuru-widget' || !layer.value.widget.gamepadParams) return
  layer.value.widget.gamepadParams.bodyId = String(val ?? '')
  layer.value.widget.gamepadParams.viewBox = ''
  store.pushHistory()
}

const canvasPresetValue = computed(() => `${store.doc.canvas.width}x${store.doc.canvas.height}`)

function onSelectCanvasPreset(val: unknown) {
  const str = String(val ?? '')
  const [w, h] = str.split('x').map(Number)
  if (w > 0 && h > 0) {
    store.setCanvasSize(w, h)
  }
}

function centerLayerHorizontal() {
  if (!layer.value) return
  const containerW = store.selectedParentGroup?.width ?? store.doc.canvas.width
  store.updateLayer(layer.value.id, {
    x: Math.round((containerW - layer.value.width) / 2),
  })
}

function centerLayerVertical() {
  if (!layer.value) return
  const containerH = store.selectedParentGroup?.height ?? store.doc.canvas.height
  store.updateLayer(layer.value.id, {
    y: Math.round((containerH - layer.value.height) / 2),
  })
}

function fitLayerToCanvas() {
  if (!layer.value) return
  const containerW = store.selectedParentGroup?.width ?? store.doc.canvas.width
  const containerH = store.selectedParentGroup?.height ?? store.doc.canvas.height
  store.updateLayer(layer.value.id, {
    x: 0,
    y: 0,
    width: containerW,
    height: containerH,
    rotation: 0,
  })
}

async function handleWidgetConfigModeChange(val: unknown) {
  if (!layer.value || layer.value.type !== 'vtsuru-widget') return
  const mode = val === 'isolated' ? 'isolated' : 'shared'
  if (mode === layer.value.widget.configMode) return
  switchingConfigMode.value = true
  try {
    await store.setWidgetConfigMode(layer.value.id, mode as WidgetConfigMode)
  } finally {
    switchingConfigMode.value = false
  }
}

function onSharedChannelCommit(e: Event) {
  if (!layer.value || layer.value.type !== 'vtsuru-widget') return
  const raw = (e.target as HTMLInputElement).value.trim()
  const next = /^[a-zA-Z0-9_-]{1,64}$/.test(raw) ? raw : 'default'
  layer.value.widget.channelId = next
  store.pushHistory()
}

function triggerImageUpload() {
  fileInputRef.value?.click()
}

async function handleImageFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || !layer.value || layer.value.type !== 'image') return

  uploadingImage.value = true
  try {
    const asset = await uploadObsSceneAsset(file)
    layer.value.image.url = asset.url
    if (asset.width > 0 && asset.height > 0) {
      const scale = Math.min(1, (store.doc.canvas.width * 0.5) / asset.width, (store.doc.canvas.height * 0.5) / asset.height)
      layer.value.width = Math.max(48, Math.round(asset.width * scale))
      layer.value.height = Math.max(48, Math.round(asset.height * scale))
    }
    store.pushHistory()
    toast.success('图片素材上传成功')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '上传图片失败')
  } finally {
    uploadingImage.value = false
  }
}

const opacitySlider = computed<number[]>({
  get: () => [Math.round((layer.value?.opacity ?? 1) * 100)],
  set: (v) => {
    if (!layer.value) return
    layer.value.opacity = Math.min(1, Math.max(0, (v[0] ?? 100) / 100))
  },
})

function updateSceneBinding(val: unknown) {
  if (!activeScene.value) return
  const str = String(val ?? '')
  store.updateSceneMeta(activeScene.value.id, {
    obsSceneBinding: str === '__none__' ? '' : str,
  })
}

function updateSceneTransition(val: unknown) {
  if (!activeScene.value) return
  store.updateSceneMeta(activeScene.value.id, {
    transition: String(val ?? 'fade') as ObsSceneTransition,
  })
}
</script>

<template>
  <div class="h-full w-full min-w-0 flex flex-col bg-card border-l border-border overflow-hidden">
    <div class="flex-between px-3 py-2 border-b border-border shrink-0 gap-2">
      <span class="text-xs font-semibold text-foreground whitespace-nowrap truncate">
        {{ layer ? '图层属性' : store.selectedLayerIds.length > 1 ? `已选中 ${store.selectedLayerIds.length} 个图层` : '画布与场景设置' }}
      </span>
      <div v-if="layer" class="flex items-center gap-1">
        <Button variant="ghost" size="xs" title="复制图层 (Ctrl+D)" @click="store.duplicateLayer(layer.id)">
          <Copy class="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="xs" title="删除图层 (Delete)" @click="store.deleteLayers([layer.id])">
          <Trash2 class="w-3.5 h-3.5 text-destructive" />
        </Button>
      </div>
    </div>

    <ScrollArea class="flex-1 min-w-0 [&_[data-reka-scroll-area-viewport]>div]:!block">
      <!-- 未选中单图层：画布与当前子场景设置 -->
      <div v-if="!layer" class="p-3 space-y-4">
        <div v-if="store.selectedLayerIds.length > 1" class="rounded-md border border-border bg-muted/40 p-3 space-y-2.5">
          <div class="text-xs font-medium text-foreground">
            已多选 {{ store.selectedLayerIds.length }} 个图层
          </div>
          <Button
            v-if="store.canGroupSelected"
            variant="default"
            size="xs"
            class="w-full"
            @click="store.groupSelectedLayers()"
          >
            <Group class="w-3.5 h-3.5" />
            <span>合并为组 (Ctrl+G)</span>
          </Button>
          <div class="grid grid-cols-6 gap-1">
            <Button variant="outline" size="xs" class="px-0" title="左对齐" @click="store.alignSelectedLayers('left')">
              <AlignStartVertical class="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="xs" class="px-0" title="水平居中" @click="store.alignSelectedLayers('center-x')">
              <AlignCenterVertical class="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="xs" class="px-0" title="右对齐" @click="store.alignSelectedLayers('right')">
              <AlignEndVertical class="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="xs" class="px-0" title="顶对齐" @click="store.alignSelectedLayers('top')">
              <AlignStartHorizontal class="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="xs" class="px-0" title="垂直居中" @click="store.alignSelectedLayers('center-y')">
              <AlignCenterHorizontal class="w-3.5 h-3.5" />
            </Button>
            <Button variant="outline" size="xs" class="px-0" title="底对齐" @click="store.alignSelectedLayers('bottom')">
              <AlignEndHorizontal class="w-3.5 h-3.5" />
            </Button>
          </div>
          <Button variant="destructive" size="xs" class="w-full" @click="store.deleteLayers([...store.selectedLayerIds])">
            <Trash2 class="w-3.5 h-3.5" />
            <span>删除选中图层</span>
          </Button>
        </div>

        <section class="space-y-3">
          <div class="flex items-center gap-1 text-xs font-semibold text-foreground">
            <span>画布分辨率</span>
            <SceneHelpTip text="建议与 OBS「设置 → 视频 → 基础(画布)分辨率」保持一致，默认 1920×1080。" />
          </div>
          <Select :model-value="canvasPresetValue" @update:model-value="onSelectCanvasPreset">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="自定义分辨率" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="p in CANVAS_PRESETS" :key="`${p.width}x${p.height}`" :value="`${p.width}x${p.height}`">
                {{ p.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <div class="grid grid-cols-2 gap-2">
            <FormField label="宽度 (px)" class="min-w-0">
              <NumberField
                :model-value="store.doc.canvas.width"
                :min="320"
                :max="3840"
                @update:model-value="(v) => v && store.setCanvasSize(v, store.doc.canvas.height)"
              />
            </FormField>
            <FormField label="高度 (px)" class="min-w-0">
              <NumberField
                :model-value="store.doc.canvas.height"
                :min="240"
                :max="2160"
                @update:model-value="(v) => v && store.setCanvasSize(store.doc.canvas.width, v)"
              />
            </FormField>
          </div>

          <FormField
            label="编辑预览底色"
            hint="仅用于在编辑器画布中方便看清浅色或半透明元素，OBS 实际播出背景恒为透明。"
          >
            <ColorPicker
              :model-value="store.doc.canvas.background || ''"
              @update:model-value="(v) => store.setCanvasBackground(v)"
            />
          </FormField>
        </section>

        <Separator />

        <section v-if="activeScene" class="space-y-3">
          <div class="text-xs font-semibold text-foreground truncate">当前子场景：{{ activeScene.name }}</div>

          <FormField
            label="切场过渡动效"
            hint="在多个子场景之间切换时，OBS 播出页面自动播放的 GPU 进出场过渡动画。"
          >
            <Select :model-value="activeScene.transition" @update:model-value="updateSceneTransition">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">无过渡（瞬切）</SelectItem>
                <SelectItem value="fade">淡入淡出 (Fade)</SelectItem>
                <SelectItem value="slide-up">上滑渐显 (Slide Up)</SelectItem>
                <SelectItem value="scale">轻量缩放 (Scale)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="绑定本地 OBS 场景"
            hint="填写或选择本地 OBS 中的同名场景。开启切场自动联动后，本地 OBS 切到该场景时云端 Overlay 会自动切换到本子场景。"
          >
            <Select
              v-if="props.obsScenes.length > 0"
              :model-value="activeScene.obsSceneBinding || '__none__'"
              @update:model-value="updateSceneBinding"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="不绑定" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不绑定</SelectItem>
                <SelectItem v-for="s in props.obsScenes" :key="s" :value="s">
                  {{ s }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              :model-value="activeScene.obsSceneBinding ?? ''"
              placeholder="输入本地 OBS 场景名，或先连接本地 OBS"
              @change="(e: Event) => store.updateSceneMeta(activeScene!.id, { obsSceneBinding: (e.target as HTMLInputElement).value })"
            />
          </FormField>
        </section>

        <template v-if="activeScene">
          <Separator />
          <SceneObsNativeFilterPanel
            scope="scene"
            :target-name="activeScene.obsSceneBinding || undefined"
            :model-value="activeScene.obsFilters"
            :obs-connected="Boolean(props.obsConnected)"
            :filter-capabilities="props.filterCapabilities"
            @update:model-value="(val) => { activeScene!.obsFilters = val }"
            @commit="store.pushHistory()"
            @sync-now="emit('syncSceneFilters')"
            @refresh-capabilities="emit('refreshFilterCapabilities')"
            @open-obs-link="emit('openObsLink')"
          />
        </template>
      </div>

      <!-- 选中单图层属性面板 -->
      <div v-else class="p-3 space-y-4">
        <!-- 基本信息与作用域 -->
        <section class="space-y-3">
          <FormField label="图层名称">
            <Input
              :model-value="layer.name"
              @update:model-value="(v) => (layer!.name = String(v))"
              @blur="store.pushHistory()"
            />
          </FormField>
          <!-- 所属分组快捷栏 -->
          <div
            v-if="store.selectedParentGroup"
            class="flex-between gap-1.5 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs"
          >
            <button
              type="button"
              class="flex items-center gap-1.5 min-w-0 text-muted-foreground hover:text-foreground transition-colors"
              title="选中所属分组"
              @click="store.selectedLayerIds = [store.selectedParentGroup!.id]; store.editingGroupId = null"
            >
              <FolderOpen class="w-3.5 h-3.5 shrink-0 text-amber-500" />
              <span class="truncate">{{ store.selectedParentGroup.name }}</span>
            </button>
            <Button
              variant="ghost"
              size="xs"
              class="shrink-0"
              @click="store.moveLayerOutOfGroup(layer.id)"
            >
              <FolderOutput class="w-3 h-3" />
              <span>移出组</span>
            </Button>
          </div>
          <SettingRow
            v-if="!store.selectedParentGroup && layer.type !== 'obs-source'"
            variant="none"
            title="全局常驻层"
            hint="开启后此图层会跨所有子场景始终置顶且切场不卸载（适合弹幕机、台标或固定挂件）。"
          >
            <Switch
              :model-value="isGlobalLayer"
              @update:model-value="(v) => store.moveLayerScope(layer!.id, v ? 'global' : 'scene')"
            />
          </SettingRow>
        </section>

        <Separator />

        <!-- 站内 VTsuru 组件属性（默认复用 / 可选独立保存） -->
        <section v-if="layer.type === 'vtsuru-widget'" class="space-y-3">
          <div class="flex-between gap-2">
            <div class="flex items-center gap-1">
              <span class="text-xs font-semibold text-foreground">站内组件配置</span>
              <SceneHelpTip text="嵌入来自「OBS 组件库」的纯前端实时挂件，支持多场景复用或独立保存配置。" />
            </div>
            <Badge variant="outline" class="truncate max-w-[130px]">{{ widgetDef ? formatCleanWidgetName(widgetDef.name) : layer.widget.componentId }}</Badge>
          </div>

          <FormField
            label="缩放适配方式"
            hint="等比自适应：按组件默认分辨率整体缩放不走样&#10;原始像素：直接按画布宽高重新排版，适合流式组件"
          >
            <ToggleGroup
              type="single"
              class="w-full grid grid-cols-2"
              :model-value="layer.widget.scaleMode"
              @update:model-value="(v) => { if (v && layer?.type === 'vtsuru-widget') { layer.widget.scaleMode = v as 'fit' | 'native'; store.pushHistory() } }"
            >
              <ToggleGroupItem value="fit">等比自适应</ToggleGroupItem>
              <ToggleGroupItem value="native">原始像素</ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <!-- 支持后端通道的组件：复用 vs 独立保存 -->
          <template v-if="isBridgeWidget(layer.widget.componentId)">
            <FormField
              label="配置存储模式"
              hint="复用通道：与 OBS 组件库共享同一通道配置，任一处修改两端同步生效&#10;独立保存：隔离到专属通道，调整样式不会影响外部组件库默认配置"
            >
              <ToggleGroup
                type="single"
                class="w-full grid grid-cols-2"
                :disabled="switchingConfigMode"
                :model-value="layer.widget.configMode"
                @update:model-value="handleWidgetConfigModeChange"
              >
                <ToggleGroupItem value="shared">复用通道</ToggleGroupItem>
                <ToggleGroupItem value="isolated">独立保存</ToggleGroupItem>
              </ToggleGroup>
            </FormField>

            <FormField
              v-if="layer.widget.configMode === 'shared'"
              label="复用通道名 (Channel)"
              hint="填写与 OBS 组件库一致的通道标识（默认 default），可让多个场景共享同一份样式与数据。"
            >
              <Input
                :model-value="layer.widget.channelId"
                placeholder="default"
                @change="onSharedChannelCommit"
              />
            </FormField>

            <Button class="w-full" variant="secondary" @click="emit('openWidgetConfig', layer.id)">
              <Settings2 class="w-3.5 h-3.5" />
              <span>打开组件配置面板</span>
            </Button>
          </template>

          <!-- 纯参数组件：Gamepad -->
          <template v-else-if="layer.widget.componentId === 'gamepad' && layer.widget.gamepadParams">
            <div class="space-y-3">
              <FormField label="手柄类型">
                <Select
                  :model-value="layer.widget.gamepadParams.type"
                  @update:model-value="onGamepadTypeChange"
                >
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xbox">Xbox Series / One</SelectItem>
                    <SelectItem value="ps">PlayStation (PS5/PS4)</SelectItem>
                    <SelectItem value="nintendo">Nintendo Switch Pro</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField v-if="gamepadBodyOptions.length > 1" label="手柄外观">
                <Select
                  :model-value="activeGamepadBodyId"
                  @update:model-value="onGamepadBodyChange"
                >
                  <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="body in gamepadBodyOptions" :key="body.id" :value="body.id">
                      {{ body.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="按键高亮色">
                <ColorPicker
                  :model-value="layer.widget.gamepadParams.pressedColor"
                  @update:model-value="(v) => { if (layer?.type === 'vtsuru-widget' && layer.widget.gamepadParams) { layer.widget.gamepadParams.pressedColor = v; store.pushHistory() } }"
                />
              </FormField>
              <FormField label="摇杆推杆幅度" :extra="layer.widget.gamepadParams.stickSensitivity">
                <Slider
                  :model-value="[layer.widget.gamepadParams.stickSensitivity]"
                  :min="5"
                  :max="50"
                  :step="1"
                  @update:model-value="(v) => { if (v?.[0] !== undefined && layer?.type === 'vtsuru-widget' && layer.widget.gamepadParams) layer.widget.gamepadParams.stickSensitivity = v[0] }"
                  @value-commit="store.pushHistory()"
                />
              </FormField>
            </div>
          </template>
        </section>

        <!-- 站内 OBS 业务组件属性 -->
        <SceneObsModuleInspector
          v-else-if="obsModuleLayer"
          :layer="obsModuleLayer"
          @open-question-display-config="emit('openQuestionDisplayConfig', $event)"
          @open-danmuji-config="emit('openDanmujiConfig', $event)"
        />

        <!-- OBS 本地源代理（VTube Studio / 其他皮套 / 游戏 / 摄像头） -->
        <SceneObsSourceInspector
          v-else-if="obsSourceLayer"
          :layer="obsSourceLayer"
          :obs-connected="Boolean(props.obsConnected)"
          :obs-scene-items="props.obsSceneItems ?? []"
          :vts-status="props.vtsStatus ?? null"
          :filter-capabilities="props.filterCapabilities"
          :has-published="Boolean(store.currentProject?.hasPublished)"
          :has-unpublished-changes="store.hasUnpublishedChanges"
          :publishing="store.publishing"
          @refresh-obs-sources="emit('refreshObsSources')"
          @capture-preview="emit('captureSourcePreview', $event)"
          @sync-layout-to-obs="emit('syncLayoutToObs')"
          @sync-source-filters="emit('syncSourceFilters', $event)"
          @refresh-filter-capabilities="emit('refreshFilterCapabilities')"
          @test-vts-action="emit('testVtsAction', $event)"
          @open-obs-link="emit('openObsLink')"
          @publish-now="store.publishNow()"
          @open-setup-guide="emit('openSetupGuide', $event)"
        />

        <!-- 画面滤镜与 VFX 特效层 -->
        <SceneVfxInspector
          v-else-if="vfxLayer"
          :layer="vfxLayer"
        />

        <!-- 走马灯 / 图片轮播 -->
        <SceneExtraLayerInspector
          v-else-if="extraLayer"
          :layer="extraLayer"
        />

        <!-- 文本图层属性 -->
        <section v-else-if="layer.type === 'text'" class="space-y-3">
          <div class="text-xs font-semibold text-foreground">文本样式</div>
          <Textarea
            :model-value="layer.text.content"
            rows="3"
            @update:model-value="(v) => { if (layer?.type === 'text') layer.text.content = String(v) }"
            @blur="store.pushHistory()"
          />
          <FormField label="字体">
            <GoogleFontPicker
              :model-value="textFontValue"
              :extra-options="SYSTEM_CHINESE_FONT_OPTIONS"
              :show-preview="false"
              @update:model-value="updateTextFont"
            />
          </FormField>
          <div class="grid grid-cols-2 gap-2">
            <FormField label="字号 (px)" class="min-w-0">
              <NumberField
                :model-value="layer.text.fontSize"
                :min="12"
                :max="240"
                @update:model-value="(v) => { if (v && layer?.type === 'text') { layer.text.fontSize = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="字重" class="min-w-0">
              <Select
                :model-value="String(layer.text.fontWeight)"
                @update:model-value="(v) => { if (layer?.type === 'text') { layer.text.fontWeight = Number(v); store.pushHistory() } }"
              >
                <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="400">常规 (400)</SelectItem>
                  <SelectItem value="600">半粗 (600)</SelectItem>
                  <SelectItem value="700">加粗 (700)</SelectItem>
                  <SelectItem value="900">特粗 (900)</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>
          <FormField label="对齐方式">
            <ToggleGroup
              type="single"
              class="w-full grid grid-cols-3"
              :model-value="layer.text.align"
              @update:model-value="(v) => { if (v && layer?.type === 'text') { layer.text.align = v as 'left' | 'center' | 'right'; store.pushHistory() } }"
            >
              <ToggleGroupItem value="left">居左</ToggleGroupItem>
              <ToggleGroupItem value="center">居中</ToggleGroupItem>
              <ToggleGroupItem value="right">居右</ToggleGroupItem>
            </ToggleGroup>
          </FormField>
          <div class="grid grid-cols-2 gap-2">
            <FormField label="文字颜色" class="min-w-0">
              <ColorPicker
                :model-value="layer.text.color"
                @update:model-value="(v) => { if (layer?.type === 'text') { layer.text.color = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="背景底色" class="min-w-0">
              <ColorPicker
                :model-value="layer.text.backgroundColor"
                @update:model-value="(v) => { if (layer?.type === 'text') { layer.text.backgroundColor = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="描边粗细" class="min-w-0">
              <NumberField
                :model-value="layer.text.strokeWidth"
                :min="0"
                :max="12"
                @update:model-value="(v) => { if (v !== undefined && layer?.type === 'text') { layer.text.strokeWidth = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="描边颜色" class="min-w-0">
              <ColorPicker
                :model-value="layer.text.strokeColor"
                @update:model-value="(v) => { if (layer?.type === 'text') { layer.text.strokeColor = v; store.pushHistory() } }"
              />
            </FormField>
          </div>
        </section>

        <!-- 图片图层属性 -->
        <section v-else-if="imageLayer" class="space-y-3">
          <div class="text-xs font-semibold text-foreground">图片素材</div>
          <input
            ref="fileInputRef"
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            class="hidden"
            @change="handleImageFileSelected"
          />
          <Button class="w-full" variant="secondary" :disabled="uploadingImage" @click="triggerImageUpload">
            <Upload class="w-3.5 h-3.5" />
            <span>{{ uploadingImage ? '上传转码中...' : '上传本地图片 / 动图' }}</span>
          </Button>
          <FormField label="或填写图片直链 URL">
            <Input
              :model-value="imageLayer.image.url"
              placeholder="https://..."
              @update:model-value="(v) => { if (imageLayer) imageLayer.image.url = String(v) }"
              @blur="store.pushHistory()"
            />
          </FormField>
          <FormField label="填充模式">
            <Select
              :model-value="imageLayer.image.objectFit"
              @update:model-value="(v) => { if (imageLayer) { imageLayer.image.objectFit = v as 'contain' | 'cover' | 'fill'; store.pushHistory() } }"
            >
              <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="contain">完整适应 (Contain)</SelectItem>
                <SelectItem value="cover">裁切铺满 (Cover)</SelectItem>
                <SelectItem value="fill">拉伸填满 (Fill)</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </section>

        <!-- 视频图层属性 -->
        <section v-else-if="videoLayer" class="space-y-3">
          <div class="text-xs font-semibold text-foreground">视频素材</div>
          <FormField label="视频直链 URL (mp4 / webm)">
            <Input
              :model-value="videoLayer.video.url"
              placeholder="https://..."
              @update:model-value="(v) => { if (videoLayer) videoLayer.video.url = String(v) }"
              @blur="store.pushHistory()"
            />
          </FormField>
          <SettingRow variant="none" title="循环播放">
            <Switch
              :model-value="videoLayer.video.loop"
              @update:model-value="(v) => { if (videoLayer) { videoLayer.video.loop = v; store.pushHistory() } }"
            />
          </SettingRow>
          <SettingRow variant="none" title="静音">
            <Switch
              :model-value="videoLayer.video.muted"
              @update:model-value="(v) => { if (videoLayer) { videoLayer.video.muted = v; store.pushHistory() } }"
            />
          </SettingRow>
        </section>

        <!-- 装饰形状属性 -->
        <section v-else-if="layer.type === 'shape'" class="space-y-3">
          <div class="text-xs font-semibold text-foreground">装饰框样式</div>

          <div class="grid grid-cols-2 gap-2">
            <FormField label="填充颜色" class="min-w-0">
              <ColorPicker
                :model-value="layer.shape.fill"
                @update:model-value="(v) => { if (layer?.type === 'shape') { layer.shape.fill = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="边框颜色" class="min-w-0">
              <ColorPicker
                :model-value="layer.shape.borderColor"
                @update:model-value="(v) => { if (layer?.type === 'shape') { layer.shape.borderColor = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="边框宽度" class="min-w-0">
              <NumberField
                :model-value="layer.shape.borderWidth"
                :min="0"
                :max="32"
                @update:model-value="(v) => { if (v !== undefined && layer?.type === 'shape') { layer.shape.borderWidth = v; store.pushHistory() } }"
              />
            </FormField>
            <FormField label="毛玻璃模糊" class="min-w-0">
              <NumberField
                :model-value="layer.shape.backdropBlur"
                :min="0"
                :max="64"
                @update:model-value="(v) => { if (v !== undefined && layer?.type === 'shape') { layer.shape.backdropBlur = v; store.pushHistory() } }"
              />
            </FormField>
          </div>
        </section>

        <!-- 外部网页 iframe 属性 -->
        <section v-else-if="iframeLayer" class="space-y-3">
          <div class="text-xs font-semibold text-foreground">外部网页源 (iframe)</div>
          <FormField
            label="网页 URL (仅支持 http/https)"
            :error="iframeLayer.iframe.url && !isSafeHttpUrl(iframeLayer.iframe.url) ? '请输入合法的 http:// 或 https:// 网址' : undefined"
          >
            <Input
              :model-value="iframeLayer.iframe.url"
              placeholder="https://..."
              @update:model-value="(v) => { if (iframeLayer) iframeLayer.iframe.url = String(v) }"
              @blur="store.pushHistory()"
            />
          </FormField>
          <SettingRow
            variant="none"
            title="允许 OBS 交互点击"
            hint="开启后可在 OBS 右键浏览器源点击「交互」来操作网页内部；关闭时默认鼠标穿透。"
          >
            <Switch
              :model-value="iframeLayer.iframe.interactable"
              @update:model-value="(v) => { if (iframeLayer) { iframeLayer.iframe.interactable = v; store.pushHistory() } }"
            />
          </SettingRow>
        </section>

        <!-- 分组容器属性 -->
        <section v-else-if="groupLayer" class="space-y-3">
          <div class="flex-between">
            <div class="flex items-center gap-1">
              <span class="text-xs font-semibold text-foreground">分组容器</span>
              <SceneHelpTip text="将多个关联图层打包成一组统一移动、缩放与显隐；双击分组可进入组内单独调整子元素。" />
            </div>
            <Badge variant="secondary">{{ groupLayer.group.childIds.length }} 个子项</Badge>
          </div>
          <SettingRow
            variant="none"
            title="缩放时联动子元素"
            hint="开启后拖动组边角会按比例同步缩放内部子元素与字号；关闭时仅改变分组外框大小。"
          >
            <Switch
              :model-value="groupLayer.group.scaleChildren !== false"
              @update:model-value="(v) => { if (groupLayer) { groupLayer.group.scaleChildren = v; store.pushHistory() } }"
            />
          </SettingRow>
          <SettingRow
            variant="none"
            title="裁切超出内容"
            hint="类似 Figma Frame：开启后自动隐藏超出分组边界的子元素，适合做画面窗口裁切。"
          >
            <Switch
              :model-value="Boolean(groupLayer.group.clipContent)"
              @update:model-value="(v) => { if (groupLayer) { groupLayer.group.clipContent = v; store.pushHistory() } }"
            />
          </SettingRow>
          <div class="grid grid-cols-2 gap-1.5">
            <Button variant="secondary" size="xs" @click="store.enterGroupEdit(groupLayer.id)">
              <FolderInput class="w-3.5 h-3.5" />
              <span>组内编辑</span>
            </Button>
            <Button variant="outline" size="xs" @click="store.fitGroupBounds(groupLayer.id)">
              <Maximize2 class="w-3.5 h-3.5" />
              <span>自适应边界</span>
            </Button>
          </div>
          <Button variant="outline" size="xs" class="w-full" @click="store.ungroupLayer(groupLayer.id)">
            <Ungroup class="w-3.5 h-3.5" />
            <span>解散分组 (Ctrl+Shift+G)</span>
          </Button>
        </section>

        <Separator v-if="!obsSourceLayer" />

        <!-- 通用显示项（OBS 原生源不由网页控制透明与 CSS 遮罩） -->
        <section v-if="!obsSourceLayer" class="space-y-3">
          <FormField label="不透明度" :extra="`${Math.round(layer.opacity * 100)}%`">
            <Slider
              v-model="opacitySlider"
              :min="0"
              :max="100"
              :step="1"
              @value-commit="store.pushHistory()"
            />
          </FormField>

          <SettingRow
            v-if="supportsShadowToggle"
            variant="none"
            title="移除自带阴影"
            hint="剥离组件外框投影与文字阴影，便于平整嵌入自定义底板；LED 与发光核心会保留。"
          >
            <Switch
              :model-value="Boolean(layer.disableShadow)"
              @update:model-value="(v) => store.updateLayer(layer!.id, { disableShadow: v })"
            />
          </SettingRow>
        </section>

        <!-- 非常用变换与遮罩：置于组件配置下方且默认折叠 -->
        <Accordion v-model="advancedPanels" type="multiple" class="border-t border-border">
          <AccordionItem v-if="!obsSourceLayer" value="mask" class="border-border">
            <AccordionTrigger class="py-2.5">
              <div class="flex-between flex-1 min-w-0 pr-2 gap-2">
                <div class="flex items-center gap-1">
                  <span class="font-semibold text-foreground">圆角与形状遮罩</span>
                  <SceneHelpTip
                    as="span"
                    compact
                    text="支持圆角矩形或圆形、胶囊、六边形等异形裁切遮罩，适用于图片、视频、装饰框与组件。"
                  />
                </div>
                <span class="text-[11px] font-normal text-muted-foreground truncate tabular-nums">
                  {{ maskShapeSummary }}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent class="pt-1 pb-3">
              <SceneMaskShapePicker
                :mask-shape="layer.maskShape"
                :border-radius="layer.borderRadius ?? 0"
                :max-layer-side="Math.min(layer.width, layer.height)"
                @update:mask-shape="(v) => { if (layer) layer.maskShape = v }"
                @update:border-radius="(v) => { if (layer) layer.borderRadius = v }"
                @commit="store.pushHistory()"
              />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="transform" class="border-b-0">
            <AccordionTrigger class="py-2.5">
              <div class="flex-between flex-1 min-w-0 pr-2 gap-2">
                <span class="font-semibold text-foreground">位置与尺寸</span>
                <span class="text-[11px] font-normal text-muted-foreground truncate tabular-nums">
                  {{ layer.width }}×{{ layer.height }}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent class="pt-1 pb-2 space-y-3">
              <div class="flex-between">
                <span class="text-[11px] text-muted-foreground">快速对齐</span>
                <div class="flex items-center gap-0.5">
                  <Button variant="ghost" size="xs" title="水平居中" @click="centerLayerHorizontal">
                    <AlignCenterHorizontal class="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="xs" title="垂直居中" @click="centerLayerVertical">
                    <AlignCenterVertical class="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="xs" title="铺满画布" @click="fitLayerToCanvas">
                    <Maximize2 class="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-2">
                <FormField label="X" class="min-w-0">
                  <NumberField
                    :model-value="layer.x"
                    @update:model-value="(v) => v !== undefined && store.updateLayer(layer!.id, { x: Math.round(v) })"
                  />
                </FormField>
                <FormField label="Y" class="min-w-0">
                  <NumberField
                    :model-value="layer.y"
                    @update:model-value="(v) => v !== undefined && store.updateLayer(layer!.id, { y: Math.round(v) })"
                  />
                </FormField>
                <FormField label="宽 (W)" class="min-w-0">
                  <NumberField
                    :model-value="layer.width"
                    :min="24"
                    @update:model-value="(v) => v !== undefined && store.updateLayer(layer!.id, { width: Math.max(24, Math.round(v)) })"
                  />
                </FormField>
                <FormField label="高 (H)" class="min-w-0">
                  <NumberField
                    :model-value="layer.height"
                    :min="24"
                    @update:model-value="(v) => v !== undefined && store.updateLayer(layer!.id, { height: Math.max(24, Math.round(v)) })"
                  />
                </FormField>
              </div>

              <FormField label="旋转 (°)">
                <NumberField
                  :model-value="layer.rotation"
                  :min="-360"
                  :max="360"
                  @update:model-value="(v) => v !== undefined && store.updateLayer(layer!.id, { rotation: Math.round(v) })"
                />
              </FormField>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </ScrollArea>
  </div>
</template>
