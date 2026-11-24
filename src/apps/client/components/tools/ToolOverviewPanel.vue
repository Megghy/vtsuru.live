<script setup lang="ts">
import {
  AlertTriangle,
  Download,
  ExternalLink,
  FolderOpen,
  Monitor,
  Play,
  Plug,
  RefreshCw,
  Smile,
  Square,
  Wand2,
  Wrench,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import ClientMinVersionNotice from '@/apps/client/components/ClientMinVersionNotice.vue'
import { useManagedTools } from '@/apps/client/store/useManagedTools'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config/api'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'

const router = useRouter()
const managedTools = useManagedTools()
const obs = useOBSStore()
const vts = useVtsStore()
const rpcServer = useFetcherRpcServer()

const snap = computed(() => managedTools.snapshot)

/** 检测 OBS 切场驱动冲突：本地 VtsObsLink 与外部场景编辑器 RPC 同时存在 */
const hasObsVtsLinkConflict = computed(() => {
  return vts.obsLinkConfig.enabled && rpcServer.connectionCount > 0
})

async function handleEnableObsWs() {
  const existing = snap.value?.obs.websocketConfig
  await managedTools.configureObsWebsocket({
    enabled: true,
    port: existing?.serverPort ?? 4455,
    authRequired: existing?.authRequired ?? false,
    password: existing?.serverPassword ?? '',
  })
}

async function disableLocalObsVtsLink() {
  await vts.setObsLinkConfig({ ...vts.obsLinkConfig, enabled: false })
  toast.success('已关闭客户端旧版 OBS 切场联动，交由场景编辑器 RPC 统一驱动')
}

async function saveToolConfig() {
  await managedTools.saveConfig()
  toast.success('已保存工具启动配置')
}

const KEEP_LAST = '__keep__'

async function pickExecutablePath(target: 'obs' | 'vts') {
  if (!isTauri()) {
    toast.warning('浏览本地可执行文件仅在桌面客户端中可用')
    return
  }
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    title: target === 'obs' ? '选择 obs64.exe' : '选择 VTube Studio.exe',
    multiple: false,
    directory: false,
    filters: [{ name: '可执行文件', extensions: ['exe'] }],
  })
  if (typeof selected !== 'string' || !selected) return
  if (target === 'obs') {
    managedTools.config.customObsPath = selected
  } else {
    managedTools.config.customVtsPath = selected
  }
  await saveToolConfig()
}
</script>

