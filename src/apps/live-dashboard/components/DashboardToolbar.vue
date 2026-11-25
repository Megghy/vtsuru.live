<script setup lang="ts">
import {
  BookmarkPlus,
  Cake,
  Check,
  Clapperboard,
  Ellipsis,
  ExternalLink,
  Eye,
  EyeOff,
  History,
  Keyboard,
  LayoutGrid,
  Moon,
  Radio,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldOff,
  ShoppingBag,
  Sun,
  X,
} from 'lucide-vue-next'
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { CURRENT_HOST, isTauri } from '@/shared/config'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tag } from '@/shared/ui/tag'
import { SimpleTooltip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode } from '@/shared/utils'

import { avatarUrl, formatDuration, formatPrice } from '../core/format'
import { PANEL_META } from '../core/types'
import { DEFAULT_TOOLBAR_ORDER, type ToolbarStatKey } from '../store/settings'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import IconAction from './IconAction.vue'
import LayoutMenu from './LayoutMenu.vue'
import SpeechStatusPill from './SpeechStatusPill.vue'

const ClientLiveQuickControl = defineAsyncComponent(() => import('./ClientLiveQuickControl.vue'))
const ClientAutoActionQuickControl = defineAsyncComponent(() => import('./ClientAutoActionQuickControl.vue'))

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const { privacyMode, togglePrivacyMode } = useFanPrivacy()
const inTauri = isTauri()
const stats = computed(() => dashboard.stats)
const officialStats = computed(() => dashboard.officialStats)
const client = computed(() => dashboard.client)
const searchInputRef = ref<{ focus: () => void } | null>(null)
const searchExpanded = ref(false)
const reconnecting = ref(false)

/** 客户端底部状态栏已展示的统计项，窄宽下默认去重 */
const CLIENT_REDUNDANT_STATS: ReadonlySet<ToolbarStatKey> = new Set([
  'onlineRank',
  'totalLikes',
  'watched',
  'totalRevenue',
])

const activeToolbarKeys = computed({
  get() {
    const order = dashboard.settings.toolbarOrder || DEFAULT_TOOLBAR_ORDER
    const statsConfig = dashboard.settings.toolbarStats
    const dedupe = inTauri && dashboard.settings.hideRedundantClientStats
    return order.filter((key) => statsConfig[key] && (!dedupe || !CLIENT_REDUNDANT_STATS.has(key)))
  },
  set(newActiveKeys: ToolbarStatKey[]) {
    const activeSet = new Set(newActiveKeys)
    const restKeys = (dashboard.settings.toolbarOrder || DEFAULT_TOOLBAR_ORDER).filter((k) => !activeSet.has(k))
    dashboard.settings.toolbarOrder = [...newActiveKeys, ...restKeys]
  },
})

async function expandSearch() {
  searchExpanded.value = true
  await nextTick()
  searchInputRef.value?.focus()
}

function onSearchBlur() {
  if (!dashboard.search) {
    searchExpanded.value = false
  }
}

function clearAndCollapseSearch() {
  dashboard.search = ''
  searchExpanded.value = false
}

function formatStatCount(num: number | null | undefined): string {
  if (!num || num <= 0) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return num.toLocaleString()
}

watch(
  () => ui.searchFocusTick,
  () => void expandSearch(),
)

const statusColor = computed(() => {
  if (client.value.phase === 'connected' || client.value.hasRemoteSource) return 'var(--vtsuru-success)'
  if (client.value.phase === 'error') return 'var(--vtsuru-error)'
  return 'var(--vtsuru-warning)'
})

async function reconnect() {
  reconnecting.value = true
  try {
    await client.value.reconnect()
  } finally {
    reconnecting.value = false
  }
}

const range = computed({
  get: () => dashboard.historyRange,
  set: (value) => void dashboard.setHistoryRange(value),
})

const markerInput = ref('')
const markerSaveReplay = ref(isTauri())

async function submitMarker() {
  await dashboard.addMarker(markerInput.value || '高光时刻', 'manual', undefined, markerSaveReplay.value)
  markerInput.value = ''
}

function formatMarkerClock(ts: number) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

const customStart = ref('')
const customEnd = ref('')

function applyQuickRange(ms: number) {
  range.value = [Date.now() - ms, Date.now()]
}

function applyTodayRange() {
  range.value = [new Date().setHours(0, 0, 0, 0), Date.now()]
}

