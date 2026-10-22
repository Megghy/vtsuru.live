<script setup lang="ts">
import {
  ChartMultiple24Regular,
  CloudArrowDown20Filled,
  DocumentText24Regular,
  Mic24Filled,
  MicOff24Filled,
  Next20Filled,
  Pause20Filled,
  Play20Filled,
  ShieldCheckmark24Regular,
  Speaker224Regular,
  SpeakerSettings24Regular,
} from '@vicons/fluent'
import { computed, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import AdvancedSettingsPanel from '@/apps/open-live/components/read-danmaku/AdvancedSettingsPanel.vue'
import FilterSettingsPanel from '@/apps/open-live/components/read-danmaku/FilterSettingsPanel.vue'
import QueueList from '@/apps/open-live/components/read-danmaku/QueueList.vue'
import SpokenHistoryPanel from '@/apps/open-live/components/read-danmaku/SpokenHistoryPanel.vue'
import TemplateSettingsPanel from '@/apps/open-live/components/read-danmaku/TemplateSettingsPanel.vue'
import VoiceSettingsPanel from '@/apps/open-live/components/read-danmaku/VoiceSettingsPanel.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useSpeechService } from '@/store/useSpeechService'

const props = withDefaults(
  defineProps<{
    roomInfo?: any
    code?: string | undefined
    isOpenLive?: boolean
    autoConnect?: boolean
  }>(),
  {
    autoConnect: true,
  },
)

const accountInfo = useAccount()
const client = useDanmakuClient()
const speechService = useSpeechService()

const { speechState, speakQueue, readedDanmaku, isPaused, speechSynthesisInfo } = speechService

const audioOutputDevices = ref<{ label: string; value: string }[]>([])
const audioOutputDevicesLoading = ref(false)
let mounted = false
let keydownBound = false

const activeConfigTab = ref('voice')
const activeQueueTab = ref('queue')

const queueStats = computed(() => {
  const total = speakQueue.value.length
  const gifts = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Gift).length
  const messages = speakQueue.value.filter((i) => i.data.type === EventDataTypes.Message).length
  return { total, gifts, messages }
})

const supportsFollow = computed(() => {
  const sourceType = client.danmakuClient?.type
  return sourceType ? sourceType !== 'openlive' : !props.autoConnect
})

async function fetchAudioOutputDevices() {
  audioOutputDevicesLoading.value = true
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return
    const devices = await navigator.mediaDevices.enumerateDevices()
    audioOutputDevices.value = [
      { label: '默认设备', value: 'default' },
      ...devices
        .filter((d) => d.kind === 'audiooutput')
        .map((d) => ({
          label: d.label || `设备 ${d.deviceId.substring(0, 8)}`,
          value: d.deviceId,
        })),
    ]
  } catch {
    /* ignore */
  } finally {
    audioOutputDevicesLoading.value = false
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === ' ' && e.ctrlKey) {
    e.preventDefault()
    speechService.togglePause()
  }
  if (e.key === 'n' && e.ctrlKey) {
    e.preventDefault()
    speechService.skipCurrent()
  }
  if (e.key === 'q' && e.ctrlKey) {
    e.preventDefault()
    speechService.clearQueue()
  }
}

function bindKeydown() {
  if (keydownBound) return
  document.addEventListener('keydown', onKeydown)
  keydownBound = true
}

function unbindKeydown() {
  if (!keydownBound) return
  document.removeEventListener('keydown', onKeydown)
  keydownBound = false
}

onMounted(async () => {
  mounted = true
  bindKeydown()
  await speechService.initialize()
  if (!mounted) return
  await client.ensureOpenlive({ connect: props.autoConnect })
  if (!mounted) return
  await fetchAudioOutputDevices()
  if (!mounted) return
  navigator.mediaDevices?.addEventListener('devicechange', fetchAudioOutputDevices)
})

onBeforeUnmount(() => {
  mounted = false
  navigator.mediaDevices?.removeEventListener('devicechange', fetchAudioOutputDevices)
  unbindKeydown()
})

