<script setup lang="ts">
import { useIntervalFn, useNow } from '@vueuse/core'
import {
  Heart,
  LogIn,
  Menu,
  Moon,
  Palette,
  Radio,
  Sun,
  Terminal,
  Wrench,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ResponseUserInfo } from '@/api/generated/model'
import type { BiliProfile } from '@/apps/user-page/types'
import FollowButton from '@/components/common/FollowButton.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Separator } from '@/shared/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/shared/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { NavigateToNewTab } from '@/shared/utils'

import type { SiteShellMode, SiteTemplateId } from './registry'

export interface ShellNavItem {
  key: string
  label: string
  icon: any
  to?: any
  disabled?: boolean
  disabledReason?: string
}

export interface ShellNavGroup {
  key: string
  label: string
  items: ShellNavItem[]
}

const props = withDefaults(
  defineProps<{
    templateId: SiteTemplateId
    shellMode: Exclude<SiteShellMode, 'classic-sidebar'>
    userInfo: ResponseUserInfo | null
    biliInfo?: BiliProfile | null
    navGroups: ShellNavGroup[]
    activeMenuKey?: string
    isOwner?: boolean
    isDark?: boolean
    themeLocked?: boolean
    themeSwitchTitle?: string
    isLoading?: boolean
    isLoggedIn?: boolean
    workspaceLabel?: string
    followState?: { isFollowing?: boolean; followers?: number }
    followError?: string | null
    preview?: boolean
    placement?: 'all' | 'top' | 'bottom'
  }>(),
  {
    biliInfo: null,
    activeMenuKey: 'user-index',
    isOwner: false,
    isDark: false,
    themeLocked: false,
    themeSwitchTitle: '切换主题',
    isLoading: false,
    isLoggedIn: false,
    workspaceLabel: '工作台',
    followState: undefined,
    followError: null,
    preview: false,
    placement: 'all',
  },
)

const emit = defineEmits<{
  (e: 'toggle-theme'): void
  (e: 'open-login'): void
  (e: 'open-builder'): void
  (e: 'open-following'): void
  (e: 'open-workspace'): void
  (e: 'follow-changed'): void
}>()

const mobileDrawerOpen = ref(false)

const flatNavItems = computed(() => props.navGroups.flatMap((group) => group.items))
const displayName = computed(() => props.userInfo?.streamerInfo?.name || props.userInfo?.name || 'CHANNEL')
const handleName = computed(() => props.userInfo?.name || 'channel')
const avatarUrl = computed(() => {
  if (!props.userInfo?.biliId) return ''
  return props.userInfo.streamerInfo?.faceUrl || props.userInfo.faceUrl || props.biliInfo?.face || ''
})
const isStreaming = computed(() => props.userInfo?.streamerInfo?.isStreaming === true)
const now = useNow({ scheduler: (cb) => useIntervalFn(cb, 30_000) })
const osClockText = computed(() => {
  const d = now.value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
})

function openBiliSpace() {
  if (props.preview || !props.userInfo?.biliId) return
  NavigateToNewTab(`https://space.bilibili.com/${props.userInfo.biliId}`)
}
</script>

