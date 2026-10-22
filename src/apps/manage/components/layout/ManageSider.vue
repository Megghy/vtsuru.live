<script setup lang="ts">
import {
  BookCoins20Filled,
  CalendarClock24Filled,
  Info24Filled,
  Live24Filled,
  Lottery24Filled,
  PeopleQueue24Filled,
  History24Regular,
  Receipt24Regular,
  Settings24Regular,
  PersonFeedback24Filled,
  StoreMicrosoft24Regular,
  Board24Regular,
  Bot24Regular,
  TabletSpeaker24Filled,
  VehicleShip24Filled,
  VideoAdd20Filled,
} from '@vicons/fluent'
import {
  AnalyticsSharp,
  Bookmark,
  BookmarkOutline,
  Chatbox,
  ChatbubbleEllipsesOutline,
  ColorPaletteOutline,
  DocumentTextOutline,
  Eye,
  GridOutline,
  ImageOutline,
  MusicalNote,
  MusicalNotesOutline,
  PlayCircleOutline,
  StatsChartOutline,
} from '@vicons/ionicons5'
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import type { AccountInfo } from '@/api/api-models'
import WorkspaceSwitch from '@/apps/manage/components/layout/WorkspaceSwitch.vue'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  accountInfo: AccountInfo
}>()

type ManageNavGroupId = 'favorites' | 'user' | 'common' | 'data' | 'tools' | 'danmaku'
type ManageNavGroupKey = `group-${ManageNavGroupId}`

type ManageNavItem = {
  key: string
  label: string
  icon: any
  to?: { name: string }
  disabled?: boolean
  disabledReason?: string
  group: Exclude<ManageNavGroupId, 'favorites'>
}

const message = useMessage()
const route = useRoute()
const router = useRouter()
const biliAuth = useBiliAuth()
const { workspace } = useManageWorkspace()

const defaultCollapsed = window.innerWidth < 750
const collapsed = usePersistedStorage<boolean>('Settings.ManageSiderCollapsed', defaultCollapsed)
const siderWidth = 180
const siderCollapsedWidth = 56

const expandedGroups = usePersistedStorage<string[]>('Settings.ManageSiderExpandedGroups', [
  'group-favorites',
  'group-common',
  'group-data',
  'group-tools',
  'group-danmaku',
])

const favoriteMenuItems = usePersistedStorage<string[]>('Settings.FavoriteMenuItems', [])
const isFavorite = (key: string) => (favoriteMenuItems.value ?? []).includes(key)
function toggleFavorite(key: string) {
  const list = favoriteMenuItems.value ?? []
  const idx = list.indexOf(key)
  if (idx === -1) list.unshift(key)
  else list.splice(idx, 1)
  favoriteMenuItems.value = [...list]
}

const isBiliVerified = computed(() => !!props.accountInfo?.isBiliVerified)
const needsEmailVerified = computed(() => props.accountInfo?.isEmailVerified === false)
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

