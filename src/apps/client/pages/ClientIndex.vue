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
import {
  NAvatar,
  NButton,
  NCard,
  NEllipsis,
  NFlex,
  NGrid,
  NGridItem,
  NIcon,
  NImage,
  NPopconfirm,
  NTag,
  NText,
  NTooltip,
  useThemeVars,
} from 'naive-ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { logoutAccount, useAccount } from '@/api/account'
import CookieInvalidAlert from '@/apps/client/components/CookieInvalidAlert.vue'
import { roomInfo } from '@/apps/client/data/info'
import { useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useVtsFloatWindow } from '@/apps/client/store/useVtsFloatWindow'
import { useVtsStore } from '@/apps/client/store/useVtsStore'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { useWebFetcher } from '@/store/useWebFetcher'

const router = useRouter()
const accountInfo = useAccount()
const themeVars = useThemeVars()

const webfetcher = useWebFetcher()
const biliCookie = useBiliCookie()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const vtsStore = useVtsStore()
const vtsFloatWindow = useVtsFloatWindow()
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
const cookieStatusType = computed(() => {
  if (!biliCookie.hasBiliCookie) return 'warning'
  return biliCookie.isCookieValid ? 'success' : 'error'
})

const cookieStatusLabel = computed(() => {
  if (!biliCookie.hasBiliCookie) return '未同步'
  return biliCookie.isCookieValid ? '有效' : '已失效'
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

// VTS 悬浮窗切换
function toggleVtsFloatWindow() {
  if (vtsFloatWindow.opened) {
    vtsFloatWindow.close()
  } else {
    vtsFloatWindow.open()
  }
}

</script>

<template>
  <NFlex
    vertical
    :size="14"
    class="dashboard-container"
  >
    <!-- 头部主播状态横幅 -->
    <NCard
      size="small"
      bordered
      class="hero-card"
    >
      <div class="hero-wrapper">
        <div class="hero-left">
          <div class="avatar-wrap">
            <NAvatar
              :size="52"
              :src="`${accountInfo.streamerInfo?.faceUrl}@100w`"
              :fallback-src="accountInfo.name?.slice(0, 2)"
              bordered
              round
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <span
              class="status-pulse-dot"
              :class="{ 'status-pulse-dot--live': isStreaming }"
            />
          </div>

          <div class="hero-streamer-meta">
            <div class="hero-title-row">
              <NText
                strong
                class="hero-streamer-name"
              >
                {{ accountInfo.name }}
              </NText>
              <NTag
                size="small"
                :type="isStreaming ? 'success' : 'default'"
                :bordered="false"
                round
              >
                {{ isStreaming ? '● 直播中' : '未开播' }}
              </NTag>
            </div>

            <div class="hero-sub-row">
              <NText depth="3">
                房间: {{ accountInfo.biliRoomId || '未绑定' }}
              </NText>
              <span class="dot-divider">·</span>
              <NText depth="3">
                {{ roomInfo?.parent_area_name ? `${roomInfo.parent_area_name} / ${roomInfo.area_name}` : '未选择分区' }}
              </NText>
              <span class="dot-divider">·</span>
              <NText depth="3">
                UID: {{ accountInfo.streamerInfo?.uId || '—' }}
              </NText>
            </div>
          </div>
        </div>

        <div class="hero-actions">
          <NButton size="small" @click="router.push({ name: 'client-pngtuber' })">PNGtuber</NButton>
          <NButton
            type="primary"
            size="small"
            secondary
            @click="openUrl(liveRoomUrl)"
          >
            <template #icon>
              <NIcon :component="Open24Regular" />
            </template>
            前往直播间
          </NButton>

          <NPopconfirm @positive-click="logoutAccount">
            <template #trigger>
              <NButton
                quaternary
                size="small"
                type="error"
              >
                退出登录
              </NButton>
            </template>
            确定要退出登录吗？B站 Cookie 将需重新扫描
          </NPopconfirm>
        </div>
      </div>
    </NCard>

    <CookieInvalidAlert variant="home" />

    <!-- 核心系统健康矩阵 (4 Bento Grid Cards) -->
    <NGrid
      :x-gap="12"
      :y-gap="12"
      cols="2 900:4"
      item-responsive
    >
      <!-- EventFetcher 弹幕引擎 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          hoverable
          class="health-card"
          @click="router.push({ name: 'client-fetcher' })"
        >
          <div class="health-card-header">
            <div class="health-icon health-icon--fetcher">
              <NIcon :component="CloudArchive24Filled" />
            </div>
            <NTag
              size="tiny"
              :type="webfetcher.state === 'connected' ? 'success' : 'error'"
              :bordered="false"
            >
              {{ webfetcher.state === 'connected' ? '运行中' : '已断开' }}
            </NTag>
          </div>
          <div class="health-title">
            EventFetcher
          </div>
          <div class="health-desc">
            <NText depth="3">
              模式: {{ webfetcher.webfetcherType === 'direct' ? '直连' : '开放平台' }}
            </NText>
          </div>
        </NCard>
      </NGridItem>

      <!-- Bilibili 凭据状态 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          hoverable
          class="health-card"
          @click="router.push({ name: 'client-fetcher' })"
        >
          <div class="health-card-header">
            <div class="health-icon health-icon--cookie">
              <NIcon :component="Cookies24Filled" />
            </div>
            <NTag
              size="tiny"
              :type="cookieStatusType"
              :bordered="false"
            >
              {{ cookieStatusLabel }}
            </NTag>
          </div>
          <div class="health-title">
            B站 Cookie
          </div>
          <div class="health-desc">
            <NText depth="3">
              {{ biliCookie.isCookieValid ? '凭据正常运作' : '需要重新扫码' }}
            </NText>
          </div>
        </NCard>
      </NGridItem>

      <!-- VTube Studio 联动 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          hoverable
          class="health-card"
          @click="router.push({ name: 'client-vts' })"
        >
          <div class="health-card-header">
            <div class="health-icon health-icon--vts">
              <NIcon :component="VideoPerson24Filled" />
            </div>
            <NTag
              size="tiny"
              :type="vtsStore.connected ? 'success' : 'default'"
              :bordered="false"
            >
              {{ vtsStore.connected ? '已连接' : '未连接' }}
            </NTag>
          </div>
          <div class="health-title">
            VTube Studio
          </div>
          <div class="health-desc">
            <NEllipsis>
              <NText depth="3">
                {{ vtsStore.currentModelName || '未加载模型' }}
              </NText>
            </NEllipsis>
          </div>
        </NCard>
      </NGridItem>

      <!-- 自动操作引擎 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          hoverable
          class="health-card"
          @click="router.push({ name: 'client-auto-action-manage' })"
        >
          <div class="health-card-header">
            <div class="health-icon health-icon--auto">
              <NIcon :component="FlashAuto24Filled" />
            </div>
            <NTag
              size="tiny"
              :type="activeAutoActionCount > 0 ? 'success' : 'default'"
              :bordered="false"
            >
              {{ activeAutoActionCount > 0 ? `${activeAutoActionCount} 条规则` : '未启用' }}
            </NTag>
          </div>
          <div class="health-title">
            自动操作
          </div>
          <div class="health-desc">
            <NText depth="3">
              自动回复 / 答谢
            </NText>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 直播浮窗控制中心 (3 Bento Grid Cards) -->
    <NCard
      size="small"
      bordered
      title="直播浮窗控制中心"
    >
      <NGrid
        :x-gap="12"
        :y-gap="12"
        cols="1 768:3"
        item-responsive
      >
        <!-- 弹幕机浮窗 -->
        <NGridItem>
          <div class="float-window-box">
            <div class="float-window-head">
              <div class="float-window-icon-title">
                <NIcon
                  :size="18"
                  :component="Chat24Filled"
                  color="var(--vtsuru-primary)"
                />
                <NText strong>
                  弹幕机浮窗
                </NText>
              </div>
              <NTag
                size="tiny"
                :type="danmakuWindow.isDanmakuWindowOpen ? 'success' : 'default'"
                :bordered="false"
                round
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '运行中' : '未开启' }}
              </NTag>
            </div>

            <div class="float-window-desc">
              桌面半透明置顶弹幕，支持拖拽、穿透与自定义样式。
            </div>

            <div class="float-window-actions">
              <NButton
                size="tiny"
                :type="danmakuWindow.isDanmakuWindowOpen ? 'error' : 'primary'"
                secondary
                @click="toggleDanmakuWindow"
              >
                {{ danmakuWindow.isDanmakuWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </NButton>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    size="tiny"
                    quaternary
                    :disabled="!danmakuWindow.isDanmakuWindowOpen"
                    @click="danmakuWindow.setDanmakuWindowPosition(100, 100)"
                  >
                    <template #icon>
                      <NIcon :component="ArrowReset24Regular" />
                    </template>
                    重置
                  </NButton>
                </template>
                重置浮窗至默认坐标
              </NTooltip>
              <NButton
                size="tiny"
                quaternary
                @click="router.push({ name: 'client-danmaku-window-manage' })"
              >
                设置
              </NButton>
            </div>
          </div>
        </NGridItem>

        <!-- 礼物与排行浮窗 -->
        <NGridItem>
          <div class="float-window-box">
            <div class="float-window-head">
              <div class="float-window-icon-title">
                <NIcon
                  :size="18"
                  :component="Gift24Filled"
                  color="var(--vtsuru-warning, #f59e0b)"
                />
                <NText strong>
                  礼物与高能榜
                </NText>
              </div>
              <NTag
                size="tiny"
                :type="giftWindow.isGiftWindowOpen ? 'success' : 'default'"
                :bordered="false"
                round
              >
                {{ giftWindow.isGiftWindowOpen ? '运行中' : '未开启' }}
              </NTag>
            </div>

            <div class="float-window-desc">
              二合一礼物掉落与高能粉丝榜浮窗，多套精美预设。
            </div>

            <div class="float-window-actions">
              <NButton
                size="tiny"
                :type="giftWindow.isGiftWindowOpen ? 'error' : 'primary'"
                secondary
                @click="toggleGiftWindow"
              >
                {{ giftWindow.isGiftWindowOpen ? '关闭浮窗' : '开启浮窗' }}
              </NButton>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    size="tiny"
                    quaternary
                    :disabled="!giftWindow.isGiftWindowOpen"
                    @click="giftWindow.setPosition(100, 100)"
                  >
                    <template #icon>
                      <NIcon :component="ArrowReset24Regular" />
                    </template>
                    重置
                  </NButton>
                </template>
                重置浮窗至默认坐标
              </NTooltip>
              <NButton
                size="tiny"
                quaternary
                @click="router.push({ name: 'client-gift-window-manage' })"
              >
                设置
              </NButton>
            </div>
          </div>
        </NGridItem>

        <!-- VTS 悬浮窗 -->
        <NGridItem>
          <div class="float-window-box">
            <div class="float-window-head">
              <div class="float-window-icon-title">
                <NIcon
                  :size="18"
                  :component="VideoPerson24Filled"
                  color="#8b5cf6"
                />
                <NText strong>
                  VTS 悬浮面板
                </NText>
              </div>
              <NTag
                size="tiny"
                :type="vtsFloatWindow.opened ? 'success' : 'default'"
                :bordered="false"
                round
              >
                {{ vtsFloatWindow.opened ? '运行中' : '未开启' }}
              </NTag>
            </div>

            <div class="float-window-desc">
              轻量悬浮快捷触控，一键触发模型表情、预设与宏动作。
            </div>

            <div class="float-window-actions">
              <NButton
                size="tiny"
                :type="vtsFloatWindow.opened ? 'error' : 'primary'"
                secondary
                @click="toggleVtsFloatWindow"
              >
                {{ vtsFloatWindow.opened ? '关闭面板' : '开启面板' }}
              </NButton>
              <NButton
                size="tiny"
                quaternary
                @click="router.push({ name: 'client-vts' })"
              >
                VTS 中心
              </NButton>
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- 直播间状态看板与常用入口 (双栏 Bento) -->
    <NGrid
      :x-gap="12"
      :y-gap="12"
      cols="1 900:2"
      item-responsive
    >
      <!-- 直播间实时看板 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          content-style="padding: 0;"
          class="live-monitor-card"
        >
          <template #header>
            <NFlex
              align="center"
              justify="space-between"
            >
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon
                  :component="Live24Filled"
                  color="var(--vtsuru-primary)"
                />
                <NText strong>
                  直播间监视
                </NText>
              </NFlex>
              <NTag
                :type="isStreaming ? 'success' : 'default'"
                size="small"
                :bordered="false"
              >
                {{ isStreaming ? '● 正在推流' : '未推流' }}
              </NTag>
            </NFlex>
          </template>

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
              >
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
              <NTag
                size="tiny"
                type="primary"
                round
                :bordered="false"
              >
                点击前往直播间 ↗
              </NTag>
            </div>
          </div>
          <div
            v-else
            class="client-index-cover__empty"
          >
            <NText depth="3">
              暂无直播间封面信息
            </NText>
          </div>

          <div class="client-index-cover__footer">
            <NButton
              type="primary"
              size="small"
              @click="router.push({ name: 'client-live-manage' })"
            >
              <template #icon>
                <NIcon :component="Live24Filled" />
              </template>
              修改直播标题与分区
            </NButton>
          </div>
        </NCard>
      </NGridItem>

      <!-- 常用功能快速入口 -->
      <NGridItem>
        <NCard
          size="small"
          bordered
          title="常用工作台"
        >
          <div class="launchpad-grid">
            <div
              class="launchpad-item"
              @click="router.push({ name: 'client-live-manage' })"
            >
              <div class="launchpad-icon launchpad-icon--live">
                <NIcon :component="Live24Filled" />
              </div>
              <div class="launchpad-text">
                <div class="launchpad-title">
                  直播控制
                </div>
                <div class="launchpad-sub">
                  OBS 推流与场次信息
                </div>
              </div>
            </div>

            <div
              class="launchpad-item"
              @click="router.push({ name: 'client-read-danmaku' })"
            >
              <div class="launchpad-icon launchpad-icon--tts">
                <NIcon :component="Mic24Filled" />
              </div>
              <div class="launchpad-text">
                <div class="launchpad-title">
                  读弹幕 (TTS)
                </div>
                <div class="launchpad-sub">
                  语音朗读与音色设置
                </div>
              </div>
            </div>

            <div
              class="launchpad-item"
              @click="router.push({ name: 'client-auto-action-manage' })"
            >
              <div class="launchpad-icon launchpad-icon--auto">
                <NIcon :component="FlashAuto24Filled" />
              </div>
              <div class="launchpad-text">
                <div class="launchpad-title">
                  自动操作
                </div>
                <div class="launchpad-sub">
                  入场欢迎与进房致谢
                </div>
              </div>
            </div>

            <div
              class="launchpad-item"
              @click="router.push({ name: 'client-settings' })"
            >
              <div class="launchpad-icon launchpad-icon--settings">
                <NIcon :component="Settings24Filled" />
              </div>
              <div class="launchpad-text">
                <div class="launchpad-title">
                  客户端设置
                </div>
                <div class="launchpad-sub">
                  通知 / 偏好 / 备份
                </div>
              </div>
            </div>
          </div>

          <div
            v-if="rpcServer.running"
            class="rpc-status-footer"
          >
            <div class="rpc-status-left">
              <NIcon
                :size="14"
                :component="PlugConnected24Filled"
                :color="rpcServer.connectionCount > 0 ? 'var(--vtsuru-success)' : 'var(--vtsuru-fg-muted)'"
              />
              <NText depth="3">
                本地开放接口: {{ rpcServer.connectionCount }} 个外部网页/工具已连接
              </NText>
            </div>
          </div>
        </NCard>
      </NGridItem>
    </NGrid>
  </NFlex>
</template>

<style scoped>
.dashboard-container {
  padding-bottom: 24px;
}

/* 主播横幅 */
.hero-card {
  background: var(--vtsuru-bg-surface);
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
  background-color: var(--vtsuru-fg-muted);
  border: 2px solid var(--vtsuru-bg-surface);
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
  color: var(--vtsuru-fg-muted);
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
  border-radius: var(--vtsuru-radius, 6px);
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

.health-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.health-desc {
  font-size: 12px;
}

/* 直播浮窗控制盒 */
.float-window-box {
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.04));
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
  color: var(--vtsuru-fg-muted);
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
  border-radius: var(--vtsuru-radius, 6px);
  overflow: hidden;
  cursor: pointer;
  background-color: var(--vtsuru-bg-muted, #1e1e20);
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
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius, 6px);
  background: var(--vtsuru-bg-surface);
  cursor: pointer;
  transition: all 0.2s ease;
}

.launchpad-item:hover {
  background: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.08));
  border-color: var(--vtsuru-border-hover, var(--vtsuru-primary));
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
  color: var(--vtsuru-fg-muted);
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
  color: var(--vtsuru-fg-muted);
  margin-top: 2px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rpc-status-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--vtsuru-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.rpc-status-left {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