<template>
  <!-- ==================== TOP-BAR SHELL (HUD / ZINE) ==================== -->
  <header
    v-if="shellMode === 'top-bar' && placement !== 'bottom'"
    class="site-shell-topbar"
    :class="[`site-shell-topbar--${templateId}`, { 'is-preview': preview }]"
  >
    <div class="site-shell-topbar__inner">
      <!-- 左侧身份标识 -->
      <div class="site-shell-brand">
        <button
          type="button"
          class="site-shell-brand__btn"
          :disabled="preview || !userInfo?.biliId"
          @click="openBiliSpace"
        >
          <Avatar
            v-if="avatarUrl"
            class="size-7 shrink-0 border border-border"
          >
            <AvatarImage :src="avatarUrl" />
            <AvatarFallback>{{ displayName.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <span
            v-else
            class="site-shell-brand__monogram"
          >
            {{ displayName.slice(0, 1).toUpperCase() }}
          </span>
          <div class="site-shell-brand__text">
            <span class="site-shell-brand__kicker">
              <template v-if="templateId === 'broadcast-hud'">CH // @{{ handleName }}</template>
              <template v-else-if="templateId === 'raw-brutalist'">POSTER // @{{ handleName }}</template>
              <template v-else>VTSURU ISSUE // @{{ handleName }}</template>
            </span>
            <span class="site-shell-brand__name">{{ displayName }}</span>
          </div>
        </button>

        <span
          v-if="isStreaming"
          class="site-shell-live-pill"
        >
          <Radio class="size-3" />
          <span>LIVE</span>
        </span>
      </div>

      <!-- 中部横向导航（桌面端显示） -->
      <nav
        class="site-shell-nav no-scrollbar"
        aria-label="页面导航"
      >
        <template
          v-for="(item, idx) in flatNavItems"
          :key="item.key"
        >
          <span
            v-if="preview || item.disabled || !item.to"
            class="site-shell-nav__item"
            :class="{
              'is-active': activeMenuKey === item.key,
              'is-disabled': item.disabled,
            }"
          >
            <span
              v-if="templateId === 'editorial-zine'"
              class="site-shell-nav__index"
            >
              {{ String(idx + 1).padStart(2, '0') }}
            </span>
            <component
              :is="item.icon"
              v-else
              class="size-3.5 shrink-0"
            />
            <span>{{ item.label }}</span>
          </span>
          <RouterLink
            v-else
            :to="item.to"
            class="site-shell-nav__item"
            :class="{ 'is-active': activeMenuKey === item.key }"
          >
            <span
              v-if="templateId === 'editorial-zine'"
              class="site-shell-nav__index"
            >
              {{ String(idx + 1).padStart(2, '0') }}
            </span>
            <component
              :is="item.icon"
              v-else
              class="size-3.5 shrink-0"
            />
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </nav>

      <!-- 右侧操作组 -->
      <div class="site-shell-actions">
        <div
          v-if="userInfo && !preview"
          class="hidden lg:flex items-center"
        >
          <FollowButton
            :user-id="userInfo.id"
            :following="followState?.isFollowing"
            :followers="followState?.followers"
            @changed="emit('follow-changed')"
          />
        </div>

        <Button
          size="icon-xs"
          variant="ghost"
          :disabled="preview || isLoading || themeLocked"
          :aria-label="themeSwitchTitle"
          @click="emit('toggle-theme')"
        >
          <component
            :is="isDark ? Moon : Sun"
            class="size-3.5"
          />
        </Button>

        <template v-if="!preview">
          <template v-if="isLoggedIn">
            <Button
              v-if="isOwner"
              variant="outline"
              size="xs"
              class="hidden md:inline-flex gap-1"
              @click="emit('open-builder')"
            >
              <Palette class="size-3.5" />
              <span>装修</span>
            </Button>
            <Button
              size="xs"
              class="hidden sm:inline-flex gap-1"
              @click="emit('open-workspace')"
            >
              <Wrench class="size-3.5" />
              <span class="hidden xl:inline">{{ workspaceLabel }}</span>
            </Button>
          </template>
          <Button
            v-else
            size="xs"
            class="hidden sm:inline-flex gap-1"
            @click="emit('open-login')"
          >
            <LogIn class="size-3.5" />
            <span>登录</span>
          </Button>
        </template>

        <!-- 移动端及平板端菜单按钮（1024px 以下用完整抽屉承载导航，避免顶栏溢出裁切） -->
        <Button
          v-if="!preview"
          size="icon-xs"
          variant="outline"
          class="lg:hidden"
          aria-label="打开导航菜单"
          @click="mobileDrawerOpen = true"
        >
          <Menu class="size-4" />
        </Button>
      </div>
    </div>
  </header>

  <!-- ==================== FLOATING-DOCK SHELL (LIQUID PRISM / KINETIC STAGE) ==================== -->
  <template v-else-if="shellMode === 'floating-dock'">
    <header
      v-if="placement !== 'bottom'"
      class="site-shell-prism-top"
      :class="[`site-shell-prism-top--${templateId}`, { 'is-preview': preview }]"
    >
      <div class="site-shell-prism-pill site-shell-prism-pill--brand">
        <button
          type="button"
          class="site-shell-brand__btn"
          :disabled="preview || !userInfo?.biliId"
          @click="openBiliSpace"
        >
          <Avatar
            v-if="avatarUrl"
            class="size-7 shrink-0 border border-border/60"
          >
            <AvatarImage :src="avatarUrl" />
            <AvatarFallback>{{ displayName.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <span
            v-else
            class="site-shell-brand__monogram rounded-full"
          >
            {{ displayName.slice(0, 1).toUpperCase() }}
          </span>
          <span class="site-shell-brand__name">{{ displayName }}</span>
        </button>

        <span
          v-if="isStreaming"
          class="site-shell-live-pill site-shell-live-pill--prism"
        >
          <span class="site-shell-live-dot" />
          <span>LIVE</span>
        </span>
      </div>

      <div class="site-shell-prism-pill site-shell-prism-pill--actions">
        <div
          v-if="userInfo && !preview"
          class="hidden sm:flex items-center"
        >
          <FollowButton
            :user-id="userInfo.id"
            :following="followState?.isFollowing"
            :followers="followState?.followers"
            @changed="emit('follow-changed')"
          />
        </div>

        <Button
          size="icon-xs"
          variant="ghost"
          class="rounded-full"
          :disabled="preview || isLoading || themeLocked"
          :aria-label="themeSwitchTitle"
          @click="emit('toggle-theme')"
        >
          <component
            :is="isDark ? Moon : Sun"
            class="size-3.5"
          />
        </Button>

        <template v-if="!preview">
          <Button
            v-if="isLoggedIn && isOwner"
            size="icon-xs"
            variant="ghost"
            class="rounded-full"
            aria-label="装修主页"
            @click="emit('open-builder')"
          >
            <Palette class="size-3.5" />
          </Button>
          <Button
            v-if="isLoggedIn"
            size="xs"
            class="hidden sm:inline-flex rounded-full gap-1"
            @click="emit('open-workspace')"
          >
            <Wrench class="size-3.5" />
            <span>{{ workspaceLabel }}</span>
          </Button>
          <Button
            v-else
            size="xs"
            class="hidden sm:inline-flex rounded-full gap-1"
            @click="emit('open-login')"
          >
            <LogIn class="size-3.5" />
            <span>登录</span>
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            class="sm:hidden rounded-full"
            aria-label="更多操作"
            @click="mobileDrawerOpen = true"
          >
            <Menu class="size-4" />
          </Button>
        </template>
      </div>
    </header>

    <!-- 底部悬浮液态玻璃 Dock -->
    <nav
      v-if="placement !== 'top'"
      class="site-shell-dock"
      :class="[`site-shell-dock--${templateId}`, { 'is-preview': preview }]"
      aria-label="页面导航"
    >
      <div class="site-shell-dock__rail no-scrollbar">
        <template
          v-for="item in flatNavItems"
          :key="item.key"
        >
          <span
            v-if="preview || item.disabled || !item.to"
            class="site-shell-dock__item"
            :class="{
              'is-active': activeMenuKey === item.key,
              'is-disabled': item.disabled,
            }"
          >
            <component
              :is="item.icon"
              class="size-4 shrink-0"
            />
            <span class="site-shell-dock__label">{{ item.label }}</span>
          </span>
          <TooltipProvider v-else>
            <Tooltip>
              <TooltipTrigger as-child>
                <RouterLink
                  :to="item.to"
                  class="site-shell-dock__item"
                  :class="{ 'is-active': activeMenuKey === item.key }"
                >
                  <component
                    :is="item.icon"
                    class="size-4 shrink-0"
                  />
                  <span class="site-shell-dock__label">{{ item.label }}</span>
                </RouterLink>
              </TooltipTrigger>
              <TooltipContent side="top">
                {{ item.label }}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </template>
      </div>
    </nav>
  </template>

  <!-- ==================== OS-DESKTOP SHELL (ACID OS 2000) ==================== -->
  <template v-else-if="shellMode === 'os-desktop'">
    <header
      v-if="placement !== 'bottom'"
      class="site-shell-os-top"
      :class="{ 'is-preview': preview }"
    >
      <div class="site-shell-os-top__left">
        <span class="site-shell-os-badge">
          <Terminal class="size-3" />
          <span>VTSURU_OS</span>
        </span>
        <button
          type="button"
          class="site-shell-os-user"
          :disabled="preview || !userInfo?.biliId"
          @click="openBiliSpace"
        >
          <span>@{{ handleName }}</span>
          <span class="hidden sm:inline text-muted-foreground">/ {{ displayName }}</span>
        </button>
        <span
          v-if="isStreaming"
          class="site-shell-live-pill"
        >
          <Radio class="size-3" />
          <span>LIVE</span>
        </span>
      </div>

      <div class="site-shell-os-top__right">
        <div
          v-if="userInfo && !preview"
          class="hidden lg:flex items-center"
        >
          <FollowButton
            :user-id="userInfo.id"
            :following="followState?.isFollowing"
            :followers="followState?.followers"
            @changed="emit('follow-changed')"
          />
        </div>

        <span class="site-shell-os-clock tabular-nums">{{ osClockText }}</span>

        <Button
          size="icon-xs"
          variant="ghost"
          :disabled="preview || isLoading || themeLocked"
          :aria-label="themeSwitchTitle"
          @click="emit('toggle-theme')"
        >
          <component
            :is="isDark ? Moon : Sun"
            class="size-3.5"
          />
        </Button>

        <template v-if="!preview">
          <Button
            v-if="isLoggedIn && isOwner"
            size="xs"
            variant="outline"
            class="hidden md:inline-flex gap-1 rounded-[2px]"
            @click="emit('open-builder')"
          >
            <Palette class="size-3.5" />
            <span>装修</span>
          </Button>
          <Button
            v-if="isLoggedIn"
            size="xs"
            class="hidden sm:inline-flex gap-1 rounded-[2px]"
            @click="emit('open-workspace')"
          >
            <Wrench class="size-3.5" />
            <span class="hidden xl:inline">{{ workspaceLabel }}</span>
          </Button>
          <Button
            v-else
            size="xs"
            class="hidden sm:inline-flex gap-1 rounded-[2px]"
            @click="emit('open-login')"
          >
            <LogIn class="size-3.5" />
            <span>登录</span>
          </Button>
          <Button
            size="icon-xs"
            variant="outline"
            class="sm:hidden rounded-[2px]"
            aria-label="打开系统菜单"
            @click="mobileDrawerOpen = true"
          >
            <Menu class="size-4" />
          </Button>
        </template>
      </div>
    </header>

    <!-- 底部复古任务栏 -->
    <nav
      v-if="placement !== 'top'"
      class="site-shell-os-taskbar"
      :class="{ 'is-preview': preview }"
      aria-label="桌面任务栏"
    >
      <div class="site-shell-os-taskbar__inner no-scrollbar">
        <span class="site-shell-os-start">START</span>
        <template
          v-for="item in flatNavItems"
          :key="item.key"
        >
          <span
            v-if="preview || item.disabled || !item.to"
            class="site-shell-os-task"
            :class="{
              'is-active': activeMenuKey === item.key,
              'is-disabled': item.disabled,
            }"
          >
            <component
              :is="item.icon"
              class="size-3.5 shrink-0"
            />
            <span>{{ item.label }}</span>
          </span>
          <RouterLink
            v-else
            :to="item.to"
            class="site-shell-os-task"
            :class="{ 'is-active': activeMenuKey === item.key }"
          >
            <component
              :is="item.icon"
              class="size-3.5 shrink-0"
            />
            <span>{{ item.label }}</span>
          </RouterLink>
        </template>
      </div>
    </nav>
  </template>

  <!-- ==================== 移动端完整导航抽屉 ==================== -->
  <Sheet
    v-if="!preview"
    v-model:open="mobileDrawerOpen"
  >
    <SheetContent
      side="right"
      class="w-72 p-0 flex flex-col"
    >
      <SheetHeader class="p-4 border-b border-border text-left">
        <SheetTitle class="flex items-center gap-2.5 text-sm">
          <Avatar
            v-if="avatarUrl"
            class="size-8 border border-border"
          >
            <AvatarImage :src="avatarUrl" />
            <AvatarFallback>{{ displayName.slice(0, 1) }}</AvatarFallback>
          </Avatar>
          <div class="min-w-0">
            <div class="truncate font-semibold text-foreground">{{ displayName }}</div>
            <div class="truncate text-[11px] font-normal text-muted-foreground">@{{ handleName }}</div>
          </div>
        </SheetTitle>
      </SheetHeader>

      <div class="flex-1 overflow-y-auto scrollbar-thin p-3 flex flex-col gap-3">
        <div
          v-if="userInfo"
          class="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-2.5"
        >
          <FollowButton
            :user-id="userInfo.id"
            :following="followState?.isFollowing"
            :followers="followState?.followers"
            @changed="emit('follow-changed')"
          />
          <span
            v-if="isStreaming"
            class="site-shell-live-pill"
          >
            <Radio class="size-3" />
            <span>LIVE</span>
          </span>
        </div>

        <div
          v-for="group in navGroups"
          :key="group.key"
          class="flex flex-col gap-1"
        >
          <div class="px-2 py-1 text-[11px] font-medium text-muted-foreground">
            {{ group.label }}
          </div>
          <template
            v-for="item in group.items"
            :key="item.key"
          >
            <RouterLink
              v-if="!item.disabled && item.to"
              :to="item.to"
              class="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs transition-colors"
              :class="
                activeMenuKey === item.key
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-foreground hover:bg-muted'
              "
              @click="mobileDrawerOpen = false"
            >
              <component
                :is="item.icon"
                class="size-4 shrink-0"
              />
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </template>
        </div>

        <Separator />

        <div class="flex flex-col gap-1.5">
          <template v-if="isLoggedIn">
            <Button
              v-if="isOwner"
              variant="outline"
              class="w-full justify-start gap-2"
              @click="((mobileDrawerOpen = false), emit('open-builder'))"
            >
              <Palette class="size-4" />
              装修主页
            </Button>
            <Button
              variant="outline"
              class="w-full justify-start gap-2"
              @click="((mobileDrawerOpen = false), emit('open-following'))"
            >
              <Heart class="size-4" />
              关注管理
            </Button>
            <Button
              class="w-full justify-start gap-2"
              @click="((mobileDrawerOpen = false), emit('open-workspace'))"
            >
              <Wrench class="size-4" />
              {{ workspaceLabel }}
            </Button>
          </template>
          <Button
            v-else
            class="w-full justify-start gap-2"
            @click="((mobileDrawerOpen = false), emit('open-login'))"
          >
            <LogIn class="size-4" />
            注册 / 登录
          </Button>
        </div>
      </div>
    </SheetContent>
  </Sheet>
</template>

<style scoped>
/* ==================== TOP-BAR COMMON ==================== */
.site-shell-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
  width: 100%;
  border-bottom: 1px solid var(--border);
  background: color-mix(in oklch, var(--background) 82%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.site-shell-topbar.is-preview {
  z-index: 25;
}

.site-shell-topbar__inner {
  max-width: 1440px;
  margin: 0 auto;
  height: 54px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.site-shell-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
}

.site-shell-brand__btn {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  background: transparent;
  border: 0;
  padding: 0;
  color: var(--foreground);
  cursor: pointer;
  min-width: 0;
  text-align: left;
}

.site-shell-brand__btn:disabled {
  cursor: default;
}

.site-shell-brand__monogram {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: color-mix(in oklch, var(--primary) 16%, transparent);
  color: var(--primary);
  border: 1px solid color-mix(in oklch, var(--primary) 42%, transparent);
  border-radius: var(--radius, 6px);
  flex-shrink: 0;
}

.site-shell-brand__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.15;
}

.site-shell-brand__kicker {
  font-size: 9px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted-foreground);
  white-space: nowrap;
}

