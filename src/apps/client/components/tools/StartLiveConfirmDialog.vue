<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ExternalLink,
  Layers,
  Loader2,
  Monitor,
  Play,
  Radio,
  SlidersHorizontal,
  Smile,
} from 'lucide-vue-next'
import { computed, watch } from 'vue'
import { type RouteLocationRaw, useRouter } from 'vue-router'

import { isLiveStreaming, roomInfo } from '@/apps/client/data/info'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useLiveRoutine } from '@/apps/client/store/useLiveRoutine'
import { useManagedTools } from '@/apps/client/store/useManagedTools'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useObsSceneControl } from '@/apps/client/store/useObsSceneControl'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { checkClientFeature } from '@/shared/config/clientVersion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Separator } from '@/shared/ui/separator'
import { useWebFetcher } from '@/store/useWebFetcher'

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const liveRoutine = useLiveRoutine()
const obs = useOBSStore()
const vts = useVtsStore()
const biliCookie = useBiliCookie()
const webfetcher = useWebFetcher()
const managedTools = useManagedTools()
const sceneCtrl = useObsSceneControl()

watch(open, async (val) => {
  if (!val) return
  await liveRoutine.init()
  const projectId = liveRoutine.config.start.obsSceneProjectId
  if (projectId) {
    await sceneCtrl.refreshProjects()
    await sceneCtrl.loadProject(projectId)
  }
})

const hasNativeTools = computed(() => checkClientFeature('tool-manager').supported)
const hasObsConfigRead = computed(() => checkClientFeature('obs-config').supported)

const roomAreaText = computed(() => {
  if (!roomInfo.value?.parent_area_name) return '未选择分区'
  return `${roomInfo.value.parent_area_name} / ${roomInfo.value.area_name || '—'}`
})

const cookieWarning = computed(() => {
  if (!biliCookie.hasBiliCookie) return '尚未同步 B 站 Cookie，可能无法修改标题、开播或发送弹幕'
  if (!biliCookie.isCookieValid) return 'B 站 Cookie 已失效，建议先前往「账号与凭据」重新扫码'
  return ''
})

interface PlannedStep {
  key: string
  label: string
  detail: string
  skippedHint?: string
  route: RouteLocationRaw
}

