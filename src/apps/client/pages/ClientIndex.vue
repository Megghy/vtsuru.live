<script setup lang="ts">
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  ArrowReset24Regular,
  Chat24Filled,
  CloudArchive24Filled,
  Cookies24Filled,
  FlashAuto24Filled,
  Gift24Filled,
  Live24Filled,
  Mic24Filled,
  Open24Regular,
  PlugConnected24Filled,
  Settings24Filled,
  VideoPerson24Filled,
} from '@vicons/fluent'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { logoutAccount, useAccount } from '@/api/account'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import { roomInfo } from '@/apps/client/data/info'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
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
const vtsStore = useVtsStore()
const autoActionStore = useAutoAction()
const rpcServer = useFetcherRpcServer()

// 直播间封面
const roomCover = computed(() => {
  return roomInfo.value?.user_cover || roomInfo.value?.keyframe || ''
})
const liveRoomUrl = computed(() => `https://live.bilibili.com/${accountInfo.value.biliRoomId}`)
const isStreaming = computed(() => roomInfo.value?.live_status === 1)

// 自动操作启用规则数
const activeAutoActionCount = computed(() => {
  if (!autoActionStore.autoActions) return 0
  return autoActionStore.autoActions.filter((a) => a.enabled).length
})

// Cookie 状态
const cookieBadgeMeta = computed(() => {
  if (!biliCookie.hasBiliCookie) {
    return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '未同步' }
  }
  return biliCookie.isCookieValid
    ? { class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', text: '有效' }
    : { class: 'border-destructive/40 text-destructive bg-destructive/10', text: '已失效' }
})

// 弹幕机浮窗切换
function toggleDanmakuWindow() {
  if (danmakuWindow.isDanmakuWindowOpen) {
    danmakuWindow.closeWindow()
  } else {
    danmakuWindow.openWindow()
  }
}

