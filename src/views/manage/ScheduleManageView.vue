<script setup lang="ts">
import { useAccount } from '@/api/account'
import {  ScheduleWeekInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ScheduleList from '@/components/ScheduleList.vue'
import { SCHEDULE_API_URL } from '@/data/constants'
import { addWeeks, endOfWeek, endOfYear, format, isBefore, startOfWeek, startOfYear } from 'date-fns'
import {
  NAlert,
  NBadge,
  NButton,
  NColorPicker,
  NDivider,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NTimePicker,
  useMessage,
} from 'naive-ui'
import { SelectMixedOption, SelectOption } from 'naive-ui/es/select/src/interface'
import { VNode, computed, h, onMounted, ref } from 'vue'

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
const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
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
  const all = getAllWeeks(selectedScheduleYear.value)
  all.forEach((week) => {
    const isExist = (schedules.value?.findIndex((s) => s.year == selectedScheduleYear.value && s.week == week[0] + 1) ?? -1) > -1
    weeks.push({
      label: `${isExist ? '(已安排)' : ''} 第${week[0] + 1}周 (${week[1]})`,
      value: week[0] + 1,
      disabled: isExist,
    })
  })
  return weeks
})
const dayOptions = computed(() => {
  let days = [] as SelectMixedOption[]
  for (let i = 0; i < 7; i++) {
    try {
      days.push({
        label: updateScheduleModel.value?.days[i].tag ? weekdays[i] + ' (已安排)' : weekdays[i],
        value: i,
      })
    } catch (err) {
      console.error(err)
    }
  }
  return days
})
const existTagOptions = computed(() => {
  let colors = [] as SelectMixedOption[]
  schedules.value?.forEach((s) => {
    s.days.forEach((d) => {
      if (d.tag && !colors.find((c) => c.value == d.tagColor && c.label == d.tag)) {
        colors.push({
          label: d.tag,
          value: d.tagColor ?? '',
        })
      }
    })
  })
  return colors
})
function getAllWeeks(year: number) {
  const startDate = startOfYear(new Date(year, 0, 1))
  const endDate = endOfYear(new Date(year, 11, 31))

  let date = startOfWeek(startDate, { weekStartsOn: 1 })
  let weeks: [number, string][] = []

  let index = 0

  while (isBefore(date, endDate)) {
    const weekStart = format(date, 'MM/dd')
    const weekEnd = format(endOfWeek(date, { weekStartsOn: 1 }), 'MM/dd')

    weeks.push([index, `${weekStart} - ${weekEnd}`])

    date = addWeeks(date, 1)
    index++
  }

  return weeks
}
const accountInfo = useAccount()
const schedules = ref<ScheduleWeekInfo[]>()
const message = useMessage()

const isLoading = ref(true)

const showUpdateModal = ref(false)
const showAddModal = ref(false)
const showCopyModal = ref(false)
const updateScheduleModel = ref<ScheduleWeekInfo>({} as ScheduleWeekInfo)
const selectedExistTag = ref()

const selectedDay = ref(0)
const selectedScheduleYear = ref(new Date().getFullYear())
const selectedScheduleWeek = ref(Number(format(Date.now(), 'w')) + 1)

