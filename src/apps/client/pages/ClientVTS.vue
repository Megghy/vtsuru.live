<script setup lang="ts">
import {
  Flash24Filled,
  Grid24Regular,
  PlugConnected24Filled,
  PlugDisconnected24Filled,
  Settings24Filled,
  VideoPerson24Filled,
} from '@vicons/fluent'
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
import { ActionType } from '@/apps/client/store/autoAction/types'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { isTauri } from '@/shared/config'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/ui/accordion'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Progress } from '@/shared/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'

const vts = useVtsStore()
const autoAction = useAutoAction()
const { run } = useVtsAction()
const router = useRouter()
const tab = ref<'deck' | 'actions' | 'items' | 'settings'>('deck')

const status = computed(() => {
  if (vts.connected) {
    return { class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', text: '已连接' }
  }
  if (vts.connecting) {
    return { class: 'border-sky-500/40 text-sky-600 bg-sky-500/10', text: '等待 VTS / 授权中' }
  }
  return { class: 'border-destructive/40 text-destructive bg-destructive/10', text: '未连接' }
})

const VTS_ACTION_TYPES = new Set([
  ActionType.VTS_HOTKEY,
  ActionType.VTS_PRESET,
  ActionType.VTS_DROP_ITEM,
  ActionType.VTS_PARAM_ADD,
  ActionType.VTS_MACRO,
  ActionType.VTS_ACCESSORY,
])

const linkedAutoActions = computed(() => autoAction.autoActions.filter((a) => VTS_ACTION_TYPES.has(a.actionType)))

const macroProgress = computed(() => {
  const running = vts.macroRunning
  if (!running) return null
  return {
    name: vts.macros.find((x) => x.id === running.macroId)?.name ?? '宏',
    step: running.stepIndex + 1,
    total: running.totalSteps,
    percent: Math.round(((running.stepIndex + 1) / running.totalSteps) * 100),
  }
})
</script>

<template>
  <div class="vts-page flex flex-col gap-3.5">
    <ClientPageHeader
      title="VTube Studio 控制中心"
      description="通过 VTS 插件 API 在本地控制表情、热键、机位、道具与动作宏，可配合自动操作与 OBS 场景联动"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <Badge
            variant="outline"
            class="text-xs h-6 px-2.5"
            :class="status.class"
          >
            {{ status.text }}
          </Badge>
          <Button v-if="!vts.connected && !vts.connecting" variant="secondary" class="gap-1.5" @click="run(() => vts.connect())"
          >
            <PlugConnected24Filled class="size-3.5" />
            连接
          </Button>
          <Button v-else variant="secondary" class="gap-1.5" @click="run(() => vts.disconnect())"
          >
            <PlugDisconnected24Filled class="size-3.5" />
            {{ vts.connecting ? '取消' : '断开' }}
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <Alert
      v-if="!isTauri()"
      class="border-destructive/20 bg-destructive/10 text-destructive py-2.5 px-3"
    >
      <AlertDescription class="text-xs m-0">
        当前不是桌面客户端环境，无法连接本地 VTube Studio。
      </AlertDescription>
    </Alert>

    <template v-else>
      <Alert
        v-if="vts.connecting"
        class="border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400 py-2.5 px-3"
      >
        <AlertDescription class="text-xs m-0">
          正在等待 VTube Studio：请确认 VTS 已启动并开启「启动 API」；首次连接需在 VTS 弹窗中点击「允许」。
        </AlertDescription>
      </Alert>

      <Card
        v-else-if="vts.connected"
        class="border bg-card"
      >
        <CardContent class="p-3">
          <div class="flex items-center gap-2.5 flex-wrap">
            <span class="model-badge flex items-center gap-1.5 text-xs">
              <span class="text-muted-foreground">当前模型</span>
              <span class="font-semibold text-foreground">{{ vts.currentModelName || '未加载模型' }}</span>
            </span>
            <Badge
              v-if="vts.statistics?.framerate"
              variant="secondary"
              class="text-xs h-5 px-1.5"
            >
              {{ vts.statistics.framerate }} FPS
            </Badge>
            <Badge
              v-if="vts.lastRttMs != null"
              variant="outline"
              class="text-xs h-5 px-1.5"
              :class="vts.lastRttMs < 50 ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'border-amber-500/40 text-amber-600 bg-amber-500/10'"
            >
              延迟 {{ vts.lastRttMs }}ms
            </Badge>
            <Badge
              v-if="vts.faceFound === false"
              variant="outline"
              class="text-xs h-5 px-1.5 border-amber-500/40 text-amber-600 bg-amber-500/10"
            >
              面部丢失
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Alert
        v-if="vts.lastError"
        class="border-destructive/20 bg-destructive/10 text-destructive py-2.5 px-3 flex items-center justify-between"
      >
        <AlertDescription class="text-xs m-0">
          {{ vts.lastError }}
        </AlertDescription>
        <button
          type="button"
          class="text-xs ml-2 hover:opacity-80"
          @click="vts.lastError = null"
        >
          ✕
        </button>
      </Alert>

      <Transition name="vts-slide">
        <Card
          v-if="macroProgress"
          class="border bg-card"
        >
          <CardContent class="p-3 flex items-center gap-3">
            <span class="font-semibold text-xs text-foreground">{{ macroProgress.name }}</span>
            <Badge
              variant="secondary"
              class="text-[10px] h-4.5 px-1.5"
            >
              {{ macroProgress.step }} / {{ macroProgress.total }}
            </Badge>
            <Progress
              :model-value="macroProgress.percent"
              class="flex-1 min-w-[120px] h-1.5"
            />
          </CardContent>
        </Card>
      </Transition>

      <Tabs
        v-model="tab"
        class="w-full vts-tabs"
      >
        <TabsList class="grid w-full max-w-lg grid-cols-4">
          <TabsTrigger value="deck" class="text-xs gap-1.5">
            <Grid24Regular class="size-3.5" />
            操作台
          </TabsTrigger>
          <TabsTrigger value="actions" class="text-xs gap-1.5">
            <VideoPerson24Filled class="size-3.5" />
            热键与宏
          </TabsTrigger>
          <TabsTrigger value="items" class="text-xs gap-1.5">
            <Flash24Filled class="size-3.5" />
            道具与参数
          </TabsTrigger>
          <TabsTrigger value="settings" class="text-xs gap-1.5">
            <Settings24Filled class="size-3.5" />
            设置
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deck" class="pt-3">
          <VtsDeck />
        </TabsContent>

        <TabsContent value="actions" class="pt-3 space-y-3 client-readable">
          <VtsHotkeyBoard
            :hotkeys="vts.hotkeys"
            :model-name="vts.currentModelName"
            :disabled="!vts.connected"
            @refresh="run(() => vts.refreshModelState())"
            @trigger="(id) => run(() => vts.triggerHotkey(id))"
          />
          <VtsMacroPanel />
          <VtsPresetPanel />
          <VtsPanicPanel />
        </TabsContent>

        <TabsContent value="items" class="pt-3 space-y-3 client-readable">
          <VtsItemPanel />
          <VtsParameterPanel />
        </TabsContent>

        <TabsContent value="settings" class="pt-3 space-y-3 client-readable">
          <VtsConnectionCard />
          <VtsObsLinkPanel />

          <Accordion
            type="multiple"
            class="border rounded-md px-3 bg-card"
          >
            <AccordionItem value="profiles">
              <AccordionTrigger class="text-xs font-semibold py-2.5">
                配置方案与备份
              </AccordionTrigger>
              <AccordionContent class="pt-2 pb-3 space-y-3">
                <VtsProfilePanel />
                <VtsImportExportCard />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="rules">
              <AccordionTrigger class="text-xs font-semibold py-2.5">
                {{ `关联的自动操作规则 (${linkedAutoActions.length})` }}
              </AccordionTrigger>
              <AccordionContent class="pt-2 pb-3 space-y-2">
                <span class="text-xs text-muted-foreground block">
                  在「自动操作」中可以让礼物、弹幕、上舰等事件自动触发 VTS 动作
                </span>
                <div
                  v-for="a in linkedAutoActions"
                  :key="a.id"
                  class="flex items-center gap-2 p-2 rounded border bg-muted/20"
                >
                  <Badge
                    variant="outline"
                    class="text-[10px] h-4.5 px-1.5"
                    :class="a.enabled ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
                  >
                    {{ a.enabled ? '启用' : '禁用' }}
                  </Badge>
                  <span class="font-medium text-xs text-foreground">{{ a.name || '未命名操作' }}</span>
                </div>
                <Button variant="secondary" @click="router.push({ name: 'client-auto-action-manage' })">
                  前往自动操作
                </Button>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history">
              <AccordionTrigger class="text-xs font-semibold py-2.5">
                操作记录
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
.vts-page {
  width: 100%;
}

.vts-slide-enter-active,
.vts-slide-leave-active {
  transition: all 0.25s ease;
  overflow: hidden;
}

.vts-slide-enter-from,
.vts-slide-leave-to {
  opacity: 0;
  max-height: 0;
  transform: translateY(-8px);
}

.vts-slide-enter-to,
.vts-slide-leave-from {
  opacity: 1;
  max-height: 200px;
}
</style>
