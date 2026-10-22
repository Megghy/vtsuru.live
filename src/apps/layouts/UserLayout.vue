<script setup lang="ts">
import { WindowWrench20Filled } from '@vicons/fluent'
import {
  ChevronBackOutline,
  ChevronForwardOutline,
  ColorPaletteOutline,
  HeartOutline,
  Home,
  Moon,
  Sunny,
} from '@vicons/ionicons5'
import { useElementSize, useMediaQuery } from '@vueuse/core'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { UserInfo } from '@/api/api-models'
import { ThemeType } from '@/api/api-models'
import { useFollowingStates } from '@/api/following'
import { WORKSPACE_LABELS, useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { fetchBiliProfile, fetchPublicUserInfo, fetchUserPagesSettingsByUserId } from '@/apps/user-page/api'
import { getPageBackgroundCssVars, getUserPageThemeCssVars, resolvePageBackground } from '@/apps/user-page/background'
import { inspectCustomCss } from '@/apps/user-page/block/customHtmlRuntime'
import { validateRenderableBlockPageProject } from '@/apps/user-page/block/schema'
import { usePageCanvasColor } from '@/apps/user-page/canvasColor'
import {
  getEnabledUserFunctions,
  isUserFeatureEnabled,
  USER_FEATURE_DEFINITIONS,
} from '@/apps/user-page/featureNavigation'
import { useGoogleFont } from '@/apps/user-page/googleFonts'
import { resolveUserPageNavIcon } from '@/apps/user-page/pageIcons'
import { providePublicUserPageRuntime } from '@/apps/user-page/runtime/context'
import { consumeDraftPreview } from '@/apps/user-page/runtime/draftPreview'
import { reportPublicPageError } from '@/apps/user-page/runtime/observability'
import { clearUserPageRuntimeCache } from '@/apps/user-page/runtime/query'
import { usePublicPageSeo } from '@/apps/user-page/runtime/seo'
import { resolvePageThemeIsDark } from '@/apps/user-page/theme'
import { getUserPageAppearanceOverrides } from '@/apps/user-page/themeConfig'
import type { BiliProfile, BiliProfileStatus, UserPagesSettings } from '@/apps/user-page/types'
import FollowButton from '@/components/common/FollowButton.vue'
import RegisterAndLogin from '@/components/RegisterAndLogin.vue'
import { provideThemeScope } from '@/shared/config/theme/scope'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode, NavigateToNewTab } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import '@/apps/user/styles/user-page.css'
import logoUrl from '@/svgs/ic_vtuber.svg?url'

// --- 响应式状态和常量 ---
const route = useRoute()
const router = useRouter()
const accountInfo = useAccount()
const useAuth = useBiliAuth()
const { lastWorkspace, enterLastWorkspace } = useManageWorkspace()

// 路由参数
const id = computed(() => route.params.id)

// 主题设置
const themeType = usePersistedStorage<ThemeType>('Settings.Theme', ThemeType.Auto)

// 用户和页面状态
const userInfo = ref<UserInfo | null>(null)
const isOwner = computed(() => {
  if (!accountInfo.value?.id || !userInfo.value?.id) return false
  return accountInfo.value.id === userInfo.value.id
})
const follows = useFollowingStates(() => (userInfo.value ? [userInfo.value.id] : []))
const biliUserInfo = ref<BiliProfile | null>(null)
const biliProfileStatus = ref<BiliProfileStatus>('idle')
const loadStatus = ref<'idle' | 'loading' | 'not-found' | 'error' | 'ready'>('idle')
const loadError = ref<Error | null>(null)
const reloadVersion = ref(0)
const isLoading = computed(() => loadStatus.value === 'idle' || loadStatus.value === 'loading')

// UI 控制状态
const registerAndLoginModalVisiable = ref(false)

