<script lang="ts">
export const Config = defineTemplateConfig([
  {
    name: '背景图', // Removed 'as const'
    type: 'file',
    key: 'backgroundFile', // Removed 'as const'
    fileLimit: 1,
    onUploaded: (files: UploadFileResponse[], config: any) => {
      config.backgroundFile = files;
    },
  },
  {
    name: '容器背景色',
    type: 'color',
    key: 'containerColor',
    default: { r: 255, g: 255, b: 255, a: 0.8 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '日期标签文字色',
    type: 'color',
    key: 'dayLabelColor',
    default: { r: 126, g: 136, b: 184, a: 1 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '日程内容背景色',
    type: 'color',
    key: 'dayContentBgColor',
    default: { r: 255, g: 255, b: 255, a: 1 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '日程内容文字色',
    type: 'color',
    key: 'dayContentTextColor',
    default: { r: 100, g: 100, b: 100, a: 1 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '时间标签背景色',
    type: 'color',
    key: 'timeLabelBgColor',
    default: { r: 245, g: 189, b: 189, a: 1 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '时间标签文字色',
    type: 'color',
    key: 'timeLabelTextColor',
    default: { r: 255, g: 255, b: 255, a: 1 } as RGBAColor,
    showAlpha: true,
  },
  {
    name: '装饰图片',
    type: 'decorativeImages',
    key: 'decorativeFile',
  },
]);
export type KawaiiConfigType = ExtractConfigData<typeof Config>;
export const DefaultConfig = {

} as KawaiiConfigType;
</script>


<script setup lang="ts">
import { ScheduleDayInfo, ScheduleWeekInfo, UploadFileResponse } from '@/api/api-models';
import SaveCompoent from '@/components/SaveCompoent.vue'; // 引入截图组件
import { ScheduleConfigTypeWithConfig } from '@/data/TemplateTypes'; // Use base type
import { defineTemplateConfig, ExtractConfigData, RGBAColor, rgbaToString } from '@/data/VTsuruConfigTypes';
import { getWeek, getYear } from 'date-fns';
import { NDivider, NSelect, NSpace, useMessage } from 'naive-ui';
import { computed, ref, watch, WritableComputedRef } from 'vue';

// Get message instance
const message = useMessage();

const props = defineProps<ScheduleConfigTypeWithConfig<KawaiiConfigType>>();

// --- 默认配置 --- Define DefaultConfig using KawaiiConfigType
// No export needed here
const DefaultConfig: KawaiiConfigType = {
  backgroundFile: [],
  containerColor: { r: 255, g: 255, b: 255, a: 0.8 },
  dayLabelColor: { r: 126, g: 136, b: 184, a: 1 },
  dayContentBgColor: { r: 255, g: 255, b: 255, a: 1 },
  dayContentTextColor: { r: 100, g: 100, b: 100, a: 1 },
  timeLabelBgColor: { r: 245, g: 189, b: 189, a: 1 },
  timeLabelTextColor: { r: 255, g: 255, b: 255, a: 1 },
  decorativeFile: [],
};

// --- 状态 ---
const tableRef = ref<HTMLElement | null>(null);
const _selectedDate = ref<string>(); // Internal state

// --- Computed Properties ---

// 合并默认配置和传入的配置
const effectiveConfig = computed(() => {
  return { ...DefaultConfig, ...props.config };
});

// Writable computed for selectedDate to handle potential side effects safely
const selectedDate: WritableComputedRef<string | undefined> = computed({
  get: () => _selectedDate.value,
  set: (val) => { _selectedDate.value = val; }
});

// 周选择器选项
const weekOptions = computed(() => {
  return props.data?.map((item: ScheduleWeekInfo) => ({
    label: `${item.year}年 第${item.week}周`,
    value: `${item.year}-${item.week}`,
  })) ?? [];
});

// Find current/selected week data without side effects
const currentWeekData = computed<ScheduleWeekInfo | null>(() => {
  if (!props.data || props.data.length === 0) return null;
  const findPredicateSelected = (item: ScheduleWeekInfo) => `${item.year}-${item.week}` === _selectedDate.value;
  const findPredicateCurrent = (item: ScheduleWeekInfo) => isTodayInWeek(item.year, item.week);

  let target = _selectedDate.value
    ? props.data.find(findPredicateSelected)
    : props.data.find(findPredicateCurrent);

  // Fallback if target not found (e.g., selected date no longer exists)
  if (!target) {
    target = props.data.find(findPredicateCurrent) || props.data[0];
  }
  return target || null;
});

// Watcher to initialize or update selectedDate based on available data
watch([() => props.data, currentWeekData], ([newDataArray, newCurrentWeek], [oldDataArray, oldCurrentWeek]) => {
  const currentSelection = _selectedDate.value;
  const dataAvailable = newDataArray && newDataArray.length > 0;

  if (!currentSelection && newCurrentWeek) {
    // Initialize selection if empty and current week data is available
    _selectedDate.value = `${newCurrentWeek.year}-${newCurrentWeek.week}`;
  } else if (currentSelection && dataAvailable) {
    // Check if the currently selected date still exists in the new data array
    const selectionExists = newDataArray.some((d: ScheduleWeekInfo) => `${d.year}-${d.week}` === currentSelection);
    if (!selectionExists) {
      // If selection no longer exists, fallback to current week or first available
      const fallbackWeek = newDataArray.find((d: ScheduleWeekInfo) => isTodayInWeek(d.year, d.week)) || newDataArray[0];
      _selectedDate.value = fallbackWeek ? `${fallbackWeek.year}-${fallbackWeek.week}` : undefined;
    }
  } else if (!dataAvailable) {
    // Clear selection if no data is available
    _selectedDate.value = undefined;
  }
}, { immediate: true });

// Day mapping and order
const dayMap: Record<string, string> = { Mon: '周一', Tue: '周二', Wed: '周三', Thu: '周四', Fri: '周五', Sat: '周六', Sun: '周日' };
const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Formatted schedule data for display
const formattedSchedule = computed(() => {
  if (!currentWeekData.value || !Array.isArray(currentWeekData.value.days)) return [];
  const scheduleMap = new Map<string, ScheduleDayInfo>();
  currentWeekData.value.days.forEach((day: ScheduleDayInfo, index: number) => {
    const dayKey = daysOfWeek[index] || `day${index}`;
    scheduleMap.set(dayKey, day);
  });
  return daysOfWeek.map(dayKey => ({
    key: dayKey,
    label: dayMap[dayKey] || dayKey,
    data: scheduleMap.get(dayKey) || { time: '', tag: '', title: '' }
  }));
});

// --- 方法 ---
function isTodayInWeek(year: number, week: number): boolean {
  const today = new Date();
  const todayYear = getYear(today);
  const todayWeek = getWeek(today, { weekStartsOn: 1 });
  return todayYear === year && todayWeek === week;
}

// --- Expose Config and DefaultConfig for template system ---
// These need to be the actual constant values
defineExpose({ Config, DefaultConfig });

</script>

<template>
  <div class="kawaii-schedule-selector">
    <NSpace align="center">
      <NSelect
        v-model:value="selectedDate"
        :options="weekOptions"
        style="width: 200px"
        placeholder="选择周次"
        size="small"
        clearable
      />
      <SaveCompoent
        v-if="tableRef"
        :compoent="tableRef"
        :file-name="`日程表_${selectedDate || '当前'}_${props.userInfo?.name || '用户'}`"
        tooltip-text="保存当前周表为图片"
      />
    </NSpace>
    <NDivider />
  </div>

  <div
    ref="tableRef"
    class="kawaii-schedule-container"
    :style="{
      '--container-bg-color': rgbaToString(effectiveConfig.containerColor),
      '--day-label-color': rgbaToString(effectiveConfig.dayLabelColor),
      '--day-content-bg-color': rgbaToString(effectiveConfig.dayContentBgColor),
      '--day-content-text-color': rgbaToString(effectiveConfig.dayContentTextColor),
      '--time-label-bg-color': rgbaToString(effectiveConfig.timeLabelBgColor),
      '--time-label-text-color': rgbaToString(effectiveConfig.timeLabelTextColor),
      backgroundImage: effectiveConfig.backgroundFile && effectiveConfig.backgroundFile.length > 0 ? `url(${effectiveConfig.backgroundFile[0].path})` : 'none',
    }"
  >
    <!-- 装饰图片渲染 -->
    <div
      v-for="img in effectiveConfig.decorativeFile"
      :key="img.id"
      class="decorative-image"
      :style="{
        position: 'absolute',
        left: `${img.x}%`,
        top: `${img.y}%`,
        width: `${img.width}%`,
        height: 'auto',
        transform: `translate(-50%, -50%) rotate(${img.rotation}deg)`,
        transformOrigin: 'center center',
        opacity: img.opacity,
        zIndex: img.zIndex,
        pointerEvents: 'none',
      }"
    >
      <img
        :src="img.path"
        alt="decoration"
        style="display: block; width: 100%; height: auto;"
      >
    </div>

    <!-- 日程表主体 -->
    <div class="schedule-main-grid">
      <!-- 左侧日程 -->
      <div class="schedule-days-left">
        <div
          v-for="day in formattedSchedule.slice(0, 5)"
          :key="day.key"
          class="day-item-wrapper"
        >
          <div class="day-label">
            {{ day.label }}
          </div>
          <div class="day-content">
            <div
              v-if="day.data?.time"
              class="time-label"
            >
              {{ day.data.time }}
            </div>
            <div class="content-text">
              {{ day.data?.title || '休息' }}
            </div>
          </div>
        </div>
      </div>
      <!-- 右侧日程 -->
      <div class="schedule-days-right">
        <div
          v-for="day in formattedSchedule.slice(5)"
          :key="day.key"
          class="day-item-wrapper"
        >
          <div class="day-label">
            {{ day.label }}
          </div>
          <div class="day-content">
            <div
              v-if="day.data?.time"
              class="time-label"
            >
              {{ day.data.time }}
            </div>
            <div class="content-text">
              {{ day.data?.title || '待定~' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Styles remain the same */
/* --- Base Container --- */
.kawaii-schedule-container {
  position: relative;
  /* Crucial for absolute positioned decorations */
  width: 900px;
  /* Adjust width as needed */
  /* height: 650px; */
  /* Let content determine height or set fixed */
  min-height: 650px;
  /* Ensure minimum height */
  padding: 30px;
  margin: 0 auto;
  border-radius: 25px;
  background-color: var(--container-bg-color, rgba(253, 240, 240, 0.8));
  /* Default soft pinkish */
  background-size: cover;
  background-position: center;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  /* Clip decorations exceeding bounds */
  box-sizing: border-box;
  /* Add font later */
  font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  /* Example font */
  color: #555;
}

/* Decorative image base style */
.decorative-image {
  /* Style defined inline via :style binding */
}

.decorative-image img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
  /* Ensure image fits within its bounds */
}


/* --- Layout Grid --- */
.schedule-main-grid {
  position: relative;
  /* Ensure content is above background decorations if needed */
  z-index: 10;
  /* Content above default decoration z-index */
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  /* Adjust column ratio as needed */
  gap: 25px;
  height: 100%;
}

.schedule-days-left,
.schedule-days-right {
  display: flex;
  flex-direction: column;
  gap: 15px;
  /* Space between day items */
}

/* --- Day Item Styling --- */
.day-item-wrapper {
  display: flex;
  align-items: center;
  gap: 15px;
}

.day-label {
  flex-shrink: 0;
  width: 70px;
  /* Adjust width */
  height: 45px;
  /* Adjust height */
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #fdecec;
  /* Light pink cloud */
  border-radius: 15px 15px 15px 15px / 20px 20px 20px 20px;
  /* Cloud shape */
  color: var(--day-label-color);
  font-weight: bold;
  font-size: 16px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.day-content {
  flex-grow: 1;
  position: relative;
  /* For absolute positioning of time label */
  background-color: var(--day-content-bg-color);
  border-radius: 12px;
  padding: 10px 15px;
  min-height: 50px;
  /* Ensure minimum height */
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.05);
  display: flex;
  /* Use flex for content alignment if needed */
  align-items: center;
  /* Vertically center text */
}

.time-label {
  position: absolute;
  top: -10px;
  /* Position above the content box */
  right: 15px;
  /* Align to the right */
  background-color: var(--time-label-bg-color);
  color: var(--time-label-text-color);
  font-size: 11px;
  font-weight: bold;
  padding: 2px 8px;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.content-text {
  color: var(--day-content-text-color);
  font-size: 15px;
  line-height: 1.4;
  width: 100%;
  /* Take full width */
}


/* --- Week Selector Area --- */
.kawaii-schedule-selector {
  padding: 5px 10px;
  /* Add some padding */
}

/* Optional: Style Naive components if needed */
:deep(.n-select .n-base-selection) {
  border-radius: 15px;
}

/* --- Configuration UI specific styles --- */
/* Add styles for the NCard and controls within the render function if needed */
.n-card {
  transition: border 0.2s ease-in-out;
}
</style>