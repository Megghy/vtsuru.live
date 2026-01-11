<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import type { VNode } from 'vue'
import type { ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'
import { TagQuestionMark16Filled } from '@vicons/fluent'
import { addWeeks, endOfWeek, endOfYear, format, isBefore, startOfWeek, startOfYear } from 'date-fns'
import {
  NAlert,
  NBadge,
  NButton,
  NCard,
  NColorPicker,
  NDivider,
  NFlex,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NModal,
  NSelect,
  NSpace,
  NSpin,
  NText,
  NTimePicker,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import ScheduleList from '@/components/ScheduleList.vue'
import { CURRENT_HOST, SCHEDULE_API_URL } from '@/shared/config'
import { copyToClipboard } from '@/shared/utils'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const yearOptions = [
  {
    label: new Date().getFullYear().toString(),
    value: new Date().getFullYear(),
  },
  {
    label: (new Date().getFullYear() + 1).toString(),
    value: new Date().getFullYear() + 1,
  },
] as SelectOption[]
const weekOptions = computed(() => {
  const weeks = [] as SelectOption[]
  const all = getAllWeeks(selectedScheduleYear.value)
  all.forEach((week) => {
    const isExist
      = (schedules.value?.findIndex(s => s.year == selectedScheduleYear.value && s.week == week[0] + 1) ?? -1) > -1
    weeks.push({
      label: `${isExist ? '(已安排)' : ''} 第${week[0] + 1}周 (${week[1]})`,
      value: week[0] + 1,
      disabled: isExist,
    })
  })
  return weeks
})
const dayOptions = computed(() => {
  const days: SelectOption[] = []
  for (let i = 0; i < 7; i++) {
    const entries = updateScheduleModel.value?.days?.[i] ?? []
    const count = entries.length
    days.push({
      label: count > 0 ? `${weekdays[i]} (共${count}项)` : weekdays[i],
      value: i,
    })
  }
  return days
})
const existTagOptions = computed(() => {
  const colors: SelectOption[] = []
  const exists = new Set<string>()
  schedules.value?.forEach((s) => {
    s.days.forEach((dayList) => {
      dayList.forEach((item) => {
        const tag = item.tag ?? ''
        const color = normalizeColor(item.tagColor) ?? ''
        if (tag) {
          const key = `${tag}__${color}`
          if (!exists.has(key)) {
            exists.add(key)
            colors.push({
              label: tag,
              value: color,
            })
          }
        }
      })
    })
  })
  return colors
})

function normalizeColor(color: any): string | null {
  // 如果是 null 或 undefined，返回 null
  if (color == null) return null

  // 将 HSL 转 RGB，返回 #RRGGBB
  const hslToHex = (h: number, s: number, l: number) => {
    const hue = ((h % 360) + 360) % 360 / 360 // 归一化到 [0, 1)
    const saturation = Math.min(Math.max(s / 100, 0), 1)
    const lightness = Math.min(Math.max(l / 100, 0), 1)

    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }

    let r: number, g: number, b: number
    if (saturation === 0) {
      r = g = b = lightness
    } else {
      const q = lightness < 0.5 ? lightness * (1 + saturation) : lightness + saturation - lightness * saturation
      const p = 2 * lightness - q
      r = hue2rgb(p, q, hue + 1 / 3)
      g = hue2rgb(p, q, hue)
      b = hue2rgb(p, q, hue - 1 / 3)
    }

    const toHex = (c: number) => {
      const hex = Math.round(Math.min(Math.max(c, 0), 1) * 255).toString(16)
      return hex.length === 1 ? `0${hex}` : hex
    }

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
  }

  // 如果是字符串，尝试解析并规范化
  if (typeof color === 'string') {
    const str = color.trim()

    // 1) 处理 hex，统一为 #RRGGBB 大写
    if (str.startsWith('#')) {
      const hex = str.replace('#', '')
      if (hex.length === 3) {
        const r = hex[0]
        const g = hex[1]
        const b = hex[2]
        return (`#${r}${r}${g}${g}${b}${b}`).toUpperCase()
      }
      if (hex.length >= 6) {
        return (`#${hex.substring(0, 6)}`).toUpperCase()
      }
      return str.toUpperCase()
    }

    // 2) 处理 hsla/hsl 字符串
    const hslMatch = str.match(/^hsla?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)%\s*,\s*([+-]?\d+(?:\.\d+)?)%(?:\s*,\s*([+-]?\d+(?:\.\d+)?))?\s*\)$/i)
    if (hslMatch) {
      const h = Number.parseFloat(hslMatch[1])
      const s = Number.parseFloat(hslMatch[2])
      const l = Number.parseFloat(hslMatch[3])
      return hslToHex(h, s, l)
    }

    // 3) 处理 rgba/rgb 字符串，忽略 alpha
    const rgbMatch = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([+-]?\d+(?:\.\d+)?))?\s*\)$/i)
    if (rgbMatch) {
      const r = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[1])))
      const g = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[2])))
      const b = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[3])))
      const toHex = (n: number) => n.toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
    }

    // 4) 其他字符串，原样返回（交由下游使用场景判断）
    return str
  }

  // 如果是数组（[h, s, l, (a)] HS(L)A），转换为十六进制
  if (Array.isArray(color) && color.length >= 3) {
    const [h, s, l] = color
    return hslToHex(Number(h), Number(s), Number(l))
  }

  return null
}

