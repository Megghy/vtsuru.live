<script setup lang="ts">
import { useAccount } from '@/api/account'
import { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ScheduleList from '@/components/ScheduleList.vue'
import { SCHEDULE_API_URL } from '@/data/constants'
import { addWeeks, endOfWeek, endOfYear, format, isBefore, startOfWeek, startOfYear } from 'date-fns'
import { NButton, NDivider, NForm, NFormItem, NModal, NSelect, NTabPane, NTabs, useMessage } from 'naive-ui'
import { SelectBaseOption, SelectMixedOption } from 'naive-ui/es/select/src/interface'
import { computed, onMounted, ref } from 'vue'

const rules = {
  user: {
    name: {
      required: true,
      message: '请输入姓名',
      trigger: 'blur',
    },
    age: {
      required: true,
      message: '请输入年龄',
      trigger: ['input', 'blur'],
    },
  },
  phone: {
    required: true,
    message: '请输入电话号码',
    trigger: ['input'],
  },
}

const yearOptions = [
  {
    label: new Date().getFullYear().toString(),
    value: new Date().getFullYear(),
  },
  {
    label: new Date().getFullYear() + 1,
    value: new Date().getFullYear() + 1,
  },
] as SelectMixedOption[]
const weekOptions = computed(() => {
  let weeks = [] as SelectMixedOption[]
  const all = getAllWeeks(addScheduleYear.value.value as number)
  all.forEach((week) => {
    weeks.push({
      label: `第${week[0] + 1}周 (${week[1]})`,
      value: week[0] + 1,
      disabled: (schedules.value?.findIndex((s) => s.year == addScheduleYear.value.value && s.week == week[0] + 1) ?? -1) > -1,
    })
  })
  return weeks
})
function getAllWeeks(year: number) {
  const startDate = startOfYear(new Date(year, 0, 1))
  const endDate = endOfYear(new Date(year, 11, 31))

  let date = startOfWeek(startDate, { weekStartsOn: 1 })
  let weeks: [number, string][] = []

  let index = 0

  while (isBefore(date, endDate)) {
    const weekStart = format(date, 'MM-dd')
    const weekEnd = format(endOfWeek(date, { weekStartsOn: 1 }), 'MM-dd')

    weeks.push([index, `${weekStart} - ${weekEnd}`])

    date = addWeeks(date, 1)
    index++
  }

  return weeks
}
const accountInfo = useAccount()
const schedules = ref<ScheduleWeekInfo[]>()
const message = useMessage()

const showUpdateModal = ref(false)
const showAddModal = ref(false)
const updateScheduleModel = ref<ScheduleWeekInfo>({} as ScheduleWeekInfo)

const addScheduleYear = ref(yearOptions[0])
const addScheduleWeek = ref()

async function get() {
  await QueryGetAPI<ScheduleWeekInfo[]>(SCHEDULE_API_URL + 'get', {
    id: accountInfo.value?.id ?? -1,
  })
    .then((data) => {
      if (data.code == 200) {
        schedules.value = data.data
        console.log(data.data)
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
}
const isAdding = ref(false)
async function addSchedule() {
  isAdding.value = true
  await QueryPostAPI(SCHEDULE_API_URL + 'update', {
    year: addScheduleYear.value.value,
    week: addScheduleWeek.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('添加成功')
        const model = {
          year: addScheduleYear.value.value as number,
          week: addScheduleWeek.value.value as number,
          days: new Array(7) as ScheduleDayInfo[],
        } as ScheduleWeekInfo
        schedules.value?.push(model)
        showAddModal.value = false
        updateScheduleModel.value = model
        showUpdateModal.value = true
      }
    })
    .finally(() => {
      isAdding.value = false
    })
}
async function onUpdateSchedule(schedule: ScheduleWeekInfo) {
  updateScheduleModel.value = schedule
  await QueryPostAPI(SCHEDULE_API_URL + 'update', {
    year: addScheduleYear.value.value,
    week: addScheduleWeek.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('添加成功')
        const model = {
          year: addScheduleYear.value.value as number,
          week: addScheduleWeek.value.value as number,
          days: new Array(7) as ScheduleDayInfo[],
        } as ScheduleWeekInfo
        showAddModal.value = false
        showUpdateModal.value = true
      }
    })
    .finally(() => {
      isAdding.value = false
    })
}

onMounted(() => {
  get()
})
</script>

<template>
  <NButton @click="showAddModal = true"> 添加日程 </NButton>
  <NModal v-model:show="showAddModal" style="width: 600px; max-width: 90vw" preset="card" title="添加周程">
    <NSelect :options="yearOptions" />
    <NSelect :options="weekOptions" />
    <NDivider />
    <NButton @click="addSchedule" :loading="isAdding"> 添加 </NButton>
  </NModal>
  <NModal v-model:show="showUpdateModal">
    <NTabs>
      <NTabPane v-for="(day, index) in updateScheduleModel.days" v-bind:key="day.time" :name="index" :tab="index.toString()"> </NTabPane>
    </NTabs>
  </NModal>
  <ScheduleList :schedules="schedules ?? []" />
</template>