function applyCustomRange() {
  if (!customStart.value || !customEnd.value) return
  const s = new Date(customStart.value).getTime()
  const e = new Date(customEnd.value).getTime()
  if (!Number.isNaN(s) && !Number.isNaN(e) && e > s) {
    range.value = [s, e]
  }
}

async function openInNewWindow() {
  if (inTauri) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(`${CURRENT_HOST}live-dashboard`)
  } else {
    window.open('/live-dashboard', '_blank', 'noopener,noreferrer')
  }
}

function onStatsWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement | null
  if (!el || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
  el.scrollLeft += e.deltaY
}

const hasMoreMenuActiveState = computed(() => dashboard.settings.hideRead || privacyMode.value)

const visiblePanelCount = computed(() => {
  const layout = dashboard.settings.layout
  return layout.order.filter((id) => !layout.hidden.includes(id) && (inTauri || !PANEL_META[id].clientOnly)).length
})

function openRedeemPanel() {
  const layout = dashboard.settings.layout
  if (layout.hidden.includes('point_redeem')) {
    layout.hidden = layout.hidden.filter((id) => id !== 'point_redeem')
  }
}

const SEARCH_HELP = [
  'type:superchat,gift,toast,message,enter,follow,like',
  'uid:12345  username:名字  message:内容  medal:勋章  note:备注',
  'price:>=30  price:10..50（仅付费事件）',
  '-前缀取反，如 -type:message；多值用逗号；含空格用引号',
]
</script>

