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
import { computed, ref } from 'vue'

import type { ScheduleDayInfo, UploadFileResponse } from '@/api/api-models'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { toast } from '@/shared/utils'

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

interface TimeGridConfig {
  heading: string
  subheading: string
  accentColor: RGBAColor
  backgroundFile: UploadFileResponse[]
  autoFocusActiveTime: boolean
  showNowIndicator: boolean
}

const props = defineProps<ScheduleConfigTypeWithConfig<TimeGridConfig>>()

const Config = defineTemplateConfig([
  {
    name: '主标题',
    type: 'string',
    key: 'heading',
    default: '时序周历 · TimeGrid',
  },
  {
    name: '副标题',
    type: 'string',
    key: 'subheading',
    default: '按周排期与每日开播时段一览',
  },
  {
    name: '主题色',
    type: 'color',
    key: 'accentColor',
    default: { r: 16, g: 185, b: 129, a: 1 },
  },
  {
    name: '背景图',
    type: 'file',
    fileLimit: 1,
    key: 'backgroundFile',
    onUploaded: (file, config) => {
      config.backgroundFile = file
    },
  },
  {
    name: '聚焦开播时段',
    description: '自动裁切早晚无人开播的空闲时段，让主要直播时段充满横向轨道',
    type: 'boolean',
    key: 'autoFocusActiveTime',
    default: true,
  },
  {
    name: '显示当前时刻指示线',
    description: '在当天轨道上标注当前北京时间的位置',
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

interface WeekOption {
  label: string
  value: string
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
        label: `${year}${anchor.getMonth() + 1}月第${weekOfMonth}周 · ${dateFormatter.format(start)}–${dateFormatter.format(end)}`,
        value: `${item.year}-${item.week}`,
        year: item.year,
        week: item.week,
      }
    })
})

const currentWeekIndex = computed(() => weekOptions.value.findIndex((option) => option.value === selectedWeek.value))
const hasPreviousWeek = computed(() => currentWeekIndex.value > 0)
const hasNextWeek = computed(() => currentWeekIndex.value >= 0 && currentWeekIndex.value < weekOptions.value.length - 1)

function moveWeek(offset: number) {
  const option = weekOptions.value[currentWeekIndex.value + offset]
  if (option) selectedWeek.value = option.value
}

// 是否正在查看现实里的“本周”
const now = useScheduleNow()
const realCurrentWeekOrder = computed(() => getCurrentWeekOrder(now.value))
const isViewingCurrentRealWeek = computed(() => {
  if (!currentWeek.value) return false
  const viewingOrder = getWeekOrder(currentWeek.value.year, currentWeek.value.week)
  return viewingOrder === realCurrentWeekOrder.value
})

function goToThisWeek() {
  const match = weekOptions.value.find((opt) => getWeekOrder(opt.year, opt.week) === realCurrentWeekOrder.value)
  if (match) {
    selectedWeek.value = match.value
  } else if (weekOptions.value.length) {
    selectedWeek.value = weekOptions.value[weekOptions.value.length - 1].value
  }
}

