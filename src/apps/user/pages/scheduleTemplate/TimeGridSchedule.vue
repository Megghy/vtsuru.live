<script setup lang="ts">
import CalendarLtr20Regular from '@vicons/fluent/es/CalendarLtr20Regular'
import Clock20Regular from '@vicons/fluent/es/Clock20Regular'
import Open20Regular from '@vicons/fluent/es/Open20Regular'
import Tag20Regular from '@vicons/fluent/es/Tag20Regular'
import { computed, ref } from 'vue'

import type { APIFileModel, ResponseScheduleDayModel } from '@/api/generated/model'
import type { ScheduleConfigTypeWithConfig } from '@/shared/types/TemplateTypes'
import type { RGBAColor } from '@/shared/types/VTsuruConfigTypes'
import { defineTemplateConfig, rgbaToString } from '@/shared/types/VTsuruConfigTypes'
import { Button } from '@/shared/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'

import { resolveScheduleCategory } from './scheduleCategories'
import {
  buildScheduleDays,
  getCurrentWeekOrder,
  getWeekOrder,
  useScheduleNow,
  useScheduleWeek,
} from './scheduleTemplateUtils'
import ScheduleWeekToolbar from './ScheduleWeekToolbar.vue'
import {
  computeActiveTimeRange,
  layoutDayEvents,
  minutesToPercent,
  parseTimeGridMinutes,
  toBeijingWallDate,
  type TimelineEventItem,
} from './timeGridLayout'
import { useScheduleTemplateAssets } from './useScheduleTemplateAssets'

import './scheduleTemplateTheme.css'
import './timeGridSchedule.css'