.site-shell-brand__name {
  font-size: 13px;
  font-weight: 700;
  color: var(--foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.site-shell-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
  background: #e11d48;
  border-radius: 3px;
  flex-shrink: 0;
}

.site-shell-live-pill--prism {
  border-radius: 999px;
  background: color-mix(in oklch, #ef4444 88%, var(--primary));
}

.site-shell-live-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #fff;
  animation: siteShellPulse 1.6s ease-in-out infinite;
}

@keyframes siteShellPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.45; transform: scale(0.8); }
}

.site-shell-nav {
  display: none;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  min-width: 0;
  flex: 1;
  justify-content: safe center;
}

@media (min-width: 1024px) {
  .site-shell-nav {
    display: flex;
  }
}

@media (min-width: 1024px) and (max-width: 1279px) {
  .site-shell-topbar__inner {
    gap: 10px;
  }

  .site-shell-nav {
    gap: 2px;
  }

  .site-shell-nav__item {
    padding: 5px 7px;
    gap: 4px;
    font-size: 11.5px;
  }
}

.site-shell-nav__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-decoration: none;
  white-space: nowrap;
  border-radius: var(--radius, 6px);
  border: 1px solid transparent;
  transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease;
}

.site-shell-nav__item:hover {
  color: var(--foreground);
  background: color-mix(in oklch, var(--foreground) 6%, transparent);
}

