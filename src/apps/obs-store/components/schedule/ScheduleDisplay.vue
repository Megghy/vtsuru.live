<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'
import { CalendarDays, Clock, Coffee } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import type { ResponseScheduleModel } from '@/api/generated/model'
import { getApiScheduleGet } from '@/api/generated/schedule/schedule'
import { resolveObsSyncChannel, useObsBridge } from '@/apps/obs-store/sync'
import { resolveFontFamilyCss, useGoogleFont } from '@/apps/user-page/googleFonts'
import {
  buildScheduleDays,
  getCurrentWeekOrder,
  getWeekDateRange,
  getWeekOrder,
  useScheduleNow,
} from '@/apps/user/pages/scheduleTemplate/scheduleTemplateUtils'

import { createSampleScheduleWeek, DEFAULT_SCHEDULE_STATE } from './types'
import type { ScheduleWidgetAction, ScheduleWidgetState } from './types'

const props = defineProps<{
  channelId?: string
  userId?: number
  inlineMode?: boolean
  noShadow?: boolean
}>()

const route = useRoute()
const targetChannel = computed(() => resolveObsSyncChannel(props.channelId ?? route.query.channel))

const {
  state,
  onAction,
  userId: resolvedUserId,
} = useObsBridge<ScheduleWidgetState, ScheduleWidgetAction>({
  componentId: 'schedule',
  channelId: targetChannel,
  userId: () => props.userId,
  defaultState: DEFAULT_SCHEDULE_STATE,
  role: 'viewer',
})

useGoogleFont(computed(() => state.value.fontFamily || undefined))
const customFontCss = computed(() => resolveFontFamilyCss(state.value.fontFamily))

const now = useScheduleNow()
const weeks = ref<ResponseScheduleModel[]>([])
const isLoading = ref(false)
const hasFetched = ref(false)
let requestSeq = 0

async function fetchSchedules() {
  const uid = resolvedUserId.value
  if (!uid) {
    weeks.value = []
    hasFetched.value = true
    return
  }
  const seq = ++requestSeq
  isLoading.value = true
  try {
    const res = await getApiScheduleGet({ id: String(uid) })
    if (seq !== requestSeq) return
    weeks.value = res.code === 200 && Array.isArray(res.data) ? res.data : []
  } catch {
    if (seq !== requestSeq) return
    weeks.value = []
  } finally {
    if (seq === requestSeq) {
      isLoading.value = false
      hasFetched.value = true
    }
  }
}

watch(
  resolvedUserId,
  () => {
    void fetchSchedules()
  },
  { immediate: true },
)

const refreshMs = computed(() => Math.max(1, Math.min(60, Number(state.value.refreshIntervalMinutes) || 10)) * 60_000)

useIntervalFn(() => {
  if (!state.value.useSampleData) {
    void fetchSchedules()
  }
}, refreshMs)

onMounted(() => {
  onAction((action) => {
    if (action.type === 'REFRESH') {
      void fetchSchedules()
    }
  })
})

const currentWeekOrder = computed(() => getCurrentWeekOrder(now.value))

const activeWeek = computed<ResponseScheduleModel | null>(() => {
  if (state.value.useSampleData) {
    return createSampleScheduleWeek(now.value)
  }
  if (!weeks.value.length) return null
  return (
    weeks.value.find((week) => getWeekOrder(week.year, week.week) === currentWeekOrder.value) ?? weeks.value[0] ?? null
  )
})

const allDays = computed(() => (activeWeek.value ? buildScheduleDays(activeWeek.value, now.value) : []))

const visibleDays = computed(() => {
  if (!state.value.hideEmptyDays) return allDays.value
  return allDays.value.filter((day) => day.items.length > 0)
})

const weekRangeLabel = computed(() =>
  activeWeek.value ? getWeekDateRange(activeWeek.value.year, activeWeek.value.week) : '',
)

const headerSubtitle = computed(() => state.value.subtitle.trim() || weekRangeLabel.value)
const restText = computed(() => state.value.restDayText.trim() || '休息日')
</script>

