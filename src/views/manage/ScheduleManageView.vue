<script setup lang="ts">
import { DisableFunction, EnableFunction, useAccount } from '@/api/account'
import { FunctionTypes, ScheduleWeekInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ScheduleList from '@/components/ScheduleList.vue'
import { BASE_API_URL, CN_HOST, CURRENT_HOST, SCHEDULE_API_URL } from '@/data/constants'
import { copyToClipboard } from '@/Utils'
import { TagQuestionMark16Filled } from '@vicons/fluent'
import { useStorage } from '@vueuse/core'
import { addWeeks, endOfWeek, endOfYear, format, isBefore, startOfWeek, startOfYear } from 'date-fns'
import {
  NAlert,
  NBadge,
  NButton,
  NCheckbox,
  NColorPicker,
  NDivider,
  NFlex,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NSwitch,
  NTimePicker,
  NTooltip,
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
  const weeks = [] as SelectMixedOption[]
  const all = getAllWeeks(selectedScheduleYear.value)
  all.forEach((week) => {
    const isExist =
      (schedules.value?.findIndex((s) => s.year == selectedScheduleYear.value && s.week == week[0] + 1) ?? -1) > -1
    weeks.push({
      label: `${isExist ? '(已安排)' : ''} 第${week[0] + 1}周 (${week[1]})`,
      value: week[0] + 1,
      disabled: isExist,
    })
  })
  return weeks
})
const dayOptions = computed(() => {
  const days = [] as SelectMixedOption[]
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
  const colors = [] as SelectMixedOption[]
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
  const weeks: [number, string][] = []

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
        const s = schedules.value?.find(
          (s) => s.year == selectedScheduleYear.value && s.week == selectedScheduleWeek.value,
        )
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
  h(NSpace, { align: 'center', size: 3, style: 'margin-left: 5px' }, () => [
    option.value ? h(NBadge, { dot: true, color: option.value?.toString() }) : null,
    node,
  ])
async function setFunctionEnable(enable: boolean) {
  let success = false
  if (enable) {
    success = await EnableFunction(FunctionTypes.Schedule)
  } else {
    success = await DisableFunction(FunctionTypes.Schedule)
  }
  if (success) {
    message.success('已' + (enable ? '启用' : '禁用'))
  } else {
    message.error('无法' + (enable ? '启用' : '禁用'))
  }
}

onMounted(() => {
  get()
})
</script>

<template>
  <NSpace align="center">
    <NAlert
      :type="accountInfo.settings.enableFunctions.includes(FunctionTypes.Schedule) ? 'success' : 'warning'"
      style="max-width: 200px"
    >
      启用日程表
      <NDivider vertical />
      <NSwitch
        :value="accountInfo?.settings.enableFunctions.includes(FunctionTypes.Schedule)"
        @update:value="setFunctionEnable"
      />
    </NAlert>
    <NButton
      type="primary"
      @click="showAddModal = true"
    >
      添加周程
    </NButton>
    <NButton @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'template', template: 'schedule' } })">
      修改模板
    </NButton>
  </NSpace>
  <NDivider
    style="margin: 16px 0 16px 0"
    title-placement="left"
  >
    日程表展示页链接
  </NDivider>
  <NFlex align="center">
    <NInputGroup style="max-width: 400px;">
      <NInput
        :value="`${CURRENT_HOST}@${accountInfo.name}/schedule`"
        readonly
      />
      <NButton
        secondary
        @click="copyToClipboard(`${CURRENT_HOST}@${accountInfo.name}/schedule`)"
      >
        复制
      </NButton>
    </NInputGroup>
  </NFlex>
  <NDivider
    style="margin: 16px 0 16px 0"
    title-placement="left"
  >
    订阅链接
    <NTooltip>
      <template #trigger>
        <NIcon>
          <TagQuestionMark16Filled />
        </NIcon>
      </template>
      通过订阅链接可以订阅日程表到日历软件中
    </NTooltip>
  </NDivider>
  <NFlex align="center">
    <NInputGroup style="max-width: 400px;">
      <NInput
        :value="`${SCHEDULE_API_URL}${accountInfo.id}.ics`"
        readonly
      />
      <NButton
        secondary
        @click="copyToClipboard(`${SCHEDULE_API_URL}${accountInfo.id}.ics`)"
      >
        复制
      </NButton>
    </NInputGroup>
  </NFlex>
  <NDivider />
  <NModal
    v-model:show="showAddModal"
    style="width: 600px; max-width: 90vw"
    preset="card"
    title="添加周程"
  >
    <NSpace vertical>
      年份
      <NSelect
        v-model:value="selectedScheduleYear"
        :options="yearOptions"
      />
      第几周
      <NSelect
        v-model:value="selectedScheduleWeek"
        :options="weekOptions"
      />
    </NSpace>
    <NDivider />
    <NButton
      :loading="isFetching"
      @click="addSchedule"
    >
      添加
    </NButton>
  </NModal>
  <NModal
    v-model:show="showCopyModal"
    style="width: 600px; max-width: 90vw"
    preset="card"
    title="复制周程"
  >
    <NAlert type="info">
      复制为
    </NAlert>
    <NSpace vertical>
      年份
      <NSelect
        v-model:value="selectedScheduleYear"
        :options="yearOptions"
      />
      第几周
      <NSelect
        v-model:value="selectedScheduleWeek"
        :options="weekOptions"
      />
    </NSpace>
    <NDivider />
    <NButton
      :loading="isFetching"
      @click="onCopySchedule"
    >
      复制
    </NButton>
  </NModal>
  <NModal
    v-model:show="showUpdateModal"
    style="width: 600px; max-width: 90vw"
    preset="card"
    title="编辑周程"
  >
    <NSelect
      v-model:value="selectedDay"
      :options="dayOptions"
    />
    <NDivider />
    <template v-if="updateScheduleModel">
      <NSpace vertical>
        <NSpace>
          <NInputGroup>
            <NInputGroupLabel type="primary">
              标签
            </NInputGroupLabel>
            <NInput
              v-model:value="updateScheduleModel.days[selectedDay].tag"
              placeholder="标签 | 留空视为无安排"
              style="max-width: 300px"
              maxlength="10"
              show-count
            />
          </NInputGroup>
          <NSelect
            v-model:value="selectedExistTag"
            :options="existTagOptions"
            filterable
            clearable
            placeholder="使用过的标签"
            style="max-width: 150px"
            :render-option="renderOption"
            @update:value="onSelectChange"
          />
        </NSpace>
        <NInputGroup>
          <NInputGroupLabel> 内容 </NInputGroupLabel>
          <NInput
            v-model:value="updateScheduleModel.days[selectedDay].title"
            placeholder="内容"
            style="max-width: 200px"
            maxlength="30"
            show-count
          />
        </NInputGroup>
        <NTimePicker
          v-model:formatted-value="updateScheduleModel.days[selectedDay].time"
          default-formatted-value="20:00"
          format="HH:mm"
        />
        <NColorPicker
          v-model:value="updateScheduleModel.days[selectedDay].tagColor"
          :swatches="['#FFFFFF', '#18A058', '#2080F0', '#F0A020', 'rgba(208, 48, 80, 1)']"
          default-value="#61B589"
          :show-alpha="false"
          :modes="['hex']"
        />
        <NButton
          :loading="isFetching"
          @click="onUpdateSchedule()"
        >
          保存
        </NButton>
      </NSpace>
    </template>
  </NModal>
  <NSpin
    v-if="isLoading"
    show
  />
  <ScheduleList
    v-else
    :schedules="schedules ?? []"
    is-self
    @on-update="onOpenUpdateModal"
    @on-delete="onDeleteSchedule"
    @on-copy="onOpenCopyModal"
  />
</template>
