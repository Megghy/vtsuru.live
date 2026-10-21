<script setup lang="ts">
import { addWeeks, endOfWeek, endOfYear, format, isBefore, startOfWeek, startOfYear } from 'date-fns'
import { ColorPicker } from '@/shared/ui/color-picker'
import { useMessage } from '@/shared/utils'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { BiliLiveReserveModel, ScheduleDayInfo, ScheduleWeekInfo } from '@/api/api-models'
import { FunctionTypes } from '@/api/api-models'
import {
  getApiScheduleBiliReserve,
  getApiScheduleGet,
  postApiScheduleBiliReserveAutoSync,
  postApiScheduleBiliReserveRefresh,
  postApiScheduleCopy,
  postApiScheduleDelete,
  postApiScheduleUpdate,
} from '@/api/generated/schedule/schedule'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import BiliLiveReservePanel from '@/components/BiliLiveReservePanel.vue'
import ScheduleList from '@/components/ScheduleList.vue'
import { CURRENT_HOST, SCHEDULE_API_URL } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const currentYear = new Date().getFullYear()
const yearOptions = [
  { label: currentYear.toString(), value: currentYear.toString() },
  { label: (currentYear + 1).toString(), value: (currentYear + 1).toString() },
]

const weekOptions = computed(() => {
  const all = getAllWeeks(Number(selectedScheduleYear.value))
  return all.map((week) => {
    const isExist = (schedules.value?.findIndex((s) => s.year === Number(selectedScheduleYear.value) && s.week === week[0] + 1) ?? -1) > -1
    return {
      label: `${isExist ? '(已安排) ' : ''}第${week[0] + 1}周 (${week[1]})`,
      value: String(week[0] + 1),
      disabled: isExist,
    }
  })
})

const copyWeekOptions = computed(() =>
  getAllWeeks(Number(selectedScheduleYear.value)).map((week) => ({
    label: `${schedules.value.some((s) => s.year === Number(selectedScheduleYear.value) && s.week === week[0] + 1) ? '(已有行程) ' : ''}第${week[0] + 1}周 (${week[1]})`,
    value: String(week[0] + 1),
  })),
)

const dayOptions = computed(() => {
  return weekdays.map((label, index) => {
    const entries = updateScheduleModel.value?.days?.[index] ?? []
    const count = entries.length
    return {
      label: count > 0 ? `${label} (共${count}项)` : label,
      value: String(index),
    }
  })
})

const existTagOptions = computed(() => {
  const colors: { label: string; value: string }[] = []
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
            colors.push({ label: tag, value: color })
          }
        }
      })
    })
  })
  return colors
})

