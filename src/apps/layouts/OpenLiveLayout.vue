<script setup lang="ts">
import type { AuthInfo } from '@/shared/services/DanmakuClients/OpenLiveClient' // 引入开放平台认证信息类型
import { Lottery24Filled, PeopleQueue24Filled, TabletSpeaker24Filled } from '@vicons/fluent' // 引入 Fluent UI 图标
import { Moon, MusicalNote, Sunny } from '@vicons/ionicons5' // 引入 Ionicons 图标
import { useElementSize } from '@vueuse/core' // 引入 VueUse 组合式函数
import {
  NAlert, NAvatar, NBackTop, NButton, NEllipsis, NIcon, NLayout, NLayoutContent, NLayoutFooter, NLayoutHeader, NLayoutSider, NMenu, NPageHeader, NResult, NScrollbar, NFlex, NSpin, NSwitch, NTag, NText, useMessage } from 'naive-ui';
// 引入 Naive UI 组件
import { computed, h, onMounted, ref } from 'vue' // 引入 Vue 相关 API
import { RouterLink, useRoute, useRouter } from 'vue-router' // 引入 Vue Router 相关 API
import { ThemeType } from '@/api/api-models' // 引入主题类型枚举
import { useDanmakuClient } from '@/store/useDanmakuClient' // 引入弹幕客户端状态管理
import { isDarkMode } from '@/shared/utils' // 引入暗黑模式判断工具
import { usePersistedStorage } from '@/shared/storage/persist'
import '@/apps/open-live/styles/open-live-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

// -- 基本状态和工具 --
const route = useRoute() // 获取当前路由信息
const router = useRouter() // 获取路由实例
const message = useMessage() // 获取 Naive UI 消息提示 API
const themeType = usePersistedStorage('Settings.Theme', ThemeType.Auto) // 使用持久化存储主题设置 (默认自动)
const danmakuClient = useDanmakuClient() // 获取弹幕客户端实例

// -- 侧边栏状态 --
const sider = ref<HTMLElement | null>(null) // 侧边栏 DOM 引用
const { width: siderWidth } = useElementSize(sider) // 实时获取侧边栏宽度

// -- 认证与连接状态 --
const authInfo = ref<AuthInfo>() // 存储从路由查询参数获取的认证信息
const danmakuClientError = ref<string>() // 存储弹幕客户端初始化错误信息

// -- 菜单配置 --
// 定义菜单项, 使用 h 函数渲染 RouterLink 以实现路由跳转
const menuOptions = computed(() => [ // 改为 computed 以便将来可能动态修改
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-lottery',
            query: route.query, // 保留查询参数
          },
        },
        { default: () => '弹幕抽奖' },
      ),
    key: 'open-live-lottery',
    icon: renderIcon(Lottery24Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-live-request',
            query: route.query,
          },
        },
        { default: () => '弹幕点歌' }, // 优化名称
      ),
    key: 'open-live-live-request',
    icon: renderIcon(MusicalNote),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-queue',
            query: route.query,
          },
        },
        { default: () => '弹幕排队' }, // 优化名称
      ),
    key: 'open-live-queue',
    icon: renderIcon(PeopleQueue24Filled),
  },
  {
    label: () =>
      h(
        RouterLink,
        {
          to: {
            name: 'open-live-speech',
            query: route.query,
          },
        },
        { default: () => '弹幕朗读' }, // 优化名称
      ),
    key: 'open-live-speech',
    icon: renderIcon(TabletSpeaker24Filled),
  },
])

// -- 工具函数 --
/**
 * 渲染 Naive UI 图标的辅助函数
 * @param icon 图标组件
 */
function renderIcon(icon: unknown) {
  return () => h(NIcon, null, { default: () => h(icon as any) })
}

// -- 主题切换逻辑 --
const isDarkValue = computed({
  get: () => themeType.value === ThemeType.Dark || (themeType.value === ThemeType.Auto && isDarkMode.value),
  set: (value) => {
    themeType.value = value ? ThemeType.Dark : ThemeType.Light
  },
})