// 实时时间计算 (NOW)
const nowMinutes = computed(() => now.value.getHours() * 60 + now.value.getMinutes())
const nowTimeFormatted = computed(() => {
  const h = String(now.value.getHours()).padStart(2, '0')
  const m = String(now.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})
const isCurrentRealWeek = isViewingCurrentRealWeek

// 提取本周所有有具体时间的安排，用于计算最优时段聚焦
const allWeekTimedMinutes = computed<number[]>(() => {
  const list: number[] = []
  for (const day of days.value) {
    for (const item of day.items) {
      const m = parseScheduleMinutes(item.time)
      if (m !== null) {
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
    if (endH - startH < minSpan) {
      if (startH === 0) endH = Math.min(24, startH + minSpan)
      if (endH === 24) startH = Math.max(0, endH - minSpan)
    }
  }

  const startMinutes = startH * 60
  const endMinutes = endH * 60
  const totalMinutes = endMinutes - startMinutes

  // 生成刻度 (每 2 小时或每 3 小时整点一条)
  const spanHours = endH - startH
  const step = spanHours <= 8 ? 1 : spanHours <= 16 ? 2 : 3
  const ticks: number[] = []
  for (let h = startH; h <= endH; h += step) {
    ticks.push(h)
  }
  if (ticks[ticks.length - 1] !== endH) {
    ticks.push(endH)
  }

  return {
    startHour: startH,
    endHour: endH,
    startMinutes,
    endMinutes,
    totalMinutes,
    ticks,
  }
})

// 将分钟数转换为当前聚焦时间范围内的百分比 (0 ~ 100)
function minutesToPercent(minutes: number): number {
  const { startMinutes, totalMinutes } = activeTimeRange.value
  const clamped = Math.max(startMinutes, Math.min(startMinutes + totalMinutes, minutes))
  return ((clamped - startMinutes) / totalMinutes) * 100
}

// NOW 指示线坐标
const isNowInRange = computed(() => {
  const m = nowMinutes.value
  const { startMinutes, endMinutes } = activeTimeRange.value
  return m >= startMinutes && m <= endMinutes
})

const nowLeftPercent = computed(() => minutesToPercent(nowMinutes.value))

// 今日索引 (0 ~ 6: 周一到周日)
const todayDayIndex = computed(() => {
  if (!isCurrentRealWeek.value) return -1
  const currentDate = new Date()
  return (currentDate.getDay() + 6) % 7
})

// 分类图例与筛选
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
  scheduled: TimelineEventItem[]
  allday: ScheduleDayInfo[]
  totalSubRows: number
}

const processedTimelineDays = computed<ProcessedDayTimeline[]>(() => {
  return days.value.map((day, idx) => {
    const isToday = idx === todayDayIndex.value
    const isPast = todayDayIndex.value !== -1 && idx < todayDayIndex.value

    const scheduledRaw: { item: ScheduleDayInfo; minutes: number }[] = []
    const allday: ScheduleDayInfo[] = []

    for (const item of day.items) {
      const m = parseScheduleMinutes(item.time)
      if (m !== null) {
        scheduledRaw.push({ item, minutes: m })
      } else {
        allday.push(item)
      }
    }

    // 按开播时间升序排序
    scheduledRaw.sort((a, b) => a.minutes - b.minutes)

    // 多场直播重叠防撞贪心分配 (若两场时间间隔小于 75 分钟则推入次行轨道)
    const subRowEndMinutes: number[] = []
    const scheduled: TimelineEventItem[] = scheduledRaw.map(({ item, minutes }) => {
      let assignedRow = 0
      for (let r = 0; r < subRowEndMinutes.length; r++) {
        if (minutes >= subRowEndMinutes[r] + 75) {
          assignedRow = r
          break
        }
      }
      if (assignedRow === subRowEndMinutes.length) {
        subRowEndMinutes.push(minutes)
      } else {
        subRowEndMinutes[assignedRow] = minutes
      }

      const color = item.tagColor || 'var(--timegrid-accent)'

      return {
        item,
        minutes,
        leftPercent: minutesToPercent(minutes),
        subRowIndex: assignedRow,
        color,
      }
    })

    return {
      isoDate: day.isoDate,
      label: day.label,
      date: day.date,
      isToday,
      isPast,
      scheduled,
      allday,
      totalSubRows: Math.max(1, subRowEndMinutes.length),
    }
  })
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
    toast.success('已导出日程海报')
  } catch (error) {
    console.error(error)
    toast.error('保存图片失败')
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
            <component
              :is="CalendarLtr20Regular"
              class="size-3.5 inline"
              aria-hidden="true"
            />
            <span>WEEKLY TIMELINE</span>
          </div>
          <h2 class="timegrid-header__title">{{ effectiveConfig.heading }}</h2>
          <p class="timegrid-header__meta">{{ streamerName }} · {{ effectiveConfig.subheading }}</p>
        </div>

        <div class="timegrid-header__badges">
          <span
            v-if="effectiveConfig.autoFocusActiveTime && allWeekTimedMinutes.length > 0"
            class="timegrid-badge timegrid-badge--focus"
          >
            <span>聚焦时段 {{ activeTimeRange.startHour }}:00 - {{ activeTimeRange.endHour }}:00</span>
          </span>
          <span class="timegrid-badge timegrid-badge--accent">
            <component
              :is="Clock20Regular"
              class="size-3.5 inline"
              aria-hidden="true"
            />
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
            <component
              :is="ChevronLeft20Regular"
              class="size-4"
            />
          </button>

          <div class="timegrid-controls__range">
            <Select
              v-if="weekOptions.length"
              :model-value="selectedWeek"
              @update:model-value="selectedWeek = String($event)"
            >
              <SelectTrigger class="timegrid-week-select w-48">
                <SelectValue placeholder="选择周次" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="opt in weekOptions"
                  :key="opt.value"
                  :value="opt.value"
                  class="text-xs"
                >
                  {{ opt.label }}
                </SelectItem>
              </SelectContent>
            </Select>
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
            <component
              :is="ChevronRight20Regular"
              class="size-4"
            />
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
            <component
              :is="ArrowDownload20Regular"
              class="size-4"
            />
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
            <Popover
              v-for="item in day.allday"
              :key="item.id || item.title"
            >
              <PopoverTrigger as-child>
                <div class="timegrid-allday-chip cursor-pointer">
                  <span class="timegrid-allday-chip__day">{{ day.label }}</span>
                  <span
                    class="timegrid-event__dot"
                    :style="{ background: item.tagColor || 'var(--timegrid-accent)' }"
                  />
                  <span class="timegrid-allday-chip__title">{{ item.title || '待定安排' }}</span>
                </div>
              </PopoverTrigger>
              <PopoverContent class="timegrid-popover w-60 p-3 text-xs space-y-2">
                <h4 class="timegrid-popover__title font-semibold text-foreground">{{ item.title || '未命名活动' }}</h4>
                <div class="timegrid-popover__time-row flex items-center gap-1.5 text-muted-foreground text-[11px]">
                  <component
                    :is="Clock20Regular"
                    class="size-3.5 inline"
                    aria-hidden="true"
                  />
                  <span>{{ day.label }} ({{ day.date }}) · {{ formatEventTime(item.time) }}</span>
                </div>
                <div
                  v-if="item.tag"
                  class="timegrid-popover__tag inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                  :style="{
                    background: item.tagColor ? `${item.tagColor}22` : 'var(--timegrid-accent-soft)',
                    color: item.tagColor || 'var(--timegrid-accent)',
                  }"
                >
                  <component
                    :is="Tag20Regular"
                    class="size-3 inline"
                    aria-hidden="true"
                  />
                  <span>{{ item.tag }}</span>
                </div>
              </PopoverContent>
            </Popover>
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
                <Popover
                  v-for="entry in day.scheduled"
                  :key="entry.item.id || `${entry.item.title}-${entry.minutes}`"
                >
                  <PopoverTrigger as-child>
                    <div
                      class="timegrid-pill cursor-pointer"
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
                  </PopoverTrigger>

                  <!-- 弹层详情卡片 -->
                  <PopoverContent class="timegrid-popover w-64 p-3 text-xs space-y-2">
                    <h4 class="timegrid-popover__title font-semibold text-foreground">
                      {{ entry.item.title || '未命名直播' }}
                    </h4>
                    <div class="timegrid-popover__time-row flex items-center gap-1.5 text-muted-foreground text-[11px]">
                      <component
                        :is="Clock20Regular"
                        class="size-3.5 inline"
                        aria-hidden="true"
                      />
                      <span>{{ day.label }} ({{ day.date }}) · {{ entry.item.time }}</span>
                    </div>
                    <div
                      v-if="entry.item.tag"
                      class="timegrid-popover__tag inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                      :style="{
                        background: `color-mix(in srgb, ${entry.color} 18%, transparent)`,
                        color: entry.color,
                        border: `1px solid color-mix(in srgb, ${entry.color} 36%, transparent)`,
                      }"
                    >
                      <component
                        :is="Tag20Regular"
                        class="size-3 inline"
                        aria-hidden="true"
                      />
                      <span>{{ entry.item.tag }}</span>
                    </div>
                    <div
                      v-if="liveRoomUrl"
                      class="timegrid-popover__actions pt-1"
                    >
                      <a
                        :href="liveRoomUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-primary text-xs hover:underline"
                      >
                        <component
                          :is="Open20Regular"
                          class="size-3.5"
                        />
                        前往直播间
                      </a>
                    </div>
                  </PopoverContent>
                </Popover>
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

      <!-- 板底: 分类图例/统计 (Category Legend & Filter) -->
      <footer
        v-if="legendItems.length > 0"
        class="timegrid-footer"
      >
        <div class="timegrid-legend">
          <span class="timegrid-legend__label">活动分类 (点击筛选):</span>
          <div class="timegrid-legend__items">
            <button
              v-for="cat in legendItems"
              :key="cat.key"
              type="button"
              class="timegrid-legend-pill"
              :class="{ 'is-active': activeCategoryFilter === cat.key }"
              :style="{
                '--legend-color': cat.color,
              }"
              @click="toggleCategoryFilter(cat.key)"
            >
              <span
                class="timegrid-legend-pill__dot"
                :style="{ background: cat.color }"
              />
              <span class="timegrid-legend-pill__name">{{ cat.name }}</span>
              <span class="timegrid-legend-pill__count">{{ cat.count }}</span>
            </button>
            <button
              v-if="activeCategoryFilter"
              type="button"
              class="timegrid-legend-pill timegrid-legend-pill--clear"
              @click="activeCategoryFilter = null"
            >
              重置筛选
            </button>
          </div>
        </div>
      </footer>
    </div>
  </section>
</template>
