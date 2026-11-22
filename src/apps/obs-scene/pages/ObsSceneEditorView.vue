<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Grid3x3,
  Hand,
  Link2,
  Magnet,
  Maximize,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  MousePointer2,
  Plus,
  Redo2,
  RefreshCw,
  Rocket,
  Save,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-vue-next'
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import { getObsComponentById } from '@/apps/obs-store/registry'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

import DanmujiConfigModal from '../components/DanmujiConfigModal.vue'
import ObsLinkDialog from '../components/ObsLinkDialog.vue'
import ObsSourceSetupGuideDialog from '../components/ObsSourceSetupGuideDialog.vue'
import QuestionDisplayConfigModal from '../components/QuestionDisplayConfigModal.vue'
import SceneCanvasViewport from '../components/SceneCanvasViewport.vue'
import SceneHelpTip from '../components/SceneHelpTip.vue'
import SceneInspector from '../components/SceneInspector.vue'
import SceneLeftSidebar from '../components/SceneLeftSidebar.vue'
import { useObsLocalBridge } from '../composables/useObsLocalBridge'
import { useObsSceneEditorStore } from '../store/useObsSceneEditorStore'
import { buildObsScenePlayerUrl, documentRequiresAuthToken } from '../types'
import { buildSyncLayoutParamsForScene, documentHasObsSources } from '../utils/sceneSlices'

const account = useAccount()
const store = useObsSceneEditorStore()
const obsBridge = useObsLocalBridge()
const { copy } = useClipboard()

const viewportRef = ref<InstanceType<typeof SceneCanvasViewport> | null>(null)
const leftSidebarOpen = ref(true)
const rightSidebarOpen = ref(true)
const obsLinkDialogOpen = ref(false)
const setupGuideOpen = ref(false)
const setupGuideTab = ref<'obs-layout' | 'model-capture'>('obs-layout')
const createDialogOpen = ref(false)
const newProjectName = ref('')
const jsonDialogOpen = ref(false)
const jsonDraft = ref('')
const copiedUrl = ref(false)

// 内嵌组件配置抽屉
const configDrawerOpen = ref(false)
const configDrawerLayerId = ref<string | null>(null)

// 提问箱展示样式配置弹窗（带实时画面预览）
const qaConfigModalOpen = ref(false)
const qaConfigLayerId = ref<string | null>(null)

const qaConfigLayer = computed(() => {
  if (!qaConfigLayerId.value) return null
  const l = store.doc.layers[qaConfigLayerId.value]
  return l && l.type === 'obs-module' && l.module.moduleId === 'question-display' ? l : null
})

// 弹幕机样式与规则配置弹窗（带真实 DanmujiOBS 实时预览）
const danmujiConfigModalOpen = ref(false)
const danmujiConfigLayerId = ref<string | null>(null)

const danmujiConfigLayer = computed(() => {
  if (!danmujiConfigLayerId.value) return null
  const l = store.doc.layers[danmujiConfigLayerId.value]
  return l && l.type === 'obs-module' && l.module.moduleId === 'danmuji' ? l : null
})

const configDrawerLayer = computed(() => {
  if (!configDrawerLayerId.value) return null
  const l = store.doc.layers[configDrawerLayerId.value]
  return l && l.type === 'vtsuru-widget' ? l : null
})

const configDrawerDef = computed(() => {
  if (!configDrawerLayer.value) return null
  return getObsComponentById(configDrawerLayer.value.widget.componentId) ?? null
})

const configDrawerComponent = computed(() => {
  const loader = configDrawerDef.value?.manageComponent
  return loader ? defineAsyncComponent(loader) : null
})

const authTokenForPlayer = computed(() =>
  documentRequiresAuthToken(store.doc) ? account.value.token : undefined,
)

const hasObsSources = computed(() => documentHasObsSources(store.doc))

const playerUrl = computed(() => {
  const key = store.currentProject?.shareKey
  if (!key) return ''
  return buildObsScenePlayerUrl(key, undefined, authTokenForPlayer.value)
})

