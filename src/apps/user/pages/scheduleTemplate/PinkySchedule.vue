<script setup lang="ts">
import type { ScheduleConfigType } from '@/shared/types/TemplateTypes'
import { getWeek, getYear } from 'date-fns'
import { NDivider, NSelect, NFlex } from 'naive-ui';
import { computed, onMounted, ref } from 'vue'
import SaveCompoent from '@/apps/user/components/SaveCompoent.vue'

const props = defineProps<ScheduleConfigType>()
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const table = ref()

const currentWeek = computed(() => {
  if (props.data?.length == 1) {
    return props.data[0]
  }
  return props.data?.find((item) => {
    if (selectedDate.value) {
      return `${item.year}-${item.week}` === selectedDate.value
    }
    return isTodayInWeek(item.year, item.week)
  })
})

const formattedDays = computed(() => {
  const weekData = currentWeek.value
  if (!weekData || !Array.isArray(weekData.days)) return []

  return weekData.days.map((dayList) => {
    // 取每天第一个行程展示
    if (Array.isArray(dayList) && dayList.length > 0) {
      return dayList[0]
    }
    return { time: '', tag: '', title: '', tagColor: '', id: null }
  })
})
const options = computed(() => {
  return props.data?.map((item) => {
    return {
      label: `${item.year}年${item.week}周`,
      value: `${item.year}-${item.week}`,
    }
  })
})
const selectedDate = ref<string>()

function isTodayInWeek(year: number, week: number): boolean {
  const today = new Date()
  const todayYear = getYear(today)
  const todayWeek = getWeek(today, { weekStartsOn: 1 })

  return todayYear === year && todayWeek === week
}

onMounted(() => {
  if (currentWeek.value) {
    selectedDate.value = `${currentWeek.value.year}-${currentWeek.value.week}`
  }
})
</script>

<template>
  <NFlex>
    <NSelect
      v-model:value="selectedDate"
      :options="options"
      style="width: 200px"
      placeholder="选择其他周表"
    />
    <SaveCompoent
      :compoent="table"
      :file-name="`周表_${selectedDate}_${props.userInfo?.name}`"
    />
  </NFlex>
  <NDivider />
  <div
    ref="table"
    class="schedule-template pinky container"
  >
    <div class="schedule-template pinky day-container">
      <div
        v-for="(item, index) in formattedDays"
        :id="index.toString()"
        :key="index"
        class="schedule-template pinky day-item"
      >
        <div class="schedule-template pinky header">
          <span class="schedule-template pinky week">
            {{ days[index] }}
          </span>
          <span class="schedule-template pinky time">
            {{ item?.time }}
          </span>
          <span class="schedule-template pinky tag">
            {{ item?.tag }}
          </span>
        </div>
        <div class="schedule-template pinky day-content-container">
          <span
            v-if="item?.tag"
            id="work"
            class="schedule-template pinky day-content"
          >
            {{ item.title }}
          </span>
          <span
            v-else
            id="rest"
            class="schedule-template pinky day-content"
          > 休息 </span>
        </div>
      </div>
    </div>
    <div class="schedule-template pinky title-container">
      <div class="schedule-template pinky title">
        S C H E D U L E
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-template.pinky.container {
  --pinky-font-color-dark: #dba2a2c9;
  --pinky-border-color-dark: #eeb9b9;
  margin: 0 auto;
  width: 540px;
  height: 700px;
  border-radius: 20px;
  background-color: #faebeb;
  background-image: linear-gradient(90deg, #ffffff 10%, rgba(0, 0, 0, 0) 10%),
    linear-gradient(#ffffff 10%, rgba(0, 0, 0, 0) 10%);
  background-size: 20px 20px;
  border: 3px solid #e0cbcb;
}
.schedule-template.pinky.day-container {
  display: flex;
  width: 500px;
  margin-top: 10px;
  flex-wrap: wrap;
  flex-direction: column;
  margin-left: 20px;
}
.schedule-template.pinky.day-content-container {
  height: 50px;
  border-radius: 15px;
  border: 3px solid var(--pinky-border-color-dark);
  border-top: none;
  border-left: none;
  background-color: #f5dadac9;
}
.schedule-template.pinky.header {
  position: relative;
  height: 30px;
  font-size: 16px;
  font-weight: bold;
  color: #dba2a2c9;
  top: 2px;
}
.schedule-template.pinky.week {
  position: relative;
  left: 5px;
}
.schedule-template.pinky.time {
  position: relative;
  left: 15px;
}
.schedule-template.pinky.tag {
  position: absolute;
  text-align: right;
  right: 5px;
}
.schedule-template.pinky.day-content {
  position: relative;
  top: 10px;
  left: 10px;
  font-size: 18px;
  font-weight: 550;
  color: #af8080c9;
}
.schedule-template.pinky.day-content#rest {
  color: #cfb7b7c9;
  font-style: italic;
}
.schedule-template.pinky.title-container {
  position: relative;
  background: #fdf8f8c9;
  width: 400px;
  height: 70px;
  left: 70px;
  top: 20px;
  border-radius: 20px;
  border: 3px solid var(--pinky-border-color-dark);
  border-top: none;
  border-left: none;
}
.schedule-template.pinky.title {
  position: relative;
  top: -5px;
  font-size: 50px;
  text-align: center;
  color: var(--pinky-font-color-dark);
}
</style>
