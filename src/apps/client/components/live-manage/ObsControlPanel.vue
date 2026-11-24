<script setup lang="ts">
import {
  AlertCircle,
  BookmarkCheck,
  Download,
  HelpCircle,
  Play,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  Wand2,
} from 'lucide-vue-next'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { useManagedTools } from '@/apps/client/store/useManagedTools'
import { useOBSStore } from '@/apps/client/store/useOBSStore'

import ObsLiveMonitor from './ObsLiveMonitor.vue'
import ObsSceneQuickPanel from './ObsSceneQuickPanel.vue'
import ObsSourceLayerPanel from './ObsSourceLayerPanel.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Slider } from '@/shared/ui/slider'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

defineProps<{ control?: LiveControl }>()
const obsStore = useOBSStore()
const managedTools = useManagedTools()
const sceneOptions = computed(() => obsStore.obsScenes.map((s) => ({ label: s, value: s })))
const savingReplay = ref(false)
const insertingVtsSource = ref(false)
const audioLevels = ref<Record<string, number>>({})
let unsubscribeVolume: (() => void) | null = null

onMounted(() => {
  unsubscribeVolume = obsStore.subscribeInputVolume((sample) => {
    const clamped = Math.max(0, Math.min(100, sample.muted ? 0 : sample.volume))
    if (Math.abs((audioLevels.value[sample.inputName] ?? 0) - clamped) >= 1) {
      audioLevels.value = {
        ...audioLevels.value,
        [sample.inputName]: clamped,
      }
    }
  })
})

onBeforeUnmount(() => {
  unsubscribeVolume?.()
  unsubscribeVolume = null
})

function vuBarClass(level: number): string {
  if (level >= 88) return 'bg-destructive'
  if (level >= 65) return 'bg-amber-500'
  return 'bg-emerald-500'
}

const handleToggleConnect = () => {
  if (obsStore.obsConnected) {
    obsStore.handleObsDisconnect()
  } else {
    obsStore.handleObsConnect()
  }
}

async function handleSaveReplay() {
  if (savingReplay.value) return
  savingReplay.value = true
  try {
    const res = await obsStore.saveReplayBuffer()
    if (res.ok) toast.success(res.message)
    else toast.warning(res.message)
  } finally {
    savingReplay.value = false
  }
}