async function get() {
  isLoading.value = true
  await QueryGetAPI<ScheduleWeekInfo[]>(SCHEDULE_API_URL + 'get', {
    id: accountInfo.value?.id ?? -1,
  })
    .then((data) => {
      if (data.code == 200) {
        schedules.value = data.data
      } else {
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
    .finally(() => (isLoading.value = false))
}
const isFetching = ref(false)
async function addSchedule() {
  isFetching.value = true
  await QueryPostAPI(SCHEDULE_API_URL + 'update', {
    year: selectedScheduleYear.value,
    week: selectedScheduleWeek.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('添加成功')
        showAddModal.value = false
        get()
      } else {
        message.error('添加失败: ' + data.message)
      }
    })
    .finally(() => {
      isFetching.value = false
    })
}
async function onCopySchedule() {
  if (schedules.value?.find((s) => s.year == selectedScheduleYear.value && s.week == selectedScheduleWeek.value)) {
    message.error('想要复制到的周已存在')
  } else {
    updateScheduleModel.value.year = selectedScheduleYear.value
    updateScheduleModel.value.week = selectedScheduleWeek.value
    await onUpdateSchedule()
    showCopyModal.value = false
  }
}
async function onUpdateSchedule() {
  isFetching.value = true
  await QueryPostAPI(SCHEDULE_API_URL + 'update', {
    year: updateScheduleModel.value.year,
    week: updateScheduleModel.value.week,
    day: selectedDay.value,
    days: updateScheduleModel.value?.days,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('成功')
        const s = schedules.value?.find((s) => s.year == selectedScheduleYear.value && s.week == selectedScheduleWeek.value)
        if (s) {
          s.days[selectedDay.value] = updateScheduleModel.value.days[selectedDay.value]
        } else {
          schedules.value?.push(updateScheduleModel.value)
        }
        //updateScheduleModel.value = {} as ScheduleWeekInfo
      } else {
        message.error('修改失败: ' + data.message)
      }
    })
    .finally(() => {
      isFetching.value = false
    })
}
async function onDeleteSchedule(schedule: ScheduleWeekInfo) {
  await QueryGetAPI(SCHEDULE_API_URL + 'del', {
    year: schedule.year,
    week: schedule.week,
  }).then((data) => {
    if (data.code == 200) {
      message.success('已删除')
      get()
    } else {
      message.error('删除失败: ' + data.message)
    }
  })
}
function onOpenUpdateModal(schedule: ScheduleWeekInfo) {
  updateScheduleModel.value = JSON.parse(JSON.stringify(schedule))
  showUpdateModal.value = true
}
function onOpenCopyModal(schedule: ScheduleWeekInfo) {
  updateScheduleModel.value = JSON.parse(JSON.stringify(schedule))
  showCopyModal.value = true
}
function onSelectChange(value: string | null, option: SelectMixedOption) {
  if (value) {
    updateScheduleModel.value.days[selectedDay.value].tagColor = value
    updateScheduleModel.value.days[selectedDay.value].tag = option.label as string
  }
}
const renderOption = ({ node, option }: { node: VNode; option: SelectOption }) =>
  h(NSpace, { align: 'center', size: 3, style: 'margin-left: 5px' }, () => [option.value ? h(NBadge, { dot: true, color: option.value?.toString() }) : null, node])

onMounted(() => {
  get()
})
</script>

<template>
  <NButton @click="showAddModal = true" type="primary"> 添加周程 </NButton>
  <NDivider />
  <NModal v-model:show="showAddModal" style="width: 600px; max-width: 90vw" preset="card" title="添加周程">
    <NSpace vertical>
      年份
      <NSelect :options="yearOptions" v-model:value="selectedScheduleYear" />
      第几周
      <NSelect :options="weekOptions" v-model:value="selectedScheduleWeek" />
    </NSpace>
    <NDivider />
    <NButton @click="addSchedule" :loading="isFetching"> 添加 </NButton>
  </NModal>
  <NModal v-model:show="showCopyModal" style="width: 600px; max-width: 90vw" preset="card" title="复制周程">
    <NAlert type="info"> 复制为 </NAlert>
    <NSpace vertical>
      年份
      <NSelect :options="yearOptions" v-model:value="selectedScheduleYear" />
      第几周
      <NSelect :options="weekOptions" v-model:value="selectedScheduleWeek" />
    </NSpace>
    <NDivider />
    <NButton @click="onCopySchedule" :loading="isFetching"> 复制 </NButton>
  </NModal>
  <NModal v-model:show="showUpdateModal" style="width: 600px; max-width: 90vw" preset="card" title="编辑周程">
    <NSelect :options="dayOptions" v-model:value="selectedDay" />
    <NDivider />
    <template v-if="updateScheduleModel">
      <NSpace vertical>
        <NSpace>
          <NInputGroup>
            <NInputGroupLabel type="primary"> 标签 </NInputGroupLabel>
            <NInput v-model:value="updateScheduleModel.days[selectedDay].tag" placeholder="标签 | 留空视为无安排" style="max-width: 300px" maxlength="10" show-count />
          </NInputGroup>
          <NSelect
            v-model:value="selectedExistTag"
            @update:value="onSelectChange"
            :options="existTagOptions"
            filterable
            clearable
            placeholder="使用过的标签"
            style="max-width: 150px"
            :render-option="renderOption"
          />
        </NSpace>
        <NInputGroup>
          <NInputGroupLabel> 内容 </NInputGroupLabel>
          <NInput v-model:value="updateScheduleModel.days[selectedDay].title" placeholder="内容" style="max-width: 200px" maxlength="30" show-count />
        </NInputGroup>
        <NTimePicker default-formatted-value="20:00" v-model:formatted-value="updateScheduleModel.days[selectedDay].time" format="HH:mm" />
        <NColorPicker
          v-model:value="updateScheduleModel.days[selectedDay].tagColor"
          :swatches="['#FFFFFF', '#18A058', '#2080F0', '#F0A020', 'rgba(208, 48, 80, 1)']"
          default-value="#61B589"
          :show-alpha="false"
          :modes="['hex']"
        />
        <NButton @click="onUpdateSchedule()" :loading="isFetching"> 保存 </NButton>
      </NSpace>
    </template>
  </NModal>
  <NSpin v-if="isLoading" show />
  <ScheduleList v-else :schedules="schedules ?? []" @on-update="onOpenUpdateModal" @on-delete="onDeleteSchedule" @on-copy="onOpenCopyModal" is-self />
</template>
