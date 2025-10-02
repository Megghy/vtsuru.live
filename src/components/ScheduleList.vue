<script setup lang="ts">
import type { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'
import { Bed20Regular, Clock20Regular } from '@vicons/fluent'
import { useWindowSize } from '@vueuse/core'
import { NBadge, NButton, NCard, NEllipsis, NEmpty, NGrid, NGridItem, NIcon, NList, NListItem, NPopconfirm, NSpace, NText, NTime, useThemeVars } from 'naive-ui'

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
const { width } = useWindowSize()
const themeVars = useThemeVars()

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function getISOWeek(date: Date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNumber = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNumber)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return {
    year: target.getUTCFullYear(),
    week,
  }
}

const currentISOWeek = getISOWeek(new Date())

function isCurrentWeek(year: number, week: number) {
  return year === currentISOWeek.year && week === currentISOWeek.week
}

const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
})

function getWeekRangeLabel(year: number, week: number) {
  const weekStart = getDateFromWeek(year, week, 0)
  const weekEnd = getDateFromWeek(year, week, 6)
  return `${dateFormatter.format(weekStart)} - ${dateFormatter.format(weekEnd)}`
}

function getDateFromWeek(year: number, week: number, dayOfWeek: number): Date {
  // week starts from 1-52, dayOfWeek starts from 0-6 where 0 is Monday
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const ISOweekStart = simple
  if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1)
  else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay())
  return new Date(ISOweekStart.getFullYear(), ISOweekStart.getMonth(), ISOweekStart.getDate() + dayOfWeek)
}
</script>

