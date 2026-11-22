<script setup lang="ts">
import {
  AlertTriangle,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Link2,
  Maximize2,
  Play,
  RefreshCw,
  Rocket,
  Send,
  Sparkles,
  Upload,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { uploadObsSceneAsset } from '@/api/obs-scene'
import type { RpcObsSceneItemRef, RpcVtsStatus } from '@/shared/rpc/contract'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import type { ObsSourceLayer, ObsSourcePositionMode, ObsSourceRole } from '../types'
import { OBS_SOURCE_ROLE_PRESETS } from '../types'
import SceneHelpTip from './SceneHelpTip.vue'

const props = defineProps<{
  layer: ObsSourceLayer
  obsConnected: boolean
  obsSceneItems: RpcObsSceneItemRef[]
  vtsStatus: RpcVtsStatus | null
  hasPublished?: boolean
  hasUnpublishedChanges?: boolean
  publishing?: boolean
}>()

const emit = defineEmits<{
  refreshObsSources: []
  capturePreview: [sourceName: string]
  syncLayoutToObs: []
  testVtsAction: [layerId: string]
  openObsLink: []
  publishNow: []
  openSetupGuide: [tab: 'obs-layout' | 'model-capture']
}>()

const store = useObsSceneEditorStore()
const uploadingRef = ref(false)
const capturingPreview = ref(false)
const refFileInput = ref<HTMLInputElement | null>(null)
const guideExpandedOverride = ref<boolean | null>(null)

const isSourceBound = computed(() => Boolean(props.layer.obsSource.sourceName.trim()))
const isPublishedUpToDate = computed(() => Boolean(props.hasPublished && !props.hasUnpublishedChanges))
const allPrepStepsDone = computed(() => isSourceBound.value && isPublishedUpToDate.value)
const showSetupChecklist = computed(() => {
  if (guideExpandedOverride.value !== null) return guideExpandedOverride.value
  return !allPrepStepsDone.value
})

const vtsController = computed(() =>
  props.layer.obsSource.controller.type === 'vts' ? props.layer.obsSource.controller : null,
)

const isVtsPresetMode = computed(() => vtsController.value?.positionMode === 'vts-preset')

function scoreObsSourceMatch(item: RpcObsSceneItemRef, role: ObsSourceRole): number {
  const kind = item.inputKind.toLowerCase()
  const name = item.sourceName.toLowerCase()
  if (role === 'vts') {
    if (name.includes('vtube') || name.includes('vts')) return 100
    if (kind.includes('spout')) return 90
    if (kind.includes('game_capture')) return 70
    if (kind.includes('window_capture')) return 50
  } else if (role === 'avatar') {
    if (kind.includes('spout') || kind.includes('ndi')) return 90
    if (name.includes('warudo') || name.includes('vseeface') || name.includes('prpr') || name.includes('veado') || name.includes('皮套')) return 85
    if (kind.includes('game_capture')) return 65
  } else if (role === 'game') {
    if (kind.includes('game_capture')) return 100
    if (kind.includes('window_capture') || kind.includes('monitor_capture')) return 80
  } else if (role === 'camera') {
    if (kind.includes('dshow') || kind.includes('av_capture') || kind.includes('v4l2')) return 100
  }
  if (kind === 'browser_source') return -10
  return 10
}

const sortedObsSourceItems = computed(() => {
  const role = props.layer.obsSource.role
  return props.obsSceneItems
    .filter((item) => item.inputKind !== 'browser_source')
    .toSorted((a, b) => scoreObsSourceMatch(b, role) - scoreObsSourceMatch(a, role))
})

const selectedObsSourceValue = computed(() => {
  const name = props.layer.obsSource.sourceName.trim()
  if (!name) return '__custom__'
  return sortedObsSourceItems.value.some((i) => i.sourceName === name) ? name : '__custom__'
})

const hasObsLinkConflict = computed(() => {
  return Boolean(
    props.vtsStatus?.obsLinkEnabled &&
      vtsController.value &&
      (vtsController.value.positionMode === 'vts-preset' || vtsController.value.presetId),
  )
})

const hasAnyVtsAction = computed(() => {
  const c = vtsController.value
  if (!c) return false
  return Boolean(c.presetId || c.expressionFile || c.hotkeyId || c.macroId)
})

function onRoleChange(val: unknown) {
  const role = String(val ?? 'generic') as ObsSourceRole
  props.layer.obsSource.role = role
  if (role === 'vts' && props.layer.obsSource.controller.type !== 'vts') {
    props.layer.obsSource.controller = {
      type: 'vts',
      positionMode: 'obs-transform',
      expressionActive: true,
    }
  }
  store.pushHistory()
}

function onSelectBoundObsSource(val: unknown) {
  const str = String(val ?? '')
  if (!str || str === '__custom__') return
  props.layer.obsSource.sourceName = str
  if (!props.layer.name || OBS_SOURCE_ROLE_PRESETS.some((p) => p.defaultName === props.layer.name)) {
    props.layer.name = str
  }
  store.pushHistory()
  emit('capturePreview', str)
}

function applyObsSourceBounds() {
  const name = props.layer.obsSource.sourceName.trim()
  const matched = props.obsSceneItems.find((i) => i.sourceName === name)
  if (!matched) {
    toast.warning('当前 OBS 源列表中未找到该源，请先点击刷新列表')
    return
  }
  store.updateLayer(props.layer.id, {
    x: matched.x,
    y: matched.y,
    width: Math.max(48, matched.width),
    height: Math.max(48, matched.height),
    rotation: matched.rotation,
  })
  toast.success(`已同步「${matched.sourceName}」在 OBS 中的当前位置与尺寸`)
}

function onControllerTypeChange(val: unknown) {
  const type = String(val ?? 'none')
  if (type === 'vts') {
    props.layer.obsSource.controller = {
      type: 'vts',
      positionMode: 'obs-transform',
      expressionActive: true,
    }
  } else {
    props.layer.obsSource.controller = { type: 'none' }
  }
  store.pushHistory()
}

function onPositionModeChange(val: unknown) {
  if (!vtsController.value) return
  const mode: ObsSourcePositionMode = val === 'vts-preset' ? 'vts-preset' : 'obs-transform'
  vtsController.value.positionMode = mode
  if (mode === 'vts-preset') {
    // VTS 机位模式下，画布占位自动铺满以直观表达全屏捕获语义
    store.updateLayer(props.layer.id, {
      x: 0,
      y: 0,
      width: store.doc.canvas.width,
      height: store.doc.canvas.height,
      rotation: 0,
    })
  } else {
    store.pushHistory()
  }
}

function updateVtsField(patch: Partial<NonNullable<typeof vtsController.value>>) {
  if (!vtsController.value) return
  Object.assign(vtsController.value, patch)
  store.pushHistory()
}

function commitHistory() {
  store.pushHistory()
}

function setSyncCrop(enabled: boolean) {
  props.layer.obsSource.syncCrop = enabled
  store.pushHistory()
}

function updateCrop(side: 'top' | 'right' | 'bottom' | 'left', val: number | undefined) {
  const next = {
    top: props.layer.crop?.top ?? 0,
    right: props.layer.crop?.right ?? 0,
    bottom: props.layer.crop?.bottom ?? 0,
    left: props.layer.crop?.left ?? 0,
    [side]: Math.max(0, Math.round(val ?? 0)),
  }
  store.updateLayer(props.layer.id, { crop: next })
}

async function handleCapturePreview() {
  const name = props.layer.obsSource.sourceName.trim()
  if (!name) {
    toast.warning('请先填写或选择一个本地 OBS 源名称')
    return
  }
  capturingPreview.value = true
  try {
    emit('capturePreview', name)
  } finally {
    setTimeout(() => {
      capturingPreview.value = false
    }, 350)
  }
}

async function handleUploadRefImage(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploadingRef.value = true
  try {
    const uploaded = await uploadObsSceneAsset(file)
    props.layer.obsSource.referenceImageUrl = uploaded.url
    store.pushHistory()
    toast.success('已设置编辑态参考立绘')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '上传参考图失败')
  } finally {
    uploadingRef.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 0. 交互式接入步骤清单（未就绪自动展开，就绪后可折叠为单行入口） -->
    <section class="rounded-lg border border-border bg-muted/25 overflow-hidden">
      <button
        type="button"
        class="w-full flex-between gap-2 px-2.5 py-2 text-left hover:bg-accent/50 transition-colors"
        @click="guideExpandedOverride = !showSetupChecklist"
      >
        <div class="flex items-center gap-1.5 min-w-0">
          <CheckCircle2 v-if="allPrepStepsDone" class="size-3.5 text-emerald-500 shrink-0" />
          <BookOpen v-else class="size-3.5 text-primary shrink-0" />
          <span class="text-xs font-semibold text-foreground truncate">
            {{ allPrepStepsDone ? '配置已就绪 · 接入指引' : '4 步接入 OBS 引导' }}
          </span>
        </div>
        <ChevronDown v-if="showSetupChecklist" class="size-3.5 text-muted-foreground shrink-0" />
        <ChevronRight v-else class="size-3.5 text-muted-foreground shrink-0" />
      </button>

      <div v-if="showSetupChecklist" class="px-2.5 pb-2.5 pt-1 space-y-2 border-t border-border/70">
        <!-- Step 1 -->
        <div class="flex items-start gap-2 text-[11px]">
          <CheckCircle2 v-if="isSourceBound" class="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <Circle v-else class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 leading-relaxed">
            <span class="text-foreground font-medium">1. 在 OBS 添加模型源</span>
            <span class="text-muted-foreground">（推荐 Spout2 透明采集）</span>
            <button
              type="button"
              class="ml-1 text-primary hover:underline font-medium"
              @click="emit('openSetupGuide', 'model-capture')"
            >
              怎么接？
            </button>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="flex items-start gap-2 text-[11px]">
          <CheckCircle2 v-if="isSourceBound" class="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <Circle v-else class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 leading-relaxed">
            <span class="text-foreground font-medium">2. 绑定本地 OBS 源名</span>
            <span v-if="!obsConnected" class="text-muted-foreground">（可先连 OBS 自动选源）</span>
            <span v-else-if="!isSourceBound" class="text-muted-foreground">（在下方下拉选择）</span>
            <button
              v-if="!obsConnected"
              type="button"
              class="ml-1 text-primary hover:underline font-medium inline-flex items-center gap-0.5"
              @click="emit('openObsLink')"
            >
              <Link2 class="size-3" />
              <span>连接 OBS</span>
            </button>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="flex items-start gap-2 text-[11px]">
          <CheckCircle2 v-if="isPublishedUpToDate" class="size-3.5 text-emerald-500 shrink-0 mt-0.5" />
          <Circle v-else class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 leading-relaxed">
            <span class="text-foreground font-medium">3. 拖好前后层序并发布</span>
            <button
              v-if="!isPublishedUpToDate"
              type="button"
              class="ml-1 text-primary hover:underline font-medium inline-flex items-center gap-0.5 disabled:opacity-50"
              :disabled="publishing"
              @click="emit('publishNow')"
            >
              <Rocket class="size-3" />
              <span>{{ publishing ? '发布中...' : '立即发布' }}</span>
            </button>
          </div>
        </div>

        <!-- Step 4 -->
        <div class="flex items-start gap-2 text-[11px]">
          <Circle class="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <div class="flex-1 min-w-0 leading-relaxed">
            <span class="text-foreground font-medium">4. 写入 OBS 分层</span>
            <button
              v-if="obsConnected"
              type="button"
              class="ml-1 text-primary hover:underline font-medium"
              @click="emit('syncLayoutToObs')"
            >
              一键同步
            </button>
            <button
              type="button"
              class="ml-1 text-primary hover:underline font-medium"
              @click="emit('openSetupGuide', 'obs-layout')"
            >
              {{ obsConnected ? '查看手动步骤' : '查看分层链接与步骤' }}
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 1. OBS 本地源绑定 -->
    <section class="space-y-3">
      <div class="flex-between">
        <div class="flex items-center gap-1">
          <span class="text-xs font-semibold text-foreground">OBS 本地源代理</span>
          <SceneHelpTip text="真实画面由本地 OBS 零拷贝渲染（Spout2/游戏捕获等），本层用于画布排版、抓透明预览并自动切分前后景浏览器源。" />
        </div>
        <Badge variant="secondary">参与 Z 轴分层</Badge>
      </div>

      <FormField
        label="源用途预设"
        hint="用于标记用途并在下拉选源时优先把匹配的 OBS 源（如 Spout2、游戏捕获、摄像头）排在最前，不影响实际兼容范围。"
      >
        <Select :model-value="layer.obsSource.role" @update:model-value="onRoleChange">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem v-for="item in OBS_SOURCE_ROLE_PRESETS" :key="item.role" :value="item.role">
              {{ item.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField
        label="绑定本地 OBS 源"
        hint="支持 Spout2、游戏/窗口捕获、NDI、摄像头等任意源，系统会按本层在图层树中的位置自动把前景与背景浏览器源夹在上下两侧。"
      >
        <div class="space-y-1.5">
          <div v-if="obsConnected" class="flex items-center gap-1.5">
            <Select :model-value="selectedObsSourceValue" @update:model-value="onSelectBoundObsSource">
              <SelectTrigger class="flex-1 min-w-0">
                <SelectValue placeholder="从本地 OBS 场景中选择源" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__custom__">手动输入源名称</SelectItem>
                <SelectItem v-for="item in sortedObsSourceItems" :key="item.sceneItemId" :value="item.sourceName">
                  {{ item.sourceName }} ({{ item.inputKind }})
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon-sm"
              title="刷新本地 OBS 源列表"
              @click="emit('refreshObsSources')"
            >
              <RefreshCw class="size-3.5" />
            </Button>
          </div>

          <Input
            :model-value="layer.obsSource.sourceName"
            placeholder="例如：VTube Studio / Spout2 捕获"
            @update:model-value="(v) => { layer.obsSource.sourceName = String(v) }"
            @blur="commitHistory"
          />
        </div>
      </FormField>

      <div class="grid grid-cols-2 gap-1.5">
        <Button
          variant="secondary"
          size="xs"
          :disabled="!obsConnected || !layer.obsSource.sourceName.trim() || capturingPreview"
          @click="handleCapturePreview"
        >
          <Camera class="size-3.5" />
          <span>抓取透明预览</span>
        </Button>
        <Button
          variant="outline"
          size="xs"
          :disabled="!obsConnected || !layer.obsSource.sourceName.trim()"
          @click="applyObsSourceBounds"
        >
          <Maximize2 class="size-3.5" />
          <span>读取 OBS 位置</span>
        </Button>
      </div>

      <Button
        variant="default"
        size="xs"
        class="w-full"
        :disabled="!obsConnected"
        @click="emit('syncLayoutToObs')"
      >
        <Send class="size-3.5" />
        <span>立即同步层级与位置到 OBS</span>
      </Button>

      <!-- 离线参考图 -->
      <FormField
        label="编辑态离线参考图（可选）"
        hint="未连接本地 OBS 或脱机排版时作为画布占位参考图显示，不会出现在实际直播画面中。"
      >
        <div class="flex items-center gap-1.5">
          <Input
            :model-value="layer.obsSource.referenceImageUrl ?? ''"
            placeholder="https://... 或上传立绘"
            class="flex-1 min-w-0"
            @update:model-value="(v) => { layer.obsSource.referenceImageUrl = String(v).trim() || undefined }"
            @blur="commitHistory"
          />
          <Button
            variant="outline"
            size="icon-sm"
            :disabled="uploadingRef"
            title="上传参考图片"
            @click="refFileInput?.click()"
          >
            <Upload class="size-3.5" />
          </Button>
          <input
            ref="refFileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleUploadRefImage"
          />
        </div>
      </FormField>
    </section>

    <Separator />

    <!-- 2. 软件控制联动（可扩展适配器槽位） -->
    <section class="space-y-3">
      <div class="flex-between">
        <span class="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles class="size-3.5 text-primary" />
          <span>软件控制联动</span>
          <SceneHelpTip text="切入当前子场景时自动通知模型软件切换机位、表情、热键或宏；选「无」时纯作 OBS 源排版，兼容所有模型软件。" />
        </span>
        <Badge
          v-if="vtsController"
          :variant="vtsStatus?.connected ? 'default' : 'secondary'"
        >
          {{ vtsStatus?.connected ? 'VTS 已连' : 'VTS 未连' }}
        </Badge>
      </div>

      <FormField label="联动控制器">
        <Select :model-value="layer.obsSource.controller.type" @update:model-value="onControllerTypeChange">
          <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">无（通用 OBS 源，兼容所有模型软件）</SelectItem>
            <SelectItem value="vts">VTube Studio（机位 / 表情 / 热键 / 宏）</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <template v-if="vtsController">
        <FormField
          label="位置控制方式"
          hint="OBS 排版：画布位置/尺寸/旋转/裁切 1:1 同步到 OBS 源，像素精准对齐&#10;VTS 机位：OBS 源保持全屏不动，切入该子场景时走 VTS 原生缓动机位预设"
        >
          <ToggleGroup
            :model-value="vtsController.positionMode"
            type="single"
            class="w-full grid grid-cols-2"
            @update:model-value="onPositionModeChange"
          >
            <ToggleGroupItem value="obs-transform">OBS 排版</ToggleGroupItem>
            <ToggleGroupItem value="vts-preset">VTS 机位</ToggleGroupItem>
          </ToggleGroup>
        </FormField>

        <div
          v-if="vtsStatus?.connected"
          class="flex items-center gap-1.5 text-[11px] text-emerald-500"
        >
          <CheckCircle2 class="size-3.5 shrink-0" />
          <span class="truncate">当前模型：{{ vtsStatus.modelName || '未加载模型' }}</span>
        </div>
        <Alert v-else>
          <AlertTriangle class="size-4" />
          <AlertDescription class="text-[11px]">
            运行 VTsuru 桌面客户端并在「VTube Studio」页建立连接后，可在此直接选取预设、表情与热键。
          </AlertDescription>
        </Alert>

        <Alert v-if="hasObsLinkConflict" variant="destructive">
          <AlertTriangle class="size-4" />
          <AlertDescription class="text-[11px]">
            客户端已开启旧版「VTS-OBS 场景联动」，建议在客户端关闭它以避免切场时重复移动模型机位。
          </AlertDescription>
        </Alert>

        <FormField label="切入子场景时应用机位预设">
          <Select
            :model-value="vtsController.presetId || '__none__'"
            @update:model-value="(v) => updateVtsField({ presetId: v === '__none__' ? undefined : String(v) })"
          >
            <SelectTrigger class="w-full"><SelectValue placeholder="不切换机位" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不切换机位</SelectItem>
              <SelectItem v-for="p in vtsStatus?.presets ?? []" :key="p.id" :value="p.id">
                {{ p.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <div class="grid grid-cols-[1fr_auto] gap-2 items-end">
          <FormField label="切入时切换表情" class="min-w-0">
            <Select
              :model-value="vtsController.expressionFile || '__none__'"
              @update:model-value="(v) => updateVtsField({ expressionFile: v === '__none__' ? undefined : String(v) })"
            >
              <SelectTrigger class="w-full"><SelectValue placeholder="不变更表情" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">不变更表情</SelectItem>
                <SelectItem v-for="exp in vtsStatus?.expressions ?? []" :key="exp.file" :value="exp.file">
                  {{ exp.name || exp.file }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField v-if="vtsController.expressionFile" label="状态">
            <ToggleGroup
              :model-value="vtsController.expressionActive !== false ? 'on' : 'off'"
              type="single"
              @update:model-value="(v) => updateVtsField({ expressionActive: v !== 'off' })"
            >
              <ToggleGroupItem value="on">开</ToggleGroupItem>
              <ToggleGroupItem value="off">关</ToggleGroupItem>
            </ToggleGroup>
          </FormField>
        </div>

        <FormField label="切入时触发热键">
          <Select
            :model-value="vtsController.hotkeyId || '__none__'"
            @update:model-value="(v) => updateVtsField({ hotkeyId: v === '__none__' ? undefined : String(v) })"
          >
            <SelectTrigger class="w-full"><SelectValue placeholder="不触发热键" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不触发热键</SelectItem>
              <SelectItem v-for="hk in vtsStatus?.hotkeys ?? []" :key="hk.hotkeyID" :value="hk.hotkeyID">
                {{ hk.name || hk.hotkeyID }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="切入时执行动作宏">
          <Select
            :model-value="vtsController.macroId || '__none__'"
            @update:model-value="(v) => updateVtsField({ macroId: v === '__none__' ? undefined : String(v) })"
          >
            <SelectTrigger class="w-full"><SelectValue placeholder="不执行宏" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">不执行宏</SelectItem>
              <SelectItem v-for="m in vtsStatus?.macros ?? []" :key="m.id" :value="m.id">
                {{ m.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <Button
          variant="outline"
          size="xs"
          class="w-full"
          :disabled="!vtsStatus?.connected || !hasAnyVtsAction"
          @click="emit('testVtsAction', layer.id)"
        >
          <Play class="size-3.5" />
          <span>立即测试触发 VTS 动作</span>
        </Button>
      </template>
    </section>

    <!-- 3. OBS 源裁切（仅在 OBS 排版模式下生效） -->
    <template v-if="!isVtsPresetMode">
      <Separator />
      <section class="space-y-3">
        <SettingRow
          variant="none"
          title="同步源裁切到 OBS"
          hint="将四边像素裁切同步写入 OBS 源（适合框选半身或嵌入小窗）。"
        >
          <Switch
            :model-value="layer.obsSource.syncCrop !== false"
            @update:model-value="setSyncCrop"
          />
        </SettingRow>

        <div v-if="layer.obsSource.syncCrop !== false" class="grid grid-cols-2 gap-2">
          <FormField label="上裁切 (px)" class="min-w-0">
            <NumberField
              :model-value="layer.crop?.top ?? 0"
              :min="0"
              @update:model-value="(v) => updateCrop('top', v)"
            />
          </FormField>
          <FormField label="下裁切 (px)" class="min-w-0">
            <NumberField
              :model-value="layer.crop?.bottom ?? 0"
              :min="0"
              @update:model-value="(v) => updateCrop('bottom', v)"
            />
          </FormField>
          <FormField label="左裁切 (px)" class="min-w-0">
            <NumberField
              :model-value="layer.crop?.left ?? 0"
              :min="0"
              @update:model-value="(v) => updateCrop('left', v)"
            />
          </FormField>
          <FormField label="右裁切 (px)" class="min-w-0">
            <NumberField
              :model-value="layer.crop?.right ?? 0"
              :min="0"
              @update:model-value="(v) => updateCrop('right', v)"
            />
          </FormField>
        </div>
      </section>
    </template>
  </div>
</template>
