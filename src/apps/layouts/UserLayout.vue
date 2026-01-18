<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import type { UserInfo } from '@/api/api-models'
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  CheckmarkCircle24Filled,
  Person48Filled,
  VideoAdd20Filled,
  WindowWrench20Filled,
} from '@vicons/fluent'
import { Bookmark, BookmarkOutline, BrowsersOutline, Chatbox, ChevronBackOutline, ChevronForwardOutline, Home, Moon, MusicalNote, Sunny } from '@vicons/ionicons5'
import { useElementSize, useStorage } from '@vueuse/core'
import {
  darkTheme,
  NAvatar,
  NBackTop,
  NButton,
  NConfigProvider,
  NDivider,
  NEllipsis,
  NIcon,
  NModal,
  NResult,
  NScrollbar,
  NSpace,
  NSpin,
  NSwitch,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { FunctionTypes, ThemeType } from '@/api/api-models'
import { useUser } from '@/api/user'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { validateBlockPageProject } from '@/apps/user-page/block/schema'
import type { UserPagesSettingsV1 } from '@/apps/user-page/types'
import { FETCH_API } from '@/shared/config' // 移除了未使用的 AVATAR_URL
import { useBiliAuth } from '@/store/useBiliAuth'
import { isDarkMode, NavigateToNewTab } from '@/shared/utils'
import '@/apps/user/styles/user-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

// --- 响应式状态和常量 ---
const route = useRoute()
const message = useMessage()
const accountInfo = useAccount() // 获取当前登录账户信息
const useAuth = useBiliAuth() // 获取认证状态 Store

// 路由参数
const id = computed(() => route.params.id)

// 主题设置
const themeType = useStorage<ThemeType>('Settings.Theme', ThemeType.Auto)

// 用户和页面状态
const userInfo = ref<UserInfo | null>(null) // 用户信息，初始化为 null
const biliUserInfo = ref<any>(null) // B站用户信息
const isLoading = ref(true) // 是否正在加载数据
const notFound = ref(false) // 是否未找到用户

// UI 控制状态
const registerAndLoginModalVisiable = ref(false) // 注册/登录弹窗可见性
const sider = ref() // 侧边栏 DOM 引用
const { width: siderWidth } = useElementSize(sider) // 侧边栏宽度
const windowWidth = window.innerWidth // 窗口宽度，用于响应式显示
const siderCollapsed = useStorage<boolean>('Settings.UserSiderCollapsed', windowWidth < 768)
const siderAvatarSize = computed(() => (siderCollapsed.value ? 34 : 42))

type UserNavItem = {
  key: string
  label: string
  icon: any
  to?: any
  disabled?: boolean
  disabledReason?: string
}

type UserNavGroup = {
  key: string
  label: string
  items: UserNavItem[]
}

// 侧边栏菜单项
const navGroups = ref<UserNavGroup[]>([])
const favoriteNavItems = useStorage<string[]>('Settings.UserFavoriteNavItems', [])
const isFavorite = (key: string) => (favoriteNavItems.value ?? []).includes(key)
function toggleFavorite(key: string) {
  const list = favoriteNavItems.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteNavItems.value = [...list]
}
const userPagesSettings = ref<UserPagesSettingsV1 | null>(null)

const activeMenuKey = computed(() => {
  const name = route.name?.toString()
  if (name === 'user-page') {
    const slug = route.params.pageSlug
    if (typeof slug === 'string' && slug.length) return `user-page:${slug}`
  }
  return name
})

const headerSubtitle = computed(() => (isLoading.value ? '加载中...' : ((route.meta.title as string) ?? '')))

// --- 方法 ---

const userPageSlug = computed(() => {
  const v = route.params.pageSlug
  return typeof v === 'string' && v.length ? v : undefined
})

const currentUserPageConfig = computed(() => {
  const name = route.name?.toString()
  if (name !== 'user-index' && name !== 'user-page') return null
  const s = userPagesSettings.value
  if (!s) return null
  if (!userPageSlug.value) return s.home ?? null
  return s.pages?.[userPageSlug.value] ?? null
})

const currentUserPageMode = computed(() => {
  const name = route.name?.toString()
  if (name !== 'user-index' && name !== 'user-page') return null
  if (!userPageSlug.value) return (currentUserPageConfig.value as any)?.mode ?? 'legacy'
  return (currentUserPageConfig.value as any)?.mode ?? null
})

const currentBlockValidation = computed(() => {
  if (currentUserPageMode.value !== 'block') return null
  return validateBlockPageProject((currentUserPageConfig.value as any)?.block)
})

type PageThemeMode = 'auto' | 'light' | 'dark'

const globalThemeMode = computed<PageThemeMode>(() => {
  const m = (userPagesSettings.value as any)?.theme?.pageThemeMode
  return (m === 'auto' || m === 'light' || m === 'dark') ? m : 'auto'
})

const pageOverrideThemeMode = computed<PageThemeMode>(() => {
  const m = (currentUserPageConfig.value as any)?.theme?.pageThemeMode
  return (m === 'auto' || m === 'light' || m === 'dark') ? m : 'auto'
})

const blockThemeMode = computed<PageThemeMode>(() => {
  const v = currentBlockValidation.value
  const m = v && v.ok ? (v.project.theme as any)?.pageThemeMode : undefined
  return (m === 'auto' || m === 'light' || m === 'dark') ? m : 'auto'
})

const pageThemeMode = computed<PageThemeMode>(() => {
  // block theme > page override > global
  if (blockThemeMode.value !== 'auto') return blockThemeMode.value
  if (pageOverrideThemeMode.value !== 'auto') return pageOverrideThemeMode.value
  return globalThemeMode.value
})

const effectiveIsDark = computed(() => {
  if (pageThemeMode.value === 'dark') return true
  if (pageThemeMode.value === 'light') return false
  return isDarkMode.value
})

const pageNaiveTheme = computed(() => (effectiveIsDark.value ? darkTheme : null))

let themeTypeBeforeForce: ThemeType | null = null
watch(
  () => [pageThemeMode.value, themeType.value] as const,
  ([mode]) => {
    if (mode === 'dark' || mode === 'light') {
      if (themeTypeBeforeForce == null) themeTypeBeforeForce = themeType.value
      const forced = mode === 'dark' ? ThemeType.Dark : ThemeType.Light
      if (themeType.value !== forced) themeType.value = forced
      return
    }
    if (themeTypeBeforeForce != null) {
      if (themeType.value !== themeTypeBeforeForce) themeType.value = themeTypeBeforeForce
      themeTypeBeforeForce = null
    }
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  if (themeTypeBeforeForce != null) themeType.value = themeTypeBeforeForce
})

const pageThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const vars = mergedLayoutVars.value as Record<string, string>
  const surfaceBg = vars['--user-page-ui-surface-bg']
  const surfaceBgHover = vars['--user-page-ui-surface-bg-hover']
  const borderColor = (vars as any)['--vtsuru-card-border-color'] ?? vars['--user-page-border-color']

  return {
    common: {
      borderColor,
      dividerColor: borderColor,
    },
    Card: {
      color: surfaceBg,
      colorEmbedded: surfaceBgHover,
      borderColor,
    },
    List: {
      color: 'transparent',
      listItemColor: 'transparent',
      borderColor,
    },
    Button: {
      color: surfaceBg,
      colorHover: surfaceBgHover,
    },
    // 可以根据需要继续添加其他组件的透明化适配
  }
})