// 礼物与排行浮窗切换
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
    <!-- 头部主播状态横幅 -->
    <Card class="border bg-card">
      <CardContent class="p-4">
        <div class="flex items-center justify-between gap-4 flex-wrap">
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
                    isStreaming,
                }"
              />
            </div>

            <div class="flex flex-col gap-0.5 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-bold text-base text-foreground tracking-tight">
                  {{ accountInfo.name }}
                </span>
                <Badge
                  variant="outline"
                  class="text-xs h-5 px-2"
                  :class="
                    isStreaming ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'
                  "
                >
                  {{ isStreaming ? '● 直播中' : '未开播' }}
                </Badge>
              </div>

              <div class="flex items-center gap-1.5 text-xs text-muted-foreground">
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

          <div class="flex items-center gap-2">
            <Button
              variant="secondary"
              @click="router.push({ name: 'client-pngtuber' })"
            >
              PNGtuber
            </Button>
            <Button
              variant="secondary"
              class="gap-1.5 text-primary hover:text-primary"
              @click="openUrl(liveRoomUrl)"
            >
              <Open24Regular class="size-3.5" />
              前往直播间
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

    <CookieInvalidAlert variant="home" />

    <!-- 核心系统健康矩阵 (4 Bento Grid Cards) -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <!-- EventFetcher 弹幕引擎 -->
      <Card
        class="border bg-card cursor-pointer transition-all duration-200 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-fetcher' })"
      >
        <CardContent class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="size-7 rounded-md flex items-center justify-center text-base bg-blue-500/12 text-blue-500">
              <CloudArchive24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="
                webfetcher.state === 'connected'
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'border-destructive/40 text-destructive bg-destructive/10'
              "
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

      <!-- Bilibili 凭据状态 -->
      <Card
        class="border bg-card cursor-pointer transition-all duration-200 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-fetcher' })"
      >
        <CardContent class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="size-7 rounded-md flex items-center justify-center text-base bg-amber-500/12 text-amber-500">
              <Cookies24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="cookieBadgeMeta.class"
            >
              {{ cookieBadgeMeta.text }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">B站 Cookie</div>
          <div class="text-xs text-muted-foreground mt-0.5">
            {{ biliCookie.isCookieValid ? '凭据正常运作' : '需要重新扫码' }}
          </div>
        </CardContent>
      </Card>

      <!-- VTube Studio 联动 -->
      <Card
        class="border bg-card cursor-pointer transition-all duration-200 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-vts' })"
      >
        <CardContent class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="size-7 rounded-md flex items-center justify-center text-base bg-purple-500/12 text-purple-500">
              <VideoPerson24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="
                vtsStore.connected
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'text-muted-foreground'
              "
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

      <!-- 自动操作引擎 -->
      <Card
        class="border bg-card cursor-pointer transition-all duration-200 h-full hover:-translate-y-0.5"
        @click="router.push({ name: 'client-auto-action-manage' })"
      >
        <CardContent class="p-3">
          <div class="flex items-center justify-between mb-2">
            <div class="size-7 rounded-md flex items-center justify-center text-base bg-emerald-500/12 text-emerald-500">
              <FlashAuto24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="
                activeAutoActionCount > 0
                  ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                  : 'text-muted-foreground'
              "
            >
              {{ activeAutoActionCount > 0 ? `${activeAutoActionCount} 条规则` : '未启用' }}
            </Badge>
          </div>
          <div class="text-xs font-semibold text-foreground">自动操作</div>
          <div class="text-xs text-muted-foreground mt-0.5">自动回复 / 答谢</div>
        </CardContent>
      </Card>
    </div>

    <!-- 直播浮窗控制中心 -->
    <Card class="border bg-card">
      <CardHeader class="p-3 pb-2 border-b">
        <CardTitle class="text-sm font-semibold">直播浮窗控制中心</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <!-- 弹幕机浮窗 -->
          <div class="p-3 border border-border rounded-md bg-muted/30 flex flex-col gap-2 h-full box-border">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <Chat24Filled class="size-4 text-primary" />
                <span class="font-semibold text-xs text-foreground">弹幕机</span>
              </div>
              <Badge
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
                :class="
                  danmakuWindow.isDanmakuWindowOpen
                    ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                    : 'text-muted-foreground'
                "
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="text-xs text-muted-foreground leading-normal flex-1">在桌面上显示弹幕机悬浮窗</div>

            <div class="flex items-center gap-1.5 mt-1">
              <Button
                size="xs"
                variant="secondary"
                class="h-6 text-[11px]"
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
                      class="h-6 text-[11px] px-2 gap-1"
                      :disabled="!danmakuWindow.isDanmakuWindowOpen"
                      @click="danmakuWindow.setDanmakuWindowPosition(100, 100)"
                    >
                      <ArrowReset24Regular class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs"> 重置浮窗至默认坐标 </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="xs"
                variant="ghost"
                class="h-6 text-[11px] px-2 text-muted-foreground"
                @click="router.push({ name: 'client-danmaku-window-manage' })"
              >
                设置
              </Button>
            </div>
          </div>

          <!-- 礼物与排行浮窗 -->
          <div class="p-3 border border-border rounded-md bg-muted/30 flex flex-col gap-2 h-full box-border">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <Gift24Filled class="size-4 text-amber-500" />
                <span class="font-semibold text-xs text-foreground">礼物与排行</span>
              </div>
              <Badge
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
                :class="
                  giftWindow.isGiftWindowOpen
                    ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                    : 'text-muted-foreground'
                "
              >
                {{ giftWindow.isGiftWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="text-xs text-muted-foreground leading-normal flex-1">在桌面上显示礼物展示与舰队排行悬浮窗</div>

            <div class="flex items-center gap-1.5 mt-1">
              <Button
                size="xs"
                variant="secondary"
                class="h-6 text-[11px]"
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
                      class="h-6 text-[11px] px-2 gap-1"
                      :disabled="!giftWindow.isGiftWindowOpen"
                      @click="giftWindow.setPosition(100, 100)"
                    >
                      <ArrowReset24Regular class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs"> 重置浮窗至默认坐标 </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button
                size="xs"
                variant="ghost"
                class="h-6 text-[11px] px-2 text-muted-foreground"
                @click="router.push({ name: 'client-gift-window-manage' })"
              >
                设置
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 直播间快捷概览与常用功能 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
      <!-- 直播间状态与封面 -->
      <Card class="border bg-card flex flex-col justify-between overflow-hidden h-full">
        <div>
          <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
            <CardTitle class="text-sm font-semibold">当前直播间</CardTitle>
            <div class="flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                class="h-6 text-[11px] px-2"
                @click="router.push({ name: 'client-live-manage' })"
              >
                直播管理
              </Button>
            </div>
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
                  class="w-full h-full object-cover block transition-all duration-350 ease-out group-hover:scale-105 group-hover:brightness-105"
                />
              </div>
              <div class="absolute inset-0 z-1 bg-gradient-to-t from-black/90 via-black/25 to-black/5 pointer-events-none" />
              <div class="absolute left-3 right-3 bottom-2.5 z-2 text-white pointer-events-none">
                <div class="text-[13px] font-semibold text-shadow-md overflow-hidden whitespace-nowrap text-ellipsis">
                  {{ roomInfo?.title || '暂无标题' }}
                </div>
                <div class="text-[11px] text-white/80 mt-0.5">
                  <span v-if="roomInfo?.parent_area_name">{{ roomInfo.parent_area_name }} / {{ roomInfo.area_name }}</span>
                  <span v-if="roomInfo?.online"> · 人气: {{ roomInfo.online }}</span>
                </div>
              </div>
              <div class="absolute top-2.5 right-2.5 z-3 opacity-0 -translate-y-1 transition-all duration-250 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0">
                <Badge
                  variant="secondary"
                  class="text-[10px] h-5 px-2 bg-primary text-primary-foreground gap-1"
                >
                  <span>点击前往直播间</span>
                  <Open24Regular class="size-3" />
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
            <Live24Filled class="size-3.5" />
            修改直播标题与分区
          </Button>
        </div>
      </Card>

      <!-- 常用功能快速入口 -->
      <Card class="border bg-card flex flex-col justify-between">
        <div>
          <CardHeader class="p-3 pb-2 border-b">
            <CardTitle class="text-sm font-semibold">常用工作台</CardTitle>
          </CardHeader>
          <CardContent class="p-3">
            <div class="grid grid-cols-2 gap-2.5">
              <div
                class="flex items-center gap-2.5 p-2.5 px-3 border border-border rounded-md bg-card cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:border-primary hover:-translate-y-0.5"
                @click="router.push({ name: 'client-live-manage' })"
              >
                <div class="size-8 rounded-md flex items-center justify-center text-lg shrink-0 bg-blue-500/10 text-blue-500">
                  <Live24Filled class="size-4" />
                </div>
                <div class="min-w-0">
                  <div class="text-[13px] font-medium leading-tight">直播控制</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5 overflow-hidden whitespace-nowrap text-ellipsis">OBS 推流与场次信息</div>
                </div>
              </div>

              <div
                class="flex items-center gap-2.5 p-2.5 px-3 border border-border rounded-md bg-card cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:border-primary hover:-translate-y-0.5"
                @click="router.push({ name: 'client-read-danmaku' })"
              >
                <div class="size-8 rounded-md flex items-center justify-center text-lg shrink-0 bg-emerald-500/10 text-emerald-500">
                  <Mic24Filled class="size-4" />
                </div>
                <div class="min-w-0">
                  <div class="text-[13px] font-medium leading-tight">读弹幕 (TTS)</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5 overflow-hidden whitespace-nowrap text-ellipsis">语音朗读与音色设置</div>
                </div>
              </div>

              <div
                class="flex items-center gap-2.5 p-2.5 px-3 border border-border rounded-md bg-card cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:border-primary hover:-translate-y-0.5"
                @click="router.push({ name: 'client-auto-action-manage' })"
              >
                <div class="size-8 rounded-md flex items-center justify-center text-lg shrink-0 bg-amber-500/10 text-amber-500">
                  <FlashAuto24Filled class="size-4" />
                </div>
                <div class="min-w-0">
                  <div class="text-[13px] font-medium leading-tight">自动操作</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5 overflow-hidden whitespace-nowrap text-ellipsis">入场欢迎与进房致谢</div>
                </div>
              </div>

              <div
                class="flex items-center gap-2.5 p-2.5 px-3 border border-border rounded-md bg-card cursor-pointer transition-all duration-200 hover:bg-muted/60 hover:border-primary hover:-translate-y-0.5"
                @click="router.push({ name: 'client-settings' })"
              >
                <div class="size-8 rounded-md flex items-center justify-center text-lg shrink-0 bg-muted text-muted-foreground">
                  <Settings24Filled class="size-4" />
                </div>
                <div class="min-w-0">
                  <div class="text-[13px] font-medium leading-tight">客户端设置</div>
                  <div class="text-[11px] text-muted-foreground mt-0.5 overflow-hidden whitespace-nowrap text-ellipsis">通知 / 偏好 / 备份</div>
                </div>
              </div>
            </div>
          </CardContent>
        </div>

        <div
          v-if="rpcServer.running"
          class="p-3 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between"
        >
          <div class="flex items-center gap-1.5">
            <PlugConnected24Filled
              class="size-3.5"
              :class="rpcServer.connectionCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'"
            />
            <span> 本地开放接口: {{ rpcServer.connectionCount }} 个外部网页/工具已连接 </span>
          </div>
        </div>
      </Card>
    </div>
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
