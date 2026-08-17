<script setup lang="ts">
import { CalendarLtr20Regular, Clock20Regular } from '@vicons/fluent'
import { computed } from 'vue'

import type { ScheduleConfigType } from '@/shared/types/TemplateTypes'

import './scheduleTemplateTheme.css'
import { getISOWeekStart, SCHEDULE_DAYS } from './scheduleTemplateUtils'

const props = defineProps<ScheduleConfigType>()

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })
const today = new Date()

const weeks = computed(() =>
  (props.data ?? []).map((week) => {
    const start = getISOWeekStart(week.year, week.week)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)

    const days = SCHEDULE_DAYS.map((day, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      const items = (week.days[index] ?? []).filter((item) => item.title || item.time || item.tag)

      return {
        ...day,
        date: dateFormatter.format(date),
        isToday: date.toDateString() === today.toDateString(),
        items,
      }
    })

    return {
      ...week,
      days,
      dateRange: `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`,
      eventCount: days.reduce((count, day) => count + day.items.length, 0),
      isCurrentWeek: days.some((day) => day.isToday),
    }
  }),
)

const totalEvents = computed(() => weeks.value.reduce((count, week) => count + week.eventCount, 0))
const streamerName = computed(() => props.userInfo?.name || '主播')
</script>

<template>
  <section class="schedule-template-surface default-schedule">
    <header class="schedule-intro">
      <div class="schedule-intro__copy">
        <span class="schedule-intro__eyebrow">
          <CalendarLtr20Regular aria-hidden="true" />
          WEEKLY SCHEDULE
        </span>
        <h2>直播日程</h2>
        <p>{{ streamerName }} 的近期直播安排</p>
      </div>

      <div
        v-if="weeks.length"
        class="schedule-intro__summary"
      >
        <strong>{{ totalEvents }}</strong>
        <span>场直播</span>
        <small>{{ weeks.length }} 周排期</small>
      </div>
    </header>

    <div
      v-if="!weeks.length"
      class="schedule-empty"
    >
      <span class="schedule-empty__icon">
        <CalendarLtr20Regular aria-hidden="true" />
      </span>
      <strong>还没有公开的日程</strong>
      <p>新的直播安排会显示在这里</p>
    </div>

    <ol
      v-else
      class="schedule-weeks"
    >
      <li
        v-for="week in weeks"
        :key="`${week.year}-${week.week}`"
        class="schedule-week"
        :class="{ 'is-current': week.isCurrentWeek }"
      >
        <header class="schedule-week__header">
          <div
            class="schedule-week__index"
            aria-hidden="true"
          >
            <span>W</span>
            <strong>{{ String(week.week).padStart(2, '0') }}</strong>
          </div>

          <div class="schedule-week__title">
            <div class="schedule-week__label">
              <h3>{{ week.year }} 年第 {{ week.week }} 周</h3>
              <span
                v-if="week.isCurrentWeek"
                class="schedule-week__current"
              >
                本周
              </span>
            </div>
            <p>{{ week.dateRange }}</p>
          </div>

          <div
            class="schedule-week__rhythm"
            aria-label="本周每日安排概览"
          >
            <span
              v-for="day in week.days"
              :key="day.english"
              :class="{ 'has-event': day.items.length, 'is-today': day.isToday }"
              :title="`${day.label}：${day.items.length} 场`"
            />
          </div>

          <div class="schedule-week__count">
            <strong>{{ week.eventCount }}</strong>
            <span>场安排</span>
          </div>
        </header>

        <ol class="schedule-days">
          <li
            v-for="day in week.days"
            :key="day.english"
            class="schedule-day"
            :class="{ 'is-today': day.isToday, 'is-rest': !day.items.length }"
          >
            <header class="schedule-day__header">
              <div class="schedule-day__identity">
                <span>{{ day.english }}</span>
                <strong>{{ day.label }}</strong>
              </div>
              <time>{{ day.date }}</time>
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
              <article
                v-for="(item, itemIndex) in day.items"
                :key="item.id || itemIndex"
                class="schedule-event"
                :style="item.tagColor ? { '--event-color': item.tagColor } : undefined"
              >
                <div class="schedule-event__meta">
                  <span class="schedule-event__time">
                    <Clock20Regular aria-hidden="true" />
                    {{ item.time || '待定' }}
                  </span>
                  <span
                    v-if="item.tag"
                    class="schedule-event__tag"
                  >
                    {{ item.tag }}
                  </span>
                </div>
                <strong>{{ item.title || '未命名直播' }}</strong>
              </article>
            </div>

            <div
              v-else
              class="schedule-day__rest"
            >
              <span aria-hidden="true" />
              <p>休息日</p>
              <small>暂无安排</small>
            </div>
          </li>
        </ol>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.default-schedule {
  --default-bg: var(
    --vtsuru-block-bg-muted,
    var(--user-page-theme-surface-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-muted)))
  );
  --default-card: var(--vtsuru-page-card-bg, color-mix(in srgb, var(--default-bg) 92%, var(--schedule-fg) 8%));
  --default-card-embedded: var(
    --vtsuru-page-card-bg-embedded,
    color-mix(in srgb, var(--default-card) 90%, var(--schedule-fg) 10%)
  );
  --default-line: var(--vtsuru-block-border, var(--schedule-border));

  display: grid;
  gap: clamp(16px, 2.4vw, 24px);
  width: 100%;
  min-width: 0;
  container: default-schedule / inline-size;
}

