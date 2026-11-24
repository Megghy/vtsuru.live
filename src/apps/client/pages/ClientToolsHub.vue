<script setup lang="ts">
import { CheckCircle2, Keyboard, Play, Plug, RefreshCw, ShieldCheck, Wrench, XCircle } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import GlobalShortcutsPanel from '@/apps/client/components/tools/GlobalShortcutsPanel.vue'
import LiveRoutinePanel from '@/apps/client/components/tools/LiveRoutinePanel.vue'
import ToolOverviewPanel from '@/apps/client/components/tools/ToolOverviewPanel.vue'
import { checkUpdate, isCheckingUpdate } from '@/apps/client/data/initialize'
import { useManagedTools } from '@/apps/client/store/useManagedTools'
import { isTauri } from '@/shared/config/api'
import {
  checkClientFeature,
  CLIENT_FEATURES,
  clientCapabilities,
  type ClientFeatureKey,
  clientVersion,
  REQUIRED_CLIENT_VERSION,
} from '@/shared/config/clientVersion'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'

const route = useRoute()
const managedTools = useManagedTools()
const rpcServer = useFetcherRpcServer()

const activeTab = ref<'overview' | 'routine' | 'shortcuts' | 'capabilities'>(
  ['overview', 'routine', 'shortcuts', 'capabilities'].includes(String(route.query.tab))
    ? (route.query.tab as 'overview' | 'routine' | 'shortcuts' | 'capabilities')
    : 'overview',
)

watch(
  () => route.query.tab,
  (tab) => {
    if (
      route.name === 'client-tools' &&
      typeof tab === 'string' &&
      ['overview', 'routine', 'shortcuts', 'capabilities'].includes(tab)
    ) {
      activeTab.value = tab as 'overview' | 'routine' | 'shortcuts' | 'capabilities'
    }
  },
)

onMounted(() => {
  void managedTools.init()
})

const featureMatrix = computed(() =>
  (Object.keys(CLIENT_FEATURES) as ClientFeatureKey[]).map((key) => {
    const req = CLIENT_FEATURES[key]
    const result = checkClientFeature(key)
    return {
      key,
      label: req.label,
      description: req.description,
      minVersion: req.minVersion,
      supported: result.supported,
      reason: result.message,
    }
  }),
)

const rpcMethodsSummary = [
  { name: 'obsGetStatus / obsSwitchScene / obsSyncSceneLayout', desc: 'OBS 状态、切场与多图层布局同步' },
  { name: 'obsSaveReplayBuffer', desc: '触发保存 OBS 高光回放缓存' },
  { name: 'vtsGetStatus / vtsRunSceneAction / vtsLoadModel', desc: 'VTS 状态、机位/表情/热键/宏与模型切换' },
  { name: 'vtsTintModel / vtsDropItem / vtsInjectParameters', desc: 'VTS 分部位染色、掉落道具与参数注入' },
  { name: 'ttsSpeak', desc: '调用客户端读弹幕引擎直接播报文本' },
  { name: 'danmakuSubscribe / danmakuSend / messageSend', desc: '直播间事件流订阅与弹幕/私信发送' },
]
</script>

<template>
  <div class="w-full flex flex-col gap-3.5">
    <ClientPageHeader
      title="工具中心"
      description="统一托管 VTube Studio、OBS Studio、语音转写与周边工具，支持一键开播编排与全局热键"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <Badge
            variant="outline"
            class="font-mono h-6 px-2"
          >
            {{ isTauri() ? `宿主 v${clientVersion ?? '未知'}` : '网页调试态' }}
          </Badge>
          <Button
            v-if="isTauri()"
            size="xs"
            variant="secondary"
            class="gap-1"
            :disabled="isCheckingUpdate"
            @click="checkUpdate(true)"
          >
            <RefreshCw
              class="size-3"
              :class="{ 'animate-spin': isCheckingUpdate }"
            />
            检查更新
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <Tabs
      v-model="activeTab"
      class="w-full"
    >
      <TabsList class="grid w-full max-w-2xl grid-cols-4">
        <TabsTrigger
          value="overview"
          class="gap-1.5"
        >
          <Wrench class="size-3.5" />
          本机托管与配置
        </TabsTrigger>
        <TabsTrigger
          value="routine"
          class="gap-1.5"
        >
          <Play class="size-3.5" />
          一键开播编排
        </TabsTrigger>
        <TabsTrigger
          value="shortcuts"
          class="gap-1.5"
        >
          <Keyboard class="size-3.5" />
          全局热键中心
        </TabsTrigger>
        <TabsTrigger
          value="capabilities"
          class="gap-1.5"
        >
          <ShieldCheck class="size-3.5" />
          版本能力与 RPC
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="overview"
        class="pt-3"
      >
        <ToolOverviewPanel />
      </TabsContent>

      <TabsContent
        value="routine"
        class="pt-3"
      >
        <LiveRoutinePanel />
      </TabsContent>

      <TabsContent
        value="shortcuts"
        class="pt-3"
      >
        <GlobalShortcutsPanel />
      </TabsContent>

      <TabsContent
        value="capabilities"
        class="pt-3 space-y-3.5"
      >
        <!-- 原生能力最低版本检查矩阵 -->
        <Card>
          <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2 flex-wrap">
            <div class="flex items-center gap-2">
              <ShieldCheck class="size-4 text-primary" />
              <CardTitle>客户端原生能力与最低版本要求</CardTitle>
            </div>
            <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <span>推荐宿主 ≥ v{{ REQUIRED_CLIENT_VERSION }}</span>
              <span v-if="clientCapabilities">· API Level {{ clientCapabilities.apiLevel }}</span>
            </div>
          </CardHeader>
          <CardContent class="p-3 space-y-2">
            <div
              v-for="item in featureMatrix"
              :key="item.key"
              class="flex-between gap-3 flex-wrap p-2.5 rounded-md border border-border bg-muted/20"
            >
              <div class="space-y-0.5 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <CheckCircle2
                    v-if="item.supported"
                    class="size-3.5 text-emerald-500 shrink-0"
                  />
                  <XCircle
                    v-else
                    class="size-3.5 text-amber-500 shrink-0"
                  />
                  <span class="text-xs font-semibold text-foreground">{{ item.label }}</span>
                  <Badge
                    variant="outline"
                    size="xs"
                    class="font-mono"
                  >
                    ≥ v{{ item.minVersion }}
                  </Badge>
                </div>
                <div class="text-[11px] text-muted-foreground pl-5">
                  {{ item.supported ? item.description : item.reason }}
                </div>
              </div>
              <Badge
                :variant="item.supported ? 'success' : 'warning'"
                size="xs"
              >
                {{ item.supported ? '已就绪' : '需升级客户端' }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- 本地 RPC 接口开放清单 -->
        <Card>
          <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <Plug class="size-4 text-primary" />
              <CardTitle>本地 RPC 桥接能力 (127.0.0.1:29304)</CardTitle>
            </div>
            <Badge
              :variant="rpcServer.running ? 'success' : 'secondary'"
              size="xs"
            >
              {{ rpcServer.running ? `运行中 · ${rpcServer.connectionCount} 连接` : '未启动' }}
            </Badge>
          </CardHeader>
          <CardContent class="p-3 space-y-1.5">
            <div
              v-for="m in rpcMethodsSummary"
              :key="m.name"
              class="flex-between gap-2 flex-wrap px-2.5 py-2 rounded-md border border-border bg-muted/20 text-xs"
            >
              <span class="font-mono font-medium text-foreground">{{ m.name }}</span>
              <span class="text-[11px] text-muted-foreground">{{ m.desc }}</span>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>
