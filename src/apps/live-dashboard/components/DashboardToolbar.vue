<script setup lang="ts">
import {
  ArrowClockwise16Regular,
  Board16Regular,
  CalendarLtr20Regular,
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
import { NButton, NDatePicker, NFlex, NIcon, NInput, NPopover, NTag, NText, NTooltip } from 'naive-ui'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

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
const searchRef = ref<InstanceType<typeof NInput>>()
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
  () => searchRef.value?.focus(),
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
      <NInput
        ref="searchRef"
        v-model:value="dashboard.search"
        size="small"
        clearable
        placeholder="搜索（Ctrl+F）"
        class="toolbar__search-input"
      >
        <template #prefix>
          <NTooltip placement="bottom-start">
            <template #trigger>
              <NIcon :component="Search16Regular" />
            </template>
            <div
              v-for="line in SEARCH_HELP"
              :key="line"
            >
              {{ line }}
            </div>
          </NTooltip>
        </template>
      </NInput>

      <!-- 历史筛选：默认收起为紧凑 Popover 按钮，大幅释放顶栏水平空间 -->
      <NPopover
        trigger="click"
        placement="bottom-start"
        style="padding: 12px"
      >
        <template #trigger>
          <NButton
            size="small"
            :type="range ? 'primary' : 'default'"
            :quaternary="!range"
            :secondary="!!range"
            class="toolbar__history-btn"
          >
            <template #icon>
              <NIcon :component="History24Regular" />
            </template>
            <span>{{ range ? '已选历史' : '历史回溯' }}</span>
            <NIcon
              v-if="range"
              :component="Dismiss16Regular"
              style="margin-left: 4px"
              @click.stop="range = null"
            />
          </NButton>
        </template>

        <NFlex
          vertical
          :size="8"
        >
          <div style="font-weight: 600; font-size: 13px">历史事件回溯筛选</div>
          <NDatePicker
            v-model:value="range"
            type="datetimerange"
            size="small"
            clearable
            :shortcuts="{
              '最近 1 小时': () => [Date.now() - 3600_000, Date.now()],
              今天: () => [new Date().setHours(0, 0, 0, 0), Date.now()],
              '最近 7 天': () => [Date.now() - 7 * 86400_000, Date.now()],
            }"
            start-placeholder="开始时间"
            end-placeholder="结束时间"
            style="width: 320px"
          />
          <NFlex
            v-if="range"
            justify="flex-end"
          >
            <NButton
              size="tiny"
              quaternary
              @click="range = null"
            >
              清除时间筛选
            </NButton>
          </NFlex>
        </NFlex>
      </NPopover>

      <NTag
        v-if="dashboard.userFilter"
        size="small"
        closable
        type="primary"
        @close="dashboard.backToContext()"
      >
        仅看 {{ dashboard.userFilter.uname }}
      </NTag>
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
        <NTooltip v-if="key === 'duration'">
          <template #trigger>
            <button
              class="stat stat--button"
              type="button"
              @click="stats.reset()"
            >
              <span class="stat__label">统计时长</span>
              <span class="stat__value">{{ formatDuration(stats.duration) }}</span>
            </button>
          </template>
          点击重置统计（仅影响顶部数据）
        </NTooltip>

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
      <NTooltip>
        <template #trigger>
          <span
            class="status-dot"
            :style="{ background: statusColor }"
          />
        </template>
        {{
          client.hasRemoteSource && client.phase !== 'connected' ? '已通过其他标签页接收弹幕' : client.connectionStatus
        }}
        <template v-if="client.reconnectCount"> · 已重连 {{ client.reconnectCount }} 次 </template>
      </NTooltip>
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
      <NPopover
        trigger="click"
        placement="bottom-end"
      >
        <template #trigger>
          <NButton
            quaternary
            size="tiny"
            aria-label="布局"
          >
            <template #icon>
              <NIcon :component="Board16Regular" />
            </template>
          </NButton>
        </template>
        <LayoutMenu />
      </NPopover>
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
  border-bottom: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-surface);
  flex-shrink: 0;
  min-width: 0;
}

.toolbar__search {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar__search :deep(.n-input) {
  width: 140px;
  transition: width 0.2s ease;
}

.toolbar__search :deep(.n-input.n-input--focus),
.toolbar__search :deep(.n-input:hover) {
  width: 200px;
}

.toolbar__history-btn {
  flex-shrink: 0;
}

.toolbar__stats {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}

.toolbar__stats::-webkit-scrollbar {
  display: none;
}

.stat {
  display: grid;
  line-height: 1.15;
  flex-shrink: 0;
  cursor: grab;
  user-select: none;
}

.stat:active {
  cursor: grabbing;
}

.stat-ghost {
  opacity: 0.3;
}

.stat--button {
  all: unset;
  display: grid;
  line-height: 1.15;
  cursor: pointer;
}

.stat__label {
  font-size: 10px;
  color: var(--vtsuru-fg-muted);
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat__value {
  font-size: 13px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.payer {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.payer img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.payer__text {
  display: grid;
  line-height: 1.15;
}

.toolbar__actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  margin: 0 6px;
  border-radius: 50%;
}

.toolbar__progress {
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--vtsuru-primary), transparent);
  background-size: 50% 100%;
  animation: progress 1s linear infinite;
}

@keyframes progress {
  from {
    background-position: -50% 0;
  }
  to {
    background-position: 150% 0;
  }
}
</style>
