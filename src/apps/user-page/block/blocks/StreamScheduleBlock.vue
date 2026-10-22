<script setup lang="ts">
import { CalendarNumberOutline, RefreshOutline } from '@vicons/ionicons5'
import { computed, onMounted, watch } from 'vue'

import type { ScheduleDayInfo, ScheduleWeekInfo, UserInfo } from '@/api/api-models'
import { getApiScheduleGet } from '@/api/generated/schedule/schedule'
import { useUserPageRuntimeQuery } from '@/apps/user-page/runtime/query'
import ScheduleSubscription from '@/components/ScheduleSubscription.vue'
import { SCHEDULE_API_URL } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Spin } from '@/shared/ui/spin'

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
    const response = (await getApiScheduleGet({ id: String(userId) }, { signal })) as unknown as {
      code: number
      message?: string
      data?: ScheduleWeekInfo[]
    }
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
      class="@container"
      aria-labelledby="schedule-title"
    >
      <header class="schedule-header flex items-center justify-between gap-3 p-4 border-b border-border bg-muted/40">
        <div class="header-title-wrap flex items-center gap-2 min-w-0">
          <component
            :is="CalendarNumberOutline"
            class="size-5 text-primary"
          />
          <h2
            id="schedule-title"
            class="text-sm font-semibold m-0 leading-none"
          >
            直播日程
          </h2>
        </div>
        <span class="week-count text-xs text-muted-foreground shrink-0">未来 {{ cfg.weeksCount }} 周</span>
      </header>

      <div class="schedule-body min-h-[90px] p-4">
        <div
          v-if="loading"
          class="py-6 flex justify-center"
        >
          <Spin />
        </div>
        <Alert
          v-else-if="failed"
          variant="destructive"
          class="text-xs py-2"
        >
          <AlertDescription class="flex items-center justify-between w-full">
            <span>日程加载失败，请稍后重试</span>
            <Button
              variant="outline"
              size="xs"
              class="gap-1"
              @click="loadSchedule(true)"
            >
              <component
                :is="RefreshOutline"
                class="size-3"
              />
              重试
            </Button>
          </AlertDescription>
        </Alert>
        <div
          v-else-if="!userInfo?.id"
          class="empty-state text-xs text-muted-foreground text-center py-6"
        >
          暂未关联用户信息
        </div>
        <div
          v-else-if="rows.length === 0"
          class="empty-state text-xs text-muted-foreground text-center py-6"
        >
          暂无直播日程
        </div>

        <div
          v-else-if="cfg.layout === 'table'"
          class="table-wrap max-w-full overflow-x-auto border border-border rounded-lg"
          tabindex="0"
          aria-label="直播日程表，可横向滚动"
        >
          <table class="w-full min-w-[500px] border-collapse text-xs">
            <thead>
              <tr class="bg-muted text-muted-foreground font-semibold">
                <th class="p-2.5 text-left">周次</th>
                <th class="p-2.5 text-left">日期</th>
                <th class="p-2.5 text-left">时间</th>
                <th class="p-2.5 text-left">内容</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in rows"
                :key="row.key"
                class="border-b border-border last:border-0"
                :class="{ 'bg-primary/10': cfg.highlightToday && row.isToday }"
              >
                <td class="p-2.5">{{ row.year }} 年第 {{ row.week }} 周</td>
                <td class="p-2.5">
                  <div class="flex items-center gap-1.5">
                    <span>{{ dayLabel(row.dayIndex) }}</span>
                    <Badge
                      v-if="cfg.highlightToday && row.isToday"
                      variant="default"
                      class="h-4 px-1.5 text-[10px]"
                    >
                      今天
                    </Badge>
                  </div>
                </td>
                <td class="p-2.5 font-mono">
                  {{ row.time }}
                </td>
                <td class="p-2.5">
                  <div class="flex items-center gap-1.5">
                    <span>{{ row.title }}</span>
                    <Badge
                      v-if="cfg.showTag && row.tag"
                      variant="secondary"
                      class="h-4 px-1.5 text-[10px]"
                      :style="{ color: row.tagColor || undefined }"
                    >
                      {{ row.tag }}
                    </Badge>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div
          v-else
          class="timeline grid gap-2"
        >
          <article
            v-for="row in rows"
            :key="row.key"
            class="timeline-item grid grid-cols-[64px_minmax(0,1fr)] gap-3 p-3 rounded-lg border-l-3 border-border bg-muted/40"
            :class="{ 'border-l-primary bg-primary/10': cfg.highlightToday && row.isToday }"
          >
            <time class="timeline-time text-xs text-muted-foreground text-right flex flex-col justify-center">
              <span>{{ dayLabel(row.dayIndex) }}</span>
              <strong class="font-mono text-foreground font-semibold">{{ row.time }}</strong>
            </time>
            <div class="timeline-content min-w-0">
              <div class="item-heading flex items-center gap-2">
                <strong class="text-xs font-semibold leading-relaxed">{{ row.title }}</strong>
                <Badge
                  v-if="cfg.highlightToday && row.isToday"
                  variant="default"
                  class="h-4 px-1.5 text-[10px]"
                >
                  今天
                </Badge>
              </div>
              <div class="item-meta flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                <span
                  v-if="cfg.showTag && row.tag"
                  :style="{ color: row.tagColor || undefined }"
                >
                  #{{ row.tag }}
                </span>
                <span>{{ row.year }} 年第 {{ row.week }} 周</span>
              </div>
            </div>
          </article>
        </div>
      </div>
      <ScheduleSubscription
        v-if="cfg.showIcs && icsUrl"
        class="schedule-subscription-entry mx-4 mb-4"
        :url="icsUrl"
      />
    </section>
  </BlockCard>
</template>


