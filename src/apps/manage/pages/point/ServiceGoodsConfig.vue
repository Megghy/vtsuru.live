<script setup lang="ts">
import { Add24Filled, Delete24Filled, Info24Filled } from '@vicons/fluent'
import { computed, ref, watch } from 'vue'

import { ServiceFieldType, type ServiceConfig, type ServiceField } from '@/api/point-service'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Switch } from '@/shared/ui/switch'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

const props = defineProps<{ modelValue?: ServiceConfig }>()
const emit = defineEmits<{ (event: 'update:modelValue', value: ServiceConfig): void }>()

let fieldSeed = 0
const fieldTypes: Array<{ label: string; value: ServiceFieldType }> = [
  { label: '短文本', value: ServiceFieldType.Text },
  { label: '长文本', value: ServiceFieldType.Textarea },
  { label: '单选', value: ServiceFieldType.Select },
  { label: '多选', value: ServiceFieldType.MultiSelect },
  { label: '链接', value: ServiceFieldType.Url },
  { label: '日期', value: ServiceFieldType.Date },
  { label: '数字', value: ServiceFieldType.Number },
]

function nextFieldId() {
  fieldSeed += 1
  return `field-${Date.now().toString(36)}-${fieldSeed}`
}

function createField(overrides: Partial<ServiceField> = {}): ServiceField {
  return {
    id: nextFieldId(),
    label: '',
    type: ServiceFieldType.Text,
    required: true,
    options: [],
    ...overrides,
  }
}

function cloneConfig(value?: ServiceConfig): ServiceConfig {
  return {
    fields: (value?.fields ?? []).map((field) => ({
      id: field.id || nextFieldId(),
      label: field.label,
      type: field.type,
      required: field.required,
      options: [...(field.options ?? [])],
    })),
    rules: value?.rules ?? '',
    estimatedDays: value?.estimatedDays,
    paused: value?.paused ?? false,
    maxActiveOrders: value?.maxActiveOrders,
  }
}

function parseOptionalNumber(value: string | null): number | undefined {
  const normalized = value?.trim() ?? ''
  if (normalized === '') return undefined
  const number = Number(normalized)
  return Number.isFinite(number) ? number : undefined
}

const draft = ref<ServiceConfig>(cloneConfig(props.modelValue))
const estimatedDaysInput = ref<string | null>(null)
const maxActiveOrdersInput = ref<string | null>(null)

function syncInputs(value: ServiceConfig) {
  estimatedDaysInput.value = value.estimatedDays == null ? null : String(value.estimatedDays)
  maxActiveOrdersInput.value = value.maxActiveOrders == null ? null : String(value.maxActiveOrders)
}

function updateNumber(key: 'estimatedDays' | 'maxActiveOrders', value: string | null) {
  const number = parseOptionalNumber(value)
  draft.value[key] = number
  emit('update:modelValue', cloneConfig(draft.value))
}

syncInputs(draft.value)
watch(
  () => props.modelValue,
  (value) => {
    const next = cloneConfig(value)
    if (JSON.stringify(next) !== JSON.stringify(draft.value)) {
      draft.value = next
      syncInputs(next)
    }
  },
  { deep: true },
)
watch(draft, (value) => emit('update:modelValue', cloneConfig(value)), { deep: true })

const presetOptions = [
  { label: '通用约稿', value: 'commission' },
  { label: '音声 / 视频定制', value: 'media' },
  { label: '预约陪伴 / 连麦', value: 'appointment' },
]

function applyPreset(value: string | null) {
  if (!value) return
  const presets: Record<string, ServiceField[]> = {
    commission: [
      createField({ id: 'title', label: '需求描述', type: ServiceFieldType.Textarea }),
      createField({ id: 'reference', label: '参考链接', type: ServiceFieldType.Url, required: false }),
      createField({ id: 'usage', label: '用途与补充说明', type: ServiceFieldType.Textarea, required: false }),
    ],
    media: [
      createField({ id: 'script', label: '脚本或文案', type: ServiceFieldType.Textarea }),
      createField({ id: 'style', label: '风格 / 语气偏好', type: ServiceFieldType.Text, required: false }),
      createField({ id: 'reference', label: '参考链接', type: ServiceFieldType.Url, required: false }),
    ],
    appointment: [
      createField({ id: 'preferred-time', label: '期望时间段', type: ServiceFieldType.Text }),
      createField({ id: 'topic', label: '主题与需求', type: ServiceFieldType.Textarea }),
      createField({ id: 'notes', label: '补充说明', type: ServiceFieldType.Textarea, required: false }),
    ],
  }
  draft.value.fields = presets[value] ?? []
}

function addField() {
  draft.value.fields.push(createField())
}

function removeField(index: number) {
  draft.value.fields.splice(index, 1)
}

function normalizeField(field: ServiceField) {
  field.label = field.label.trim()
  if (field.type !== ServiceFieldType.Select && field.type !== ServiceFieldType.MultiSelect) field.options = []
}

const optionInputs = ref<Record<string, string>>({})

function addOption(field: ServiceField) {
  const text = (optionInputs.value[field.id] || '').trim()
  if (!text) return
  field.options = [...new Set([...(field.options ?? []), text])]
  optionInputs.value[field.id] = ''
}

function removeOption(field: ServiceField, optIndex: number) {
  field.options?.splice(optIndex, 1)
}
</script>