const themeSwitchTitle = computed(() => {
  if (pageThemeMode.value === 'auto') return '切换站点亮/暗色主题'
  if (blockThemeMode.value !== 'auto') return pageThemeMode.value === 'dark' ? '该区块页已强制使用暗色主题' : '该区块页已强制使用亮色主题'
  if (pageOverrideThemeMode.value !== 'auto') return pageThemeMode.value === 'dark' ? '该页面已强制使用暗色主题' : '该页面已强制使用亮色主题'
  return pageThemeMode.value === 'dark' ? '全局样式已强制使用暗色主题' : '全局样式已强制使用亮色主题'
})

const pageBgOverride = computed(() => {
  const name = route.name?.toString()
  if (name !== 'user-index' && name !== 'user-page') return null
  return resolvePageBackground((currentUserPageConfig.value as any)?.background)
})

const globalBg = computed(() => resolvePageBackground(userPagesSettings.value?.background))

const blockThemeBg = computed(() => {
  if (currentUserPageMode.value !== 'block') return null
  const v = currentBlockValidation.value
  if (!v || !v.ok) return null
  return resolvePageBackground(v.project.theme)
})

const layoutPageBg = computed(() => {
  const name = route.name?.toString()
  if (name === 'user-index' || name === 'user-page') {
    if (pageBgOverride.value) return pageBgOverride.value.coverSidebar ? pageBgOverride.value : null
    if (globalBg.value) return globalBg.value.coverSidebar ? globalBg.value : null
    if (blockThemeBg.value) return blockThemeBg.value.coverSidebar ? blockThemeBg.value : null
    return null
  }
  if (globalBg.value) return globalBg.value.coverSidebar ? globalBg.value : null
  return null
})