function createEmptyDay(): ScheduleDayInfo {
  return {
    title: null,
    tag: null,
    tagColor: null,
    time: null,
    id: null,
  }
}

function createEmptyDays(): ScheduleDayInfo[][] {
  return Array.from({ length: 7 }, () => [] as ScheduleDayInfo[])
}

function normalizeWeek(week?: ScheduleWeekInfo): ScheduleWeekInfo {
  const normalizedDays = Array.from({ length: 7 }, (_, index) => {
    const list = week?.days?.[index]
    if (!Array.isArray(list)) return [] as ScheduleDayInfo[]
    return list
      .filter(Boolean)
      .map(item => ({
        title: item?.title ?? null,
        tag: item?.tag ?? null,
        tagColor: normalizeColor(item?.tagColor),
        time: item?.time ?? null,
        id: item?.id ?? null,
      }))
  })

  return {
    year: week?.year ?? new Date().getFullYear(),
    week: week?.week ?? Number(format(Date.now(), 'w')) + 1,
    days: normalizedDays,
  }
}

function cloneWeek(week: ScheduleWeekInfo, options: { resetIds?: boolean } = {}): ScheduleWeekInfo {
  // 深度克隆以完全断开响应式引用
  const deepCloned = JSON.parse(JSON.stringify(week))
  const normalized = normalizeWeek(deepCloned)
  return {
    year: normalized.year,
    week: normalized.week,
    days: normalized.days.map(dayList =>
      dayList.map(item => ({
        title: item.title ?? null,
        tag: item.tag ?? null,
        tagColor: normalizeColor(item.tagColor),
        time: item.time ?? null,
        id: options.resetIds ? null : item.id ?? null,
      })),
    ),
  }
}

function createEmptyWeek(year?: number, week?: number): ScheduleWeekInfo {
  return {
    year: year ?? new Date().getFullYear(),
    week: week ?? Number(format(Date.now(), 'w')) + 1,
    days: createEmptyDays(),
  }
}

function ensureDayInitialized(target: ScheduleWeekInfo, dayIndex: number) {
  if (!target.days || !Array.isArray(target.days)) {
    target.days = createEmptyDays()
  }
  if (!Array.isArray(target.days[dayIndex])) {
    target.days[dayIndex] = []
  }
  if (target.days[dayIndex].length === 0) {
    target.days[dayIndex].push(createEmptyDay())
  }
}

function sanitizeDays(days?: ScheduleDayInfo[][]): ScheduleDayInfo[][] {
  return Array.from({ length: 7 }, (_, index) => {
    const list = days?.[index] ?? []
    return list
      .filter(item => !!item && (item.title?.trim() || item.tag?.trim() || item.time?.trim()))
      .map(item => ({
        title: item.title?.trim() || null,
        tag: item.tag?.trim() || null,
        tagColor: normalizeColor(item.tagColor),
        time: item.time?.trim() || null,
        id: item.id ?? null,
      }))
  })
}
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
const schedules = ref<ScheduleWeekInfo[]>([])
const message = useMessage()

const isLoading = ref(true)

const showUpdateModal = ref(false)
const showAddModal = ref(false)
const showCopyModal = ref(false)
const updateScheduleModel = ref<ScheduleWeekInfo>(createEmptyWeek())

const selectedDay = ref(0)
const selectedScheduleYear = ref(new Date().getFullYear())
const selectedScheduleWeek = ref(Number(format(Date.now(), 'w')) + 1)

watch(showUpdateModal, (visible) => {
  if (visible) {
    ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
    // 清理所有可能的数组格式颜色值
    updateScheduleModel.value.days.forEach((dayList) => {
      dayList.forEach((item) => {
        if (item.tagColor && Array.isArray(item.tagColor)) {
          item.tagColor = normalizeColor(item.tagColor)
        }
      })
    })
  }
})

