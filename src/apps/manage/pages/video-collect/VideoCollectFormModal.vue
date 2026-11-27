<script setup lang="ts">
import { format } from 'date-fns'
import { Check, ChevronDown, ChevronUp, Filter, Search, X } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'

import type { RequestVideoTable } from '@/api/generated/model'
import { DuplicateVideoPolicy } from '@/api/generated/model'
import { type BiliVideoZone, fetchVideoCollectPartitions } from '@/api/video-collect-extra'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'
import { formatDurationLimitText, normalizeTimestamp } from '@/shared/utils/videoCollect'

const props = defineProps<{
  show: boolean
  title: string
  initialValue?: Partial<RequestVideoTable>
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [value: RequestVideoTable]
}>()

const message = useMessage()
const model = ref<RequestVideoTable>(createModel())
const showAdvanced = ref(false)
const partitionPopoverOpen = ref(false)
const partitionSearch = ref('')
const partitionZones = ref<BiliVideoZone[]>([])
const loadingPartitions = ref(false)

const startDateStr = ref('')
const endDateStr = ref('')

const isEditMode = computed(() => Boolean(props.initialValue?.id))

const filteredZones = computed(() => {
  const q = partitionSearch.value.trim().toLowerCase()
  if (!q) return partitionZones.value
  return partitionZones.value
    .map((zone) => {
      const mainHit = zone.name.toLowerCase().includes(q)
      const subs = mainHit ? zone.subs : zone.subs.filter((sub) => sub.name.toLowerCase().includes(q))
      if (!mainHit && subs.length === 0) return null
      return { ...zone, subs }
    })
    .filter((z): z is BiliVideoZone => z !== null)
})

const minDurationHint = computed(() =>
  model.value.minVideoDuration > 0 ? formatDurationLimitText(model.value.minVideoDuration) : '不限',
)
const maxDurationHint = computed(() =>
  model.value.maxVideoDuration > 0 ? formatDurationLimitText(model.value.maxVideoDuration) : '不限',
)