<template>
  <div class="space-y-3.5">
    <!-- 1. OBS ↔ VTS 切场联动冲突治理 -->
    <Alert
      v-if="hasObsVtsLinkConflict"
      variant="warning"
    >
      <AlertTriangle class="size-4" />
      <div class="flex items-start justify-between gap-3 w-full flex-wrap">
        <div class="space-y-1">
          <AlertTitle>检测到两套 OBS → VTS 切场联动可能冲突</AlertTitle>
          <AlertDescription class="text-xs">
            当前既开启了客户端旧版「OBS 切场映射」，又有外部网页场景编辑器通过 RPC 接入，切场时可能互相覆盖 VTS 机位。建议交由网页场景编辑器统一驱动。
          </AlertDescription>
        </div>
        <Button
          size="xs"
          variant="outline"
          @click="disableLocalObsVtsLink"
        >
          一键关闭客户端旧版联动
        </Button>
      </div>
    </Alert>

    <!-- 3. 原生壳工具托管（需要 0.1.14+） -->
    <ClientMinVersionNotice feature="tool-manager">
      <div class="space-y-3.5">
        <div class="flex-between gap-2 flex-wrap">
          <div class="flex items-center gap-2">
            <Wrench class="size-4 text-primary" />
            <span class="text-xs font-semibold text-foreground">本机 OBS & VTS 环境体检与一键托管</span>
            <span
              v-if="snap"
              class="text-[11px] text-muted-foreground tabular-nums"
            >
              上次扫描: {{ new Date(snap.scannedAt).toLocaleTimeString() }}
            </span>
          </div>
          <Button
            size="xs"
            variant="secondary"
            class="gap-1.5"
            :disabled="managedTools.loading"
            @click="managedTools.refresh()"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': managedTools.loading }"
            />
            重新扫描环境
          </Button>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <!-- OBS Studio 卡片 -->
          <Card>
            <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Monitor class="size-4 text-primary" />
                <CardTitle>OBS Studio 快捷配置</CardTitle>
              </div>
              <div class="flex items-center gap-1.5">
                <Badge
                  :variant="snap?.obs.running ? 'success' : snap?.obs.installed ? 'outline' : 'secondary'"
                  size="xs"
                >
                  {{ snap?.obs.running ? `运行中 (${snap.obs.pids.length})` : snap?.obs.installed ? '已安装' : '未探测到' }}
                </Badge>
                <Badge
                  v-if="snap"
                  :variant="snap.obs.portOpen ? 'success' : 'secondary'"
                  size="xs"
                >
                  WS {{ snap.obs.portOpen ? '已开放' : '未监听' }}
                </Badge>
              </div>
            </CardHeader>

            <CardContent class="p-3 space-y-3">
              <!-- 环境体检标签 -->
              <div class="flex items-center gap-1.5 flex-wrap text-xs">
                <Badge
                  :variant="snap?.obs.spout2PluginInstalled ? 'success' : 'warning'"
                  size="xs"
                  class="gap-1"
                >
                  <CheckCircle2
                    v-if="snap?.obs.spout2PluginInstalled"
                    class="size-3"
                  />
                  Spout2 插件: {{ snap?.obs.spout2PluginInstalled ? '已安装' : '未检测到' }}
                </Badge>
                <Badge
                  :variant="snap?.obs.ndiPluginInstalled ? 'success' : 'secondary'"
                  size="xs"
                >
                  NDI 插件: {{ snap?.obs.ndiPluginInstalled ? '已安装' : '未检测到' }}
                </Badge>
                <Badge
                  v-if="snap?.obs.websocketConfig"
                  :variant="snap.obs.websocketConfig.serverEnabled ? 'success' : 'warning'"
                  size="xs"
                >
                  WS 配置:
                  {{
                    snap.obs.websocketConfig.exists
                      ? snap.obs.websocketConfig.serverEnabled
                        ? `已开启 :${snap.obs.websocketConfig.serverPort}`
                        : '未启用'
                      : '无配置文件'
                  }}
                </Badge>
              </div>

              <div
                v-if="snap?.obs.executablePath"
                class="text-[11px] text-muted-foreground font-mono truncate"
                :title="snap.obs.executablePath"
              >
                路径: {{ snap.obs.executablePath }}
              </div>

              <!-- 快捷动作栏 -->
              <div class="flex items-center gap-2 flex-wrap">
                <Button
                  size="xs"
                  class="gap-1"
                  :disabled="managedTools.launchingTool === 'obs'"
                  @click="managedTools.launchObs()"
                >
                  <Play class="size-3" />
                  启动 OBS
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="managedTools.syncObsWebsocketFromDisk(true)"
                >
                  <Download class="size-3" />
                  自动同步 WS 并连接
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="handleEnableObsWs"
                >
                  <Wand2 class="size-3" />
                  一键开启 WS
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="managedTools.openToolDir('obs_config')"
                >
                  <FolderOpen class="size-3" />
                  配置目录
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="managedTools.openToolDir('obs_plugins')"
                >
                  <FolderOpen class="size-3" />
                  插件目录
                </Button>
                <Popconfirm
                  v-if="snap?.obs.running"
                  title="确认强制结束 OBS 进程？未保存场景可能丢失。"
                  @confirm="managedTools.stopTool('obs')"
                >
                  <Button
                    size="xs"
                    variant="outline"
                    class="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Square class="size-3" />
                    停止
                  </Button>
                </Popconfirm>
              </div>

              <Separator />

              <!-- 启动参数预设 -->
              <div class="space-y-2.5">
                <FormField
                  label="自定义 obs64.exe 路径（留空自动探测）"
                >
                  <div class="flex items-center gap-1.5">
                    <Input
                      v-model="managedTools.config.customObsPath"
                      class="flex-1 min-w-0"
                      placeholder="例如：C:\Program Files\obs-studio\bin\64bit\obs64.exe"
                      @blur="saveToolConfig"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      class="gap-1 shrink-0"
                      @click="pickExecutablePath('obs')"
                    >
                      <FolderOpen class="size-3" />
                      浏览
                    </Button>
                  </div>
                </FormField>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="最小化到托盘启动"
                    v-model="managedTools.config.obsLaunch.minimizeToTray"
                    @update:model-value="saveToolConfig"
                  />
                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="启动时开回放缓存"
                    v-model="managedTools.config.obsLaunch.startReplayBuffer"
                    @update:model-value="saveToolConfig"
                  />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <FormField
                    label="启动 Profile（可选）"
                    class="min-w-0"
                  >
                    <Select
                      v-if="obs.obsProfiles.length > 0"
                      :model-value="managedTools.config.obsLaunch.profile || KEEP_LAST"
                      @update:model-value="
                        (v) => {
                          managedTools.config.obsLaunch.profile = v === KEEP_LAST ? '' : String(v ?? '')
                          void saveToolConfig()
                        }
                      "
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="留空沿用上次" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem :value="KEEP_LAST">留空沿用上次</SelectItem>
                        <SelectItem
                          v-for="p in obs.obsProfiles"
                          :key="p"
                          :value="p"
                        >
                          {{ p }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      v-else
                      v-model="managedTools.config.obsLaunch.profile"
                      placeholder="留空沿用上次"
                      @blur="saveToolConfig"
                    />
                  </FormField>
                  <FormField
                    label="启动场景集合（可选）"
                    class="min-w-0"
                  >
                    <Select
                      v-if="obs.obsSceneCollections.length > 0"
                      :model-value="managedTools.config.obsLaunch.collection || KEEP_LAST"
                      @update:model-value="
                        (v) => {
                          managedTools.config.obsLaunch.collection = v === KEEP_LAST ? '' : String(v ?? '')
                          void saveToolConfig()
                        }
                      "
                    >
                      <SelectTrigger class="w-full">
                        <SelectValue placeholder="留空沿用上次" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem :value="KEEP_LAST">留空沿用上次</SelectItem>
                        <SelectItem
                          v-for="c in obs.obsSceneCollections"
                          :key="c"
                          :value="c"
                        >
                          {{ c }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      v-else
                      v-model="managedTools.config.obsLaunch.collection"
                      placeholder="留空沿用上次"
                      @blur="saveToolConfig"
                    />
                  </FormField>
                </div>
              </div>
            </CardContent>
          </Card>

          <!-- VTube Studio 卡片 -->
          <Card>
            <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <Smile class="size-4 text-primary" />
                <CardTitle>VTube Studio 快捷配置</CardTitle>
              </div>
              <div class="flex items-center gap-1.5">
                <Badge
                  :variant="snap?.vts.running ? 'success' : snap?.vts.installed ? 'outline' : 'secondary'"
                  size="xs"
                >
                  {{ snap?.vts.running ? `运行中 (${snap.vts.pids.length})` : snap?.vts.installed ? '已安装' : '未探测到' }}
                </Badge>
                <Badge
                  v-if="snap"
                  :variant="snap.vts.portOpen ? 'success' : 'secondary'"
                  size="xs"
                >
                  API :{{ snap.vts.apiPort }} {{ snap.vts.portOpen ? '就绪' : '未监听' }}
                </Badge>
              </div>
            </CardHeader>

            <CardContent class="p-3 space-y-3">
              <div class="flex items-center gap-1.5 flex-wrap text-xs">
                <Badge
                  :variant="snap?.vts.steamInstalled ? 'outline' : 'secondary'"
                  size="xs"
                >
                  Steam: {{ snap?.vts.steamInstalled ? '已检测到' : '未检测到' }}
                </Badge>
                <Badge
                  v-if="snap?.vts.apiEnabled != null"
                  :variant="snap.vts.apiEnabled ? 'success' : 'warning'"
                  size="xs"
                >
                  插件 API: {{ snap.vts.apiEnabled ? '已开启' : '可能未开启' }}
                </Badge>
                <Badge
                  v-if="vts.ndiState"
                  :variant="vts.ndiState.ndiActive ? 'success' : 'secondary'"
                  size="xs"
                >
                  NDI: {{ vts.ndiState.ndiActive ? '输出中' : '关闭' }}
                </Badge>
              </div>

              <div
                v-if="snap?.vts.executablePath"
                class="text-[11px] text-muted-foreground font-mono truncate"
                :title="snap.vts.executablePath"
              >
                路径: {{ snap.vts.executablePath }}
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <Button
                  size="xs"
                  class="gap-1"
                  :disabled="managedTools.launchingTool === 'vts'"
                  @click="managedTools.launchVts()"
                >
                  <Play class="size-3" />
                  启动 VTS
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="managedTools.syncVtsPortAndConnect()"
                >
                  <Plug class="size-3" />
                  同步端口并连接
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="managedTools.openToolDir('vts_models')"
                >
                  <FolderOpen class="size-3" />
                  模型目录
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="managedTools.openToolDir('vts_items')"
                >
                  <FolderOpen class="size-3" />
                  道具目录
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="managedTools.openToolDir('vts_config')"
                >
                  <FolderOpen class="size-3" />
                  配置目录
                </Button>
                <Popconfirm
                  v-if="snap?.vts.running"
                  title="确认结束 VTube Studio 进程？"
                  @confirm="managedTools.stopTool('vts')"
                >
                  <Button
                    size="xs"
                    variant="outline"
                    class="gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Square class="size-3" />
                    停止
                  </Button>
                </Popconfirm>
              </div>

              <Separator />

              <div class="space-y-2.5">
                <FormField label="自定义 VTube Studio.exe 路径（留空自动从 Steam 探测）">
                  <div class="flex items-center gap-1.5">
                    <Input
                      v-model="managedTools.config.customVtsPath"
                      class="flex-1 min-w-0"
                      placeholder="自动扫描 Steam libraryfolders.vdf"
                      @blur="saveToolConfig"
                    />
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      class="gap-1 shrink-0"
                      @click="pickExecutablePath('vts')"
                    >
                      <FolderOpen class="size-3" />
                      浏览
                    </Button>
                  </div>
                </FormField>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                  <FormField label="启动方式">
                    <ToggleGroup
                      v-model="managedTools.config.vtsLaunch.mode"
                      type="single"
                      class="w-full grid grid-cols-2"
                      @update:model-value="saveToolConfig"
                    >
                      <ToggleGroupItem value="steam">Steam 协议</ToggleGroupItem>
                      <ToggleGroupItem value="direct">直启 EXE</ToggleGroupItem>
                    </ToggleGroup>
                  </FormField>

                  <SettingRow
                    type="switch"
                    variant="compact"
                    title="附加 -nosteam"
                    description="仅直启模式生效"
                    :disabled="managedTools.config.vtsLaunch.mode !== 'direct'"
                    v-model="managedTools.config.vtsLaunch.noSteam"
                    @update:model-value="saveToolConfig"
                  />
                </div>

                <div class="flex justify-end">
                  <Button
                    size="xs"
                    variant="ghost"
                    class="gap-1 text-primary"
                    @click="router.push({ name: 'client-vts' })"
                  >
                    前往 VTS 完整控制中心
                    <ExternalLink class="size-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </ClientMinVersionNotice>
  </div>
</template>