interface TimeGridConfig {
  heading: string
  subheading: string
  accentColor: RGBAColor
  backgroundFile: APIFileModel[]
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
const effectiveConfig = computed(() => ({ ...DefaultConfig, ...props.config }))
const { selectedWeek, weekDirection, currentWeek } = useScheduleWeek(() => props.data)
const { backgroundUrl, backgroundImageStyle } = useScheduleTemplateAssets(props, effectiveConfig)

const streamerName = computed(() => props.userInfo?.name || '主播')
const liveRoomUrl = computed(() =>
  props.userInfo?.biliRoomId ? `https://live.bilibili.com/${props.userInfo.biliRoomId}` : undefined,
)

const boardStyle = computed(() => ({
  '--timegrid-accent': rgbaToString(effectiveConfig.value.accentColor),
  '--week-dir': weekDirection.value || 1,
  ...backgroundImageStyle.value,
}))

// 统一按北京时间 (UTC+8) 计算今日、本周与 NOW 指示线
const now = useScheduleNow()
const beijingNow = computed(() => toBeijingWallDate(now.value))
const realCurrentWeekOrder = computed(() => getCurrentWeekOrder(beijingNow.value))

const isViewingCurrentRealWeek = computed(() => {
  if (!currentWeek.value) return false
  return getWeekOrder(currentWeek.value.year, currentWeek.value.week) === realCurrentWeekOrder.value
})

function goToThisWeek() {
  const weeks = props.data ?? []
  if (!weeks.length) return
  const match = weeks.find((week) => getWeekOrder(week.year, week.week) === realCurrentWeekOrder.value)
  const target = match ?? weeks.toSorted((a, b) => a.year - b.year || a.week - b.week).at(-1)
  if (target) selectedWeek.value = `${target.year}-${target.week}`
}

const beijingDays = computed(() => (currentWeek.value ? buildScheduleDays(currentWeek.value, beijingNow.value) : []))
const todayDay = computed(() => beijingDays.value.find((day) => day.isToday))

const nowMinutes = computed(() => beijingNow.value.getHours() * 60 + beijingNow.value.getMinutes())
const nowTimeFormatted = computed(() => {
  const h = String(beijingNow.value.getHours()).padStart(2, '0')
  const m = String(beijingNow.value.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
})

const allWeekTimedMinutes = computed<number[]>(() => {
  const list: number[] = []
  for (const day of beijingDays.value) {
    for (const item of day.items) {
      const m = parseTimeGridMinutes(item.time)
      if (m !== undefined) list.push(m)
    }
  }
  return list
})

const activeTimeRange = computed(() =>
  computeActiveTimeRange(allWeekTimedMinutes.value, effectiveConfig.value.autoFocusActiveTime),
)

const isNowInRange = computed(
  () => nowMinutes.value >= activeTimeRange.value.startMinutes && nowMinutes.value <= activeTimeRange.value.endMinutes,
)

const nowLeftPercent = computed(() => minutesToPercent(nowMinutes.value, activeTimeRange.value))
const nowTagAlignClass = computed(() => {
  if (nowLeftPercent.value < 8) return 'is-start'
  if (nowLeftPercent.value > 92) return 'is-end'
  return ''
})

function resolveEventColor(item: ResponseScheduleDayModel): string {
  return item.tagColor?.trim() || 'var(--timegrid-accent)'
}

function getCategoryMeta(item: ResponseScheduleDayModel) {
  const rawTag = item.tag?.trim()
  if (!rawTag) return { key: '__default__', name: '直播' }
  const category = resolveScheduleCategory(rawTag)
  return {
    key: category?.key ?? rawTag.toLowerCase(),
    name: category?.name ?? rawTag.toUpperCase(),
  }
}

const activeCategoryFilter = ref<string | null>(null)

interface CategoryLegendItem {
  key: string
  name: string
  color: string
  count: number
}

const legendItems = computed<CategoryLegendItem[]>(() => {
  const map = new Map<string, CategoryLegendItem>()
  for (const day of beijingDays.value) {
    for (const item of day.items) {
      const { key, name } = getCategoryMeta(item)
      const existing = map.get(key)
      if (existing) {
        existing.count += 1
      } else {
        map.set(key, {
          key,
          name,
          color: resolveEventColor(item),
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

function isItemFilteredOut(item: ResponseScheduleDayModel) {
  if (!activeCategoryFilter.value) return false
  return getCategoryMeta(item).key !== activeCategoryFilter.value
}

interface ProcessedDayTimeline {
  isoDate: string
  label: string
  date: string
  isToday: boolean
  isPast: boolean
  scheduled: TimelineEventItem[]
  allday: ResponseScheduleDayModel[]
  totalSubRows: number
}

const processedTimelineDays = computed<ProcessedDayTimeline[]>(() =>
  beijingDays.value.map((day) => {
    const layout = layoutDayEvents(day.items, activeTimeRange.value, resolveEventColor)
    return {
      isoDate: day.isoDate,
      label: day.label,
      date: day.date,
      isToday: day.isToday,
      isPast: day.isPast,
      ...layout,
    }
  }),
)

const hasAlldayEvents = computed(() => processedTimelineDays.value.some((day) => day.allday.length > 0))

function formatEventTime(time?: string | null) {
  return time?.trim() || '待定'
}

defineExpose({ Config, DefaultConfig })
</script>

<template>
  <section class="schedule-template-surface timegrid-template">
    <ScheduleWeekToolbar
      v-model="selectedWeek"
      :weeks="props.data ?? []"
      :capture-target="boardRef"
      :file-name="`时序周历_${selectedWeek || '本周'}_${streamerName}`"
    >
      <template #actions-extra>
        <Button
          v-if="!isViewingCurrentRealWeek && (props.data?.length ?? 0) > 0"
          variant="outline"
          @click="goToThisWeek"
        >
          本周
        </Button>
      </template>
    </ScheduleWeekToolbar>

    <Transition
      name="schedule-week-swap"
      mode="out-in"
    >
      <div
        :key="selectedWeek || 'empty'"
        ref="boardRef"
        class="timegrid-board"
        :class="{ 'has-background': Boolean(backgroundUrl) }"
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
              v-if="todayDay"
              class="timegrid-badge"
            >
              今日 {{ todayDay.date }}
            </span>
          </div>
        </header>

        <!-- 无任何日程周次时的空状态 -->
        <div
          v-if="!processedTimelineDays.length"
          class="timegrid-empty-state"
        >
          <span class="timegrid-empty-state__icon">
            <component
              :is="CalendarLtr20Regular"
              class="size-6"
              aria-hidden="true"
            />
          </span>
          <strong class="timegrid-empty-state__title">还没有公开的日程</strong>
          <p class="timegrid-empty-state__desc">新的直播安排会显示在这里</p>
        </div>

        <template v-else>
          <!-- 待定/全天事件栏 (若有) -->
          <div
            v-if="hasAlldayEvents"
            class="timegrid-allday-bar"
          >
            <span class="timegrid-allday-bar__badge">全天 / 待定时段</span>
            <div class="timegrid-allday-bar__list">
              <template
                v-for="day in processedTimelineDays"
                :key="`allday-group-${day.isoDate}`"
              >
                <Popover
                  v-for="(item, idx) in day.allday"
                  :key="item.id || `${day.isoDate}-${idx}-${item.title}`"
                >
                  <PopoverTrigger as-child>
                    <button
                      type="button"
                      class="timegrid-allday-chip"
                      :class="{ 'is-filtered-out': isItemFilteredOut(item) }"
                    >
                      <span class="timegrid-allday-chip__day">{{ day.label }}</span>
                      <span
                        class="timegrid-allday-chip__dot"
                        :style="{ background: resolveEventColor(item) }"
                      />
                      <span class="timegrid-allday-chip__title">{{ item.title || '待定安排' }}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent class="timegrid-popover w-60">
                    <h4 class="timegrid-popover__title">{{ item.title || '未命名活动' }}</h4>
                    <div class="timegrid-popover__time-row">
                      <component
                        :is="Clock20Regular"
                        class="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{{ day.label }} ({{ day.date }}) · {{ formatEventTime(item.time) }}</span>
                    </div>
                    <div
                      v-if="item.tag"
                      class="timegrid-popover__tag"
                      :style="{
                        background: `color-mix(in srgb, ${resolveEventColor(item)} 18%, transparent)`,
                        color: `color-mix(in srgb, ${resolveEventColor(item)} 72%, var(--foreground))`,
                        border: `1px solid color-mix(in srgb, ${resolveEventColor(item)} 36%, transparent)`,
                      }"
                    >
                      <component
                        :is="Tag20Regular"
                        class="size-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{{ item.tag }}</span>
                    </div>
                    <div
                      v-if="liveRoomUrl"
                      class="timegrid-popover__actions"
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
                          aria-hidden="true"
                        />
                        前往直播间
                      </a>
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
                  '--now-offset': day.isToday && effectiveConfig.showNowIndicator && isNowInRange ? '20px' : '0px',
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

                  <!-- 当日实时 NOW 垂直红线 -->
                  <div
                    v-if="day.isToday && effectiveConfig.showNowIndicator && isNowInRange"
                    class="timegrid-row-now-line"
                    :style="{ left: `${nowLeftPercent}%` }"
                  >
                    <div
                      class="timegrid-row-now-tag"
                      :class="nowTagAlignClass"
                    >
                      <span class="timegrid-now-pulse" />
                      <span>NOW {{ nowTimeFormatted }}</span>
                    </div>
                  </div>

                  <!-- 当天有日程安排时的事件条 (Event Pills) -->
                  <template v-if="day.scheduled.length > 0">
                    <Popover
                      v-for="(entry, idx) in day.scheduled"
                      :key="entry.item.id || `${day.isoDate}-${idx}-${entry.item.title}-${entry.minutes}`"
                    >
                      <PopoverTrigger as-child>
                        <button
                          type="button"
                          class="timegrid-pill"
                          :class="{ 'is-filtered-out': isItemFilteredOut(entry.item) }"
                          :style="{
                            left: `${entry.leftPercent}%`,
                            '--pill-shift-x': `${-entry.shiftPercent}%`,
                            top: `calc(${entry.subRowIndex} * 38px + var(--now-offset, 0px) + 7px)`,
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
                              background: `color-mix(in srgb, ${entry.color} 18%, transparent)`,
                              color: `color-mix(in srgb, ${entry.color} 72%, var(--schedule-fg))`,
                            }"
                          >
                            {{ entry.item.tag }}
                          </span>
                        </button>
                      </PopoverTrigger>

                      <!-- 弹层详情卡片 -->
                      <PopoverContent class="timegrid-popover w-64">
                        <h4 class="timegrid-popover__title">
                          {{ entry.item.title || '未命名直播' }}
                        </h4>
                        <div class="timegrid-popover__time-row">
                          <component
                            :is="Clock20Regular"
                            class="size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{{ day.label }} ({{ day.date }}) · {{ entry.item.time }}</span>
                        </div>
                        <div
                          v-if="entry.item.tag"
                          class="timegrid-popover__tag"
                          :style="{
                            background: `color-mix(in srgb, ${entry.color} 18%, transparent)`,
                            color: `color-mix(in srgb, ${entry.color} 72%, var(--foreground))`,
                            border: `1px solid color-mix(in srgb, ${entry.color} 36%, transparent)`,
                          }"
                        >
                          <component
                            :is="Tag20Regular"
                            class="size-3 shrink-0"
                            aria-hidden="true"
                          />
                          <span>{{ entry.item.tag }}</span>
                        </div>
                        <div
                          v-if="liveRoomUrl"
                          class="timegrid-popover__actions"
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
                              aria-hidden="true"
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
              <span class="timegrid-legend__label">分类图例</span>
              <div class="timegrid-legend__items">
                <Button
                  v-for="cat in legendItems"
                  :key="cat.key"
                  variant="outline"
                  size="xs"
                  class="timegrid-legend-pill font-normal"
                  :class="{ 'is-active': activeCategoryFilter === cat.key }"
                  :style="{ '--legend-color': cat.color }"
                  @click="toggleCategoryFilter(cat.key)"
                >
                  <span
                    class="timegrid-legend-pill__dot"
                    :style="{ background: cat.color }"
                  />
                  <span class="timegrid-legend-pill__name">{{ cat.name }}</span>
                  <span class="timegrid-legend-pill__count">{{ cat.count }}</span>
                </Button>
                <Button
                  v-if="activeCategoryFilter"
                  variant="ghost"
                  size="xs"
                  class="font-normal"
                  @click="activeCategoryFilter = null"
                >
                  重置筛选
                </Button>
              </div>
            </div>
          </footer>
        </template>
      </div>
    </Transition>
  </section>
</template>