.site-shell-nav__item.is-active {
  color: var(--primary);
  background: color-mix(in oklch, var(--primary) 12%, transparent);
  border-color: color-mix(in oklch, var(--primary) 34%, transparent);
}

.site-shell-nav__item.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.site-shell-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

/* ---------- Broadcast HUD topbar variant ---------- */
.site-shell-topbar--broadcast-hud {
  border-bottom: 1px solid color-mix(in oklch, var(--primary) 32%, var(--border));
  box-shadow: inset 0 -1px 0 color-mix(in oklch, var(--primary) 16%, transparent);
}

.site-shell-topbar--broadcast-hud .site-shell-brand__kicker,
.site-shell-topbar--broadcast-hud .site-shell-nav__item {
  font-family: var(--site-font-mono, ui-monospace, monospace);
}

.site-shell-topbar--broadcast-hud .site-shell-nav__item {
  font-size: 11.5px;
  letter-spacing: 0.04em;
  border-radius: 2px;
}

.site-shell-topbar--broadcast-hud .site-shell-nav__item.is-active {
  box-shadow: inset 0 -2px 0 var(--primary);
}

/* ---------- Editorial Zine topbar variant ---------- */
.site-shell-topbar--editorial-zine {
  border-bottom: 1px solid color-mix(in oklch, var(--foreground) 22%, transparent);
  background: color-mix(in oklch, var(--background) 88%, transparent);
}