function normalizeColor(color: any): string | null {
  if (color == null) return null

  const hslToHex = (hue360: number, s: number, l: number) => {
    const hue = (((hue360 % 360) + 360) % 360) / 360
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

  if (typeof color === 'string') {
    const str = color.trim()
    if (str.startsWith('#')) {
      const hex = str.replace('#', '')
      if (hex.length === 3) {
        const r = hex[0]
        const g = hex[1]
        const b = hex[2]
        return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
      }
      if (hex.length >= 6) {
        return `#${hex.substring(0, 6)}`.toUpperCase()
      }
      return str.toUpperCase()
    }

    const hslMatch = str.match(
      /^hsla?\(\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)%\s*,\s*([+-]?\d+(?:\.\d+)?)%(?:\s*,\s*([+-]?\d+(?:\.\d+)?))?\s*\)$/i,
    )
    if (hslMatch) {
      const hue = Number.parseFloat(hslMatch[1])
      const s = Number.parseFloat(hslMatch[2])
      const l = Number.parseFloat(hslMatch[3])
      return hslToHex(hue, s, l)
    }

    const rgbMatch = str.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([+-]?\d+(?:\.\d+)?))?\s*\)$/i)
    if (rgbMatch) {
      const r = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[1])))
      const g = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[2])))
      const b = Math.min(255, Math.max(0, Number.parseInt(rgbMatch[3])))
      const toHex = (n: number) => n.toString(16).padStart(2, '0')
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase()
    }

    return str
  }

  if (Array.isArray(color) && color.length >= 3) {
    const [hue, s, l] = color
    return hslToHex(Number(hue), Number(s), Number(l))
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
    return list.filter(Boolean).map((item) => ({
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
    version: week?.version ?? '',
    days: normalizedDays,
  }
}

function cloneWeek(week: ScheduleWeekInfo, options: { resetIds?: boolean } = {}): ScheduleWeekInfo {
  const deepCloned = JSON.parse(JSON.stringify(week))
  const normalized = normalizeWeek(deepCloned)
  return {
    year: normalized.year,
    week: normalized.week,
    version: normalized.version,
    days: normalized.days.map((dayList) =>
      dayList.map((item) => ({
        title: item.title ?? null,
        tag: item.tag ?? null,
        tagColor: normalizeColor(item.tagColor),
        time: item.time ?? null,
        id: options.resetIds ? null : (item.id ?? null),
      })),
    ),
  }
}

function createEmptyWeek(year?: number, week?: number): ScheduleWeekInfo {
  return {
    year: year ?? new Date().getFullYear(),
    week: week ?? Number(format(Date.now(), 'w')) + 1,
    version: '',
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
      .filter((item) => Boolean(item) && Boolean(item.title?.trim() || item.tag?.trim() || item.time?.trim()))
      .map((item) => ({
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
const schedulePageUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/schedule` : '',
)
const scheduleSubscribeUrl = computed(() =>
  accountInfo.value?.id ? `${SCHEDULE_API_URL}${accountInfo.value.id}.ics` : '',
)

function sortSchedules(list: ScheduleWeekInfo[]) {
  return [...list].toSorted((a, b) => b.year - a.year || b.week - a.week)
}

const showUpdateModal = ref(false)
const showAddModal = ref(false)
const showCopyModal = ref(false)
const showBatchAddModal = ref(false)
const updateScheduleModel = ref<ScheduleWeekInfo>(createEmptyWeek())
const scheduleConflict = ref(false)
const copyMode = ref<'merge' | 'replace'>('merge')

const selectedDay = ref('0')
const selectedScheduleYear = ref(String(new Date().getFullYear()))
const selectedScheduleWeek = ref(String(Number(format(Date.now(), 'w')) + 1))

const batchAddYear = ref(String(new Date().getFullYear()))
const batchAddWeekFrom = ref(String(Number(format(Date.now(), 'w')) + 1))
const batchAddWeekTo = ref(String(Number(format(Date.now(), 'w')) + 1))
const batchAddDay = ref('0')
const batchAddItem = ref<ScheduleDayInfo>(createEmptyDay())

const batchWeekOptions = computed(() => {
  const all = getAllWeeks(Number(batchAddYear.value))
  return all.map((week) => ({
    label: `第${week[0] + 1}周 (${week[1]})`,
    value: String(week[0] + 1),
  }))
})

const batchDayOptions = computed(() =>
  weekdays.map((label, index) => ({
    label,
    value: String(index),
  })),
)

const showItemTransferModal = ref(false)
const itemTransferMode = ref<'copy' | 'move'>('copy')
const itemTransferItemIndex = ref<number | null>(null)
const itemTransferTargetDay = ref('0')

watch(showUpdateModal, (visible) => {
  if (visible) {
    ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
    updateScheduleModel.value.days.forEach((dayList) => {
      dayList.forEach((item) => {
        if (item.tagColor && Array.isArray(item.tagColor)) {
          item.tagColor = normalizeColor(item.tagColor)
        }
      })
    })
  }
})

watch(selectedDay, (value) => {
  ensureDayInitialized(updateScheduleModel.value, Number(value))
})

async function get() {
  isLoading.value = true
  try {
    const data = (await getApiScheduleGet({
      id: String(accountInfo.value?.id ?? -1),
    })) as unknown as {
      code: number
      message?: string
      data?: ScheduleWeekInfo[]
    }
    if (data.code !== 200) throw new Error(data.message || '加载失败')
    schedules.value = sortSchedules((data.data ?? []).map((week) => normalizeWeek(week)))
  } catch (error) {
    message.error(error instanceof Error ? `加载失败: ${error.message}` : '加载失败')
    throw error
  } finally {
    isLoading.value = false
  }
}

async function reloadAfterConflict() {
  scheduleConflict.value = true
  message.warning('日程已在其他窗口更新，已保留当前草稿；请加载最新版本后重试')
  await get()
}

async function loadLatestScheduleVersion() {
  await get()
  const latest = schedules.value.find(
    (schedule) => schedule.year === updateScheduleModel.value.year && schedule.week === updateScheduleModel.value.week,
  )
  updateScheduleModel.value = latest
    ? cloneWeek(latest, { resetIds: showCopyModal.value })
    : createEmptyWeek(updateScheduleModel.value.year, updateScheduleModel.value.week)
  ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
  scheduleConflict.value = false
  message.success('已加载最新版本，请重新确认修改')
}

const isFetching = ref(false)
const biliReserve = ref<BiliLiveReserveModel>({
  items: [],
  fetchedAt: 0,
  intervalMinutes: 15,
  syncEnabled: false,
})
const refreshingReserve = ref(false)
const syncingReserve = ref(false)
const liveRoomUrl = computed(() =>
  accountInfo.value?.biliRoomId ? `https://live.bilibili.com/${accountInfo.value.biliRoomId}` : undefined,
)

async function loadBiliReserve() {
  if (!accountInfo.value?.id) return
  try {
    const response = (await getApiScheduleBiliReserve({
      id: String(accountInfo.value.id),
    })) as unknown as {
      code: number
      data?: BiliLiveReserveModel
    }
    if (response.code === 200 && response.data) {
      biliReserve.value = response.data
      if (accountInfo.value.settings) {
        accountInfo.value.settings.syncBiliLiveReserveToSchedule = response.data.syncEnabled
      }
    }
  } catch {
    message.error('加载 B 站预约失败')
  }
}

async function refreshBiliReserve() {
  refreshingReserve.value = true
  try {
    const response = (await postApiScheduleBiliReserveRefresh()) as unknown as {
      code: number
      data?: BiliLiveReserveModel
      message?: string
    }
    if (response.code === 200 && response.data) {
      biliReserve.value = response.data
      message.success('已刷新 B 站预约')
    } else {
      message.error(response.message || '刷新失败')
    }
  } catch {
    message.error('刷新失败')
  } finally {
    refreshingReserve.value = false
  }
}

async function setBiliReserveAutoSync(enable: boolean) {
  syncingReserve.value = true
  try {
    const response = (await postApiScheduleBiliReserveAutoSync({
      enable,
    })) as unknown as {
      code: number
      data?: BiliLiveReserveModel
      message?: string
    }
    if (response.code === 200 && response.data) {
      biliReserve.value = response.data
      if (accountInfo.value?.settings) {
        accountInfo.value.settings.syncBiliLiveReserveToSchedule = response.data.syncEnabled
      }
      message.success(enable ? '已开启写入日程表' : '已关闭写入日程表')
    } else {
      message.error(response.message || '设置失败')
    }
  } catch {
    message.error('设置失败')
  } finally {
    syncingReserve.value = false
  }
}

async function addSchedule() {
  isFetching.value = true
  const emptyWeek = createEmptyWeek(Number(selectedScheduleYear.value), Number(selectedScheduleWeek.value))
  try {
    const data = (await postApiScheduleUpdate({
      year: emptyWeek.year,
      week: emptyWeek.week,
      days: emptyWeek.days as any,
      expectedVersion: '',
    })) as unknown as {
      code: number
      message?: string
      data?: ScheduleWeekInfo
    }
    if (data.code === 409) return await reloadAfterConflict()
    if (data.code !== 200 || !data.data) return message.error(`添加失败: ${data.message}`)
    message.success('添加成功')
    showAddModal.value = false
    schedules.value = sortSchedules([...schedules.value, normalizeWeek(data.data)])
  } finally {
    isFetching.value = false
  }
}

async function onCopySchedule() {
  isFetching.value = true
  const targetYear = Number(selectedScheduleYear.value)
  const targetWeek = Number(selectedScheduleWeek.value)
  const target = schedules.value.find((s) => s.year === targetYear && s.week === targetWeek)
  try {
    const response = (await postApiScheduleCopy({
      sourceYear: updateScheduleModel.value.year,
      sourceWeek: updateScheduleModel.value.week,
      targetYear,
      targetWeek,
      sourceVersion: updateScheduleModel.value.version ?? '',
      targetVersion: target?.version ?? '',
      mode: copyMode.value as any,
    })) as unknown as {
      code: number
      message?: string
      data?: ScheduleWeekInfo
    }
    if (response.code === 409) {
      await reloadAfterConflict()
      return
    }
    if (response.code !== 200 || !response.data) {
      message.error(`复制失败: ${response.message}`)
      return
    }
    const copied = normalizeWeek(response.data)
    const index = schedules.value.findIndex((s) => s.year === copied.year && s.week === copied.week)
    if (index >= 0) schedules.value.splice(index, 1, copied)
    else schedules.value.push(copied)
    schedules.value = sortSchedules(schedules.value)
    message.success('复制成功')
    showCopyModal.value = false
  } finally {
    isFetching.value = false
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
    expectedVersion: string
  } = {
    year: updateScheduleModel.value.year,
    week: updateScheduleModel.value.week,
    days: sanitizedDays,
    expectedVersion: updateScheduleModel.value.version ?? '',
  }

  if (day !== null && day !== undefined) {
    payload.day = day
  }

  try {
    const data = (await postApiScheduleUpdate(payload as any)) as unknown as {
      code: number
      message?: string
      data?: ScheduleWeekInfo
    }
    if (data.code === 409) return await reloadAfterConflict()
    if (data.code === 200 && data.data) {
      message.success('成功')
      const normalizedWeek = normalizeWeek(data.data)
      const index = schedules.value.findIndex(
        (s) => s.year === updateScheduleModel.value.year && s.week === updateScheduleModel.value.week,
      )
      if (index >= 0) schedules.value.splice(index, 1, normalizedWeek)
      else schedules.value.push(normalizedWeek)
      schedules.value = sortSchedules(schedules.value)
      updateScheduleModel.value = normalizeWeek({
        year: payload.year,
        week: payload.week,
        version: normalizedWeek.version,
        days: normalizedWeek.days,
      })
      ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
    } else {
      message.error(`修改失败: ${data.message}`)
    }
  } finally {
    isFetching.value = false
  }
}

async function onDeleteSchedule(schedule: ScheduleWeekInfo) {
  const data = await postApiScheduleDelete({
    year: schedule.year,
    week: schedule.week,
    expectedVersion: schedule.version ?? '',
  })
  if (data.code === 409) await reloadAfterConflict()
  else if (data.code === 200) {
    message.success('已删除')
    await get()
  } else {
    message.error(`删除失败: ${data.message}`)
  }
}

function onOpenUpdateModal(schedule: ScheduleWeekInfo) {
  scheduleConflict.value = false
  updateScheduleModel.value = cloneWeek(schedule)
  selectedDay.value = '0'
  ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
  showUpdateModal.value = true
}

function onOpenCopyModal(schedule: ScheduleWeekInfo) {
  scheduleConflict.value = false
  updateScheduleModel.value = cloneWeek(schedule, { resetIds: true })
  copyMode.value = 'merge'
  selectedDay.value = '0'
  ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
  showCopyModal.value = true
}

function onEditScheduleItem(schedule: ScheduleWeekInfo, dayIndex: number, _item: ScheduleDayInfo) {
  updateScheduleModel.value = cloneWeek(schedule)
  selectedDay.value = String(dayIndex)
  ensureDayInitialized(updateScheduleModel.value, dayIndex)
  showUpdateModal.value = true
}

async function onDeleteScheduleItem(schedule: ScheduleWeekInfo, dayIndex: number, item: ScheduleDayInfo) {
  const targetSchedule = schedules.value.find((s) => s.year === schedule.year && s.week === schedule.week)
  if (!targetSchedule) return

  const itemIndex = targetSchedule.days[dayIndex].findIndex(
    (i) => i.id === item.id || (i.title === item.title && i.time === item.time && i.tag === item.tag),
  )
  if (itemIndex === -1) return

  const updatedDays = targetSchedule.days.map((dayList, idx) => {
    if (idx === dayIndex) {
      return dayList.filter((_, i) => i !== itemIndex)
    }
    return dayList
  })

  const data = (await postApiScheduleUpdate({
    year: schedule.year,
    week: schedule.week,
    days: sanitizeDays(updatedDays) as any,
    expectedVersion: targetSchedule.version ?? '',
  })) as unknown as {
    code: number
    message?: string
    data?: ScheduleWeekInfo
  }
  if (data.code === 409) await reloadAfterConflict()
  else if (data.code === 200 && data.data) {
    message.success('已删除')
    const index = schedules.value.findIndex((s) => s.year === schedule.year && s.week === schedule.week)
    if (index >= 0) schedules.value[index] = normalizeWeek(data.data)
  } else {
    message.error(`删除失败: ${data.message}`)
  }
}

async function onBatchAddSchedule() {
  const year = Number(batchAddYear.value)
  const weekFrom = Number(batchAddWeekFrom.value)
  const weekTo = Number(batchAddWeekTo.value)
  const dayIndex = Number(batchAddDay.value)

  const maxWeeks = getAllWeeks(year).length
  if (weekTo < weekFrom) {
    message.error('结束周不能小于开始周')
    return
  }
  if (weekFrom < 1 || weekTo > maxWeeks) {
    message.error(`周数范围应为 1-${maxWeeks}`)
    return
  }
  if (dayIndex < 0 || dayIndex > 6) {
    message.error('星期范围应为 0-6')
    return
  }

  const fixedItem: ScheduleDayInfo = {
    title: batchAddItem.value.title?.trim() || null,
    tag: batchAddItem.value.tag?.trim() || null,
    tagColor: normalizeColor(batchAddItem.value.tagColor),
    time: batchAddItem.value.time?.trim() || null,
    id: null,
  }
  if (!fixedItem.title && !fixedItem.tag && !fixedItem.time) {
    message.error('请至少填写标签/内容/时间其中一项')
    return
  }

  isFetching.value = true
  try {
    for (let week = weekFrom; week <= weekTo; week++) {
      const existing = schedules.value.find((s) => s.year === year && s.week === week)
      const targetWeek = existing ? cloneWeek(existing) : createEmptyWeek(year, week)
      ensureDayInitialized(targetWeek, dayIndex)
      targetWeek.days[dayIndex].push({ ...fixedItem, id: null })

      const sanitizedDays = sanitizeDays(targetWeek.days)
      const resp = (await postApiScheduleUpdate({
        year,
        week,
        days: sanitizedDays as any,
        expectedVersion: targetWeek.version ?? '',
      })) as unknown as {
        code: number
        message?: string
        data?: ScheduleWeekInfo
      }

      if (resp.code === 409) {
        await reloadAfterConflict()
        return
      }
      if (resp.code !== 200 || !resp.data) {
        message.error(`第${week}周添加失败: ${resp.message}`)
        return
      }

      const normalizedWeek = normalizeWeek(resp.data as ScheduleWeekInfo)
      const index = schedules.value.findIndex((s) => s.year === year && s.week === week)
      if (index >= 0) {
        schedules.value.splice(index, 1, normalizedWeek)
      } else {
        schedules.value.push(normalizedWeek)
      }
    }

    schedules.value = sortSchedules(schedules.value)
    message.success('批量添加完成')
    showBatchAddModal.value = false
  } catch {
    message.error('批量添加失败')
  } finally {
    isFetching.value = false
  }
}

function onOpenItemTransferModal(mode: 'copy' | 'move', itemIndex: number) {
  itemTransferMode.value = mode
  itemTransferItemIndex.value = itemIndex
  itemTransferTargetDay.value = selectedDay.value
  showItemTransferModal.value = true
}

function onConfirmItemTransfer() {
  const itemIndex = itemTransferItemIndex.value
  if (itemIndex === null) return

  const fromDay = Number(selectedDay.value)
  const toDay = Number(itemTransferTargetDay.value)

  if (itemTransferMode.value === 'move' && fromDay === toDay) {
    message.error('移动目标不能是当前星期')
    return
  }

  const fromList = updateScheduleModel.value.days[fromDay]
  const target = fromList?.[itemIndex]
  if (!target) return

  if (!Array.isArray(updateScheduleModel.value.days[toDay])) {
    updateScheduleModel.value.days[toDay] = []
  }
  const toList = updateScheduleModel.value.days[toDay]

  if (itemTransferMode.value === 'copy') {
    toList.push({
      title: target.title ?? null,
      tag: target.tag ?? null,
      tagColor: normalizeColor(target.tagColor),
      time: target.time ?? null,
      id: null,
    })
  } else {
    const [moved] = fromList.splice(itemIndex, 1)
    toList.push(moved)
    if (fromList.length === 0) {
      fromList.push(createEmptyDay())
    }
  }

  showItemTransferModal.value = false
}

function addScheduleItem() {
  ensureDayInitialized(updateScheduleModel.value, Number(selectedDay.value))
  updateScheduleModel.value.days[Number(selectedDay.value)].push(createEmptyDay())
}

function removeScheduleItem(index: number) {
  const dayList = updateScheduleModel.value.days[Number(selectedDay.value)]
  if (dayList && dayList.length > 0) {
    dayList.splice(index, 1)
    if (dayList.length === 0) {
      dayList.push(createEmptyDay())
    }
  }
}

function moveScheduleItem(index: number, direction: 'up' | 'down') {
  const dayList = updateScheduleModel.value.days[Number(selectedDay.value)]
  if (!dayList) return

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= dayList.length) return

  const temp = dayList[index]
  dayList[index] = dayList[targetIndex]
  dayList[targetIndex] = temp
}

onMounted(() => {
  void get()
  loadBiliReserve()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="日程表管理"
      subtitle="安排直播预告与周程计划，支持 B 站预约自动同步、多周复制、iCal 日历订阅与自定义展示"
      :function-type="FunctionTypes.Schedule"
      :links="[
        { label: '日程表展示页链接', value: schedulePageUrl },
        { label: '订阅链接', value: scheduleSubscribeUrl, description: '通过订阅链接可以订阅日程表到日历软件中' },
      ]"
    >
      <template #action>
        <div class="flex items-center gap-2">
          <Button
            size="xs"
            variant="brand"
            @click="showAddModal = true"
          >
            添加周程
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="showBatchAddModal = true"
          >
            批量添加
          </Button>
          <Button
            size="xs"
            variant="outline"
            @click="$router.push({ name: 'manage-index', query: { tab: 'template', template: 'schedule' } })"
          >
            修改模板
          </Button>
        </div>
      </template>
    </ManagePageHeader>

    <BiliLiveReservePanel
      class="my-3"
      manage
      :items="biliReserve.items"
      :fetched-at="biliReserve.fetchedAt"
      :interval-minutes="biliReserve.intervalMinutes"
      :live-room-url="liveRoomUrl"
      :auto-sync="biliReserve.syncEnabled"
      :refreshing="refreshingReserve"
      :syncing="syncingReserve"
      @refresh="refreshBiliReserve"
      @update:auto-sync="setBiliReserveAutoSync"
    />

    <div
      v-if="isLoading"
      class="text-center py-20 text-xs text-muted-foreground"
    >
      正在加载日程表…
    </div>
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

    <!-- 添加周程弹窗 -->
    <Dialog v-model:open="showAddModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base">
            添加周程
          </DialogTitle>
          <DialogDescription class="text-xs">
            选择年份和未安排的周次以创建新的一周行程表。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">年份</span>
            <Select v-model="selectedScheduleYear">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="y in yearOptions"
                  :key="y.value"
                  :value="y.value"
                >
                  {{ y.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">第几周</span>
            <Select v-model="selectedScheduleWeek">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="w in weekOptions"
                  :key="w.value"
                  :value="w.value"
                  :disabled="w.disabled"
                >
                  {{ w.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showAddModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isFetching"
            @click="addSchedule"
          >
            添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 复制周程弹窗 -->
    <Dialog v-model:open="showCopyModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base">
            复制周程
          </DialogTitle>
          <DialogDescription class="text-xs">
            只复制手工行程，B 站同步预约不受影响。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <Alert
            v-if="scheduleConflict"
            variant="destructive"
            class="py-2"
          >
            <AlertDescription class="text-xs flex items-center justify-between">
              <span>源周或目标周已更新，请加载最新版本。</span>
              <Button
                size="xs"
                variant="outline"
                @click="loadLatestScheduleVersion"
              >
                加载最新
              </Button>
            </AlertDescription>
          </Alert>

          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">目标年份</span>
            <Select v-model="selectedScheduleYear">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="y in yearOptions"
                  :key="y.value"
                  :value="y.value"
                >
                  {{ y.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">目标周</span>
            <Select v-model="selectedScheduleWeek">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="w in copyWeekOptions"
                  :key="w.value"
                  :value="w.value"
                >
                  {{ w.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-1">
            <span class="text-xs text-muted-foreground">复制方式</span>
            <Select v-model="copyMode">
              <SelectTrigger class="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">
                  合并（保留目标周已有行程）
                </SelectItem>
                <SelectItem value="replace">
                  替换手工行程
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showCopyModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isFetching"
            @click="onCopySchedule"
          >
            确认复制
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 编辑周程弹窗 -->
    <Dialog v-model:open="showUpdateModal">
      <DialogContent class="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="text-base">
            编辑周程项
          </DialogTitle>
          <DialogDescription class="text-xs">
            选择星期并为当天安排标签、活动内容与开播时间。
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
          <Alert
            v-if="scheduleConflict"
            variant="destructive"
            class="py-2"
          >
            <AlertDescription class="text-xs flex items-center justify-between">
              <span>当前草稿已保留，加载最新版本会替换草稿。</span>
              <Button
                size="xs"
                variant="outline"
                @click="loadLatestScheduleVersion"
              >
                加载最新版本
              </Button>
            </AlertDescription>
          </Alert>

          <div class="flex items-center justify-between gap-3">
            <div class="flex-1">
              <Select v-model="selectedDay">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="d in dayOptions"
                    :key="d.value"
                    :value="d.value"
                  >
                    {{ d.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="xs"
              variant="outline"
              @click="addScheduleItem"
            >
              + 添加行程项
            </Button>
          </div>

          <Separator />

          <!-- 当天行程项列表 -->
          <div class="space-y-3">
            <Card
              v-for="(item, itemIndex) in updateScheduleModel.days[Number(selectedDay)]"
              :key="itemIndex"
              class="border-border bg-card/60"
              :style="{
                borderLeft: item.tagColor ? `4px solid ${item.tagColor}` : undefined,
              }"
            >
              <CardHeader class="p-3 pb-2 flex-row items-center justify-between">
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold">行程 {{ itemIndex + 1 }}</span>
                  <Button
                    v-if="itemIndex > 0"
                    size="icon-xs"
                    variant="ghost"
                    @click="moveScheduleItem(itemIndex, 'up')"
                  >
                    ↑
                  </Button>
                  <Button
                    v-if="itemIndex < updateScheduleModel.days[Number(selectedDay)].length - 1"
                    size="icon-xs"
                    variant="ghost"
                    @click="moveScheduleItem(itemIndex, 'down')"
                  >
                    ↓
                  </Button>
                </div>

                <div class="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    @click="onOpenItemTransferModal('copy', itemIndex)"
                  >
                    复制
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    @click="onOpenItemTransferModal('move', itemIndex)"
                  >
                    移动
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    class="text-destructive hover:bg-destructive/10"
                    @click="removeScheduleItem(itemIndex)"
                  >
                    删除
                  </Button>
                </div>
              </CardHeader>

              <CardContent class="p-3 pt-0 space-y-2.5">
                <div class="flex items-center gap-2 flex-wrap">
                  <Input
                    v-model="item.tag"
                    placeholder="标签名称 (如 杂谈)"
                    class="w-36 h-7 text-xs"
                    maxlength="10"
                  />
                  <Input
                    v-model="item.title"
                    placeholder="事件内容描述"
                    class="flex-1 h-7 text-xs min-w-[180px]"
                    maxlength="50"
                  />
                </div>

                <div class="flex items-center gap-2 flex-wrap">
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">时间:</span>
                    <Input
                      v-model="item.time"
                      type="time"
                      class="w-24 h-8 text-xs"
                    />
                  </div>
                  <div class="flex items-center gap-1">
                    <span class="text-xs text-muted-foreground">颜色:</span>
                    <ColorPicker
                      :value="normalizeColor(item.tagColor)"
                      :swatches="['#18A058', '#2080F0', '#F0A020', '#D03050', '#9333EA', '#14B8A6']"
                      default-value="#2080F0"
                      :show-alpha="false"
                      :modes="['hex']"
                      size="small"
                      @update:value="(val) => (item.tagColor = normalizeColor(val))"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showUpdateModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isFetching"
            @click="saveSchedule(Number(selectedDay))"
          >
            保存当天
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 复制/移动跨星期弹窗 -->
    <Dialog v-model:open="showItemTransferModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{ itemTransferMode === 'copy' ? '复制行程项到其他星期' : '移动行程项到其他星期' }}
          </DialogTitle>
          <DialogDescription class="text-xs">
            {{ itemTransferMode === 'copy' ? '复制会在目标星期新增一条行程项。' : '移动会把当前行程项从本星期移到目标星期。' }}
          </DialogDescription>
        </DialogHeader>

        <div class="py-2 space-y-1">
          <span class="text-xs text-muted-foreground">目标星期</span>
          <Select v-model="itemTransferTargetDay">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="d in batchDayOptions"
                :key="d.value"
                :value="d.value"
              >
                {{ d.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showItemTransferModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            @click="onConfirmItemTransfer"
          >
            确定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 批量添加固定行程弹窗 -->
    <Dialog v-model:open="showBatchAddModal">
      <DialogContent class="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle class="text-base">
            批量添加固定行程
          </DialogTitle>
          <DialogDescription class="text-xs">
            一次性把同一条行程添加到连续周的同一天（不存在的周程会自动创建）。
          </DialogDescription>
        </DialogHeader>

        <div class="space-y-3 py-2 text-xs">
          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1">
              <span class="text-muted-foreground">年份</span>
              <Select v-model="batchAddYear">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="y in yearOptions"
                    :key="y.value"
                    :value="y.value"
                  >
                    {{ y.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div class="space-y-1">
              <span class="text-muted-foreground">星期</span>
              <Select v-model="batchAddDay">
                <SelectTrigger class="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="d in batchDayOptions"
                    :key="d.value"
                    :value="d.value"
                  >
                    {{ d.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div class="space-y-1">
            <span class="text-muted-foreground">周范围</span>
            <div class="flex items-center gap-2">
              <Select v-model="batchAddWeekFrom">
                <SelectTrigger class="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="w in batchWeekOptions"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <span class="text-muted-foreground">至</span>
              <Select v-model="batchAddWeekTo">
                <SelectTrigger class="h-8 text-xs flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="w in batchWeekOptions"
                    :key="w.value"
                    :value="w.value"
                  >
                    {{ w.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <Input
                v-model="batchAddItem.tag"
                placeholder="标签名称"
                class="w-36 h-8 text-xs"
                maxlength="10"
              />
              <Input
                v-model="batchAddItem.title"
                placeholder="事件描述"
                class="flex-1 h-8 text-xs"
                maxlength="50"
              />
            </div>

            <div class="flex items-center gap-3">
              <div class="flex items-center gap-1">
                <span class="text-muted-foreground">时间:</span>
                <Input
                  v-model="batchAddItem.time"
                  type="time"
                  class="w-24 h-8 text-xs"
                />
              </div>
              <div class="flex items-center gap-1">
                <span class="text-muted-foreground">颜色:</span>
                <ColorPicker
                  :value="normalizeColor(batchAddItem.tagColor)"
                  :swatches="['#18A058', '#2080F0', '#F0A020', '#D03050', '#9333EA', '#14B8A6']"
                  default-value="#2080F0"
                  :show-alpha="false"
                  :modes="['hex']"
                  size="small"
                  @update:value="(val) => (batchAddItem.tagColor = normalizeColor(val))"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            @click="showBatchAddModal = false"
          >
            取消
          </Button>
          <Button
            variant="brand"
            :loading="isFetching"
            @click="onBatchAddSchedule"
          >
            批量添加
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