async function openAudienceEntry() {
  registerAndLoginModalVisiable.value = false
  await useAuth.sessionReady
  void router.push({ name: useAuth.isAuthed ? 'bili-user-points' : 'bili-auth' })
}
const sider = ref()
const { width: siderWidth } = useElementSize(sider)
const isDesktop = useMediaQuery('(min-width: 768px)')
const isMobileNav = useMediaQuery('(max-width: 520px)')
const siderCollapsed = usePersistedStorage<boolean>('Settings.UserSiderCollapsed', !isDesktop.value)
const siderAvatarSize = computed(() => (siderCollapsed.value ? 34 : 42))

const siderAvatarUrl = computed(() => {
  if (!userInfo.value?.biliId) return ''
  return userInfo.value.streamerInfo?.faceUrl || biliUserInfo.value?.face || ''
})
const siderPendantUrl = computed(() => {
  if (!userInfo.value?.biliId) return ''
  return biliUserInfo.value?.pendant?.image_enhance || biliUserInfo.value?.pendant?.image || ''
})
const showSiderProfile = computed(() => {
  if (!userInfo.value) return false
  if (siderAvatarUrl.value) return true
  return !siderCollapsed.value && !!userInfo.value.streamerInfo
})

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

const navGroups = shallowRef<UserNavGroup[]>([])
const userPagesSettings = ref<UserPagesSettings | null>(null)
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
  const name = route.name?.toString()
  if (name === 'user-index') return '主页'
  if (name !== 'user-page') return ''
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
  return m === 'auto' || m === 'light' || m === 'dark' ? m : 'auto'
})

const pageOverrideThemeMode = computed<PageThemeMode>(() => {
  const m = (currentUserPageConfig.value as any)?.theme?.pageThemeMode
  return m === 'auto' || m === 'light' || m === 'dark' ? m : 'auto'
})

const blockThemeMode = computed<PageThemeMode>(() => {
  const v = currentBlockValidation.value
  const m = v && v.ok ? (v.project.theme as any)?.pageThemeMode : undefined
  return m === 'auto' || m === 'light' || m === 'dark' ? m : 'auto'
})

const pageThemeMode = computed<PageThemeMode>(() => {
  if (blockThemeMode.value !== 'auto') return blockThemeMode.value
  if (pageOverrideThemeMode.value !== 'auto') return pageOverrideThemeMode.value
  return globalThemeMode.value
})

const homeAppearanceTheme = computed(() => {
  const home = userPagesSettings.value?.home
  return home?.mode === 'block' ? getUserPageAppearanceOverrides(home.block?.theme) : {}
})

const layoutTheme = computed(() => {
  const isBuiltInPage = !['user-index', 'user-page'].includes(route.name?.toString() ?? '')
  return {
    ...(userPagesSettings.value as any)?.theme,
    ...(isBuiltInPage ? homeAppearanceTheme.value : (currentUserPageConfig.value as any)?.theme),
  }
})

useGoogleFont(
  computed(() => (typeof layoutTheme.value.fontFamily === 'string' ? layoutTheme.value.fontFamily : undefined)),
)

const effectiveIsDark = computed(() => resolvePageThemeIsDark(pageThemeMode.value, isDarkMode.value))

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
  if (window.innerWidth < 768) siderCollapsed.value = true
})