.site-shell-topbar--editorial-zine .site-shell-brand__name {
  font-family: var(--site-font-display, Georgia, serif);
  letter-spacing: 0.02em;
}

.site-shell-topbar--editorial-zine .site-shell-nav__item {
  border-radius: 0;
  border: 0;
  border-bottom: 1.5px solid transparent;
  padding: 6px 8px;
}

.site-shell-topbar--editorial-zine .site-shell-nav__item:hover {
  background: transparent;
}

.site-shell-topbar--editorial-zine .site-shell-nav__item.is-active {
  background: transparent;
  border-bottom-color: var(--primary);
  color: var(--foreground);
  font-weight: 600;
}

.site-shell-nav__index {
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  color: var(--primary);
  font-weight: 600;
}

/* ---------- Raw Brutalist topbar variant ---------- */
.site-shell-topbar--raw-brutalist {
  border-bottom: 2px solid color-mix(in oklch, var(--foreground) 90%, transparent);
  background: var(--background);
  backdrop-filter: none;
}

.site-shell-topbar--raw-brutalist .site-shell-brand__name {
  font-family: var(--site-font-display, system-ui, sans-serif);
  font-weight: 900;
  text-transform: uppercase;
}

.site-shell-topbar--raw-brutalist .site-shell-nav__item {
  border-radius: 0;
  border: 1.5px solid transparent;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-weight: 700;
  color: var(--foreground);
}

