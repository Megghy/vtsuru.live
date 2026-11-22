<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import {
  CheckCircle2,
  Copy,
  Eye,
  Layers,
  LayoutGrid,
  Link2,
  Plug,
  RefreshCw,
  Send,
  Sparkles,
  Unplug,
} from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'

import type { useObsLocalBridge } from '../composables/useObsLocalBridge'
import type { ObsSceneDocument } from '../types'
import { buildObsScenePlayerUrl } from '../types'
import {
  buildSceneCompositionPlan,
  buildSlotBrowserSourceName,
  buildSyncLayoutParamsForScene,
} from '../utils/sceneSlices'

const props = defineProps<{
  open: boolean
  bridge: ReturnType<typeof useObsLocalBridge>
  doc: ObsSceneDocument
  shareKey: string
  authToken?: string
  playerUrl: string
  projectName: string
  canvasWidth: number
  canvasHeight: number
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  openSetupGuide: [tab: 'obs-layout' | 'model-capture']
}>()

const { copy } = useClipboard()
const targetSceneName = ref('')
const sourceName = ref('')
const pushingSource = ref(false)

const compositionPlan = computed(() => buildSceneCompositionPlan(props.doc, props.doc.activeSceneId))
const isSlicedMode = computed(() => compositionPlan.value.mode === 'sliced')
const stackTopToBottom = computed(() => compositionPlan.value.activeStack.toReversed())
const resolvedBaseSourceName = computed(() => sourceName.value.trim() || `VTsuru - ${props.projectName}`)

const slotUrlList = computed(() => {
  if (!props.shareKey) return []
  return compositionPlan.value.slots.map((slot) => ({
    key: slot.key,
    label: slot.label,
    sourceName: buildSlotBrowserSourceName(resolvedBaseSourceName.value, slot, compositionPlan.value.mode),
    url: buildObsScenePlayerUrl(props.shareKey, undefined, props.authToken, slot.slotParam),
  }))
})

watch(
  () => [props.open, props.bridge.currentScene.value, props.projectName] as const,
  ([isOpen, curScene, projName]) => {
    if (!isOpen) return
    if (!targetSceneName.value && curScene) {
      targetSceneName.value = curScene
    }
    if (!sourceName.value && projName) {
      sourceName.value = `VTsuru - ${projName}`
    }
  },
  { immediate: true },
)

const isConnected = computed(() => props.bridge.connected.value)

async function handleCopySlotUrl(url: string, label: string) {
  await copy(url)
  toast.success(`已复制「${label}」浏览器源链接`)
}

async function handleConnectClient() {
  const ok = await props.bridge.connectViaClientRpc()
  if (ok && props.bridge.connected.value) {
    toast.success('已通过桌面客户端连接本地 OBS')
  } else if (ok) {
    toast.warning('已连上桌面客户端，请先在客户端内连接 OBS WebSocket')
  } else {
    toast.error('未检测到运行中的 VTsuru 桌面客户端，可在下方直接填写 OBS WebSocket 地址连接')
  }
}

async function handleConnectDirect() {
  const ok = await props.bridge.connectDirect()
  if (ok) toast.success('已直连本地 OBS WebSocket')
  else toast.error(props.bridge.error.value || '直连 OBS 失败')
}

async function handlePullReferences() {
  try {
    const items = await props.bridge.refreshSceneItems(targetSceneName.value || undefined)
    props.bridge.showReferenceOverlay.value = true
    toast.success(`已拉取「${props.bridge.referenceSceneName.value}」的 ${items.length} 个本地源布局作为参考框`)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '拉取本地 OBS 源布局失败')
  }
}

