<script setup lang="ts">
import { Bed20Regular, Clock20Regular } from '@vicons/fluent'
import { format } from 'date-fns'

import type { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Popconfirm } from '@/shared/ui/popconfirm'

defineProps<{
  schedules: ScheduleWeekInfo[]
  isSelf: boolean
}>()

const emit = defineEmits<{
  (e: 'onUpdate', schedule: ScheduleWeekInfo): void
  (e: 'onDelete', schedule: ScheduleWeekInfo): void
  (e: 'onCopy', schedule: ScheduleWeekInfo): void
  (e: 'onEditItem', schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo): void
  (e: 'onDeleteItem', schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo): void
}>()

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const MILLISECONDS_PER_DAY = 86400000

function getISOWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / MILLISECONDS_PER_DAY + 1) / 7)
  return { year: target.getUTCFullYear(), week }
}

const now = new Date()
const currentISOWeek = getISOWeek(now)
const currentDayOfWeek = (now.getDay() + 6) % 7

function isCurrentWeek(year: number, week: number) {
  return year === currentISOWeek.year && week === currentISOWeek.week
}

function isCurrentDay(year: number, week: number, dayIndex: number) {
  if (!isCurrentWeek(year, week)) return false
  return dayIndex === currentDayOfWeek
}

function getDateFromWeek(year: number, week: number, dayOfWeek: number): Date {
  const januaryFourth = new Date(year, 0, 4)
  const startOfWeekOne = new Date(januaryFourth)
  const dayOfWeekJan4 = (januaryFourth.getDay() + 6) % 7
  startOfWeekOne.setDate(januaryFourth.getDate() - dayOfWeekJan4)

  const targetDate = new Date(startOfWeekOne)
  targetDate.setDate(startOfWeekOne.getDate() + (week - 1) * 7 + dayOfWeek)
  return targetDate
}

function getWeekRangeLabel(year: number, week: number) {
  const weekStart = getDateFromWeek(year, week, 0)
  const weekEnd = getDateFromWeek(year, week, 6)
  return `${format(weekStart, 'MM/dd')} - ${format(weekEnd, 'MM/dd')}`
}
</script>

<template>
  <Empty
    v-if="(schedules?.length ?? 0) === 0"
    description="暂无日程"
    class="py-12"
  />

  <div
    v-else
    class="space-y-4"
  >
    <Card
      v-for="item in schedules"
      :key="`${item.year} ${item.week}`"
      class="border border-border/80 transition-shadow"
      :class="{ 'ring-1 ring-primary/40': isCurrentWeek(item.year, item.week) }"
    >
      <CardHeader
        class="p-3.5 pb-2.5 border-b border-border/60 flex flex-row items-center justify-between space-y-0 gap-2"
      >
        <div class="flex items-center gap-2 flex-wrap">
          <span class="font-semibold text-sm text-foreground">{{ item.year }}年第{{ item.week }}周</span>
          <Badge
            v-if="isCurrentWeek(item.year, item.week)"
            variant="default"
            class="text-[10px] h-4.5 px-1.5 font-normal bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
          >
            本周
          </Badge>
          <span class="text-xs text-muted-foreground font-mono">
            {{ getWeekRangeLabel(item.year, item.week) }}
          </span>
        </div>

        <div
          v-if="isSelf"
          class="flex items-center gap-1.5"
        >
          <Button
            variant="outline"
            @click="emit('onUpdate', item)"
          >
            编辑
          </Button>
          <Button
            variant="outline"
            @click="emit('onCopy', item)"
          >
            复制
          </Button>
          <Popconfirm
            title="确定删除整周日程吗?"
            positive-text="删除"
            negative-text="取消"
            @positive-click="emit('onDelete', item)"
          >
            <template #trigger>
              <Button variant="destructive"> 删除 </Button>
            </template>
            确定删除整周日程吗?
          </Popconfirm>
        </div>
      </CardHeader>

      <CardContent class="p-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 items-stretch">
          <div
            v-for="(daySchedules, index) in item.days"
            :key="index"
            class="flex flex-col min-w-0"
          >
            <!-- 星期头部 -->
            <div
              class="mb-1.5 px-2 py-1 rounded text-xs flex items-center justify-between gap-1 transition"
              :class="
                isCurrentDay(item.year, item.week, index)
                  ? 'bg-primary/15 text-primary font-semibold ring-1 ring-primary/40'
                  : 'bg-muted/50 text-muted-foreground font-medium'
              "
            >
              <span>{{ format(getDateFromWeek(item.year, item.week, index), 'MM/dd') }}</span>
              <span>{{ weekdays[index] }}</span>
            </div>

            <!-- 每日日程卡片列表 -->
            <div class="flex-1 flex flex-col min-h-[64px] gap-1">
              <div
                v-if="daySchedules.length === 0"
                class="flex-1 min-h-[40px] rounded border border-dashed border-border/80 flex items-center justify-center gap-1 text-muted-foreground/60 transition"
                :class="isSelf ? 'hover:bg-muted/30 cursor-pointer' : ''"
                @click="isSelf && emit('onUpdate', item)"
              >
                <component
                  :is="Bed20Regular"
                  class="size-3.5"
                />
                <span class="text-[11px] italic">休息</span>
              </div>

              <template v-else>
                <div
                  v-for="(schedule, scheduleIndex) in daySchedules"
                  :key="schedule.id || `${index}-${scheduleIndex}`"
                  class="p-2 rounded border border-border/80 text-xs space-y-1 transition group"
                  :class="isSelf ? 'hover:bg-muted/30 cursor-pointer' : ''"
                  :style="{
                    borderLeftWidth: '3px',
                    borderLeftColor: schedule.tagColor || 'var(--primary)',
                    backgroundColor: schedule.tagColor ? `${schedule.tagColor}10` : undefined,
                  }"
                  @click="isSelf && emit('onEditItem', item, index, schedule)"
                >
                  <div
                    v-if="schedule.tag || schedule.time || isSelf"
                    class="flex items-center justify-between gap-1"
                  >
                    <div class="flex items-center gap-1 min-w-0 flex-wrap">
                      <span
                        v-if="schedule.tag"
                        class="px-1 py-0.2 rounded text-[10px] font-medium truncate shrink-0"
                        :style="{
                          backgroundColor: schedule.tagColor ? `${schedule.tagColor}25` : 'var(--primary)',
                          color: schedule.tagColor || 'inherit',
                        }"
                      >
                        {{ schedule.tag }}
                      </span>
                      <span
                        v-if="schedule.time"
                        class="text-[10px] text-muted-foreground font-mono flex items-center gap-0.5 shrink-0"
                      >
                        <component
                          :is="Clock20Regular"
                          class="size-3 inline"
                        />
                        {{ schedule.time }}
                      </span>
                    </div>

                    <button
                      v-if="isSelf"
                      type="button"
                      class="size-4 rounded-full text-muted-foreground hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition shrink-0"
                      title="删除单条"
                      @click.stop="emit('onDeleteItem', item, index, schedule)"
                    >
                      ×
                    </button>
                  </div>

                  <p
                    v-if="schedule?.title"
                    class="m-0 text-xs text-foreground font-medium line-clamp-2 leading-snug"
                    :title="schedule.title"
                  >
                    {{ schedule.title }}
                  </p>
                </div>
              </template>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
