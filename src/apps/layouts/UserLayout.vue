<script setup lang="ts">
import type { GlobalThemeOverrides } from 'naive-ui'
import type { UserInfo } from '@/api/api-models'
import { Person48Filled, WindowWrench20Filled } from '@vicons/fluent'
import { BrowsersOutline, ChevronBackOutline, ChevronForwardOutline, Home, Moon, Sunny } from '@vicons/ionicons5'
import { useElementSize } from '@vueuse/core'
import {
  darkTheme, NAvatar, NBackTop, NButton, NConfigProvider, NDivider, NEllipsis, NIcon, NModal, NResult, NScrollbar, NFlex, NSpin, NSwitch, NText, NTooltip } from 'naive-ui';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { ThemeType } from '@/api/api-models'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { fetchBiliProfile, fetchPublicUserInfo, fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import { validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { providePublicUserPageRuntime } from '@/apps/user-page/runtime/context'
import { reportPublicPageError } from '@/apps/user-page/runtime/observability'
import { clearUserPageRuntimeCache } from '@/apps/user-page/runtime/query'
import { usePublicPageSeo } from '@/apps/user-page/runtime/seo'
import { consumeDraftPreview } from '@/apps/user-page/runtime/draftPreview'
import { getEnabledUserFunctions, isUserFeatureEnabled, USER_FEATURE_DEFINITIONS } from '@/apps/user-page/featureNavigation'
import type { BiliProfileStatus, UserPagesSettingsV1 } from '@/apps/user-page/types'
import { useBiliAuth } from '@/store/useBiliAuth'
import { isDarkMode, NavigateToNewTab } from '@/shared/utils'
import { usePersistedStorage } from '@/shared/storage/persist'
import '@/apps/user/styles/user-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

// --- 响应式状态和常量 ---
const route = useRoute()
const accountInfo = useAccount() // 获取当前登录账户信息
const useAuth = useBiliAuth() // 获取认证状态 Store

// 路由参数
const id = computed(() => route.params.id)

// 主题设置
const themeType = usePersistedStorage<ThemeType>('Settings.Theme', ThemeType.Auto)

// 用户和页面状态
const userInfo = ref<UserInfo | null>(null) // 用户信息，初始化为 null
const biliUserInfo = ref<any>(null) // B站用户信息
const biliProfileStatus = ref<BiliProfileStatus>('idle')
const loadStatus = ref<'idle' | 'loading' | 'not-found' | 'error' | 'ready'>('idle')
const loadError = ref<Error | null>(null)
const reloadVersion = ref(0)
const isLoading = computed(() => loadStatus.value === 'idle' || loadStatus.value === 'loading')

// UI 控制状态
const registerAndLoginModalVisiable = ref(false) // 注册/登录弹窗可见性
const sider = ref() // 侧边栏 DOM 引用
const { width: siderWidth } = useElementSize(sider) // 侧边栏宽度
const windowWidth = window.innerWidth // 窗口宽度，用于响应式显示
const siderCollapsed = usePersistedStorage<boolean>('Settings.UserSiderCollapsed', windowWidth < 768)
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
const navGroups = shallowRef<UserNavGroup[]>([])
const userPagesSettings = ref<UserPagesSettingsV1 | null>(null)
const publicCustomCss = computed(() => {
  const css = userPagesSettings.value?.customCss
  if (typeof css !== 'string' || !css.trim()) return ''
  const result = inspectCustomCss(css)
  return result.issues.length ? '' : result.css
})
let customCssElement: HTMLStyleElement | null = null

function syncPublicCustomCss(css: string) {
  customCssElement?.remove()
  customCssElement = null
  if (!css) return
  customCssElement = document.createElement('style')
  customCssElement.dataset.vtsuruUserCustomCss = 'true'
  customCssElement.textContent = css
  document.head.append(customCssElement)
}

watch(publicCustomCss, syncPublicCustomCss, { immediate: true })

function retryPublicPage() {
  reloadVersion.value++
}

providePublicUserPageRuntime({
  settings: userPagesSettings,
  status: loadStatus,
  error: loadError,
  retry: retryPublicPage,
})

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
  return validateRenderableBlockPageProject((currentUserPageConfig.value as any)?.block)
})

const seoTitle = computed(() => {
  if (loadStatus.value === 'not-found') return '用户页面不存在 · VTSURU'
  if (loadStatus.value === 'error') return '用户页面加载失败 · VTSURU'
  const pageLabel = pageSlugTitle.value || String(route.meta.title || '主页')
  return userInfo.value ? `${pageLabel} · ${userInfo.value.name} · VTSURU` : `${pageLabel} · VTSURU`
})