const layoutPageBgVars = computed(() => {
  const bg = layoutPageBg.value
  if (!bg) return {}
  return getPageBackgroundCssVars(bg, effectiveIsDark.value)
})

const layoutUiVars = computed(() => ({
  '--user-page-ui-surface-bg': effectiveIsDark.value ? 'rgba(24, 24, 27, 0.80)' : 'rgba(255, 255, 255, 0.80)',
  '--user-page-ui-surface-bg-hover': effectiveIsDark.value ? 'rgba(39, 39, 42, 0.86)' : 'rgba(244, 244, 245, 0.86)',
  '--user-page-ui-surface-bg-pressed': effectiveIsDark.value ? 'rgba(39, 39, 42, 0.92)' : 'rgba(244, 244, 245, 0.92)',
  '--user-page-border-color': effectiveIsDark.value ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.22)',
  '--vtsuru-card-border-color': effectiveIsDark.value ? 'rgba(148, 163, 184, 0.20)' : 'rgba(148, 163, 184, 0.26)',
}))

const mergedLayoutVars = computed(() => ({ ...layoutUiVars.value, ...layoutPageBgVars.value }))

const layoutPageBgClass = computed(() => ({
  'bg-host': !!layoutPageBg.value,
  'bg-blur': layoutPageBg.value?.blurMode === 'background',
  glass: layoutPageBg.value?.blurMode === 'glass',
}))

