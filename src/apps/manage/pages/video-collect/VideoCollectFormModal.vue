<script setup lang="ts">
import { ChevronDown24Regular, ChevronUp24Regular, Filter24Regular } from '@vicons/fluent'
import { format } from 'date-fns'
import { computed, ref, watch } from 'vue'

import type { RequestVideoTable } from '@/api/generated/model'
import { DuplicateVideoPolicy } from '@/api/generated/model'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
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
        <div class="space-y-1.5">
          <label class="font-semibold text-foreground">征集名称 <span class="text-destructive">*</span></label>
          <Input
            v-model="model.name"
            placeholder="例如：三周年回顾视频征集"
            maxlength="30"
          />
        </div>

        <div class="space-y-1.5">
          <label class="font-semibold text-foreground">征集说明</label>
          <textarea
            v-model="model.description"
            rows="2"
            placeholder="填写主题、投稿要求或注意事项（选填）"
            maxlength="300"
            class="w-full text-xs rounded-md border border-input bg-transparent px-3 py-2 shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="font-semibold text-foreground">开放时间</label>
            <Input
              v-model="startDateStr"
              type="datetime-local"
            />
          </div>
          <div class="space-y-1.5">
            <label class="font-semibold text-foreground">截止时间</label>
            <Input
              v-model="endDateStr"
              type="datetime-local"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="font-semibold text-foreground">最大征集视频数</label>
            <Input
              v-model.number="model.maxVideoCount"
              type="number"
              min="1"
              max="10000"
            />
          </div>

          <div class="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/20">
            <div>
              <div class="font-semibold text-foreground">允许游客投稿</div>
              <div class="text-[10px] text-muted-foreground">未绑定 B 站也可提交</div>
            </div>
            <Switch
              :checked="model.allowUnregisteredUser"
              @update:checked="(val) => (model.allowUnregisteredUser = val)"
            />
          </div>
        </div>

        <!-- 高级折叠面板 -->
        <div class="border border-border rounded-lg overflow-hidden">
          <button
            type="button"
            class="w-full flex items-center justify-between p-2.5 bg-muted/30 hover:bg-muted/50 text-left font-semibold text-foreground transition-colors"
            @click="showAdvanced = !showAdvanced"
          >
            <div class="flex items-center gap-1.5">
              <component
                :is="Filter24Regular"
                class="h-3.5 w-3.5 text-brand"
              />
              <span>高级过滤与投稿限制</span>
            </div>
            <component
              :is="showAdvanced ? ChevronUp24Regular : ChevronDown24Regular"
              class="h-3.5 w-3.5 text-muted-foreground"
            />
          </button>

          <div
            v-if="showAdvanced"
            class="p-3 space-y-3 bg-card border-t border-border"
          >
            <!-- 时长限制 -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[11px] text-muted-foreground">最短时长 (秒，0为不限)</label>
                <Input
                  size="xs"
                  v-model.number="model.minVideoDuration"
                  type="number"
                  min="0"
                />
              </div>
              <div class="space-y-1">
                <label class="text-[11px] text-muted-foreground">最长时长 (秒，0为不限)</label>
                <Input
                  v-model.number="model.maxVideoDuration"
                  type="number"
                  min="0"
                  size="xs"
                />
              </div>
            </div>

            <!-- 分区白名单 -->
            <div class="space-y-1.5">
              <label class="text-[11px] text-muted-foreground">允许分区白名单 (留空表示不限制)</label>
              <div class="flex items-center gap-1.5">
                <Input
                  size="xs"
                  v-model="partitionInput"
                  placeholder="例如：单机游戏，回车添加"
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
                  class="text-[10px] pr-1 flex items-center gap-1 cursor-pointer"
                  @click="removePartition(p)"
                >
                  {{ p }}
                  <span class="text-muted-foreground hover:text-foreground">×</span>
                </Badge>
              </div>
            </div>

            <!-- 重复策略与粉丝限额 -->
            <div class="grid grid-cols-2 gap-3">
              <div class="space-y-1">
                <label class="text-[11px] text-muted-foreground">重复视频策略</label>
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
              </div>

              <div class="space-y-1">
                <label class="text-[11px] text-muted-foreground">每人最多推荐 (0为不限)</label>
                <Input
                  size="xs"
                  v-model.number="model.maxVideoPerUser"
                  type="number"
                  min="0"
                />
              </div>
            </div>

            <!-- 推荐理由必填 -->
            <div class="flex items-center justify-between p-2 rounded-md border border-border bg-muted/10">
              <div>
                <div class="font-semibold text-foreground">推荐理由必填</div>
                <div class="text-[10px] text-muted-foreground">投稿时必须附带推荐看点说明</div>
              </div>
              <Switch
                :checked="model.requireDescription"
                @update:checked="(val) => (model.requireDescription = val)"
              />
            </div>
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
