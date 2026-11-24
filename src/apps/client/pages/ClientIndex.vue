<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  CheckCircle2,
  CircleSlash,
  CloudUpload,
  Cookie,
  ExternalLink,
  Gift,
  Keyboard,
  Loader2,
  MessageSquare,
  Monitor,
  Play,
  Plug,
  PowerOff,
  Radio,
  RotateCcw,
  SlidersHorizontal,
  Smile,
  XCircle,
} from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { logoutAccount, useAccount } from '@/api/account'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import ObsSceneQuickPanel from '@/apps/client/components/live-manage/ObsSceneQuickPanel.vue'
import StartLiveConfirmDialog from '@/apps/client/components/tools/StartLiveConfirmDialog.vue'
import { isLiveStreaming, roomInfo } from '@/apps/client/data/info'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useLiveRoutine } from '@/apps/client/store/useLiveRoutine'
import { useOBSStore } from '@/apps/client/store/useOBSStore'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { DEFAULT_OVERLAY_POSITION } from '@/apps/client/utils/overlayWindow'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

const router = useRouter()
const accountInfo = useAccount()

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const obsStore = useOBSStore()
const vtsStore = useVtsStore()
const liveRoutine = useLiveRoutine()
const rpcServer = useFetcherRpcServer()
const showStartConfirm = ref(false)

onMounted(() => {
  void liveRoutine.init()
})

const roomCover = computed(() => {
  return roomInfo.value?.user_cover || roomInfo.value?.keyframe || ''
})
const liveRoomUrl = computed(() => `https://live.bilibili.com/${accountInfo.value.biliRoomId}`)

const cookieBadgeMeta = computed(() => {
  if (!biliCookie.hasBiliCookie) {
    return { variant: 'warning' as const, text: '未同步' }
  }
  return biliCookie.isCookieValid
    ? { variant: 'success' as const, text: '有效' }
    : { variant: 'destructive' as const, text: '已失效' }
})

function toggleDanmakuWindow() {
  if (danmakuWindow.isDanmakuWindowOpen) {
    danmakuWindow.closeWindow()
  } else {
    danmakuWindow.openWindow()
  }
}

function toggleGiftWindow() {
  if (giftWindow.isGiftWindowOpen) {
    giftWindow.closeWindow()
  } else {
    giftWindow.openWindow()
  }
}
</script>

