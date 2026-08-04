<script setup lang="ts">
import { ArrowDownload20Regular, ChevronLeft20Regular, ChevronRight20Regular } from '@vicons/fluent'
import { saveAs } from 'file-saver'
import html2canvas from 'html2canvas'
import type { SelectOption, SelectProps } from 'naive-ui'
import { NButton, NIcon, NSelect, useMessage } from 'naive-ui'
import { computed } from 'vue'

import type { ScheduleWeekInfo } from '@/api/api-models'

const props = defineProps<{
  weeks: ScheduleWeekInfo[]
  captureTarget: HTMLElement | null | undefined
  fileName: string
}>()

const selectedWeek = defineModel<string>()
const message = useMessage()

const dateFormatter = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' })

const options = computed<SelectOption[]>(() => {
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
      }
    })
})

const selectedIndex = computed(() => options.value.findIndex((option) => option.value === selectedWeek.value))
const hasPreviousWeek = computed(() => selectedIndex.value > 0)
const hasNextWeek = computed(() => selectedIndex.value >= 0 && selectedIndex.value < options.value.length - 1)

function moveWeek(offset: number) {
  const option = options.value[selectedIndex.value + offset]
  if (option) selectedWeek.value = option.value as string
}

async function saveScheduleImage() {
  if (!props.captureTarget) return
  try {
    const canvas = await html2canvas(props.captureTarget, {
      width: props.captureTarget.clientWidth,
      height: props.captureTarget.clientHeight,
      backgroundColor: null,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: true,
      scale: window.devicePixelRatio,
    })
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png', 1))
    if (!blob) throw new Error('图片生成失败')
    saveAs(blob, `${props.fileName}.png`)
  } catch (error) {
    console.error(error)
    message.error('保存图片失败')
  }
}

function getISOWeekStart(year: number, week: number) {
  const januaryFourth = new Date(year, 0, 4)
  const mondayOffset = (januaryFourth.getDay() + 6) % 7
  januaryFourth.setDate(januaryFourth.getDate() - mondayOffset + (week - 1) * 7)
  return januaryFourth
}

const selectThemeOverrides: NonNullable<SelectProps['themeOverrides']> = {
  peers: {
    InternalSelection: {
      color: 'var(--schedule-toolbar-control-bg)',
      colorActive: 'var(--schedule-toolbar-control-bg)',
      colorDisabled: 'var(--schedule-toolbar-control-bg)',
      textColor: 'var(--schedule-toolbar-fg)',
      placeholderColor: 'var(--schedule-toolbar-muted)',
      arrowColor: 'var(--schedule-toolbar-muted)',
      caretColor: 'var(--schedule-toolbar-accent)',
      border: 'var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-border)',
      borderHover: 'var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-accent)',
      borderActive: 'var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-accent)',
      borderFocus: 'var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-accent)',
      boxShadowFocus: '0 0 0 2px var(--schedule-toolbar-focus)',
      boxShadowActive: '0 0 0 2px var(--schedule-toolbar-focus)',
      borderRadius: 'var(--vtsuru-page-radius)',
      heightSmall: 'var(--vtsuru-page-control-height-medium)',
    },
    InternalSelectMenu: {
      color: 'var(--schedule-toolbar-bg)',
      optionTextColor: 'var(--schedule-toolbar-fg)',
      optionTextColorPressed: 'var(--schedule-toolbar-fg)',
      optionTextColorActive: 'var(--schedule-toolbar-fg)',
      optionCheckColor: 'var(--schedule-toolbar-accent)',
      optionColorPending: 'var(--schedule-toolbar-control-bg)',
      optionColorActive: 'var(--schedule-toolbar-control-bg)',
      optionColorActivePending: 'var(--schedule-toolbar-control-bg-hover)',
      borderRadius: 'var(--vtsuru-page-radius)',
    },
  },
}
</script>

<template>
  <div class="schedule-week-toolbar">
    <button
      class="schedule-week-toolbar__step"
      type="button"
      :disabled="!hasPreviousWeek"
      aria-label="上一周"
      title="上一周"
      @click="moveWeek(-1)"
    >
      <NIcon><ChevronLeft20Regular /></NIcon>
      <span>上一周</span>
    </button>
    <NSelect
      v-if="options.length"
      v-model:value="selectedWeek"
      class="schedule-week-toolbar__select"
      :options="options"
      :theme-overrides="selectThemeOverrides"
      :to="false"
      placeholder="选择周次"
      aria-label="选择日程周次"
      size="small"
    />
    <span
      v-else
      class="schedule-week-toolbar__current"
    >
      暂无日程
    </span>
    <button
      class="schedule-week-toolbar__step"
      type="button"
      :disabled="!hasNextWeek"
      aria-label="下一周"
      title="下一周"
      @click="moveWeek(1)"
    >
      <span>下一周</span>
      <NIcon><ChevronRight20Regular /></NIcon>
    </button>
    <NButton
      v-if="captureTarget"
      class="schedule-week-toolbar__save"
      type="primary"
      size="medium"
      @click="saveScheduleImage"
    >
      <template #icon>
        <NIcon><ArrowDownload20Regular /></NIcon>
      </template>
      保存图片
    </NButton>
  </div>