.site-shell-topbar--raw-brutalist .site-shell-nav__item:hover {
  border-color: color-mix(in oklch, var(--foreground) 85%, transparent);
  background: color-mix(in oklch, var(--foreground) 6%, transparent);
}

.site-shell-topbar--raw-brutalist .site-shell-nav__item.is-active {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: color-mix(in oklch, var(--foreground) 90%, transparent);
  box-shadow: 2px 2px 0 color-mix(in oklch, var(--foreground) 90%, transparent);
}

/* ---------- Kinetic Stage dock variant ---------- */
.site-shell-dock--kinetic-stage .site-shell-dock__rail {
  background: color-mix(in oklch, var(--background) 86%, transparent);
  border-color: color-mix(in oklch, var(--primary) 30%, var(--border));
  box-shadow:
    inset 0 1px 0 color-mix(in oklch, var(--primary) 26%, transparent),
    0 20px 44px -12px rgba(0, 0, 0, 0.65);
}

/* ==================== OS-DESKTOP SHELL (ACID OS 2000) ==================== */
.site-shell-os-top {
  position: sticky;
  top: 0;
  z-index: 100;
  flex-shrink: 0;
  height: 44px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: var(--card);
  border-bottom: 2px solid color-mix(in oklch, var(--primary) 60%, var(--foreground));
  font-family: var(--site-font-mono, ui-monospace, monospace);
}