// 深度监听 updateScheduleModel 的 tagColor，确保它们始终是字符串格式
watch(
  () => updateScheduleModel.value.days,
  (days) => {
    days?.forEach((dayList) => {
      dayList?.forEach((item) => {
        if (item.tagColor && Array.isArray(item.tagColor)) {
          item.tagColor = normalizeColor(item.tagColor)
        }
      })
    })
  },
  { deep: true },
)

watch(selectedDay, (value) => {
  ensureDayInitialized(updateScheduleModel.value, value)
})

async function get() {
  isLoading.value = true
  await QueryGetAPI<ScheduleWeekInfo[]>(`${SCHEDULE_API_URL}get`, {
    id: accountInfo.value?.id ?? -1,
  })
    .then((data) => {
      if (data.code == 200) {
        schedules.value = (data.data ?? []).map(week => normalizeWeek(week))
      } else {
        message.error(`加载失败: ${data.message}`)
      }
    })
    .catch(() => {
      message.error('加载失败')
    })
    .finally(() => (isLoading.value = false))
}
const isFetching = ref(false)
async function addSchedule() {
  isFetching.value = true
  const emptyWeek = createEmptyWeek(selectedScheduleYear.value, selectedScheduleWeek.value)
  await QueryPostAPI(`${SCHEDULE_API_URL}update`, {
    year: emptyWeek.year,
    week: emptyWeek.week,
    days: emptyWeek.days,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('添加成功')
        showAddModal.value = false
        schedules.value = [...schedules.value, emptyWeek]
      } else {
        message.error(`添加失败: ${data.message}`)
      }
    })
    .finally(() => {
      isFetching.value = false
    })
}
async function onCopySchedule() {
  if (schedules.value?.find(s => s.year == selectedScheduleYear.value && s.week == selectedScheduleWeek.value)) {
    message.error('想要复制到的周已存在')
  } else {
    updateScheduleModel.value.year = selectedScheduleYear.value
    updateScheduleModel.value.week = selectedScheduleWeek.value
    ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
    await saveSchedule(null)
    showCopyModal.value = false
  }
}
async function saveSchedule(day: number | null) {
  isFetching.value = true
  const sanitizedDays = sanitizeDays(updateScheduleModel.value.days)
  const payload: {
    year: number
    week: number
    day?: number
    days: ScheduleDayInfo[][]
  } = {
    year: updateScheduleModel.value.year,
    week: updateScheduleModel.value.week,
    days: sanitizedDays,
  }

  if (day !== null && day !== undefined) {
    payload.day = day
  }

  await QueryPostAPI(`${SCHEDULE_API_URL}update`, payload)
    .then((data) => {
      if (data.code == 200) {
        message.success('成功')
        const normalizedWeek = normalizeWeek({
          year: payload.year,
          week: payload.week,
          days: sanitizedDays,
        })

        const index = schedules.value.findIndex(
          s => s.year == updateScheduleModel.value.year && s.week == updateScheduleModel.value.week,
        )

        if (index >= 0) {
          if (day !== null && day !== undefined) {
            const current = cloneWeek(schedules.value[index])
            current.days[day] = normalizedWeek.days[day]
            schedules.value.splice(index, 1, current)
          } else {
            schedules.value.splice(index, 1, normalizedWeek)
          }
        } else {
          schedules.value.push(normalizedWeek)
        }
        updateScheduleModel.value = normalizeWeek({
          year: payload.year,
          week: payload.week,
          days: sanitizedDays,
        })
        ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
      } else {
        message.error(`修改失败: ${data.message}`)
      }
    })
    .finally(() => {
      isFetching.value = false
    })
}
async function onUpdateSchedule() {
  await saveSchedule(selectedDay.value)
}
async function onDeleteSchedule(schedule: ScheduleWeekInfo) {
  await QueryGetAPI(`${SCHEDULE_API_URL}del`, {
    year: schedule.year,
    week: schedule.week,
  }).then((data) => {
    if (data.code == 200) {
      message.success('已删除')
      get()
    } else {
      message.error(`删除失败: ${data.message}`)
    }
  })
}
function onOpenUpdateModal(schedule: ScheduleWeekInfo) {
  updateScheduleModel.value = cloneWeek(schedule)
  selectedDay.value = 0
  ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
  showUpdateModal.value = true
}
function onOpenCopyModal(schedule: ScheduleWeekInfo) {
  updateScheduleModel.value = cloneWeek(schedule, { resetIds: true })
  selectedDay.value = 0
  ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
  showCopyModal.value = true
}
function onEditScheduleItem(schedule: ScheduleWeekInfo, dayIndex: number, _item: ScheduleDayInfo) {
  updateScheduleModel.value = cloneWeek(schedule)
  selectedDay.value = dayIndex
  ensureDayInitialized(updateScheduleModel.value, dayIndex)
  showUpdateModal.value = true
}
async function onDeleteScheduleItem(schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo) {
  const targetSchedule = schedules.value.find(s => s.year === schedule.year && s.week === schedule.week)
  if (!targetSchedule) return

  const itemIndex = targetSchedule.days[dayIndex].findIndex(i =>
    i.id === item.id || (i.title === item.title && i.time === item.time && i.tag === item.tag),
  )

  if (itemIndex === -1) return

  const updatedDays = targetSchedule.days.map((dayList, idx) => {
    if (idx === dayIndex) {
      return dayList.filter((_, i) => i !== itemIndex)
    }
    return dayList
  })

  await QueryPostAPI(`${SCHEDULE_API_URL}update`, {
    year: schedule.year,
    week: schedule.week,
    days: sanitizeDays(updatedDays),
  }).then((data) => {
    if (data.code == 200) {
      message.success('已删除')
      const index = schedules.value.findIndex(s => s.year === schedule.year && s.week === schedule.week)
      if (index >= 0) {
        schedules.value[index] = normalizeWeek({
          year: schedule.year,
          week: schedule.week,
          days: updatedDays,
        })
      }
    } else {
      message.error(`删除失败: ${data.message}`)
    }
  })
}
function onSelectChange(value: string | null, option: SelectOption, itemIndex: number) {
  if (value) {
    ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
    const entry = updateScheduleModel.value.days[selectedDay.value][itemIndex]
    if (entry) {
      entry.tagColor = value
      entry.tag = option.label as string
    }
  }
}