const pageSlugTitle = computed(() => {
  if (!userPageSlug.value) return '主页'
  const title = currentUserPageConfig.value?.title?.trim()
  return title || '页面'
})

const seoDescription = computed(() => {
  const pageDescription = currentUserPageConfig.value?.description?.trim()
  if (pageDescription) return pageDescription
  if (userInfo.value) return `${userInfo.value.name} 的 VTSURU 公开主页`
  return 'VTSURU 公开用户页面'
})

usePublicPageSeo({ title: seoTitle, description: seoDescription })

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

const layoutTheme = computed(() => ({
  ...((userPagesSettings.value as any)?.theme),
  ...((currentUserPageConfig.value as any)?.theme),
}))

const effectiveIsDark = computed(() => resolvePageThemeIsDark(pageThemeMode.value, isDarkMode.value))

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
const USERPAGE_HOST_CLASS = 'vtsuru-userpage-host'

onMounted(() => {
  document.documentElement.classList.add(USERPAGE_HOST_CLASS)
  // 移动端进入用户页时默认收缩侧栏
  if (window.innerWidth < 768) siderCollapsed.value = true
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove(USERPAGE_HOST_CLASS)
  clearUserPageRuntimeCache()
  customCssElement?.remove()
  customCssElement = null
  if (themeTypeBeforeForce != null) themeType.value = themeTypeBeforeForce
})