// -- 生命周期钩子 --
onMounted(async () => {
  // 1. 从路由查询参数解析认证信息
  authInfo.value = route.query as unknown as AuthInfo

  // 2. 检查是否存在必要的 Code 参数
  if (authInfo.value?.Code) {
    try {
      // 3. 初始化开放平台弹幕客户端
      await danmakuClient.initOpenlive(authInfo.value) // 改为 await 处理可能的异步初始化
      // 可选: 初始化成功提示
      // message.success('弹幕客户端连接中...')
    } catch (error: any) {
      // 4. 处理初始化错误
      console.error('Danmaku client initialization failed:', error)
      danmakuClientError.value = `弹幕客户端初始化失败: ${error.message || '未知错误'}`
      message.error(danmakuClientError.value)
    }
  } else {
    // 5. 如果缺少 Code, 显示错误信息
    message.error('无效访问: 缺少必要的认证参数 (Code)。请通过幻星平台获取链接。')
    // authInfo 清空, 触发 v-if 显示错误页
    authInfo.value = undefined
  }
})

// onUnmounted 清理 (如果需要)
// onUnmounted(() => {
//   danmakuClient.dispose(); // 示例: 如果有清理逻辑
// })
</script>

<template>
  <!-- 情况一: 缺少认证信息, 显示错误提示页 -->
  <NLayoutContent
    v-if="!authInfo?.Code"
    style="height: 100vh; display: flex; align-items: center; justify-content: center;"
    content-style="padding: 24px;"
  >
    <NResult
      status="error"
      title="无效访问"
      description="请确保您是通过正确的幻星平台 H5 插件链接访问此页面。"
    >
      <template #footer>
        请前往
        <NButton
          text
          type="primary"
          tag="a"
          href="https://play-live.bilibili.com/details/1698742711771"
          target="_blank"
        >
          幻星平台 | VTsuru
        </NButton>
        获取 H5 插件链接。
      </template>
    </NResult>
  </NLayoutContent>

  <!-- 情况二: 存在认证信息, 显示主布局 -->
  <NLayout
    v-else
    style="height: 100vh"
    :native-scrollbar="false"
  >
    <!-- 顶部导航栏 -->
    <NLayoutHeader
      style="height: 60px; display: flex; align-items: center; padding: 0 20px;"
      bordered
    >
      <!-- 使用 NPageHeader 增强语义和结构 -->
      <NPageHeader style="width: 100%;">
        <!-- 标题区域 -->
        <template #title>
          <NButton
            text
            style="text-decoration: none;"
            @click="router.push({ name: 'open-live-index', query: route.query })"
          >
            <NText
              strong
              style="font-size: 1.5rem; line-height: 1;"
              type="primary"
            >
              <!-- 网站/应用 Logo 或名称 -->
              <img
                :src="logoUrl"
                alt="VTsuru Logo"
                style="height: 24px; vertical-align: middle; margin-right: 8px;"
              > <!-- 可选: 添加 Logo -->
              VTsuru 开放平台
            </NText>
          </NButton>
        </template>

        <!-- 副标题/当前页面信息 -->
        <template #subtitle>
          <NText depth="3">
            {{ $route.meta.title as string ?? '功能模块' }}
          </NText>
        </template>

        <!-- 右侧额外操作区域 -->
        <template #extra>
          <NFlex
            align="center"
            :size="20"
          >
            <!-- 连接状态指示 -->
            <NTag
              :type="danmakuClient.connected ? 'success' : 'warning'"
              round
              size="small"
            >
              <template #icon>
                <NIcon :component="danmakuClient.connected ? Sunny : Moon" /> <!-- 示例图标 -->
              </template>
              {{ danmakuClient.connected ? `已连接: ${danmakuClient.authInfo?.anchor_info?.uname ?? '主播'}` : '连接中...' }}
            </NTag>
            <!-- 主题切换开关 -->
            <NSwitch v-model:value="isDarkValue">
              <template #checked>
                <NIcon :component="Moon" />
              </template>
              <template #unchecked>
                <NIcon :component="Sunny" />
              </template>
            </NSwitch>
          </NFlex>
        </template>
      </NPageHeader>
    </NLayoutHeader>

    <!-- 主体内容区域 (包含侧边栏和内容) -->
    <NLayout
      has-sider
      style="height: calc(100vh - 60px - 40px)"
    >
      <!-- 左侧导航栏 -->
      <NLayoutSider
        ref="sider"
        bordered
        show-trigger
        default-collapsed
        collapse-mode="width"
        :collapsed-width="64"
        :width="180"
        :native-scrollbar="false"
        style="height: 100%"
      >
        <div
          v-if="danmakuClient.authInfo"
          style="margin-top: 8px"
        >
          <NFlex
            vertical
            justify="center"
            align="center"
          >
            <NAvatar
              :src="danmakuClient.authInfo?.anchor_info?.uface"
              :img-props="{ referrerpolicy: 'no-referrer' }"
              round
              bordered
            />
            <NEllipsis
              v-if="siderWidth > 100"
              style="max-width: 100%"
            >
              <NText strong>
                {{ danmakuClient.authInfo?.anchor_info?.uname }}
              </NText>
            </NEllipsis>
          </NFlex>
        </div>
        <NMenu
          :default-value="$route.name?.toString()"
          :collapsed-width="64"
          :collapsed-icon-size="22"
          :options="menuOptions"
        />
        <NFlex justify="center">
          <NText
            v-if="siderWidth > 150"
            depth="3"
          >
            有更多功能建议请
            <NButton
              text
              type="info"
              @click="$router.push({ name: 'about' })"
            >
              反馈
            </NButton>
          </NText>
        </NFlex>
      </NLayoutSider>

      <!-- 右侧主内容区域 -->
      <NLayoutContent
        style="height: 100%;"
        content-style="padding: 0; height: 100%;"
        :native-scrollbar="false"
      >
        <NScrollbar class="open-live-page">
          <!-- 弹幕客户端错误提示 -->
          <NAlert
            v-if="danmakuClientError"
            type="error"
            title="弹幕客户端错误"
            closable
            @close="danmakuClientError = undefined"
          >
            {{ danmakuClientError }}
          </NAlert>

          <!-- 路由视图: 根据认证状态显示不同内容 -->
          <RouterView v-slot="{ Component, route: viewRoute }">
            <!-- 情况一: 认证信息加载中或连接中 -->
            <div
              v-if="!danmakuClient.authInfo && !danmakuClientError"
              style="display: flex; justify-content: center; align-items: center; height: 80%;"
            >
              <NSpin size="large">
                <template #description>
                  正在加载主播信息并连接服务...
                </template>
              </NSpin>
            </div>
            <!-- 情况二: 加载/连接成功, 渲染对应页面 -->
            <KeepAlive v-else-if="Component && danmakuClient.authInfo">
              <template v-if="viewRoute.meta.pageContainer === 'none'">
                <component
                  :is="Component"
                  :key="viewRoute.fullPath.split('#')[0]"
                  :room-info="danmakuClient.authInfo"
                  :code="authInfo.Code"
                />
              </template>
              <div
                v-else
                class="open-live-page-inner"
                :class="{
                  'open-live-page-inner--md': viewRoute.meta.pageWidth === 'md',
                  'open-live-page-inner--xl': viewRoute.meta.pageWidth === 'xl',
                  'open-live-page-inner--full': viewRoute.meta.pageWidth === 'full',
                }"
              >
                <component
                  :is="Component"
                  :key="viewRoute.fullPath.split('#')[0]"
                  :room-info="danmakuClient.authInfo"
                  :code="authInfo.Code"
                />
              </div>
            </KeepAlive>
            <!-- 情况三: 组件无法渲染或其他错误 (理论上不应发生, 但作为后备) -->
            <NResult
              v-else-if="!danmakuClientError"
              status="warning"
              title="页面加载失败"
              description="无法加载当前功能模块，请尝试刷新或联系开发者。"
            />
          </RouterView>

          <!-- 返回顶部按钮 -->
          <NBackTop
            :right="40"
            :bottom="60"
            listen-to=".open-live-page .n-scrollbar-container"
          />
        </NScrollbar>
      </NLayoutContent>
    </NLayout>

    <!-- 底部信息栏 -->
    <NLayoutFooter
      style="height: 40px; display: flex; align-items: center; justify-content: center; padding: 0 20px;"
      bordered
    >
      <NText
        depth="3"
        style="font-size: 12px;"
      >
        © {{ new Date().getFullYear() }} <!-- 动态年份 -->
        <NButton
          text
          tag="a"
          href="https://vtsuru.live"
          target="_blank"
          type="primary"
          style="margin-left: 5px;"
        >
          vtsuru.live
        </NButton>
        - 由 VTsuru 提供支持
      </NText>
    </NLayoutFooter>
  </NLayout>
</template>

<style scoped>
.n-pageheader-wrapper {
  width: 100% !important;
}

.open-live-page {
  height: 100%;
}
/* 优化 NPageHeader 在窄屏幕下的表现 (可选) */
@media (max-width: 768px) {
  .n-page-header-wrapper {
    padding: 0 10px !important; /* 减少内边距 */
  }
  .n-page-header__title {
    font-size: 1.2rem !important; /* 缩小标题字号 */
  }
}

/* 确保 NLayoutContent 的内边距生效 */
:deep(.n-layout-scroll-container) {
    display: flex;
    flex-direction: column;
}
</style>
