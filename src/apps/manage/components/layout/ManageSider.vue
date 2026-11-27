<script setup lang="ts">
import Info24Filled from '@vicons/fluent/es/Info24Filled'
import PersonFeedback24Filled from '@vicons/fluent/es/PersonFeedback24Filled'
import Bookmark from '@vicons/ionicons5/es/Bookmark'
import BookmarkOutline from '@vicons/ionicons5/es/BookmarkOutline'
import ColorPaletteOutline from '@vicons/ionicons5/es/ColorPaletteOutline'
import GridOutline from '@vicons/ionicons5/es/GridOutline'
import ImageOutline from '@vicons/ionicons5/es/ImageOutline'
import { createReusableTemplate } from '@vueuse/core'
import { Download, Monitor } from 'lucide-vue-next'
import { computed, toRef, watch, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { ResponseAccountInfo } from '@/api/generated/model'
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'
import {
  type ManageNavGroupKey,
  type ManageNavItem,
  useManageNavigation,
} from '@/apps/manage/composables/useManageNavigation'
import { useManageShell } from '@/apps/manage/composables/useManageShell'
import { useManageWorkspace } from '@/apps/manage/composables/useManageWorkspace'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Sheet, SheetContent } from '@/shared/ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  accountInfo: ResponseAccountInfo
}>()

const [DefineSiderBody, ReuseSiderBody] = createReusableTemplate()

const message = useMessage()
const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const { workspace } = useManageWorkspace()
const { isMobileSider, siderCollapsed, mobileSiderOpen } = useManageShell()
const {
  isBiliVerified,
  userItems,
  streamerItems,
  streamerItemMap,
  favoriteMenuItems,
  isFavorite,
  toggleFavorite,
  recordRecent,
} = useManageNavigation(toRef(props, 'accountInfo'))

const collapsed = computed(() => !isMobileSider.value && siderCollapsed.value)
const siderWidth = 180
const siderCollapsedWidth = 56

const expandedGroups = usePersistedStorage<string[]>('Settings.ManageSiderExpandedGroups', [
  'group-favorites',
  'group-common',
  'group-data',
  'group-tools',
  'group-danmaku',
])

const biliAccountOptions = computed(() => [
  ...biliAuth.biliTokens.map((account) => ({
    key: String(account.id),
    label: account.name || `UID ${account.uId}`,
    disabled: account.id === biliAuth.biliAuth.id,
  })),
  { type: 'divider' as const, key: 'divider' },
  { key: 'add', label: '认证其他账号' },
])

async function switchBiliAccount(key: string) {
  if (key === 'add') {
    await router.push({ name: 'bili-auth' })
    return
  }
  const account = biliAuth.biliTokens.find((item) => String(item.id) === key)
  if (!account) return
  await biliAuth.setCurrentAuth(account.token)
  message.success(`已切换至 ${account.name || `UID ${account.uId}`}`)
}

const activeKey = computed(() => (route.meta.parent as string) ?? route.name?.toString() ?? '')

watch(
  [activeKey, workspace],
  ([key, currentWorkspace]) => {
    if (currentWorkspace !== 'streamer') return
    if (key && streamerItemMap.value.has(key)) {
      recordRecent(key)
    }
  },
  { immediate: true },
)

const baseItems = computed<ManageNavItem[]>(() => {
  if (workspace.value === 'user') return userItems
  return streamerItems.value.filter((item) => !item.hideInSiderList)
})

type ManageNavGroup = {
  key: ManageNavGroupKey
  label: string
  items: ManageNavItem[]
  hint?: string
}

const groups = computed<ManageNavGroup[]>(() => {
  const items = baseItems.value
  if (workspace.value === 'user') {
    const userGroups: ManageNavGroup[] = [
      { key: 'group-user-assets', label: '资产与订单', items: items.filter((i) => i.group === 'user-assets') },
      { key: 'group-user-activity', label: '我的互动', items: items.filter((i) => i.group === 'user-activity') },
      { key: 'group-user-account', label: '账号', items: items.filter((i) => i.group === 'user-account') },
    ]
    return userGroups.filter((g) => g.items.length > 0)
  }
  const map = new Map(items.map((i) => [i.key, i]))

  const favorites = (favoriteMenuItems.value ?? []).map((k) => map.get(k)).filter(Boolean) as ManageNavItem[]

  const notFav = (i: ManageNavItem) => !isFavorite(i.key)
  const next: ManageNavGroup[] = []

  if (favorites.length) next.push({ key: 'group-favorites', label: '我的收藏', items: favorites })

  const commonItems = items.filter((i) => i.group === 'common' && notFav(i))
  if (commonItems.length) next.push({ key: 'group-common', label: '常用', items: commonItems })

  const dataItems = items.filter((i) => i.group === 'data' && notFav(i))
  if (dataItems.length) next.push({ key: 'group-data', label: '数据', items: dataItems })

  const toolsItems = items.filter((i) => i.group === 'tools' && notFav(i))
  if (toolsItems.length) next.push({ key: 'group-tools', label: '互动与工具', items: toolsItems })

  const danmakuItems = items.filter((i) => i.group === 'danmaku' && notFav(i))
  if (danmakuItems.length) {
    next.push({
      key: 'group-danmaku',
      label: '弹幕相关',
      items: danmakuItems,
      hint: isBiliVerified.value ? '需要使用直播弹幕的功能' : '你尚未进行 Bilibili 认证, 请前往面板进行绑定',
    })
  }

  return next
})

