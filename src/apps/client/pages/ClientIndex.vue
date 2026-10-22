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
  <div class="dashboard-container flex flex-col gap-3.5">
    <!-- 头部主播状态横幅 -->
    <Card class="border bg-card hero-card">
      <CardContent class="p-4">
        <div class="hero-wrapper">
          <div class="hero-left">
            <div class="avatar-wrap">
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
                class="status-pulse-dot"
                :class="{ 'status-pulse-dot--live': isStreaming }"
              />
            </div>

            <div class="hero-streamer-meta">
              <div class="hero-title-row">
                <span class="font-bold text-base text-foreground hero-streamer-name">
                  {{ accountInfo.name }}
                </span>
                <Badge
                  variant="outline"
                  class="text-xs h-5 px-2"
                  :class="isStreaming ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
                >
                  {{ isStreaming ? '● 直播中' : '未开播' }}
                </Badge>
              </div>

              <div class="hero-sub-row text-xs text-muted-foreground">
                <span>房间: {{ accountInfo.biliRoomId || '未绑定' }}</span>
                <span class="dot-divider">·</span>
                <span>
                  {{ roomInfo?.parent_area_name ? `${roomInfo.parent_area_name} / ${roomInfo.area_name}` : '未选择分区' }}
                </span>
                <span class="dot-divider">·</span>
                <span>UID: {{ accountInfo.streamerInfo?.uId || '—' }}</span>
              </div>
            </div>
          </div>

          <div class="hero-actions">
            <Button variant="secondary" @click="router.push({ name: 'client-pngtuber' })">
              PNGtuber
            </Button>
            <Button variant="secondary" class="gap-1.5 text-primary hover:text-primary" @click="openUrl(liveRoomUrl)">
              <Open24Regular class="size-3.5" />
              前往直播间
            </Button>

            <Popconfirm
              title="确认退出"
              @positive-click="logoutAccount"
            >
              <template #trigger>
                <Button variant="ghost" class="text-destructive hover:bg-destructive/10 hover:text-destructive">
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
        class="border bg-card health-card"
        @click="router.push({ name: 'client-fetcher' })"
      >
        <CardContent class="p-3">
          <div class="health-card-header">
            <div class="health-icon health-icon--fetcher">
              <CloudArchive24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="webfetcher.state === 'connected' ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'border-destructive/40 text-destructive bg-destructive/10'"
            >
              {{ webfetcher.state === 'connected' ? '运行中' : '已断开' }}
            </Badge>
          </div>
          <div class="health-title text-xs font-semibold text-foreground">
            EventFetcher
          </div>
          <div class="health-desc text-xs text-muted-foreground mt-0.5">
            模式: {{ webfetcher.webfetcherType === 'direct' ? '直连' : '开放平台' }}
          </div>
        </CardContent>
      </Card>

      <!-- Bilibili 凭据状态 -->
      <Card
        class="border bg-card health-card"
        @click="router.push({ name: 'client-fetcher' })"
      >
        <CardContent class="p-3">
          <div class="health-card-header">
            <div class="health-icon health-icon--cookie">
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
          <div class="health-title text-xs font-semibold text-foreground">
            B站 Cookie
          </div>
          <div class="health-desc text-xs text-muted-foreground mt-0.5">
            {{ biliCookie.isCookieValid ? '凭据正常运作' : '需要重新扫码' }}
          </div>
        </CardContent>
      </Card>

      <!-- VTube Studio 联动 -->
      <Card
        class="border bg-card health-card"
        @click="router.push({ name: 'client-vts' })"
      >
        <CardContent class="p-3">
          <div class="health-card-header">
            <div class="health-icon health-icon--vts">
              <VideoPerson24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="vtsStore.connected ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
            >
              {{ vtsStore.connected ? '已连接' : '未连接' }}
            </Badge>
          </div>
          <div class="health-title text-xs font-semibold text-foreground">
            VTube Studio
          </div>
          <div class="health-desc text-xs text-muted-foreground truncate mt-0.5">
            {{ vtsStore.currentModelName || '未加载模型' }}
          </div>
        </CardContent>
      </Card>

      <!-- 自动操作引擎 -->
      <Card
        class="border bg-card health-card"
        @click="router.push({ name: 'client-auto-action-manage' })"
      >
        <CardContent class="p-3">
          <div class="health-card-header">
            <div class="health-icon health-icon--auto">
              <FlashAuto24Filled class="size-4" />
            </div>
            <Badge
              variant="outline"
              class="text-[10px] h-4.5 px-1.5"
              :class="activeAutoActionCount > 0 ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
            >
              {{ activeAutoActionCount > 0 ? `${activeAutoActionCount} 条规则` : '未启用' }}
            </Badge>
          </div>
          <div class="health-title text-xs font-semibold text-foreground">
            自动操作
          </div>
          <div class="health-desc text-xs text-muted-foreground mt-0.5">
            自动回复 / 答谢
          </div>
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
          <div class="float-window-box">
            <div class="float-window-head">
              <div class="float-window-icon-title">
                <Chat24Filled class="size-4 text-primary" />
                <span class="font-semibold text-xs text-foreground">弹幕机</span>
              </div>
              <Badge
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
                :class="danmakuWindow.isDanmakuWindowOpen ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="float-window-desc">
              在桌面上显示弹幕机悬浮窗
            </div>

            <div class="float-window-actions">
              <Button size="xs" variant="secondary" class="h-6 text-[11px]" :class="danmakuWindow.isDanmakuWindowOpen ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary'" @click="toggleDanmakuWindow">
                {{ danmakuWindow.isDanmakuWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="h-6 text-[11px] px-2 gap-1" :disabled="!danmakuWindow.isDanmakuWindowOpen" @click="danmakuWindow.setDanmakuWindowPosition(100, 100)">
                      <ArrowReset24Regular class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    重置浮窗至默认坐标
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button size="xs" variant="ghost" class="h-6 text-[11px] px-2 text-muted-foreground" @click="router.push({ name: 'client-danmaku-window-manage' })">
                设置
              </Button>
            </div>
          </div>

          <!-- 礼物与排行浮窗 -->
          <div class="float-window-box">
            <div class="float-window-head">
              <div class="float-window-icon-title">
                <Gift24Filled class="size-4 text-amber-500" />
                <span class="font-semibold text-xs text-foreground">礼物与高能榜</span>
              </div>
              <Badge
                variant="outline"
                class="text-[10px] h-4.5 px-1.5"
                :class="giftWindow.isGiftWindowOpen ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
              >
                {{ giftWindow.isGiftWindowOpen ? '运行中' : '未开启' }}
              </Badge>
            </div>

            <div class="float-window-desc">
              礼物掉落与高能粉丝榜浮窗
            </div>

            <div class="float-window-actions">
              <Button size="xs" variant="secondary" class="h-6 text-[11px]" :class="giftWindow.isGiftWindowOpen ? 'text-destructive hover:text-destructive' : 'text-primary hover:text-primary'" @click="toggleGiftWindow">
                {{ giftWindow.isGiftWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button size="xs" variant="ghost" class="h-6 text-[11px] px-2 gap-1" :disabled="!giftWindow.isGiftWindowOpen" @click="giftWindow.setPosition(100, 100)">
                      <ArrowReset24Regular class="size-3" />
                      重置
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent class="text-xs">
                    重置浮窗至默认坐标
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Button size="xs" variant="ghost" class="h-6 text-[11px] px-2 text-muted-foreground" @click="router.push({ name: 'client-gift-window-manage' })">
                设置
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 直播间状态看板与常用入口 (双栏 Bento) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <!-- 直播间实时看板 -->
      <Card class="border bg-card live-monitor-card overflow-hidden">
        <CardHeader class="p-3 pb-2 border-b flex flex-row items-center justify-between">
          <div class="flex items-center gap-1.5">
            <Live24Filled class="size-4 text-primary" />
            <CardTitle class="text-sm font-semibold">直播间监视</CardTitle>
          </div>
          <Badge
            variant="outline"
            class="text-xs h-5 px-1.5"
            :class="isStreaming ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10' : 'text-muted-foreground'"
          >
            {{ isStreaming ? '● 正在推流' : '未推流' }}
          </Badge>
        </CardHeader>

        <div
          v-if="roomCover"
          class="client-index-cover"
          @click="openUrl(liveRoomUrl)"
        >
          <div class="client-index-cover__media">
            <img
              :src="roomCover"
              alt="直播间封面"
              referrerpolicy="no-referrer"
              class="client-index-cover__img"
            />
          </div>
          <div class="client-index-cover__mask" />
          <div class="client-index-cover__meta">
            <div class="client-index-cover__title">
              {{ roomInfo?.title || '暂无标题' }}
            </div>
            <div class="client-index-cover__sub">
              <span v-if="roomInfo?.parent_area_name">{{ roomInfo.parent_area_name }} / {{ roomInfo.area_name }}</span>
              <span v-if="roomInfo?.online"> · 人气: {{ roomInfo.online }}</span>
            </div>
          </div>
          <div class="client-index-cover__hint">
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
          class="client-index-cover__empty"
        >
          <span class="text-xs text-muted-foreground">暂无直播间封面信息</span>
        </div>

        <div class="client-index-cover__footer">
          <Button class="gap-1.5" @click="router.push({ name: 'client-live-manage' })">
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
            <div class="launchpad-grid">
              <div
                class="launchpad-item"
                @click="router.push({ name: 'client-live-manage' })"
              >
                <div class="launchpad-icon launchpad-icon--live">
                  <Live24Filled class="size-4" />
                </div>
                <div class="launchpad-text">
                  <div class="launchpad-title">直播控制</div>
                  <div class="launchpad-sub">OBS 推流与场次信息</div>
                </div>
              </div>

              <div
                class="launchpad-item"
                @click="router.push({ name: 'client-read-danmaku' })"
              >
                <div class="launchpad-icon launchpad-icon--tts">
                  <Mic24Filled class="size-4" />
                </div>
                <div class="launchpad-text">
                  <div class="launchpad-title">读弹幕 (TTS)</div>
                  <div class="launchpad-sub">语音朗读与音色设置</div>
                </div>
              </div>

              <div
                class="launchpad-item"
                @click="router.push({ name: 'client-auto-action-manage' })"
              >
                <div class="launchpad-icon launchpad-icon--auto">
                  <FlashAuto24Filled class="size-4" />
                </div>
                <div class="launchpad-text">
                  <div class="launchpad-title">自动操作</div>
                  <div class="launchpad-sub">入场欢迎与进房致谢</div>
                </div>
              </div>

              <div
                class="launchpad-item"
                @click="router.push({ name: 'client-settings' })"
              >
                <div class="launchpad-icon launchpad-icon--settings">
                  <Settings24Filled class="size-4" />
                </div>
                <div class="launchpad-text">
                  <div class="launchpad-title">客户端设置</div>
                  <div class="launchpad-sub">通知 / 偏好 / 备份</div>
                </div>
              </div>
            </div>
          </CardContent>
        </div>

        <div
          v-if="rpcServer.running"
          class="rpc-status-footer p-3 border-t bg-muted/10 text-xs text-muted-foreground flex items-center justify-between"
        >
          <div class="rpc-status-left flex items-center gap-1.5">
            <PlugConnected24Filled
              class="size-3.5"
              :class="rpcServer.connectionCount > 0 ? 'text-emerald-500' : 'text-muted-foreground'"
            />
            <span>
              本地开放接口: {{ rpcServer.connectionCount }} 个外部网页/工具已连接
            </span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding-bottom: 24px;
}

/* 主播横幅 */
.hero-card {
  background: var(--card);
}

.hero-wrapper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.avatar-wrap {
  position: relative;
  flex-shrink: 0;
}

.status-pulse-dot {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background-color: var(--muted-foreground);
  border: 2px solid var(--card);
}

.status-pulse-dot--live {
  background-color: var(--vtsuru-success, #10b981);
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
  animation: pulse-ring 2s infinite cubic-bezier(0.66, 0, 0, 1);
}

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

.hero-streamer-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.hero-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero-streamer-name {
  font-size: 16px;
  letter-spacing: -0.01em;
}

.hero-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}

.dot-divider {
  color: var(--muted-foreground);
  opacity: 0.5;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 核心健康卡片 */
.health-card {
  cursor: pointer;
  transition: all 0.2s ease;
  height: 100%;
}

.health-card:hover {
  transform: translateY(-2px);
}

.health-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.health-icon {
  width: 28px;
  height: 28px;
  border-radius: var(--radius, 6px);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.health-icon--fetcher {
  background-color: rgba(59, 130, 246, 0.12);
  color: #3b82f6;
}

.health-icon--cookie {
  background-color: rgba(245, 158, 11, 0.12);
  color: #f59e0b;
}

.health-icon--vts {
  background-color: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.health-icon--auto {
  background-color: rgba(16, 185, 129, 0.12);
  color: #10b981;
}

/* 直播浮窗控制盒 */
.float-window-box {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  background: var(--muted, rgba(128, 128, 128, 0.04));
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  box-sizing: border-box;
}

.float-window-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.float-window-icon-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.float-window-desc {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 1.4;
  flex-grow: 1;
}

.float-window-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

/* 直播间监视卡片 */
.live-monitor-card {
  height: 100%;
}

.client-index-cover {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: var(--radius, 6px);
  overflow: hidden;
  cursor: pointer;
  background-color: var(--muted, #1e1e20);
}

.client-index-cover__media {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.client-index-cover__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1), filter 0.35s ease;
}

.client-index-cover:hover .client-index-cover__img {
  transform: scale(1.05);
  filter: brightness(1.05);
}

.client-index-cover__mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.88) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.05) 100%);
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.client-index-cover__hint {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 3;
  opacity: 0;
  transform: translateY(-4px);
  transition: all 0.25s ease;
  pointer-events: none;
}

.client-index-cover:hover .client-index-cover__hint {
  opacity: 1;
  transform: translateY(0);
}

.client-index-cover__meta {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 10px;
  z-index: 2;
  color: white;
  pointer-events: none;
}

.client-index-cover__title {
  font-size: 13px;
  font-weight: 600;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.client-index-cover__sub {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 2px;
}

.client-index-cover__empty {
  display: flex;
  justify-content: center;
  padding: 32px;
}

.client-index-cover__footer {
  padding: 10px 12px 12px;
  display: flex;
  justify-content: flex-end;
}

/* 常用工作台 Launchpad */
.launchpad-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.launchpad-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius, 6px);
  background: var(--card);
  cursor: pointer;
  transition: all 0.2s ease;
}

.launchpad-item:hover {
  background: var(--muted, rgba(128, 128, 128, 0.08));
  border-color: var(--brand);
  transform: translateY(-1px);
}

.launchpad-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.launchpad-icon--live {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.launchpad-icon--tts {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.launchpad-icon--auto {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.launchpad-icon--settings {
  background: rgba(107, 114, 128, 0.1);
  color: var(--muted-foreground);
}

.launchpad-text {
  min-width: 0;
}

.launchpad-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}

.launchpad-sub {
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
