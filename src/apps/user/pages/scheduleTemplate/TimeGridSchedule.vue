<script setup lang="ts">
import {
  ArrowDownload20Regular,
  CalendarLtr20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Clock20Regular,
  Open20Regular,
  Tag20Regular,
} from '@vicons/fluent'
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import type { SelectOption } from 'naive-ui'
import { NButton, NIcon, NPopover, NSelect, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import type { ScheduleDayInfo, UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'

import { resolveScheduleCategory } from './scheduleCategories'
import { scheduleFontStylesheetDomains, waitForScheduleFonts } from './scheduleFonts'
import {
  getCurrentWeekOrder,
  getISOWeekStart,
  getWeekOrder,
  parseScheduleMinutes,
  useScheduleNow,
  useScheduleWeek,
} from './scheduleTemplateUtils'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'
import './timeGridSchedule.css'

export interface TimeGridConfig {
  heading: string
  subheading: string
  accentColor: RGBAColor
  showNowIndicator: boolean
  autoFocusActiveTime: boolean
  backgroundFile: UploadFileResponse[]
}

const props = defineProps<ScheduleConfigTypeWithConfig<TimeGridConfig>>()
const message = useMessage()

const Config = defineTemplateConfig([
  {
    name: '背景图片',
    type: 'file',
    key: 'backgroundFile',
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: TimeGridConfig) => (config.backgroundFile = files),
  },
  { name: '周历标题', type: 'string', key: 'heading', default: '时序周历 · TimeGrid' },
  { name: '副标题/寄语', type: 'string', key: 'subheading', default: '按周排期与每日开播时段一览' },
  {
    name: '主题主色',
    type: 'color',
    key: 'accentColor',
    default: { r: 16, g: 185, b: 129, a: 1 } as RGBAColor,
    showAlpha: false,
  },
  {
    name: '自动聚焦有直播的时段',
    type: 'boolean',
    key: 'autoFocusActiveTime',
    default: true,
  },
  {
    name: '显示当前时刻指示线',
    type: 'boolean',
    key: 'showNowIndicator',
    default: true,
  },
])

const DefaultConfig: TimeGridConfig = {
  backgroundFile: [],
  heading: '时序周历 · TimeGrid',
  subheading: '按周排期与每日开播时段一览',
  accentColor: { r: 16, g: 185, b: 129, a: 1 },
  autoFocusActiveTime: true,
  showNowIndicator: true,
}

const boardRef = ref<HTMLElement>()
const saving = ref(false)
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, currentWeek, days, weekLabel, eventCount } = useScheduleWeek(() => props.data)
const { backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || '主播')
const liveRoomUrl = computed(() =>
  props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : undefined,
)

// 样式变量注入
const boardStyle = computed(() => ({
  '--timegrid-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--week-dir': weekDirection.value || 1,
  ...backgroundImageStyle.value,
}))

// 周次切换
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

interface WeekOption extends SelectOption {
  year: number
  week: number
}

