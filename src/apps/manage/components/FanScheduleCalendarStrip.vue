<script setup lang="ts">
import { Cake, CalendarHeart, ChevronLeft, ChevronRight, Eye, EyeOff, Lock, Sparkles } from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { type FanCalendarEventItem, getFanCalendarEvents } from '@/api/fanProfile'
import { useFanPrivacy } from '@/shared/composables/useFanPrivacy'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card } from '@/shared/ui/card'

const router = useRouter()
const { privacyMode, togglePrivacyMode } = useFanPrivacy()

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth() + 1)
const expanded = ref(false)
const loading = ref(false)
const events = ref<FanCalendarEventItem[]>([])
const selectedDay = ref<number | null>(null)

const weekHeaders = ['一', '二', '三', '四', '五', '六', '日']

async function loadMonth() {
  loading.value = true
  try {
    const res = await getFanCalendarEvents({ year: viewYear.value, month: viewMonth.value })
    if (res.code === 200 && res.data) {
      events.value = res.data
    }
  } finally {
    loading.value = false
  }
}

function shiftMonth(delta: number) {
  let m = viewMonth.value + delta
  let y = viewYear.value
  if (m < 1) {
    m = 12
    y--
  } else if (m > 12) {
    m = 1
    y++
  }
  viewYear.value = y
  viewMonth.value = m
  selectedDay.value = null
}

watch([viewYear, viewMonth], () => {
  void loadMonth()
})

const eventsByDay = computed(() => {
  const map = new Map<number, FanCalendarEventItem[]>()
  for (const e of events.value) {
    const list = map.get(e.day) ?? []
    list.push(e)
    map.set(e.day, list)
  }
  return map
})

const calendarCells = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value - 1, 1)
  const startOffset = (firstDay.getDay() + 6) % 7 // 周一=0
  const daysInMonth = new Date(viewYear.value, viewMonth.value, 0).getDate()
  const cells: ({ day: number; isToday: boolean; items: FanCalendarEventItem[] } | null)[] = []

  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday =
      viewYear.value === today.getFullYear() && viewMonth.value === today.getMonth() + 1 && d === today.getDate()
    cells.push({
      day: d,
      isToday,
      items: eventsByDay.value.get(d) ?? [],
    })
  }
  return cells
})

const filteredEvents = computed(() => {
  if (selectedDay.value === null) return events.value
  return eventsByDay.value.get(selectedDay.value) ?? []
})

const todayEvents = computed(() => {
  if (viewYear.value !== today.getFullYear() || viewMonth.value !== today.getMonth() + 1) return []
  return eventsByDay.value.get(today.getDate()) ?? []
})

function openFan(ouid: string) {
  void router.push({ name: 'manage-fans', query: { ouid } })
}

onMounted(() => {
  void loadMonth()
})
</script>

