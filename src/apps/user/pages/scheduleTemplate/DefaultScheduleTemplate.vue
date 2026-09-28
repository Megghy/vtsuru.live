<script setup lang="ts">
import { CalendarLtr20Regular, Clock20Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { ScheduleConfigType } from '@/shared/types/TemplateTypes'

import './scheduleTemplateTheme.css'
import {
  buildScheduleDays,
  getCurrentWeekOrder,
  getWeekDateRange,
  getWeekOrder,
  parseScheduleMinutes,
  useScheduleNow,
} from './scheduleTemplateUtils'

const props = defineProps<ScheduleConfigType>()

/** 当天已开始超过该时长的直播不再视为"下一场" */
const LIVE_GRACE_MINUTES = 120

const now = useScheduleNow()

const weeks = computed(() => {
  const currentOrder = getCurrentWeekOrder(now.value)
  return (props.data ?? [])
    .map((week) => {
      const order = getWeekOrder(week.year, week.week)
      const days = buildScheduleDays(week, now.value)
      return {
        key: `${week.year}-${week.week}`,
        year: week.year,
        week: week.week,
        order,
        days,
        dateRange: getWeekDateRange(week.year, week.week),
        eventCount: days.reduce((count, day) => count + day.items.length, 0),
        isCurrent: order === currentOrder,
        isPast: order < currentOrder,
      }
    })
    .toSorted((left, right) => left.order - right.order)
})

// 本周优先, 其次最近的未来周, 全部已过去时取最近一周
const featuredWeek = computed(() => weeks.value.find((week) => !week.isPast) ?? weeks.value.at(-1))

// 重点周在最前; 其余未来周按时间正序, 过去周按由近到远
const displayWeeks = computed(() => {
  const featured = featuredWeek.value
  if (!featured) return []
  const rest = weeks.value.filter((week) => week !== featured)
  return [featured, ...rest.filter((week) => !week.isPast), ...rest.filter((week) => week.isPast).toReversed()].map(
    (week) => ({ ...week, featured: week === featured }),
  )
})

const nextLive = computed(() => {
  const nowMinutes = now.value.getHours() * 60 + now.value.getMinutes()
  for (const week of weeks.value) {
    for (const day of week.days) {
      if (day.isPast) continue
      const item = day.items.find(
        (entry) => !day.isToday || (parseScheduleMinutes(entry.time) ?? Infinity) >= nowMinutes - LIVE_GRACE_MINUTES,
      )
      if (item) return { day, item }
    }
  }
  return undefined
})

const featuredBadge = computed(() => {
  const week = featuredWeek.value
  if (!week) return ''
  if (week.isCurrent) return '本周'
  return week.isPast ? '最近一周' : '即将到来'
})

const streamerName = computed(() => props.userInfo?.name || '主播')
</script>

<template>
  <section class="schedule-template-surface default-schedule">
    <header class="schedule-intro">
      <div class="schedule-intro__copy">
        <span class="schedule-intro__eyebrow">
          <CalendarLtr20Regular aria-hidden="true" />
          LIVE SCHEDULE
        </span>
        <h2>直播日程</h2>
        <p>{{ streamerName }} 的直播安排</p>
      </div>

      <div
        v-if="nextLive"
        class="schedule-next"
      >
        <span class="schedule-next__label">{{ nextLive.day.isToday ? '今日直播' : '下一场' }}</span>
        <strong>{{ nextLive.item.title || '未命名直播' }}</strong>
        <span class="schedule-next__when">
          <Clock20Regular aria-hidden="true" />
          {{ nextLive.day.label }} {{ nextLive.day.date }} · {{ nextLive.item.time || '时间待定' }}
        </span>
      </div>
    </header>

    <div
      v-if="!displayWeeks.length"
      class="schedule-empty"
    >
      <span class="schedule-empty__icon">
        <CalendarLtr20Regular aria-hidden="true" />
      </span>
      <strong>还没有公开的日程</strong>
      <p>新的直播安排会显示在这里</p>
    </div>

    <template v-else>
      <template
        v-for="week in displayWeeks"
        :key="week.key"
      >
        <article
          class="schedule-week"
          :class="week.featured ? 'is-featured' : ['is-other', { 'is-past': week.isPast }]"
        >
          <header class="schedule-week__header">
            <div class="schedule-week__title">
              <h3>{{ week.dateRange }}</h3>
              <p>{{ week.year }} 年第 {{ week.week }} 周 · {{ week.eventCount }} 场安排</p>
            </div>
            <span
              v-if="week.featured"
              class="schedule-week__badge"
            >
              {{ featuredBadge }}
            </span>
            <span
              v-else
              class="schedule-week__status"
            >
              {{ week.isPast ? '已结束' : '预告' }}
            </span>
          </header>

          <ol
            v-if="week.featured || week.eventCount"
            class="schedule-days"
          >
            <li
              v-for="day in week.days"
              :key="day.english"
              class="schedule-day"
              :class="{ 'is-today': day.isToday, 'is-past': day.isPast, 'is-empty': !day.items.length }"
            >
              <header class="schedule-day__header">
                <strong>{{ day.label }}</strong>
                <time :datetime="day.isoDate">{{ day.date }}</time>
                <span
                  v-if="day.isToday"
                  class="schedule-day__today"
                >
                  今日
                </span>
              </header>

              <div
                v-if="day.items.length"
                class="schedule-day__events"
              >
                <div
                  v-for="(item, itemIndex) in day.items"
                  :key="item.id || itemIndex"
                  class="schedule-event"
                  :class="{ 'is-next': item === nextLive?.item }"
                  :style="item.tagColor ? { '--event-color': item.tagColor } : undefined"
                >
                  <div class="schedule-event__meta">
                    <span class="schedule-event__time">{{ item.time || '待定' }}</span>
                    <span
                      v-if="item.tag"
                      class="schedule-event__tag"
                    >
                      {{ item.tag }}
                    </span>
                  </div>
                  <strong>{{ item.title || '未命名直播' }}</strong>
                </div>
              </div>

              <p
                v-else
                class="schedule-day__empty"
              >
                {{ week.featured ? '暂无安排' : '—' }}
              </p>
            </li>
          </ol>
        </article>
      </template>
    </template>
  </section>
</template>

<style scoped src="./defaultSchedule.css"></style>