<template>
  <div class="space-y-4 pb-2">
    <Alert variant="default" class="border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400">
      <AlertDescription class="text-xs">
        服务兑换会先收集需求，再由你在订单中安排和交付
      </AlertDescription>
    </Alert>

    <!-- 接单状态卡片 -->
    <Card class="border border-border">
      <CardContent class="p-3.5 flex items-center justify-between">
        <div>
          <span class="text-xs font-semibold text-foreground block">接单状态</span>
          <span class="text-[11px] text-muted-foreground mt-0.5 block">
            暂停后不会接受新的兑换，已有订单仍可继续处理。
          </span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium" :class="!draft.paused ? 'text-primary' : 'text-muted-foreground'">
            {{ !draft.paused ? '接单中' : '已暂停' }}
          </span>
          <Switch
            :checked="!draft.paused"
            @update:checked="draft.paused = !$event"
          />
        </div>
      </CardContent>
    </Card>

    <!-- 履约边界 -->
    <div class="space-y-3">
      <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">履约边界</h4>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="space-y-1">
          <label class="text-xs font-medium text-foreground">预计完成周期</label>
          <div class="relative">
            <Input
              v-model="estimatedDaysInput"
              type="number"
              min="1"
              step="1"
              placeholder="可选，例如 7"
              class="h-8 text-xs pr-7"
              @update:model-value="updateNumber('estimatedDays', String($event))"
            />
            <span class="absolute right-2.5 top-2 text-[11px] text-muted-foreground">天</span>
          </div>
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium text-foreground">最大未完成订单数</label>
          <Input
            v-model="maxActiveOrdersInput"
            type="number"
            min="1"
            step="1"
            placeholder="不限制"
            class="h-8 text-xs"
            @update:model-value="updateNumber('maxActiveOrders', String($event))"
          />
        </div>
      </div>
    </div>

    <!-- 规则说明 -->
    <div class="space-y-1">
      <label class="text-xs font-medium text-foreground">服务规则与交付说明</label>
      <Textarea
        v-model="draft.rules"
        :rows="3"
        maxlength="3000"
        placeholder="例如：包含几次修改、如何确认时间、哪些需求无法承接，以及成品交付方式。"
        class="text-xs"
      />
    </div>

    <!-- 需求收集字段配置 -->
    <div class="space-y-3 pt-2">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-1.5">
          <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">兑换时收集的需求</h4>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
              </TooltipTrigger>
              <TooltipContent>
                <p class="text-xs">字段会保存到订单快照，系统会自动生成内部标识，修改字段标题不会影响已有订单。</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div class="flex items-center gap-2">
          <select
            class="h-7 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            @change="applyPreset(($event.target as HTMLSelectElement).value)"
          >
            <option value="">套用轻量模板</option>
            <option v-for="opt in presetOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <Button size="xs" variant="outline" class="gap-1 h-7" @click="addField">
            <Add24Filled class="size-3.5" />
            添加字段
          </Button>
        </div>
      </div>

      <Empty
        v-if="draft.fields.length === 0"
        description="暂不收集额外需求，兑换后可通过订单留言沟通"
        class="py-6 border rounded-lg border-dashed"
      />

      <div class="space-y-2.5">
        <Card
          v-for="(field, index) in draft.fields"
          :key="field.id || index"
          class="border border-border p-3 space-y-3"
        >
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-medium text-foreground">字段名称 <span class="text-destructive">*</span></label>
              <Input
                v-model="field.label"
                placeholder="例如：需求描述"
                maxlength="100"
                class="h-8 text-xs"
                @blur="normalizeField(field)"
              />
            </div>

            <div class="space-y-1">
              <label class="text-xs font-medium text-foreground">字段类型</label>
              <div class="flex items-center gap-2">
                <select
                  v-model="field.type"
                  class="flex-1 h-8 rounded border border-input bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  @change="normalizeField(field)"
                >
                  <option v-for="ft in fieldTypes" :key="ft.value" :value="ft.value">
                    {{ ft.label }}
                  </option>
                </select>

                <Button
                  variant="ghost"
                  size="icon"
                  class="size-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10"
                  @click="removeField(index)"
                >
                  <Delete24Filled class="size-3.5" />
                </Button>
              </div>
            </div>

            <!-- 可选项编辑 -->
            <div
              v-if="field.type === ServiceFieldType.Select || field.type === ServiceFieldType.MultiSelect"
              class="col-span-full space-y-1.5"
            >
              <label class="text-xs font-medium text-foreground">可选项配置</label>
              <div class="flex items-center gap-2">
                <Input
                  v-model="optionInputs[field.id]"
                  placeholder="输入选项名称后按回车或点击添加"
                  class="h-7 text-xs flex-1"
                  @keyup.enter="addOption(field)"
                />
                <Button size="xs" variant="outline" class="h-7" @click="addOption(field)">
                  添加选项
                </Button>
              </div>
              <div v-if="field.options && field.options.length > 0" class="flex flex-wrap gap-1.5 pt-1">
                <span
                  v-for="(opt, optIdx) in field.options"
                  :key="optIdx"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-muted text-foreground border border-border"
                >
                  {{ opt }}
                  <button
                    type="button"
                    class="hover:text-destructive"
                    @click="removeOption(field, optIdx)"
                  >
                    ×
                  </button>
                </span>
              </div>
            </div>

            <div class="col-span-full flex items-center gap-2 pt-1">
              <Checkbox
                :checked="field.required"
                @update:checked="field.required = $event"
              />
              <span class="text-xs text-foreground cursor-pointer" @click="field.required = !field.required">
                兑换时必须填写
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