.schedule-intro {
  position: relative;
  display: flex;
  min-width: 0;
  padding: clamp(18px, 3vw, 28px);
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  overflow: hidden;
  background: var(--default-card);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
}

.schedule-intro::after {
  position: absolute;
  right: clamp(96px, 16vw, 180px);
  bottom: 0;
  width: 1px;
  height: 72%;
  background: color-mix(in srgb, var(--schedule-accent) 32%, transparent);
  content: '';
  transform: rotate(18deg);
  transform-origin: bottom;
}

.schedule-intro__copy {
  min-width: 0;
}

.schedule-intro__eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--schedule-accent);
  font-size: 11px;
  font-weight: 750;
  line-height: 1;
}

.schedule-intro__eyebrow svg {
  width: 16px;
  height: 16px;
}

.schedule-intro h2 {
  margin: 10px 0 4px;
  color: var(--schedule-fg);
  font-size: clamp(24px, 4vw, 36px);
  font-weight: 760;
  line-height: 1.1;
}

.schedule-intro p {
  margin: 0;
  color: var(--schedule-muted);
  font-size: 13px;
}

.schedule-intro__summary {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: auto auto;
  align-items: baseline;
  column-gap: 5px;
  flex: none;
  min-width: 92px;
  color: var(--schedule-muted);
}

.schedule-intro__summary strong {
  color: var(--schedule-accent);
  font-size: 32px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.schedule-intro__summary span {
  font-size: 12px;
  font-weight: 650;
}

.schedule-intro__summary small {
  grid-column: 1 / -1;
  margin-top: 5px;
  color: var(--schedule-subtle);
  font-size: 10px;
  text-align: right;
}

.schedule-weeks,
.schedule-days {
  padding: 0;
  margin: 0;
  list-style: none;
}

.schedule-weeks {
  display: grid;
  gap: clamp(16px, 2.4vw, 24px);
  min-width: 0;
}

.schedule-week {
  min-width: 0;
  overflow: hidden;
  background: var(--default-card);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
}

.schedule-week.is-current {
  border-color: var(--schedule-accent-border);
}

.schedule-week__header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  min-width: 0;
  padding: 14px clamp(14px, 2vw, 20px);
  align-items: center;
  gap: 14px;
  background: var(--default-card-embedded);
  border-bottom: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
}

.schedule-week__index {
  display: flex;
  width: 48px;
  height: 48px;
  align-items: center;
  justify-content: center;
  gap: 1px;
  color: color-mix(in srgb, var(--schedule-accent) 20%, var(--schedule-fg));
  background: color-mix(in srgb, var(--schedule-accent) 18%, var(--default-card));
  border: 1px solid var(--schedule-accent-border);
  border-radius: max(4px, calc(var(--vtsuru-page-radius, 8px) - 2px));
}