async function handlePushToObs() {
  if (!props.playerUrl || !props.shareKey) {
    toast.error('请先发布场景后再添加到 OBS')
    return
  }
  const scene = targetSceneName.value || props.bridge.currentScene.value
  if (!scene) {
    toast.error('请选择目标 OBS 场景')
    return
  }
  pushingSource.value = true
  try {
    if (isSlicedMode.value) {
      const params = buildSyncLayoutParamsForScene({
        doc: props.doc,
        sceneId: props.doc.activeSceneId,
        obsSceneName: scene,
        baseSourceName: resolvedBaseSourceName.value,
        shareKey: props.shareKey,
        authToken: props.authToken,
      })
      const res = await props.bridge.syncSceneLayoutToObs(params)
      if (res.ok) {
        toast.success(res.message || '已同步分层布局到 OBS')
        if (res.warnings?.length) {
          toast.warning(res.warnings.join('；'))
        }
      } else {
        toast.error(res.message || '同步分层布局到 OBS 失败')
      }
      return
    }

    const res = await props.bridge.pushOverlayToObs({
      sceneName: scene,
      sourceName: resolvedBaseSourceName.value,
      url: props.playerUrl,
      width: props.canvasWidth,
      height: props.canvasHeight,
    })
    if (res.ok) {
      toast.success(res.message || '已写入本地 OBS')
    } else {
      toast.error(res.message || '写入本地 OBS 失败')
    }
  } finally {
    pushingSource.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Link2 class="w-4 h-4 text-primary" />
          <span>本地 OBS 双向联动</span>
          <Badge :variant="isConnected ? 'default' : 'secondary'">
            {{ bridge.transportLabel.value }}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          支持一键写入浏览器源、拉取本地 OBS 摄像头/游戏框作为排版参考，以及切场自动同步。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-1">
        <!-- 连接区 -->
        <div class="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
          <div class="flex-between gap-2">
            <div class="text-xs font-medium text-foreground">连接方式</div>
            <div class="flex items-center gap-1.5">
              <Button
                variant="secondary"
                size="xs"
                :disabled="bridge.connecting.value"
                @click="handleConnectClient"
              >
                <Plug class="w-3.5 h-3.5" />
                <span>自动连桌面客户端</span>
              </Button>
              <Button
                v-if="bridge.transport.value !== 'disconnected'"
                variant="ghost"
                size="xs"
                @click="bridge.disconnect()"
              >
                <Unplug class="w-3.5 h-3.5" />
                <span>断开</span>
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
            <FormField label="或直连 OBS WebSocket 地址" class="min-w-0">
              <Input v-model="bridge.directAddress.value" placeholder="ws://127.0.0.1:4455" />
            </FormField>
            <FormField label="连接密码" class="min-w-0">
              <Input v-model="bridge.directPassword.value" type="password" placeholder="可选" />
            </FormField>
            <Button :disabled="bridge.connecting.value" @click="handleConnectDirect">
              直连
            </Button>
          </div>

          <p v-if="bridge.error.value" class="text-xs text-destructive">
            {{ bridge.error.value }}
          </p>
        </div>

        <!-- 已连接后的双向操作 -->
        <template v-if="isConnected">
          <div class="space-y-3">
            <div class="flex-between">
              <span class="text-xs font-medium text-foreground flex items-center gap-1.5">
                <CheckCircle2 class="w-3.5 h-3.5 text-emerald-500" />
                当前 OBS 场景：{{ bridge.currentScene.value || '-' }}（{{ bridge.baseWidth.value }}×{{ bridge.baseHeight.value }}）
              </span>
              <Button variant="ghost" size="xs" @click="bridge.refreshStatus()">
                <RefreshCw class="w-3.5 h-3.5" />
              </Button>
            </div>

            <div class="grid grid-cols-2 gap-2.5">
              <FormField label="目标 OBS 场景" class="min-w-0">
                <Select v-model="targetSceneName">
                  <SelectTrigger class="w-full"><SelectValue placeholder="选择 OBS 场景" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="s in bridge.scenes.value" :key="s" :value="s">
                      {{ s }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              <FormField label="浏览器源名称" class="min-w-0">
                <Input v-model="sourceName" placeholder="VTsuru Overlay" />
              </FormField>
            </div>

            <div class="flex items-center gap-2">
              <Button class="flex-1" :disabled="pushingSource" @click="handlePushToObs">
                <Send class="w-3.5 h-3.5" />
                <span>
                  {{
                    pushingSource
                      ? '写入中...'
                      : isSlicedMode
                        ? `一键同步分层布局（${compositionPlan.slots.length} 浏览器源 + ${compositionPlan.activeObsSources.length} 本地源）`
                        : '一键添加到 / 更新 OBS 源'
                  }}
                </span>
              </Button>
              <Button
                variant="secondary"
                :disabled="bridge.loadingReferences.value"
                @click="handlePullReferences"
              >
                <LayoutGrid class="w-3.5 h-3.5" />
                <span>拉取底图参考框</span>
              </Button>
            </div>

            <!-- 多段切片预览：当场景包含 VTS / 游戏等本地源时清晰展示 OBS 夹心顺序 -->
            <div
              v-if="isSlicedMode"
              class="rounded-lg border border-border bg-muted/25 p-2.5 space-y-2"
            >
              <div class="flex-between">
                <span class="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Layers class="w-3.5 h-3.5 text-violet-500" />
                  <span>OBS 夹心层级编排（从顶到底）</span>
                </span>
                <Badge v-if="bridge.vtsConnected.value" variant="secondary">
                  <Sparkles class="w-3 h-3 mr-1 text-emerald-500" />
                  VTS 已连
                </Badge>
              </div>

              <div class="space-y-1">
                <div
                  v-for="(entry, idx) in stackTopToBottom"
                  :key="entry.kind === 'obs-source' ? `obs-${entry.layerId}` : `slot-${entry.slotKey}-${idx}`"
                  class="flex-between gap-2 rounded px-2 py-1 text-xs"
                  :class="
                    entry.kind === 'obs-source'
                      ? 'bg-violet-500/12 border border-violet-500/30 text-foreground'
                      : 'bg-background/80 border border-border text-muted-foreground'
                  "
                >
                  <div class="flex items-center gap-1.5 min-w-0">
                    <Sparkles v-if="entry.kind === 'obs-source'" class="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <Layers v-else class="w-3.5 h-3.5 text-sky-500 shrink-0" />
                    <span class="truncate font-medium">
                      {{
                        entry.kind === 'obs-source'
                          ? `本地源：${entry.layer.obsSource.sourceName || '未绑定'} (${entry.layer.name})`
                          : `${resolvedBaseSourceName} [${entry.label}] (${entry.layerIds.length} 层)`
                      }}
                    </span>
                  </div>
                  <Button
                    v-if="entry.kind === 'browser-slot'"
                    variant="ghost"
                    size="xs"
                    class="shrink-0"
                    title="复制此切片浏览器源链接"
                    @click="
                      () => {
                        const target = slotUrlList.find((s) => s.key === entry.slotKey)
                        if (target) void handleCopySlotUrl(target.url, target.label)
                      }
                    "
                  >
                    <Copy class="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div class="space-y-2">
            <SettingRow
              variant="compact"
              title="切场自动联动"
              description="本地 OBS 切换场景时，自动切换匹配绑定的云端 Overlay 子场景"
            >
              <Switch v-model="bridge.autoSyncScene.value" />
            </SettingRow>

            <SettingRow
              variant="compact"
              description="仅在编辑器画布底层显示，不影响 OBS 实际播出画面"
            >
              <template #title>
                <span class="font-medium text-foreground flex items-center gap-1.5">
                  <Eye class="w-3.5 h-3.5 shrink-0" />
                  <span>显示本地源底图参考框</span>
                </span>
              </template>
              <template v-if="bridge.referenceItems.value.length" #badge>
                <Badge size="xs" variant="secondary">
                  {{ bridge.referenceItems.value.length }} 项
                </Badge>
              </template>
              <Switch v-model="bridge.showReferenceOverlay.value" />
            </SettingRow>
          </div>
        </template>

        <!-- 未连接 OBS 但含本地源时，直接提供免 WebSocket 手动分层配置入口 -->
        <div
          v-else-if="isSlicedMode"
          class="rounded-lg border border-border bg-muted/25 p-3 flex-between gap-2 flex-wrap"
        >
          <div class="text-xs text-muted-foreground leading-relaxed flex-1 min-w-[200px]">
            <strong class="text-foreground font-medium">
              {{
                compositionPlan.activeObsSources.length > 0
                  ? `当前子场景包含 ${compositionPlan.activeObsSources.length} 个本地模型/采集源`
                  : `本项目已启用 ${compositionPlan.slots.length} 个分层槽位`
              }}
            </strong>，即使不连接 OBS WebSocket 也可以按顺序手动添加分层浏览器源。
          </div>
          <Button
            variant="secondary"
            size="xs"
            @click="emit('update:open', false); emit('openSetupGuide', 'obs-layout')"
          >
            <Layers class="size-3.5" />
            <span>查看分层链接与步骤</span>
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