/** 根据 userInfo 更新侧边栏菜单 */
function updateMenuOptions() {
  // 如果没有用户信息，清空菜单
  if (!userInfo.value) {
    navGroups.value = []
    return
  }
  const baseItems: UserNavItem[] = [
    { label: '主页', key: 'user-index', icon: Home, to: { name: 'user-index' } },
  ]

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.SongList)) {
    baseItems.push({ label: '歌单', key: 'user-songList', icon: MusicalNote, to: { name: 'user-songList' } })
  }

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.Schedule)) {
    baseItems.push({ label: '日程', key: 'user-schedule', icon: CalendarClock24Filled, to: { name: 'user-schedule' } })
  }

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.QuestionBox)) {
    baseItems.push({ label: '棉花糖 (提问箱)', key: 'user-questionBox', icon: Chatbox, to: { name: 'user-questionBox' } })
  }

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.VideoCollect)) {
    baseItems.push({ label: '视频征集', key: 'user-video-collect', icon: VideoAdd20Filled, to: { name: 'user-video-collect' } })
  }

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.Point)) {
    baseItems.push({ label: '积分', key: 'user-goods', icon: BookCoins20Filled, to: { name: 'user-goods' } })
  }

  if (userInfo.value?.extra?.enableFunctions.includes(FunctionTypes.CheckInRanking)) {
    baseItems.push({ label: '签到排行', key: 'user-checkin', icon: CheckmarkCircle24Filled, to: { name: 'user-checkin' } })
  }

  const pages = userPagesSettings.value?.pages ?? {}
  const pageItems = Object.entries(pages)
    .filter(([, cfg]) => (cfg as any)?.navVisible !== false)
    .map(([slug, cfg]) => ({
      slug,
      title: ((cfg as any)?.title && String((cfg as any).title).trim().length) ? String((cfg as any).title).trim() : `/${slug}`,
      order: typeof (cfg as any)?.navOrder === 'number' ? (cfg as any).navOrder : 0,
    }))
    .sort((a, b) => (a.order - b.order) || a.slug.localeCompare(b.slug))
    .map(it => ({
      label: it.title,
      key: `user-page:${it.slug}`,
      icon: BrowsersOutline,
      to: { name: 'user-page', params: { id: route.params.id, pageSlug: it.slug } },
    })) as UserNavItem[]

  const allItems = [...baseItems, ...pageItems]
  const allMap = new Map(allItems.map(i => [i.key, i]))
  const favorites = (favoriteNavItems.value ?? [])
    .map(k => allMap.get(k))
    .filter(Boolean) as UserNavItem[]

  const groups: UserNavGroup[] = []
  if (favorites.length) groups.push({ key: 'user-favorites', label: '收藏', items: favorites })
  if (baseItems.length) groups.push({ key: 'user-core', label: '导航', items: baseItems })
  if (pageItems.length) groups.push({ key: 'user-pages', label: '页面', items: pageItems })

  navGroups.value = groups
}

/** 获取 Bilibili 用户信息 */
async function RequestBiliUserData() {
  // 确保 userInfo 和 biliId 存在
  if (!userInfo.value?.biliId) return

  try {
    const response = await fetch(`${FETCH_API}https://workers.vrp.moe/api/bilibili/user-info/${userInfo.value.biliId}`)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    if (data.code === 0) {
      biliUserInfo.value = data.card // 存储获取到的 B 站信息
    } else {
      console.error('Bili User API Error:', data.message)
      // message.warning('获取B站信息失败: ' + data.message) // 可选: 轻微提示用户
    }
  } catch (error) {
    console.error('Failed to fetch Bili user data:', error)
    // message.error('获取B站信息时网络错误') // 可选: 提示用户网络问题
  }
}

/** 获取 Vtsuru 用户信息和相关数据 */
async function fetchUserData(userId: string | string[] | undefined) {
  // 验证 userId 的有效性
  if (!userId || Array.isArray(userId)) {
    notFound.value = true // 标记为未找到
    isLoading.value = false // 加载结束
    userInfo.value = null // 清空用户信息
    navGroups.value = [] // 清空菜单
    console.error('无效的用户 ID:', userId)
    return
  }

  // 重置状态，准备加载新数据
  isLoading.value = true
  notFound.value = false
  userInfo.value = null
  navGroups.value = []
  biliUserInfo.value = null

  try {
    // 调用 API 获取用户信息
    const fetchedUserInfo = await useUser(userId as string) // 强制转换为 string

    if (!fetchedUserInfo) {
      // 如果 API 返回 null 或 undefined，则视为未找到
      notFound.value = true
      userInfo.value = null
    } else {
      // 成功获取用户信息
      userInfo.value = fetchedUserInfo
      // 基于新的用户信息更新菜单
      updateMenuOptions()
      // 异步获取 B 站信息（不阻塞主流程）
      RequestBiliUserData()
    }
  } catch (error) {
    console.error('获取用户信息时出错:', error)
    message.error('加载用户信息时发生错误')
    notFound.value = true // 标记为未找到状态
    userInfo.value = null
  } finally {
    // 无论成功或失败，加载状态都结束
    isLoading.value = false
  }
}