.schedule-week__index span {
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
}

.schedule-week__index strong {
  font-size: 22px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.schedule-week__title {
  min-width: 0;
}

.schedule-week__label {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
}

.schedule-week__title h3 {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  color: var(--schedule-fg);
  font-size: 15px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-week__title p {
  margin: 3px 0 0;
  color: var(--schedule-muted);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.schedule-week__current {
  flex: none;
  padding: 2px 7px;
  color: var(--schedule-accent);
  font-size: 10px;
  font-weight: 750;
  background: var(--schedule-accent-soft);
  border: 1px solid var(--schedule-accent-border);
  border-radius: 999px;
}

.schedule-week__rhythm {
  display: grid;
  grid-template-columns: repeat(7, 9px);
  height: 24px;
  align-items: end;
  gap: 4px;
}

.schedule-week__rhythm span {
  display: block;
  height: 7px;
  background: color-mix(in srgb, var(--schedule-muted) 20%, transparent);
  border-radius: 2px;
}

.schedule-week__rhythm span.has-event {
  height: 16px;
  background: color-mix(in srgb, var(--schedule-accent) 58%, var(--default-card));
}

.schedule-week__rhythm span.is-today {
  height: 24px;
  background: var(--schedule-accent);
}

.schedule-week__count {
  display: grid;
  padding-left: 14px;
  border-left: 1px solid var(--default-line);
  text-align: right;
}

.schedule-week__count strong {
  color: var(--schedule-fg);
  font-size: 18px;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.schedule-week__count span {
  margin-top: 4px;
  color: var(--schedule-subtle);
  font-size: 10px;
}

.schedule-days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  min-width: 0;
}

.schedule-day {
  display: flex;
  min-width: 0;
  min-height: 132px;
  padding: 14px 10px 12px;
  flex-direction: column;
  gap: 12px;
  background: var(--default-card);
  border-right: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
}

.schedule-day:last-child {
  border-right: 0;
}

.schedule-day.is-today {
  background: color-mix(in srgb, var(--schedule-accent-soft) 62%, var(--default-card));
  box-shadow: inset 0 3px var(--schedule-accent);
}

.schedule-day__header {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.schedule-day__identity {
  display: grid;
  min-width: 0;
}

.schedule-day__identity span {
  color: var(--schedule-subtle);
  font-size: 8px;
  font-weight: 750;
  line-height: 1;
}

.schedule-day__identity strong {
  margin-top: 3px;
  color: var(--schedule-fg);
  font-size: 13px;
  line-height: 1;
}

.schedule-day__header time {
  color: var(--schedule-muted);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.schedule-day__today {
  position: absolute;
  top: -20px;
  right: -4px;
  padding: 2px 5px;
  color: var(--schedule-accent-readable);
  font-size: 9px;
  font-weight: 750;
  background: var(--schedule-accent);
  border-radius: 999px;
}

.schedule-day__events {
  display: grid;
  align-content: start;
  gap: 7px;
}

.schedule-event {
  --event-color: var(--schedule-accent);

  position: relative;
  display: grid;
  min-width: 0;
  padding: 9px 8px 9px 11px;
  gap: 6px;
  overflow: hidden;
  background: color-mix(in srgb, var(--event-color) 5%, var(--default-card-embedded));
  border: 1px solid color-mix(in srgb, var(--event-color) 26%, var(--default-line));
  border-radius: max(4px, calc(var(--vtsuru-page-radius, 8px) - 3px));
}

.schedule-event::before {
  position: absolute;
  inset: 0 auto 0 0;
  width: 3px;
  background: var(--event-color);
  content: '';
}

.schedule-event__meta {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 7px;
}

.schedule-event__time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--schedule-muted);
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  white-space: nowrap;
}

.schedule-event__time svg {
  width: 11px;
  height: 11px;
  color: var(--event-color);
}

.schedule-event__tag {
  min-width: 0;
  padding: 2px 5px;
  overflow: hidden;
  color: color-mix(in srgb, var(--event-color) 76%, var(--schedule-fg));
  font-size: 9px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: color-mix(in srgb, var(--event-color) 12%, transparent);
  border-radius: 3px;
}

.schedule-event > strong {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--schedule-fg);
  font-size: 11px;
  font-weight: 650;
  line-height: 1.45;
}

.schedule-day__rest {
  display: grid;
  min-height: 52px;
  place-content: center;
  justify-items: center;
  color: var(--schedule-subtle);
}

.schedule-day__rest > span {
  width: 22px;
  height: 2px;
  margin-bottom: 10px;
  background: color-mix(in srgb, var(--schedule-muted) 32%, transparent);
  border-radius: 999px;
}

.schedule-day__rest p {
  margin: 0;
  font-size: 11px;
  font-weight: 650;
}

.schedule-day__rest small {
  margin-top: 3px;
  font-size: 9px;
}

.schedule-empty {
  display: grid;
  min-height: 240px;
  padding: 32px;
  place-content: center;
  justify-items: center;
  color: var(--schedule-muted);
  text-align: center;
  background: var(--default-card);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
  border-radius: var(--vtsuru-page-radius, 8px);
  box-shadow: var(--vtsuru-page-shadow);
}

.schedule-empty__icon {
  display: grid;
  width: 42px;
  height: 42px;
  margin-bottom: 14px;
  place-items: center;
  color: var(--schedule-accent);
  background: var(--schedule-accent-soft);
  border-radius: 50%;
}

.schedule-empty__icon svg {
  width: 20px;
  height: 20px;
}

.schedule-empty strong {
  color: var(--schedule-fg);
  font-size: 14px;
}

.schedule-empty p {
  margin: 5px 0 0;
  color: var(--schedule-subtle);
  font-size: 11px;
}

@container default-schedule (max-width: 900px) {
  .schedule-event__time svg {
    display: none;
  }
}

@container default-schedule (max-width: 680px) {
  .schedule-days {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .schedule-day {
    min-height: 144px;
    border-right: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
    border-bottom: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
  }

  .schedule-day:nth-child(2n) {
    border-right: 0;
  }

  .schedule-day:last-child {
    grid-column: 1 / -1;
    border-right: 0;
    border-bottom: 0;
  }
}

@container default-schedule (max-width: 520px) {
  .schedule-intro {
    padding: 16px;
    gap: 14px;
  }

  .schedule-intro::after {
    right: 88px;
  }

  .schedule-intro h2 {
    font-size: 24px;
  }

  .schedule-intro__summary {
    min-width: 70px;
  }

  .schedule-intro__summary strong {
    font-size: 26px;
  }

  .schedule-week__header {
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 10px;
  }

  .schedule-week__rhythm {
    display: none;
  }

  .schedule-week__count {
    padding-left: 10px;
  }

  .schedule-days {
    grid-template-columns: minmax(0, 1fr);
  }

  .schedule-day,
  .schedule-day:last-child {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    grid-column: auto;
    min-height: 104px;
    padding: 12px;
    border-right: 0;
    border-bottom: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--default-line);
  }

  .schedule-day:last-child {
    border-bottom: 0;
  }

  .schedule-day__header {
    display: grid;
    align-content: start;
    justify-content: start;
    border-right: 1px solid var(--default-line);
  }

  .schedule-day__header time {
    margin-top: 6px;
  }

  .schedule-day__today {
    position: static;
    width: fit-content;
    margin-top: 7px;
  }

  .schedule-day__rest {
    min-height: 72px;
  }
}

@container default-schedule (max-width: 390px) {
  .schedule-intro__copy p,
  .schedule-intro__summary small {
    display: none;
  }

  .schedule-intro__eyebrow {
    font-size: 9px;
  }

  .schedule-intro h2 {
    margin-bottom: 0;
  }

  .schedule-week__index {
    width: 42px;
    height: 42px;
  }

  .schedule-week__title h3 {
    font-size: 13px;
  }

  .schedule-week__count {
    display: none;
  }
}
</style>
