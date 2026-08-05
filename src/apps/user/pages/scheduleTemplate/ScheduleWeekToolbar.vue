<script setup lang="ts">
import {
  ArrowDownload20Regular,
  CalendarLtr20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
} from '@vicons/fluent'
import { snapdom } from '@zumer/snapdom'
import { saveAs } from 'file-saver'
import type { SelectOption, SelectProps } from 'naive-ui'
import { NIcon, NSelect, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'

import type { ScheduleWeekInfo } from '@/api/api-models'

import { scheduleFontStylesheetDomains, waitForScheduleFonts } from './scheduleFonts'
import { getISOWeekStart } from './scheduleTemplateUtils'

const props = defineProps<{
  weeks: ScheduleWeekInfo[]
  captureTarget: HTMLElement | null | undefined
  fileName: string
}>()

const selectedWeek = defineModel<string>()
const message = useMessage()
const saving = ref(false)

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

interface WeekOption extends SelectOption {
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
    message.error(
      error instanceof Error && error.message.includes('字体') ? '字体加载失败，请稍后重试' : '保存图片失败',
    )
  } finally {
    saving.value = false
  }
}

const selectThemeOverrides: NonNullable<SelectProps['themeOverrides']> = {
  peers: {
    InternalSelection: {
      color: 'var(--schedule-toolbar-resolved-control-bg)',
      colorActive: 'var(--schedule-toolbar-resolved-control-bg)',
      colorDisabled: 'var(--schedule-toolbar-resolved-control-bg)',
      textColor: 'var(--schedule-toolbar-resolved-fg)',
      placeholderColor: 'var(--schedule-toolbar-resolved-muted)',
      arrowColor: 'var(--schedule-toolbar-resolved-muted)',
      caretColor: 'var(--schedule-toolbar-resolved-accent)',
      border:
        'var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--schedule-toolbar-resolved-border)',
      borderHover:
        'var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--schedule-toolbar-resolved-accent)',
      borderActive:
        'var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--schedule-toolbar-resolved-accent)',
      borderFocus:
        'var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid) var(--schedule-toolbar-resolved-accent)',
      boxShadowFocus: '0 0 0 2px var(--schedule-toolbar-resolved-focus)',
      boxShadowActive: '0 0 0 2px var(--schedule-toolbar-resolved-focus)',
      borderRadius: 'max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px))',
      heightMedium: '42px',
      fontSizeMedium: '13px',
    },
    InternalSelectMenu: {
      color: 'var(--schedule-toolbar-resolved-bg)',
      optionTextColor: 'var(--schedule-toolbar-resolved-fg)',
      optionTextColorPressed: 'var(--schedule-toolbar-resolved-fg)',
      optionTextColorActive: 'var(--schedule-toolbar-resolved-fg)',
      optionCheckColor: 'var(--schedule-toolbar-resolved-accent)',
      optionColorPending: 'var(--schedule-toolbar-resolved-control-bg)',
      optionColorActive: 'var(--schedule-toolbar-resolved-control-bg)',
      optionColorActivePending: 'var(--schedule-toolbar-resolved-control-bg-hover)',
      borderRadius: 'var(--schedule-toolbar-resolved-radius)',
    },
  },
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
        <NIcon><ChevronLeft20Regular /></NIcon>
      </button>

      <div class="schedule-week-toolbar__current">
        <div class="schedule-week-toolbar__meta">
          <NIcon><CalendarLtr20Regular /></NIcon>
          <span>排期周次</span>
          <b v-if="selectedOption">{{ selectedOption.year }} · 第 {{ selectedOption.week }} 周</b>
        </div>
        <NSelect
          v-if="options.length"
          v-model:value="selectedWeek"
          class="schedule-week-toolbar__select"
          :options="options"
          :theme-overrides="selectThemeOverrides"
          :to="false"
          placeholder="选择周次"
          aria-label="选择日程周次"
          size="medium"
        />
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
        <NIcon><ChevronRight20Regular /></NIcon>
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
      <NIcon><ArrowDownload20Regular /></NIcon>
      <span>{{ saving ? '正在生成' : '保存图片' }}</span>
    </button>
  </nav>
</template>

<style scoped>
.schedule-week-toolbar {
  --schedule-toolbar-resolved-fg: var(
    --schedule-toolbar-fg,
    var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))))
  );
  --schedule-toolbar-resolved-muted: var(
    --schedule-toolbar-muted,
    var(--vtsuru-block-fg-muted, var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted))))
  );
  --schedule-toolbar-resolved-bg: var(
    --schedule-toolbar-bg,
    var(
      --vtsuru-block-bg-muted,
      var(
        --user-page-theme-surface-bg,
        var(--vtsuru-page-card-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-muted)))
      )
    )
  );
  --schedule-toolbar-resolved-control-bg: var(
    --schedule-toolbar-control-bg,
    var(
      --user-page-theme-surface-bg-hover,
      color-mix(in srgb, var(--schedule-toolbar-resolved-bg) 88%, var(--schedule-toolbar-resolved-fg) 12%)
    )
  );
  --schedule-toolbar-resolved-control-bg-hover: var(
    --schedule-toolbar-control-bg-hover,
    color-mix(in srgb, var(--schedule-toolbar-resolved-control-bg) 88%, var(--schedule-toolbar-resolved-accent) 12%)
  );
  --schedule-toolbar-resolved-border: var(
    --schedule-toolbar-border,
    var(--vtsuru-block-border, var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border))))
  );
  --schedule-toolbar-resolved-accent: var(--schedule-toolbar-accent, var(--vtsuru-page-primary, var(--vtsuru-brand)));
  --schedule-toolbar-resolved-focus: var(
    --schedule-toolbar-focus,
    color-mix(in srgb, var(--schedule-toolbar-resolved-accent) 28%, transparent)
  );
  --schedule-toolbar-resolved-action-bg: var(--schedule-toolbar-action-bg, var(--schedule-toolbar-resolved-accent));
  --schedule-toolbar-resolved-action-fg: var(
    --schedule-toolbar-action-fg,
    var(--vtsuru-page-primary-readable, var(--schedule-toolbar-resolved-bg))
  );
  --schedule-toolbar-resolved-radius: var(--schedule-toolbar-radius, var(--vtsuru-page-radius, 10px));
  --schedule-toolbar-resolved-shadow: var(--schedule-toolbar-shadow, var(--vtsuru-page-shadow));

  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  width: fit-content;
  max-width: min(100%, var(--schedule-toolbar-max-width, 100%));
  min-width: 0;
  margin: 0 auto 14px;
  padding: 10px;
  box-sizing: border-box;
  color: var(--schedule-toolbar-resolved-fg);
  font-family: var(--schedule-toolbar-font, var(--vtsuru-page-font-family, sans-serif));
  background: var(--schedule-toolbar-resolved-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-resolved-border);
  border-radius: var(--schedule-toolbar-resolved-radius);
  box-shadow: var(--schedule-toolbar-resolved-shadow);
}

