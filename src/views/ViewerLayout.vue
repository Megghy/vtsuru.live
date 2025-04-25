<script setup lang="ts">
  import { NavigateToNewTab, isDarkMode } from '@/Utils';
  import { useAccount } from '@/api/account';
  import { FunctionTypes, ThemeType, UserInfo } from '@/api/api-models';
  import { useUser } from '@/api/user';
  import RegisterAndLogin from '@/components/RegisterAndLogin.vue';
  import { FETCH_API } from '@/data/constants'; // 移除了未使用的 AVATAR_URL
  import { useAuthStore } from '@/store/useAuthStore';
  import {
    BookCoins20Filled,
    CalendarClock24Filled,
    Person48Filled,
    VideoAdd20Filled,
    WindowWrench20Filled,
  } from '@vicons/fluent';
  import { BrowsersOutline, Chatbox, Home, Moon, MusicalNote, Sunny } from '@vicons/ionicons5';
  import { useElementSize, useStorage } from '@vueuse/core';
  import {
    MenuOption,
    NAvatar,
    NBackTop,
    NButton,
    NDivider,
    NEllipsis,
    NIcon,
    NLayout,
    NLayoutContent,
    NLayoutHeader,
    NLayoutSider,
    NMenu,
    NModal,
    NPageHeader,
    NResult,
    NSpace,
    NSpin,
    NSwitch,
    NText,
    useMessage,
    // NSpin 已默认导入，如果单独使用需确保导入
  } from 'naive-ui';
  import { computed, h, onMounted, ref, watch, defineAsyncComponent } from 'vue'; // 引入 watch
  import { RouterLink, useRoute, useRouter } from 'vue-router'; // 引入 useRouter

  // --- 响应式状态和常量 ---
  const route = useRoute();
  const router = useRouter(); // 获取 router 实例
  const message = useMessage();
  const accountInfo = useAccount(); // 获取当前登录账户信息
  const useAuth = useAuthStore(); // 获取认证状态 Store

  // 路由参数
  const id = computed(() => route.params.id);

  // 主题设置
  const themeType = useStorage('Settings.Theme', ThemeType.Auto);

  // 用户和页面状态
  const userInfo = ref<UserInfo | null>(null); // 用户信息，初始化为 null
  const biliUserInfo = ref<any>(null); // B站用户信息
  const isLoading = ref(true); // 是否正在加载数据
  const notFound = ref(false); // 是否未找到用户

  // UI 控制状态
  const registerAndLoginModalVisiable = ref(false); // 注册/登录弹窗可见性
  const sider = ref(); // 侧边栏 DOM 引用
  const { width: siderWidth } = useElementSize(sider); // 侧边栏宽度
  const windowWidth = window.innerWidth; // 窗口宽度，用于响应式显示

  // 侧边栏菜单项
  const menuOptions = ref<MenuOption[]>([]); // 初始化为空数组

  // --- 方法 ---

  /** 渲染图标的辅助函数 */
  function renderIcon(icon: unknown) {
    return () => h(NIcon, null, { default: () => h(icon as any) });
  }

  /** 根据 userInfo 更新侧边栏菜单 */
  function updateMenuOptions() {
    // 如果没有用户信息，清空菜单
    if (!userInfo.value) {
      menuOptions.value = [];
      return;
    }
    // 基于 userInfo.extra.enableFunctions 构建菜单项
    menuOptions.value = [
      {
        label: () => h(RouterLink, { to: { name: 'user-index' } }, { default: () => '主页' }),
        key: 'user-index', icon: renderIcon(Home),
        // 主页通常都显示
        show: true
      },
      {
        label: () => h(RouterLink, { to: { name: 'user-songList' } }, { default: () => '歌单' }),
        key: 'user-songList', icon: renderIcon(MusicalNote),
        // 根据用户配置判断是否显示
        show: userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.SongList)
      },
      {
        label: () => h(RouterLink, { to: { name: 'user-schedule' } }, { default: () => '日程' }),
        key: 'user-schedule', icon: renderIcon(CalendarClock24Filled),
        show: userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.Schedule)
      },
      {
        label: () => h(RouterLink, { to: { name: 'user-questionBox' } }, { default: () => '棉花糖 (提问箱)' }),
        key: 'user-questionBox', icon: renderIcon(Chatbox),
        show: userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.QuestionBox)
      },
      {
        label: () => h(RouterLink, { to: { name: 'user-video-collect' } }, { default: () => '视频征集' }),
        key: 'user-video-collect', icon: renderIcon(VideoAdd20Filled),
        show: userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.VideoCollect)
      },
      {
        label: () => h(RouterLink, { to: { name: 'user-goods' } }, { default: () => '积分' }),
        key: 'user-goods', icon: renderIcon(BookCoins20Filled),
        show: userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.Point)
      },
    ].filter(option => option.show !== false) as MenuOption[]; // 过滤掉 show 为 false 的菜单项
  }


  /** 获取 Bilibili 用户信息 */
  async function RequestBiliUserData() {
    // 确保 userInfo 和 biliId 存在
    if (!userInfo.value?.biliId) return;

    try {
      const response = await fetch(FETCH_API + `https://workers.vrp.moe/api/bilibili/user-info/${userInfo.value.biliId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.code === 0) {
        biliUserInfo.value = data.card; // 存储获取到的 B 站信息
      } else {
        console.error('Bili User API Error:', data.message);
        // message.warning('获取B站信息失败: ' + data.message) // 可选: 轻微提示用户
      }
    } catch (error) {
      console.error('Failed to fetch Bili user data:', error);
      // message.error('获取B站信息时网络错误') // 可选: 提示用户网络问题
    }
  }

  /** 获取 Vtsuru 用户信息和相关数据 */
  async function fetchUserData(userId: string | string[] | undefined) {
    // 验证 userId 的有效性
    if (!userId || Array.isArray(userId)) {
      notFound.value = true; // 标记为未找到
      isLoading.value = false; // 加载结束
      userInfo.value = null; // 清空用户信息
      menuOptions.value = []; // 清空菜单
      console.error("无效的用户 ID:", userId);
      return;
    }

    // 重置状态，准备加载新数据
    isLoading.value = true;
    notFound.value = false;
    userInfo.value = null;
    menuOptions.value = [];
    biliUserInfo.value = null;

    try {
      // 调用 API 获取用户信息
      const fetchedUserInfo = await useUser(userId as string); // 强制转换为 string

      if (!fetchedUserInfo) {
        // 如果 API 返回 null 或 undefined，则视为未找到
        notFound.value = true;
        userInfo.value = null;
      } else {
        // 成功获取用户信息
        userInfo.value = fetchedUserInfo;
        // 基于新的用户信息更新菜单
        updateMenuOptions();
        // 异步获取 B 站信息（不阻塞主流程）
        RequestBiliUserData();
      }
    } catch (error) {
      console.error("获取用户信息时出错:", error);
      message.error("加载用户信息时发生错误");
      notFound.value = true; // 标记为未找到状态
      userInfo.value = null;
    } finally {
      // 无论成功或失败，加载状态都结束
      isLoading.value = false;
    }
  }

  /** 跳转到 Bilibili 认证用户中心 */
  function gotoAuthPage() {
    if (!accountInfo.value?.biliUserAuthInfo) {
      message.error('你尚未进行 Bilibili 认证, 请前往面板进行认证和绑定');
      return;
    }
    NavigateToNewTab('/bili-user'); // 在新标签页打开
  }

  // --- Watcher ---

  // 监听路由参数 id 的变化
  watch(
    () => route.params.id,
    (newId, oldId) => {
      // 只有当 newId 有效且与 oldId 不同时才重新加载数据
      if (newId && newId !== oldId) {
        fetchUserData(newId);
      } else if (!newId) {
        // 如果 id 从路由中移除，处理相应的状态
        notFound.value = true;
        isLoading.value = false;
        userInfo.value = null;
        menuOptions.value = [];
      }
    },
    { immediate: true } // 关键: 组件挂载时立即执行一次 watcher，触发初始数据加载
  );
  // --- 组件模板 ---
</script>

<template>
  <!-- 情况 1: 加载完毕，但 URL 中没有提供用户 ID -->
  <NLayoutContent
    v-if="!id && !isLoading"
    class="center-container"
  >
    <NResult
      status="error"
      title="未提供用户ID"
      description="请检查访问的URL地址"
    />
  </NLayoutContent>

  <!-- 情况 2: 加载完毕，但未找到指定 ID 的用户 -->
  <NLayoutContent
    v-else-if="notFound && !isLoading"
    class="center-container"
  >
    <NResult
      status="error"
      title="用户不存在"
      description="无法找到指定ID的用户，或者该用户未完成认证"
    />
  </NLayoutContent>

  <!-- 情况 3: 存在 ID 且 (正在加载 或 加载成功且找到用户) -->
  <NLayout
    v-else
    style="height: 100vh"
  >
    <!-- 顶部导航栏 -->
    <NLayoutHeader class="layout-header">
      <NPageHeader
        :subtitle="isLoading ? '加载中...' : ($route.meta.title as string) ?? ''"
        style="width: 100%"
      >
        <!-- 右侧额外操作区域 -->
        <template #extra>
          <NSpace align="center">
            <!-- 主题切换开关 -->
            <NSwitch
              :value="themeType === ThemeType.Light"
              :disabled="isLoading"
              title="切换亮/暗色主题"
              @update:value="(value) => (themeType = value ? ThemeType.Light : ThemeType.Dark)"
            >
              <template #checked>
                <NIcon :component="Sunny" />
              </template>
              <template #unchecked>
                <NIcon :component="Moon" />
              </template>
            </NSwitch>
            <!-- 已登录用户操作 -->
            <template v-if="accountInfo?.id">
              <NSpace>
                <!-- B站认证中心按钮 (如果已认证) -->
                <NButton
                  v-if="useAuth.isAuthed || accountInfo.biliUserAuthInfo"
                  type="primary"
                  tag="a"
                  href="/bili-user"
                  target="_blank"
                  size="small"
                  secondary
                >
                  <template #icon>
                    <NIcon :component="Person48Filled" />
                  </template>
                  <span v-if="windowWidth >= 768"> 认证用户中心 </span>
                </NButton>
                <!-- 主播后台按钮 -->
                <NButton
                  type="primary"
                  size="small"
                  @click="$router.push({ name: 'manage-index' })"
                >
                  <template #icon>
                    <NIcon :component="WindowWrench20Filled" />
                  </template>
                  <span v-if="windowWidth >= 768"> 主播后台 </span>
                </NButton>
              </NSpace>
            </template>
            <!-- 未登录用户操作 -->
            <template v-else>
              <NButton
                type="primary"
                @click="registerAndLoginModalVisiable = true"
              >
                注册 / 登陆
              </NButton>
            </template>
          </NSpace>
        </template>
        <!-- 页面标题 (网站 Logo) -->
        <template #title>
          <span>
            <NText
              strong
              class="site-title"
            >
              VTSURU
            </NText>
          </span>
        </template>
      </NPageHeader>
    </NLayoutHeader>

    <!-- 主体布局 (包含侧边栏和内容区) -->
    <NLayout
      has-sider
      class="main-layout-body"
    >
      <!-- 左侧边栏 -->
      <NLayoutSider
        ref="sider"
        show-trigger
        collapse-mode="width"
        :collapsed-width="64"
        :width="180"
        :native-scrollbar="false"
        :default-collapsed="windowWidth < 768"
        style="height: 100%"
      >
        <!-- 用户头像和昵称 (加载完成后显示) -->
        <div
          v-if="userInfo?.streamerInfo"
          style="margin-top: 8px"
        >
          <NSpace
            vertical
            justify="center"
            align="center"
          >
            <NAvatar
              class="sider-avatar"
              :src="userInfo.streamerInfo.faceUrl"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              round
              bordered
              title="前往用户B站主页"
              @click="NavigateToNewTab(`https://space.bilibili.com/${userInfo.biliId}`)"
            />
            <NEllipsis
              v-if="siderWidth > 100"
              style="max-width: 100%"
            >
              <NText strong>
                {{ userInfo?.streamerInfo.name }}
              </NText>
            </NEllipsis>
          </NSpace>
        </div>
        <!-- 侧边栏加载状态 -->
        <div
          v-else-if="isLoading"
          class="sider-loading"
        >
          <NSpin size="small" />
        </div>
        <NDivider style="margin: 0; margin-top: 5px;" />
        <!-- 导航菜单 -->
        <NMenu
          :value="route.name?.toString()"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
          :disabled="isLoading"
          class="sider-menu"
        />

        <!-- 侧边栏底部链接 -->
        <div class="sider-footer">
          <!-- 仅在侧边栏展开时显示 -->
          <NSpace
            v-if="siderWidth > 150"
            justify="center"
            align="center"
            vertical
            size="small"
            style="width: 100%;"
          >
            <NText
              depth="3"
              class="footer-text"
            >
              有有更多功能建议请 <NButton
                text
                type="info"
                tag="a"
                href="/feedback"
                target="_blank"
                size="tiny"
              >
                反馈
              </NButton>
            </NText>
            <NDivider style="margin: 0; width: 100%" />
            <NText
              depth="3"
              class="footer-text"
            >
              <NButton
                text
                type="info"
                tag="a"
                href="/about"
                target="_blank"
                size="tiny"
              >
                关于本站
              </NButton>
            </NText>
          </NSpace>
        </div>
      </NLayoutSider>

      <!-- 右侧内容区域布局容器 -->
      <NLayout class="content-layout-container">
        <!-- 全局加载动画 (覆盖内容区) -->
        <div
          v-if="isLoading"
          class="loading-container"
        >
          <NSpin size="large" />
        </div>
        <!-- 实际内容区域 (加载完成且找到用户时显示) -->
        <div
          v-else-if="userInfo && !notFound"
          class="viewer-page-content"
          :style="`box-shadow:${isDarkMode ? 'rgb(28 28 28 / 9%) 5px 5px 6px inset, rgba(139, 139, 139, 0.09) -5px -5px 6px inset' : 'inset 5px 5px 6px #8b8b8b17, inset -5px -5px 6px #8b8b8b17;'}`"
        >
          <!-- 路由视图和动画 -->
          <RouterView v-slot="{ Component }">
            <Transition
              name="fade-slide"
              :appear="true"
            >
              <KeepAlive>
                <component
                  :is="Component"
                  :key="route.fullPath"
                  :bili-info="biliUserInfo"
                  :user-info="userInfo"
                />
              </KeepAlive>
            </Transition>
          </RouterView>
          <NBackTop
            :right="40"
            :bottom="40"
            :listen-to="'.viewer-page-content'"
          />
        </div>
        <!-- 如果 !isLoading && notFound, 会显示顶部的 NResult，这里不需要 else -->
      </NLayout>
    </NLayout>
  </NLayout>

  <!-- 注册/登录弹窗 -->
  <NModal
    v-model:show="registerAndLoginModalVisiable"
    preset="card"
    style="width: 500px; max-width: 90vw"
    title="注册 / 登录"
    :auto-focus="false"
    :mask-closable="false"
  >
    <NAlert
      type="info"
      style="border-radius: 8px;"
    >
      <NFlex
        vertical
        align="center"
        size="small"
      >
        <div style="text-align: center;">
          如果你不是主播且不发送棉花糖(提问)的话则不需要注册登录
        </div>
        <NFlex
          justify="center"
          style="width: 100%; margin-top: 8px;"
        >
          <NButton
            type="primary"
            size="small"
            @click="$router.push({ name: 'bili-user'})"
          >
            <template #icon>
              <NIcon :component="BrowsersOutline" />
            </template>
            前往 Bilibili 认证用户主页
          </NButton>
        </NFlex>
      </NFlex>
    </NAlert>
    <br>
    <!-- 异步加载注册登录组件，优化初始加载性能 -->
    <RegisterAndLogin @close="registerAndLoginModalVisiable = false" />
  </NModal>
</template>

<style lang="stylus" scoped>
// --- CSS 变量定义 ---
:root {
  --vtsuru-header-height: 50px; // 顶部导航栏高度
  --vtsuru-content-padding: 20px; // 内容区域内边距
}

// --- 布局样式 ---
.center-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.layout-header {
  height: var(--vtsuru-header-height);
  padding: 0 15px; // 左右内边距
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--n-border-color); // 底部边框
  flex-shrink: 0; // 防止头部被压缩
}

.site-title {
  font-size: 1.5rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.main-layout-body {
  height: calc(100vh - var(--vtsuru-header-height)); // 填充剩余高度
}

.sider-avatar {
  box-shadow: var(--n-avatar-box-shadow, 0 2px 3px rgba(0, 0, 0, 0.1)); // 使用 Naive UI 变量或默认值
  cursor: pointer;
  transition: transform 0.2s ease; // 添加悬浮效果
  &:hover {
    transform: scale(1.1);
  }
}

.sider-username {
  max-width: 90%;
  margin: 8px auto 0;
  font-size: 14px; // 调整字体大小
}

.sider-loading {
  display: flex;
  justify-content: center;
  align-items: center; // 垂直居中
  padding: 30px 0; // 增加上下间距
  height: 98px; // 大致等于头像+昵称的高度，防止跳动
}

.sider-menu {
  margin-top: 10px;
  width: 100%; // 确保菜单宽度正确
}

.sider-footer {
  position: absolute;
  bottom: 20px;
  width: 100%;
  text-align: center;
  padding: 0 5px; // 左右留白，防止文字贴边
  box-sizing: border-box;
}

.footer-text {
  font-size: 12px;
}

// --- 内容区域样式 ---
.content-layout-container {
  height: 100%;
  min-height: 100%; // 保证最小高度，防止塌陷
  overflow: hidden; // 关键: 隐藏此容器自身的滚动条，剪切内部溢出内容
  position: relative; // 关键: 作为内部绝对定位元素(过渡中的组件)的定位基准
}

.loading-container {
  // ... (保持不变) ...
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
  background-color: var(--n-body-color);
  position: absolute; // 相对于 content-layout-container 定位
  top: 0;
  left: 0;
  z-index: 5;
}

.viewer-page-content {
    height: 100%;
    min-height: 100%; // 同样保证最小高度
    border-radius: 8px;
    padding: var(--vtsuru-content-padding);
    box-sizing: border-box;
    overflow-y: auto; // 允许内容 Y 轴滚动
    overflow-x: hidden; // 禁止内容 X 轴滚动 (可选，但通常推荐)
    position: relative; // 为内部非绝对定位的内容提供上下文，例如 NBackTop
    background-color: var(--n-card-color);
    box-shadow: var(--content-shadow);
}

// --- 路由过渡动画 ---
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
  // 关键: 相对于 content-layout-container 定位
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%; // 让过渡元素也撑满容器高度
  // 关键: 保持内边距和盒模型一致
  padding: var(--vtsuru-content-padding);
  box-sizing: border-box;
  // 关键: 背景色防止透视
  background-color: var(--n-card-color); // 使用内容区的背景色
  z-index: 1;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(15px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-15px);
}

// --- 返回顶部按钮 ---
.n-back-top {
  z-index: 10; // 确保在最上层
}
</style>