onActivated(bindKeydown)
onDeactivated(unbindKeydown)
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="弹幕朗读与语音播报"
      subtitle="实时将直播间弹幕、礼物、舰长及关注事件转换为自然语音播报，支持多引擎驱动与精细化过滤"
    >
      <template #action>
        <div class="flex items-center gap-1.5 flex-wrap">
          <Button
            :variant="speechState.canSpeech ? 'destructive' : 'default'"
            :loading="speechState.isApiAudioLoading"
            @click="speechState.canSpeech ? speechService.stopSpeech() : speechService.startSpeech()"
          >
            <component
              :is="speechState.canSpeech ? MicOff24Filled : Mic24Filled"
              class="h-3.5 w-3.5 mr-1"
            />
            {{ speechState.canSpeech ? '停止朗读' : '开启朗读' }}
          </Button>

          <Button
            v-if="speechState.canSpeech"
            :variant="isPaused ? 'outline' : 'secondary'"
            :class="{ 'border-amber-500/40 text-amber-500': isPaused }"
            @click="speechService.togglePause()"
          >
            <component
              :is="isPaused ? Play20Filled : Pause20Filled"
              class="h-3.5 w-3.5 mr-1"
            />
            {{ isPaused ? '恢复播报' : '暂停' }}
          </Button>

          <Button
            v-if="speechState.isSpeaking"
            variant="outline"
            @click="speechService.skipCurrent()"
          >
            <component
              :is="Next20Filled"
              class="h-3.5 w-3.5 mr-1"
            />
            跳过当前
          </Button>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button
                variant="outline"
                :disabled="!accountInfo?.id"
              >
                <component
                  :is="CloudArrowDown20Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                云端同步
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent class="sm:max-w-md">
              <AlertDialogHeader>
                <AlertDialogTitle>拉取云端配置？</AlertDialogTitle>
                <AlertDialogDescription class="text-xs">
                  这将从云端拉取配置覆盖当前本地设置，确定继续吗？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction @click="speechService.downloadConfig()"> 确定拉取 </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </template>
    </ManagePageHeader>

    <!-- 异常状态提示 -->
    <Alert
      v-if="!speechSynthesisInfo || !speechSynthesisInfo.speechSynthesis"
      variant="destructive"
    >
      <AlertTitle>浏览器不支持语音能力</AlertTitle>
      <AlertDescription class="text-xs">
        当前浏览器环境不支持 Web Speech API，请使用 Chrome、Edge 或最新版现代浏览器。
      </AlertDescription>
    </Alert>

    <!-- 主布局网格 (7 : 5) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
      <!-- 左侧：参数与规则配置 -->
      <Card class="lg:col-span-7">
        <CardContent class="p-4">
          <Tabs
            v-model="activeConfigTab"
            class="w-full"
          >
            <TabsList class="grid grid-cols-4 w-full mb-4">
              <TabsTrigger value="voice">
                <component
                  :is="Speaker224Regular"
                  class="h-3.5 w-3.5"
                />
                语音引擎
              </TabsTrigger>
              <TabsTrigger value="template">
                <component
                  :is="DocumentText24Regular"
                  class="h-3.5 w-3.5"
                />
                消息模板
              </TabsTrigger>
              <TabsTrigger value="filter">
                <component
                  :is="ShieldCheckmark24Regular"
                  class="h-3.5 w-3.5"
                />
                过滤防刷
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <component
                  :is="SpeakerSettings24Regular"
                  class="h-3.5 w-3.5"
                />
                声卡高级
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="voice"
              class="mt-0"
            >
              <VoiceSettingsPanel />
            </TabsContent>

            <TabsContent
              value="template"
              class="mt-0"
            >
              <TemplateSettingsPanel :supports-follow="supportsFollow" />
            </TabsContent>

            <TabsContent
              value="filter"
              class="mt-0"
            >
              <FilterSettingsPanel />
            </TabsContent>

            <TabsContent
              value="advanced"
              class="mt-0"
            >
              <AdvancedSettingsPanel
                :audio-output-devices="audioOutputDevices"
                :audio-output-devices-loading="audioOutputDevicesLoading"
                @device-change="speechService.setAudioOutputDevice"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <!-- 右侧：运行监控与待播队列 -->
      <div class="lg:col-span-5 space-y-4">
        <!-- 运行监控卡片 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5 text-xs font-semibold">
                <component
                  :is="ChartMultiple24Regular"
                  class="h-4 w-4 text-brand"
                />
                <span>运行状态与统计</span>
              </div>

              <Badge
                :variant="speechState.canSpeech ? (isPaused ? 'warning' : 'brand') : 'secondary'"
                class="text-[10px] px-1.5 py-0 h-4"
              >
                {{ speechState.canSpeech ? (isPaused ? '已暂停' : '监听中') : '未启动' }}
              </Badge>
            </div>
          </CardHeader>

          <CardContent class="p-3.5 pt-0 space-y-3">
            <div class="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-muted/40 border border-border text-center">
              <div>
                <span class="text-[11px] text-muted-foreground block">朗读状态</span>
                <span
                  class="text-xs font-semibold mt-0.5 block"
                  :class="{
                    'text-brand': speechState.isSpeaking,
                    'text-amber-500': isPaused,
                    'text-muted-foreground': !speechState.isSpeaking && !isPaused,
                  }"
                >
                  {{ isPaused ? '已暂停' : speechState.isSpeaking ? '正在朗读' : '空闲待机' }}
                </span>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">待播积压</span>
                <span class="text-sm font-semibold font-mono mt-0.5 block text-foreground">
                  {{ queueStats.total }}
                </span>
              </div>
              <div>
                <span class="text-[11px] text-muted-foreground block">累计已读</span>
                <span class="text-sm font-semibold font-mono mt-0.5 block text-foreground">
                  {{ readedDanmaku }}
                </span>
              </div>
            </div>

            <!-- 当前正在朗读的文本 -->
            <div
              v-if="speechState.isSpeaking && speechState.speakingText"
              class="p-2.5 rounded-md bg-brand/10 border border-brand/20 text-xs flex items-baseline gap-1.5"
            >
              <span class="font-bold text-brand shrink-0">正在播报:</span>
              <span class="text-foreground break-all">{{ speechState.speakingText }}</span>
            </div>

            <!-- 快捷键提示 -->
            <div class="text-[11px] text-muted-foreground text-center space-x-1.5">
              <span>快捷键:</span>
              <kbd class="px-1 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Ctrl + 空格</kbd>
              <span>暂停</span>
              <span class="text-muted-foreground/40">|</span>
              <kbd class="px-1 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Ctrl + N</kbd>
              <span>跳过</span>
              <span class="text-muted-foreground/40">|</span>
              <kbd class="px-1 py-0.5 rounded bg-muted font-mono text-[10px] border border-border">Ctrl + Q</kbd>
              <span>清空</span>
            </div>
          </CardContent>
        </Card>

        <!-- 待读队列与历史卡片 -->
        <Card>
          <CardContent class="p-3.5">
            <Tabs
              v-model="activeQueueTab"
              class="w-full"
            >
              <TabsList class="grid grid-cols-2 w-full p-0.5 bg-muted mb-3">
                <TabsTrigger
                  value="queue"
                  class="text-xs h-7 gap-1"
                >
                  待读队列
                  <Badge
                    v-if="queueStats.total > 0"
                    variant="brand"
                    class="text-[10px] px-1 py-0 h-4 ml-1"
                  >
                    {{ queueStats.total }}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="history"
                  class="text-xs h-7"
                >
                  已读历史
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="queue"
                class="mt-0"
              >
                <div class="max-h-[380px] overflow-y-auto pr-1">
                  <QueueList />
                </div>
              </TabsContent>

              <TabsContent
                value="history"
                class="mt-0"
              >
                <div class="max-h-[380px] overflow-y-auto pr-1">
                  <SpokenHistoryPanel />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
</template>
