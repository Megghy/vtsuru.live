<script setup lang="ts">
import { Add24Filled, Delete24Filled, Info24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NEmpty,
  NFlex,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputNumber,
  NSelect,
  NSwitch,
  NText,
  NTooltip,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import { ServiceFieldType, type ServiceConfig, type ServiceField } from '@/api/point-service'

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

function normalizeOptions(value: string[] | null): string[] {
  return [...new Set((value ?? []).map((item) => item.trim()).filter(Boolean))]
}

function updateFieldOptions(field: ServiceField, value: string[] | null) {
  field.options = normalizeOptions(value)
}
</script>

<template>
  <div class="service-config">
    <NAlert
      type="info"
      :bordered="false"
      class="service-intro"
    >
      服务兑换会先收集需求，再由你在订单中安排和交付
    </NAlert>

    <NCard
      size="small"
      :bordered="true"
      class="service-status-card"
    >
      <NFlex
        justify="space-between"
        align="center"
        :gap="16"
        wrap
      >
        <div>
          <NText strong>接单状态</NText>
          <NText
            depth="3"
            style="display: block; margin-top: 4px; font-size: 12px"
          >
            暂停后不会接受新的兑换，已有订单仍可继续处理。
          </NText>
        </div>
        <NSwitch
          v-model:value="draft.paused"
          :checked-value="false"
          :unchecked-value="true"
        >
          <template #checked> 接单中 </template>
          <template #unchecked> 已暂停 </template>
        </NSwitch>
      </NFlex>
    </NCard>

    <div class="form-section-title">履约边界</div>
    <NGrid
      cols="1 s:2"
      :x-gap="16"
      :y-gap="0"
    >
      <NGridItem>
        <NFormItem label="预计完成周期">
          <NInput
            v-model:value="estimatedDaysInput"
            :input-props="{ type: 'number', min: 1, step: 1 }"
            clearable
            placeholder="可选，例如 7"
            style="width: 100%"
            @update:value="updateNumber('estimatedDays', $event)"
          >
            <template #suffix>天</template>
          </NInput>
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem label="最大未完成订单数">
          <NInput
            v-model:value="maxActiveOrdersInput"
            :input-props="{ type: 'number', min: 1, step: 1 }"
            clearable
            placeholder="不限制"
            style="width: 100%"
            @update:value="updateNumber('maxActiveOrders', $event)"
          />
        </NFormItem>
      </NGridItem>
    </NGrid>

    <NFormItem label="服务规则与交付说明">
      <NInput
        v-model:value="draft.rules"
        type="textarea"
        :rows="4"
        maxlength="3000"
        show-count
        placeholder="例如：包含几次修改、如何确认时间、哪些需求无法承接，以及成品交付方式。"
      />
    </NFormItem>

    <div class="form-section-title service-fields-heading">
      <span>兑换时收集的需求</span>
      <NTooltip>
        <template #trigger>
          <NIcon
            :component="Info24Filled"
            class="muted-icon"
          />
        </template>
        字段会保存到订单快照，系统会自动生成内部标识，修改字段标题不会影响已有订单。
      </NTooltip>
      <NFlex
        align="center"
        :gap="8"
        style="margin-left: auto"
      >
        <NSelect
          size="small"
          clearable
          placeholder="套用轻量模板"
          :options="presetOptions"
          style="width: 170px"
          @update:value="applyPreset"
        />
        <NButton
          size="small"
          type="primary"
          secondary
          @click="addField"
        >
          <template #icon><NIcon :component="Add24Filled" /></template>
          添加字段
        </NButton>
      </NFlex>
    </div>

    <NEmpty
      v-if="draft.fields.length === 0"
      description="暂不收集额外需求，兑换后可通过订单留言沟通"
      style="margin: 24px 0"
    />
    <div
      v-for="(field, index) in draft.fields"
      :key="field.id || index"
      class="service-field-card"
    >
      <NGrid
        cols="1 s:2"
        :x-gap="12"
        :y-gap="0"
      >
        <NGridItem>
          <NFormItem
            label="字段名称"
            required
          >
            <NInput
              v-model:value="field.label"
              placeholder="例如：需求描述"
              maxlength="100"
              @blur="normalizeField(field)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem label="字段类型">
            <NFlex
              align="center"
              :gap="8"
            >
              <NSelect
                v-model:value="field.type"
                :options="fieldTypes"
                style="flex: 1"
                :consistent-menu-width="false"
                @update:value="normalizeField(field)"
              />
              <NButton
                type="error"
                secondary
                size="small"
                @click="removeField(index)"
              >
                <template #icon><NIcon :component="Delete24Filled" /></template>
                删除
              </NButton>
            </NFlex>
          </NFormItem>
        </NGridItem>
        <NGridItem
          v-if="field.type === ServiceFieldType.Select || field.type === ServiceFieldType.MultiSelect"
          :span="2"
        >
          <NFormItem label="可选项">
            <NSelect
              :value="field.options"
              multiple
              tag
              filterable
              clearable
              :consistent-menu-width="false"
              :placeholder="`输入后按 Enter 添加${field.type === ServiceFieldType.MultiSelect ? '，可多选' : ''}，例如：标准、加急`"
              @update:value="updateFieldOptions(field, $event)"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem :span="2">
          <NCheckbox v-model:checked="field.required">兑换时必须填写</NCheckbox>
        </NGridItem>
      </NGrid>
    </div>
  </div>
</template>

<style scoped>
.service-config {
  padding-bottom: 8px;
}
.service-intro {
  margin-bottom: 16px;
}
.service-status-card {
  margin-bottom: 16px;
  background: var(--vtsuru-bg-surface);
}
.form-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 16px 0 8px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
  font-weight: 600;
}
.service-fields-heading {
  margin-top: 20px;
}
.muted-icon {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}
.service-field-card {
  margin-bottom: 12px;
  padding: 12px 14px 4px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-surface);
}
</style>