function openSetupGuide(tab: 'obs-layout' | 'model-capture' = 'obs-layout') {
  setupGuideTab.value = tab
  setupGuideOpen.value = true
}

const currentProjectIdModel = computed({
  get: () => (store.currentProject ? String(store.currentProject.id) : ''),
  set: (val: string) => {
    const id = Number(val)
    if (id && id !== store.currentProject?.id) {
      void store.openProject(id)
    }
  },
})

function openWidgetConfigDrawer(layerId: string) {
  configDrawerLayerId.value = layerId
  configDrawerOpen.value = true
}

function openQuestionDisplayConfigModal(layerId: string) {
  qaConfigLayerId.value = layerId
  qaConfigModalOpen.value = true
}

function openDanmujiConfigModal(layerId: string) {
  danmujiConfigLayerId.value = layerId
  danmujiConfigModalOpen.value = true
}

async function handleCopyPlayerUrl() {
  if (!playerUrl.value) return
  if (hasObsSources.value) {
    openSetupGuide('obs-layout')
    return
  }
  await copy(playerUrl.value)
  copiedUrl.value = true
  toast.success('已复制 OBS 浏览器源地址（建议分辨率与画布一致）')
  setTimeout(() => {
    copiedUrl.value = false
  }, 1800)
}

function handleOpenPlayerPreview() {
  if (!playerUrl.value) return
  if (!store.currentProject?.hasPublished) {
    toast.warning('请先点击「发布生效」，再在 OBS 或新标签页预览')
    return
  }
  window.open(playerUrl.value, '_blank', 'noopener,noreferrer')
}

async function handleCreateProject() {
  const name = newProjectName.value.trim() || `OBS 场景 ${store.projects.length + 1}`
  await store.createNewProject(name)
  newProjectName.value = ''
  createDialogOpen.value = false
  toast.success(`已创建项目「${name}」`)
}

async function handleDeleteCurrentProject() {
  if (!store.currentProject) return
  const name = store.currentProject.name
  await store.removeProject(store.currentProject.id)
  toast.success(`已删除项目「${name}」`)
}

function openJsonDialog() {
  jsonDraft.value = store.exportDocumentJson()
  jsonDialogOpen.value = true
}

function applyImportedJson() {
  try {
    store.importDocumentJson(jsonDraft.value)
    jsonDialogOpen.value = false
    toast.success('已导入场景 JSON，记得点击「发布生效」同步到 OBS')
  } catch (err) {
    toast.error(err instanceof Error ? `JSON 解析失败: ${err.message}` : '无效的 JSON')
  }
}

async function copyExportedJson() {
  await copy(jsonDraft.value)
  toast.success('已复制场景 JSON')
}

async function handleSwitchObsScene(obsSceneName: string) {
  const res = await obsBridge.switchObsScene(obsSceneName)
  if (!res.ok) toast.error(res.message || '切换本地 OBS 场景失败')
}

async function handleRefreshObsSources() {
  if (!obsBridge.connected.value) {
    toast.warning('请先连接本地 OBS')
    return
  }
  try {
    const items = await obsBridge.refreshSceneItems()
    toast.success(`已刷新「${obsBridge.referenceSceneName.value}」的 ${items.length} 个本地源`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '拉取 OBS 源列表失败')
  }
}

async function handleCaptureSourcePreview(sourceName: string) {
  if (!obsBridge.connected.value) {
    toast.warning('请先连接本地 OBS 后抓取预览')
    return
  }
  const res = await obsBridge.captureSourceScreenshot({ sourceName })
  if (res.ok) {
    toast.success(`已刷新「${sourceName}」透明预览图`)
  } else {
    toast.error(res.message || '抓取 OBS 源快照失败')
  }
}