<template>
  <Card class="p-3 space-y-2.5 border-border/80">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex items-center gap-2 min-w-0">
        <CalendarHeart class="size-4 text-primary shrink-0" />
        <span class="text-xs font-semibold">粉丝生日与纪念日联动</span>
        <Badge
          variant="outline"
          class="text-[10px] gap-1 text-muted-foreground"
        >
          <Lock class="size-2.5" />
          仅主播本人可见 · 不进公开日程与海报
        </Badge>
        <Badge
          v-if="todayEvents.length > 0"
          variant="secondary"
          class="text-[10px] text-rose-500"
        >
          今日 {{ todayEvents.length }} 位
        </Badge>
      </div>

      <div class="flex items-center gap-1.5">
        <Button
          size="xs"
          variant="ghost"
          @click="togglePrivacyMode"
        >
          <EyeOff
            v-if="privacyMode"
            class="size-3.5 mr-1 text-amber-500"
          />
          <Eye
            v-else
            class="size-3.5 mr-1"
          />
          {{ privacyMode ? '已防露屏' : '防露屏' }}
        </Button>
        <Button
          size="xs"
          variant="outline"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起月历' : `展开月历（${viewMonth}月共 ${events.length} 项）` }}
        </Button>
      </div>
    </div>

    <!-- 折叠态：横向展示本月特殊日子快览 -->
    <div
      v-if="!expanded && events.length > 0"
      class="flex flex-wrap items-center gap-1.5"
    >
      <button
        v-for="e in events.slice(0, 8)"
        :key="`${e.canonicalOUId}_${e.kind}_${e.day}_${e.title}`"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/30 hover:bg-accent/60 px-2.5 py-0.5 text-[11px] transition-colors"
        @click="openFan(e.canonicalOUId)"
      >
        <Cake
          v-if="e.kind === 'birthday'"
          class="size-3 text-rose-500 shrink-0"
        />
        <Sparkles
          v-else
          class="size-3 text-amber-500 shrink-0"
        />
        <span class="font-medium">{{ privacyMode ? '•••' : e.displayName }}</span>
        <span class="text-muted-foreground tabular-nums">
          {{ privacyMode && e.kind === 'birthday' ? '••月••日' : `${e.month}月${e.day}日` }}
          {{ e.kind === 'birthday' ? '生日' : e.title }}
        </span>
      </button>
    </div>

    <!-- 展开态：月历 + 列表双栏 -->
    <div
      v-if="expanded"
      class="grid grid-cols-1 md:grid-cols-[290px_1fr] gap-4 pt-1 border-t border-border/60"
    >
      <div class="space-y-2">
        <div class="flex-between">
          <Button
            size="icon"
            variant="ghost"
            class="size-7"
            @click="shiftMonth(-1)"
          >
            <ChevronLeft class="size-4" />
          </Button>
          <span class="text-xs font-semibold tabular-nums">{{ viewYear }} 年 {{ viewMonth }} 月</span>
          <Button
            size="icon"
            variant="ghost"
            class="size-7"
            @click="shiftMonth(1)"
          >
            <ChevronRight class="size-4" />
          </Button>
        </div>

        <div class="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
          <div
            v-for="w in weekHeaders"
            :key="w"
          >
            {{ w }}
          </div>
        </div>

        <div class="grid grid-cols-7 gap-1">
          <template
            v-for="(cell, idx) in calendarCells"
            :key="idx"
          >
            <div
              v-if="!cell"
              class="h-8"
            />
            <button
              v-else
              type="button"
              class="h-8 rounded-md text-[11px] flex flex-col items-center justify-center relative transition-colors tabular-nums"
              :class="[
                selectedDay === cell.day
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : cell.isToday
                    ? 'border border-primary text-primary font-semibold'
                    : cell.items.length > 0
                      ? 'bg-rose-500/10 text-foreground hover:bg-rose-500/20 font-medium'
                      : 'hover:bg-accent/50 text-muted-foreground',
              ]"
              @click="selectedDay = selectedDay === cell.day ? null : cell.day"
            >
              <span>{{ cell.day }}</span>
              <span
                v-if="cell.items.length > 0"
                class="w-1.5 h-1.5 rounded-full"
                :class="selectedDay === cell.day ? 'bg-primary-foreground' : 'bg-rose-500'"
              />
            </button>
          </template>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex-between text-xs">
          <span class="font-medium">
            {{ selectedDay ? `${viewMonth}月${selectedDay}日` : `${viewMonth}月全部特殊日子` }}（{{ filteredEvents.length }}）
          </span>
          <Button
            v-if="selectedDay !== null"
            size="xs"
            variant="ghost"
            @click="selectedDay = null"
          >
            查看整月
          </Button>
        </div>

        <div
          v-if="loading"
          class="text-xs text-muted-foreground py-6 text-center"
        >
          加载中…
        </div>
        <div
          v-else-if="filteredEvents.length === 0"
          class="text-xs text-muted-foreground py-6 text-center rounded-md border border-dashed border-border"
        >
          {{ selectedDay ? '当天暂无粉丝生日或纪念日' : '本月暂无已记录的粉丝生日或纪念日' }}
        </div>
        <div
          v-else
          class="grid grid-cols-1 xl:grid-cols-2 gap-1.5 max-h-[210px] overflow-y-auto scrollbar-thin pr-1"
        >
          <button
            v-for="e in filteredEvents"
            :key="`${e.canonicalOUId}_${e.kind}_${e.day}_${e.title}`"
            type="button"
            class="flex items-center justify-between gap-2 rounded-md border border-border bg-card hover:bg-accent/40 px-2.5 py-1.5 text-left transition-colors"
            @click="openFan(e.canonicalOUId)"
          >
            <div class="flex items-center gap-2 min-w-0">
              <Cake
                v-if="e.kind === 'birthday'"
                class="size-3.5 text-rose-500 shrink-0"
              />
              <Sparkles
                v-else
                class="size-3.5 text-amber-500 shrink-0"
              />
              <div class="min-w-0">
                <div class="text-xs font-medium truncate">{{ privacyMode ? '•••' : e.displayName }}</div>
                <div class="text-[11px] text-muted-foreground truncate">
                  {{ e.kind === 'birthday' ? '生日' : e.title }}{{ e.years ? ` · ${e.years}周年` : '' }}
                </div>
              </div>
            </div>
            <span class="text-[11px] text-muted-foreground tabular-nums shrink-0">
              {{ privacyMode && e.kind === 'birthday' ? '••/••' : `${e.month}/${e.day}` }}
            </span>
          </button>
        </div>
      </div>
    </div>
  </Card>
</template>