function formatForInput(ts: number) {
  try {
    return format(normalizeTimestamp(ts), "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

function parseFromInput(str: string) {
  const parsed = new Date(str).getTime()
  return Number.isNaN(parsed) ? Date.now() : parsed
}

async function ensurePartitionsLoaded() {
  if (partitionZones.value.length > 0 || loadingPartitions.value) return
  loadingPartitions.value = true
  try {
    partitionZones.value = await fetchVideoCollectPartitions()
  } catch {
    // 加载失败保持静默，打开选择器时可重试
  } finally {
    loadingPartitions.value = false
  }
}

watch(
  () => props.show,
  (show) => {
    if (!show) return
    model.value = createModel(props.initialValue)
    startDateStr.value = formatForInput(model.value.startAt)
    endDateStr.value = formatForInput(model.value.endAt)
    const hasCustomAdvanced = Boolean(
      props.initialValue?.minVideoDuration ||
        props.initialValue?.maxVideoDuration ||
        props.initialValue?.allowedPartitions?.length ||
        props.initialValue?.maxVideoPerUser ||
        props.initialValue?.requireDescription ||
        (props.initialValue?.duplicatePolicy !== undefined &&
          props.initialValue.duplicatePolicy !== DuplicateVideoPolicy.MergeRecommendations),
    )
    showAdvanced.value = hasCustomAdvanced
    void ensurePartitionsLoaded()
  },
)

watch(partitionPopoverOpen, (open) => {
  if (open) void ensurePartitionsLoaded()
})

function createModel(value?: Partial<RequestVideoTable>): RequestVideoTable {
  const now = Date.now()
  return {
    id: value?.id,
    name: value?.name ?? '',
    description: value?.description ?? '',
    startAt: value?.startAt ? normalizeTimestamp(value.startAt) : now,
    endAt: value?.endAt ? normalizeTimestamp(value.endAt) : now + 7 * 24 * 60 * 60 * 1000,
    maxVideoCount: value?.maxVideoCount ?? 50,
    minVideoDuration: value?.minVideoDuration ?? 0,
    maxVideoDuration: value?.maxVideoDuration ?? 0,
    allowedPartitions: [...(value?.allowedPartitions ?? [])],
    allowUnregisteredUser: value?.allowUnregisteredUser ?? true,
    maxVideoPerUser: value?.maxVideoPerUser ?? 0,
    requireDescription: value?.requireDescription ?? false,
    duplicatePolicy: value?.duplicatePolicy ?? DuplicateVideoPolicy.MergeRecommendations,
  }
}

function isPartitionSelected(name: string) {
  return model.value.allowedPartitions.includes(name)
}

function togglePartition(name: string) {
  if (isPartitionSelected(name)) {
    model.value.allowedPartitions = model.value.allowedPartitions.filter((item) => item !== name)
    return
  }
  if (model.value.allowedPartitions.length >= 20) {
    message.warning('最多选择 20 个允许分区')
    return
  }
  model.value.allowedPartitions = [...model.value.allowedPartitions, name]
}

function removePartition(name: string) {
  model.value.allowedPartitions = model.value.allowedPartitions.filter((item) => item !== name)
}

function close() {
  emit('update:show', false)
}

function submit() {
  const name = model.value.name.trim()
  if (!name) {
    message.warning('请输入征集名称')
    return
  }
  if (name.length > 30) {
    message.warning('征集名称不能超过 30 个字符')
    return
  }
  if ((model.value.description?.trim().length ?? 0) > 300) {
    message.warning('征集说明不能超过 300 个字符')
    return
  }

  const startAt = parseFromInput(startDateStr.value)
  const endAt = parseFromInput(endDateStr.value)

  if (endAt <= startAt) {
    message.warning('截止时间必须晚于开放时间')
    return
  }
  if (!isEditMode.value && endAt < Date.now() + 60 * 60 * 1000) {
    message.warning('新建征集的截止时间至少需要在当前时间 1 小时后')
    return
  }

  const maxCount = Number(model.value.maxVideoCount)
  if (!Number.isFinite(maxCount) || maxCount < 1 || maxCount > 10000) {
    message.warning('最大视频数需要在 1 到 10000 之间')
    return
  }

  const minDur = Number(model.value.minVideoDuration || 0)
  const maxDur = Number(model.value.maxVideoDuration || 0)
  if (minDur < 0 || minDur > 86400 || maxDur < 0 || maxDur > 86400) {
    message.warning('视频时长范围需要在 0 到 86400 秒之间')
    return
  }
  if (minDur > 0 && maxDur > 0 && minDur > maxDur) {
    message.warning('最短时长不能大于最长时长')
    return
  }

  const maxPerUser = Number(model.value.maxVideoPerUser || 0)
  if (maxPerUser < 0 || maxPerUser > 100) {
    message.warning('每人最多推荐数量需要在 0 到 100 之间')
    return
  }

  model.value.name = name
  model.value.startAt = startAt
  model.value.endAt = endAt
  model.value.maxVideoCount = maxCount
  model.value.minVideoDuration = minDur
  model.value.maxVideoDuration = maxDur
  model.value.maxVideoPerUser = maxPerUser

  emit('submit', { ...model.value, allowedPartitions: [...model.value.allowedPartitions] })
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="(val) => emit('update:show', val)"
  >
    <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto scrollbar-thin">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>配置视频征集的主题、开放时间、名额与投稿过滤规则</DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-1">
        <!-- 基础配置 -->
        <FormField
          label="征集名称"
          :extra="`${model.name.length}/30`"
          required
        >
          <Input
            v-model="model.name"
            placeholder="例如：三周年回顾视频征集"
            maxlength="30"
          />
        </FormField>

        <FormField
          label="征集说明"
          :extra="`${(model.description ?? '').length}/300`"
        >
          <Textarea
            v-model="model.description"
            rows="2"
            placeholder="填写主题、投稿要求或注意事项（选填）"
            maxlength="300"
          />
        </FormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            label="开放时间"
            class="min-w-0"
          >
            <Input
              v-model="startDateStr"
              type="datetime-local"
            />
          </FormField>
          <FormField
            label="截止时间"
            :description="isEditMode ? undefined : '至少晚于当前时间 1 小时'"
            class="min-w-0"
          >
            <Input
              v-model="endDateStr"
              type="datetime-local"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <FormField
            type="number"
            label="最大征集视频数"
            :min="1"
            :max="10000"
            class="min-w-0"
            v-model="model.maxVideoCount"
          />

          <SettingRow
            type="switch"
            variant="compact"
            title="允许游客投稿"
            description="未绑定 B 站也可提交"
            v-model="model.allowUnregisteredUser"
          />
        </div>

        <!-- 高级折叠面板 -->
        <div class="border border-border rounded-lg overflow-hidden">
          <Button
            variant="ghost"
            class="w-full justify-between px-3 py-2 bg-muted/30 rounded-none font-semibold"
            @click="showAdvanced = !showAdvanced"
          >
            <span class="flex items-center gap-1.5">
              <Filter class="size-3.5 text-brand" />
              <span>高级过滤与投稿限制</span>
            </span>
            <ChevronUp
              v-if="showAdvanced"
              class="size-3.5 text-muted-foreground"
            />
            <ChevronDown
              v-else
              class="size-3.5 text-muted-foreground"
            />
          </Button>

          <div
            v-if="showAdvanced"
            class="p-3 space-y-3 bg-card border-t border-border"
          >
            <!-- 时长限制 -->
            <div class="grid grid-cols-2 gap-3">
              <FormField
                label="最短时长 (秒)"
                :extra="minDurationHint"
                class="min-w-0"
              >
                <NumberField
                  v-model="model.minVideoDuration"
                  :min="0"
                  :max="86400"
                  :show-buttons="false"
                />
              </FormField>
              <FormField
                label="最长时长 (秒)"
                :extra="maxDurationHint"
                class="min-w-0"
              >
                <NumberField
                  v-model="model.maxVideoDuration"
                  :min="0"
                  :max="86400"
                  :show-buttons="false"
                />
              </FormField>
            </div>

            <!-- 分区白名单多选器 -->
            <FormField
              label="允许分区白名单"
              :extra="model.allowedPartitions.length ? `已选 ${model.allowedPartitions.length}/20` : '不限制'"
              description="选择主分区将自动放行其下全部子分区"
            >
              <Popover v-model:open="partitionPopoverOpen">
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    class="w-full justify-between font-normal text-muted-foreground"
                  >
                    <span class="truncate">
                      {{
                        model.allowedPartitions.length
                          ? `已选择 ${model.allowedPartitions.length} 个分区，点击继续添加或调整`
                          : '从 B 站新版分区列表选择（留空不限制）'
                      }}
                    </span>
                    <ChevronDown class="size-3.5 shrink-0 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  class="w-[min(calc(100vw-48px),24rem)] p-2.5 space-y-2 bg-popover text-popover-foreground shadow-lg border border-border"
                >
                  <div class="relative">
                    <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      v-model="partitionSearch"
                      placeholder="搜索主分区或子分区名称..."
                      class="pl-8"
                    />
                  </div>
                  <div class="max-h-64 overflow-y-auto scrollbar-thin space-y-2 pr-1">
                    <div
                      v-if="loadingPartitions"
                      class="py-6 text-center text-xs text-muted-foreground"
                    >
                      正在加载分区列表...
                    </div>
                    <div
                      v-else-if="filteredZones.length === 0"
                      class="py-6 text-center text-xs text-muted-foreground"
                    >
                      未找到匹配的 B 站分区
                    </div>
                    <div
                      v-for="zone in filteredZones"
                      :key="zone.id"
                      class="space-y-1"
                    >
                      <Button
                        variant="ghost"
                        size="xs"
                        class="w-full justify-between font-semibold text-foreground"
                        @click="togglePartition(zone.name)"
                      >
                        <span>{{ zone.name }}（整区）</span>
                        <Check
                          v-if="isPartitionSelected(zone.name)"
                          class="size-3.5 text-brand"
                        />
                      </Button>
                      <div class="flex flex-wrap gap-1 pl-2">
                        <Badge
                          v-for="sub in zone.subs"
                          :key="sub.id"
                          :variant="isPartitionSelected(sub.name) ? 'default' : 'outline'"
                          size="xs"
                          class="cursor-pointer transition-colors"
                          @click="togglePartition(sub.name)"
                        >
                          {{ sub.name }}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              <div
                v-if="model.allowedPartitions.length > 0"
                class="flex flex-wrap gap-1 pt-1"
              >
                <Badge
                  v-for="p in model.allowedPartitions"
                  :key="p"
                  variant="secondary"
                  size="xs"
                  class="gap-1 cursor-pointer"
                  @click="removePartition(p)"
                >
                  <span>{{ p }}</span>
                  <X class="size-3 text-muted-foreground hover:text-foreground" />
                </Badge>
              </div>
            </FormField>

            <!-- 重复策略与粉丝限额 -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                label="重复视频策略"
                class="min-w-0"
              >
                <Select
                  :model-value="String(model.duplicatePolicy)"
                  @update:model-value="(val) => (model.duplicatePolicy = Number(val) as DuplicateVideoPolicy)"
                >
                  <SelectTrigger class="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="String(DuplicateVideoPolicy.MergeRecommendations)">合并推荐人</SelectItem>
                    <SelectItem :value="String(DuplicateVideoPolicy.Reject)">直接拒绝</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                label="每人最多推荐"
                :extra="model.maxVideoPerUser ? `${model.maxVideoPerUser} 个` : '不限'"
                class="min-w-0"
              >
                <NumberField
                  v-model="model.maxVideoPerUser"
                  :min="0"
                  :max="100"
                  :show-buttons="false"
                />
              </FormField>
            </div>

            <!-- 推荐理由必填 -->
            <SettingRow
              type="switch"
              variant="compact"
              title="推荐理由必填"
              description="投稿时必须附带推荐看点说明"
              v-model="model.requireDescription"
            />
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button
          variant="ghost"
          @click="close"
        >
          取消
        </Button>
        <Button
          variant="brand"
          :loading="loading"
          @click="submit"
        >
          保存
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