async function loadUserPagesSettings(streamerId: number) {
  try {
    userPagesSettings.value = await fetchUserPagesSettingsByUserId(streamerId)
  } catch (e) {
    console.error('Failed to fetch user pages settings:', e)
    userPagesSettings.value = null
  }
}

// --- Watcher ---

// 监听路由参数 id 的变化
watch(
  () => route.params.id,
  (newId, oldId) => {
    // 只有当 newId 有效且与 oldId 不同时才重新加载数据
    if (newId && newId !== oldId) {
      fetchUserData(newId)
    } else if (!newId) {
      // 如果 id 从路由中移除，处理相应的状态
      notFound.value = true
      isLoading.value = false
      userInfo.value = null
      navGroups.value = []
    }
  },
  { immediate: true }, // 关键: 组件挂载时立即执行一次 watcher，触发初始数据加载
)

watch(
  () => userInfo.value?.id,
  async (streamerId) => {
    if (!streamerId) {
      userPagesSettings.value = null
      updateMenuOptions()
      return
    }
    await loadUserPagesSettings(streamerId)
    updateMenuOptions()
  },
  { immediate: true },
)
// --- 组件模板 ---
</script>

<template>
  <!-- 情况 1: 加载完毕，但 URL 中没有提供用户 ID -->
  <div
    v-if="!id && !isLoading"
    class="center-container"
  >
    <NResult
      status="error"
      title="未提供用户ID"
      description="请检查访问的URL地址"
    />
  </div>

  <!-- 情况 2: 加载完毕，但未找到指定 ID 的用户 -->
  <div
    v-else-if="notFound && !isLoading"
    class="center-container"
  >
    <NResult
      status="error"
      title="用户不存在"
      description="无法找到指定ID的用户，或者该用户未完成认证"
    />
  </div>

  <!-- 情况 3: 存在 ID 且 (正在加载 或 加载成功且找到用户) -->
  <NConfigProvider
    v-else
    :theme="pageNaiveTheme"
    :theme-overrides="pageThemeOverrides"
  >
    <div
      class="page-root"
      :class="layoutPageBgClass"
      :style="[layoutUiVars, layoutPageBgVars]"
    >
      <!-- 顶部导航栏 -->
      <header class="layout-header">
        <div class="layout-header__inner">
          <div class="layout-header__left">
            <img class="layout-header__logo" :src="logoUrl" alt="VTSURU" decoding="async">
            <NText strong class="site-title">
              VTSURU
            </NText>
            <NText v-if="headerSubtitle" depth="3" class="page-title">
              {{ headerSubtitle }}
            </NText>
          </div>

          <div class="layout-header__right">
            <!-- 主题切换开关 -->
            <NSwitch
              :value="!effectiveIsDark"
              :disabled="isLoading || pageThemeMode !== 'auto'"
              :title="themeSwitchTitle"
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
            </template>

            <!-- 未登录用户操作 -->
            <NButton
              v-else
              type="primary"
              @click="registerAndLoginModalVisiable = true"
            >
              注册 / 登陆
            </NButton>
          </div>
        </div>
      </header>

      <!-- 主体布局 (包含侧边栏和内容区) -->
      <div class="main-layout-body">
        <!-- 左侧边栏 -->
        <aside
          ref="sider"
          class="user-sider"
          :class="{ collapsed: siderCollapsed }"
          :style="{ width: siderCollapsed ? '56px' : '180px' }"
        >
          <div class="sider-shell" :class="{ collapsed: siderCollapsed }">
            <div class="sider-top">
              <NTooltip placement="right" :show-arrow="false">
                <template #trigger>
                  <button
                    class="sider-collapse-btn"
                    type="button"
                    @click="siderCollapsed = !siderCollapsed"
                  >
                    <component :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline" class="sider-collapse-icon" />
                  </button>
                </template>
                {{ siderCollapsed ? '展开侧栏' : '收起侧栏' }}
              </NTooltip>
            </div>

            <!-- 用户头像和昵称 (加载完成后显示) -->
            <div
              v-if="userInfo?.streamerInfo"
              class="sider-profile"
            >
              <NSpace
                vertical
                justify="center"
                align="center"
              >
                <NAvatar
                  class="sider-avatar"
                  :class="{ 'streaming-avatar': userInfo?.streamerInfo?.isStreaming }"
                  :src="userInfo.streamerInfo.faceUrl"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                  :size="siderAvatarSize"
                  round
                  bordered
                  title="前往用户B站主页"
                  @click="NavigateToNewTab(`https://space.bilibili.com/${userInfo.biliId}`)"
                />
                <NEllipsis
                  v-if="siderWidth > 100"
                  style="max-width: 100%"
                >
                  <NSpace
                    align="center"
                    :size="4"
                    :wrap="false"
                  >
                    <NText strong>
                      {{ userInfo?.streamerInfo.name }}
                    </NText>
                    <span
                      v-if="userInfo?.streamerInfo?.isStreaming"
                      class="live-indicator-dot"
                      title="直播中"
                    />
                  </NSpace>
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
            <NScrollbar class="sider-scroll" :class="{ disabled: isLoading }">
              <nav class="sider-nav" :class="{ collapsed: siderCollapsed }">
                <template v-for="g in navGroups" :key="g.key">
                  <div class="nav-group">
                    <div v-if="!siderCollapsed" class="nav-group__header">
                      <span class="nav-group__label">{{ g.label }}</span>
                    </div>
                    <div class="nav-group__items">
                      <div v-for="item in g.items" :key="item.key" class="nav-item-row">
                        <template v-if="!item.disabled && item.to">
                          <NTooltip v-if="siderCollapsed" placement="right" :show-arrow="false">
                            <template #trigger>
                              <RouterLink
                                :to="item.to"
                                class="nav-item"
                                :class="{ active: activeMenuKey === item.key }"
                              >
                                <component :is="item.icon" class="nav-item__icon" />
                              </RouterLink>
                            </template>
                            {{ item.label }}
                          </NTooltip>

                          <RouterLink
                            v-else
                            :to="item.to"
                            class="nav-item"
                            :class="{ active: activeMenuKey === item.key }"
                          >
                            <component :is="item.icon" class="nav-item__icon" />
                            <span class="nav-item__label">{{ item.label }}</span>
                            <button
                              class="nav-item__fav"
                              :class="{ active: isFavorite(item.key) }"
                              type="button"
                              :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                              @click.stop.prevent="toggleFavorite(item.key)"
                            >
                              <NIcon class="nav-item__fav-icon" :class="{ active: isFavorite(item.key) }">
                                <component :is="isFavorite(item.key) ? Bookmark : BookmarkOutline" />
                              </NIcon>
                            </button>
                          </RouterLink>
                        </template>

                        <template v-else>
                          <NTooltip v-if="siderCollapsed" placement="right" :show-arrow="false">
                            <template #trigger>
                              <div class="nav-item nav-item--disabled">
                                <component :is="item.icon" class="nav-item__icon" />
                              </div>
                            </template>
                            {{ item.disabledReason || item.label }}
                          </NTooltip>

                          <div
                            v-else
                            class="nav-item nav-item--disabled"
                            :title="item.disabledReason || item.label"
                          >
                            <component :is="item.icon" class="nav-item__icon" />
                            <span class="nav-item__label">{{ item.label }}</span>
                            <button
                              class="nav-item__fav"
                              :class="{ active: isFavorite(item.key) }"
                              type="button"
                              :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                              @click.stop.prevent="toggleFavorite(item.key)"
                            >
                              <NIcon class="nav-item__fav-icon" :class="{ active: isFavorite(item.key) }">
                                <component :is="isFavorite(item.key) ? Bookmark : BookmarkOutline" />
                              </NIcon>
                            </button>
                          </div>
                        </template>
                      </div>
                    </div>
                  </div>
                </template>
              </nav>
            </NScrollbar>

            <!-- 侧边栏底部链接 -->
            <div v-if="siderWidth > 150" class="sider-footer">
              <NSpace
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
          </div>
        </aside>

        <!-- 右侧内容区域布局容器 -->
        <div class="content-layout-container">
          <!-- 全局加载动画 (覆盖内容区) -->
          <div
            v-if="isLoading"
            class="loading-container"
          >
            <NSpin size="large" />
          </div>
          <!-- 实际内容区域 (加载完成且找到用户时显示) -->
          <NScrollbar
            v-else-if="userInfo && !notFound"
            class="viewer-scroll"
            x-scrollable
          >
            <div class="viewer-page-content">
              <!-- 路由视图和动画 -->
              <RouterView v-slot="{ Component, route: viewRoute }">
                <KeepAlive>
                  <template v-if="viewRoute.meta.pageContainer === 'none'">
                    <component
                      :is="Component"
                      :key="route.fullPath.split('#')[0]"
                      :bili-info="biliUserInfo"
                      :user-info="userInfo"
                    />
                  </template>
                  <div
                    v-else
                    class="user-page"
                    :class="viewRoute.meta.pageWidth ? `user-page--${viewRoute.meta.pageWidth}` : undefined"
                  >
                    <component
                      :is="Component"
                      :key="route.fullPath.split('#')[0]"
                      :bili-info="biliUserInfo"
                      :user-info="userInfo"
                    />
                  </div>
                </KeepAlive>
              </RouterView>
              <NBackTop
                :right="40"
                :bottom="40"
                listen-to=".viewer-scroll .n-scrollbar-container"
              />
            </div>
          </NScrollbar>
        <!-- 如果 !isLoading && notFound, 会显示顶部的 NResult，这里不需要 else -->
        </div>
      </div>
    </div>
  </NConfigProvider>

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
            @click="$router.push({ name: 'bili-user' })"
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
  --vtsuru-content-padding: 16px; // 内容区域内边距
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
  padding: 0 12px; // 左右内边距
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--n-border-color); // 底部边框
  flex-shrink: 0; // 防止头部被压缩
}