.site-shell-os-top.is-preview {
  z-index: 25;
}

.site-shell-os-top__left,
.site-shell-os-top__right {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.site-shell-os-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 8px;
  font-family: var(--site-font-pixel, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 700;
  background: var(--primary);
  color: var(--primary-foreground);
  flex-shrink: 0;
}

.site-shell-os-user {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 0;
  padding: 0;
  font-size: 11.5px;
  font-weight: 700;
  color: var(--foreground);
  cursor: pointer;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.site-shell-os-user:disabled {
  cursor: default;
}

.site-shell-os-clock {
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--primary);
  border: 1px solid color-mix(in oklch, var(--primary) 45%, var(--border));
  background: color-mix(in oklch, var(--background) 80%, transparent);
}

.site-shell-os-taskbar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 105;
  background: var(--card);
  border-top: 2px solid color-mix(in oklch, var(--primary) 60%, var(--foreground));
  padding: 6px 12px;
}

.site-shell-os-taskbar.is-preview {
  position: sticky;
  bottom: 0;
  z-index: 25;
}

.site-shell-os-taskbar__inner {
  max-width: 1440px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
}

.site-shell-os-start {
  display: inline-flex;
  align-items: center;
  padding: 5px 10px;
  font-family: var(--site-font-pixel, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.08em;
  background: var(--primary);
  color: var(--primary-foreground);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 80%, transparent);
  box-shadow: 2px 2px 0 color-mix(in oklch, var(--foreground) 75%, transparent);
  flex-shrink: 0;
  user-select: none;
}

