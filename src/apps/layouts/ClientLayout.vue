<script setup lang="ts">
// 引入 Naive UI 组件 和 图标
import type { MenuOption } from 'naive-ui'
// 引入 Tauri 插件
import { openUrl } from '@tauri-apps/plugin-opener'

import { Chat24Filled, CloudArchive24Filled, Cookies24Filled, FlashAuto24Filled, Live24Filled, Mic24Filled, PlugConnected24Filled, Settings24Filled, VideoPerson24Filled } from '@vicons/fluent'
import { CheckmarkCircle, CloseCircle, Home } from '@vicons/ionicons5'
import { NA, NButton, NCard, NEmpty, NIcon, NInput, NLayout, NLayoutContent, NLayoutSider, NMenu, NFlex, NPopover, NSpin, NTag, NText, NTooltip } from 'naive-ui';
import { computed, h, ref } from 'vue' // 引入 ref, h, computed

import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router' // 引入 Vue Router 组件
// 引入自定义 API 和状态管理
import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn } from '@/api/account'

import { useWebFetcher } from '@/store/useWebFetcher'
import { useFetcherRpcServer } from '@/store/useFetcherRpcServer'
import { initAll, OnClientUnmounted, clientInited, clientInitStage } from '@/apps/client/data/initialize'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useGiftWindow } from '@/apps/client/store/useGiftWindow'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
// 引入子组件
import WindowBar from '@/apps/client/components/WindowBar.vue'
import SpeechMiniController from '@/apps/client/components/SpeechMiniController.vue'
import { BASE_URL } from '@/shared/config'
import '@/apps/client/styles/client-page.css'

// --- 响应式状态 ---

// 获取 webfetcher 状态管理的实例
const router = useRouter()
const route = useRoute()
const webfetcher = useWebFetcher()
const rpcServer = useFetcherRpcServer()
const danmakuWindow = useDanmakuWindow()
const giftWindow = useGiftWindow()
const biliCookie = useBiliCookie()
// 用于存储用户输入的 Token
const token = ref('')
// 侧边栏折叠状态
const siderCollapsed = ref(false)

const cookieStatusType = computed(() => {
  if (!biliCookie.hasBiliCookie) {
    return 'warning'
  }
  return biliCookie.isCookieValid ? 'success' : 'error'
})

const cookieStatusText = computed(() => {
  if (!biliCookie.hasBiliCookie) {
    return '未同步'
  }
  return biliCookie.isCookieValid ? '正常' : '已失效'
})

function goCookieManagement() {
  router.push({ name: 'client-fetcher' })
}

// RPC 连接信息展示: 精简 origin 显示, 连接时长人性化
function formatOrigin(origin: string) {
  if (!origin) return '未知来源'
  try {
    return new URL(origin).host
  } catch {
    return origin
  }
}