const weekOptions = computed<WeekOption[]>(() => {
  const allWeeks = props.data ?? []
  const showYear = new Set(allWeeks.map((item) => item.year)).size > 1
  return allWeeks
    .toSorted((left, right) => left.year - right.year || left.week - right.week)
    .map((item) => {
      const start = getISOWeekStart(item.year, item.week)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const anchor = new Date(start)
      anchor.setDate(start.getDate() + 3)
      const firstDayOffset = (new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7
      const weekOfMonth = Math.floor((anchor.getDate() + firstDayOffset - 1) / 7) + 1
      const year = showYear ? `${item.year}年 · ` : ''
      return {
        label: `${year}${anchor.getMonth() + 1}月第${weekOfMonth}周 (${dateFormatter.format(start)}–${dateFormatter.format(end)})`,
        value: `${item.year}-${item.week}`,
        year: item.year,
        week: item.week,
      }
    })
})

const selectedWeekIndex = computed(() => weekOptions.value.findIndex((option) => option.value === selectedWeek.value))
const hasPreviousWeek = computed(() => selectedWeekIndex.value > 0)
const hasNextWeek = computed(() => selectedWeekIndex.value >= 0 && selectedWeekIndex.value < weekOptions.value.length - 1)

function moveWeek(offset: number) {
  const option = weekOptions.value[selectedWeekIndex.value + offset]
  if (option) selectedWeek.value = option.value as string
}

const now = useScheduleNow()
const currentRealWeekOrder = computed(() => getCurrentWeekOrder(now.value))
const isViewingCurrentRealWeek = computed(() => {
  if (!currentWeek.value) return false
  return getWeekOrder(currentWeek.value.year, currentWeek.value.week) === currentRealWeekOrder.value
})

function goToThisWeek() {
  const thisWeekOpt = weekOptions.value.find((opt) => getWeekOrder(opt.year, opt.week) === currentRealWeekOrder.value)
  if (thisWeekOpt) {
    selectedWeek.value = thisWeekOpt.value as string
  }
}

// ---------------------------------------------------------------------------
// 智能聚焦时段计算 (仅截取有直播的时间段)
// ---------------------------------------------------------------------------
const allWeekTimedMinutes = computed<number[]>(() => {
  const list: number[] = []
  for (const day of days.value) {
    for (const item of day.items) {
      const m = parseScheduleMinutes(item.time)
      if (m !== undefined) {
        list.push(m)
      }
    }
  }
  return list
})

interface TimeRange {
  startHour: number
  endHour: number
  startMinutes: number
  endMinutes: number
  totalMinutes: number
  ticks: number[]
}

const activeTimeRange = computed<TimeRange>(() => {
  // 若未启用自动聚焦，或本周完全没有具体时间的直播，默认使用标准全天 00:00 ~ 24:00
  if (!effectiveConfig.value.autoFocusActiveTime || allWeekTimedMinutes.value.length === 0) {
    return {
      startHour: 0,
      endHour: 24,
      startMinutes: 0,
      endMinutes: 1440,
      totalMinutes: 1440,
      ticks: [0, 3, 6, 9, 12, 15, 18, 21, 24],
    }
  }

  const minM = Math.min(...allWeekTimedMinutes.value)
  const maxM = Math.max(...allWeekTimedMinutes.value)

  // 最早提前 1 小时，最晚估算直播 2 小时后并延后 1 小时整点
  let startH = Math.max(0, Math.floor(minM / 60) - 1)
  let endH = Math.min(24, Math.ceil((maxM + 120) / 60) + 1)

  // 保证时间轴跨度至少有 6 个小时，避免过窄失真
  const minSpan = 6
  if (endH - startH < minSpan) {
    const diff = minSpan - (endH - startH)
    const padBefore = Math.floor(diff / 2)
    const padAfter = diff - padBefore
    startH = Math.max(0, startH - padBefore)
    endH = Math.min(24, endH + padAfter)
    // 若贴近 24 点则反向补齐前侧
    if (endH === 24 && endH - startH < minSpan) {
      startH = Math.max(0, endH - minSpan)
    }
  }

  const totalMinutes = (endH - startH) * 60
  const spanHours = endH - startH

  // 生成刻度 (若跨度 <= 8 小时每 1 小时一刻度，否则每 2 小时一刻度)
  const step = spanHours <= 8 ? 1 : spanHours <= 14 ? 2 : 3
  const ticks: number[] = []
  for (let h = startH; h <= endH; h += step) {
    ticks.push(h)
  }
  if (!ticks.includes(endH)) {
    ticks.push(endH)
  }

  return {
    startHour: startH,
    endHour: endH,
    startMinutes: startH * 60,
    endMinutes: endH * 60,
    totalMinutes,
    ticks,
  }
})

// 当前时间指示线
const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
const isNowInRange = computed(() => {
  return (
    nowMinutes.value >= activeTimeRange.value.startMinutes &&
    nowMinutes.value <= activeTimeRange.value.endMinutes
  )
})
const nowLeftPercent = computed(() => {
  const { startMinutes, totalMinutes } = activeTimeRange.value
  return ((nowMinutes.value - startMinutes) / totalMinutes) * 100
})
const nowTimeFormatted = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})
const todayDayIndex = computed(() => days.value.findIndex((d) => d.isToday))

// 分类图例与过滤
const activeCategoryFilter = ref<string | null>(null)

