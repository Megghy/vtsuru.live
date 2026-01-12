<script setup lang="ts">
import type { ScheduleDayInfo, ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SCHEDULE_API_URL } from '@/shared/config'
import { NAlert, NButton, NCard, NFlex, NSpin, NTag, NText } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

interface BlockConfig {
  layout?: 'list' | 'table'
  weeksCount?: number
  showIcs?: boolean
  highlightToday?: boolean
  showTag?: boolean
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
  <NCard size="small" content-style="padding: 0">
    <div class="schedule-card">
      <div class="schedule-header">
        <NText strong>
          直播日程
        </NText>
        <NText depth="3">
          展示 {{ cfg.weeksCount ?? 1 }} 周
        </NText>
      </div>

      <NFlex v-if="cfg.showIcs && userInfo?.id" align="center" justify="space-between" style="gap: 10px; padding: 0 14px 12px">
        <NText depth="3" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis">
          订阅：{{ `${SCHEDULE_API_URL}${userInfo.id}.ics` }}
        </NText>
        <NButton size="tiny" secondary @click="copyToClipboard(`${SCHEDULE_API_URL}${userInfo.id}.ics`)">
          复制
        </NButton>
      </NFlex>

      <div class="schedule-body">
        <NSpin :show="isLoading" size="small">
          <NAlert v-if="error" type="error" :show-icon="true" style="margin-bottom: 10px">
            {{ error }}
          </NAlert>

          <NAlert v-else-if="!userInfo?.id" type="info" :show-icon="false">
            未登录或用户信息缺失
          </NAlert>

          <NAlert v-else-if="flatRows.length === 0" type="info" :show-icon="false">
            暂无日程
          </NAlert>

          <template v-else>
            <div v-if="cfg.layout === 'table'" class="schedule-table">
              <table style="width: 100%; border-collapse: collapse">
            <thead>
              <tr>
                <th style="text-align:left; padding: 8px; border-bottom: 1px solid var(--n-border-color)">周</th>
                <th style="text-align:left; padding: 8px; border-bottom: 1px solid var(--n-border-color)">星期</th>
                <th style="text-align:left; padding: 8px; border-bottom: 1px solid var(--n-border-color)">时间</th>
                <th style="text-align:left; padding: 8px; border-bottom: 1px solid var(--n-border-color)">内容</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, idx) in flatRows"
                :key="idx"
                :style="(cfg.highlightToday && r.isToday) ? 'background: rgba(24, 160, 88, 0.06);' : ''"
              >
                <td style="padding: 8px; border-bottom: 1px solid var(--n-border-color)">{{ r.week.year }}W{{ r.week.week }}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--n-border-color)">
                  {{ dayLabel(r.dayIdx) }}
                  <NTag v-if="cfg.highlightToday && r.isToday" type="success" size="small" :bordered="false" style="margin-left: 6px">今天</NTag>
                </td>
                <td style="padding: 8px; border-bottom: 1px solid var(--n-border-color)">{{ r.time }}</td>
                <td style="padding: 8px; border-bottom: 1px solid var(--n-border-color)">
                  <NText>{{ r.title }}</NText>
                  <NTag
                    v-if="cfg.showTag && r.tag"
                    size="small"
                    :style="r.tagColor ? `margin-left: 6px; background:${r.tagColor}; color:#fff; border-color:${r.tagColor};` : 'margin-left: 6px'"
                  >
                    {{ r.tag }}
                  </NTag>
                </td>
              </tr>
            </tbody>
              </table>
            </div>

            <NFlex v-else vertical style="gap: 10px">
              <div
                v-for="(r, idx) in flatRows"
                :key="idx"
                class="schedule-item"
                :class="{ today: cfg.highlightToday && r.isToday }"
              >
                <NFlex justify="space-between" align="center" style="gap: 10px">
                  <NText strong style="min-width: 0">
                    {{ r.title }}
                  </NText>
                  <NFlex align="center" style="gap: 6px; flex-shrink: 0">
                    <NTag v-if="cfg.highlightToday && r.isToday" type="success" size="small" :bordered="false">今天</NTag>
                    <NTag
                      v-if="cfg.showTag && r.tag"
                      size="small"
                      :bordered="false"
                      :style="r.tagColor ? `background:${r.tagColor}; color:#fff;` : ''"
                    >
                      {{ r.tag }}
                    </NTag>
                  </NFlex>
                </NFlex>
                <NText depth="3" style="display:block; margin-top: 6px">
                  {{ r.week.year }}W{{ r.week.week }} · {{ dayLabel(r.dayIdx) }} · {{ r.time }}
                </NText>
              </div>
            </NFlex>
          </template>
        </NSpin>
      </div>
    </div>
  </NCard>
</template>

<style scoped>
.schedule-card {
  border-radius: var(--vtsuru-page-radius);
  overflow: hidden;
}

.schedule-header {
  padding: 12px 14px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.schedule-body {
  padding: 0 14px 14px;
}

.schedule-table {
  overflow: auto;
  border-radius: 12px;
  border: 1px solid var(--n-border-color);
}

.schedule-item {
  padding: 10px 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.02);
}

.schedule-item.today {
  background: rgba(24, 160, 88, 0.06);
}
</style>
