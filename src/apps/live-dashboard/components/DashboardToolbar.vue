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
  <header class="toolbar">
    <div class="toolbar__search">
      <div class="relative w-[180px]">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Search16Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground cursor-help" />
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
          ref="searchInputRef"
          v-model="dashboard.search"
          placeholder="搜索（Ctrl+F）"
          class="toolbar__search-input h-7 text-xs pl-8 pr-6"
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
            class="toolbar__history-btn h-7 text-xs gap-1"
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

        <PopoverContent align="start" class="w-80 p-3 space-y-3">
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
              <input
                v-model="customStart"
                type="datetime-local"
                class="h-7 text-[11px] px-1.5 rounded border border-input bg-background"
              />
              <input
                v-model="customEnd"
                type="datetime-local"
                class="h-7 text-[11px] px-1.5 rounded border border-input bg-background"
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
      class="toolbar__stats"
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
                class="stat stat--button"
                type="button"
                @click="stats.reset()"
              >
                <span class="stat__label">统计时长</span>
                <span class="stat__value">{{ formatDuration(stats.duration) }}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent class="text-xs">点击重置统计（仅影响顶部数据）</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <!-- 弹幕数 -->
        <div
          v-else-if="key === 'danmaku'"
          class="stat"
        >
          <span class="stat__label">弹幕</span>
          <span class="stat__value">{{ stats.counters.danmaku }}</span>
        </div>

        <!-- 在线观众 -->
        <div
          v-else-if="key === 'onlineRank'"
          class="stat"
          :title="
            officialStats.onlineRank !== null
              ? '在线高能观众数（每 15 秒更新或实时推送）'
              : '未获取时显示近 20 分钟互动去重用户数'
          "
        >
          <span class="stat__label">在线观众</span>
          <span class="stat__value">{{
            officialStats.onlineRankText ||
            (officialStats.onlineRank !== null ? officialStats.onlineRank : stats.onlineCount)
          }}</span>
        </div>

        <!-- 本场点赞 -->
        <div
          v-else-if="key === 'totalLikes'"
          class="stat"
          :title="
            officialStats.totalLikes !== null
              ? `本场累计总点赞数：${officialStats.totalLikes}（会话接收点赞：${stats.counters.like}）`
              : '会话内收到的点赞数'
          "
        >
          <span class="stat__label">本场点赞</span>
          <span class="stat__value">{{
            officialStats.totalLikes !== null ? formatStatCount(officialStats.totalLikes) : stats.counters.like
          }}</span>
        </div>

        <!-- 累计看过 -->
        <div
          v-else-if="key === 'watched'"
          class="stat"
          title="累计观看人次"
        >
          <span class="stat__label">累计看过</span>
          <span class="stat__value">{{
            officialStats.watchedText ||
            (officialStats.watchedCount !== null ? formatStatCount(officialStats.watchedCount) : '暂无')
          }}</span>
        </div>

        <!-- 人气值 -->
        <div
          v-else-if="key === 'popularity'"
          class="stat"
          title="直播间热度值"
        >
          <span class="stat__label">人气</span>
          <span class="stat__value">{{ officialStats.popularity ?? dashboard.officialOnline ?? '暂无' }}</span>
        </div>

        <!-- 近 20 分钟互动 -->
        <div
          v-else-if="key === 'activeUsers'"
          class="stat"
          title="最近 20 分钟内收到互动事件的去重用户数"
        >
          <span class="stat__label">近 20 分钟互动</span>
          <span class="stat__value">{{ stats.onlineCount }}</span>
        </div>

        <!-- 总收益 -->
        <div
          v-else-if="key === 'totalRevenue'"
          class="stat"
          title="本场礼物、SC 与大航海汇总"
        >
          <span class="stat__label">总收益</span>
          <span class="stat__value">{{ formatPrice(stats.totals.totalRevenue) }}</span>
        </div>

        <!-- 醒目留言 -->
        <div
          v-else-if="key === 'sc'"
          class="stat"
        >
          <span class="stat__label">醒目留言</span>
          <span class="stat__value">{{ formatPrice(stats.totals.sc) }}</span>
        </div>

        <!-- 礼物 -->
        <div
          v-else-if="key === 'gift'"
          class="stat"
        >
          <span class="stat__label">礼物</span>
          <span class="stat__value">{{ formatPrice(stats.totals.gift) }}</span>
        </div>

        <!-- 大航海 -->
        <div
          v-else-if="key === 'guard'"
          class="stat"
        >
          <span class="stat__label">大航海</span>
          <span class="stat__value">{{ stats.totals.guardCount }}</span>
        </div>

        <!-- 每分钟事件 -->
        <div
          v-else-if="key === 'perMinute'"
          class="stat"
        >
          <span class="stat__label">每分钟事件</span>
          <span class="stat__value">{{ stats.perMinute }}</span>
        </div>

        <!-- Top Payers -->
        <template v-else-if="key === 'topPayers'">
          <div
            v-for="payer in stats.topPayers"
            :key="payer.userKey"
            class="payer"
            :title="payer.uname"
          >
            <img
              v-if="payer.uface"
              :src="avatarUrl(payer.uface, 48)"
              referrerpolicy="no-referrer"
            />
            <div class="payer__text">
              <span class="stat__label">{{ payer.uname }}</span>
              <span class="stat__value">{{ formatPrice(payer.total) }}</span>
            </div>
          </div>
        </template>
      </template>
    </VueDraggable>

    <div class="toolbar__actions">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger as-child>
            <span
              class="status-dot"
              :style="{ background: statusColor }"
            />
          </TooltipTrigger>
          <TooltipContent class="text-xs">
            {{
              client.hasRemoteSource && client.phase !== 'connected' ? '已通过其他标签页接收弹幕' : client.connectionStatus
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
            class="h-7 w-7 p-0"
            aria-label="布局"
          >
            <Board16Regular class="size-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" class="p-2 w-auto">
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
      class="toolbar__progress"
    />
  </header>
</template>

<style scoped>
.toolbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 44px;
  padding: 0 10px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  flex-shrink: 0;
  min-width: 0;
}

.toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar__stats {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.toolbar__stats::-webkit-scrollbar {
  display: none;
}

.stat-ghost {
  opacity: 0.35;
}

.stat {
  display: flex;
  flex-direction: column;
  padding: 2px 8px;
  border-radius: var(--radius);
  background: var(--muted);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}
.stat:active {
  cursor: grabbing;
}
.stat--button {
  border: none;
  font: inherit;
  color: inherit;
  cursor: pointer;
  text-align: left;
}
.stat--button:hover {
  background: var(--popover);
}

.stat__label {
  font-size: 10px;
  color: var(--muted-foreground);
  line-height: 1.1;
  white-space: nowrap;
}

.stat__value {
  font-size: 12px;
  font-weight: 600;
  color: var(--foreground);
  font-feature-settings: 'tnum';
  white-space: nowrap;
}

.payer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  border-radius: var(--radius);
  background: var(--muted);
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}
.payer img {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}
.payer__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.payer .stat__label {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  cursor: help;
}

.toolbar__progress {
  position: absolute;
  left: 0;
  bottom: 0;
  right: 0;
  height: 2px;
  background: var(--brand);
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