interface CategoryLegendItem {
  key: string
  name: string
  color: string
  count: number
}

const legendItems = computed<CategoryLegendItem[]>(() => {
  const map = new Map<string, CategoryLegendItem>()
  for (const day of days.value) {
    for (const item of day.items) {
      const tag = item.tag?.trim() || '直播'
      const category = resolveScheduleCategory(tag)
      const key = category?.key ?? tag.toLowerCase()
      const color = item.tagColor || (category ? undefined : '#10b981') || 'var(--timegrid-accent)'

      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, {
          key,
          name: category?.name ?? tag.toUpperCase(),
          color,
          count: 1,
        })
      }
    }
  }
  return [...map.values()]
})

function toggleCategoryFilter(key: string) {
  activeCategoryFilter.value = activeCategoryFilter.value === key ? null : key
}

function isItemFilteredOut(item: ScheduleDayInfo) {
  if (!activeCategoryFilter.value) return false
  const tag = item.tag?.trim() || '直播'
  const category = resolveScheduleCategory(tag)
  const key = category?.key ?? tag.toLowerCase()
  return key !== activeCategoryFilter.value
}

// 每日时序甘特布局计算 (结合 activeTimeRange 映射)
interface TimelineEventItem {
  item: ScheduleDayInfo
  minutes: number
  leftPercent: number
  subRowIndex: number
  color: string
}

interface ProcessedDayTimeline {
  isoDate: string
  label: string
  date: string
  isToday: boolean
  isPast: boolean
  items: ScheduleDayInfo[]
  scheduled: TimelineEventItem[]
  allday: ScheduleDayInfo[]
  totalSubRows: number
}

function computeDayTimeline(day: (typeof days.value)[number]): ProcessedDayTimeline {
  const scheduled: TimelineEventItem[] = []
  const allday: ScheduleDayInfo[] = []
  const timedItems: { item: ScheduleDayInfo; minutes: number }[] = []

  const { startMinutes, totalMinutes } = activeTimeRange.value

  for (const item of day.items) {
    const minutes = parseScheduleMinutes(item.time)
    if (minutes !== undefined) {
      timedItems.push({ item, minutes })
    } else {
      allday.push(item)
    }
  }

  timedItems.sort((a, b) => a.minutes - b.minutes)

  // 检测同日事件是否在横向时间上有紧贴/冲突 (若相隔 < 90 分钟则分入下一子行)
  const subRowLastMinutes: number[] = []

  for (const entry of timedItems) {
    let assignedRow = -1
    for (let r = 0; r < subRowLastMinutes.length; r++) {
      if (entry.minutes - subRowLastMinutes[r]! >= 90) {
        assignedRow = r
        subRowLastMinutes[r] = entry.minutes
        break
      }
    }
    if (assignedRow === -1) {
      assignedRow = subRowLastMinutes.length
      subRowLastMinutes.push(entry.minutes)
    }

    // 将绝对分钟数投影到当前的 activeTimeRange 区间中
    const clampedMinutes = Math.max(startMinutes, Math.min(startMinutes + totalMinutes, entry.minutes))
    const leftPercent = ((clampedMinutes - startMinutes) / totalMinutes) * 100
    const color = entry.item.tagColor || 'var(--timegrid-accent)'

    scheduled.push({
      item: entry.item,
      minutes: entry.minutes,
      leftPercent,
      subRowIndex: assignedRow,
      color,
    })
  }

  return {
    ...day,
    scheduled,
    allday,
    totalSubRows: Math.max(1, subRowLastMinutes.length),
  }
}

const processedTimelineDays = computed(() => {
  return days.value.map(computeDayTimeline)
})

const hasAlldayEvents = computed(() => processedTimelineDays.value.some((d) => d.allday.length > 0))

function formatEventTime(time?: string | null) {
  return time?.trim() || '待定'
}