async function handleSyncLayoutToObs() {
  if (!obsBridge.connected.value) {
    toast.warning('请先连接本地 OBS')
    return
  }
  const shareKey = store.currentProject?.shareKey
  if (!shareKey || !store.currentProject?.hasPublished) {
    toast.warning('请先点击「发布生效」，再同步分层布局到 OBS')
    return
  }
  const targetScene = store.activeScene?.obsSceneBinding || obsBridge.currentScene.value
  if (!targetScene) {
    toast.error('未获取到目标 OBS 场景')
    return
  }
  const params = buildSyncLayoutParamsForScene({
    doc: store.doc,
    sceneId: store.doc.activeSceneId,
    obsSceneName: targetScene,
    baseSourceName: `VTsuru - ${store.currentProject.name}`,
    shareKey,
    authToken: authTokenForPlayer.value,
  })
  const res = await obsBridge.syncSceneLayoutToObs(params)
  if (res.ok) {
    toast.success(res.message || '已同步分层布局到 OBS')
    if (res.warnings?.length) toast.warning(res.warnings.join('；'))
  } else {
    toast.error(res.message || '同步分层布局失败')
  }
}

async function handleTestVtsAction(layerId: string) {
  const layer = store.doc.layers[layerId]
  if (!layer || layer.type !== 'obs-source' || layer.obsSource.controller.type !== 'vts') return
  const ctrl = layer.obsSource.controller
  const res = await obsBridge.runVtsSceneAction({
    presetId: ctrl.presetId,
    expressionFile: ctrl.expressionFile,
    expressionActive: ctrl.expressionActive,
    hotkeyId: ctrl.hotkeyId,
    macroId: ctrl.macroId,
  })
  if (res.ok) {
    toast.success('已触发 VTube Studio 联动动作')
  } else {
    toast.error(res.message || '触发 VTS 动作失败')
  }
}

// 连接本地 OBS 后静默预拉当前场景源列表，确保右侧 OBS 源绑定下拉即开即用
watch(
  () => [obsBridge.connected.value, obsBridge.currentScene.value] as const,
  ([isConn, sceneName]) => {
    if (isConn && sceneName) {
      void obsBridge.refreshSceneItems(sceneName).catch(() => {})
    }
  },
)

onMounted(async () => {
  try {
    await store.loadProjectList(true)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载 OBS 场景项目失败')
  }
  // 静默探测一次本地客户端 RPC，有客户端则自动建立无感联动
  void obsBridge.connectViaClientRpc()

  obsBridge.onObsSceneChanged((obsSceneName) => {
    if (!obsBridge.autoSyncScene.value) return
    void store.handleLocalObsSceneChanged(obsSceneName).then((matchedId) => {
      if (matchedId) {
        const name = store.doc.scenes[matchedId]?.name ?? matchedId
        toast.info(`已跟随本地 OBS 自动切换至「${name}」`)
      }
    })
  })
})
</script>

