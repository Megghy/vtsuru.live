<script setup lang="ts">
import {
  Crosshair,
  Eraser,
  ExternalLink,
  Keyboard,
  LayoutGrid,
  Palette,
  Plug,
  RefreshCw,
  RotateCcw,
  Settings,
  Sliders,
  Square,
  Unplug,
  Video,
  Wind,
  Workflow,
  X,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import { useVtsAction } from '@/apps/client/components/vts/useVtsAction'
import VtsConnectionCard from '@/apps/client/components/vts/VtsConnectionCard.vue'
import VtsDeck from '@/apps/client/components/vts/VtsDeck.vue'
import VtsHistoryPanel from '@/apps/client/components/vts/VtsHistoryPanel.vue'
import VtsHotkeyBoard from '@/apps/client/components/vts/VtsHotkeyBoard.vue'
import VtsImportExportCard from '@/apps/client/components/vts/VtsImportExportCard.vue'
import VtsItemPanel from '@/apps/client/components/vts/VtsItemPanel.vue'
import VtsMacroPanel from '@/apps/client/components/vts/VtsMacroPanel.vue'
import VtsObsLinkPanel from '@/apps/client/components/vts/VtsObsLinkPanel.vue'
import VtsPanicPanel from '@/apps/client/components/vts/VtsPanicPanel.vue'
import VtsParameterPanel from '@/apps/client/components/vts/VtsParameterPanel.vue'
import VtsPresetPanel from '@/apps/client/components/vts/VtsPresetPanel.vue'
import VtsProfilePanel from '@/apps/client/components/vts/VtsProfilePanel.vue'
import VtsQuickToolsPanel from '@/apps/client/components/vts/VtsQuickToolsPanel.vue'
import VtsVisualEffectsPanel from '@/apps/client/components/vts/VtsVisualEffectsPanel.vue'
import { VTS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { canUseVts, isClientWebDebug } from '@/shared/config'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Progress } from '@/shared/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const vts = useVtsStore()
const autoAction = useAutoAction()
const { run } = useVtsAction()
const router = useRouter()

const tab = ref<'deck' | 'actions' | 'items' | 'settings'>('deck')
const actionsSubTab = ref<'hotkeys' | 'macros' | 'presets' | 'effects' | 'quick'>('hotkeys')
const switchingModel = ref(false)
const refreshingModels = ref(false)

const status = computed(() => {
  if (vts.connected) {
    return { class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', text: '已连接' }
  }
  if (vts.connecting) {
    return {
      class: 'border-sky-500/40 text-sky-600 bg-sky-500/10',
      text: vts.wsRetryCount > 0 ? `等待 VTS (${vts.wsRetryCount})` : '等待 VTS / 授权中',
    }
  }
  return { class: 'border-destructive/40 text-destructive bg-destructive/10', text: '未连接' }
})

const linkedAutoActions = computed(() => autoAction.autoActions.filter((a) => VTS_ACTION_TYPES.has(a.actionType)))

const macroProgress = computed(() => {
  const running = vts.macroRunning
  if (!running) return null
  return {
    name: vts.macros.find((x) => x.id === running.macroId)?.name ?? '宏',
    step: running.stepIndex + 1,
    total: running.totalSteps,
    percent: running.totalSteps > 0 ? Math.round(((running.stepIndex + 1) / running.totalSteps) * 100) : 100,
  }
})

const activeExpressionCount = computed(() => vts.expressions.filter((e) => e.active).length)

function onSwitchModel(modelId: unknown) {
  const id = String(modelId ?? '')
  if (!id || id === vts.currentModelId || switchingModel.value) return
  switchingModel.value = true
  run(async () => {
    try {
      await vts.loadModel(id)
    } finally {
      switchingModel.value = false
    }
  }, '已切换模型')
}

function refreshModels() {
  if (refreshingModels.value) return
  refreshingModels.value = true
  run(async () => {
    try {
      await Promise.all([vts.refreshAvailableModels(), vts.refreshModelState()])
    } finally {
      refreshingModels.value = false
    }
  }, '已刷新模型状态')
}
</script>

<template>
  <div class="w-full flex flex-col gap-3.5">
    <ClientPageHeader
      title="VTube Studio 控制中心"
      description="本地控制表情、热键、机位、染色滤镜、道具与组合宏，并与自动操作和 OBS 联动"
    >
      <template
        v-if="canUseVts()"
        #actions
      >
        <div class="flex items-center gap-2">
          <Badge
            variant="outline"
            class="h-6 px-2.5"
            :class="status.class"
          >
            {{ status.text }}
          </Badge>
          <Button
            v-if="!vts.connected && !vts.connecting"
            variant="secondary"
            class="gap-1.5"
            @click="run(() => vts.connect())"
          >
            <Plug class="size-3.5" />
            连接
          </Button>
          <Button
            v-else
            variant="secondary"
            class="gap-1.5"
            @click="run(() => vts.disconnect())"
          >
            <Unplug class="size-3.5" />
            {{ vts.connecting ? '取消' : '断开' }}
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <Alert
      v-if="!canUseVts()"
      size="sm"
      variant="destructive"
    >
      <AlertDescription class="m-0">当前不是桌面客户端环境，无法连接本地 VTube Studio。</AlertDescription>
    </Alert>

    <template v-else>
      <Alert
        v-if="isClientWebDebug()"
        size="sm"
        variant="info"
      >
        <AlertDescription class="m-0">
          当前为开发态网页调试模式：支持直连本地 VTS WebSocket（全局快捷键与本地文件选择器仅桌面客户端可用）。
        </AlertDescription>
      </Alert>
      <Alert
        v-if="vts.connecting"
        size="sm"
        variant="info"
      >
        <AlertDescription class="m-0">
          {{
            vts.wsRetryCount > 0
              ? `尚未检测到 VTube Studio 本地端口（已尝试 ${vts.wsRetryCount} 次）：请确认 VTS 已启动并开启「启动 API」（默认端口 8001）。`
              : '正在等待 VTube Studio：请确认 VTS 已启动并开启「启动 API」；首次连接需在 VTS 弹窗中点击「允许」。'
          }}
        </AlertDescription>
      </Alert>

      <!-- 已连接顶部状态条：模型切换 + 实时指标 + 常驻应急快捷操作 -->
      <Card v-else-if="vts.connected">
        <CardContent class="p-3 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2 flex-wrap">
            <div class="flex items-center gap-1.5">
              <span class="text-xs text-muted-foreground shrink-0">模型</span>
              <div
                v-if="vts.availableModels.length > 0"
                class="w-48"
              >
                <Select
                  :model-value="vts.currentModelId ?? ''"
                  :disabled="switchingModel"
                  @update:model-value="onSwitchModel"
                >
                  <SelectTrigger
                    size="xs"
                    class="w-full"
                  >
                    <SelectValue :placeholder="vts.currentModelName || '未加载模型'" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      v-for="m in vts.availableModels"
                      :key="m.modelID"
                      :value="m.modelID"
                    >
                      {{ m.modelName }}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <span
                v-else
                class="text-xs font-semibold text-foreground"
              >
                {{ vts.currentModelName || '未加载模型' }}
              </span>
              <Button
                size="icon-xs"
                variant="ghost"
                :disabled="refreshingModels"
                title="刷新模型与热键状态"
                @click="refreshModels"
              >
                <RefreshCw
                  class="size-3.5"
                  :class="refreshingModels ? 'animate-spin' : ''"
                />
              </Button>
            </div>

            <Badge
              v-if="vts.statistics?.framerate"
              variant="secondary"
              size="sm"
              class="tabular-nums"
            >
              {{ vts.statistics.framerate }} FPS
            </Badge>
            <Badge
              v-if="vts.lastRttMs != null"
              :variant="vts.lastRttMs < 50 ? 'success' : 'warning'"
              size="sm"
              class="tabular-nums"
            >
              {{ vts.lastRttMs }}ms
            </Badge>
            <Badge
              v-if="vts.faceFound === false"
              variant="warning"
              size="sm"
            >
              面部丢失
            </Badge>
          </div>

          <!-- 常驻直播应急操作 -->
          <div class="flex items-center gap-1.5 flex-wrap">
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              :disabled="activeExpressionCount === 0"
              @click="run(() => vts.clearExpressions(), '已清除所有表情')"
            >
              <Eraser class="size-3" />
              清表情
              <span
                v-if="activeExpressionCount > 0"
                class="tabular-nums text-muted-foreground"
              >
                ({{ activeExpressionCount }})
              </span>
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              :title="vts.panicConfig.calibrateHotkeyId ? '触发校准热键' : '请先在「设置」中绑定校准热键'"
              @click="
                vts.panicConfig.calibrateHotkeyId ? run(() => vts.panicCalibrate(), '已校准') : (tab = 'settings')
              "
            >
              <Crosshair class="size-3" />
              校准
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="gap-1"
              :title="vts.panicConfig.resetPhysicsHotkeyId ? '触发重置物理热键' : '请先在「设置」中绑定重置物理热键'"
              @click="
                vts.panicConfig.resetPhysicsHotkeyId
                  ? run(() => vts.panicResetPhysics(), '已重置物理')
                  : (tab = 'settings')
              "
            >
              <RotateCcw class="size-3" />
              重置物理
            </Button>
          </div>
        </CardContent>
      </Card>

      <!-- 错误提示 -->
      <Alert
        v-if="vts.lastError"
        size="sm"
        variant="destructive"
        class="flex-between"
      >
        <AlertDescription class="m-0">{{ vts.lastError }}</AlertDescription>
        <Button
          variant="ghost"
          size="icon-xs"
          class="ml-2 text-destructive hover:bg-destructive/10 shrink-0"
          aria-label="关闭提示"
          @click="vts.lastError = null"
        >
          <X class="size-3.5" />
        </Button>
      </Alert>

      <!-- 宏运行进度条（支持中途停止） -->
      <Transition name="vts-slide">
        <Card v-if="macroProgress">
          <CardContent class="p-3 flex items-center gap-3">
            <span class="font-semibold text-xs text-foreground shrink-0">{{ macroProgress.name }}</span>
            <Badge
              variant="secondary"
              size="xs"
              class="tabular-nums shrink-0"
            >
              {{ macroProgress.step }} / {{ macroProgress.total }}
            </Badge>
            <Progress
              :model-value="macroProgress.percent"
              class="flex-1 min-w-[120px] h-1.5"
            />
            <Button
              size="xs"
              variant="destructive"
              class="gap-1 shrink-0"
              @click="vts.stopMacro()"
            >
              <Square class="size-3" />
              停止
            </Button>
          </CardContent>
        </Card>
      </Transition>

      <Tabs
        v-model="tab"
        class="w-full"
      >
        <TabsList class="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger
            value="deck"
            class="gap-1.5"
          >
            <LayoutGrid class="size-3.5" />
            操作台
          </TabsTrigger>
          <TabsTrigger
            value="actions"
            class="gap-1.5"
          >
            <Workflow class="size-3.5" />
            控制与编排
          </TabsTrigger>
          <TabsTrigger
            value="items"
            class="gap-1.5"
          >
            <Sliders class="size-3.5" />
            道具与参数
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            class="gap-1.5"
          >
            <Settings class="size-3.5" />
            设置与联动
          </TabsTrigger>
        </TabsList>

        <!-- 操作台 -->
        <TabsContent
          value="deck"
          class="pt-3"
        >
          <VtsDeck />
        </TabsContent>

        <!-- 控制与编排：子导航避免纵向堆叠过长 -->
        <TabsContent
          value="actions"
          class="pt-3 space-y-3"
        >
          <Tabs v-model="actionsSubTab">
            <TabsList class="grid w-full max-w-2xl grid-cols-5">
              <TabsTrigger
                value="hotkeys"
                class="gap-1.5"
              >
                <Keyboard class="size-3.5" />
                热键
              </TabsTrigger>
              <TabsTrigger
                value="macros"
                class="gap-1.5"
              >
                <Workflow class="size-3.5" />
                组合宏
              </TabsTrigger>
              <TabsTrigger
                value="presets"
                class="gap-1.5"
              >
                <Video class="size-3.5" />
                机位预设
              </TabsTrigger>
              <TabsTrigger
                value="effects"
                class="gap-1.5"
              >
                <Palette class="size-3.5" />
                染色与滤镜
              </TabsTrigger>
              <TabsTrigger
                value="quick"
                class="gap-1.5"
              >
                <Wind class="size-3.5" />
                物理与输出
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="hotkeys"
              class="pt-3"
            >
              <VtsHotkeyBoard
                :hotkeys="vts.hotkeys"
                :model-name="vts.currentModelName"
                :disabled="!vts.connected"
                @refresh="run(() => vts.refreshModelState())"
                @trigger="(id) => run(() => vts.triggerHotkey(id))"
              />
            </TabsContent>

            <TabsContent
              value="macros"
              class="pt-3"
            >
              <VtsMacroPanel />
            </TabsContent>

            <TabsContent
              value="presets"
              class="pt-3"
            >
              <VtsPresetPanel />
            </TabsContent>

            <TabsContent
              value="effects"
              class="pt-3"
            >
              <VtsVisualEffectsPanel />
            </TabsContent>

            <TabsContent
              value="quick"
              class="pt-3"
            >
              <VtsQuickToolsPanel />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <!-- 道具与参数 -->
        <TabsContent
          value="items"
          class="pt-3 space-y-3"
        >
          <VtsItemPanel />
          <VtsParameterPanel />
        </TabsContent>

        <!-- 设置与联动 -->
        <TabsContent
          value="settings"
          class="pt-3 space-y-3"
        >
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
            <VtsConnectionCard />
            <VtsPanicPanel />
          </div>

          <VtsObsLinkPanel />

          <Accordion
            type="multiple"
            :default-value="['profiles']"
            class="border border-border rounded-md px-3 bg-card"
          >
            <AccordionItem value="profiles">
              <AccordionTrigger class="text-xs font-semibold py-2.5">配置方案与导入导出</AccordionTrigger>
              <AccordionContent class="pt-2 pb-3 space-y-3">
                <VtsProfilePanel />
                <VtsImportExportCard />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rules">
              <AccordionTrigger class="text-xs font-semibold py-2.5">
                关联的自动操作规则 ({{ linkedAutoActions.length }})
              </AccordionTrigger>
              <AccordionContent class="pt-2 pb-3 space-y-2.5">
                <div class="flex-between gap-2 flex-wrap">
                  <span class="text-xs text-muted-foreground">
                    在「自动操作」中可让礼物、弹幕、上舰等事件自动触发 VTS 动作（含表情、染色与滤镜）
                  </span>
                  <Button
                    size="xs"
                    variant="secondary"
                    class="gap-1"
                    @click="router.push({ name: 'client-auto-action-manage' })"
                  >
                    前往自动操作
                    <ExternalLink class="size-3" />
                  </Button>
                </div>

                <div
                  v-if="linkedAutoActions.length === 0"
                  class="py-4"
                >
                  <Empty description="暂无关联 VTS 的自动操作规则" />
                </div>
                <div
                  v-else
                  class="space-y-1.5"
                >
                  <div
                    v-for="a in linkedAutoActions"
                    :key="a.id"
                    class="flex items-center gap-2 p-2 rounded-md border border-border bg-muted/20"
                  >
                    <Badge
                      :variant="a.enabled ? 'success' : 'secondary'"
                      size="xs"
                    >
                      {{ a.enabled ? '启用' : '禁用' }}
                    </Badge>
                    <span class="font-medium text-xs text-foreground">{{ a.name || '未命名操作' }}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history">
              <AccordionTrigger class="text-xs font-semibold py-2.5">
                操作记录 ({{ vts.history.length }})
              </AccordionTrigger>
              <AccordionContent class="pt-2 pb-3">
                <VtsHistoryPanel />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>

<style scoped>
.vts-slide-enter-active,
.vts-slide-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.vts-slide-enter-from,
.vts-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