const plannedSteps = computed<PlannedStep[]>(() => {
  const s = liveRoutine.config.start
  const steps: PlannedStep[] = []

  if (s.launchVts) {
    steps.push({
      key: 'launch-vts',
      label: '启动 VTube Studio',
      detail: managedTools.snapshot?.vts.running ? '检测到已在运行' : '按托管配置拉起',
      skippedHint: !hasNativeTools.value ? '需宿主 ≥ v0.1.14（将跳过）' : undefined,
      route: { name: 'client-tools', query: { tab: hasNativeTools.value ? 'overview' : 'capabilities' } },
    })
  }
  if (s.launchObs) {
    steps.push({
      key: 'launch-obs',
      label: '启动 OBS Studio',
      detail: managedTools.snapshot?.obs.running ? '检测到已在运行' : '按启动参数拉起',
      skippedHint: !hasNativeTools.value ? '需宿主 ≥ v0.1.14（将跳过）' : undefined,
      route: { name: 'client-tools', query: { tab: hasNativeTools.value ? 'overview' : 'capabilities' } },
    })
  }
  if (s.syncObsConfigFromDisk) {
    steps.push({
      key: 'sync-obs-cfg',
      label: '同步本机 OBS WebSocket 配置',
      detail: obs.obsAddress || 'ws://127.0.0.1:4455',
      skippedHint: !hasObsConfigRead.value ? '需宿主 ≥ v0.1.14（沿用已存）' : undefined,
      route: { name: 'client-tools', query: { tab: hasObsConfigRead.value ? 'overview' : 'capabilities' } },
    })
  }
  if (s.connectObs || s.connectVts) {
    const targets = [s.connectObs ? 'OBS' : null, s.connectVts ? 'VTS' : null].filter(Boolean).join(' + ')
    steps.push({
      key: 'connect',
      label: `自动连接 ${targets}`,
      detail: `${obs.obsConnected ? 'OBS 已连' : 'OBS 待连'} · ${vts.connected ? 'VTS 已连' : 'VTS 待连'}`,
      route: s.connectObs && !obs.obsConnected ? { name: 'client-live-manage' } : { name: 'client-vts' },
    })
  }
  if (s.obsProfile.trim()) {
    steps.push({ key: 'obs-profile', label: '切换 OBS Profile', detail: s.obsProfile.trim(), route: { name: 'client-live-manage' } })
  }
  if (s.obsSceneCollection.trim()) {
    steps.push({ key: 'obs-collection', label: '切换 OBS 场景集合', detail: s.obsSceneCollection.trim(), route: { name: 'client-live-manage' } })
  }

  const targetScene =
    s.obsTargetScene.trim() ||
    (s.useWaitingSceneFallback ? obs.obsSceneConfig.waitingScene || obs.obsSceneConfig.startScene || '' : '')
  if (targetScene) {
    steps.push({ key: 'obs-scene', label: '切换 OBS 本地场景', detail: targetScene, route: { name: 'client-live-manage' } })
  }

  if (s.obsSceneProjectId && s.obsSubSceneId) {
    const proj = sceneCtrl.projects.find((p) => p.id === s.obsSceneProjectId)
    const sub = sceneCtrl.getSubScenesFor(s.obsSceneProjectId).find((item) => item.id === s.obsSubSceneId)
    steps.push({
      key: 'obs-scene-sub',
      label: '切换 VTsuru 场景子场景',
      detail: `${proj?.name || `#${s.obsSceneProjectId}`} / ${sub?.name || s.obsSubSceneId}${s.syncObsSceneLayout ? '（并推送布局到 OBS）' : ''}`,
      route: { path: '/manage/obs-scene-editor', query: { id: String(s.obsSceneProjectId) } },
    })
  }

  if (s.enableReplayBuffer) {
    steps.push({
      key: 'obs-replay',
      label: '开启 OBS 回放缓存',
      detail: obs.obsReplayBufferActive ? '当前已开启' : '自动启用高光回放',
      route: { name: 'client-live-manage' },
    })
  }

  if (s.vtsModelId) {
    const model = vts.availableModels.find((m) => m.modelID === s.vtsModelId)
    steps.push({ key: 'vts-model', label: '切换 VTS 模型', detail: model?.modelName || s.vtsModelId, route: { name: 'client-vts' } })
  }
  if (s.vtsPresetId) {
    const preset = vts.presets.find((p) => p.id === s.vtsPresetId)
    steps.push({ key: 'vts-preset', label: '应用 VTS 机位预设', detail: preset?.name || s.vtsPresetId, route: { name: 'client-vts' } })
  }
  if (s.vtsPostProcessingPreset.trim()) {
    steps.push({ key: 'vts-pp', label: '启用 VTS 后处理滤镜', detail: s.vtsPostProcessingPreset.trim(), route: { name: 'client-vts' } })
  }

  const extras: string[] = []
  if (s.openDanmakuWindow) extras.push('弹幕浮窗')
  if (s.openGiftWindow) extras.push('礼物浮窗')
  if (s.startTranscription) extras.push('语音转写')
  if (extras.length > 0) {
    steps.push({
      key: 'extras',
      label: '启动配套组件',
      detail: extras.join(' · '),
      route: { name: 'client-tools', query: { tab: 'routine' } },
    })
  }

  return steps
})

function handleConfirmExecute() {
  open.value = false
  void liveRoutine.executeStartRoutine()
}

function navigateTo(target: RouteLocationRaw) {
  open.value = false
  void router.push(target)
}
</script>

