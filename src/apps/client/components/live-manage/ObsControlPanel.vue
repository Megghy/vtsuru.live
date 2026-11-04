<script setup lang="ts">
import { AlertCircle, CheckCircle2, HelpCircle, Info, Play, RefreshCw, Square, Video } from 'lucide-vue-next'

import { computed } from 'vue'

import type { LiveControl } from '@/apps/client/composables/useLiveControl'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{ control: LiveControl }>()
const obsStore = props.control.obsStore
const sceneOptions = computed(() => obsStore.obsScenes.map(s => ({ label: s, value: s })))

const handleToggleConnect = () => {
  if (obsStore.obsConnected) {
    obsStore.handleObsDisconnect()
  } else {
    obsStore.handleObsConnect()
  }
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
      <!-- 快捷推流控制与重连状态 -->
      <div class="flex-between">
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

      <!-- 场景控制 -->
      <div class="space-y-2.5">
        <div class="flex-between">
          <span class="text-xs font-semibold text-foreground block">场景切换</span>
          <Badge variant="outline" size="sm">
            当前场景：{{ obsStore.currentObsScene || '未连接' }}
          </Badge>
        </div>

        <div
          v-if="obsStore.obsScenes.length > 0"
          class="flex flex-wrap gap-2"
        >
          <Button size="xs" v-for="scene in obsStore.obsScenes" :key="scene" type="button" :variant="scene === obsStore.currentObsScene ? 'default' : 'outline'" class="text-xs" :disabled="obsStore.isSwitchingScene" @click="scene !== obsStore.currentObsScene && obsStore.switchToScene(scene)">
            {{ scene }}
          </Button>
        </div>

        <div
          v-else
          class="py-4 text-center text-xs text-muted-foreground rounded-md border border-dashed border-border"
        >
          {{ obsStore.obsConnected ? '未检测到 OBS 场景' : '连接 OBS 后将自动加载可用场景列表' }}
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