.site-shell-os-task {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  font-family: var(--site-font-mono, ui-monospace, monospace);
  font-size: 11.5px;
  font-weight: 600;
  color: var(--foreground);
  text-decoration: none;
  white-space: nowrap;
  background: var(--background);
  border: 1.5px solid color-mix(in oklch, var(--foreground) 34%, transparent);
  transition: transform 140ms ease, background-color 140ms ease, border-color 140ms ease;
}

.site-shell-os-task:hover {
  border-color: var(--primary);
  transform: translateY(-1px);
}

.site-shell-os-task.is-active {
  background: color-mix(in oklch, var(--primary) 20%, var(--background));
  border-color: var(--primary);
  color: var(--primary);
  box-shadow: inset 0 -2px 0 var(--primary);
}

.site-shell-os-task.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

/* ==================== FLOATING-DOCK (LIQUID PRISM) ==================== */
.site-shell-prism-top {
  position: sticky;
  top: 0;
  z-index: 95;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 16px 4px;
  pointer-events: none;
}

/* 宽屏下两侧留白充足，顶部左右胶囊脱离文档流悬浮，避免把正文整段往下推 */
@media (min-width: 1280px) {
  .site-shell-prism-top:not(.is-preview) {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
  }
}

.site-shell-prism-top.is-preview {
  z-index: 25;
}

.site-shell-prism-pill {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 999px;
  background: color-mix(in oklch, var(--card) 74%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 15%, transparent);
  backdrop-filter: blur(22px) saturate(175%);
  -webkit-backdrop-filter: blur(22px) saturate(175%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 34%, transparent),
    0 10px 26px -14px rgba(0, 0, 0, 0.35);
}

.site-shell-dock {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  z-index: 105;
  max-width: calc(100vw - 24px);
  pointer-events: auto;
}

.site-shell-dock.is-preview {
  position: sticky;
  left: auto;
  bottom: 12px;
  transform: none;
  margin: 0 auto 12px;
  width: fit-content;
  max-width: calc(100% - 20px);
  z-index: 25;
}

.site-shell-dock__rail {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  overflow-x: auto;
  border-radius: 999px;
  background: color-mix(in oklch, var(--card) 78%, transparent);
  border: 1px solid color-mix(in oklch, var(--foreground) 18%, transparent);
  backdrop-filter: blur(24px) saturate(185%);
  -webkit-backdrop-filter: blur(24px) saturate(185%);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, white 40%, transparent),
    inset 0 -1px 0 color-mix(in oklch, var(--primary) 22%, transparent),
    0 18px 40px -14px color-mix(in oklch, var(--primary) 35%, rgba(0, 0, 0, 0.45));
}

.site-shell-dock__item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-decoration: none;
  white-space: nowrap;
  transition: color 160ms ease, background-color 160ms ease, transform 160ms ease;
}

.site-shell-dock__item:hover {
  color: var(--foreground);
  background: color-mix(in oklch, var(--foreground) 8%, transparent);
  transform: translateY(-1px);
}

.site-shell-dock__item.is-active {
  color: var(--primary-foreground);
  background: var(--primary);
  box-shadow: 0 6px 18px -6px color-mix(in oklch, var(--primary) 80%, transparent);
}

.site-shell-dock__item.is-disabled {
  opacity: 0.45;
  pointer-events: none;
}

@media (max-width: 520px) {
  .site-shell-topbar__inner {
    padding: 0 12px;
    height: 50px;
  }

  .site-shell-dock {
    bottom: 12px;
    max-width: calc(100vw - 16px);
  }

  .site-shell-dock__item {
    padding: 8px 10px;
  }

  .site-shell-dock__label {
    font-size: 11px;
  }
}
</style>