<template>
  <Dialog
    :open="open"
    @update:open="(v) => (open = v)"
  >
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-base">
          <Play class="size-4 text-primary" />
          开播准备确认
        </DialogTitle>
        <DialogDescription>
          请核对当前直播间信息与即将执行的准备步骤，确认无误后一键执行。
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-3 py-1">
        <!-- 1. 直播间关键信息 -->
        <div class="rounded-md border border-border bg-muted/25 p-3 space-y-2">
          <div class="flex-between gap-2">
            <div class="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <Radio class="size-3.5 text-primary" />
              直播间信息
            </div>
            <div class="flex items-center gap-1.5">
              <Badge
                :variant="isLiveStreaming ? 'success' : 'secondary'"
                size="xs"
              >
                {{ isLiveStreaming ? '直播中' : '未开播' }}
              </Badge>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                class="gap-1 text-primary"
                @click="navigateTo({ name: 'client-live-manage' })"
              >
                修改标题/分区
                <ExternalLink class="size-3" />
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div class="min-w-0">
              <div class="text-[11px] text-muted-foreground">直播标题</div>
              <div
                class="font-medium text-foreground truncate mt-0.5"
                :title="roomInfo?.title || '未设置标题'"
              >
                {{ roomInfo?.title || '未设置标题' }}
              </div>
            </div>
            <div class="min-w-0">
              <div class="text-[11px] text-muted-foreground">直播分区</div>
              <div class="font-medium text-foreground truncate mt-0.5">
                {{ roomAreaText }}
              </div>
            </div>
          </div>
        </div>

        <!-- Cookie 异常提醒 -->
        <Alert
          v-if="cookieWarning"
          size="sm"
          variant="warning"
        >
          <AlertTriangle class="size-3.5" />
          <div class="flex-between gap-2 w-full flex-wrap">
            <AlertDescription class="m-0">{{ cookieWarning }}</AlertDescription>
            <Button
              type="button"
              size="xs"
              variant="outline"
              class="gap-1 shrink-0"
              @click="navigateTo({ name: 'client-account-manage' })"
            >
              前往同步
              <ChevronRight class="size-3" />
            </Button>
          </div>
        </Alert>

        <!-- 2. 工具连接就绪速览（点击直达对应设置页） -->
        <div class="grid grid-cols-3 gap-2">
          <button
            type="button"
            class="group text-left rounded-md border border-border bg-card p-2 space-y-1 transition-colors hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="前往 OBS 控制与配置"
            @click="navigateTo({ name: 'client-live-manage' })"
          >
            <div class="flex-between gap-1">
              <span class="text-[11px] font-medium flex items-center gap-1">
                <Monitor class="size-3 text-sky-500" />
                OBS
              </span>
              <Badge
                :variant="obs.obsConnected ? 'success' : 'secondary'"
                size="xs"
              >
                {{ obs.obsConnected ? '已连' : '待连' }}
              </Badge>
            </div>
            <div class="flex-between gap-1 text-[11px] text-muted-foreground">
              <span class="truncate">{{ obs.obsConnected ? obs.currentObsScene || '已就绪' : obs.obsAddress }}</span>
              <ChevronRight class="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>

          <button
            type="button"
            class="group text-left rounded-md border border-border bg-card p-2 space-y-1 transition-colors hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="前往 VTube Studio 控制"
            @click="navigateTo({ name: 'client-vts' })"
          >
            <div class="flex-between gap-1">
              <span class="text-[11px] font-medium flex items-center gap-1">
                <Smile class="size-3 text-purple-500" />
                VTS
              </span>
              <Badge
                :variant="vts.connected ? 'success' : 'secondary'"
                size="xs"
              >
                {{ vts.connected ? '已连' : '待连' }}
              </Badge>
            </div>
            <div class="flex-between gap-1 text-[11px] text-muted-foreground">
              <span class="truncate">{{ vts.connected ? vts.currentModelName || '已就绪' : '未连接' }}</span>
              <ChevronRight class="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>

          <button
            type="button"
            class="group text-left rounded-md border border-border bg-card p-2 space-y-1 transition-colors hover:border-primary/60 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title="前往 EventFetcher 采集配置"
            @click="navigateTo({ name: 'client-fetcher' })"
          >
            <div class="flex-between gap-1">
              <span class="text-[11px] font-medium flex items-center gap-1">
                <Layers class="size-3 text-blue-500" />
                采集
              </span>
              <Badge
                :variant="webfetcher.state === 'connected' ? 'success' : 'destructive'"
                size="xs"
              >
                {{ webfetcher.state === 'connected' ? '正常' : '断开' }}
              </Badge>
            </div>
            <div class="flex-between gap-1 text-[11px] text-muted-foreground">
              <span class="truncate">{{ webfetcher.webfetcherType === 'direct' ? '直连模式' : '开放平台' }}</span>
              <ChevronRight class="size-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </div>
          </button>
        </div>

        <Separator />

        <!-- 3. 即将执行的开播步骤 -->
        <div class="space-y-1.5">
          <div class="flex-between gap-2">
            <span class="text-xs font-semibold text-foreground">本次将执行的步骤</span>
            <Badge
              variant="secondary"
              size="xs"
              class="tabular-nums"
            >
              共 {{ plannedSteps.length }} 项
            </Badge>
          </div>

          <div
            v-if="plannedSteps.length === 0"
            class="py-4 text-center text-xs text-muted-foreground rounded-md border border-dashed border-border"
          >
            尚未勾选任何开播准备步骤，请点击左下角「修改编排步骤」进行配置。
          </div>

          <div
            v-else
            class="max-h-[210px] overflow-y-auto scrollbar-thin space-y-1 pr-1"
          >
            <button
              v-for="(step, idx) in plannedSteps"
              :key="step.key"
              type="button"
              class="group w-full flex-between gap-2 px-2.5 py-1.5 rounded-md border border-border/70 bg-muted/20 text-xs text-left transition-colors hover:border-primary/50 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              title="点击前往对应配置页"
              @click="navigateTo(step.route)"
            >
              <div class="flex items-center gap-2 min-w-0">
                <CheckCircle2
                  v-if="!step.skippedHint"
                  class="size-3.5 text-emerald-500 shrink-0"
                />
                <CircleDot
                  v-else
                  class="size-3.5 text-amber-500 shrink-0"
                />
                <span class="font-medium text-foreground truncate">{{ idx + 1 }}. {{ step.label }}</span>
              </div>
              <div class="flex items-center gap-1 min-w-0 max-w-[52%] shrink-0">
                <span
                  class="text-[11px] truncate"
                  :class="step.skippedHint ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'"
                  :title="step.skippedHint || step.detail"
                >
                  {{ step.skippedHint || step.detail }}
                </span>
                <ChevronRight class="size-3 text-muted-foreground shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </button>
          </div>
        </div>
      </div>

      <DialogFooter class="flex flex-row items-center justify-between gap-2 pt-2 sm:justify-between">
        <Button
          type="button"
          size="xs"
          variant="ghost"
          class="gap-1 text-muted-foreground"
          @click="navigateTo({ name: 'client-tools', query: { tab: 'routine' } })"
        >
          <SlidersHorizontal class="size-3" />
          修改编排步骤
        </Button>

        <div class="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            @click="open = false"
          >
            取消
          </Button>
          <Button
            type="button"
            class="gap-1.5"
            :disabled="plannedSteps.length === 0 || Boolean(liveRoutine.runningMode)"
            @click="handleConfirmExecute"
          >
            <Loader2
              v-if="liveRoutine.runningMode === 'start'"
              class="size-3.5 animate-spin"
            />
            <Play
              v-else
              class="size-3.5"
            />
            确认并执行
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