.schedule-week-toolbar__navigator {
  display: grid;
  grid-template-columns: auto minmax(0, var(--schedule-toolbar-picker-width, 300px)) auto;
  gap: 8px;
  align-items: stretch;
  justify-content: start;
  min-width: 0;
}

.schedule-week-toolbar__current {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.schedule-week-toolbar__meta {
  display: flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  padding-inline: 2px;
  color: var(--schedule-toolbar-resolved-muted);
  font-size: 10px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: 0.08em;
}

.schedule-week-toolbar__meta > span {
  font-size: 0;
}

.schedule-week-toolbar__meta > span::after {
  font-size: 10px;
  content: var(--schedule-toolbar-label, '排期周次');
}

.schedule-week-toolbar__meta .n-icon {
  flex: none;
  color: var(--schedule-toolbar-resolved-accent);
  font-size: 14px;
}

.schedule-week-toolbar__meta b {
  margin-left: auto;
  overflow: hidden;
  color: var(--schedule-toolbar-resolved-fg);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.schedule-week-toolbar__select {
  width: 100%;
  min-width: 0;
}

.schedule-week-toolbar__step {
  display: inline-flex;
  flex: 0 0 auto;
  min-width: 44px;
  min-height: 44px;
  padding: 0 10px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--schedule-toolbar-resolved-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
  background: var(--schedule-toolbar-resolved-control-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-resolved-border);
  border-radius: max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px));
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.schedule-week-toolbar__step:hover:not(:disabled) {
  color: color-mix(in srgb, var(--schedule-toolbar-resolved-accent) 72%, var(--schedule-toolbar-resolved-fg));
  background: var(--schedule-toolbar-resolved-control-bg-hover);
  border-color: var(--schedule-toolbar-resolved-accent);
}

.schedule-week-toolbar__step:focus-visible,
.schedule-week-toolbar__save:focus-visible {
  outline: 2px solid var(--schedule-toolbar-resolved-accent);
  outline-offset: 2px;
}

.schedule-week-toolbar__step:disabled {
  color: var(--schedule-toolbar-resolved-muted);
  cursor: not-allowed;
  opacity: 0.42;
}

.schedule-week-toolbar__empty {
  display: flex;
  align-items: center;
  height: 42px;
  min-width: 0;
  padding: 0 12px;
  color: var(--schedule-toolbar-resolved-muted);
  font-size: 13px;
  background: var(--schedule-toolbar-resolved-control-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-resolved-border);
  border-radius: max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px));
  white-space: nowrap;
}

.schedule-week-toolbar__save {
  display: inline-flex;
  min-width: 118px;
  min-height: 44px;
  padding: 0 16px;
  align-items: center;
  justify-content: center;
  gap: 7px;
  color: var(--schedule-toolbar-resolved-action-fg);
  font: inherit;
  font-size: 13px;
  font-weight: 750;
  line-height: 1;
  background: var(--schedule-toolbar-resolved-action-bg);
  border: var(--vtsuru-page-border-width, 1px) var(--vtsuru-page-border-style, solid)
    var(--schedule-toolbar-action-border, var(--schedule-toolbar-resolved-action-bg));
  border-radius: max(4px, calc(var(--schedule-toolbar-resolved-radius) - 4px));
  cursor: pointer;
  transition:
    filter 0.15s ease,
    transform 0.15s ease;
}

.schedule-week-toolbar__save:hover:not(:disabled) {
  filter: brightness(1.08) saturate(1.04);
  transform: translateY(-1px);
}

.schedule-week-toolbar__save:active:not(:disabled) {
  filter: brightness(0.95);
  transform: translateY(0);
}

.schedule-week-toolbar__save:disabled {
  cursor: wait;
  opacity: 0.7;
}

@container (max-width: 560px) {
  .schedule-week-toolbar {
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    padding: 8px;
  }

  .schedule-week-toolbar__save {
    width: 100%;
  }
}

@container (max-width: 390px) {
  .schedule-week-toolbar__meta b {
    font-size: 9px;
  }
}
</style>