<template>
  <div
    class="schedule-obs-root"
    :class="[
      `theme-${state.theme}`,
      `layout-${state.layout}`,
      {
        'is-inline': props.inlineMode,
        'no-shadow': props.noShadow,
      },
    ]"
    :style="{ '--widget-accent': state.accentColor, fontFamily: customFontCss }"
  >
    <div class="schedule-shell">
      <!-- 顶部标题栏 -->
      <header class="schedule-header">
        <div class="header-left">
          <span class="header-icon">
            <CalendarDays class="icon-svg" />
          </span>
          <div class="header-titles">
            <div class="header-title-row">
              <span class="header-title">{{ state.title || '本周直播日程' }}</span>
              <span
                v-if="state.useSampleData"
                class="sample-pill"
              >
                示例
              </span>
            </div>
            <span
              v-if="headerSubtitle"
              class="header-subtitle"
            >
              {{ headerSubtitle }}
            </span>
          </div>
        </div>
      </header>

      <!-- 空态 -->
      <div
        v-if="!activeWeek && hasFetched && !isLoading"
        class="schedule-empty"
      >
        <Coffee class="empty-icon" />
        <span class="empty-title">暂未排定本周直播日程</span>
        <span class="empty-hint">可在直播日程管理页添加，或开启「示例数据预览」排版</span>
      </div>

      <!-- 隐藏空日程日后无可展示项 -->
      <div
        v-else-if="activeWeek && visibleDays.length === 0"
        class="schedule-empty"
      >
        <Coffee class="empty-icon" />
        <span class="empty-title">本周暂无安排</span>
      </div>

      <!-- 日程主体：list / cards / strip -->
      <div
        v-else-if="activeWeek"
        class="schedule-grid"
        :style="
          state.layout === 'strip'
            ? { gridTemplateColumns: `repeat(${Math.max(1, visibleDays.length)}, minmax(0, 1fr))` }
            : undefined
        "
      >
        <article
          v-for="day in visibleDays"
          :key="day.isoDate"
          class="day-entry"
          :class="{
            'is-today': state.highlightToday && day.isToday,
            'is-empty': day.items.length === 0,
            'is-past': day.isPast && !day.isToday,
          }"
        >
          <div class="day-head">
            <div class="day-label-group">
              <span class="day-weekday">{{ day.label }}</span>
              <span class="day-date">{{ day.date }}</span>
            </div>
            <span
              v-if="state.highlightToday && day.isToday"
              class="today-badge"
            >
              TODAY
            </span>
          </div>

          <div
            v-if="day.items.length > 0"
            class="day-items"
          >
            <div
              v-for="(item, idx) in day.items"
              :key="item.id || `${day.isoDate}-${idx}`"
              class="schedule-item"
            >
              <div class="item-meta">
                <span
                  v-if="item.time"
                  class="item-time"
                >
                  <Clock class="time-icon" />
                  {{ item.time }}
                </span>
                <span
                  v-if="item.tag"
                  class="item-tag"
                  :style="item.tagColor ? { '--tag-color': item.tagColor } : undefined"
                >
                  {{ item.tag }}
                </span>
              </div>
              <div class="item-title">{{ item.title || '待定内容' }}</div>
            </div>
          </div>

          <div
            v-else
            class="day-rest"
          >
            <span>{{ restText }}</span>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-obs-root {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 6px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  user-select: none;
  color: #f8fafc;
}

.schedule-shell {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
}

.layout-list .schedule-shell {
  max-width: 440px;
}

.layout-cards .schedule-shell {
  max-width: 520px;
}

.layout-strip .schedule-shell {
  max-width: 100%;
  gap: 8px;
}

/* 主题 1: card */
.theme-card .schedule-shell {
  background: rgba(15, 18, 26, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(12px);
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
}

/* 主题 2: minimal */
.theme-minimal .schedule-shell {
  background: transparent;
  border: none;
  padding: 6px 8px;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.88);
}

/* 主题 3: neon */
.theme-neon .schedule-shell {
  background: rgba(9, 10, 18, 0.94);
  border: 1px solid var(--widget-accent);
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow:
    0 0 18px color-mix(in srgb, var(--widget-accent) 45%, transparent),
    inset 0 0 12px color-mix(in srgb, var(--widget-accent) 16%, transparent);
}