<template>
  <div class="flex flex-col gap-3.5 pb-6">
    <!-- 头部主播驾驶舱横幅（含一键开播/下播编排） -->
    <Card>
      <CardContent class="p-4">
        <div class="flex-between gap-4 flex-wrap">
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="relative shrink-0">
              <Avatar class="size-13 border">
                <AvatarImage
                  :src="`${accountInfo.streamerInfo?.faceUrl}@100w`"
                  alt="Avatar"
                  referrerpolicy="no-referrer"
                />
                <AvatarFallback class="text-sm font-semibold">
                  {{ accountInfo.name?.slice(0, 2) }}
                </AvatarFallback>
              </Avatar>
              <span
                class="absolute right-0 bottom-0 size-3 rounded-full bg-muted-foreground border-2 border-card"
                :class="{
                  'bg-emerald-500 shadow-[0_0_0_0_rgba(16,185,129,0.7)] animate-[pulse-ring_2s_infinite_cubic-bezier(0.66,0,0,1)]':
                    isLiveStreaming,
                }"
              />
            </div>

            <div class="flex flex-col gap-0.5 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-base text-foreground tracking-tight">
                  {{ accountInfo.name }}
                </span>
                <Badge
                  :variant="isLiveStreaming ? 'success' : 'secondary'"
                  size="sm"
                >
                  <span
                    v-if="isLiveStreaming"
                    class="inline-block size-1.5 rounded-full bg-current animate-pulse"
                  />
                  <span>{{ isLiveStreaming ? '直播中' : '未开播' }}</span>
                </Badge>
              </div>

              <div class="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap">
                <span>房间: {{ accountInfo.biliRoomId || '未绑定' }}</span>
                <span class="opacity-50">·</span>
                <span>
                  {{
                    roomInfo?.parent_area_name ? `${roomInfo.parent_area_name} / ${roomInfo.area_name}` : '未选择分区'
                  }}
                </span>
                <span class="opacity-50">·</span>
                <span>UID: {{ accountInfo.streamerInfo?.uId || '—' }}</span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <Button
              class="gap-1.5"
              :disabled="Boolean(liveRoutine.runningMode)"
              @click="showStartConfirm = true"
            >
              <Loader2
                v-if="liveRoutine.runningMode === 'start'"
                class="size-3.5 animate-spin"
              />
              <Play
                v-else
                class="size-3.5"
              />
              一键开播准备
            </Button>

            <Popconfirm
              title="确认执行下播收尾流程？"
              @confirm="liveRoutine.executeStopRoutine()"
            >
              <Button
                variant="outline"
                class="gap-1.5"
                :disabled="Boolean(liveRoutine.runningMode)"
              >
                <Loader2
                  v-if="liveRoutine.runningMode === 'stop'"
                  class="size-3.5 animate-spin"
                />
                <PowerOff
                  v-else
                  class="size-3.5"
                />
                下播收尾
              </Button>
            </Popconfirm>

            <Button
              variant="secondary"
              class="gap-1.5 text-primary hover:text-primary"
              @click="openUrl(liveRoomUrl)"
            >
              <ExternalLink class="size-3.5" />
              直播间
            </Button>

            <Popconfirm
              title="确认退出"
              @positive-click="logoutAccount"
            >
              <template #trigger>
                <Button
                  variant="ghost"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  退出登录
                </Button>
              </template>
              确定要退出登录吗？B站 Cookie 将需重新扫描
            </Popconfirm>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 一键开播/下播执行进度（仅执行后出现） -->
    <Card v-if="liveRoutine.stepLogs.length > 0">
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <CardTitle>开播编排执行记录</CardTitle>
        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="outline"
            class="gap-1"
            @click="router.push({ name: 'client-tools', query: { tab: 'routine' } })"
          >
            <SlidersHorizontal class="size-3" />
            配置步骤
          </Button>
          <Button
            size="xs"
            variant="ghost"
            :disabled="Boolean(liveRoutine.runningMode)"
            @click="liveRoutine.stepLogs = []"
          >
            收起
          </Button>
        </div>
      </CardHeader>
      <CardContent class="p-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        <div
          v-for="log in liveRoutine.stepLogs"
          :key="log.id"
          class="flex-between gap-2 text-xs px-2.5 py-1.5 rounded-md border border-border bg-muted/20"
        >
          <div class="flex items-center gap-1.5 min-w-0">
            <Loader2
              v-if="log.status === 'running'"
              class="size-3.5 animate-spin text-primary shrink-0"
            />
            <CheckCircle2
              v-else-if="log.status === 'ok'"
              class="size-3.5 text-emerald-500 shrink-0"
            />
            <CircleSlash
              v-else-if="log.status === 'skipped'"
              class="size-3.5 text-muted-foreground shrink-0"
            />
            <XCircle
              v-else
              class="size-3.5 text-destructive shrink-0"
            />
            <span class="font-medium truncate">{{ log.title }}</span>
          </div>
          <span class="text-[11px] text-muted-foreground truncate max-w-[45%]">{{ log.detail }}</span>
        </div>
      </CardContent>
    </Card>

    <CookieInvalidAlert variant="home" />

    <!-- 核心链路状态（精简 4 格，不与工具中心重复） -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Card
        class="cursor-pointer transition-transform duration-150 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-fetcher' })"
      >
        <CardContent class="p-3">
          <div class="flex-between mb-2">
            <div class="size-7 rounded-md flex-center bg-blue-500/12 text-blue-500">
              <CloudUpload class="size-4" />
            </div>
            <Badge
              :variant="webfetcher.state === 'connected' ? 'success' : 'destructive'"
              size="xs"
            >
              {{ webfetcher.state === 'connected' ? '运行中' : '已断开' }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">EventFetcher</div>
          <div class="text-xs text-muted-foreground mt-0.5">
            模式: {{ webfetcher.webfetcherType === 'direct' ? '直连' : '开放平台' }}
          </div>
        </CardContent>
      </Card>

      <Card
        class="cursor-pointer transition-transform duration-150 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-account-manage' })"
      >
        <CardContent class="p-3">
          <div class="flex-between mb-2">
            <div class="size-7 rounded-md flex-center bg-amber-500/12 text-amber-500">
              <Cookie class="size-4" />
            </div>
            <Badge
              :variant="cookieBadgeMeta.variant"
              size="xs"
            >
              {{ cookieBadgeMeta.text }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">B站账号与凭据</div>
          <div class="text-xs text-muted-foreground mt-0.5">
            {{ biliCookie.isCookieValid ? '凭据正常运作' : '需要重新扫码' }}
          </div>
        </CardContent>
      </Card>

      <Card
        class="cursor-pointer transition-transform duration-150 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-live-manage' })"
      >
        <CardContent class="p-3">
          <div class="flex-between mb-2">
            <div class="size-7 rounded-md flex-center bg-sky-500/12 text-sky-500">
              <Monitor class="size-4" />
            </div>
            <Badge
              :variant="obsStore.obsConnected ? 'success' : 'secondary'"
              size="xs"
            >
              {{ obsStore.obsConnected ? (obsStore.obsStreamActive ? '推流中' : '已连接') : '未连接' }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">OBS Studio</div>
          <div class="text-xs text-muted-foreground truncate mt-0.5">
            {{ obsStore.obsConnected ? `场景: ${obsStore.currentObsScene || '已就绪'}` : '点击连接与配置' }}
          </div>
        </CardContent>
      </Card>

      <Card
        class="cursor-pointer transition-transform duration-150 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-vts' })"
      >
        <CardContent class="p-3">
          <div class="flex-between mb-2">
            <div class="size-7 rounded-md flex-center bg-purple-500/12 text-purple-500">
              <Smile class="size-4" />
            </div>
            <Badge
              :variant="vtsStore.connected ? 'success' : 'secondary'"
              size="xs"
            >
              {{ vtsStore.connected ? '已连接' : '未连接' }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">VTube Studio</div>
          <div class="text-xs text-muted-foreground truncate mt-0.5">
            {{ vtsStore.currentModelName || '未加载模型' }}
          </div>
        </CardContent>
      </Card>
    </div>

    <!-- 直播间封面 & VTsuru 场景快捷切场 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
      <!-- 直播间状态与封面 -->
      <Card class="flex flex-col justify-between overflow-hidden">
        <div>
          <CardHeader class="p-3 border-b flex flex-row items-center justify-between">
            <CardTitle>当前直播间</CardTitle>
            <Button
              size="xs"
              variant="outline"
              @click="router.push({ name: 'client-live-manage' })"
            >
              直播管理
            </Button>
          </CardHeader>
          <CardContent class="p-3">
            <div
              v-if="roomCover"
              class="group relative w-full aspect-video rounded-md overflow-hidden cursor-pointer bg-muted"
              @click="openUrl(liveRoomUrl)"
            >
              <div class="w-full h-full overflow-hidden">
                <img
                  :src="roomCover"
                  alt="直播间封面"
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover block transition-transform duration-200 ease-out group-hover:scale-105"
                />
              </div>
              <div
                class="absolute inset-0 z-1 bg-gradient-to-t from-black/90 via-black/25 to-black/5 pointer-events-none"
              />
              <div class="absolute left-3 right-3 bottom-2.5 z-2 text-white pointer-events-none">
                <div class="text-xs font-semibold text-shadow-md overflow-hidden whitespace-nowrap text-ellipsis">
                  {{ roomInfo?.title || '暂无标题' }}
                </div>
                <div class="text-[11px] text-white/80 mt-0.5">
                  <span v-if="roomInfo?.parent_area_name"
                    >{{ roomInfo.parent_area_name }} / {{ roomInfo.area_name }}</span
                  >
                  <span v-if="roomInfo?.online"> · 人气: {{ roomInfo.online }}</span>
                </div>
              </div>
              <div
                class="absolute top-2.5 right-2.5 z-3 opacity-0 -translate-y-1 transition-[opacity,transform] duration-200 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0"
              >
                <Badge
                  variant="default"
                  size="sm"
                  class="gap-1"
                >
                  <span>点击前往直播间</span>
                  <ExternalLink class="size-3" />
                </Badge>
              </div>
            </div>

            <div
              v-else
              class="flex justify-center p-8"
            >
              <span class="text-xs text-muted-foreground">暂无直播间封面信息</span>
            </div>
          </CardContent>
        </div>

        <div class="p-2.5 px-3 pb-3 flex justify-end">
          <Button
            class="gap-1.5"
            @click="router.push({ name: 'client-live-manage' })"
          >
            <Radio class="size-3.5" />
            修改直播标题与分区
          </Button>
        </div>
      </Card>

      <!-- VTsuru 场景快捷切换 + RPC 状态 -->
      <div class="space-y-3">
        <ObsSceneQuickPanel compact />

        <Card v-if="rpcServer.running">
          <CardContent class="p-3 flex-between gap-2 text-xs text-muted-foreground">
            <div class="flex items-center gap-1.5 min-w-0">
              <Plug
                class="size-3.5 shrink-0"
                :class="rpcServer.connectionCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'"
              />
              <span class="truncate">本地开放接口: {{ rpcServer.connectionCount }} 个外部网页/工具已连接</span>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="shrink-0"
              @click="router.push({ name: 'client-tools', query: { tab: 'capabilities' } })"
            >
              查看 RPC
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>

    <!-- 直播浮窗控制中心 -->
    <Card>
      <CardHeader class="p-3 border-b flex flex-row items-center justify-between gap-2">
        <CardTitle>直播浮窗控制中心</CardTitle>
        <div class="flex items-center gap-1.5">
          <Button
            size="xs"
            variant="ghost"
            class="gap-1 text-muted-foreground"
            @click="router.push({ name: 'client-tools', query: { tab: 'shortcuts' } })"
          >
            <Keyboard class="size-3" />
            全局热键
          </Button>
          <Button
            size="xs"
            variant="ghost"
            class="gap-1 text-muted-foreground"
            @click="router.push({ name: 'client-tools', query: { tab: 'routine' } })"
          >
            <SlidersHorizontal class="size-3" />
            编排开播流程
          </Button>
        </div>
      </CardHeader>
      <CardContent class="p-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- 弹幕机浮窗 -->
          <div class="p-3 border border-border rounded-md bg-muted/30 flex flex-col gap-2 h-full box-border">
            <div class="flex-between">
              <div class="flex items-center gap-1.5">
                <MessageSquare class="size-4 text-primary" />
                <span class="font-semibold text-xs text-foreground">弹幕机</span>
              </div>
              <Badge
                :variant="danmakuWindow.isDanmakuWindowOpen ? 'success' : 'secondary'"
                size="xs"
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="text-xs text-muted-foreground leading-normal flex-1">在桌面上显示弹幕机悬浮窗</div>

            <div class="flex items-center gap-1.5 mt-1">
              <Button
                size="xs"
                variant="secondary"
                :class="
                  danmakuWindow.isDanmakuWindowOpen
                    ? 'text-destructive hover:text-destructive'
                    : 'text-primary hover:text-primary'
                "
                @click="toggleDanmakuWindow"
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="gap-1"
                      :disabled="!danmakuWindow.isDanmakuWindowOpen"
                      @click="danmakuWindow.setDanmakuWindowPosition(DEFAULT_OVERLAY_POSITION.x, DEFAULT_OVERLAY_POSITION.y)"
                    >
                      <RotateCcw class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>重置浮窗至默认坐标 (100, 100)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="xs"
                variant="ghost"
                class="text-muted-foreground"
                @click="router.push({ name: 'client-danmaku-window-manage' })"
              >
                设置
              </Button>
            </div>
          </div>

          <!-- 礼物与排行浮窗 -->
          <div class="p-3 border border-border rounded-md bg-muted/30 flex flex-col gap-2 h-full box-border">
            <div class="flex-between">
              <div class="flex items-center gap-1.5">
                <Gift class="size-4 text-amber-500" />
                <span class="font-semibold text-xs text-foreground">礼物与排行</span>
              </div>
              <Badge
                :variant="giftWindow.isGiftWindowOpen ? 'success' : 'secondary'"
                size="xs"
              >
                {{ giftWindow.isGiftWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="text-xs text-muted-foreground leading-normal flex-1">在桌面上显示礼物展示与舰队排行悬浮窗</div>

            <div class="flex items-center gap-1.5 mt-1">
              <Button
                size="xs"
                variant="secondary"
                :class="
                  giftWindow.isGiftWindowOpen
                    ? 'text-destructive hover:text-destructive'
                    : 'text-primary hover:text-primary'
                "
                @click="toggleGiftWindow"
              >
                {{ giftWindow.isGiftWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="gap-1"
                      :disabled="!giftWindow.isGiftWindowOpen"
                      @click="giftWindow.setPosition(DEFAULT_OVERLAY_POSITION.x, DEFAULT_OVERLAY_POSITION.y)"
                    >
                      <RotateCcw class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>重置浮窗至默认坐标 (100, 100)</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="xs"
                variant="ghost"
                class="text-muted-foreground"
                @click="router.push({ name: 'client-gift-window-manage' })"
              >
                设置
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
    <!-- 开播准备确认弹窗 -->
    <StartLiveConfirmDialog v-model:open="showStartConfirm" />
  </div>
</template>

<style scoped>
@keyframes pulse-ring {
  0% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  }
  70% {
    box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
  }
}
</style>
