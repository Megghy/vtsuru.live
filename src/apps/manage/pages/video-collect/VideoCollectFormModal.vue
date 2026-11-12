<script setup lang="ts">
import ChevronDown24Regular from '@vicons/fluent/es/ChevronDown24Regular'
import ChevronUp24Regular from '@vicons/fluent/es/ChevronUp24Regular'
import Filter24Regular from '@vicons/fluent/es/Filter24Regular'
import { format } from 'date-fns'
import { computed, ref, watch } from 'vue'

import type { RequestVideoTable } from '@/api/generated/model'
import { DuplicateVideoPolicy } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { useMessage } from '@/shared/utils'

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
const partitionInput = ref('')

const startDateStr = ref('')
const endDateStr = ref('')

function formatForInput(ts: number) {
  try {
    return format(ts, "yyyy-MM-dd'T'HH:mm")
  } catch {
    return ''
  }
}

function parseFromInput(str: string) {
  const parsed = new Date(str).getTime()
  return isNaN(parsed) ? Date.now() : parsed
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
  },
)

function createModel(value?: Partial<RequestVideoTable>): RequestVideoTable {
  return {
    id: value?.id,
    name: value?.name ?? '',
    description: value?.description ?? '',
    startAt: value?.startAt ?? Date.now(),
    endAt: value?.endAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
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

function addPartition() {
  const p = partitionInput.value.trim()
  if (!p) return
  if (!model.value.allowedPartitions.includes(p)) {
    model.value.allowedPartitions.push(p)
  }
  partitionInput.value = ''
}

function removePartition(p: string) {
  model.value.allowedPartitions = model.value.allowedPartitions.filter((item) => item !== p)
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

  const startAt = parseFromInput(startDateStr.value)
  const endAt = parseFromInput(endDateStr.value)

  if (endAt <= startAt) {
    message.warning('截止时间必须晚于开放时间')
    return
  }

  model.value.startAt = startAt
  model.value.endAt = endAt

  if (model.value.maxVideoCount <= 0) {
    message.warning('最大视频数需要在 1 到 10000 之间')
    return
  }

  emit('submit', { ...model.value, allowedPartitions: [...model.value.allowedPartitions] })
}
</script>

<template>
  <Dialog
    :open="show"
    @update:open="(val) => emit('update:show', val)"
  >
    <DialogContent class="sm:max-w-xl max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription class="text-xs"> 配置视频征集的主题、开放时间、名额与投稿过滤规则 </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 py-2 text-xs">
        <!-- 基础配置 -->
        <FormField
          label="征集名称"
          required
        >
          <Input
            v-model="model.name"
            placeholder="例如：三周年回顾视频征集"
            maxlength="30"
          />
        </FormField>

        <FormField label="征集说明">
          <Textarea
            v-model="model.description"
            rows="2"
            placeholder="填写主题、投稿要求或注意事项（选填）"
            maxlength="300"
          />
        </FormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="开放时间">
            <Input
              v-model="startDateStr"
              type="datetime-local"
            />
          </FormField>
          <FormField label="截止时间">
            <Input
              v-model="endDateStr"
              type="datetime-local"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField
            type="number"
            label="最大征集视频数"
            :min="1"
            :max="10000"
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
            class="w-full h-auto justify-between p-2.5 bg-muted/30 rounded-none font-semibold"
            @click="showAdvanced = !showAdvanced"
          >
            <div class="flex items-center gap-1.5">
              <component
                :is="Filter24Regular"
                class="size-3.5 text-brand"
              />
              <span>高级过滤与投稿限制</span>
            </div>
            <component
              :is="showAdvanced ? ChevronUp24Regular : ChevronDown24Regular"
              class="size-3.5 text-muted-foreground"
            />
          </Button>

          <div
            v-if="showAdvanced"
            class="p-3 space-y-3 bg-card border-t border-border"
          >
            <!-- 时长限制 -->
            <div class="grid grid-cols-2 gap-3">
              <FormField label="最短时长 (秒，0为不限)">
                <NumberField
                  size="xs"
                  v-model="model.minVideoDuration"
                  min="0"
                  :show-buttons="false"
                />
              </FormField>
              <FormField label="最长时长 (秒，0为不限)">
                <NumberField
                  v-model="model.maxVideoDuration"
                  min="0"
                  size="xs"
                  :show-buttons="false"
                />
              </FormField>
            </div>

            <!-- 分区白名单 -->
            <FormField label="允许分区白名单 (留空表示不限制)">
              <div class="flex items-center gap-1.5">
                <Input
                  size="xs"
                  v-model="partitionInput"
                  placeholder="B 站新版主分区或子分区，如：游戏、翻唱，回车添加"
                  class="flex-1"
                  @keyup.enter="addPartition"
                />
                <Button
                  size="xs"
                  variant="outline"
                  class="px-2"
                  @click="addPartition"
                >
                  添加
                </Button>
              </div>
              <div
                v-if="model.allowedPartitions.length > 0"
                class="flex flex-wrap gap-1 pt-1"
              >
                <Badge
                  v-for="p in model.allowedPartitions"
                  :key="p"
                  variant="secondary"
                  size="xs"
                  class="pr-1 flex items-center gap-1 cursor-pointer"
                  @click="removePartition(p)"
                >
                  {{ p }}
                  <span class="text-muted-foreground hover:text-foreground">×</span>
                </Badge>
              </div>
            </FormField>

            <!-- 重复策略与粉丝限额 -->
            <div class="grid grid-cols-2 gap-3">
              <FormField label="重复视频策略">
                <Select
                  :model-value="String(model.duplicatePolicy)"
                  @update:model-value="(val) => (model.duplicatePolicy = Number(val) as DuplicateVideoPolicy)"
                >
                  <SelectTrigger size="xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem :value="String(DuplicateVideoPolicy.MergeRecommendations)"> 合并推荐人 </SelectItem>
                    <SelectItem :value="String(DuplicateVideoPolicy.Reject)"> 直接拒绝 </SelectItem>
                  </SelectContent>
                </Select>
              </FormField>

              <FormField label="每人最多推荐 (0为不限)">
                <NumberField
                  size="xs"
                  v-model="model.maxVideoPerUser"
                  min="0"
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
          size="xs"
          variant="ghost"
          @click="close"
        >
          取消
        </Button>
        <Button
          size="xs"
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
