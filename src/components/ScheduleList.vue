<script setup lang="ts">
import { ref } from 'vue'

import type { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'

const props = defineProps<{
  schedules: ScheduleWeekInfo[]
  isSelf: boolean
}>()

const emit = defineEmits<{
  onUpdate: [schedule: ScheduleWeekInfo]
  onDelete: [schedule: ScheduleWeekInfo]
  onCopy: [schedule: ScheduleWeekInfo]
  onEditItem: [schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo]
  onDeleteItem: [schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo]
}>()

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const now = new Date()
const currentISOWeek = getISOWeek(now)
const currentDayOfWeek = (now.getDay() + 6) % 7
const deleteCandidate = ref<ScheduleWeekInfo>()
const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' })

function getISOWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))

  return {
    year: target.getUTCFullYear(),
    week: Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7),
  }
}

function getDateFromWeek(year: number, week: number, dayOfWeek: number): Date {
  const januaryFourth = new Date(year, 0, 4)
  const startOfWeekOne = new Date(januaryFourth)
  startOfWeekOne.setDate(januaryFourth.getDate() - ((januaryFourth.getDay() + 6) % 7))

  const targetDate = new Date(startOfWeekOne)
  targetDate.setDate(startOfWeekOne.getDate() + (week - 1) * 7 + dayOfWeek)
  return targetDate
}

function isCurrentWeek(year: number, week: number) {
  return year === currentISOWeek.year && week === currentISOWeek.week
}

function isCurrentDay(year: number, week: number, dayIndex: number) {
  return isCurrentWeek(year, week) && dayIndex === currentDayOfWeek
}

function getWeekRangeLabel(year: number, week: number) {
  return `${dateFormatter.format(getDateFromWeek(year, week, 0))} - ${dateFormatter.format(getDateFromWeek(year, week, 6))}`
}

function getDayLabel(year: number, week: number, dayIndex: number) {
  return dateFormatter.format(getDateFromWeek(year, week, dayIndex))
}

function editSchedule(week: ScheduleWeekInfo, dayIndex: number, schedule: ScheduleDayInfo) {
  if (props.isSelf) emit('onEditItem', week, dayIndex, schedule)
}

function confirmWeekDelete() {
  if (!deleteCandidate.value) return
  emit('onDelete', deleteCandidate.value)
  deleteCandidate.value = undefined
}
</script>

<template>
  <UEmpty
    v-if="schedules.length === 0"
    title="暂无直播日程"
  />
  <div
    v-else
    class="schedule-list"
  >
    <UCard
      v-for="weekSchedule in schedules"
      :key="`${weekSchedule.year}-${weekSchedule.week}`"
      class="schedule-list__week"
      :class="{ 'schedule-list__week--current': isCurrentWeek(weekSchedule.year, weekSchedule.week) }"
    >
      <template #header>
        <div class="schedule-list__week-header">
          <div class="schedule-list__week-title">
            <strong>{{ weekSchedule.year }}年第{{ weekSchedule.week }}周</strong>
            <UBadge
              v-if="isCurrentWeek(weekSchedule.year, weekSchedule.week)"
              color="success"
              variant="subtle"
              size="xs"
              label="本周"
            />
            <span>{{ getWeekRangeLabel(weekSchedule.year, weekSchedule.week) }}</span>
          </div>
          <div
            v-if="isSelf"
            class="schedule-list__week-actions"
          >
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              label="编辑"
              @click="emit('onUpdate', weekSchedule)"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              label="复制"
              @click="emit('onCopy', weekSchedule)"
            />
            <UButton
              size="xs"
              color="error"
              variant="ghost"
              label="删除"
              @click="deleteCandidate = weekSchedule"
            />
          </div>
        </div>
      </template>

      <div class="schedule-list__days">
        <section
          v-for="(daySchedules, dayIndex) in weekSchedule.days"
          :key="dayIndex"
          class="schedule-list__day"
        >
          <header
            class="schedule-list__day-header"
            :class="{
              'schedule-list__day-header--current': isCurrentDay(weekSchedule.year, weekSchedule.week, dayIndex),
            }"
          >
            <span>{{ getDayLabel(weekSchedule.year, weekSchedule.week, dayIndex) }}</span>
            <strong>{{ weekdays[dayIndex] }}</strong>
            <span
              v-if="isCurrentDay(weekSchedule.year, weekSchedule.week, dayIndex)"
              class="schedule-list__today-dot"
            />
          </header>

          <button
            v-if="daySchedules.length === 0"
            type="button"
            class="schedule-list__rest"
            :disabled="!isSelf"
            @click="emit('onUpdate', weekSchedule)"
          >
            <UIcon name="i-lucide-bed-double" />
            休息
          </button>

          <div
            v-else
            class="schedule-list__entries"
          >
            <article
              v-for="(schedule, scheduleIndex) in daySchedules"
              :key="schedule.id || `${dayIndex}-${scheduleIndex}`"
              class="schedule-list__entry"
              :class="{ 'schedule-list__entry--editable': isSelf }"
              :style="{ '--schedule-tag-color': schedule.tagColor || 'var(--schedule-list-border)' }"
              :tabindex="isSelf ? 0 : undefined"
              :role="isSelf ? 'button' : undefined"
              @click="editSchedule(weekSchedule, dayIndex, schedule)"
              @keydown.enter.prevent="editSchedule(weekSchedule, dayIndex, schedule)"
              @keydown.space.prevent="editSchedule(weekSchedule, dayIndex, schedule)"
            >
              <div
                v-if="schedule.tag || schedule.time || isSelf"
                class="schedule-list__entry-meta"
              >
                <span
                  v-if="schedule.tag"
                  class="schedule-list__entry-tag"
                >
                  <span
                    v-if="schedule.tagColor"
                    class="schedule-list__entry-tag-dot"
                    :style="{ background: schedule.tagColor }"
                  />
                  {{ schedule.tag }}
                </span>
                <span
                  v-if="schedule.time"
                  class="schedule-list__entry-time"
                >
                  <UIcon name="i-lucide-clock-3" />
                  {{ schedule.time }}
                </span>
                <UButton
                  v-if="isSelf"
                  class="schedule-list__entry-delete"
                  color="error"
                  variant="ghost"
                  size="xs"
                  square
                  icon="i-lucide-x"
                  @click.stop="emit('onDeleteItem', weekSchedule, dayIndex, schedule)"
                />
              </div>
              <p v-if="schedule.title">{{ schedule.title }}</p>
            </article>
          </div>
        </section>
      </div>
    </UCard>
  </div>

  <UModal
    :open="deleteCandidate != null"
    title="删除日程"
    @update:open="!$event && (deleteCandidate = undefined)"
  >
    <template #body>确定删除该周日程？</template>
    <template #footer>
      <div class="schedule-list__dialog-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="deleteCandidate = undefined"
        />
        <UButton
          color="error"
          label="确认删除"
          @click="confirmWeekDelete"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.schedule-list {
  --schedule-list-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --schedule-list-muted: var(--vtsuru-block-fg-muted, var(--vtsuru-surface-fg-muted, var(--vtsuru-fg-muted)));
  --schedule-list-bg: var(
    --vtsuru-block-bg-muted,
    var(--user-page-theme-surface-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-muted)))
  );
  --schedule-list-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --schedule-list-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));
  display: grid;
  gap: var(--vtsuru-page-spacing, 16px);
  min-width: 0;
  color: var(--schedule-list-fg);
}