</template>

<style scoped>
.schedule-week-toolbar {
  --schedule-toolbar-fg: var(--vtsuru-block-fg, var(--vtsuru-surface-fg, var(--vtsuru-page-text, var(--vtsuru-fg))));
  --schedule-toolbar-muted: var(
    --vtsuru-block-fg-muted,
    var(--vtsuru-surface-fg-muted, var(--text-color-2, var(--vtsuru-fg-muted)))
  );
  --schedule-toolbar-bg: var(
    --vtsuru-block-bg-muted,
    var(--user-page-theme-surface-bg, var(--vtsuru-page-content-color, var(--vtsuru-bg-muted)))
  );
  --schedule-toolbar-control-bg: var(
    --user-page-theme-surface-bg-hover,
    color-mix(in srgb, var(--schedule-toolbar-bg) 86%, var(--schedule-toolbar-fg) 14%)
  );
  --schedule-toolbar-control-bg-hover: color-mix(
    in srgb,
    var(--schedule-toolbar-control-bg) 88%,
    var(--schedule-toolbar-accent) 12%
  );
  --schedule-toolbar-border: var(
    --vtsuru-block-border,
    var(--vtsuru-card-border-color, var(--user-page-border-color, var(--vtsuru-border)))
  );
  --schedule-toolbar-accent: var(--vtsuru-page-primary, var(--vtsuru-brand));
  --schedule-toolbar-focus: color-mix(in srgb, var(--schedule-toolbar-accent) 24%, transparent);

  display: flex;
  align-items: center;
  gap: 8px;
  width: max-content;
  max-width: 100%;
  min-width: 0;
  margin: 0 auto 14px;
  padding: 6px;
  box-sizing: border-box;
  color: var(--schedule-toolbar-fg);
  background: var(--schedule-toolbar-bg);
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-border);
  border-radius: var(--vtsuru-page-radius, 10px);
  box-shadow: var(--vtsuru-page-shadow);
}

.schedule-week-toolbar__select {
  width: 232px;
  min-width: 0;
}

.schedule-week-toolbar__step {
  display: inline-flex;
  flex: 0 0 auto;
  height: var(--vtsuru-page-control-height-medium);
  padding: 0 9px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  color: var(--schedule-toolbar-fg);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  background: var(--schedule-toolbar-control-bg);
  border: var(--vtsuru-page-border-width) var(--vtsuru-page-border-style) var(--schedule-toolbar-border);
  border-radius: var(--vtsuru-page-radius);
  cursor: pointer;
  transition:
    color 0.15s ease,
    background-color 0.15s ease,
    border-color 0.15s ease;
}

.schedule-week-toolbar__step:hover:not(:disabled) {
  color: color-mix(in srgb, var(--schedule-toolbar-accent) 72%, var(--schedule-toolbar-fg));
  background: var(--schedule-toolbar-control-bg-hover);
  border-color: var(--schedule-toolbar-accent);
}

.schedule-week-toolbar__step:focus-visible {
  outline: 2px solid var(--schedule-toolbar-accent);
  outline-offset: 2px;
}

.schedule-week-toolbar__step:disabled {
  color: var(--schedule-toolbar-muted);
  cursor: not-allowed;
  opacity: 0.38;
}

.schedule-week-toolbar__current {
  min-width: 0;
  padding: 0 8px;
  color: var(--schedule-toolbar-fg);
  font-size: 13px;
  line-height: var(--vtsuru-page-control-height-medium);
  white-space: nowrap;
}

@media (max-width: 480px) {
  .schedule-week-toolbar {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    width: 100%;
    max-width: 100%;
    margin-right: 0;
    margin-left: 0;
  }

  .schedule-week-toolbar__select {
    width: auto;
  }

  .schedule-week-toolbar__current {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .schedule-week-toolbar__save {
    grid-column: 1 / -1;
    width: 100%;
  }

  .schedule-week-toolbar__step span {
    display: none;
  }
}
</style>