<template>
  <div class="h-[calc(100vh-4rem)] min-h-[600px] flex flex-col bg-background border border-border rounded-lg overflow-hidden">
    <!-- 顶部工具栏 -->
    <header class="flex items-center justify-between gap-2 px-3 py-2 border-b border-border bg-card shrink-0 flex-wrap">
      <!-- 左侧：项目选择与基础操作 -->
      <div class="flex items-center gap-1.5 min-w-0">
        <Button
          variant="ghost"
          size="xs"
          :title="leftSidebarOpen ? '收起场景与图层栏' : '展开场景与图层栏'"
          @click="leftSidebarOpen = !leftSidebarOpen"
        >
          <PanelLeftClose v-if="leftSidebarOpen" class="w-3.5 h-3.5" />
          <PanelLeftOpen v-else class="w-3.5 h-3.5" />
        </Button>

        <Select v-model="currentProjectIdModel" :disabled="store.loadingList">
          <SelectTrigger class="w-44">
            <SelectValue placeholder="选择场景项目" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="p in store.projects" :key="p.id" :value="String(p.id)">
              {{ p.name }}
            </SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="xs" title="新建项目" @click="createDialogOpen = true">
          <Plus class="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="xs" title="导入 / 导出场景 JSON" @click="openJsonDialog">
          <Download class="w-3.5 h-3.5" />
        </Button>
        <Button
          v-if="store.projects.length > 1"
          variant="ghost"
          size="xs"
          title="删除当前项目"
          @click="handleDeleteCurrentProject"
        >
          <Trash2 class="w-3.5 h-3.5 text-destructive" />
        </Button>

        <Separator orientation="vertical" class="h-5 mx-1" />

        <!-- 撤销 / 重做 -->
        <Button variant="ghost" size="xs" :disabled="!store.canUndo" title="撤销 (Ctrl+Z)" @click="store.undo()">
          <Undo2 class="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="xs" :disabled="!store.canRedo" title="重做 (Ctrl+Shift+Z)" @click="store.redo()">
          <Redo2 class="w-3.5 h-3.5" />
        </Button>
      </div>

      <!-- 中部：画布模式与缩放辅助 -->
      <div class="flex items-center gap-1.5">
        <ToggleGroup v-model="store.interactionMode" type="single">
          <ToggleGroupItem value="select" title="编辑选择模式">
            <MousePointer2 class="w-3.5 h-3.5" />
            <span>编辑</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="interact" title="穿透交互模式">
            <Hand class="w-3.5 h-3.5" />
            <span>交互</span>
          </ToggleGroupItem>
        </ToggleGroup>
        <SceneHelpTip
          side="bottom"
          text="编辑模式：拖拽、缩放、旋转与框选图层&#10;交互模式：点击穿透到组件内部（测试弹幕机、网页源交互）"
        />

        <Button
          :variant="store.showGrid ? 'secondary' : 'ghost'"
          size="xs"
          title="显示/隐藏网格"
          @click="store.showGrid = !store.showGrid"
        >
          <Grid3x3 class="w-3.5 h-3.5" />
        </Button>
        <Button
          :variant="store.snapEnabled ? 'secondary' : 'ghost'"
          size="xs"
          title="磁吸对齐开关"
          @click="store.snapEnabled = !store.snapEnabled"
        >
          <Magnet class="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="xs" title="自适应画布居中" @click="viewportRef?.fitCanvasToViewport()">
          <Maximize class="w-3.5 h-3.5" />
          <span>{{ Math.round(store.zoom * 100) }}%</span>
        </Button>
      </div>

      <!-- 右侧：OBS 双向联动 + 复制地址 + 保存与发布 -->
      <div class="flex items-center gap-1.5">
        <Button
          :variant="obsBridge.connected.value ? 'secondary' : 'outline'"
          size="xs"
          @click="obsLinkDialogOpen = true"
        >
          <Link2 class="w-3.5 h-3.5" :class="obsBridge.connected.value ? 'text-emerald-500' : ''" />
          <span>{{ obsBridge.connected.value ? `OBS: ${obsBridge.currentScene.value || '已连'}` : '联动本地 OBS' }}</span>
        </Button>

        <Button variant="outline" size="xs" :disabled="!playerUrl" @click="handleCopyPlayerUrl">
          <Check v-if="copiedUrl" class="w-3.5 h-3.5 text-emerald-500" />
          <Copy v-else class="w-3.5 h-3.5" />
          <span>{{ hasObsSources ? '分层源指引' : 'OBS 源链接' }}</span>
        </Button>
        <Button variant="ghost" size="xs" title="新标签页预览播出页" @click="handleOpenPlayerPreview">
          <ExternalLink class="w-3.5 h-3.5" />
        </Button>

        <Separator orientation="vertical" class="h-5 mx-1" />

        <div class="flex items-center gap-1 mr-1">
          <label class="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
            <Switch v-model="store.autoLivePublish" />
            <span>实时同步</span>
          </label>
          <SceneHelpTip
            side="bottom"
            compact
            text="开启后每次修改会在约 1.5 秒后自动发布并热更新 OBS 浏览器源，无需手动点「发布生效」。"
          />
        </div>

        <Button variant="outline" size="xs" :disabled="store.savingDraft" @click="store.saveDraftNow()">
          <Save class="w-3.5 h-3.5" />
          <span>{{ store.savingDraft ? '保存中' : store.isDirty ? '存草稿*' : '已存草稿' }}</span>
        </Button>

        <Button :disabled="store.publishing" size="xs" @click="store.publishNow()">
          <Rocket class="w-3.5 h-3.5" />
          <span>{{ store.publishing ? '发布中' : store.hasUnpublishedChanges ? '发布生效' : `已发布 v${store.currentProject?.publishedVersion ?? 0}` }}</span>
        </Button>
        <SceneHelpTip
          side="bottom"
          compact
          text="「存草稿」仅保存在编辑器内；点击「发布生效」后，OBS 中的浏览器源才会同步最新画面。"
        />

        <Button
          variant="ghost"
          size="xs"
          :title="rightSidebarOpen ? '收起属性检查器' : '展开属性检查器'"
          @click="rightSidebarOpen = !rightSidebarOpen"
        >
          <PanelRightClose v-if="rightSidebarOpen" class="w-3.5 h-3.5" />
          <PanelRightOpen v-else class="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>

    <!-- 三栏工作区：固定优雅侧栏宽度（支持折叠）+ 中间弹性画布 -->
    <div class="flex-1 min-h-0 flex overflow-hidden">
      <aside v-show="leftSidebarOpen" class="w-[232px] shrink-0 h-full overflow-hidden">
        <SceneLeftSidebar
          :obs-connected="obsBridge.connected.value"
          @switch-obs-scene="handleSwitchObsScene"
        />
      </aside>

      <main class="flex-1 min-w-0 h-full overflow-hidden">
        <SceneCanvasViewport
          ref="viewportRef"
          :owner-user-id="store.currentProject?.ownerUserId || account.id"
          :reference-items="obsBridge.referenceItems.value"
          :reference-canvas-size="{ width: obsBridge.baseWidth.value, height: obsBridge.baseHeight.value }"
          :show-reference-overlay="obsBridge.showReferenceOverlay.value"
          :source-previews="obsBridge.sourcePreviews.value"
        />
      </main>

      <aside v-show="rightSidebarOpen" class="w-[272px] shrink-0 h-full overflow-hidden">
        <SceneInspector
          :obs-scenes="obsBridge.scenes.value"
          :obs-connected="obsBridge.connected.value"
          :obs-scene-items="obsBridge.referenceItems.value"
          :vts-status="obsBridge.vtsStatus.value"
          @open-widget-config="openWidgetConfigDrawer"
          @open-question-display-config="openQuestionDisplayConfigModal"
          @open-danmuji-config="openDanmujiConfigModal"
          @refresh-obs-sources="handleRefreshObsSources"
          @capture-source-preview="handleCaptureSourcePreview"
          @sync-layout-to-obs="handleSyncLayoutToObs"
          @test-vts-action="handleTestVtsAction"
          @open-obs-link="obsLinkDialogOpen = true"
          @open-setup-guide="openSetupGuide"
        />
      </aside>
    </div>

    <!-- 本地 OBS 双向联动弹窗 -->
    <ObsLinkDialog
      v-model:open="obsLinkDialogOpen"
      :bridge="obsBridge"
      :doc="store.doc"
      :share-key="store.currentProject?.shareKey || ''"
      :auth-token="authTokenForPlayer"
      :player-url="playerUrl"
      :project-name="store.currentProject?.name || 'OBS 场景'"
      :canvas-width="store.doc.canvas.width"
      :canvas-height="store.doc.canvas.height"
      @open-setup-guide="openSetupGuide"
    />

    <!-- 本地模型 / OBS 分层接入步骤指引弹窗 -->
    <ObsSourceSetupGuideDialog
      v-model:open="setupGuideOpen"
      :default-tab="setupGuideTab"
      :doc="store.doc"
      :project-name="store.currentProject?.name || 'OBS 场景'"
      :share-key="store.currentProject?.shareKey || ''"
      :auth-token="authTokenForPlayer"
      :has-published="Boolean(store.currentProject?.hasPublished)"
      :has-unpublished-changes="store.hasUnpublishedChanges"
      :obs-connected="obsBridge.connected.value"
      :vts-connected="obsBridge.vtsConnected.value"
      :publishing="store.publishing"
      @open-obs-link="setupGuideOpen = false; obsLinkDialogOpen = true"
      @publish-now="store.publishNow()"
      @sync-layout-to-obs="handleSyncLayoutToObs"
    />

    <!-- 新建场景项目弹窗 -->
    <Dialog v-model:open="createDialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新建 OBS 场景项目</DialogTitle>
          <DialogDescription>
            每个项目拥有独立的 OBS 浏览器源地址和多子场景配置。
          </DialogDescription>
        </DialogHeader>
        <div class="py-2">
          <Input
            v-model="newProjectName"
            placeholder="例如：日常杂谈与游戏主场景"
            @keydown.enter="handleCreateProject"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" @click="createDialogOpen = false">取消</Button>
          <Button @click="handleCreateProject">创建</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 导入/导出 JSON & 重置链接弹窗 -->
    <Dialog v-model:open="jsonDialogOpen">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>场景模板导出 / 导入与安全设置</DialogTitle>
          <DialogDescription>
            可备份或跨项目迁移场景布局 JSON；若 OBS 源链接意外泄露，可在此一键重置。
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-3 py-1">
          <Textarea v-model="jsonDraft" rows="12" class="font-mono text-xs" />
          <div class="flex-between">
            <Button variant="outline" size="xs" @click="store.rotateShareKeyNow()">
              <RefreshCw class="w-3.5 h-3.5" />
              <span>重置 OBS 播放链接 Key</span>
            </Button>
            <div class="flex items-center gap-2">
              <Button variant="secondary" size="xs" @click="copyExportedJson">
                <Copy class="w-3.5 h-3.5" />
                <span>复制 JSON</span>
              </Button>
              <Button size="xs" @click="applyImportedJson">
                <Upload class="w-3.5 h-3.5" />
                <span>应用导入</span>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- 提问箱展示样式设置弹窗（含实时画面预览） -->
    <QuestionDisplayConfigModal
      v-model:open="qaConfigModalOpen"
      :layer="qaConfigLayer"
      :owner-user-id="store.currentProject?.ownerUserId || account.id"
    />

    <!-- 弹幕机样式与规则设置弹窗（含真实 DanmujiOBS 实时预览） -->
    <DanmujiConfigModal
      v-model:open="danmujiConfigModalOpen"
      :layer="danmujiConfigLayer"
    />

    <!-- 站内 OBS 组件库详细配置弹窗（宽双栏工作台，透传复用或独立 channelId） -->
    <Dialog v-model:open="configDrawerOpen">
      <DialogContent class="w-[calc(100%-2rem)] max-w-6xl h-[86dvh] max-h-[840px] p-0 flex flex-col overflow-hidden gap-0">
        <DialogHeader class="px-5 py-3 border-b border-border shrink-0 pr-12">
          <DialogTitle class="flex items-center gap-2 text-sm">
            <span>{{ configDrawerDef?.name ?? '组件配置' }}</span>
            <Badge v-if="configDrawerLayer" variant="secondary">
              {{
                configDrawerLayer.widget.configMode === 'isolated'
                  ? `独立通道: ${configDrawerLayer.widget.channelId}`
                  : `复用通道: ${configDrawerLayer.widget.channelId}`
              }}
            </Badge>
          </DialogTitle>
          <DialogDescription class="text-xs">
            修改将实时同步到画布中该组件实例与 OBS 浏览器源。
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 min-h-0 overflow-y-auto p-4 scrollbar-thin">
          <component
            :is="configDrawerComponent"
            v-if="configDrawerComponent && configDrawerLayer"
            :key="`${configDrawerLayer.widget.componentId}:${configDrawerLayer.widget.channelId}`"
            :channel-id="configDrawerLayer.widget.channelId"
          />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