function formatSince(connectedAt: number) {
  const seconds = Math.max(0, Math.floor((Date.now() - connectedAt) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  return `${hours} 小时前`
}

// 当前路由对应的菜单高亮 key (修复切换页面后菜单不高亮的问题)
const routeNameToMenuKey: Record<string, string> = {
  'client-index': 'go-back-home',
  'client-fetcher': 'fetcher',
  'client-live-manage': 'live-manage',
  'client-danmaku-window-manage': 'danmaku-window-manage',
  'client-gift-window-manage': 'gift-window-manage',
  'client-auto-action-manage': 'danmaku-auto-action-manage',
  'client-vts': 'vts',
  'client-read-danmaku': 'read-danmaku',
  'client-settings': 'settings',
}
const activeMenuKey = computed(() => routeNameToMenuKey[route.name as string] ?? '')

// --- 计算属性 ---
// (这里没有显式的计算属性，但 isLoggedIn 本身可能是一个来自 account 模块的计算属性)

// --- 方法 ---

/**
 * @description 处理用户登录逻辑
 */
async function login() {
  // 校验 Token 是否为空
  if (!token.value.trim()) {
    window.$message.error('请输入 Token') // 使用全局消息提示
    return
  }

  isLoadingAccount.value = true // 开始加载状态
  try {
    // 调用 API 获取账户信息
    const result = await GetSelfAccount(token.value.trim())

    // 处理 API 返回结果
    if (!result) {
      // 登录失败：无效 Token
      window.$notification.error({ // 使用全局通知
        title: '登陆失败',
        content: '无效的Token',
        duration: 3000,
      })
    } else {
      // 检查 B站主播码是否绑定
      if (!result.isBiliAuthed) {
        window.$notification.error({
          title: '登陆失败',
          content: 'B站主播码未绑定, 请先在网站管理页进行绑定',
          duration: 3000,
        })
      } else {
        // 登录成功
        window.$message.success('登陆成功')
        ACCOUNT.value = result // 更新全局账户信息
        // isLoadingAccount.value = false; // 状态在 finally 中统一处理
        // initAll(false); // 初始化 WebFetcher
      }
    }
  } catch (error) {
    // 处理请求过程中的意外错误
    console.error('Login failed:', error)
    window.$notification.error({
      title: '登陆出错',
      content: '发生未知错误，请稍后再试或联系管理员。',
      duration: 3000,
    })
  } finally {
    // 无论成功或失败，最终都结束加载状态
    isLoadingAccount.value = false
  }
}

// --- 导航菜单配置 ---
// 将菜单项定义为常量，使模板更清晰
const menuOptions = computed(() => {
  return [
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-index' } }, () => '主页'), // 使用 h 函数渲染 RouterLink
      key: 'go-back-home',
      icon: () => h(Home),
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-fetcher' } }, () => 'EventFetcher'),
      key: 'fetcher',
      icon: () => h(CloudArchive24Filled),
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-live-manage' } }, () => '直播管理'),
      key: 'live-manage',
      icon: () => h(Live24Filled),
    },
    {
      label: '直播浮窗',
      key: 'live-windows',
      icon: () => h(Chat24Filled),
      show: danmakuWindow.danmakuWindow != undefined || giftWindow.giftWindow != undefined,
      children: [
        {
          label: () => h(RouterLink, { to: { name: 'client-danmaku-window-manage' } }, () => '弹幕机'),
          key: 'danmaku-window-manage',
          show: danmakuWindow.danmakuWindow != undefined,
        },
        {
          label: () => h(RouterLink, { to: { name: 'client-gift-window-manage' } }, () => '礼物与排行'),
          key: 'gift-window-manage',
          show: giftWindow.giftWindow != undefined,
        },
      ],
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-auto-action-manage' } }, () => '自动操作'),
      key: 'danmaku-auto-action-manage',
      icon: () => h(FlashAuto24Filled),
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-vts' } }, () => 'VTS 控制'),
      key: 'vts',
      icon: () => h(VideoPerson24Filled),
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-read-danmaku' } }, () => '读弹幕'),
      key: 'read-danmaku',
      icon: () => h(Mic24Filled),
    },
    {
      label: () =>
        h(RouterLink, { to: { name: 'client-settings' } }, () => '设置'),
      key: 'settings',
      icon: () => h(Settings24Filled),
    },
  ] as MenuOption[]
})

onMounted(() => {
  window.addEventListener('beforeunload', () => {
    OnClientUnmounted() // 调用清理函数
  })
})
</script>

<template>
  <WindowBar />

  <Transition name="fade">
    <div
      v-if="isLoggedIn && !clientInited"
      class="init-overlay"
    >
      <div class="init-overlay-content">
        <NSpin size="large" />
        <div class="init-stage">
          {{ clientInitStage || '初始化中...' }}
        </div>
      </div>
    </div>
  </Transition>

  <div
    v-if="!isLoggedIn"
    class="login-container"
  >
    <NCard
      v-if="!isLoadingAccount"
      :bordered="false"
      size="large"
      class="login-card"
    >
      <template #header>
        <div class="login-header">
          <div class="login-title">
            登陆
          </div>
          <div class="login-subtitle">
            输入你的 VTsuru Token
          </div>
        </div>
      </template>

      <NFlex
        vertical
        size="large"
      >
        <NFlex vertical>
          <div class="token-label-container">
            <span class="token-label">Token</span>
            <NTooltip placement="top">
              <template #trigger>
                <NA
                  class="token-get-link"
                  @click="openUrl(`https://${BASE_URL}/manage`)"
                >
                  前往获取
                </NA>
              </template>
              登录后在管理面板主页的个人信息下方
            </NTooltip>
          </div>
          <NInput
            v-model:value="token"
            type="password"
            show-password-on="click"
            placeholder="请输入Token"
            @keyup.enter="login"
          />
        </NFlex>

        <NButton
          block
          type="primary"
          :loading="isLoadingAccount"
          :disabled="isLoadingAccount"
          @click="login"
        >
          登陆
        </NButton>
      </NFlex>
    </NCard>

    <NSpin
      v-else
      size="large"
    />
  </div>

  <NLayout
    v-else
    has-sider
    class="main-layout"
    @vue:mounted="initAll(true)"
  >
    <NLayoutSider
      bordered
      collapse-mode="width"
      :collapsed="siderCollapsed"
      :collapsed-width="64"
      :width="200"
      show-trigger="bar"
      class="main-layout-sider"
      @collapse="siderCollapsed = true"
      @expand="siderCollapsed = false"
    >
      <div class="sider-content">
        <div class="sider-header" :class="{ 'sider-header--collapsed': siderCollapsed }">
          <NText
            v-if="!siderCollapsed"
            tag="div"
            class="app-title"
          >
            <span>VTsuru.Client</span>
          </NText>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                quaternary
                circle
                class="fetcher-status-button"
                :type="webfetcher.state === 'connected' ? 'success' : 'error'"
              >
                <CheckmarkCircle
                  v-if="webfetcher.state === 'connected'"
                  class="fetcher-status-icon connected"
                />
                <CloseCircle
                  v-else
                  class="fetcher-status-icon disconnected"
                />
              </NButton>
            </template>
            <div>
              <div>EventFetcher 状态</div>
              <div v-if="webfetcher.state === 'connected'">
                运行中
              </div>
              <div v-else>
                未运行 / 连接断开
              </div>
            </div>
          </NTooltip>
        </div>

        <NMenu
          :options="menuOptions"
          :value="activeMenuKey"
          :collapsed="siderCollapsed"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          class="sider-menu"
        />

        <!-- 底部状态区: 各类运行状态汇总, 以后有新状态往这里加行 -->
        <div
          v-if="!siderCollapsed && rpcServer.running"
          class="sider-status-list"
        >
          <NPopover
            trigger="hover"
            placement="right"
            :width="260"
          >
            <template #trigger>
              <div class="status-row status-row--hoverable">
                <div class="status-row-label">
                  <NIcon
                    :size="16"
                    :color="rpcServer.connectionCount > 0 ? 'var(--vtsuru-success)' : 'var(--vtsuru-fg-muted)'"
                  >
                    <PlugConnected24Filled />
                  </NIcon>
                  <NText depth="2">
                    本地接口
                  </NText>
                </div>
                <NTag
                  size="small"
                  :type="rpcServer.connectionCount > 0 ? 'success' : 'default'"
                  :bordered="false"
                >
                  {{ rpcServer.connectionCount }} 连接
                </NTag>
              </div>
            </template>
            <div class="rpc-detail">
              <NText
                strong
                tag="div"
                class="rpc-detail-title"
              >
                外部接入连接
              </NText>
              <NEmpty
                v-if="rpcServer.connectionCount === 0"
                size="small"
                description="暂无外部连接"
              />
              <div
                v-for="conn in rpcServer.connections"
                v-else
                :key="conn.connId"
                class="rpc-detail-item"
              >
                <div class="rpc-detail-origin">
                  <NText strong>
                    {{ formatOrigin(conn.origin) }}
                  </NText>
                  <NTag
                    size="tiny"
                    :type="conn.subscribed ? 'success' : 'default'"
                    :bordered="false"
                  >
                    {{ conn.subscribed ? '已订阅弹幕' : '未订阅' }}
                  </NTag>
                </div>
                <NText
                  depth="3"
                  class="rpc-detail-time"
                >
                  接入于 {{ formatSince(conn.connectedAt) }}
                </NText>
              </div>
            </div>
          </NPopover>
        </div>

        <div
          v-if="!siderCollapsed"
          class="cookie-status-card"
        >
          <div class="cookie-status-header">
            <div class="status-row-label">
              <NIcon
                :size="16"
                :color="cookieStatusType === 'success' ? 'var(--vtsuru-success)' : cookieStatusType === 'error' ? 'var(--vtsuru-error)' : 'var(--vtsuru-warning)'"
              >
                <Cookies24Filled />
              </NIcon>
              <NText
                strong
                tag="div"
              >
                B站 Cookie
              </NText>
            </div>
            <NTag
              size="small"
              :type="cookieStatusType"
              :bordered="false"
            >
              {{ cookieStatusText }}
            </NTag>
          </div>
          <NButton
            v-if="cookieStatusType !== 'success'"
            block
            size="tiny"
            type="primary"
            class="cookie-status-button"
            @click="goCookieManagement"
          >
            前往处理
          </NButton>
        </div>
      </div>
    </NLayoutSider>

    <NLayoutContent
      class="main-layout-content"
      :native-scrollbar="false"
      :scrollbar-props="{
        trigger: 'none',
      }"
    >
      <div class="client-page">
        <RouterView v-slot="{ Component, route: viewRoute }">
          <KeepAlive>
            <Transition
              name="fade-slide"
              mode="out-in"
              :appear="true"
            >
              <Suspense>
                <template v-if="viewRoute.meta.pageContainer === 'none'">
                  <component :is="Component" />
                </template>
                <div
                  v-else
                  class="client-page-inner"
                  :class="{
                    'client-page-inner--md': viewRoute.meta.pageWidth === 'md',
                    'client-page-inner--xl': viewRoute.meta.pageWidth === 'xl',
                    'client-page-inner--full': viewRoute.meta.pageWidth === 'full',
                  }"
                >
                  <component :is="Component" />
                </div>
                <template #fallback>
                  <div class="suspense-fallback">
                    加载中...
                  </div>
                </template>
              </Suspense>
            </Transition>
          </KeepAlive>
        </RouterView>
      </div>
    </NLayoutContent>

    <SpeechMiniController />
  </NLayout>
