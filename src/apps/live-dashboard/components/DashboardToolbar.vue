<script setup lang="ts">
import {
  ArrowClockwise16Regular,
  Board16Regular,
  Dismiss16Regular,
  Eye16Regular,
  EyeOff16Regular,
  History24Regular,
  Keyboard20Regular,
  Search16Regular,
  Settings16Regular,
  WeatherMoon16Regular,
  WeatherSunny16Regular,
} from '@vicons/fluent'
import { OpenOutline } from '@vicons/ionicons5'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { isDarkMode } from '@/shared/utils'

import { avatarUrl, formatDuration, formatPrice } from '../core/format'
import { DEFAULT_TOOLBAR_ORDER, type ToolbarStatKey } from '../store/settings'
import { useDashboardUi } from '../store/ui'
import { useLiveDashboard } from '../store/useLiveDashboard'
import IconAction from './IconAction.vue'
import LayoutMenu from './LayoutMenu.vue'

const dashboard = useLiveDashboard()
const ui = useDashboardUi()
const stats = computed(() => dashboard.stats)
const officialStats = computed(() => dashboard.officialStats)
const client = computed(() => dashboard.client)
const searchInputRef = ref<HTMLInputElement | null>(null)
const reconnecting = ref(false)

const activeToolbarKeys = computed({
  get() {
    const order = dashboard.settings.toolbarOrder || DEFAULT_TOOLBAR_ORDER
    const statsConfig = dashboard.settings.toolbarStats
    return order.filter((key) => statsConfig[key])
  },
  set(newActiveKeys: ToolbarStatKey[]) {
    const hiddenKeys = (dashboard.settings.toolbarOrder || DEFAULT_TOOLBAR_ORDER).filter(
      (k) => !dashboard.settings.toolbarStats[k],
    )
    dashboard.settings.toolbarOrder = [...newActiveKeys, ...hiddenKeys]
  },
})

function formatStatCount(num: number | null | undefined): string {
  if (!num || num <= 0) return '0'
  if (num >= 10000) {
    return `${(num / 10000).toFixed(1).replace(/\.0$/, '')}w`
  }
  return num.toLocaleString()
}

