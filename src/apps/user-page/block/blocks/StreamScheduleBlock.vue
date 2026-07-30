<script setup lang="ts">
import { CalendarNumberOutline, RefreshOutline } from '@vicons/ionicons5'
import { NAlert, NButton, NIcon, NSpin, NTag } from 'naive-ui'
import { computed, onMounted, watch } from 'vue'

import type { ScheduleDayInfo, ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import ScheduleSubscription from '@/components/ScheduleSubscription.vue'
import { SCHEDULE_API_URL } from '@/shared/config'

import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  layout: 'list' | 'table'
  weeksCount: number
  showIcs: boolean
  highlightToday: boolean
  showTag: boolean
  framed: boolean
  backgrounded: boolean
}

interface ScheduleRow {
  key: string
  year: number
  week: number
  dayIndex: number
  title: string
  tag: string
  tagColor: string
  time: string
  isToday: boolean
}

const props = defineProps<{ blockProps: unknown; userInfo?: UserInfo; biliInfo?: unknown }>()

const cfg = computed<BlockConfig>(() => {
  const o =
    props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps)
      ? (props.blockProps as Record<string, unknown>)
      : {}
  const weeksCount = Number(o.weeksCount)
  return {
    layout: o.layout === 'table' ? 'table' : 'list',
    weeksCount: Number.isInteger(weeksCount) ? Math.min(8, Math.max(1, weeksCount)) : 1,
    showIcs: typeof o.showIcs === 'boolean' ? o.showIcs : true,
    highlightToday: typeof o.highlightToday === 'boolean' ? o.highlightToday : true,
    showTag: typeof o.showTag === 'boolean' ? o.showTag : true,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const scheduleQuery = useUserPageRuntimeQuery<ScheduleWeekInfo[]>({
  key: () => `schedule:${props.userInfo?.id ?? ''}`,
  ttlMs: 60_000,
  loader: async (signal) => {
    const userId = props.userInfo?.id
    if (!userId) return []
    const response = await QueryGetAPI<ScheduleWeekInfo[]>(
      `${SCHEDULE_API_URL}get`,
      { id: userId, _ts: Date.now() },
      undefined,
      { signal },
    )
    if (response.code !== 200) throw new Error(response.message || `HTTP ${response.code}`)
    return Array.isArray(response.data) ? response.data : []
  },
})

const loading = computed(() => scheduleQuery.status.value === 'loading')
const failed = computed(() => scheduleQuery.status.value === 'error')
const allWeeks = computed(() => scheduleQuery.data.value ?? [])

async function loadSchedule(force = false) {
  if (!props.userInfo?.id) {
    scheduleQuery.cancel()
    return
  }
  try {
    await scheduleQuery.execute(force)
  } catch (error) {
    console.error('加载直播日程失败', error)
  }
}

onMounted(() => {
  void loadSchedule()
})
watch(
  () => props.userInfo?.id,
  () => {
    void loadSchedule()
  },
)

function dayLabel(dayIndex: number) {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayIndex] ?? ''
}

function normalizeItem(item: ScheduleDayInfo) {
  return {
    title: typeof item.title === 'string' ? item.title : '',
    tag: typeof item.tag === 'string' ? item.tag : '',
    tagColor: typeof item.tagColor === 'string' ? item.tagColor : '',
    time: typeof item.time === 'string' ? item.time : '',
  }
}

const rows = computed<ScheduleRow[]>(() => {
  const today = new Date().getDay() || 7
  return allWeeks.value.slice(0, cfg.value.weeksCount).flatMap((week, weekIndex) => {
    const days = Array.isArray(week.days) ? week.days : []
    return days.flatMap((items, dayIndex) => {
      const list = Array.isArray(items) ? items : []
      return list.flatMap((item, itemIndex) => {
        const value = normalizeItem(item)
        if (!value.title && !value.time && !value.tag) return []
        return [
          {
            key: `${week.year}-${week.week}-${dayIndex}-${itemIndex}`,
            year: week.year,
            week: week.week,
            dayIndex,
            ...value,
            isToday: weekIndex === 0 && dayIndex === today - 1,
          },
        ]
      })
    })
  })
})

const icsUrl = computed(() => (props.userInfo?.id ? `${SCHEDULE_API_URL}${props.userInfo.id}.ics` : ''))
</script>

<template>
  <BlockCard
    class="schedule-card"
    :framed="cfg.framed"
    :backgrounded="cfg.backgrounded"
    :content-style="{ padding: 0 }"
  >
    <section
      class="schedule"
      aria-labelledby="schedule-title"
    >
      <header class="schedule-header">
        <div class="header-title-wrap">
          <NIcon size="20">
            <CalendarNumberOutline />
          </NIcon>
          <h2 id="schedule-title">直播日程</h2>
        </div>
        <span class="week-count">未来 {{ cfg.weeksCount }} 周</span>
      </header>

      <div class="schedule-body">
        <NSpin
          :show="loading"
          size="small"
        >
          <NAlert
            v-if="failed"
            type="error"
            :show-icon="true"
          >
            <div class="remote-state">
              <span>日程加载失败，请稍后重试</span>
              <NButton
                size="small"
                type="primary"
                secondary
                @click="loadSchedule(true)"
              >
                <template #icon>
                  <NIcon><RefreshOutline /></NIcon>
                </template>
                重试
              </NButton>
            </div>
          </NAlert>
          <div
            v-else-if="!userInfo?.id"
            class="empty-state"
          >
            暂未关联用户信息
          </div>
          <div
            v-else-if="!loading && rows.length === 0"
            class="empty-state"
          >
            暂无直播日程
          </div>

          <div
            v-else-if="cfg.layout === 'table'"
            class="table-wrap"
            tabindex="0"
            aria-label="直播日程表，可横向滚动"
          >
            <table>
              <thead>
                <tr>
                  <th>周次</th>
                  <th>日期</th>
                  <th>时间</th>
                  <th>内容</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in rows"
                  :key="row.key"
                  :class="{ today: cfg.highlightToday && row.isToday }"
                >
                  <td>{{ row.year }} 年第 {{ row.week }} 周</td>
                  <td>
                    {{ dayLabel(row.dayIndex) }}
                    <NTag
                      v-if="cfg.highlightToday && row.isToday"
                      type="primary"
                      size="small"
                      :bordered="false"
                    >
                      今天
                    </NTag>
                  </td>
                  <td class="time">
                    {{ row.time }}
                  </td>
                  <td>
                    {{ row.title }}
                    <NTag
                      v-if="cfg.showTag && row.tag"
                      size="small"
                      :bordered="false"
                      :style="{ color: row.tagColor || undefined }"
                    >
                      {{ row.tag }}
                    </NTag>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-else
            class="timeline"
          >
            <article
              v-for="row in rows"
              :key="row.key"
              class="timeline-item"
              :class="{ today: cfg.highlightToday && row.isToday }"
            >
              <time class="timeline-time"
                >{{ dayLabel(row.dayIndex) }}<strong>{{ row.time }}</strong></time
              >
              <div class="timeline-content">
                <div class="item-heading">
                  <strong>{{ row.title }}</strong>
                  <NTag
                    v-if="cfg.highlightToday && row.isToday"
                    type="primary"
                    size="small"
                    :bordered="false"
                  >
                    今天
                  </NTag>
                </div>
                <div class="item-meta">
                  <span
                    v-if="cfg.showTag && row.tag"
                    :style="{ color: row.tagColor || undefined }"
                    >#{{ row.tag }}</span
                  >
                  <span>{{ row.year }} 年第 {{ row.week }} 周</span>
                </div>
              </div>
            </article>
          </div>
        </NSpin>
      </div>
      <ScheduleSubscription
        v-if="cfg.showIcs && icsUrl"
        class="schedule-subscription-entry"
        :url="icsUrl"
      />
    </section>
  </BlockCard>
</template>

<style scoped>
.schedule {
  container-type: inline-size;
  color: var(--vtsuru-block-fg);
}
.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--vtsuru-page-primary-border);
  background: var(--vtsuru-page-content-color, var(--vtsuru-block-bg-muted));
}
.header-title-wrap {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
}
.header-title-wrap :deep(.n-icon) {
  color: var(--vtsuru-page-primary-readable, var(--vtsuru-block-fg));
}
.header-title-wrap h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.4;
  letter-spacing: 0;
}
.week-count {
  flex: none;
  color: var(--vtsuru-block-fg-muted);
  font-size: 12px;
}
.schedule-body {
  min-height: 90px;
  padding: 20px;
}
.schedule-subscription-entry {
  margin: 0 20px 20px;
}
.remote-state {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.empty-state {
  padding: 24px;
  color: var(--vtsuru-block-fg-muted);
  text-align: center;
}
.table-wrap {
  max-width: 100%;
  overflow-x: auto;
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
  border-radius: var(--vtsuru-page-radius);
}
.table-wrap:focus-visible {
  outline: 2px solid var(--vtsuru-page-primary);
  outline-offset: 2px;
}
table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 13px;
}
th,
td {
  padding: 11px 12px;
  border-bottom: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--vtsuru-block-border);
  text-align: left;
  vertical-align: middle;
}
th {
  color: var(--vtsuru-block-fg-muted);
  background: var(--vtsuru-block-bg-muted);
  font-size: 12px;
  font-weight: 600;
}
tbody tr:last-child td {
  border-bottom: 0;
}
tr.today {
  background: color-mix(in srgb, var(--vtsuru-page-primary) 12%, transparent);
}
.time {
  font-family: ui-monospace, monospace;
  font-variant-numeric: tabular-nums;
}
.timeline {
  display: grid;
  gap: 2px;
}
.timeline-item {
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  gap: 16px;
  padding: 14px;
  border-left: 3px solid var(--vtsuru-block-border);
}
.timeline-item.today {
  border-left-color: var(--vtsuru-page-primary);
  background: color-mix(in srgb, var(--vtsuru-page-primary) 12%, transparent);
}
.timeline-time {
  color: var(--vtsuru-block-fg-muted);
  font-size: 12px;
  text-align: right;
}
.timeline-time strong {
  display: block;
  margin-top: 4px;
  color: var(--vtsuru-block-fg);
  font:
    600 13px ui-monospace,
    monospace;
}
.timeline-content {
  min-width: 0;
}
.item-heading {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.item-heading strong {
  overflow-wrap: anywhere;
  line-height: 1.45;
}
.item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  color: var(--vtsuru-block-fg-muted);
  font-size: 12px;
}

@container (max-width: 440px) {
  .schedule-header {
    align-items: flex-start;
    padding: 14px;
  }
  .schedule-body {
    padding: 14px;
  }
  .schedule-subscription-entry {
    margin: 0 14px 14px;
  }
  .timeline-item {
    grid-template-columns: 58px minmax(0, 1fr);
    gap: 10px;
    padding: 12px 8px;
  }
  .remote-state {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