<template>
  <NEmpty v-if="(schedules?.length ?? 0) == 0" />
  <NList
    v-else
    style="padding: 0"
    bordered
  >
    <NListItem
      v-for="item in schedules"
      :key="`${item.year} ${item.week}`"
      style="padding: 0"
    >
      <NCard
        size="small"
        :bordered="false"
        :style="
          isCurrentWeek(item.year, item.week)
            ? {
                boxShadow: `0 0 0 1px ${themeVars.primaryColorSuppl}99 inset`,
                borderRadius: '8px',
                transition: 'box-shadow 0.2s ease',
              }
            : undefined
        "
      >
        <template #header>
          <div style="display: flex; align-items: center; gap: 8px;">
            <NText> {{ item.year }}年第{{ item.week }}周 </NText>
            <NBadge
              v-if="isCurrentWeek(item.year, item.week)"
              value="本周"
              type="success"
              :style="{
                backgroundColor: `${themeVars.successColor}1f`,
                color: themeVars.successColor,
                borderRadius: '12px',
                padding: '0 8px',
                fontSize: '11px',
                fontWeight: 600,
              }"
            />
            <NText
              depth="3"
              :style="{
                fontSize: '12px',
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }"
            >
              {{ getWeekRangeLabel(item.year, item.week) }}
            </NText>
          </div>
        </template>
        <template
          v-if="isSelf"
          #header-extra
        >
          <NSpace>
            <NButton
              size="small"
              @click="emit('onUpdate', item)"
            >
              编辑
            </NButton>
            <NButton
              size="small"
              @click="emit('onCopy', item)"
            >
              复制
            </NButton>
            <NPopconfirm @positive-click="emit('onDelete', item)">
              <template #trigger>
                <NButton
                  size="small"
                  type="error"
                >
                  删除
                </NButton>
              </template>
              确定删除?
            </NPopconfirm>
          </NSpace>
        </template>
        <NGrid
          x-gap="8"
          y-gap="8"
          cols="1 1200:7"
          style="align-items: stretch;"
        >
          <NGridItem
            v-for="(daySchedules, index) in item.days"
            :key="index"
            style="display: flex;"
          >
            <div style="display: flex; flex-direction: column; height: 100%; width: 100%;">
              <div
                :style="{
                  marginBottom: '6px',
                  padding: '4px 8px',
                  fontSize: '13px',
                  fontWeight: '600',
                  background: `linear-gradient(135deg, ${themeVars.primaryColorSuppl}15 0%, ${themeVars.primaryColorSuppl}25 100%)`,
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }"
              >
                <NTime
                  :time="getDateFromWeek(item.year, item.week, index)"
                  format="MM/dd"
                  :style="{ color: themeVars.primaryColor }"
                />
                <NText>{{ weekdays[index] }}</NText>
              </div>
              <div style="flex: 1; display: flex; flex-direction: column; min-height: 65px;">
                <NCard
                  v-if="daySchedules.length === 0"
                  size="small"
                  :style="{
                    minHeight: '40px',
                    background: `linear-gradient(135deg, ${themeVars.cardColor} 0%, ${themeVars.bodyColor} 100%)`,
                    border: `1px dashed ${themeVars.dividerColor}`,
                    cursor: isSelf ? 'pointer' : 'default',
                    transition: 'all 0.2s ease',
                  }"
                  :hoverable="isSelf"
                  content-style="display: flex; align-items: center; justify-content: center; gap: 4px;"
                  @click="isSelf && $emit('onUpdate', item)"
                >
                  <NIcon :size="14" :component="Bed20Regular" :color="themeVars.textColor3" />
                  <NText
                    depth="3"
                    style="font-size: 11px; font-style: italic;"
                    :style="{ opacity: isSelf ? 0.5 : 0.6 }"
                  >
                    休息
                  </NText>
                </NCard>
                <NSpace
                  v-else
                  vertical
                  :size="4"
                >
                  <NCard
                    v-for="(schedule, scheduleIndex) in daySchedules"
                    :key="schedule.id || `${index}-${scheduleIndex}`"
                    size="small"
                    :style="{
                      backgroundColor: schedule.tagColor ? `${schedule.tagColor}12` : themeVars.cardColor,
                      borderLeft: schedule.tagColor ? `3px solid ${schedule.tagColor}` : `3px solid ${themeVars.dividerColor}`,
                      cursor: isSelf ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      padding: '0',
                    }"
                    :bordered="true"
                    :hoverable="isSelf"
                    content-style="padding: 3px; padding-left: 5px;padding-bottom: 1px;"
                    @click="isSelf && $emit('onEditItem', item, index, schedule)"
                  >
                    <div style="padding: 4px 6px;">
                      <!-- 标签和时间行 (仅当有标签或时间时显示) -->
                      <div
                        v-if="schedule.tag || schedule.time"
                        style="
                        display: flex;
                        align-items: center;
                        gap: 4px;
                        margin-bottom: 3px;
                        flex-wrap: nowrap;
                      "
                      >
                        <!-- 标签 -->
                        <div
                          v-if="schedule.tag"
                          :style="{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: schedule.tagColor ? `${schedule.tagColor}22` : `${themeVars.primaryColorSuppl}22`,
                            flexShrink: 0,
                          }"
                        >
                          <NBadge
                            v-if="schedule.tagColor"
                            dot
                            :color="schedule.tagColor"
                            :style="{ transform: 'scale(0.85)' }"
                          />
                          <NText
                            :style="{
                              color: schedule.tagColor || themeVars.primaryColor,
                              fontWeight: '600',
                              fontSize: '10.5px',
                              whiteSpace: 'nowrap',
                              lineHeight: '1.2',
                            }"
                          >
                            {{ schedule.tag }}
                          </NText>
                        </div>
                        <!-- 时间 -->
                        <div
                          v-if="schedule.time"
                          :style="{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            flexShrink: 0,
                          }"
                        >
                          <NIcon :size="12" :component="Clock20Regular" :color="themeVars.textColor3" />
                          <NText
                            depth="2"
                            :style="{
                              fontSize: '10.5px',
                              fontFamily: 'monospace',
                              whiteSpace: 'nowrap',
                              fontWeight: '500',
                            }"
                          >
                            {{ schedule.time }}
                          </NText>
                        </div>
                        <!-- 删除按钮 -->
                        <NButton
                          v-if="isSelf"
                          size="tiny"
                          type="error"
                          quaternary
                          circle
                          style="margin-left: auto; flex-shrink: 0; width: 18px; height: 18px; padding: 0;"
                          @click.stop="$emit('onDeleteItem', item, index, schedule)"
                        >
                          <template #icon>
                            <span style="font-size: 14px; line-height: 1;">×</span>
                          </template>
                        </NButton>
                      </div>
                      <!-- 内容 -->
                      <div v-if="schedule?.title">
                        <NEllipsis :line-clamp="2">
                          <NText
                            :style="{
                              fontSize: '12.5px',
                              lineHeight: '1.4',
                              color: themeVars.textColor2,
                            }"
                          >
                            {{ schedule.title }}
                          </NText>
                        </NEllipsis>
                      </div>
                      <!-- 如果既没有标签也没有时间，但有删除按钮 -->
                      <div
                        v-if="!schedule.tag && !schedule.time && isSelf && !schedule?.title"
                        style="display: flex; justify-content: flex-end;"
                      >
                        <NButton
                          size="tiny"
                          type="error"
                          quaternary
                          circle
                          style="width: 18px; height: 18px; padding: 0;"
                          @click.stop="$emit('onDeleteItem', item, index, schedule)"
                        >
                          <template #icon>
                            <span style="font-size: 14px; line-height: 1;">×</span>
                          </template>
                        </NButton>
                      </div>
                    </div>
                  </NCard>
                </NSpace>
              </div>
            </div>
          </NGridItem>
        </NGrid>
      </NCard>
    </NListItem>
  </NList>
  <NGrid v-if="width > 1000" />
</template>