const baseItems = computed<ManageNavItem[]>(() => {
  if (workspace.value === 'user') {
    return [
      {
        key: 'bili-user-points',
        label: '我的积分',
        icon: BookCoins20Filled,
        to: { name: 'bili-user-points' },
        group: 'user',
      },
      {
        key: 'bili-user-orders',
        label: '我的订单',
        icon: Receipt24Regular,
        to: { name: 'bili-user-orders' },
        group: 'user',
      },
      {
        key: 'bili-user-history',
        label: '积分记录',
        icon: History24Regular,
        to: { name: 'bili-user-history' },
        group: 'user',
      },
      {
        key: 'bili-user-settings',
        label: '账户设置',
        icon: Settings24Regular,
        to: { name: 'bili-user-settings' },
        group: 'user',
      },
    ]
  }
  const emailDisabled = needsEmailVerified.value
  const biliDisabled = !isBiliVerified.value
  const biliReason = biliDisabled ? '需要完成 Bilibili 认证后才能使用' : undefined

  return [
    {
      key: 'manage-history',
      label: '历史',
      icon: AnalyticsSharp,
      to: { name: 'manage-history' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'manage-live',
      label: '直播记录',
      icon: Live24Filled,
      to: { name: 'manage-live' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'manage-analyze',
      label: '直播数据',
      icon: Eye,
      to: { name: 'manage-analyze' },
      disabled: emailDisabled,
      group: 'common',
    },
    {
      key: 'org-index',
      label: '组织',
      icon: PeopleQueue24Filled,
      to: { name: 'org-index' },
      disabled: emailDisabled,
      group: 'common',
    },

    {
      key: 'manage-event',
      label: '舰长和SC',
      icon: VehicleShip24Filled,
      to: { name: 'manage-event' },
      disabled: emailDisabled,
      group: 'data',
    },
    {
      key: 'manage-point',
      label: '积分和礼物',
      icon: BookCoins20Filled,
      to: { name: 'manage-point' },
      disabled: emailDisabled,
      group: 'data',
    },

    {
      key: 'manage-schedule',
      label: '日程',
      icon: CalendarClock24Filled,
      to: { name: 'manage-schedule' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-songList',
      label: '歌单',
      icon: MusicalNote,
      to: { name: 'manage-songList' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-questionBox',
      label: '棉花糖 (提问箱)',
      icon: Chatbox,
      to: { name: 'manage-questionBox' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-videoCollect',
      label: '视频征集',
      icon: VideoAdd20Filled,
      to: { name: 'manage-videoCollect' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-lottery',
      label: '动态抽奖',
      icon: Lottery24Filled,
      to: { name: 'manage-lottery' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-tools-dashboard',
      label: '工具箱',
      icon: GridOutline,
      to: { name: 'manage-tools-dashboard' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-obsStore',
      label: 'OBS 组件库',
      icon: StoreMicrosoft24Regular,
      to: { name: 'manage-obsStore' },
      disabled: emailDisabled,
      group: 'tools',
    },
    {
      key: 'manage-qqBot',
      label: 'QQ 群机器人',
      icon: Bot24Regular,
      to: { name: 'manage-qqBot' },
      disabled: emailDisabled,
      group: 'tools',
    },

    {
      key: 'live-dashboard',
      label: '中控台',
      icon: Board24Regular,
      to: { name: 'live-dashboard' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-danmuji',
      label: '弹幕机',
      icon: ChatbubbleEllipsesOutline,
      to: { name: 'manage-danmuji' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveRequest',
      label: '点播',
      icon: PlayCircleOutline,
      to: { name: 'manage-liveRequest' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveLottery',
      label: '弹幕抽奖',
      icon: Lottery24Filled,
      to: { name: 'manage-liveLottery' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-musicRequest',
      label: '点歌机',
      icon: MusicalNotesOutline,
      to: { name: 'manage-musicRequest' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-liveQueue',
      label: '排队',
      icon: PeopleQueue24Filled,
      to: { name: 'manage-liveQueue' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-speech',
      label: '读弹幕',
      icon: TabletSpeaker24Filled,
      to: { name: 'manage-speech' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
    {
      key: 'manage-danmakuVote',
      label: '弹幕投票',
      icon: StatsChartOutline,
      to: { name: 'manage-danmakuVote' },
      disabled: biliDisabled,
      disabledReason: biliReason,
      group: 'danmaku',
    },
  ]
})

type ManageNavGroup = {
  key: ManageNavGroupKey
  label: string
  items: ManageNavItem[]
  hint?: string
}

const groups = computed<ManageNavGroup[]>(() => {
  const items = baseItems.value
  if (workspace.value === 'user') return [{ key: 'group-user', label: '账户', items }]
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

function isGroupExpanded(key: ManageNavGroupKey) {
  return (expandedGroups.value ?? []).includes(key)
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
  }
}

function onClickDisabledItem(item: ManageNavItem) {
  const reason = item.disabledReason || '当前无法使用此功能'
  message.warning(reason)
  if (!isBiliVerified.value) {
    void router.push({ name: 'manage-index', query: { tab: 'info' } })
  }
}

async function go(name: string, query?: Record<string, string>) {
  await router.push({ name, query })
}
</script>

<template>
  <aside
    class="h-full border-r border-border bg-card box-border flex flex-col overflow-hidden transition-[width] duration-200"
    :class="{ collapsed }"
    :style="{ width: collapsed ? `${siderCollapsedWidth}px` : `${siderWidth}px` }"
  >
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
        <div class="flex items-center gap-1.5" :class="{ 'justify-center': collapsed }">
          <Button
            variant="secondary"
            class="h-[34px]"
            :class="{
              'w-8.5 p-0 justify-center flex-none': collapsed,
              'flex-1 justify-start px-2.5 gap-2.5': !collapsed,
            }"
            :title="collapsed ? '面板' : undefined"
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
            title="反馈"
            @click="go('manage-feedback')"
          >
            <component
              :is="PersonFeedback24Filled"
              class="size-[18px] shrink-0"
            />
          </Button>
        </div>

        <div class="flex items-center gap-1.5" :class="{ 'justify-center': collapsed }">
          <Button
            variant="brand"
            class="h-[34px]"
            :class="{
              'w-8.5 p-0 justify-center flex-none': collapsed,
              'flex-1 justify-start px-2.5 gap-2.5': !collapsed,
            }"
            :title="collapsed ? '主页装修' : undefined"
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
            title="更换主页背景与主题"
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
              <button
                class="border-0 bg-transparent text-muted-foreground text-[11px] font-normal tracking-wider uppercase inline-flex items-center gap-1.5 cursor-pointer py-0.5 px-0"
                type="button"
                :disabled="g.key === 'group-user'"
                @click="toggleGroup(g.key)"
              >
                <span class="nav-group__label">{{ g.label }}</span>
                <span
                  v-if="g.key !== 'group-user'"
                  class="inline-block opacity-80 transition-transform duration-150"
                  :class="isGroupExpanded(g.key) ? '-rotate-90' : 'rotate-90'"
                  >›</span
                >
              </button>

              <TooltipProvider v-if="g.key === 'group-danmaku'">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      class="size-[22px] rounded-[7px] border border-border bg-transparent text-muted-foreground inline-flex-center cursor-pointer hover:bg-[rgba(127,127,127,0.08)]"
                      type="button"
                      :title="g.hint || '提示'"
                    >
                      <component
                        :is="Info24Filled"
                        class="size-3.5"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="right"
                    class="max-w-xs text-xs p-3"
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
              </TooltipProvider>
            </div>

            <div
              v-show="collapsed || g.key === 'group-user' || isGroupExpanded(g.key)"
              class="flex flex-col gap-0.5"
            >
              <div
                v-for="item in g.items"
                :key="item.key"
                class="group/row"
              >
                <RouterLink
                  v-if="!item.disabled && item.to"
                  :to="item.to"
                  class="h-[34px] rounded-[10px] px-2.5 flex items-center gap-2.5 no-underline text-foreground border border-transparent bg-transparent transition-colors box-border hover:bg-[rgba(127,127,127,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[rgba(127,127,127,0.28)] focus-visible:outline-offset-2"
                  :class="{
                    'bg-[rgba(127,127,127,0.12)] border-[rgba(127,127,127,0.18)]': activeKey === item.key,
                    'p-0 justify-center': collapsed,
                  }"
                  :title="collapsed ? item.label : undefined"
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

                  <button
                    v-if="!collapsed"
                    class="size-[22px] rounded-[7px] border border-[rgba(127,127,127,0.54)] bg-[rgba(127,127,127,0.04)] inline-flex-center cursor-pointer opacity-50 transition-opacity group-hover/row:opacity-100 group-hover/row:bg-[rgba(127,127,127,0.08)]"
                    :class="{
                      'opacity-100 bg-amber-500/25 border-amber-500/60 shadow-[0_0_0_1px_rgba(245,158,11,0.26)]':
                        isFavorite(item.key),
                    }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <component
                      :is="Bookmark"
                      class="nav-item__fav-icon w-3 h-3 transition-colors"
                      :class="
                        isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'
                      "
                    />
                  </button>
                </RouterLink>

                <div
                  v-else
                  class="h-[34px] rounded-[10px] px-2.5 flex items-center gap-2.5 text-foreground border border-transparent bg-transparent box-border opacity-50 cursor-pointer hover:bg-[rgba(127,127,127,0.08)] hover:opacity-70"
                  :class="{ 'p-0 justify-center': collapsed }"
                  :title="item.disabledReason || item.label"
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
                  <button
                    v-if="!collapsed"
                    class="size-[22px] rounded-[7px] border border-[rgba(127,127,127,0.54)] bg-[rgba(127,127,127,0.04)] inline-flex-center cursor-pointer opacity-50 transition-opacity group-hover/row:opacity-100 group-hover/row:bg-[rgba(127,127,127,0.08)]"
                    :class="{
                      'opacity-100 bg-amber-500/25 border-amber-500/60 shadow-[0_0_0_1px_rgba(245,158,11,0.26)]':
                        isFavorite(item.key),
                    }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <component
                      :is="isFavorite(item.key) ? Bookmark : BookmarkOutline"
                      class="nav-item__fav-icon w-3 h-3 transition-colors"
                      :class="
                        isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'
                      "
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </template>
      </nav>
    </div>

    <div
      v-if="!collapsed"
      class="border-t border-border py-2.5 px-3 flex flex-col gap-1.5 items-center"
    >
      <div class="text-xs text-muted-foreground text-center">
        有更多功能建议请
        <button
          type="button"
          class="text-xs text-brand hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
          @click="go('manage-feedback')"
        >
          反馈
        </button>
      </div>
      <div class="text-xs text-muted-foreground text-center">
        <button
          type="button"
          class="text-xs text-brand hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
          @click="go('about')"
        >
          关于本站
        </button>
      </div>
    </div>
  </aside>
</template>