watch(
  () => ui.searchFocusTick,
  () => searchInputRef.value?.focus(),
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

function openInNewWindow() {
  window.open('/live-dashboard', '_blank', 'noopener,noreferrer')
}

const SEARCH_HELP = [
  'type:superchat,gift,toast,message,enter,follow,like',
  'uid:12345  username:名字  message:内容  medal:勋章  note:备注',
  'price:>=30  price:10..50（仅付费事件）',
  '-前缀取反，如 -type:message；多值用逗号；含空格用引号',
]
</script>

<template>
  <header class="relative flex items-center gap-3 h-11 px-2.5 border-b border-border bg-card shrink-0 min-w-0 text-sm">
    <div class="flex items-center gap-1.5 shrink-0">
      <div class="relative w-[180px]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Search16Regular
                class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground cursor-help"
              />
            </TooltipTrigger>
            <TooltipContent class="text-xs space-y-0.5">
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
          class="toolbar__search-input pl-8 pr-6"
        />

        <button
          v-if="dashboard.search"
          type="button"
          class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          @click="dashboard.search = ''"
        >
          <Dismiss16Regular class="size-3" />
        </button>
      </div>

      <!-- 历史筛选：Popover 按钮 -->
      <Popover>
        <PopoverTrigger as-child>
          <Button
            size="xs"
            :variant="range ? 'default' : 'ghost'"
            class="toolbar__history-btn gap-1"
          >
            <History24Regular class="size-3.5" />
            <span>{{ range ? '已选历史' : '历史回溯' }}</span>
            <Dismiss16Regular
              v-if="range"
              class="size-3 ml-1 hover:text-destructive"
              @click.stop="range = null"
            />
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          class="w-80 p-3 space-y-3"
        >
          <div class="font-semibold text-xs text-foreground">历史事件回溯筛选</div>
          <div class="grid grid-cols-3 gap-1.5">
            <Button
              size="xs"
              variant="outline"
              class="h-6 text-[11px]"
              @click="applyQuickRange(3600_000)"
            >
              最近 1 小时
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="h-6 text-[11px]"
              @click="applyTodayRange"
            >
              今天
            </Button>
            <Button
              size="xs"
              variant="outline"
              class="h-6 text-[11px]"
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
            <div class="flex items-center justify-between pt-1">
              <Button
                size="xs"
                variant="ghost"
                class="h-6 text-[11px] text-muted-foreground"
                :disabled="!range"
                @click="range = null"
              >
                清除时间筛选
              </Button>
              <Button
                size="xs"
                class="h-6 text-[11px]"
                @click="applyCustomRange"
              >
                应用
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Badge
        v-if="dashboard.userFilter"
        variant="outline"
        class="text-xs h-6 px-2 gap-1.5 border-primary/40 text-primary bg-primary/10"
      >
        <span>仅看 {{ dashboard.userFilter.uname }}</span>
        <button
          type="button"
          class="hover:text-destructive cursor-pointer"
          @click="dashboard.backToContext()"
        >
          <Dismiss16Regular class="size-3" />
        </button>
      </Badge>
    </div>

    <VueDraggable
      v-model="activeToolbarKeys"
      :animation="150"
      class="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar"
      ghost-class="stat-ghost"
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
                class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 select-none appearance-none border-0 font-inherit text-inherit cursor-pointer text-left hover:bg-popover"
                type="button"
                @click="stats.reset()"
              >
                <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">统计时长</span>
                <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
                  formatDuration(stats.duration)
                }}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">点击重置统计（仅影响顶部数据）</TooltipContent>
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
        <div
          v-else-if="key === 'onlineRank'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          :title="
            officialStats.onlineRank !== null
              ? '在线高能观众数（每 15 秒更新或实时推送）'
              : '未获取时显示近 20 分钟互动去重用户数'
          "
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">在线观众</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            officialStats.onlineRankText ||
            (officialStats.onlineRank !== null ? officialStats.onlineRank : stats.onlineCount)
          }}</span>
        </div>

        <!-- 本场点赞 -->
        <div
          v-else-if="key === 'totalLikes'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          :title="
            officialStats.totalLikes !== null
              ? `本场累计总点赞数：${officialStats.totalLikes}（会话接收点赞：${stats.counters.like}）`
              : '会话内收到的点赞数'
          "
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">本场点赞</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            officialStats.totalLikes !== null ? formatStatCount(officialStats.totalLikes) : stats.counters.like
          }}</span>
        </div>

        <!-- 累计看过 -->
        <div
          v-else-if="key === 'watched'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          title="累计观看人次"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">累计看过</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            officialStats.watchedText ||
            (officialStats.watchedCount !== null ? formatStatCount(officialStats.watchedCount) : '暂无')
          }}</span>
        </div>

        <!-- 人气值 -->
        <div
          v-else-if="key === 'popularity'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          title="直播间热度值"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">人气</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            officialStats.popularity ?? dashboard.officialOnline ?? '暂无'
          }}</span>
        </div>

        <!-- 近 20 分钟互动 -->
        <div
          v-else-if="key === 'activeUsers'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          title="最近 20 分钟内收到互动事件的去重用户数"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">近 20 分钟互动</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            stats.onlineCount
          }}</span>
        </div>

        <!-- 总收益 -->
        <div
          v-else-if="key === 'totalRevenue'"
          class="flex flex-col py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none active:cursor-grabbing"
          title="本场礼物、SC 与大航海汇总"
        >
          <span class="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">总收益</span>
          <span class="text-xs font-semibold text-foreground whitespace-nowrap [font-feature-settings:'tnum']">{{
            formatPrice(stats.totals.totalRevenue)
          }}</span>
        </div>

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

        <!-- Top Payers -->
        <template v-else-if="key === 'topPayers'">
          <div
            v-for="payer in stats.topPayers"
            :key="payer.userKey"
            class="flex items-center gap-1.5 py-0.5 px-2 rounded-[var(--radius)] bg-muted shrink-0 cursor-grab select-none"
            :title="payer.uname"
          >
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
        </template>
      </template>
    </VueDraggable>

    <div class="flex items-center gap-1 shrink-0">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              class="size-2 rounded-full inline-block cursor-help"
              :style="{ background: statusColor }"
            />
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{
              client.hasRemoteSource && client.phase !== 'connected'
                ? '已通过其他标签页接收弹幕'
                : client.connectionStatus
            }}
            <template v-if="client.reconnectCount"> · 已重连 {{ client.reconnectCount }} 次 </template>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <IconAction
        :icon="ArrowClockwise16Regular"
        tip="重新连接弹幕源"
        @click="reconnect"
      />
      <IconAction
        :icon="dashboard.settings.hideRead ? EyeOff16Regular : Eye16Regular"
        :tip="dashboard.settings.hideRead ? '显示已读项 (Alt+R)' : '隐藏已读项 (Alt+R)'"
        :active="dashboard.settings.hideRead"
        @click="dashboard.settings.hideRead = !dashboard.settings.hideRead"
      />

      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="ghost"
            size="xs"
            class="w-7 p-0"
            aria-label="布局"
          >
            <Board16Regular class="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          class="p-2 w-auto"
        >
          <LayoutMenu />
        </PopoverContent>
      </Popover>

      <IconAction
        :icon="isDarkMode ? WeatherSunny16Regular : WeatherMoon16Regular"
        tip="切换深色 / 浅色 (Alt+D)"
        @click="ui.toggleTheme()"
      />
      <IconAction
        :icon="Keyboard20Regular"
        tip="快捷键 (?)"
        @click="ui.shortcutsOpen = true"
      />
      <IconAction
        :icon="OpenOutline"
        tip="在新窗口中独立打开"
        @click="openInNewWindow"
      />
      <IconAction
        :icon="Settings16Regular"
        tip="设置"
        @click="ui.settingsOpen = true"
      />
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