.layout-header__inner {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.layout-header__left {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.layout-header__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
}

.layout-header__logo {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex: 0 0 auto;
}

.site-title {
  font-size: 15px;
  letter-spacing: -0.02em;
}

.page-title {
  font-size: 12px;
  line-height: 1.2;
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-root {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--n-body-color);
}

.main-layout-body {
  flex: 1;
  min-height: 0;
  display: flex;
  overflow: hidden;
}

.page-root.bg-host {
  position: relative;
  overflow: hidden;
  background-color: transparent;
}
.page-root.bg-host::before {
  content: "";
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: none;
  pointer-events: none;
  z-index: 0;
}
.page-root.bg-host::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
}
.page-root.bg-host.bg-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}
.page-root.bg-host > * {
  position: relative;
  z-index: 1;
}

.page-root.bg-host .layout-header,
.page-root.bg-host .main-layout-body,
.page-root.bg-host .user-sider,
.page-root.bg-host .content-layout-container {
  background-color: transparent;
}

.page-root.bg-host.glass .layout-header,
.page-root.bg-host.glass .main-layout-body {
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

.page-root.bg-host :deep(.n-card) {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}


.page-root.bg-host .viewer-page-content {
  background-color: transparent;
}

.sider-avatar {
  cursor: pointer;
  &.streaming-avatar {
    outline: 2px solid var(--n-success-color);
    outline-offset: 2px;
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

.user-sider {
  height: 100%;
  border-right: 1px solid var(--n-border-color);
  background: var(--n-body-color);
  box-sizing: border-box;
  overflow: hidden;
  flex: 0 0 auto;
  transition: width 180ms var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
}

.sider-shell {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sider-profile {
  margin-top: 12px;
}

.sider-shell.collapsed .sider-profile {
  margin-top: 48px;
}

.sider-top {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
  padding: 0;
}

.sider-collapse-btn {
  z-index: 10;
  height: 32px;
  width: 32px;
  padding: 0;
  border-radius: 10px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  background: rgba(127, 127, 127, 0.06);
  color: var(--n-text-color);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
}

.sider-collapse-btn:hover {
  background: rgba(127, 127, 127, 0.1);
  border-color: rgba(127, 127, 127, 0.22);
}

.sider-collapse-btn:active {
  transform: translateY(0.5px);
}
.sider-collapse-btn:focus-visible {
  outline: 2px solid rgba(127, 127, 127, 0.28);
  outline-offset: 2px;
}

.sider-collapse-icon {
  width: 18px;
  height: 18px;
}

.sider-scroll {
  flex: 1;
  min-height: 0;
}

.sider-scroll.disabled {
  pointer-events: none;
  opacity: 0.7;
}

.sider-nav {
  padding: 6px 8px 10px;
  transition: padding 180ms var(--n-bezier, cubic-bezier(.4, 0, .2, 1));
}

.sider-nav.collapsed {
  padding: 6px 6px 10px;
}

.nav-group {
  padding: 6px 0;
}

.nav-group__header {
  padding: 2px 6px 6px;
}

.nav-group__label {
  color: var(--n-text-color-3);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.nav-group__items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.nav-item {
  height: 34px;
  border-radius: 10px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  color: var(--n-text-color);
  border: 1px solid transparent;
  background: transparent;
  transition: background-color 120ms ease, border-color 120ms ease;
  box-sizing: border-box;
}

.sider-nav.collapsed .nav-item {
  padding: 0;
  justify-content: center;
}

.nav-item:hover {
  background: rgba(127, 127, 127, 0.08);
}
.nav-item:focus-visible {
  outline: 2px solid rgba(127, 127, 127, 0.28);
  outline-offset: 2px;
}

.nav-item.active {
  background: rgba(127, 127, 127, 0.12);
  border-color: rgba(127, 127, 127, 0.18);
}

.nav-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-item__icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.nav-item__label {
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.nav-item__fav {
  height: 22px;
  width: 22px;
  border-radius: 7px;
  border: 1px solid rgba(127, 127, 127, 0.15);
  background: rgba(127, 127, 127, 0.04);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 120ms ease, background-color 120ms ease, border-color 120ms ease;
}

.nav-item-row:hover .nav-item__fav,
.nav-item__fav.active {
  opacity: 1;
}

.nav-item-row:hover .nav-item__fav {
  background: rgba(127, 127, 127, 0.08);
  border-color: rgba(127, 127, 127, 0.25);
}

.nav-item__fav:hover {
  background: rgba(127, 127, 127, 0.08);
  border-color: rgba(127, 127, 127, 0.22);
}

.nav-item__fav.active {
  background: rgba(245, 158, 11, 0.26);
  border-color: rgba(245, 158, 11, 0.58);
  box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.26);
}

.nav-item__fav-icon {
  font-size: 16px;
  color: var(--n-text-color-3);
  transition: color 120ms ease;
}

.nav-item__fav-icon.active {
  color: var(--n-warning-color);
}

.nav-item__fav.active .nav-item__fav-icon {
  color: rgb(245, 158, 11);
  filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.28));
}

.sider-footer {
  width: 100%;
  text-align: center;
  padding: 10px 10px; // 左右留白，防止文字贴边
  border-top: 1px solid var(--n-border-color);
  box-sizing: border-box;
  flex: 0 0 auto;
}

.footer-text {
  font-size: 12px;
}

// --- 内容区域样式 ---
.content-layout-container {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
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

.viewer-scroll {
  flex: 1;
  min-height: 0;
}

.viewer-page-content {
  padding: var(--vtsuru-content-padding);
  box-sizing: border-box;
  position: relative; // 为内部非绝对定位的内容提供上下文，例如 NBackTop
  background-color: var(--n-body-color);
}

// --- 返回顶部按钮 ---
.n-back-top {
  z-index: 10; // 确保在最上层
}

.live-indicator-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--n-success-color);
  margin-left: 4px; // 与用户名稍微隔开
  vertical-align: middle; // 垂直居中对齐
}
</style>