/* 主题 4: glass */
.theme-glass .schedule-shell {
  background: rgba(255, 255, 255, 0.13);
  border: 1px solid rgba(255, 255, 255, 0.28);
  backdrop-filter: blur(18px);
  border-radius: 16px;
  padding: 14px 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.28);
}

.no-shadow .schedule-shell {
  box-shadow: none !important;
}

/* 头部 */
.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.layout-strip .schedule-header {
  padding-bottom: 6px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}

.header-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--widget-accent) 22%, transparent);
  color: var(--widget-accent);
  flex-shrink: 0;
}

.layout-strip .header-icon {
  width: 22px;
  height: 22px;
  border-radius: 6px;
}

.icon-svg {
  width: 15px;
  height: 15px;
}

.layout-strip .icon-svg {
  width: 13px;
  height: 13px;
}

.header-titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.layout-strip .header-titles {
  flex-direction: row;
  align-items: baseline;
  gap: 10px;
}

.header-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.header-title {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-subtitle {
  font-size: 11px;
  color: rgba(226, 232, 240, 0.72);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sample-pill {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--widget-accent) 24%, transparent);
  color: var(--widget-accent);
}

/* 布局网格 */
.schedule-grid {
  display: grid;
  gap: 6px;
}

.layout-list .schedule-grid {
  grid-template-columns: minmax(0, 1fr);
}

.layout-cards .schedule-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.layout-strip .schedule-grid {
  gap: 6px;
}

/* 单日条目 */
.day-entry {
  border-radius: 9px;
  padding: 7px 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  transition:
    background-color 180ms ease,
    border-color 180ms ease,
    opacity 180ms ease;
}

.theme-minimal .day-entry {
  background: rgba(12, 14, 20, 0.42);
  border-color: rgba(255, 255, 255, 0.14);
}

.layout-list .day-entry {
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
}

.layout-list .day-head {
  width: 74px;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.day-entry.is-past {
  opacity: 0.62;
}

.day-entry.is-today {
  opacity: 1;
  background: color-mix(in srgb, var(--widget-accent) 16%, rgba(15, 23, 42, 0.55));
  border-color: color-mix(in srgb, var(--widget-accent) 72%, rgba(255, 255, 255, 0.2));
}

.theme-neon .day-entry.is-today {
  box-shadow: 0 0 10px color-mix(in srgb, var(--widget-accent) 36%, transparent);
}

.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.day-label-group {
  display: flex;
  align-items: baseline;
  gap: 5px;
}

.day-weekday {
  font-size: 12px;
  font-weight: 700;
  color: #ffffff;
}

.day-entry.is-today .day-weekday {
  color: var(--widget-accent);
}

.day-date {
  font-size: 10px;
  color: rgba(203, 213, 225, 0.72);
  font-variant-numeric: tabular-nums;
}

.today-badge {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--widget-accent);
  color: #090d16;
  text-shadow: none;
}

.day-items {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.schedule-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.item-time {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--widget-accent);
}

.time-icon {
  width: 11px;
  height: 11px;
  opacity: 0.85;
}

.item-tag {
  --tag-color: var(--widget-accent);
  font-size: 10px;
  font-weight: 700;
  padding: 0 5px;
  line-height: 16px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--tag-color) 22%, transparent);
  color: color-mix(in srgb, var(--tag-color) 85%, #ffffff);
  border: 1px solid color-mix(in srgb, var(--tag-color) 42%, transparent);
  text-shadow: none;
}

.item-title {
  font-size: 12px;
  font-weight: 600;
  color: #f1f5f9;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.layout-list .item-title {
  -webkit-line-clamp: 1;
}

.layout-strip .day-entry {
  padding: 7px 8px;
}

.layout-strip .item-title {
  font-size: 11px;
  -webkit-line-clamp: 2;
}

.day-rest {
  flex: 1;
  display: flex;
  align-items: center;
  font-size: 11px;
  color: rgba(148, 163, 184, 0.78);
  padding: 2px 0;
}

.schedule-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  padding: 22px 12px;
  color: rgba(203, 213, 225, 0.82);
}

.empty-icon {
  width: 22px;
  height: 22px;
  color: var(--widget-accent);
  margin-bottom: 2px;
}

.empty-title {
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
}

.empty-hint {
  font-size: 11px;
  color: rgba(148, 163, 184, 0.85);
}
</style>
