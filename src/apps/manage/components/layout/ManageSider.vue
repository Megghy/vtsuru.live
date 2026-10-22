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
    class="manage-sider"
    :class="{ collapsed }"
    :style="{ width: collapsed ? `${siderCollapsedWidth}px` : `${siderWidth}px` }"
  >
    <div class="manage-sider__top">
      <WorkspaceSwitch
        block
        :collapsed="collapsed"
      />

      <DropdownMenu v-if="workspace === 'user' && biliAuth.biliAuth.id && !biliAuth.usesAccountIdentity">
        <DropdownMenuTrigger as-child>
          <Button variant="secondary" class=".5 w-full flex items-center justify-start gap-2 px-2" :class="{ 'justify-center p-0 w-8.5': collapsed }">
            <img
              v-if="biliAuth.biliAuth.avatar"
              :src="biliAuth.biliAuth.avatar"
              class="size-5 rounded-full object-cover shrink-0"
              alt="avatar"
            />
            <span
              v-if="!collapsed"
              class="truncate text-xs font-normal"
            >{{ biliAuth.biliAuth.name }}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-48">
          <DropdownMenuItem
            v-for="account in biliAuth.biliTokens"
            :key="account.id"
            :disabled="account.id === biliAuth.biliAuth.id"
            @click="switchBiliAccount(String(account.id))"
          >
            {{ account.name || `UID ${account.uId}` }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="switchBiliAccount('add')">
            认证其他账号
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button v-else-if="workspace === 'user' && biliAuth.biliAuth.id" variant="secondary" class=".5 w-full flex items-center justify-start gap-2 px-2" :class="{ 'justify-center p-0 w-8.5': collapsed }">
        <img
          v-if="biliAuth.biliAuth.avatar"
          :src="biliAuth.biliAuth.avatar"
          class="size-5 rounded-full object-cover shrink-0"
          alt="avatar"
        />
        <span
          v-if="!collapsed"
          class="truncate text-xs font-normal"
        >{{ biliAuth.biliAuth.name }}</span>
      </Button>

      <template v-if="workspace === 'streamer'">
        <div class="manage-sider__top-row">
          <Button variant="secondary" class="sider-top-btn sider-top-btn--panel .5" :class="{ 'w-8.5 p-0 justify-center flex-none': collapsed, 'flex-1 justify-start px-2.5 gap-2.5': !collapsed }" :title="collapsed ? '面板' : undefined" @click="go('manage-index')">
            <component
              :is="GridOutline"
              class="sider-icon"
            />
            <span
              v-if="!collapsed"
              class="sider-top-label"
            >面板</span>
          </Button>

          <Button v-if="!collapsed" size="icon-sm" variant="ghost" class="sider-top-icon-btn .5 w-8.5" title="反馈" @click="go('manage-feedback')">
            <component
              :is="PersonFeedback24Filled"
              class="sider-icon"
            />
          </Button>
        </div>

        <div class="manage-sider__top-row sider-top-row--builder">
          <Button variant="brand" class="sider-top-btn sider-top-btn--panel .5" :class="{ 'w-8.5 p-0 justify-center flex-none': collapsed, 'flex-1 justify-start px-2.5 gap-2.5': !collapsed }" :title="collapsed ? '主页装修' : undefined" @click="go('manage-userPageBuilder')">
            <component
              :is="ColorPaletteOutline"
              class="sider-icon"
            />
            <span
              v-if="!collapsed"
              class="sider-btn-label"
            >主页装修</span>
          </Button>

          <Button v-if="!collapsed" size="icon-sm" variant="ghost" class="sider-top-icon-btn .5 w-8.5" title="更换主页背景与主题" @click="go('manage-userPageBuilder', { action: 'theme' })">
            <component
              :is="ImageOutline"
              class="sider-icon"
            />
          </Button>
        </div>
      </template>
    </div>

    <div class="manage-sider__nav overflow-y-auto">
      <nav
        class="manage-sider__nav-inner"
        :class="{ collapsed }"
      >
        <template
          v-for="g in groups"
          :key="g.key"
        >
          <div class="nav-group">
            <div
              v-if="!collapsed"
              class="nav-group__header"
            >
              <button
                class="nav-group__toggle"
                type="button"
                :disabled="g.key === 'group-user'"
                @click="toggleGroup(g.key)"
              >
                <span class="nav-group__label">{{ g.label }}</span>
                <span
                  v-if="g.key !== 'group-user'"
                  class="nav-group__chev"
                  :class="{ open: isGroupExpanded(g.key) }"
                  >›</span
                >
              </button>

              <TooltipProvider v-if="g.key === 'group-danmaku'">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <button
                      class="nav-group__info"
                      type="button"
                      :title="g.hint || '提示'"
                    >
                      <component
                        :is="Info24Filled"
                        class="nav-group__info-icon"
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" class="max-w-xs text-xs p-3">
                    <div class="font-medium text-destructive mb-1">可用性警告</div>
                    <div class="text-[11px] text-muted-foreground space-y-1">
                      <div>当浏览器在后台运行时，定时器和 WebSocket 连接将受到严格限制，可能导致弹幕接收功能无法正常工作。</div>
                      <div>建议尽量保持网页在前台运行，并关闭浏览器的“页面休眠/内存节省”功能。</div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div
              v-show="collapsed || g.key === 'group-user' || isGroupExpanded(g.key)"
              class="nav-group__items"
            >
              <div
                v-for="item in g.items"
                :key="item.key"
                class="nav-item-row"
              >
                <RouterLink
                  v-if="!item.disabled && item.to"
                  :to="item.to"
                  class="nav-item"
                  :class="{ active: activeKey === item.key }"
                  :title="collapsed ? item.label : undefined"
                  @click="(ev: any) => onClickNavItem(ev, item)"
                >
                  <component
                    :is="item.icon"
                    class="nav-item__icon"
                  />
                  <span
                    v-if="!collapsed"
                    class="nav-item__label"
                    >{{ item.label }}</span
                  >

                  <button
                    v-if="!collapsed"
                    class="nav-item__fav"
                    :class="{ active: isFavorite(item.key) }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <component
                      :is="Bookmark"
                      class="nav-item__fav-icon w-3 h-3 transition-colors"
                      :class="isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'"
                    />
                  </button>
                </RouterLink>

                <div
                  v-else
                  class="nav-item nav-item--disabled"
                  :title="item.disabledReason || item.label"
                  role="button"
                  @click="onClickDisabledItem(item)"
                >
                  <component
                    :is="item.icon"
                    class="nav-item__icon"
                  />
                  <span
                    v-if="!collapsed"
                    class="nav-item__label"
                    >{{ item.label }}</span
                  >
                  <button
                    v-if="!collapsed"
                    class="nav-item__fav"
                    :class="{ active: isFavorite(item.key) }"
                    type="button"
                    :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
                    @click.stop.prevent="toggleFavorite(item.key)"
                  >
                    <component
                      :is="isFavorite(item.key) ? Bookmark : BookmarkOutline"
                      class="nav-item__fav-icon w-3 h-3 transition-colors"
                      :class="isFavorite(item.key) ? 'text-amber-500' : 'text-muted-foreground/60 hover:text-foreground'"
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
      class="manage-sider__footer"
    >
      <div class="footer-line">
        有更多功能建议请
        <button
          type="button"
          class="text-xs text-brand hover:underline cursor-pointer bg-transparent border-0 p-0 font-medium"
          @click="go('manage-feedback')"
        >
          反馈
        </button>
      </div>
      <div class="footer-line">
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

<style scoped>
.manage-sider {
  height: 100%;
  border-right: 1px solid var(--border);
  background: var(--card);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 180ms var(--vtsuru-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

.manage-sider__top {
  padding: 9px 12px 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.identity-button {
  justify-content: flex-start;
}

.identity-button__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 20px;
}

.manage-sider__top-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.manage-sider.collapsed .manage-sider__top-row {
  justify-content: center;
}

.sider-top-btn {
  height: 34px;
  justify-content: flex-start;
}

.sider-top-btn--panel {
  flex: 1;
  min-width: 0;
}

.manage-sider.collapsed .sider-top-btn--panel {
  flex: 0 0 auto;
}

.sider-top-icon-btn {
  height: 34px;
  width: 34px;
  flex: 0 0 auto;
}

.manage-sider.collapsed .sider-top-icon-btn {
  height: 32px;
  width: 32px;
}

.manage-sider.collapsed .sider-top-btn {
  height: 32px;
  width: 32px;
  padding: 0;
  justify-content: center;
  margin: 0 auto;
}

.sider-icon {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}

.sider-top-label,
.sider-btn-label {
  font-size: 12px;
  font-weight: 400;
  white-space: nowrap;
}

.manage-sider__nav {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.manage-sider__nav-inner {
  padding: 4px 8px 10px;
  transition: padding 180ms var(--vtsuru-bezier, cubic-bezier(0.4, 0, 0.2, 1));
}

.manage-sider__nav-inner.collapsed {
  padding: 4px 6px 10px;
}

.nav-group {
  padding: 6px 0;
}

.manage-sider.collapsed .nav-group + .nav-group::before {
  content: '';
  display: block;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(127, 127, 127, 0.18), transparent);
  margin: 5px 20px 3px;
  border-radius: 1px;
}

.nav-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 2px 4px 6px;
}

.nav-group__toggle {
  border: none;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 11px;
  font-weight: 400;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 2px 0;
}

.nav-group__chev {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 120ms ease;
  opacity: 0.8;
}

.nav-group__chev.open {
  transform: rotate(270deg);
}

.nav-group__info {
  height: 22px;
  width: 22px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--muted-foreground);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.nav-group__info:hover {
  background: rgba(127, 127, 127, 0.08);
}

.nav-group__info-icon {
  width: 14px;
  height: 14px;
}

.danmaku-tooltip {
  width: 320px;
  max-width: min(360px, 70vw);
  padding: 10px 10px;
  border-radius: 12px;
}

.danmaku-tooltip__title {
  font-size: 12px;
  font-weight: 800;
  margin-bottom: 6px;
}

.danmaku-tooltip__body {
  font-size: 12px;
  line-height: 1.55;
  color: var(--foreground);
}

.danmaku-tooltip__body a {
  color: var(--primary);
  text-decoration: none;
}

.danmaku-tooltip__body a:hover {
  text-decoration: underline;
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
  color: var(--foreground);
  border: 1px solid transparent;
  background: transparent;
  transition:
    background-color 120ms ease,
    border-color 120ms ease;
  box-sizing: border-box;
}

.manage-sider.collapsed .nav-item {
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
  cursor: pointer;
}

.nav-item--disabled:hover {
  background: rgba(127, 127, 127, 0.08);
  opacity: 0.72;
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

.nav-item__fav {
  height: 22px;
  width: 22px;
  border-radius: 7px;
  border: 1px solid rgba(127, 127, 127, 0.541);
  background: rgba(127, 127, 127, 0.04);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0.5;
  transition:
    opacity 120ms ease,
    background-color 120ms ease,
    border-color 120ms ease;
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
  color: var(--muted-foreground);
  transition: color 120ms ease;
}

.nav-item__fav-icon.active {
  color: var(--vtsuru-warning);
}

.nav-item__fav.active .nav-item__fav-icon {
  color: rgb(245, 158, 11);
  filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.28));
}

.manage-sider__footer {
  border-top: 1px solid var(--border);
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.footer-line {
  font-size: 12px;
  color: var(--muted-foreground);
  text-align: center;
}
</style>