// 导出海报
async function saveScheduleImage() {
  if (!boardRef.value || saving.value) return
  saving.value = true
  try {
    await waitForScheduleFonts()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const blob = await snapdom.toBlob(boardRef.value, {
      backgroundColor: null,
      type: 'png',
      embedFonts: true,
      fontStylesheetDomains: scheduleFontStylesheetDomains,
      dpr: Math.max(window.devicePixelRatio, 2),
    })
    saveAs(blob, `时序周历_${selectedWeek.value || '本周'}_${streamerName.value}.png`)
    message.success('已导出日程海报')
  } catch (error) {
    console.error(error)
    message.error('保存图片失败')
  } finally {
    saving.value = false
  }
}

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface timegrid-template">
    <!-- 看板主体 (横向时序甘特看板) -->
    <div
      ref="boardRef"
      class="timegrid-board timegrid-board--horizontal"
      :style="boardStyle"
    >
      <!-- 板头: 标题、元信息与时区 -->
      <header class="timegrid-header">
        <div class="timegrid-header__title-group">
          <div class="timegrid-header__eyebrow">
            <NIcon :size="14"><CalendarLtr20Regular aria-hidden="true" /></NIcon>
            <span>WEEKLY TIMELINE</span>
          </div>
          <h2 class="timegrid-header__title">{{ effectiveConfig.heading }}</h2>
          <p class="timegrid-header__meta">
            {{ streamerName }} · {{ effectiveConfig.subheading }}
          </p>
        </div>

        <div class="timegrid-header__badges">
          <span
            v-if="effectiveConfig.autoFocusActiveTime && allWeekTimedMinutes.length > 0"
            class="timegrid-badge timegrid-badge--focus"
          >
            <span>聚焦时段 {{ activeTimeRange.startHour }}:00 - {{ activeTimeRange.endHour }}:00</span>
          </span>
          <span class="timegrid-badge timegrid-badge--accent">
            <NIcon :size="13"><Clock20Regular aria-hidden="true" /></NIcon>
            <span>北京时间 (UTC+8)</span>
          </span>
          <span
            v-if="todayDayIndex >= 0"
            class="timegrid-badge"
          >
            今日 {{ days[todayDayIndex]?.date }}
          </span>
        </div>
      </header>

      <!-- 一体化周控制器 (Week Controls Toolbar) -->
      <nav
        class="timegrid-controls"
        aria-label="周次切换与导出"
      >
        <div class="timegrid-controls__nav">
          <button
            class="timegrid-ctrl-btn"
            type="button"
            :disabled="!hasPreviousWeek"
            aria-label="上一周"
            title="上一周"
            @click="moveWeek(-1)"
          >
            <NIcon><ChevronLeft20Regular /></NIcon>
          </button>

          <div class="timegrid-controls__range">
            <NSelect
              v-if="weekOptions.length"
              v-model:value="selectedWeek"
              class="timegrid-week-select"
              :options="weekOptions"
              :to="false"
              placeholder="选择周次"
              size="small"
            />
            <span
              v-else
              class="timegrid-controls__empty-label"
            >
              {{ weekLabel }}
            </span>
          </div>

          <button
            class="timegrid-ctrl-btn"
            type="button"
            :disabled="!hasNextWeek"
            aria-label="下一周"
            title="下一周"
            @click="moveWeek(1)"
          >
            <NIcon><ChevronRight20Regular /></NIcon>
          </button>

          <button
            v-if="!isViewingCurrentRealWeek && weekOptions.length"
            class="timegrid-ctrl-btn timegrid-ctrl-btn--today"
            type="button"
            @click="goToThisWeek"
          >
            <span>本周</span>
          </button>
        </div>

        <div class="timegrid-controls__actions">
          <button
            class="timegrid-ctrl-btn timegrid-ctrl-btn--export"
            type="button"
            :disabled="saving"
            @click="saveScheduleImage"
          >
            <NIcon><ArrowDownload20Regular /></NIcon>
            <span>{{ saving ? '生成中...' : '导出海报' }}</span>
          </button>
        </div>
      </nav>

      <!-- 待定/全天事件栏 (若有) -->
      <div
        v-if="hasAlldayEvents"
        class="timegrid-allday-bar"
      >
        <div class="timegrid-allday-bar__header">
          <span class="timegrid-allday-bar__badge">全天 / 待定时段</span>
        </div>
        <div class="timegrid-allday-bar__list">
          <template
            v-for="day in processedTimelineDays"
            :key="`allday-group-${day.isoDate}`"
          >
            <NPopover
              v-for="item in day.allday"
              :key="item.id || item.title"
              trigger="hover"
              placement="bottom"
            >
              <template #trigger>
                <div class="timegrid-allday-chip">
                  <span class="timegrid-allday-chip__day">{{ day.label }}</span>
                  <span
                    class="timegrid-event__dot"
                    :style="{ background: item.tagColor || 'var(--timegrid-accent)' }"
                  />
                  <span class="timegrid-allday-chip__title">{{ item.title || '待定安排' }}</span>
                </div>
              </template>
              <div class="timegrid-popover">
                <h4 class="timegrid-popover__title">{{ item.title || '未命名活动' }}</h4>
                <div class="timegrid-popover__time-row">
                  <NIcon :size="14"><Clock20Regular aria-hidden="true" /></NIcon>
                  <span>{{ day.label }} ({{ day.date }}) · {{ formatEventTime(item.time) }}</span>
                </div>
                <div
                  v-if="item.tag"
                  class="timegrid-popover__tag"
                  :style="{
                    background: item.tagColor ? `${item.tagColor}22` : 'var(--timegrid-accent-soft)',
                    color: item.tagColor || 'var(--timegrid-accent)',
                  }"
                >
                  <NIcon :size="12"><Tag20Regular aria-hidden="true" /></NIcon>
                  <span>{{ item.tag }}</span>
                </div>
              </div>
            </NPopover>
          </template>
        </div>
      </div>

      <!-- 横向时序主表 (甘特式: 纵向 7 行，横向时间轴) -->
      <div class="timegrid-timeline-card">
        <!-- 头部刻度尺 (Timeline Header) -->
        <div class="timegrid-timeline-header">
          <div class="timegrid-timeline-header__left-corner">
            <span>星期 · 日期</span>
          </div>
          <div class="timegrid-timeline-scale">
            <div
              v-for="(hour, idx) in activeTimeRange.ticks"
              :key="`scale-${hour}`"
              class="timegrid-scale-tick"
              :class="{
                'is-first': idx === 0,
                'is-last': idx === activeTimeRange.ticks.length - 1,
              }"
              :style="{
                left: `${((hour - activeTimeRange.startHour) / (activeTimeRange.endHour - activeTimeRange.startHour)) * 100}%`,
              }"
            >
              <span class="timegrid-scale-tick__label">{{ String(hour).padStart(2, '0') }}:00</span>
            </div>
          </div>
        </div>

        <!-- 7 天每日轨道列表 (7 Rows) -->
        <div class="timegrid-timeline-rows">
          <div
            v-for="day in processedTimelineDays"
            :key="day.isoDate"
            class="timegrid-timeline-row"
            :class="{
              'is-today': day.isToday,
              'is-past': day.isPast,
              'is-empty': day.scheduled.length === 0,
            }"
            :style="{
              '--subrows': day.totalSubRows,
            }"
          >
            <!-- 左侧日期表头单元格 (Fixed Left Column) -->
            <div
              class="timegrid-row-head"
              :class="{ 'is-today': day.isToday }"
            >
              <div class="timegrid-row-head__main">
                <span class="timegrid-row-head__name">{{ day.label }}</span>
                <span class="timegrid-row-head__date">{{ day.date }}</span>
              </div>
              <span
                v-if="day.isToday"
                class="timegrid-row-head__today-pill"
              >
                今日
              </span>
            </div>

            <!-- 右侧横向时间轨道 (Horizontal Timeline Track) -->
            <div class="timegrid-row-track">
              <!-- 竖直参考时刻线 -->
              <div class="timegrid-row-grid-lines">
                <div
                  v-for="hour in activeTimeRange.ticks"
                  :key="`row-tick-${hour}`"
                  class="timegrid-track-line"
                  :class="{ 'is-major': hour % 6 === 0 }"
                  :style="{
                    left: `${((hour - activeTimeRange.startHour) / (activeTimeRange.endHour - activeTimeRange.startHour)) * 100}%`,
                  }"
                />
              </div>

              <!-- 当日实时 NOW 垂直红线 (仅在当天且落在当前时段内显示) -->
              <div
                v-if="day.isToday && effectiveConfig.showNowIndicator && isNowInRange"
                class="timegrid-row-now-line"
                :style="{ left: `${nowLeftPercent}%` }"
              >
                <div class="timegrid-row-now-tag">
                  <span class="timegrid-now-pulse" />
                  <span>NOW {{ nowTimeFormatted }}</span>
                </div>
              </div>

              <!-- 当天有日程安排时的事件条 (Event Pills) -->
              <template v-if="day.scheduled.length > 0">
                <NPopover
                  v-for="entry in day.scheduled"
                  :key="entry.item.id || `${entry.item.title}-${entry.minutes}`"
                  trigger="hover"
                  placement="top"
                >
                  <template #trigger>
                    <div
                      class="timegrid-pill"
                      :class="{ 'is-filtered-out': isItemFilteredOut(entry.item) }"
                      :style="{
                        left: `${entry.leftPercent}%`,
                        top: `calc(${entry.subRowIndex} * 38px + 7px)`,
                        background: `color-mix(in srgb, ${entry.color} 18%, var(--schedule-panel))`,
                        borderColor: `color-mix(in srgb, ${entry.color} 55%, var(--schedule-border))`,
                      }"
                    >
                      <span
                        class="timegrid-pill__dot"
                        :style="{ background: entry.color }"
                      />
                      <span class="timegrid-pill__time">{{ entry.item.time }}</span>
                      <span class="timegrid-pill__title">{{ entry.item.title || '直播安排' }}</span>
                      <span
                        v-if="entry.item.tag"
                        class="timegrid-pill__tag"
                        :style="{
                          background: `color-mix(in srgb, ${entry.color} 24%, transparent)`,
                          color: entry.color,
                        }"
                      >
                        {{ entry.item.tag }}
                      </span>
                    </div>
                  </template>

                  <!-- 弹层详情卡片 -->
                  <div class="timegrid-popover">
                    <h4 class="timegrid-popover__title">{{ entry.item.title || '未命名直播' }}</h4>
                    <div class="timegrid-popover__time-row">
                      <NIcon :size="14"><Clock20Regular aria-hidden="true" /></NIcon>
                      <span>{{ day.label }} ({{ day.date }}) · {{ entry.item.time }}</span>
                    </div>
                    <div
                      v-if="entry.item.tag"
                      class="timegrid-popover__tag"
                      :style="{
                        background: `color-mix(in srgb, ${entry.color} 18%, transparent)`,
                        color: entry.color,
                        border: `1px solid color-mix(in srgb, ${entry.color} 36%, transparent)`,
                      }"
                    >
                      <NIcon :size="12"><Tag20Regular aria-hidden="true" /></NIcon>
                      <span>{{ entry.item.tag }}</span>
                    </div>
                    <div
                      v-if="liveRoomUrl"
                      class="timegrid-popover__actions"
                    >
                      <NButton
                        size="tiny"
                        type="primary"
                        secondary
                        tag="a"
                        :href="liveRoomUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <template #icon>
                          <NIcon><Open20Regular /></NIcon>
                        </template>
                        前往直播间
                      </NButton>
                    </div>
                  </div>
                </NPopover>
              </template>

              <!-- 当天无日程安排 (休播日) -->
              <div
                v-else
                class="timegrid-row-empty"
              >
                <span class="timegrid-row-empty__text">休播</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 底部图例与说明 -->
      <footer class="timegrid-footer">
        <div
          v-if="legendItems.length"
          class="timegrid-legend"
        >
          <button
            class="timegrid-legend__btn"
            :class="{ 'is-active': activeCategoryFilter === null }"
            type="button"
            @click="activeCategoryFilter = null"
          >
            <span>全部 ({{ eventCount }})</span>
          </button>
          <button
            v-for="legend in legendItems"
            :key="legend.key"
            class="timegrid-legend__btn"
            :class="{ 'is-active': activeCategoryFilter === legend.key }"
            type="button"
            @click="toggleCategoryFilter(legend.key)"
          >
            <span
              class="timegrid-legend__dot"
              :style="{ background: legend.color }"
            />
            <span>{{ legend.name }} ({{ legend.count }})</span>
          </button>
        </div>
      </footer>
    </div>
  </section>
</template>
