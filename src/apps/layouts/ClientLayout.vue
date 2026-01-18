<script setup lang="ts">
// 引入 Naive UI 组件 和 图标
import type { MenuOption } from 'naive-ui'
// 引入 Tauri 插件
import { openUrl } from '@tauri-apps/plugin-opener'

import { Chat24Filled, CloudArchive24Filled, FlashAuto24Filled, Live24Filled, Mic24Filled, Settings24Filled } from '@vicons/fluent'
import { CheckmarkCircle, CloseCircle, Home } from '@vicons/ionicons5'
import { NA, NButton, NCard, NInput, NLayout, NLayoutContent, NLayoutSider, NMenu, NSpace, NSpin, NTag, NText, NTooltip } from 'naive-ui'

import { computed, h, ref } from 'vue' // 引入 ref, h, computed

import { RouterLink, RouterView, useRouter } from 'vue-router' // 引入 Vue Router 组件
// 引入自定义 API 和状态管理
import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn } from '@/api/account'

import { useWebFetcher } from '@/store/useWebFetcher'
import { initAll, OnClientUnmounted, clientInited, clientInitStage } from '@/apps/client/data/initialize'
import { useDanmakuWindow } from '@/apps/client/store/useDanmakuWindow'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
// 引入子组件
import WindowBar from '@/apps/client/components/WindowBar.vue'
import { BASE_URL } from '@/shared/config'
import '@/apps/client/styles/client-page.css'

// --- 响应式状态 ---

// 获取 webfetcher 状态管理的实例
const router = useRouter()
const webfetcher = useWebFetcher()
const danmakuWindow = useDanmakuWindow()
const biliCookie = useBiliCookie()
// 用于存储用户输入的 Token
const token = ref('')

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
      label: () =>
        h(RouterLink, { to: { name: 'client-danmaku-window-manage' } }, () => '弹幕机'),
      key: 'danmaku-window-manage',
      icon: () => h(Chat24Filled),
      show: danmakuWindow.danmakuWindow != undefined,
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
      icon: () => h(FlashAuto24Filled),
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

      <NSpace
        vertical
        size="large"
      >
        <NSpace vertical>
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
        </NSpace>

        <NButton
          block
          type="primary"
          :loading="isLoadingAccount"
          :disabled="isLoadingAccount"
          @click="login"
        >
          登陆
        </NButton>
      </NSpace>
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
      width="200"
      bordered
      class="main-layout-sider"
    >
      <div class="sider-content">
        <div class="sider-header">
          <NText
            tag="div"
            class="app-title"
          >
            <span>VTsuru.Client</span>
          </NText>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                quaternary
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
          default-value="go-back-home"
          class="sider-menu"
        />
        <div class="cookie-status-card">
          <div class="cookie-status-header">
            <NText
              strong
              tag="div"
            >
              B站 Cookie
            </NText>
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
  </NLayout>
</template>

<style scoped>
/* 登录容器样式 */
  .login-container {
    display: flex;
    align-items: center;
    justify-content: center;
    /* 计算高度，减去 WindowBar 的高度 (假设为 30px) */
    height: calc(100vh - 30px);
    background-color: var(--n-color);
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
    color: rgb(107, 114, 128);
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
    /* 计算高度，减去 WindowBar 的高度 (假设为 30px) */
    height: calc(100vh - 30px);
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
    border-bottom: 1px solid var(--n-border-color);
    /* 使用 Naive UI 的边框颜色变量 */
    padding: 0 1rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    /* 让标题和图标分开 */
    flex-shrink: 0;
    /* 防止在 flex 布局中被压缩 */
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

  /* Fetcher 状态图标通用样式 */
  .fetcher-status-icon {
    height: 1rem;
    width: 1rem;
    vertical-align: middle;
    /* 图标垂直居中 */
  }

  /* 连接成功图标颜色 */
  .fetcher-status-icon.connected {
    color: var(--n-success-color);
  }

  /* 连接失败/断开图标颜色 */
  .fetcher-status-icon.disconnected {
    color: var(--n-error-color);
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
    border: 1px solid var(--n-border-color);
    border-radius: var(--n-border-radius);
    background-color: var(--n-card-color);
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
    height: calc(100vh - 30px - 2rem);
    /* 大致计算高度 */
    color: var(--n-text-color-3);
  }

  .init-overlay {
    position: fixed;
    top: 30px;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--n-color);
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
    color: var(--n-text-color-3);
  }
</style>
