<script setup lang="ts">
import type { ScheduleDayInfo, ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/shared/config'
import { NAlert, NButton, NSpin, NTag, NIcon } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'
import { CalendarNumberOutline } from '@vicons/ionicons5'
import BlockCard from '../BlockCard.vue'

interface BlockConfig {
  layout?: 'list' | 'table'
  weeksCount?: number
  showIcs?: boolean
  highlightToday?: boolean
  showTag?: boolean
  framed?: boolean
  backgrounded?: boolean
}

const props = defineProps<{
  blockProps: unknown
  userInfo?: UserInfo | undefined
  biliInfo?: unknown
}>()

const cfg = computed<BlockConfig>(() => {
  const o = (props.blockProps && typeof props.blockProps === 'object' && !Array.isArray(props.blockProps))
    ? (props.blockProps as any)
    : {}
  const weeksCount = Number.isInteger(o.weeksCount) ? o.weeksCount : 1
  return {
    layout: (o.layout === 'table' || o.layout === 'list') ? o.layout : 'list',
    weeksCount: Math.min(8, Math.max(1, weeksCount)),
    showIcs: typeof o.showIcs === 'boolean' ? o.showIcs : true,
    highlightToday: typeof o.highlightToday === 'boolean' ? o.highlightToday : true,
    showTag: typeof o.showTag === 'boolean' ? o.showTag : true,
    framed: typeof o.framed === 'boolean' ? o.framed : true,
    backgrounded: typeof o.backgrounded === 'boolean' ? o.backgrounded : true,
  }
})

const isLoading = ref(false)
const error = ref<string | null>(null)
const data = ref<ScheduleWeekInfo[] | null>(null)

async function load() {
  if (!props.userInfo?.id) return
  isLoading.value = true
  error.value = null
  try {
    const resp = await QueryGetAPI<ScheduleWeekInfo[]>(`${SCHEDULE_API_URL}get`, { id: props.userInfo.id, _ts: Date.now() })
    if (resp.code !== 200) throw new Error(resp.message || `HTTP ${resp.code}`)
    const all = Array.isArray(resp.data) ? resp.data : []
    const count = cfg.value.weeksCount ?? 1
    data.value = all.slice(0, count)
  } catch (e) {
    error.value = (e as Error).message || String(e)
    data.value = null
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  void load()
})
watch(() => props.userInfo?.id, () => void load())
watch(() => cfg.value.weeksCount, () => void load())

function dayLabel(dayIndex: number) {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][dayIndex] ?? `Day${dayIndex + 1}`
}

function getTodayIndex() {
  const js = new Date().getDay()
  return js === 0 ? 6 : js - 1
}

function normalizeItem(it: ScheduleDayInfo) {
  return {
    title: typeof it.title === 'string' ? it.title : '',
    tag: typeof it.tag === 'string' ? it.tag : '',
    tagColor: typeof it.tagColor === 'string' ? it.tagColor : '',
    time: typeof it.time === 'string' ? it.time : '',
  }
}

const flatRows = computed(() => {
  const weeks = data.value ?? []
  const out: Array<{
    week: ScheduleWeekInfo
    weekIdx: number
    dayIdx: number
    itemIdx: number
    title: string
    tag: string
    tagColor: string
    time: string
    isToday: boolean
  }> = []
  const todayIdx = getTodayIndex()

  weeks.forEach((w, weekIdx) => {
    const days = Array.isArray(w.days) ? w.days : []
    for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
      const list = Array.isArray(days[dayIdx]) ? days[dayIdx] : []
      for (let itemIdx = 0; itemIdx < list.length; itemIdx++) {
        const it = normalizeItem(list[itemIdx])
        if (!it.title && !it.time && !it.tag) continue
        out.push({
          week: w,
          weekIdx,
          dayIdx,
          itemIdx,
          title: it.title,
          tag: it.tag,
          tagColor: it.tagColor,
          time: it.time,
          isToday: weekIdx === 0 && dayIdx === todayIdx,
        })
      }
    }
  })
  return out
})

function copyToClipboard(text: string) {
  if (!text) return
  void navigator.clipboard?.writeText(text)
}
</script>

