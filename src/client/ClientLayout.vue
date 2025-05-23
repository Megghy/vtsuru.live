<script setup lang="ts">
  import { ref, h, computed } from 'vue'; // 引入 ref, h, computed
  import { RouterLink, RouterView } from 'vue-router'; // 引入 Vue Router 组件

  // 引入 Naive UI 组件 和 图标
  import { NA, NButton, NCard, NInput, NLayout, NLayoutSider, NLayoutContent, NMenu, NSpace, NSpin, NText, NTooltip, MenuOption } from 'naive-ui';
  import { CheckmarkCircle, CloseCircle, Home } from '@vicons/ionicons5';

  // 引入 Tauri 插件
  import { openUrl } from '@tauri-apps/plugin-opener';

  // 引入自定义 API 和状态管理
  import { ACCOUNT, GetSelfAccount, isLoadingAccount, isLoggedIn, useAccount } from '@/api/account';
  import { useWebFetcher } from '@/store/useWebFetcher';

  // 引入子组件
  import WindowBar from './WindowBar.vue';
  import { initAll, OnClientUnmounted } from './data/initialize';
  import { Chat24Filled, CloudArchive24Filled, FlashAuto24Filled, Settings24Filled } from '@vicons/fluent';
  import { isTauri } from '@/data/constants';
import { useDanmakuWindow } from './store/useDanmakuWindow';

  // --- 响应式状态 ---

  // 获取 webfetcher 状态管理的实例
  const webfetcher = useWebFetcher();
  const danmakuWindow = useDanmakuWindow();
  // 用于存储用户输入的 Token
  const token = ref('');

  // --- 计算属性 ---
  // (这里没有显式的计算属性，但 isLoggedIn 本身可能是一个来自 account 模块的计算属性)

  // --- 方法 ---

  /**
   * @description 处理用户登录逻辑
   */
  async function login() {
    // 校验 Token 是否为空
    if (!token.value.trim()) {
      window.$message.error('请输入 Token'); // 使用全局消息提示
      return;
    }

    isLoadingAccount.value = true; // 开始加载状态
    try {
      // 调用 API 获取账户信息
      const result = await GetSelfAccount(token.value.trim());

      // 处理 API 返回结果
      if (!result) {
        // 登录失败：无效 Token
        window.$notification.error({ // 使用全局通知
          title: '登陆失败',
          content: '无效的Token',
          duration: 3000
        });
      } else {
        // 检查 B站主播码是否绑定
        if (!result.isBiliAuthed) {
          window.$notification.error({
            title: '登陆失败',
            content: 'B站主播码未绑定, 请先在网站管理页进行绑定',
            duration: 3000
          });
        } else {
          // 登录成功
          window.$message.success('登陆成功');
          ACCOUNT.value = result; // 更新全局账户信息
          // isLoadingAccount.value = false; // 状态在 finally 中统一处理
          //initAll(false); // 初始化 WebFetcher
        }
      }
    } catch (error) {
      // 处理请求过程中的意外错误
      console.error("Login failed:", error);
      window.$notification.error({
        title: '登陆出错',
        content: '发生未知错误，请稍后再试或联系管理员。',
        duration: 3000
      });
    } finally {
      // 无论成功或失败，最终都结束加载状态
      isLoadingAccount.value = false;
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
        icon: () => h(Home)
      },
      {
        label: () =>
          h(RouterLink, { to: { name: 'client-fetcher' } }, () => 'EventFetcher'),
        key: 'fetcher',
        icon: () => h(CloudArchive24Filled)
      },
      {
        label: () =>
          h(RouterLink, { to: { name: 'client-danmaku-window-manage' } }, () => '弹幕机'),
        key: 'danmaku-window-manage',
        icon: () => h(Chat24Filled),
        show: danmakuWindow.danmakuWindow != undefined
      },
      {
        label: () =>
          h(RouterLink, { to: { name: 'client-auto-action-manage' } }, () => '自动操作'),
        key: 'danmaku-auto-action-manage',
        icon: () => h(FlashAuto24Filled),
      },
      {
        label: () =>
          h(RouterLink, { to: { name: 'client-settings' } }, () => '设置'),
        key: 'settings',
        icon: () => h(Settings24Filled)
      },
    ] as MenuOption[];
  });

  onMounted(() => {
    window.addEventListener('beforeunload', (event) => {
      OnClientUnmounted(); // 调用清理函数
    });
  });
</script>

<template>
  <WindowBar />

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
                  @click="openUrl('https://vtsuru.suki.club/manage')"
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
          :default-value="'go-back-home'"
          class="sider-menu"
        />
      </div>
    </NLayoutSider>

    <NLayoutContent
      class="main-layout-content"
      :native-scrollbar="false"
      :scrollbar-props="{
        trigger: 'none'
      }"
    >
      <div style="padding: 12px; padding-right: 15px;">
        <RouterView v-slot="{ Component }">
          <Transition
            name="fade-slide"
            mode="out-in"
            :appear="true"
          >
            <KeepAlive>
              <Suspense>
                <component :is="Component" />
                <template #fallback>
                  <div class="suspense-fallback">
                    加载中...
                  </div>
                </template>
              </Suspense>
            </KeepAlive>
          </Transition>
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
    color: rgb(132, 204, 22);
  }

  /* 连接失败/断开图标颜色 */
  .fetcher-status-icon.disconnected {
    color: rgb(190, 18, 60);
  }

  /* 侧边栏菜单样式 */
  .sider-menu {
    flex-grow: 1;
    /* 让菜单占据剩余空间 */
    padding-top: 1rem;
    /* 菜单与顶部的间距 */
  }

  /* Suspense 后备内容样式 */
  .suspense-fallback {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 30px - 2rem);
    /* 大致计算高度 */
    color: #999;
  }

  /* 路由切换动画 */
  .fade-slide-enter-active,
  .fade-slide-leave-active {
    transition: all 0.3s ease;
  }

  .fade-slide-enter-from,
  .fade-slide-leave-to {
    opacity: 0;
    transform: translateX(20px);
  }
</style>