onBeforeUnmount(() => {
  document.documentElement.classList.remove(USERPAGE_HOST_CLASS)
  clearUserPageRuntimeCache()
  customCssElement?.remove()
  customCssElement = null
  if (themeTypeBeforeForce != null) themeType.value = themeTypeBeforeForce
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

const layoutContentBg = computed(() => {
  const name = route.name?.toString()
  if (name === 'user-index' || name === 'user-page') return null
  return globalBg.value?.coverSidebar ? null : globalBg.value
})

const layoutContentBgVars = computed(() =>
  layoutContentBg.value ? getPageBackgroundCssVars(layoutContentBg.value, effectiveIsDark.value) : {},
)

const layoutContentBgClass = computed(() => ({
  'content-bg-host': !!layoutContentBg.value,
  'content-bg-blur': layoutContentBg.value?.blurMode === 'background',
  'content-bg-glass': layoutContentBg.value?.blurMode === 'glass',
}))

const layoutVisualBg = computed(() => layoutPageBg.value ?? layoutContentBg.value)
const layoutCanvasColor = usePageCanvasColor(layoutVisualBg, effectiveIsDark)
const layoutUiVars = computed(() =>
  getUserPageThemeCssVars(layoutTheme.value, effectiveIsDark.value, layoutCanvasColor.value),
)

const mergedLayoutVars = computed(() => ({ ...layoutUiVars.value, ...layoutPageBgVars.value }))
provideThemeScope(mergedLayoutVars)

const layoutPageBgClass = computed(() => ({
  'bg-host': !!layoutPageBg.value,
  'bg-blur': layoutPageBg.value?.blurMode === 'background',
  glass: layoutPageBg.value?.blurMode === 'glass',
}))

const themeSwitchTitle = computed(() => {
  if (isLoading.value) return '页面加载中'
  if (pageThemeMode.value === 'dark') return '该用户页面强制为深色主题'
  if (pageThemeMode.value === 'light') return '该用户页面强制为浅色主题'
  return effectiveIsDark.value ? '切换为浅色主题' : '切换为深色主题'
})

function updateMenuOptions() {
  if (!userInfo.value) {
    navGroups.value = []
    return
  }
  const baseItems: UserNavItem[] = [{ label: '主页', key: 'user-index', icon: Home, to: { name: 'user-index' } }]

  const enabledFunctions = getEnabledUserFunctions(userInfo.value)
  baseItems.push(
    ...USER_FEATURE_DEFINITIONS.filter((feature) => isUserFeatureEnabled(feature, enabledFunctions)).map((feature) => ({
      label: feature.label,
      key: feature.routeName,
      icon: feature.icon,
      to: { name: feature.routeName },
    })),
  )

  const pages = userPagesSettings.value?.pages ?? {}
  const pageItems = Object.entries(pages)
    .filter(([, cfg]) => (cfg as any)?.navVisible !== false)
    .map(([slug, cfg]) => ({
      slug,
      title:
        (cfg as any)?.title && String((cfg as any).title).trim().length
          ? String((cfg as any).title).trim()
          : `/${slug}`,
      order: typeof (cfg as any)?.navOrder === 'number' ? (cfg as any).navOrder : 0,
      icon: resolveUserPageNavIcon((cfg as any)?.navIcon),
    }))
    .toSorted((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
    .map((it) => ({
      label: it.title,
      key: `user-page:${it.slug}`,
      icon: it.icon,
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
    fetchedUserInfo = (await fetchPublicUserInfo(userId, { signal })) ?? undefined
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
    userPagesSettings.value =
      consumeDraftPreview(route.query.draftPreview, fetchedUserInfo.id) ??
      (await fetchUserPagesSettingsByUserId(fetchedUserInfo.id, { signal }))
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
  [() => route.params.id, () => route.query.draftPreview, () => reloadVersion.value],
  ([userId], _, onCleanup) => {
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    void loadPublicUser(userId, controller.signal)
  },
  { immediate: true },
)

watch(
  () => userPagesSettings.value?.pages,
  () => {
    if (userInfo.value) updateMenuOptions()
  },
  { deep: true },
)

function scrollToTop() {
  const container = isMobileNav.value ? window : document.querySelector('.viewer-scroll')
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>

<template>
  <div
    v-if="loadStatus === 'not-found'"
    class="center-container p-6"
  >
    <div class="flex flex-col items-center justify-center gap-3">
      <Empty description="用户未找到或该用户暂未开启个人空间" />
      <Button @click="$router.push('/')"> 返回首页 </Button>
    </div>
  </div>

  <div
    v-else-if="loadStatus === 'error'"
    class="center-container p-6"
  >
    <div class="flex flex-col items-center justify-center gap-3">
      <div class="text-base font-semibold">页面加载失败</div>
      <div class="text-xs text-muted-foreground">网络暂时不可用或服务发生异常，请稍后重试</div>
      <Button @click="retryPublicPage"> 重新加载 </Button>
    </div>
  </div>

  <div
    v-else
    class="page-root"
    :class="layoutPageBgClass"
    :style="[layoutUiVars, layoutPageBgVars]"
  >
    <!-- 顶部导航栏 -->
    <header class="layout-header">
      <div class="layout-header__inner">
        <div class="layout-header__left">
          <img
            class="layout-header__logo"
            :src="logoUrl"
            alt="VTSURU"
            decoding="async"
          />
          <span class="site-title font-bold">VTSURU</span>
          <span
            v-if="headerSubtitle"
            class="page-title text-muted-foreground text-xs"
          >
            {{ headerSubtitle }}
          </span>
        </div>

        <div class="layout-header__right flex items-center gap-2">
          <!-- 主题切换开关 -->
          <Button
            variant="ghost"
            class="h-7 w-7 p-0"
            :disabled="isLoading || pageThemeMode !== 'auto'"
            :title="themeSwitchTitle"
            @click="themeType = effectiveIsDark ? ThemeType.Light : ThemeType.Dark"
          >
            <component
              :is="effectiveIsDark ? Moon : Sunny"
              class="size-4"
            />
          </Button>

          <!-- 已登录用户操作 -->
          <template v-if="accountInfo?.id">
            <Button
              v-if="isOwner"
              variant="outline"
              size="xs"
              title="进入主页可视化装修与块配置"
              @click="$router.push({ name: 'manage-userPageBuilder' })"
            >
              <component
                :is="ColorPaletteOutline"
                class="size-4"
                :class="{ 'mr-1': isDesktop }"
              />
              <span v-if="isDesktop">装修主页</span>
            </Button>

            <Button
              variant="outline"
              size="xs"
              @click="$router.push({ name: 'live-directory', query: { tab: 'following' } })"
            >
              <component
                :is="HeartOutline"
                class="size-4"
                :class="{ 'mr-1': isDesktop }"
              />
              <span v-if="isDesktop">关注管理</span>
            </Button>
            <Button
              size="xs"
              @click="enterLastWorkspace"
            >
              <component
                :is="WindowWrench20Filled"
                class="size-4"
                :class="{ 'mr-1': isDesktop }"
              />
              <span v-if="isDesktop">{{ WORKSPACE_LABELS[lastWorkspace] }}</span>
            </Button>
          </template>

          <!-- 未登录用户操作 -->
          <Button
            v-else
            size="xs"
            @click="registerAndLoginModalVisiable = true"
          >
            注册 / 登录
          </Button>
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
        <div
          class="sider-shell"
          :class="{ collapsed: siderCollapsed }"
        >
          <div class="sider-top">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger as-child>
                  <button
                    class="sider-collapse-btn"
                    type="button"
                    @click="siderCollapsed = !siderCollapsed"
                  >
                    <component
                      :is="siderCollapsed ? ChevronForwardOutline : ChevronBackOutline"
                      class="sider-collapse-icon"
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {{ siderCollapsed ? '展开侧栏' : '收起侧栏' }}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <!-- 用户头像和昵称 -->
          <div
            v-if="showSiderProfile"
            class="sider-profile"
          >
            <div class="flex flex-col items-center justify-center">
              <button
                v-if="siderAvatarUrl"
                class="sider-avatar-button"
                type="button"
                title="前往用户B站主页"
                @click="NavigateToNewTab(`https://space.bilibili.com/${userInfo?.biliId}`)"
              >
                <Avatar
                  class="sider-avatar"
                  :class="{ 'streaming-avatar': userInfo?.streamerInfo?.isStreaming }"
                  :style="{ width: `${siderAvatarSize}px`, height: `${siderAvatarSize}px` }"
                >
                  <AvatarImage :src="siderAvatarUrl" />
                  <AvatarFallback>{{ userInfo?.name?.slice(0, 1) || 'U' }}</AvatarFallback>
                </Avatar>
                <img
                  v-if="siderPendantUrl && !siderCollapsed"
                  class="sider-avatar-pendant"
                  :src="siderPendantUrl"
                  alt=""
                  aria-hidden="true"
                  referrerpolicy="no-referrer"
                />
              </button>
              <div
                v-if="siderWidth > 100"
                class="truncate max-w-full mt-1.5 flex items-center gap-1 text-xs font-medium"
              >
                <span class="truncate">{{ userInfo?.streamerInfo?.name || userInfo?.name }}</span>
                <span
                  v-if="userInfo?.streamerInfo?.isStreaming"
                  class="live-indicator-dot"
                  title="直播中"
                />
              </div>
            </div>
          </div>

          <div
            v-if="userInfo && !siderCollapsed"
            class="p-2 text-center"
          >
            <FollowButton
              :user-id="userInfo.id"
              :following="follows.states.value[userInfo.id]?.isFollowing"
              :followers="follows.states.value[userInfo.id]?.followers"
              @changed="follows.refresh"
            />
            <div
              v-if="follows.error.value"
              class="text-[11px] text-destructive mt-1"
            >
              {{ follows.error.value }}
            </div>
          </div>

          <!-- 侧边栏加载状态 -->
          <div
            v-if="isLoading"
            class="sider-loading py-4 flex justify-center"
          >
            <Spin />
          </div>

          <div class="h-px bg-border my-1.5" />

          <!-- 导航菜单 -->
          <div
            class="sider-scroll"
            :class="{ disabled: isLoading }"
          >
            <nav
              class="sider-nav"
              :class="{ collapsed: siderCollapsed }"
            >
              <template
                v-for="g in navGroups"
                :key="g.key"
              >
                <div class="nav-group">
                  <div
                    v-if="!siderCollapsed"
                    class="nav-group__header"
                  >
                    <span class="nav-group__label">{{ g.label }}</span>
                  </div>
                  <div class="nav-group__items">
                    <div
                      v-for="item in g.items"
                      :key="item.key"
                      class="nav-item-row"
                    >
                      <template v-if="!item.disabled && item.to">
                        <TooltipProvider v-if="siderCollapsed && !isMobileNav">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <RouterLink
                                :to="item.to"
                                class="nav-item"
                                :class="{ active: activeMenuKey === item.key }"
                                :aria-label="item.label"
                              >
                                <component
                                  :is="item.icon"
                                  class="nav-item__icon"
                                />
                              </RouterLink>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {{ item.label }}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <RouterLink
                          v-else
                          :to="item.to"
                          class="nav-item"
                          :class="{ active: activeMenuKey === item.key }"
                          :aria-label="siderCollapsed ? item.label : undefined"
                        >
                          <component
                            :is="item.icon"
                            class="nav-item__icon"
                          />
                          <span
                            v-if="!siderCollapsed"
                            class="nav-item__label"
                          >
                            {{ item.label }}
                          </span>
                        </RouterLink>
                      </template>

                      <template v-else>
                        <TooltipProvider v-if="siderCollapsed && !isMobileNav">
                          <Tooltip>
                            <TooltipTrigger as-child>
                              <div class="nav-item nav-item--disabled">
                                <component
                                  :is="item.icon"
                                  class="nav-item__icon"
                                />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              {{ item.disabledReason || item.label }}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>

                        <div
                          v-else
                          class="nav-item nav-item--disabled"
                          :title="item.disabledReason || item.label"
                        >
                          <component
                            :is="item.icon"
                            class="nav-item__icon"
                          />
                          <span
                            v-if="!siderCollapsed"
                            class="nav-item__label"
                          >
                            {{ item.label }}
                          </span>
                        </div>
                      </template>
                    </div>
                  </div>
                </div>
              </template>
            </nav>
          </div>

          <!-- 侧边栏底部链接 -->
          <div
            v-if="siderWidth > 150"
            class="sider-footer"
          >
            <div class="flex flex-col items-center justify-center gap-1.5 w-full text-xs text-muted-foreground">
              <span class="footer-text flex items-center gap-1">
                有更多功能建议请
                <a
                  href="/feedback"
                  target="_blank"
                  class="text-primary hover:underline text-[11px]"
                >
                  反馈
                </a>
              </span>
              <div class="h-px bg-border w-full my-0.5" />
              <span class="footer-text">
                <a
                  href="/about"
                  target="_blank"
                  class="text-primary hover:underline text-[11px]"
                >
                  关于本站
                </a>
              </span>
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧内容区域布局容器 -->
      <div class="content-layout-container">
        <!-- 全局加载动画 (覆盖内容区) -->
        <div
          v-if="isLoading"
          class="loading-container flex justify-center items-center py-24"
        >
          <Spin />
        </div>
        <!-- 实际内容区域 (加载完成且找到用户时显示) -->
        <div
          v-else-if="loadStatus === 'ready' && userInfo"
          class="viewer-scroll"
        >
          <div
            class="viewer-page-content"
            :class="[
              layoutContentBgClass,
              {
                'viewer-page-content--edge': route.name === 'user-index' && currentUserPageMode === 'legacy',
              },
            ]"
            :style="layoutContentBgVars"
          >
            <RouterView v-slot="{ Component, route: viewRoute }">
              <KeepAlive :max="4">
                <div
                  v-if="viewRoute.meta.pageContainer !== 'none'"
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
                <component
                  :is="Component"
                  v-else
                  :key="route.fullPath.split('#')[0]"
                  :bili-info="biliUserInfo"
                  :bili-status="biliProfileStatus"
                  :user-info="userInfo"
                />
              </KeepAlive>
            </RouterView>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 注册/登录弹窗 -->
  <Dialog v-model:open="registerAndLoginModalVisiable">
    <DialogContent class="max-w-md p-4">
      <DialogHeader>
        <DialogTitle class="text-sm font-semibold">注册 / 登录</DialogTitle>
      </DialogHeader>
      <div class="flex flex-col gap-3 py-2">
        <Alert class="bg-primary/5 border-primary/20 text-xs py-2">
          <AlertDescription>
            <div class="text-center text-xs">
              查看积分和订单，用 Bilibili 认证即可，不用注册。主播或需要提问时再登录。
            </div>
            <div class="flex justify-center mt-2">
              <Button @click="openAudienceEntry">
                {{ useAuth.isAuthed ? '查看积分和订单' : '开始 Bilibili 认证' }}
              </Button>
            </div>
          </AlertDescription>
        </Alert>

        <RegisterAndLogin
          closable
          @close="registerAndLoginModalVisiable = false"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>

<style lang="stylus" scoped>
:root {
  --vtsuru-header-height: 50px;
  --vtsuru-content-padding: 16px;
}

.center-container {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.layout-header,
.page-root .layout-header,
.page-root.bg-host .layout-header {
  height: var(--vtsuru-header-height);
  padding: 0 12px;
  background-color: var(--popover, var(--background));
  border-bottom: 1px solid var(--border, var(--border));
  position: sticky !important;
  top: 0 !important;
  z-index: 100 !important;
  flex-shrink: 0;
  transition: background-color 0.3s ease, border-color 0.3s ease;
}

.layout-header__inner {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.layout-header__left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.layout-header__logo {
  height: 24px;
  width: 24px;
}

.page-root {
  min-height: 100vh;
  background-color: var(--vtsuru-page-bg, #f7f8fa);
  transition: background-color 0.3s ease;
}

.page-root.bg-host {
  position: relative;
  background-color: transparent;
}

.page-root.bg-host::before {
  content: "";
  position: fixed;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  transform: translateZ(0);
  pointer-events: none;
  z-index: 0;
}

.page-root.bg-host::after {
  content: "";
  position: fixed;
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
  background-color: var(--user-page-theme-surface-bg, var(--popover));
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.page-root.bg-host.glass .layout-header,
.page-root.bg-host.glass .user-sider {
  background-color: var(--glass-surface-bg, rgba(255, 255, 255, 0.55));
  backdrop-filter: blur(var(--user-page-bg-blur, 12px));
  -webkit-backdrop-filter: blur(var(--user-page-bg-blur, 12px));
}

.content-bg-host {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}

.content-bg-host::before {
  content: "";
  position: absolute;
  inset: calc(-24px - var(--user-page-bg-blur, 0px));
  background-color: var(--user-page-bg-color, transparent);
  background-image: var(--user-page-bg-image, none);
  background-repeat: no-repeat;
  background-size: var(--user-page-bg-size, cover);
  background-position: center;
  pointer-events: none;
  z-index: 0;
}

.content-bg-host::after {
  content: "";
  position: absolute;
  inset: 0;
  background: var(--user-page-bg-scrim, transparent);
  pointer-events: none;
  z-index: 0;
}

.content-bg-host.content-bg-blur::before {
  filter: blur(var(--user-page-bg-blur, 0px));
}

.content-bg-host > * {
  position: relative;
  z-index: 1;
}

.main-layout-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.user-sider {
  position: sticky;
  top: var(--vtsuru-header-height);
  height: calc(100vh - var(--vtsuru-header-height));
  background-color: var(--popover, var(--background));
  border-right: 1px solid var(--border, var(--border));
  transition: width 0.2s ease;
  z-index: 90;
  flex-shrink: 0;
}

.sider-shell {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.sider-top {
  display: flex;
  justify-content: flex-end;
  padding: 8px;
}

.sider-collapse-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  color: var(--muted-foreground, var(--muted-foreground));
  display: flex;
  align-items: center;
  justify-content: center;
}

.sider-collapse-btn:hover {
  background-color: var(--brand-soft, var(--accent));
}

.sider-collapse-icon {
  width: 16px;
  height: 16px;
}

.sider-profile {
  padding: 8px;
}

.sider-avatar-button {
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  position: relative;
  display: inline-block;
}

.sider-avatar-pendant {
  position: absolute;
  top: -15%;
  left: -15%;
  width: 130%;
  height: 130%;
  pointer-events: none;
}

.live-indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: #ef4444;
  display: inline-block;
}

.sider-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

.sider-nav {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-group__header {
  padding: 4px 8px;
  font-size: 11px;
  color: var(--muted-foreground, var(--muted-foreground));
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  text-decoration: none;
  color: var(--muted-foreground, var(--muted-foreground));
  font-size: 13px;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background-color: var(--brand-soft, var(--accent));
  color: var(--foreground, var(--foreground));
}

.nav-item.active {
  background-color: var(--brand-soft, var(--accent));
  color: var(--brand, var(--primary));
  font-weight: 500;
}

.nav-item--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nav-item__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* 折叠状态下侧边栏元素水平居中对齐 */
.user-sider.collapsed .sider-top {
  justify-content: center;
  padding: 8px 0;
}

.user-sider.collapsed .sider-profile {
  display: flex;
  justify-content: center;
  padding: 8px 0;
}

.user-sider.collapsed .nav-item,
.sider-nav.collapsed .nav-item {
  justify-content: center;
  padding: 8px 0;
  gap: 0;
}

.user-sider.collapsed .nav-item__icon,
.sider-nav.collapsed .nav-item__icon {
  margin: 0 auto;
}

.sider-footer {
  padding: 8px;
  border-top: 1px solid var(--border, var(--border));
}

.content-layout-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.viewer-scroll {
  flex: 1;
  overflow-y: auto;
}

.viewer-page-content {
  min-height: 100%;
  padding: var(--vtsuru-content-padding);
}

@media (min-width: 769px) {
  .page-root {
    height: 100vh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .page-root.bg-host {
    height: auto;
    min-height: 100dvh;
    overflow: visible;
  }

  .main-layout-body {
    height: auto;
    min-height: calc(100dvh - var(--vtsuru-header-height));
    overflow: visible;
  }

  .viewer-scroll {
    overflow: visible;
  }

  .page-root.bg-host::before,
  .page-root.bg-host::after,
  .content-bg-host::before,
  .content-bg-host::after {
    position: fixed;
  }
}
</style>