</template>

<style scoped>
/* 登录容器样式 */
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    /* 计算高度，减去 WindowBar 的高度 */
    height: calc(100vh - var(--client-titlebar-height));
    background-color: var(--vtsuru-bg-surface);
    /* 可选：添加背景色 */
  }

  /* 登录卡片样式 */
  .login-card {
    max-width: 90vw;
    /* 限制最大宽度 */
    width: 400px;
    /* 固定或最大宽度，根据设计调整 */
  }

  /* 登录卡片头部样式 */
  .login-header {
    padding-bottom: 1rem;
  }

  /* 登录标题 */
  .login-title {
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: 500;
    text-align: center;
    /* 居中标题 */
    margin-bottom: 0.5rem;
    /* 标题和副标题间距 */
  }

  /* 登录副标题 */
  .login-subtitle {
    font-size: 0.875rem;
    line-height: 1.25rem;
    color: var(--vtsuru-fg-muted);
    text-align: center;
    /* 居中副标题 */
  }

  /* Token 输入框标签容器 */
  .token-label-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* 让 "Token" 和 "前往获取" 分散对齐 */
    margin-bottom: 0.5rem;
    /* 标签和输入框间距 */
  }

  /* Token 标签 */
  .token-label {
    font-size: 0.875rem;
    line-height: 1.25rem;
  }

  /* "前往获取" 链接样式 */
  .token-get-link {
    font-size: 0.875rem;
    cursor: pointer;
    margin-left: 8px;
    /* 与左侧标签保持一点距离 */
  }

  /* 主布局样式 */
  .main-layout {
    /* 计算高度，减去 WindowBar 的高度 */
    height: calc(100vh - var(--client-titlebar-height));
  }

  /* 侧边栏内容容器 (用于可能的滚动或内边距) */
  .sider-content {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* 侧边栏头部样式 */
  .sider-header {
    height: 60px;
    /* 固定高度 */
    border-bottom: 1px solid var(--vtsuru-border);
    /* 使用 Naive UI 的边框颜色变量 */
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* 让标题和图标分开 */
    flex-shrink: 0;
    /* 防止在 flex 布局中被压缩 */
  }

  /* 折叠时头部仅余状态按钮, 居中显示 */
  .sider-header--collapsed {
    padding: 0;
    justify-content: center;
  }

  /* 应用标题样式 */
  .app-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 1.1rem;
    /* 稍微调整字体大小 */
  }

  /* Fetcher 状态按钮样式 */
  .fetcher-status-button {
    padding: 0 6px;
    /* 调整按钮内边距 */
  }

  /* 底部状态区: 运行状态行列表 (开放接口连接数等) */
  .sider-status-list {
    margin: 0 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .status-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .status-row--hoverable {
    cursor: default;
    padding: 4px 6px;
    margin: 0 -6px;
    border-radius: var(--vtsuru-radius);
    transition: background-color 0.2s;
  }

  .status-row--hoverable:hover {
    background-color: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.1));
  }

  .status-row-label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  /* RPC 连接详情弹层 */
  .rpc-detail {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .rpc-detail-title {
    font-size: 0.9rem;
  }

  .rpc-detail-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    border-radius: var(--vtsuru-radius);
    background-color: var(--vtsuru-bg-muted, rgba(128, 128, 128, 0.08));
  }

  .rpc-detail-origin {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .rpc-detail-time {
    font-size: 0.78rem;
  }

  /* Fetcher 状态图标通用样式 */
  .fetcher-status-icon {
    height: 1rem;
    width: 1rem;
    vertical-align: middle;
    /* 图标垂直居中 */
  }

  /* 连接成功图标颜色 */
  .fetcher-status-icon.connected {
    color: var(--vtsuru-success);
  }

  /* 连接失败/断开图标颜色 */
  .fetcher-status-icon.disconnected {
    color: var(--vtsuru-error);
  }

  /* 侧边栏菜单样式 */
  .sider-menu {
    flex-grow: 1;
    /* 让菜单占据剩余空间 */
    padding-top: 1rem;
    /* 菜单与顶部的间距 */
  }

  .cookie-status-card {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--vtsuru-border);
    border-radius: var(--vtsuru-radius);
    background-color: var(--vtsuru-bg-surface);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cookie-status-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .cookie-status-button {
    margin-top: 4px;
  }

  /* Suspense 后备内容样式 */
  .suspense-fallback {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - var(--client-titlebar-height) - 2rem);
    /* 大致计算高度 */
    color: var(--vtsuru-fg-muted);
  }

  .init-overlay {
    position: fixed;
    top: var(--client-titlebar-height);
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--vtsuru-bg-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  }
  .init-overlay-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }
  .init-stage {
    color: var(--vtsuru-fg-muted);
  }
</style>