<template>
  <BlockCard class="schedule-card" :framed="cfg.framed" :backgrounded="cfg.backgrounded" :content-style="{ padding: 0 }">
    <div class="schedule-block">
      <div class="schedule-header">
        <div class="header-left">
          <div class="header-icon">
            <NIcon :component="CalendarNumberOutline" />
          </div>
          <span class="header-title">SCHEDULE</span>
        </div>
        <div class="header-desc">
          {{ cfg.weeksCount ?? 1 }} WEEK{{ (cfg.weeksCount ?? 1) > 1 ? 'S' : '' }}
        </div>
      </div>

      <!-- Actions Toolbar -->
      <div v-if="cfg.showIcs && userInfo?.id" class="ics-toolbar">
        <div class="ics-link" @click="copyToClipboard(`${SCHEDULE_API_URL}${userInfo.id}.ics`)">
          <span class="ics-url">{{ `${SCHEDULE_API_URL}${userInfo.id}.ics` }}</span>
          <NButton size="tiny" secondary class="copy-btn">
            Copy
          </NButton>
        </div>
      </div>

      <div class="schedule-body">
        <NSpin :show="isLoading" size="small">
          <NAlert v-if="error" type="error" :show-icon="true" class="mb-4">
            {{ error }}
          </NAlert>

          <div v-else-if="!userInfo?.id" class="empty-state">
            User info missing
          </div>

          <div v-else-if="flatRows.length === 0" class="empty-state">
            No schedule available
          </div>

          <template v-else>
            <!-- Table Layout -->
            <div v-if="cfg.layout === 'table'" class="schedule-table-wrapper">
              <table class="schedule-table">
                <thead>
                  <tr>
                    <th>WEEK</th>
                    <th>DAY</th>
                    <th>TIME</th>
                    <th>CONTENT</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="(r, idx) in flatRows"
                    :key="idx"
                    :class="{ 'row-today': cfg.highlightToday && r.isToday }"
                  >
                    <td class="font-mono opacity-70">
                      {{ r.week.year }}W{{ r.week.week }}
                    </td>
                    <td class="font-bold">
                      {{ dayLabel(r.dayIdx) }}
                      <NTag v-if="cfg.highlightToday && r.isToday" type="primary" size="small" :bordered="false" class="ml-2">
                        TODAY
                      </NTag>
                    </td>
                    <td class="font-mono">
                      {{ r.time }}
                    </td>
                    <td>
                      <span>{{ r.title }}</span>
                      <NTag
                        v-if="cfg.showTag && r.tag"
                        size="small"
                        :style="r.tagColor ? `margin-left: 6px; background:${r.tagColor}; color:#fff; border-color:${r.tagColor};` : 'margin-left: 6px'"
                        :bordered="false"
                      >
                        {{ r.tag }}
                      </NTag>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Timeline Layout (Default) -->
            <div v-else class="timeline-list">
              <div
                v-for="(r, idx) in flatRows"
                :key="idx"
                class="timeline-item"
                :class="{ 'is-today': cfg.highlightToday && r.isToday }"
              >
                <div class="timeline-time">
                  <div class="day-label">
                    {{ dayLabel(r.dayIdx) }}
                  </div>
                  <div class="time-val">
                    {{ r.time }}
                  </div>
                </div>

                <div class="timeline-connector">
                  <div class="connector-dot" :class="{ 'active': cfg.highlightToday && r.isToday }" />
                  <div class="connector-line" />
                </div>

                <div class="timeline-content">
                  <div class="content-header">
                    <span class="content-title">{{ r.title }}</span>
                    <NTag v-if="cfg.highlightToday && r.isToday" type="primary" size="small" :bordered="false" round>
                      TODAY
                    </NTag>
                  </div>
                  <div class="content-meta">
                    <span v-if="r.tag" class="meta-tag" :style="{ color: r.tagColor || 'var(--n-primary-color)' }">
                      #{{ r.tag }}
                    </span>
                    <span class="meta-week">{{ r.week.year }}W{{ r.week.week }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </NSpin>
      </div>
    </div>
  </BlockCard>
</template>

<style scoped>
.schedule-block {
  width: 100%;
}

.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--n-divider-color);
  background: var(--n-action-color);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(var(--n-primary-color-rgb), 0.12);
  color: var(--n-primary-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.header-title {
  font-weight: 800;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.header-desc {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.5;
  letter-spacing: 0.05em;
}

.ics-toolbar {
  padding: 12px 24px;
  border-bottom: 1px solid var(--n-divider-color);
  background: transparent;
}

.ics-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--n-fill-color);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.ics-link:hover {
  background: var(--n-action-color);
}

.ics-url {
  font-family: monospace;
  font-size: 12px;
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 12px;
}

.schedule-body {
  padding: 24px;
}

.schedule-table-wrapper {
  overflow-x: auto;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.schedule-table th {
  text-align: left;
  padding: 12px;
  border-bottom: 1px solid var(--n-divider-color);
  font-size: 12px;
  opacity: 0.5;
  font-weight: 700;
}

.schedule-table td {
  padding: 16px 12px;
  border-bottom: 1px solid var(--n-divider-color);
}

.row-today {
  background: rgba(var(--n-primary-color-rgb), 0.1);
}

/* Timeline Styles */
.timeline-list {
  display: flex;
  flex-direction: column;
}

.timeline-item {
  display: flex;
  position: relative;
  padding-bottom: 32px;
}

.timeline-item:last-child {
  padding-bottom: 0;
}

.timeline-item:last-child .connector-line {
  display: none;
}

.timeline-time {
  width: 60px;
  text-align: right;
  padding-right: 16px;
  padding-top: 2px;
}

.day-label {
  font-weight: 800;
  font-size: 14px;
  line-height: 1;
  margin-bottom: 4px;
}

.time-val {
  font-family: monospace;
  font-size: 13px;
  opacity: 0.6;
}

.timeline-connector {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 20px;
}

.connector-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--user-page-ui-surface-bg, var(--n-color, rgba(255, 255, 255, 0.7)));
  border: 2px solid rgba(255,255,255,0.2);
  z-index: 2;
  transition: all 0.3s;
}

.connector-dot.active {
  background: var(--n-primary-color);
  border-color: var(--n-primary-color);
  box-shadow: 0 0 0 4px rgba(var(--n-primary-color-rgb), 0.2);
}

.connector-line {
  position: absolute;
  top: 12px;
  bottom: -40px; /* Connect to next */
  width: 2px;
  background: rgba(255,255,255,0.1);
  z-index: 1;
}

.timeline-content {
  flex: 1;
  padding-left: 20px;
  padding-top: 0;
}

.content-header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 6px;
}

.content-title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
}

.content-meta {
  font-size: 13px;
  display: flex;
  gap: 12px;
  opacity: 0.6;
}

.meta-tag {
  font-weight: 600;
}

.empty-state {
  text-align: center;
  padding: 40px;
  opacity: 0.5;
  font-style: italic;
}

.mb-4 {
  margin-bottom: 16px;
}
.ml-2 {
  margin-left: 8px;
}
.font-mono {
  font-family: monospace;
}
.font-bold {
  font-weight: 700;
}
.opacity-70 {
  opacity: 0.7;
}
</style>
