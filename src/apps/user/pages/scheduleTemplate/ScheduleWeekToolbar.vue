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
    toast.error(
      error instanceof Error && error.message.includes('字体') ? '字体加载失败，请稍后重试' : '保存图片失败',
    )
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <nav
    class="schedule-week-toolbar"
    aria-label="日程周次与导出"
  >
    <div class="schedule-week-toolbar__navigator">
      <button
        class="schedule-week-toolbar__step"
        type="button"
        :disabled="!hasPreviousWeek"
        aria-label="上一周"
        title="上一周"
        @click="moveWeek(-1)"
      >
        <component :is="ChevronLeft20Regular" class="size-4" />
      </button>

      <div class="schedule-week-toolbar__current">
        <div class="schedule-week-toolbar__meta">
          <component :is="CalendarLtr20Regular" class="size-3.5" />
          <span>排期周次</span>
          <b v-if="selectedOption">{{ selectedOption.year }} · 第 {{ selectedOption.week }} 周</b>
        </div>
        <Select
          v-if="options.length"
          :model-value="selectedWeek"
          @update:model-value="selectedWeek = String($event)"
        >
          <SelectTrigger class="h-10 text-xs w-full bg-[var(--schedule-toolbar-resolved-control-bg)] border-[var(--schedule-toolbar-resolved-border)] text-[var(--schedule-toolbar-resolved-fg)]">
            <SelectValue placeholder="选择周次" />
          </SelectTrigger>
          <SelectContent class="bg-[var(--schedule-toolbar-resolved-bg)] border-[var(--schedule-toolbar-resolved-border)] text-[var(--schedule-toolbar-resolved-fg)]">
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
          class="schedule-week-toolbar__empty"
        >
          暂无可选日程
        </span>
      </div>

      <button
        class="schedule-week-toolbar__step"
        type="button"
        :disabled="!hasNextWeek"
        aria-label="下一周"
        title="下一周"
        @click="moveWeek(1)"
      >
        <component :is="ChevronRight20Regular" class="size-4" />
      </button>
    </div>

    <button
      v-if="captureTarget"
      class="schedule-week-toolbar__save"
      type="button"
      :disabled="saving"
      :aria-busy="saving"
      @click="saveScheduleImage"
    >
      <component :is="ArrowDownload20Regular" class="size-4" />
      <span>{{ saving ? '正在生成' : '保存图片' }}</span>
    </button>
  </nav>
</template>

<style scoped>
.schedule-week-toolbar {
  --schedule-toolbar-resolved-fg: var(
    --schedule-toolbar-fg,
    var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--foreground))))
  );
  --schedule-toolbar-resolved-muted: var(
    --schedule-toolbar-muted,
    var(--vtsuru-block-fg-muted, var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--muted-foreground))))
  );
  --schedule-toolbar-resolved-bg: var(
    --schedule-toolbar-bg,
    var(--vtsuru-block-bg-muted, var(--vtsuru-page-card-bg, var(--user-page-theme-surface-bg, var(--muted))))
  );
  --schedule-toolbar-resolved-border: var(
    --schedule-toolbar-border,
    var(--vtsuru-block-border, var(--vtsuru-card-border-color, var(--user-page-border-color, var(--border))))
  );
  --schedule-toolbar-resolved-accent: var(
    --schedule-toolbar-accent,
    var(--vtsuru-page-primary, var(--brand))
  );
  --schedule-toolbar-resolved-control-bg: var(
    --schedule-toolbar-control-bg,
    color-mix(in srgb, var(--schedule-toolbar-resolved-bg) 84%, transparent)
  );
  --schedule-toolbar-resolved-control-bg-hover: var(
    --schedule-toolbar-control-bg-hover,
    color-mix(in srgb, var(--schedule-toolbar-resolved-accent) 12%, var(--schedule-toolbar-resolved-bg))
  );
  --schedule-toolbar-resolved-focus: color-mix(
    in srgb,
    var(--schedule-toolbar-resolved-accent) 24%,
    transparent
  );
  --schedule-toolbar-resolved-radius: var(--vtsuru-page-radius, 14px);

  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: var(--schedule-toolbar-resolved-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-resolved-border);
  border-radius: var(--schedule-toolbar-resolved-radius);
  color: var(--schedule-toolbar-resolved-fg);
  font: inherit;
}

.schedule-week-toolbar__navigator {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 360px;
  min-width: 0;
}

.schedule-week-toolbar__current {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1 1 auto;
  min-width: 0;
}

.schedule-week-toolbar__meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--schedule-toolbar-resolved-muted);
}

.schedule-week-toolbar__step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px));
  background: var(--schedule-toolbar-resolved-control-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-resolved-border);
  color: var(--schedule-toolbar-resolved-fg);
  cursor: pointer;
  transition: all 0.15s ease;
}

.schedule-week-toolbar__step:hover:not(:disabled) {
  background: var(--schedule-toolbar-resolved-control-bg-hover);
  border-color: var(--schedule-toolbar-resolved-accent);
}

.schedule-week-toolbar__step:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.schedule-week-toolbar__save {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 12px;
  font-weight: 600;
  border-radius: max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px));
  background: var(--schedule-toolbar-resolved-accent);
  color: #fff;
  border: 0;
  cursor: pointer;
  transition: opacity 0.15s ease;
  white-space: nowrap;
}

.schedule-week-toolbar__save:hover:not(:disabled) {
  opacity: 0.9;
}

.schedule-week-toolbar__save:disabled {
  opacity: 0.5;
  cursor: wait;
}

.schedule-week-toolbar__empty {
  font-size: 12px;
  color: var(--schedule-toolbar-resolved-muted);
}
</style>