const pageThemeOverrides = computed<GlobalThemeOverrides>(() => {
  const vars = mergedLayoutVars.value as Record<string, string>
  const surfaceBg = vars['--user-page-ui-surface-bg']
  const surfaceBgHover = vars['--user-page-ui-surface-bg-hover']
  const borderColor = (vars as any)['--vtsuru-card-border-color'] ?? vars['--user-page-border-color']
  const textColor = vars['--vtsuru-page-text']
  const mutedTextColor = vars['--vtsuru-surface-fg-muted']
  const subtleTextColor = vars['--vtsuru-surface-fg-subtle']
  const primaryColor = typeof layoutTheme.value.primaryColor === 'string' ? layoutTheme.value.primaryColor : undefined
  const themedSurfaceBg = typeof layoutTheme.value.backgroundColor === 'string'
    ? layoutTheme.value.backgroundColor
    : surfaceBg

  return {
    common: {
      borderColor,
      dividerColor: borderColor,
      ...(primaryColor ? { primaryColor, primaryColorHover: primaryColor, primaryColorPressed: primaryColor } : {}),
      ...(textColor ? {
        textColorBase: textColor,
        textColor1: textColor,
        textColor2: mutedTextColor,
        textColor3: subtleTextColor,
      } : {}),
      ...(themedSurfaceBg ? { cardColor: themedSurfaceBg, modalColor: themedSurfaceBg, popoverColor: themedSurfaceBg } : {}),
    },
    Card: {
      color: themedSurfaceBg,
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

const layoutUiVars = computed(() => getUserPageThemeCssVars(layoutTheme.value, effectiveIsDark.value))

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

  const enabledFunctions = getEnabledUserFunctions(userInfo.value)
  baseItems.push(...USER_FEATURE_DEFINITIONS
    .filter(feature => isUserFeatureEnabled(feature, enabledFunctions))
    .map(feature => ({ label: feature.label, key: feature.routeName, icon: feature.icon, to: { name: feature.routeName } })))

  const pages = userPagesSettings.value?.pages ?? {}
  const pageItems = Object.entries(pages)
    .filter(([, cfg]) => (cfg as any)?.navVisible !== false)
    .map(([slug, cfg]) => ({
      slug,
      title: ((cfg as any)?.title && String((cfg as any).title).trim().length) ? String((cfg as any).title).trim() : `/${slug}`,
      order: typeof (cfg as any)?.navOrder === 'number' ? (cfg as any).navOrder : 0,
    }))
    .toSorted((a, b) => (a.order - b.order) || a.slug.localeCompare(b.slug))
    .map(it => ({
      label: it.title,
      key: `user-page:${it.slug}`,
      icon: BrowsersOutline,
      to: { name: 'user-page', params: { id: route.params.id, pageSlug: it.slug } },
    })) as UserNavItem[]

  const groups: UserNavGroup[] = []
  if (baseItems.length) groups.push({ key: 'user-core', label: '导航', items: baseItems })
  if (pageItems.length) groups.push({ key: 'user-pages', label: '页面', items: pageItems })

  navGroups.value = groups
}

async function requestBiliUserData(user: UserInfo, signal: AbortSignal) {
  if (!user.biliId) {
    biliProfileStatus.value = 'empty'
    return
  }
  biliProfileStatus.value = 'loading'
  try {
    const profile = await fetchBiliProfile(user.biliId, signal)
    if (signal.aborted) return
    if (profile) {
      biliUserInfo.value = profile
      biliProfileStatus.value = 'ready'
    } else {
      biliUserInfo.value = null
      biliProfileStatus.value = 'empty'
    }
  } catch (cause) {
    if (!signal.aborted) {
      biliProfileStatus.value = 'error'
      reportPublicPageError(cause, 'bili-profile')
    }
  }
}

async function loadPublicUser(userId: string | string[] | undefined, signal: AbortSignal) {
  loadStatus.value = 'loading'
  loadError.value = null
  userInfo.value = null
  userPagesSettings.value = null
  biliUserInfo.value = null
  biliProfileStatus.value = 'idle'
  navGroups.value = []

  if (!userId || Array.isArray(userId)) {
    loadStatus.value = 'not-found'
    return
  }

  let fetchedUserInfo: UserInfo | undefined
  try {
    fetchedUserInfo = await fetchPublicUserInfo(userId, { signal }) ?? undefined
  } catch (cause) {
    if (signal.aborted) return
    reportPublicPageError(cause, 'user')
    loadError.value = cause instanceof Error ? cause : new Error(String(cause))
    loadStatus.value = 'error'
    return
  }
  if (signal.aborted) return
  if (!fetchedUserInfo) {
    loadStatus.value = 'not-found'
    return
  }

  userInfo.value = fetchedUserInfo
  try {
    userPagesSettings.value = consumeDraftPreview(route.query.draftPreview, fetchedUserInfo.id)
      ?? await fetchUserPagesSettingsByUserId(fetchedUserInfo.id, { signal })
  } catch (cause) {
    if (signal.aborted) return
    reportPublicPageError(cause, 'settings')
    loadError.value = cause instanceof Error ? cause : new Error(String(cause))
    loadStatus.value = 'error'
    return
  }
  if (signal.aborted) return

  updateMenuOptions()
  loadStatus.value = 'ready'
  void requestBiliUserData(fetchedUserInfo, signal)
}

watch(
  [
    () => route.params.id,
    () => route.query.draftPreview,
    () => reloadVersion.value,
  ],
  ([newId], _previous, onCleanup) => {
    clearUserPageRuntimeCache()
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void loadPublicUser(newId, controller.signal)
  },
  { immediate: true },
)
// --- 组件模板 ---
</script>

<template>
  <div
    v-if="loadStatus === 'not-found'"
    class="center-container"
  >
    <NResult
      status="404"
      title="用户不存在"
      :description="id ? '无法找到指定用户，或者该用户未完成认证' : '请检查访问地址中的用户 ID'"
    />
  </div>

  <div
    v-else-if="loadStatus === 'error'"
    class="center-container"
  >
    <NResult
      status="error"
      title="页面加载失败"
      description="网络暂时不可用或服务发生异常，请稍后重试"
    >
      <template #footer>
        <NButton type="primary" @click="retryPublicPage">
          重新加载
        </NButton>
      </template>
    </NResult>
  </div>

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
              <NFlex
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
                  <NFlex
                    align="center"
                    :size="4"
                    :wrap="false"
                  >
                    <NText>
                      {{ userInfo?.streamerInfo.name }}
                    </NText>
                    <span
                      v-if="userInfo?.streamerInfo?.isStreaming"
                      class="live-indicator-dot"
                      title="直播中"
                    />
                  </NFlex>
                </NEllipsis>
              </NFlex>
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
              <NFlex
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
                  有更多功能建议请 <NButton
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
              </NFlex>
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
            v-else-if="loadStatus === 'ready' && userInfo"
            class="viewer-scroll"
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
                      :bili-status="biliProfileStatus"
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
                      :bili-status="biliProfileStatus"
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
    <RegisterAndLogin
      closable
      @close="registerAndLoginModalVisiable = false"
    />
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
  position: relative;
  z-index: 20;
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
  color: var(--vtsuru-fg);
}

.page-title {
  font-size: 12px;
  line-height: 1.2;
  max-width: 320px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--vtsuru-fg);
}

.page-root {
  height: 100vh;
  width: 100%;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background-color: var(--n-body-color);
}

:global(html.vtsuru-userpage-host),
:global(html.vtsuru-userpage-host body) {
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
  overflow-x: clip;
}

:global(html.vtsuru-userpage-host body) {
  overscroll-behavior-x: none;
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

.page-root.bg-host .main-layout-body,
.page-root.bg-host .content-layout-container {
  background-color: transparent;
}

.page-root.bg-host .layout-header,
.page-root.bg-host .user-sider {
  background: var(--user-page-theme-surface-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.page-root.bg-host .sider-profile {
  color: var(--vtsuru-page-text);
}

.page-root.bg-host.glass .layout-header,
.page-root.bg-host.glass .main-layout-body {
  background: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 0px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 0px));
}

.page-root.bg-host.glass .user-sider {
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.page-root.bg-host.glass .layout-header {
  position: relative;
  border-bottom-color: transparent;
}
.page-root.bg-host.glass .layout-header::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -14px;
  height: 14px;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    var(--glass-surface-bg, rgba(255, 255, 255, 0.55)),
    transparent
  );
}

.page-root.bg-host :deep(.n-card) {
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
}

@media (prefers-reduced-transparency: reduce) {
  .page-root.bg-host.glass .layout-header,
  .page-root.bg-host.glass .main-layout-body {
    background: var(--vtsuru-bg-elevated);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  .page-root.bg-host :deep(.n-card) {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}


.page-root.bg-host .viewer-page-content {
  background-color: var(--user-page-theme-content-bg, transparent);
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
  background: var(--user-page-theme-surface-bg, var(--n-body-color));
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
  border: 1px solid var(--vtsuru-page-primary-border);
  background: var(--vtsuru-page-primary-soft);
  color: var(--vtsuru-page-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 120ms ease, border-color 120ms ease, transform 120ms ease;
}

.sider-collapse-btn:hover {
  background: var(--vtsuru-page-primary-active);
  border-color: var(--vtsuru-page-primary-focus);
}

.sider-collapse-btn:active {
  transform: translateY(0.5px);
}
.sider-collapse-btn:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary-focus);
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
  color: var(--vtsuru-surface-fg-muted);
  font-size: 11px;
  font-weight: 400;
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
  color: var(--vtsuru-page-text);
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
  color: var(--vtsuru-page-primary);
  background: var(--vtsuru-page-primary-soft);
}
.nav-item:focus-visible {
  outline: 2px solid rgba(127, 127, 127, 0.28);
  outline-offset: 2px;
}

.nav-item.active {
  color: var(--vtsuru-page-primary);
  background: var(--vtsuru-page-primary-active);
  border-color: var(--vtsuru-page-primary-border);
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
  font-weight: 400;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
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

.viewer-scroll {
  touch-action: pan-y;
}

.viewer-scroll :deep(.n-scrollbar-container) {
  overflow-x: hidden;
}

.viewer-scroll :deep(.n-scrollbar-content) {
  max-width: 100%;
  box-sizing: border-box;
}

.viewer-page-content {
  padding: var(--vtsuru-content-padding);
  box-sizing: border-box;
  position: relative; // 为内部非绝对定位的内容提供上下文，例如 NBackTop
  background-color: var(--user-page-theme-content-bg, var(--n-body-color));
  max-width: 100%;
  overflow-x: clip;
}

@media (max-width: 520px) {
  .main-layout-body {
    flex-direction: column-reverse;
  }

  .user-sider {
    width: 100% !important;
    height: 58px;
    border-top: 1px solid var(--vtsuru-border);
    border-right: 0;
  }

  .sider-profile,
  .sider-top,
  .sider-footer,
  .sider-shell > :deep(.n-divider) {
    display: none;
  }

  .sider-scroll :deep(.n-scrollbar-container) {
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }

  .sider-scroll :deep(.n-scrollbar-content) {
    width: max-content;
  }

  .sider-nav,
  .sider-nav.collapsed {
    display: flex;
    width: max-content;
    min-width: 100%;
    padding: 6px 8px;
  }

  .nav-group {
    display: contents;
  }

  .nav-group__items {
    flex-direction: row;
    gap: 4px;
  }

  .nav-item {
    width: 42px;
    height: 42px;
    border-radius: 6px;
  }

  .viewer-page-content {
    padding-left: 10px;
    padding-right: 12px;
  }
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