<template>
  <header
    class="relative flex items-center gap-1.5 h-10 px-2 border-b border-border bg-card shrink-0 min-w-0 text-sm"
  >
    <div class="flex items-center gap-1 shrink-0">
      <!-- 窄屏未搜索时收敛为图标按钮，点击或 Ctrl+F 展开；宽屏常驻输入框 -->
      <SimpleTooltip
        v-if="!searchExpanded && !dashboard.search"
        content="搜索事件 (Ctrl+F)"
      >
        <Button
          variant="ghost"
          size="icon-xs"
          class="xl:hidden text-muted-foreground hover:text-foreground shrink-0"
          aria-label="搜索事件 (Ctrl+F)"
          @click="expandSearch"
        >
          <Search class="size-3.5" />
        </Button>
      </SimpleTooltip>

      <div
        class="relative"
        :class="searchExpanded || dashboard.search ? 'w-[148px] xl:w-[176px]' : 'hidden xl:block xl:w-[176px]'"
      >
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent class="space-y-0.5">
              <div
                v-for="line in SEARCH_HELP"
                :key="line"
              >
                {{ line }}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Input
          size="xs"
          ref="searchInputRef"
          v-model="dashboard.search"
          placeholder="搜索（Ctrl+F）"
          class="pl-8 pr-6"
          @blur="onSearchBlur"
          @keydown.esc="clearAndCollapseSearch"
        />

        <Button
          v-if="dashboard.search"
          variant="ghost"
          size="none"
          class="absolute right-1 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
          aria-label="清除搜索"
          @click="clearAndCollapseSearch"
        >
          <X class="size-3" />
        </Button>
      </div>

      <!-- 历史筛选：Popover 按钮 -->
      <Popover>
        <SimpleTooltip content="历史事件回溯筛选">
          <PopoverTrigger as-child>
            <Button
              size="xs"
              :variant="range ? 'default' : 'ghost'"
              :class="range ? 'gap-1 px-2' : 'gap-1 px-1.5 text-muted-foreground hover:text-foreground'"
              aria-label="历史事件回溯筛选"
            >
              <History class="size-3.5" />
              <span :class="range ? 'hidden sm:inline' : 'hidden 2xl:inline'">
                {{ range ? '已选历史' : '历史回溯' }}
              </span>
              <X
                v-if="range"
                class="size-3 ml-0.5 hover:text-destructive"
                @click.stop="range = null"
              />
            </Button>
          </PopoverTrigger>
        </SimpleTooltip>

        <PopoverContent
          align="start"
          class="w-80 space-y-3"
        >
          <div class="font-semibold text-xs text-foreground">历史事件回溯筛选</div>
          <div class="grid grid-cols-3 gap-1.5">
            <Button
              size="xs"
              variant="outline"
              @click="applyQuickRange(3600_000)"
            >
              最近 1 小时
            </Button>
            <Button
              size="xs"
              variant="outline"
              @click="applyTodayRange"
            >
              今天
            </Button>
            <Button
              size="xs"
              variant="outline"
              @click="applyQuickRange(7 * 86400_000)"
            >
              最近 7 天
            </Button>
          </div>

          <div class="space-y-1.5 pt-1 border-t">
            <div class="text-[11px] text-muted-foreground">自定义时间范围</div>
            <div class="grid grid-cols-2 gap-1.5">
              <Input
                v-model="customStart"
                type="datetime-local"
                size="xs"
              />
              <Input
                v-model="customEnd"
                type="datetime-local"
                size="xs"
              />
            </div>
            <div class="flex-between pt-1">
              <Button
                size="xs"
                variant="ghost"
                class="text-muted-foreground"
                :disabled="!range"
                @click="range = null"
              >
                清除时间筛选
              </Button>
              <Button
                size="xs"
                @click="applyCustomRange"
              >
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <TooltipProvider v-if="!range">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="xs"
              :variant="dashboard.onlyCurrentSession ? 'secondary' : 'ghost'"
              :class="dashboard.onlyCurrentSession ? 'text-primary' : 'text-muted-foreground'"
              class="gap-1 px-1.5"
              @click="dashboard.onlyCurrentSession = !dashboard.onlyCurrentSession"
            >
              <Radio class="size-3.5" />
              <span class="hidden xl:inline">仅看本场</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{
              dashboard.onlyCurrentSession
                ? '当前仅显示本次统计开始后的事件，点击恢复历史'
                : '过滤历史缓存，仅显示本次统计开始后的新事件'
            }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Tag
        v-if="dashboard.userFilter"
        closable
        class="text-xs"
        @close="dashboard.backToContext()"
      >
        仅看 {{ dashboard.userFilter.uname }}
      </Tag>
    </div>

    <VueDraggable
      v-model="activeToolbarKeys"
      :animation="150"
      class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-thin py-0.5"
      ghost-class="stat-ghost"
      @wheel.prevent="onStatsWheel"
    >
      <template
        v-for="key in activeToolbarKeys"
        :key="key"
      >
        <!-- 统计时长 -->
        <TooltipProvider v-if="key === 'duration'">
          <Tooltip>
            <TooltipTrigger as-child>
              <button
                type="button"
                class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 text-left cursor-pointer select-none border-0 transition-colors hover:bg-muted/80 active:scale-[0.98]"
                @click="stats.reset()"
              >
                <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">统计时长</span>
                <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
                  formatDuration(stats.duration)
                }}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>点击重置统计（仅影响顶部数据）</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <!-- 弹幕数 -->
        <div
          v-else-if="key === 'danmaku'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">弹幕</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            stats.counters.danmaku
          }}</span>
        </div>

        <!-- 在线观众 -->
        <SimpleTooltip
          v-else-if="key === 'onlineRank'"
          :content="
            officialStats.onlineRank !== null
              ? '在线高能观众数（每 15 秒更新或实时推送）'
              : '未获取时显示近 20 分钟互动去重用户数'
          "
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">在线观众</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              officialStats.onlineRankText ||
              (officialStats.onlineRank !== null ? officialStats.onlineRank : stats.onlineCount)
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 本场点赞 -->
        <SimpleTooltip
          v-else-if="key === 'totalLikes'"
          :content="
            officialStats.totalLikes !== null
              ? `本场累计总点赞数：${officialStats.totalLikes}（会话接收点赞：${stats.counters.like}）`
              : '会话内收到的点赞数'
          "
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">本场点赞</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              officialStats.totalLikes !== null ? formatStatCount(officialStats.totalLikes) : stats.counters.like
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 累计看过 -->
        <SimpleTooltip
          v-else-if="key === 'watched'"
          content="累计观看人次"
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">累计看过</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              officialStats.watchedText ||
              (officialStats.watchedCount !== null ? formatStatCount(officialStats.watchedCount) : '暂无')
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 人气值 -->
        <SimpleTooltip
          v-else-if="key === 'popularity'"
          content="直播间热度值"
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">人气</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              officialStats.popularity ?? dashboard.officialOnline ?? '暂无'
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 近 20 分钟互动 -->
        <SimpleTooltip
          v-else-if="key === 'activeUsers'"
          content="最近 20 分钟内收到互动事件的去重用户数"
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">近 20 分钟互动</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              stats.onlineCount
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 总收益 -->
        <SimpleTooltip
          v-else-if="key === 'totalRevenue'"
          content="本场礼物、SC 与大航海汇总"
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">总收益</span>
            <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
              formatPrice(stats.totals.totalRevenue)
            }}</span>
          </div>
        </SimpleTooltip>

        <!-- 醒目留言 -->
        <div
          v-else-if="key === 'sc'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">醒目留言</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            formatPrice(stats.totals.sc)
          }}</span>
        </div>

        <!-- 礼物 -->
        <div
          v-else-if="key === 'gift'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">礼物</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            formatPrice(stats.totals.gift)
          }}</span>
        </div>

        <!-- 大航海 -->
        <div
          v-else-if="key === 'guard'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">大航海</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            stats.totals.guardCount
          }}</span>
        </div>

        <!-- 每分钟事件 -->
        <div
          v-else-if="key === 'perMinute'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">每分钟事件</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            stats.perMinute
          }}</span>
        </div>

        <!-- 盲盒盈亏 -->
        <SimpleTooltip
          v-else-if="key === 'mysteryBox'"
          :content="`共 ${stats.totals.mysteryBoxCount} 个盲盒｜投入 ${formatPrice(stats.totals.mysteryBoxCost)} → 爆出 ${formatPrice(stats.totals.mysteryBoxValue)}`"
        >
          <div class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing">
            <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">盲盒盈亏</span>
            <span
              class="text-xs font-semibold whitespace-nowrap [font-feature-settings:'tnum']"
              :class="
                stats.totals.mysteryBoxProfit > 0
                  ? 'text-emerald-500'
                  : stats.totals.mysteryBoxProfit < 0
                    ? 'text-rose-500'
                    : 'text-foreground'
              "
            >
              {{ stats.totals.mysteryBoxProfit >= 0 ? '+' : '-'
              }}{{ formatPrice(Math.abs(stats.totals.mysteryBoxProfit)) }}
            </span>
          </div>
        </SimpleTooltip>

        <!-- Top Payers（单节点包裹，避免 Sortable 索引错位） -->
        <div
          v-else-if="key === 'topPayers'"
          class="flex items-center gap-1 shrink-0 cursor-grab select-none active:cursor-grabbing"
        >
          <SimpleTooltip
            v-for="payer in stats.topPayers"
            :key="payer.userKey"
            :content="payer.uname"
          >
            <div class="flex items-center gap-1.5 py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0">
              <img
                v-if="payer.uface"
                class="size-[22px] rounded-full shrink-0"
                :src="avatarUrl(payer.uface, 48)"
                referrerpolicy="no-referrer"
              />
              <div class="flex flex-col min-w-0">
                <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap max-w-20 truncate">{{
                  payer.uname
                }}</span>
                <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
                  formatPrice(payer.total)
                }}</span>
              </div>
            </div>
          </SimpleTooltip>
        </div>
      </template>
    </VueDraggable>

    <div class="flex items-center gap-1 shrink-0">
      <ClientLiveQuickControl v-if="inTauri" />
      <ClientAutoActionQuickControl v-if="inTauri" />
      <TooltipProvider
        v-if="inTauri"
        :delay-duration="300"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              size="xs"
              :variant="dashboard.settings.streamDeckOpen ? 'secondary' : 'ghost'"
              :class="dashboard.settings.streamDeckOpen ? 'text-primary gap-1 px-1.5' : 'text-muted-foreground hover:text-foreground gap-1 px-1.5'"
              aria-label="演播快捷板"
              @click="dashboard.settings.streamDeckOpen = !dashboard.settings.streamDeckOpen"
            >
              <Clapperboard class="size-3.5" />
              <span class="hidden 2xl:inline">快捷板</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ dashboard.settings.streamDeckOpen ? '收起演播快捷板' : '展开自定义演播快捷板（VTS / OBS / 切片 / 场控）' }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <SpeechStatusPill />

      <TooltipProvider
        v-if="ui.pendingRedeemCount > 0"
        :delay-duration="300"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="xs"
              class="gap-1 px-1.5 text-amber-600 dark:text-amber-400"
              aria-label="待核销积分订单"
              @click="openRedeemPanel"
            >
              <ShoppingBag class="size-3.5" />
              <span class="tabular-nums text-[11px]">{{ ui.pendingRedeemCount }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>有 {{ ui.pendingRedeemCount }} 条待核销积分订单，点击打开核销栏位</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Popover>
        <SimpleTooltip content="高光打点 (Alt+M)">
          <PopoverTrigger as-child>
            <Button
              variant="ghost"
              :size="dashboard.markers.length > 0 ? 'xs' : 'icon-xs'"
              :class="dashboard.markers.length > 0 ? 'gap-1 px-1.5' : '2xl:w-auto 2xl:px-2 2xl:gap-1'"
              class="text-muted-foreground hover:text-foreground"
              aria-label="高光打点"
            >
              <BookmarkPlus class="size-3.5" />
              <span class="hidden 2xl:inline">打点</span>
              <Badge
                v-if="dashboard.markers.length > 0"
                size="xs"
                variant="secondary"
                class="px-1 tabular-nums"
              >
                {{ dashboard.markers.length }}
              </Badge>
            </Button>
          </PopoverTrigger>
        </SimpleTooltip>
        <PopoverContent
          align="end"
          class="w-72 p-3 space-y-2.5 text-xs"
        >
          <div class="flex-between">
            <span class="font-semibold">高光打点</span>
            <span class="text-muted-foreground">Alt+M 一键记录</span>
          </div>
          <div class="flex items-center gap-1.5">
            <Input
              v-model="markerInput"
              placeholder="高光备注（可选）"
              @keyup.enter="submitMarker"
            />
            <Button
              size="xs"
              class="shrink-0"
              @click="submitMarker"
            >
              打点
            </Button>
          </div>
          <SettingRow
            v-if="inTauri"
            variant="none"
            title="同时保存 OBS 回放缓存片段"
          >
            <Switch v-model="markerSaveReplay" />
          </SettingRow>
          <div
            v-if="dashboard.markers.length > 0"
            class="max-h-40 overflow-y-auto scrollbar-thin space-y-1 border-t pt-2"
          >
            <div
              v-for="m in dashboard.markers.slice(0, 12)"
              :key="m.id ?? m.time"
              class="flex-between gap-2 py-0.5"
            >
              <span class="truncate">
                <span class="font-mono text-muted-foreground mr-1.5">{{ formatMarkerClock(m.time) }}</span>
                <span>{{ m.label }}</span>
                <span
                  v-if="m.replaySaved"
                  class="ml-1 text-[10px] text-emerald-500"
                >
                  [已存回放]
                </span>
              </span>
              <button
                v-if="m.id"
                type="button"
                class="text-muted-foreground hover:text-destructive shrink-0"
                @click="dashboard.removeMarker(m.id)"
              >
                <X class="size-3.5" />
              </button>
            </div>
          </div>
          <div
            v-else
            class="text-muted-foreground text-center py-2 border-t"
          >
            暂无打点记录，下播后可在场次复盘导出时间轴
          </div>
        </PopoverContent>
      </Popover>

      <TooltipProvider
        v-if="dashboard.fans.todayReminders.length > 0"
        :delay-duration="400"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="xs"
              class="gap-1 px-1.5 text-amber-600 dark:text-amber-400"
              aria-label="今日粉丝特别日提醒"
              @click="dashboard.fans.todayReminderDialogOpen = true"
            >
              <Cake class="size-3.5" />
              <span class="tabular-nums text-[11px]">{{ dashboard.fans.todayReminders.length }}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>今日有 {{ dashboard.fans.todayReminders.length }} 条粉丝生日或纪念日</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <!-- 仅在开启防露屏时显式提醒，点击可一键关闭 -->
      <IconAction
        v-if="privacyMode"
        :icon="ShieldOff"
        tip="防露屏模式已开启（点击关闭）"
        active
        @click="togglePrivacyMode"
      />

      <!-- 弹幕连接状态与重连二合一：客户端已由底栏展示正常状态，仅异常/重连时在顶栏显式提示 -->
      <TooltipProvider
        v-if="!inTauri || reconnecting || (client.phase !== 'connected' && !client.hasRemoteSource)"
        :delay-duration="300"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="弹幕连接状态（点击重连）"
              :disabled="reconnecting"
              @click="reconnect"
            >
              <RefreshCw
                v-if="reconnecting"
                class="size-3.5 text-muted-foreground animate-spin"
              />
              <span
                v-else
                class="size-2 rounded-full inline-block"
                :style="{ background: statusColor }"
              />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div>
              {{
                client.hasRemoteSource && client.phase !== 'connected'
                  ? '已通过其他标签页接收弹幕'
                  : client.connectionStatus
              }}
              <template v-if="client.reconnectCount"> · 已重连 {{ client.reconnectCount }} 次 </template>
            </div>
            <div class="text-[11px] text-muted-foreground">点击重新连接弹幕源</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Separator
        orientation="vertical"
        class="h-4 mx-0.5"
      />

      <Popover>
        <SimpleTooltip content="切换显示栏位、场景预设与排列顺序">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              size="xs"
              class="gap-1.5 px-2 shrink-0"
              aria-label="调整栏位与场景预设"
            >
              <LayoutGrid class="size-3.5 text-primary" />
              <span>栏位</span>
              <Badge
                variant="secondary"
                size="xs"
                class="px-1 tabular-nums"
              >
                {{ visiblePanelCount }}
              </Badge>
            </Button>
          </PopoverTrigger>
        </SimpleTooltip>
        <PopoverContent
          align="end"
          class="p-2 w-auto"
        >
          <LayoutMenu />
        </PopoverContent>
      </Popover>

      <IconAction
        :icon="Settings"
        tip="设置"
        @click="ui.settingsOpen = true"
      />

      <DropdownMenu>
        <SimpleTooltip content="更多操作">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-xs"
              class="relative text-muted-foreground hover:text-foreground"
              aria-label="更多操作"
            >
              <Ellipsis class="size-3.5" />
              <span
                v-if="hasMoreMenuActiveState"
                class="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
              />
            </Button>
          </DropdownMenuTrigger>
        </SimpleTooltip>
        <DropdownMenuContent
          align="end"
          class="w-52"
        >
          <DropdownMenuItem @select="dashboard.settings.hideRead = !dashboard.settings.hideRead">
            <component
              :is="dashboard.settings.hideRead ? EyeOff : Eye"
              class="!size-3.5 text-muted-foreground"
            />
            <span>隐藏已读项</span>
            <Check
              v-if="dashboard.settings.hideRead"
              class="ml-auto !size-3.5 text-primary"
            />
            <DropdownMenuShortcut v-else>Alt+R</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem @select="togglePrivacyMode">
            <component
              :is="privacyMode ? ShieldOff : Shield"
              class="!size-3.5 text-muted-foreground"
            />
            <span>防露屏模式</span>
            <Check
              v-if="privacyMode"
              class="ml-auto !size-3.5 text-primary"
            />
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            :disabled="reconnecting"
            @select="reconnect"
          >
            <RefreshCw
              class="!size-3.5 text-muted-foreground"
              :class="{ 'animate-spin': reconnecting }"
            />
            <span>重新连接弹幕源</span>
            <span
              class="ml-auto size-2 rounded-full shrink-0"
              :style="{ background: statusColor }"
            />
          </DropdownMenuItem>
          <DropdownMenuItem @select="ui.toggleTheme()">
            <component
              :is="isDarkMode ? Sun : Moon"
              class="!size-3.5 text-muted-foreground"
            />
            <span>{{ isDarkMode ? '切换浅色主题' : '切换深色主题' }}</span>
            <DropdownMenuShortcut>Alt+D</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem @select="ui.shortcutsOpen = true">
            <Keyboard class="!size-3.5 text-muted-foreground" />
            <span>快捷键一览</span>
            <DropdownMenuShortcut>?</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem @select="openInNewWindow">
            <ExternalLink class="!size-3.5 text-muted-foreground" />
            <span>{{ inTauri ? '在浏览器中独立打开' : '在新窗口中独立打开' }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <div
      v-if="reconnecting"
      class="toolbar__progress absolute inset-x-0 bottom-0 h-0.5 bg-[var(--brand)]"
    />
  </header>
</template>

<style scoped>
.stat-ghost {
  opacity: 0.35;
}
.toolbar__progress {
  animation: progress 1s infinite linear;
}

@keyframes progress {
  0% {
    transform: scaleX(0);
    transform-origin: left;
  }
  50% {
    transform: scaleX(1);
    transform-origin: left;
  }
  50.1% {
    transform: scaleX(1);
    transform-origin: right;
  }
  100% {
    transform: scaleX(0);
    transform-origin: right;
  }
}
</style>