function addScheduleItem() {
  ensureDayInitialized(updateScheduleModel.value, selectedDay.value)
  updateScheduleModel.value.days[selectedDay.value].push(createEmptyDay())
}

function removeScheduleItem(index: number) {
  const dayList = updateScheduleModel.value.days[selectedDay.value]
  if (dayList && dayList.length > 0) {
    dayList.splice(index, 1)
    if (dayList.length === 0) {
      dayList.push(createEmptyDay())
    }
  }
}

function moveScheduleItem(index: number, direction: 'up' | 'down') {
  const dayList = updateScheduleModel.value.days[selectedDay.value]
  if (!dayList) return

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= dayList.length) return

  const temp = dayList[index]
  dayList[index] = dayList[targetIndex]
  dayList[targetIndex] = temp
}
function renderOption({ node, option }: { node: VNode, option: SelectOption }) {
  return h(NSpace, { align: 'center', size: 3, style: 'margin-left: 5px' }, () => [
    option.value ? h(NBadge, { dot: true, color: option.value?.toString() }) : null,
    node,
  ])
}

onMounted(() => {
  get()
})
</script>

<template>
  <ManagePageHeader
    title="日程表管理"
    :function-type="FunctionTypes.Schedule"
  >
    <template #action>
      <NButton
        type="primary"
        @click="showAddModal = true"
      >
        添加周程
      </NButton>
      <NButton @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'template', template: 'schedule' } })">
        修改模板
      </NButton>
    </template>
  </ManagePageHeader>

  <NCard size="small" :bordered="true" content-style="padding: 12px;">
    <NText class="manage-kicker">
      日程表展示页链接
    </NText>
    <NFlex align="center" style="margin-top: 10px;">
      <NInputGroup style="max-width: 420px;">
        <NInput :value="`${CURRENT_HOST}@${accountInfo.name}/schedule`" readonly />
        <NButton secondary @click="copyToClipboard(`${CURRENT_HOST}@${accountInfo.name}/schedule`)">
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
  </NCard>

  <NCard size="small" :bordered="true" content-style="padding: 12px;">
    <NFlex justify="space-between" align="center" wrap :size="12">
      <NText class="manage-kicker">
        订阅链接
      </NText>
      <NTooltip>
        <template #trigger>
          <NIcon>
            <TagQuestionMark16Filled />
          </NIcon>
        </template>
        通过订阅链接可以订阅日程表到日历软件中
      </NTooltip>
    </NFlex>
    <NFlex align="center" style="margin-top: 10px;">
      <NInputGroup style="max-width: 420px;">
        <NInput :value="`${SCHEDULE_API_URL}${accountInfo.id}.ics`" readonly />
        <NButton secondary @click="copyToClipboard(`${SCHEDULE_API_URL}${accountInfo.id}.ics`)">
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
  </NCard>

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
    style="width: 800px; max-width: 95vw; max-height: 90vh;"
    preset="card"
    title="编辑周程"
  >
    <NSelect
      v-model:value="selectedDay"
      :options="dayOptions"
    />
    <NDivider />
    <template v-if="updateScheduleModel">
      <div
        style="
          max-height: calc(90vh - 300px);
          overflow-y: auto;
          padding-right: 8px;
          scrollbar-width: thin;
          scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
        "
      >
        <NSpace
          vertical
          :size="12"
        >
          <NButton
            type="primary"
            secondary
            @click="addScheduleItem"
          >
            + 添加行程项
          </NButton>
          <NCard
            v-for="(item, itemIndex) in updateScheduleModel.days[selectedDay]"
            :key="itemIndex"
            size="small"
            :bordered="true"
            :style="{
              borderLeft: item.tagColor ? `4px solid ${item.tagColor}` : 'none',
              backgroundColor: item.tagColor ? `${item.tagColor}08` : 'transparent',
            }"
          >
            <template #header>
              <NSpace align="center" :size="8">
                <NText strong style="font-size: 14px;">
                  行程 {{ itemIndex + 1 }}
                </NText>
                <NButton
                  v-if="itemIndex > 0"
                  size="tiny"
                  quaternary
                  @click="moveScheduleItem(itemIndex, 'up')"
                >
                  ↑
                </NButton>
                <NButton
                  v-if="itemIndex < updateScheduleModel.days[selectedDay].length - 1"
                  size="tiny"
                  quaternary
                  @click="moveScheduleItem(itemIndex, 'down')"
                >
                  ↓
                </NButton>
              </NSpace>
            </template>
            <template #header-extra>
              <NButton
                size="tiny"
                type="error"
                quaternary
                @click="removeScheduleItem(itemIndex)"
              >
                删除
              </NButton>
            </template>
            <NSpace
              vertical
              :size="12"
            >
              <NSpace align="center" :size="8" style="flex-wrap: wrap;">
                <NInputGroup style="width: auto; min-width: 200px;">
                  <NInputGroupLabel type="primary" style="min-width: 50px;">
                    标签
                  </NInputGroupLabel>
                  <NInput
                    v-model:value="item.tag"
                    placeholder="标签名称"
                    style="width: 150px;"
                    maxlength="10"
                    show-count
                  />
                </NInputGroup>
                <NSelect
                  :value="null"
                  :options="existTagOptions"
                  filterable
                  clearable
                  placeholder="选择已用标签"
                  style="width: 140px;"
                  :render-option="renderOption"
                  @update:value="(val, opt) => onSelectChange(val, opt, itemIndex)"
                />
              </NSpace>
              <NInputGroup>
                <NInputGroupLabel style="min-width: 50px;">
                  内容
                </NInputGroupLabel>
                <NInput
                  v-model:value="item.title"
                  placeholder="事件内容描述"
                  maxlength="50"
                  show-count
                />
              </NInputGroup>
              <NSpace align="center" :size="8">
                <NInputGroup style="width: auto;">
                  <NInputGroupLabel style="min-width: 50px;">
                    时间
                  </NInputGroupLabel>
                  <NTimePicker
                    v-model:formatted-value="item.time"
                    default-formatted-value="20:00"
                    format="HH:mm"
                    style="width: 120px"
                    clearable
                  />
                </NInputGroup>
                <NInputGroup style="width: auto;">
                  <NInputGroupLabel style="min-width: 50px;">
                    颜色
                  </NInputGroupLabel>
                  <NColorPicker
                    :key="`color-${selectedDay}-${itemIndex}-${item.id || 'new'}`"
                    :value="normalizeColor(item.tagColor)"
                    :swatches="['#18A058', '#2080F0', '#F0A020', '#D03050', '#9333EA', '#14B8A6']"
                    default-value="#2080F0"
                    :show-alpha="false"
                    :modes="['hex']"
                    style="width: 120px;"
                    @update:value="(val) => item.tagColor = normalizeColor(val)"
                  />
                </NInputGroup>
              </NSpace>
            </NSpace>
          </NCard>
        </NSpace>
      </div>
      <NDivider />
      <NButton
        type="primary"
        :loading="isFetching"
        block
        @click="onUpdateSchedule()"
      >
        保存全部
      </NButton>
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
    @on-edit-item="onEditScheduleItem"
    @on-delete-item="onDeleteScheduleItem"
  />
</template>

<style scoped></style>