function isUserGroupKey(key: ManageNavGroupKey) {
  return key === 'group-user' || key.startsWith('group-user-')
}

function isGroupExpanded(key: ManageNavGroupKey) {
  return isUserGroupKey(key) || (expandedGroups.value ?? []).includes(key)
}

function toggleGroup(key: ManageNavGroupKey) {
  const list = expandedGroups.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) expandedGroups.value = [...list, key]
  else {
    list.splice(idx, 1)
    expandedGroups.value = [...list]
  }
}

watchEffect(() => {
  const allowed: ManageNavGroupKey[] = [
    'group-favorites',
    'group-user',
    'group-common',
    'group-data',
    'group-tools',
    'group-danmaku',
  ]
  const list = Array.isArray(expandedGroups.value) ? expandedGroups.value : []
  const next = list.filter((k): k is ManageNavGroupKey => allowed.includes(k as any))
  if (next.length === 0) next.push(...allowed)
  if (next.join('|') !== list.join('|')) expandedGroups.value = next
})

function onClickNavItem(ev: MouseEvent, item: ManageNavItem) {
  if (item.disabled) {
    ev.preventDefault()
    ev.stopPropagation()
    return
  }
  if (workspace.value === 'streamer') {
    recordRecent(item.key)
  }
  mobileSiderOpen.value = false
}

function onClickDisabledItem(item: ManageNavItem) {
  const reason = item.disabledReason || '当前无法使用此功能'
  message.warning(reason)
  mobileSiderOpen.value = false
  if (!isBiliVerified.value) {
    void router.push({ name: 'manage-index', query: { tab: 'info' } })
  }
}

async function go(name: string, query?: Record<string, string>) {
  if (workspace.value === 'streamer' && streamerItemMap.value.has(name)) {
    recordRecent(name)
  }
  mobileSiderOpen.value = false
  await router.push({ name, query })
}
</script>