async function handleInsertVtsSource(mode: 'spout2' | 'ndi' | 'game_capture') {
  if (insertingVtsSource.value) return
  insertingVtsSource.value = true
  try {
    const res = await obsStore.insertVtsCaptureSource({ mode })
    if (res.ok) toast.success(res.message)
    else toast.warning(res.message)
  } catch (err) {
    toast.error(`插入采集源失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    insertingVtsSource.value = false
  }
}

async function handleEnableObsWs() {
  const existing = managedTools.snapshot?.obs.websocketConfig
  await managedTools.configureObsWebsocket({
    enabled: true,
    port: existing?.serverPort ?? 4455,
    authRequired: existing?.authRequired ?? false,
    password: existing?.serverPassword ?? '',
  })
}
</script>

<template>
  <Card>
    <CardHeader class="p-3 border-b flex-row items-center justify-between space-y-0">
      <CardTitle>OBS 控制与统计</CardTitle>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="xs"
              class="gap-1 text-muted-foreground cursor-help"
            >
              <HelpCircle class="size-3.5" />
              使用说明
            </Button>
          </TooltipTrigger>
          <TooltipContent class="max-w-[280px] space-y-1.5 p-3">
            <p class="font-semibold text-foreground">在 OBS 中开启 WebSocket 服务：</p>
            <ol class="pl-4 list-decimal space-y-0.5 text-muted-foreground">
              <li>在 OBS 菜单中选择「工具 - WebSocket 服务器设置」</li>
              <li>勾选「开启 WebSocket 服务器」</li>
              <li>设置密码或留空</li>
              <li>点击「应用」，记下端口（默认 4455）与密码</li>
            </ol>
            <p class="text-[11px] text-muted-foreground pt-1 border-t border-border/50">
              在下方输入对应连接信息，点击「连接 OBS」即可
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardHeader>

    <CardContent class="p-3 space-y-4">
      <!-- 快捷推流与回放缓存控制 -->
      <div class="flex-between flex-wrap gap-2">
        <div class="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            :variant="obsStore.obsStreamActive ? 'destructive' : 'default'"
            :disabled="!obsStore.obsConnected || obsStore.isTogglingObsStream"
            class="gap-1.5"
            @click="obsStore.handleObsToggleStream"
          >
            <Square
              v-if="obsStore.obsStreamActive"
              class="size-3.5 fill-current"
            />
            <Play
              v-else
              class="size-3.5 fill-current"
            />
            {{ obsStore.obsStreamActive ? '停止推流' : '开始推流' }}
          </Button>
          <Button
            type="button"
            variant="outline"
            :disabled="!obsStore.obsConnected"
            class="gap-1.5"
            @click="obsStore.toggleReplayBuffer"
          >
            {{ obsStore.obsReplayBufferActive ? '关闭回放缓存' : '开启回放缓存' }}
          </Button>
          <Button
            type="button"
            variant="secondary"
            :disabled="!obsStore.obsConnected || !obsStore.obsReplayBufferActive || savingReplay"
            class="gap-1.5"
            @click="handleSaveReplay"
          >
            <BookmarkCheck class="size-3.5" />
            保存高光回放
          </Button>
        </div>

        <Badge v-if="obsStore.obsStreamReconnecting" variant="warning" class="py-0.5">
          推流重连中
        </Badge>
      </div>

      <!-- OBS WebSocket 连接参数配置 -->
      <div class="space-y-2 p-3 rounded-lg border border-border bg-muted/20">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <FormField
            label="WebSocket 地址"
            placeholder="ws://127.0.0.1:4455"
            :disabled="obsStore.obsConnected"
            class="font-mono"
            v-model="obsStore.obsAddress"
          />

          <FormField
            type="password"
            label="连接密码（可选）"
            placeholder="无密码可留空"
            :disabled="obsStore.obsConnected"
            v-model="obsStore.obsPassword"
          />
        </div>

        <div class="flex-between pt-1">
          <Button
            type="button"
            :variant="obsStore.obsConnected ? 'outline' : 'default'"
            :disabled="obsStore.obsConnecting"
            class="gap-1.5"
            @click="handleToggleConnect"
          >
            <RefreshCw
              v-if="obsStore.obsConnecting"
              class="size-3.5 animate-spin"
            />
            {{ obsStore.obsConnected ? '断开 OBS' : '连接 OBS' }}
          </Button>

          <!-- 状态徽章 -->
          <div
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border"
            :class="
              obsStore.obsConnected
                ? obsStore.obsStreamActive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  : 'bg-primary/10 text-primary border-primary/30'
                : 'bg-muted text-muted-foreground border-border'
            "
          >
            <span
              class="size-1.5 rounded-full"
              :class="
                obsStore.obsConnected
                  ? obsStore.obsStreamActive
                    ? 'bg-emerald-500 animate-pulse'
                    : 'bg-primary'
                  : 'bg-muted-foreground/60'
              "
            />
            {{ obsStore.obsConnected ? (obsStore.obsStreamActive ? '已连接 · 正在推流' : '已连接') : '未连接' }}
          </div>
        </div>

        <!-- 错误提示 -->
        <Alert size="sm" v-if="obsStore.obsError" class="border-destructive/30 bg-destructive/10 text-destructive mt-2">
          <div class="flex items-center gap-1.5">
            <AlertCircle class="size-4 shrink-0" />
            <AlertDescription class="m-0">
              {{ obsStore.obsError }}
            </AlertDescription>
          </div>
        </Alert>

        <!-- 原生自动配对 (0.1.14+) -->
        <div class="pt-2 border-t border-border/70">
          <ClientMinVersionNotice
            feature="obs-config"
            compact
          >
            <div class="flex items-center gap-2 flex-wrap">
              <Button
                type="button"
                size="xs"
                variant="outline"
                class="gap-1"
                @click="managedTools.syncObsWebsocketFromDisk(true)"
              >
                <Download class="size-3" />
                从本机 OBS 自动读取端口与密码
              </Button>
              <Button
                type="button"
                size="xs"
                variant="outline"
                class="gap-1"
                @click="handleEnableObsWs"
              >
                <Wand2 class="size-3" />
                一键开启 OBS WebSocket
              </Button>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                :disabled="managedTools.launchingTool === 'obs'"
                @click="managedTools.launchObs()"
              >
                <Play class="size-3 mr-1" />
                启动 OBS
              </Button>
            </div>
          </ClientMinVersionNotice>
        </div>
      </div>

      <!-- 实时流统计网格 -->
      <div class="space-y-2">
        <span class="text-xs font-semibold text-foreground block">实时推流监控</span>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <!-- 码率 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">当前码率</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block font-mono">
              {{ obsStore.obsStats.bitrateKbps != null ? `${obsStore.obsStats.bitrateKbps.toFixed(0)} kbps` : '—' }}
            </span>
          </div>

          <!-- 帧率 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">帧率 (FPS)</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block font-mono">
              {{ obsStore.obsStats.fps != null ? `${obsStore.obsStats.fps.toFixed(1)} fps` : '—' }}
            </span>
          </div>

          <!-- 丢帧率 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">丢帧率（输出）</span>
            <TooltipProvider
              v-if="
                obsStore.obsStats.outputSkippedFrames != null &&
                obsStore.obsStats.outputTotalFrames != null &&
                obsStore.obsStats.outputTotalFrames > 0
              "
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <span
                    class="text-sm font-semibold mt-0.5 block font-mono cursor-help"
                    :class="
                      (obsStore.obsStats.outputSkippedFrames / obsStore.obsStats.outputTotalFrames) * 100 > 2
                        ? 'text-amber-500'
                        : 'text-foreground'
                    "
                  >
                    {{
                      ((obsStore.obsStats.outputSkippedFrames / obsStore.obsStats.outputTotalFrames) * 100).toFixed(2)
                    }}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {{ obsStore.obsStats.outputSkippedFrames }} / {{ obsStore.obsStats.outputTotalFrames }} 帧
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              v-else
              class="text-sm font-semibold text-foreground mt-0.5 block font-mono"
              >—</span
            >
          </div>

          <!-- CPU 使用率 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">CPU 使用率</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block font-mono">
              {{ obsStore.obsStats.cpuUsage != null ? `${obsStore.obsStats.cpuUsage.toFixed(1)} %` : '—' }}
            </span>
          </div>

          <!-- 内存使用 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">OBS 内存占用</span>
            <span class="text-sm font-semibold text-foreground mt-0.5 block font-mono">
              {{ obsStore.obsStats.memoryUsage != null ? `${obsStore.obsStats.memoryUsage.toFixed(0)} MB` : '—' }}
            </span>
          </div>

          <!-- 渲染跳帧 -->
          <div class="p-2.5 rounded-md border border-border bg-card">
            <span class="text-[11px] text-muted-foreground block">渲染跳帧</span>
            <TooltipProvider
              v-if="
                obsStore.obsStats.renderSkippedFrames != null &&
                obsStore.obsStats.renderTotalFrames != null &&
                obsStore.obsStats.renderTotalFrames > 0
              "
            >
              <Tooltip>
                <TooltipTrigger as-child>
                  <span
                    class="text-sm font-semibold mt-0.5 block font-mono cursor-help"
                    :class="
                      (obsStore.obsStats.renderSkippedFrames / obsStore.obsStats.renderTotalFrames) * 100 > 2
                        ? 'text-amber-500'
                        : 'text-foreground'
                    "
                  >
                    {{
                      ((obsStore.obsStats.renderSkippedFrames / obsStore.obsStats.renderTotalFrames) * 100).toFixed(2)
                    }}%
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  {{ obsStore.obsStats.renderSkippedFrames }} / {{ obsStore.obsStats.renderTotalFrames }} 帧
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              v-else
              class="text-sm font-semibold text-foreground mt-0.5 block font-mono"
              >—</span
            >
          </div>
        </div>
      </div>

      <Separator />

      <!-- 实时画面监视与场景缩略图切换墙 -->
      <div class="space-y-3">
        <ObsLiveMonitor :show-scene-wall="true" />
        <ObsSceneQuickPanel />

        <!-- Profile & 场景集合切换 -->
        <div
          v-if="obsStore.obsConnected && (obsStore.obsProfiles.length > 0 || obsStore.obsSceneCollections.length > 0)"
          class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1"
        >
          <FormField
            label="OBS 配置文件 (Profile)"
            class="min-w-0"
          >
            <Select
              :model-value="obsStore.currentObsProfile"
              @update:model-value="(v) => v && obsStore.switchObsProfile(String(v))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择配置文件" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in obsStore.obsProfiles"
                  :key="p"
                  :value="p"
                >
                  {{ p }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>

          <FormField
            label="OBS 场景集合 (Collection)"
            class="min-w-0"
          >
            <Select
              :model-value="obsStore.currentObsSceneCollection"
              @update:model-value="(v) => v && obsStore.switchObsSceneCollection(String(v))"
            >
              <SelectTrigger class="w-full">
                <SelectValue placeholder="选择场景集合" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="c in obsStore.obsSceneCollections"
                  :key="c"
                  :value="c"
                >
                  {{ c }}
                </SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </div>

      <!-- VTS -> OBS 一键采集源向导 -->
      <div
        v-if="obsStore.obsConnected"
        class="space-y-2 rounded-lg border border-border bg-muted/20 p-3"
      >
        <div class="flex-between gap-2 flex-wrap">
          <div class="flex items-center gap-1.5">
            <Sparkles class="size-3.5 text-primary" />
            <span class="text-xs font-semibold text-foreground">VTS → OBS 一键接入向导</span>
          </div>
          <span class="text-[11px] text-muted-foreground">插入到当前场景：{{ obsStore.currentObsScene || '未选择' }}</span>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            size="xs"
            variant="outline"
            :disabled="insertingVtsSource"
            @click="handleInsertVtsSource('spout2')"
          >
            插入 Spout2 源（推荐）
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            :disabled="insertingVtsSource"
            @click="handleInsertVtsSource('ndi')"
          >
            插入 NDI 源
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            :disabled="insertingVtsSource"
            @click="handleInsertVtsSource('game_capture')"
          >
            插入透明游戏采集源
          </Button>
        </div>
      </div>

      <!-- 源与滤镜可视化图层 -->
      <ObsSourceLayerPanel />

      <!-- 简易音频混音器 (含实时 VU 电平表) -->
      <div
        v-if="obsStore.obsConnected && obsStore.obsInputs.length > 0"
        class="space-y-2"
      >
        <div class="flex-between gap-2">
          <div class="flex items-center gap-1.5">
            <SlidersHorizontal class="size-3.5 text-primary" />
            <span class="text-xs font-semibold text-foreground">音频混音器</span>
          </div>
          <span class="text-[11px] text-muted-foreground">实时 VU 电平监控</span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div
            v-for="inputName in obsStore.obsInputs"
            :key="inputName"
            class="p-2 rounded-md border border-border bg-card space-y-1.5"
          >
            <div class="flex items-center gap-2">
              <Button
                type="button"
                size="icon-xs"
                :variant="obsStore.obsAudioStates[inputName]?.muted ? 'destructive' : 'ghost'"
                class="shrink-0"
                :title="obsStore.obsAudioStates[inputName]?.muted ? '取消静音' : '静音'"
                @click="obsStore.toggleInputMute(inputName)"
              >
                <VolumeX
                  v-if="obsStore.obsAudioStates[inputName]?.muted"
                  class="size-3.5"
                />
                <Volume2
                  v-else
                  class="size-3.5"
                />
              </Button>
              <span
                class="text-xs truncate w-24 shrink-0"
                :title="inputName"
              >
                {{ inputName }}
              </span>
              <Slider
                class="flex-1 min-w-0"
                :model-value="[Math.round((obsStore.obsAudioStates[inputName]?.volumeMul ?? 1) * 100)]"
                :min="0"
                :max="100"
                :step="1"
                @update:model-value="(v) => v?.[0] !== undefined && obsStore.setInputVolume(inputName, v[0] / 100)"
              />
              <span class="text-[11px] font-mono tabular-nums text-muted-foreground w-8 text-right shrink-0">
                {{ Math.round((obsStore.obsAudioStates[inputName]?.volumeMul ?? 1) * 100) }}%
              </span>
            </div>

            <!-- 实时 VU 电平条 (GPU transform) -->
            <div class="h-1.5 w-full rounded-full bg-muted overflow-hidden relative">
              <div
                class="h-full w-full origin-left transition-transform duration-75"
                :class="vuBarClass(audioLevels[inputName] ?? 0)"
                :style="{ transform: `scaleX(${((audioLevels[inputName] ?? 0) / 100).toFixed(3)})` }"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      <!-- 场景联动配置 -->
      <div class="space-y-3">
        <span class="text-xs font-semibold text-foreground block">场景联动设置</span>

        <div class="space-y-2">
          <SettingRow
            type="switch"
            title="启用自动场景切换"
            v-model="obsStore.obsSceneConfig.autoSwitchEnabled"
            @change="obsStore.saveSceneConfig"
          />

          <SettingRow
            type="switch"
            title="开播/下播联动推流"
            description="开始直播时自动开始 OBS 推流，停止直播时自动停止推流"
            v-model="obsStore.obsSceneConfig.autoToggleStream"
            @change="obsStore.saveSceneConfig"
          />
        </div>

        <!-- 联动场景选择器 -->
        <div
          v-if="obsStore.obsSceneConfig.autoSwitchEnabled"
          class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2"
        >
          <FormField
            type="select"
            label="开播场景"
            placeholder="选择开播场景"
            :options="sceneOptions"
            :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
            v-model="obsStore.obsSceneConfig.startScene"
            @change="obsStore.saveSceneConfig"
          />

          <FormField
            type="select"
            label="下播场景"
            placeholder="选择下播场景"
            :options="sceneOptions"
            :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
            v-model="obsStore.obsSceneConfig.stopScene"
            @change="obsStore.saveSceneConfig"
          />

          <FormField
            type="select"
            label="等待场景（可选）"
            placeholder="选择等待场景"
            :options="sceneOptions"
            :disabled="!obsStore.obsConnected || obsStore.obsScenes.length === 0"
            v-model="obsStore.obsSceneConfig.waitingScene"
            @change="obsStore.saveSceneConfig"
          />
        </div>

        <Alert size="sm" v-if="obsStore.obsSceneError" class="border-destructive/30 bg-destructive/10 text-destructive mt-2">
          <div class="flex items-center gap-1.5">
            <AlertCircle class="size-4 shrink-0" />
            <AlertDescription class="m-0">
              {{ obsStore.obsSceneError }}
            </AlertDescription>
          </div>
        </Alert>

        <p class="text-[11px] text-muted-foreground">
          配置场景联动后，在 VTsuru 开播/下播时将自动切换 OBS 场景。请确保 OBS 中已创建对应同名场景。
        </p>
      </div>
    </CardContent>
  </Card>
</template>
