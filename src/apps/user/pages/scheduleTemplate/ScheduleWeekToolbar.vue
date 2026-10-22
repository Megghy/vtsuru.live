<script setup lang="ts">
import {
  ArrowDownload20Regular,
  CalendarLtr20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from '@vicons/fluent'
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import { computed, ref } from 'vue'

import type { ScheduleWeekInfo } from '@/api/api-models'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { toast } from '@/shared/utils'

import { scheduleFontStylesheetDomains, waitForScheduleFonts } from './scheduleFonts'
import { getISOWeekStart } from './scheduleTemplateUtils'

const props = defineProps<{
  weeks: ScheduleWeekInfo[]
  captureTarget: HTMLElement | null | undefined
  fileName: string
}>()

const selectedWeek = defineModel<string>()
const saving = ref(false)

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

interface WeekOption {
  label: string
  value: string
  year: number
  week: number
}

const options = computed<WeekOption[]>(() => {
  const showYear = new Set(props.weeks.map((item) => item.year)).size > 1
  return props.weeks
    .toSorted((left, right) => left.year - right.year || left.week - right.week)
    .map((item) => {
      const start = getISOWeekStart(item.year, item.week)
      const end = new Date(start)
      end.setDate(start.getDate() + 6)
      const anchor = new Date(start)
      anchor.setDate(start.getDate() + 3)
      const firstDayOffset = (new Date(anchor.getFullYear(), anchor.getMonth(), 1).getDay() + 6) % 7
      const weekOfMonth = Math.floor((anchor.getDate() + firstDayOffset - 1) / 7) + 1
      const year = showYear ? `${item.year}年 · ` : ''
      return {
        label: `${year}${anchor.getMonth() + 1}月第${weekOfMonth}周 · ${dateFormatter.format(start)}–${dateFormatter.format(end)}`,
        value: `${item.year}-${item.week}`,
        year: item.year,
        week: item.week,
      }
    })
})

const selectedIndex = computed(() => options.value.findIndex((option) => option.value === selectedWeek.value))
const selectedOption = computed(() => options.value[selectedIndex.value])
const hasPreviousWeek = computed(() => selectedIndex.value > 0)
const hasNextWeek = computed(() => selectedIndex.value >= 0 && selectedIndex.value < options.value.length - 1)

function moveWeek(offset: number) {
  const option = options.value[selectedIndex.value + offset]
  if (option) selectedWeek.value = option.value as string
}

async function saveScheduleImage() {
  if (!props.captureTarget || saving.value) return
  saving.value = true
  try {
    await waitForScheduleFonts()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    const blob = await snapdom.toBlob(props.captureTarget, {
      backgroundColor: null,
      type: 'png',
      embedFonts: true,
      fontStylesheetDomains: scheduleFontStylesheetDomains,
      // 保底 2x, 避免 100% 缩放下导出仅 1x 导致海报低清; snapdom 自带超大 canvas 降级保护
      dpr: Math.max(window.devicePixelRatio, 2),
    })
    saveAs(blob, `${props.fileName}.png`)
  } catch (error) {
    console.error(error)
    toast.error(error instanceof Error && error.message.includes('字体') ? '字体加载失败，请稍后重试' : '保存图片失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <nav
    class="schedule-week-toolbar flex items-center justify-between gap-3 w-full p-2.5 px-3 bg-card border border-border rounded-lg text-card-foreground"
    aria-label="日程周次与导出"
  >
    <div class="flex items-center gap-2 flex-1 min-w-0">
      <button
        class="size-9 rounded-md bg-secondary border border-border text-card-foreground flex-center cursor-pointer transition-colors hover:not-disabled:bg-secondary/80 hover:not-disabled:border-primary disabled:opacity-35 disabled:cursor-not-allowed"
        type="button"
        :disabled="!hasPreviousWeek"
        aria-label="上一周"
        title="上一周"
        @click="moveWeek(-1)"
      >
        <component
          :is="ChevronLeft20Regular"
          class="size-4"
        />
      </button>

      <div class="flex flex-col gap-1.5 flex-1 min-w-0">
        <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <component
            :is="CalendarLtr20Regular"
            class="size-3.5"
          />
          <span>排期周次</span>
          <b v-if="selectedOption">{{ selectedOption.year }} · 第 {{ selectedOption.week }} 周</b>
        </div>
        <Select
          v-if="options.length"
          :model-value="selectedWeek"
          @update:model-value="selectedWeek = String($event)"
        >
          <SelectTrigger
            class="h-9 w-full bg-secondary border-border text-card-foreground"
          >
            <SelectValue placeholder="选择周次" />
          </SelectTrigger>
          <SelectContent
            class="bg-card border-border text-card-foreground"
          >
            <SelectItem
              v-for="opt in options"
              :key="opt.value"
              :value="opt.value"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <span
          v-else
          class="text-xs text-muted-foreground"
        >
          暂无可选日程
        </span>
      </div>

      <button
        class="size-9 rounded-md bg-secondary border border-border text-card-foreground flex-center cursor-pointer transition-colors hover:not-disabled:bg-secondary/80 hover:not-disabled:border-primary disabled:opacity-35 disabled:cursor-not-allowed"
        type="button"
        :disabled="!hasNextWeek"
        aria-label="下一周"
        title="下一周"
        @click="moveWeek(1)"
      >
        <component
          :is="ChevronRight20Regular"
          class="size-4"
        />
      </button>
    </div>

    <button
      v-if="captureTarget"
      class="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground border-0 cursor-pointer transition-opacity whitespace-nowrap hover:not-disabled:opacity-90 disabled:opacity-50 disabled:cursor-wait"
      type="button"
      :disabled="saving"
      :aria-busy="saving"
      @click="saveScheduleImage"
    >
      <component
        :is="ArrowDownload20Regular"
        class="size-4"
      />
      <span>{{ saving ? '正在生成' : '保存图片' }}</span>
    </button>
  </nav>
</template>