<template>
  <DefineSiderBody>
    <div class="py-[9px] px-3 pb-1.5 flex flex-col gap-1.5">
      <WorkspaceSwitch
        block
        :collapsed="collapsed"
      />

      <DropdownMenu v-if="workspace === 'user' && biliAuth.biliAuth.id && !biliAuth.usesAccountIdentity">
        <DropdownMenuTrigger as-child>
          <Button
            variant="secondary"
            class="h-[34px] w-full flex items-center justify-start gap-2 px-2"
            :class="{ 'justify-center p-0 w-8.5': collapsed }"
          >
            <img
              v-if="biliAuth.biliAuth.avatar"
              :src="biliAuth.biliAuth.avatar"
              class="size-5 rounded-full object-cover shrink-0"
              alt="avatar"
            />
            <span
              v-if="!collapsed"
              class="truncate text-xs font-normal"
              >{{ biliAuth.biliAuth.name }}</span
            >
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          class="w-48"
        >
          <DropdownMenuItem
            v-for="account in biliAuth.biliTokens"
            :key="account.id"
            :disabled="account.id === biliAuth.biliAuth.id"
            @click="switchBiliAccount(String(account.id))"
          >
            {{ account.name || `UID ${account.uId}` }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="switchBiliAccount('add')"> 认证其他账号 </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        v-else-if="workspace === 'user' && biliAuth.biliAuth.id"
        variant="secondary"
        class="h-[34px] w-full flex items-center justify-start gap-2 px-2"
        :class="{ 'justify-center p-0 w-8.5': collapsed }"
      >
        <img
          v-if="biliAuth.biliAuth.avatar"
          :src="biliAuth.biliAuth.avatar"
          class="size-5 rounded-full object-cover shrink-0"
          alt="avatar"
        />
        <span
          v-if="!collapsed"
          class="truncate text-xs font-normal"
          >{{ biliAuth.biliAuth.name }}</span
        >
      </Button>

      <template v-if="workspace === 'streamer'">
        <div
          class="flex items-center gap-1.5"
          :class="{ 'justify-center': collapsed }"
        >
          <Button
            variant="secondary"
            class="h-[34px]"
            :class="{
              'w-8.5 p-0 justify-center flex-none': collapsed,
              'flex-1 justify-start px-2.5 gap-2.5': !collapsed,
            }"
            :aria-label="collapsed ? '面板' : undefined"
            @click="go('manage-index')"
          >
            <component
              :is="GridOutline"
              class="size-[18px] shrink-0"
            />
            <span
              v-if="!collapsed"
              class="text-xs font-normal whitespace-nowrap"
              >面板</span
            >
          </Button>

          <Button
            v-if="!collapsed"
            size="icon-sm"
            variant="ghost"
            class="h-[34px] w-8.5"
            aria-label="反馈"
            @click="go('manage-feedback')"
          >
            <component
              :is="PersonFeedback24Filled"
              class="size-[18px] shrink-0"
            />
          </Button>
        </div>

        <div
          class="flex items-center gap-1.5"
          :class="{ 'justify-center': collapsed }"
        >
          <Button
            variant="brand"
            class="h-[34px]"
            :class="{
              'w-8.5 p-0 justify-center flex-none': collapsed,
              'flex-1 justify-start px-2.5 gap-2.5': !collapsed,
            }"
            :aria-label="collapsed ? '主页装修' : undefined"
            @click="go('manage-userPageBuilder')"
          >
            <component
              :is="ColorPaletteOutline"
              class="size-[18px] shrink-0"
            />
            <span
              v-if="!collapsed"
              class="text-xs font-normal whitespace-nowrap"
              >主页装修</span
            >
          </Button>

          <Button
            v-if="!collapsed"
            size="icon-sm"
            variant="ghost"
            class="h-[34px] w-8.5"
            aria-label="更换主页背景与主题"
            @click="go('manage-userPageBuilder', { action: 'theme' })"
          >
            <component
              :is="ImageOutline"
              class="size-[18px] shrink-0"
            />
          </Button>
        </div>
      </template>
    </div>

    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scrollbar-thin">
      <nav
        class="py-1 px-2 pb-2.5"
        :class="{ 'px-1.5': collapsed }"
      >
        <template
          v-for="(g, gi) in groups"
          :key="g.key"
        >
          <div class="py-1.5">
            <div
              v-if="collapsed && gi > 0"
              class="h-px mx-5 my-1 bg-gradient-to-r from-transparent via-[rgba(127,127,127,0.18)] to-transparent"
            />
            <div
              v-if="!collapsed"
              class="flex-between gap-1.5 pt-0.5 px-1 pb-1.5"
            >
              <Button
                variant="ghost"
                size="xs"
                class="h-auto p-0 text-muted-foreground text-[11px] tracking-wider uppercase"
                :disabled="isUserGroupKey(g.key)"
                @click="toggleGroup(g.key)"
              >
                <span class="nav-group__label">{{ g.label }}</span>
                <span
                  v-if="!isUserGroupKey(g.key)"
                  class="inline-block opacity-80 transition-transform duration-150"
                  :class="isGroupExpanded(g.key) ? '-rotate-90' : 'rotate-90'"
                  >›</span
                >
              </Button>

              <Tooltip v-if="g.key === 'group-danmaku'">
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="可用性警告"
                  >
                    <component
                      :is="Info24Filled"
                      class="size-3.5"
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  class="max-w-xs p-3"
                >
                  <div class="font-medium text-destructive mb-1">可用性警告</div>
                  <div class="text-[11px] text-muted-foreground space-y-1">
                    <div>
                      当浏览器在后台运行时，定时器和 WebSocket 连接将受到严格限制，可能导致弹幕接收功能无法正常工作。
                    </div>
                    <div>建议尽量保持网页在前台运行，并关闭浏览器的“页面休眠/内存节省”功能。</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>

            <div
              v-show="collapsed || isUserGroupKey(g.key) || isGroupExpanded(g.key)"
              class="flex flex-col gap-0.5"
            >
              <div
                v-for="item in g.items"
                :key="item.key"
                class="group/row"
              >
                <Tooltip :disabled="!collapsed">
                  <TooltipTrigger as-child>
                    <RouterLink
                      v-if="!item.disabled && item.to"
                      :to="item.to"
                      class="h-[34px] rounded-[10px] px-2.5 flex items-center gap-2.5 no-underline text-foreground border transition-colors box-border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(127,127,127,0.28)] focus-visible:outline-offset-2"
                      :class="[
                        activeKey === item.key
                          ? 'bg-[rgba(127,127,127,0.12)] border-[rgba(127,127,127,0.18)]'
                          : 'bg-transparent border-transparent hover:bg-[rgba(127,127,127,0.08)]',
                        { 'p-0 justify-center': collapsed },
                      ]"
                      :aria-current="activeKey === item.key ? 'page' : undefined"
                      @click="(ev: any) => onClickNavItem(ev, item)"
                    >
                      <component
                        :is="item.icon"
                        class="size-[18px] shrink-0"
                      />
                      <span
                        v-if="!collapsed"
                        class="text-xs font-normal whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0"
                        >{{ item.label }}</span
                      >

                      <Button
                        v-if="!collapsed"
                        variant="ghost"
                        size="icon-xs"
                        class="opacity-50 group-hover/row:opacity-100"
                        :class="{
                          'opacity-100 bg-amber-500/25 border border-amber-500/60 shadow-[0_0_0_1px_rgba(245,158,11,0.26)]':
                            isFavorite(item.key),
                        }"
                        :aria-label="isFavorite(item.key) ? '取消收藏' : '收藏'"
                        @click.stop.prevent="toggleFavorite(item.key)"
                      >
                        <component
                          :is="Bookmark"
                          class="nav-item__fav-icon size-3 transition-colors"
                          :class="
                            isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'
                          "
                        />
                      </Button>
                    </RouterLink>

                    <div
                      v-else
                      class="h-[34px] rounded-[10px] px-2.5 flex items-center gap-2.5 text-foreground border border-transparent bg-transparent box-border opacity-50 cursor-pointer hover:bg-[rgba(127,127,127,0.08)] hover:opacity-70"
                      :class="{ 'p-0 justify-center': collapsed }"
                      role="button"
                      @click="onClickDisabledItem(item)"
                    >
                      <component
                        :is="item.icon"
                        class="size-[18px] shrink-0"
                      />
                      <span
                        v-if="!collapsed"
                        class="text-xs font-normal whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0"
                        >{{ item.label }}</span
                      >
                      <Button
                        v-if="!collapsed"
                        variant="ghost"
                        size="icon-xs"
                        class="opacity-50 group-hover/row:opacity-100"
                        :class="{
                          'opacity-100 bg-amber-500/25 border border-amber-500/60 shadow-[0_0_0_1px_rgba(245,158,11,0.26)]':
                            isFavorite(item.key),
                        }"
                        :aria-label="isFavorite(item.key) ? '取消收藏' : '收藏'"
                        @click.stop.prevent="toggleFavorite(item.key)"
                      >
                        <component
                          :is="isFavorite(item.key) ? Bookmark : BookmarkOutline"
                          class="nav-item__fav-icon size-3 transition-colors"
                          :class="
                            isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'
                          "
                        />
                      </Button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {{ item.disabled ? item.disabledReason || item.label : item.label }}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </template>
      </nav>
    </div>

    <div
      class="border-t border-border py-2 flex flex-col gap-2"
      :class="collapsed ? 'items-center px-1.5' : 'px-2.5'"
    >
      <Tooltip :disabled="!collapsed">
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            :size="collapsed ? 'icon-sm' : 'sm'"
            :class="collapsed ? 'justify-center' : 'w-full justify-between px-2.5'"
            :aria-label="collapsed ? '桌面客户端' : undefined"
            @click="go('client-download')"
          >
            <span class="flex items-center gap-2 min-w-0">
              <Monitor class="size-3.5 shrink-0 text-brand" />
              <span
                v-if="!collapsed"
                class="truncate"
              >
                桌面客户端
              </span>
            </span>
            <Download
              v-if="!collapsed"
              class="size-3.5 shrink-0 text-muted-foreground"
            />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right">
          下载桌面客户端
        </TooltipContent>
      </Tooltip>

      <div
        v-if="!collapsed"
        class="flex items-center justify-around px-1 text-[11px] text-muted-foreground"
      >
        <button
          type="button"
          class="transition-colors hover:text-foreground cursor-pointer"
          @click="go('docs-index')"
        >
          使用文档
        </button>
        <button
          type="button"
          class="transition-colors hover:text-foreground cursor-pointer"
          @click="go('manage-feedback')"
        >
          反馈
        </button>
        <button
          type="button"
          class="transition-colors hover:text-foreground cursor-pointer"
          @click="go('about')"
        >
          关于
        </button>
      </div>
    </div>
  </DefineSiderBody>

  <Sheet
    v-if="isMobileSider"
    v-model:open="mobileSiderOpen"
  >
    <SheetContent
      side="left"
      class="w-[240px] p-0 flex flex-col gap-0 overflow-hidden bg-card"
    >
      <ReuseSiderBody />
    </SheetContent>
  </Sheet>

  <aside
    v-else
    class="h-full border-r border-border bg-card box-border flex flex-col overflow-hidden transition-[width] duration-200"
    :class="{ collapsed }"
    :style="{ width: collapsed ? `${siderCollapsedWidth}px` : `${siderWidth}px` }"
  >
    <ReuseSiderBody />
  </aside>
</template>