.schedule-list__week--current {
  box-shadow: inset 0 0 0 1px var(--schedule-list-accent);
}

.schedule-list__week-header,
.schedule-list__week-title,
.schedule-list__week-actions,
.schedule-list__entry-meta,
.schedule-list__entry-time,
.schedule-list__dialog-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.schedule-list__week-header {
  justify-content: space-between;
}

.schedule-list__week-title span {
  color: var(--schedule-list-muted);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.schedule-list__days {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}

.schedule-list__day {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 6px;
}

.schedule-list__day-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border-radius: var(--vtsuru-page-radius, 8px);
  color: var(--schedule-list-muted);
  background: color-mix(in srgb, var(--schedule-list-accent) 8%, var(--schedule-list-bg));
  font-size: 13px;
}

.schedule-list__day-header--current {
  color: var(--vtsuru-page-primary-readable, var(--schedule-list-accent));
  box-shadow: inset 0 0 0 1px var(--schedule-list-accent);
}

.schedule-list__today-dot,
.schedule-list__entry-tag-dot {
  flex: none;
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.schedule-list__today-dot {
  margin-left: auto;
  background: var(--schedule-list-accent);
}

.schedule-list__rest,
.schedule-list__entry {
  width: 100%;
  min-width: 0;
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--schedule-list-border);
  border-radius: var(--vtsuru-page-radius, 8px);
  color: var(--schedule-list-fg);
  background: color-mix(in srgb, var(--schedule-list-bg) 90%, transparent);
}

.schedule-list__rest {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 56px;
  color: var(--schedule-list-muted);
  font: inherit;
  font-size: 12px;
  font-style: italic;
}

.schedule-list__rest:not(:disabled),
.schedule-list__entry--editable {
  cursor: pointer;
}

.schedule-list__rest:not(:disabled):hover,
.schedule-list__entry--editable:hover {
  box-shadow: var(--vtsuru-page-shadow);
}

.schedule-list__entries {
  display: grid;
  gap: 4px;
}

.schedule-list__entry {
  border-left: 3px solid var(--schedule-tag-color);
  padding: 6px 8px;
}

.schedule-list__entry-meta {
  min-height: 18px;
}

.schedule-list__entry-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 5px;
  border-radius: var(--vtsuru-page-radius, 8px);
  background: color-mix(in srgb, var(--schedule-tag-color) 16%, transparent);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.schedule-list__entry-time {
  color: var(--schedule-list-muted);
  font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
  font-size: 11px;
}

.schedule-list__entry-delete {
  margin-left: auto;
}

.schedule-list__entry p {
  display: -webkit-box;
  margin: 3px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 13px;
  line-height: 1.4;
}

.schedule-list__dialog-actions {
  justify-content: flex-end;
}

@media (max-width: 1080px) {
  .schedule-list__days {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 720px) {
  .schedule-list__days {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 400px) {
  .schedule-list__week-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .schedule-list__days {
    grid-template-columns: 1fr;
  }
}
</style>
