<script setup lang="ts">
import { ChevronDown24Regular, ChevronUp24Regular, Filter24Regular } from '@vicons/fluent'
import type { FormInst, FormItemRule, FormRules } from 'naive-ui'
import {
  NButton,
  NCollapse,
  NCollapseItem,
  NDatePicker,
  NDynamicTags,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSwitch,
  NText,
} from 'naive-ui'
import { computed, ref, watch } from 'vue'

import type { VideoCollectCreateModel } from '@/api/api-models'
import { DuplicateVideoPolicy } from '@/api/api-models'

const props = defineProps<{
  show: boolean
  title: string
  initialValue?: Partial<VideoCollectCreateModel>
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  submit: [value: VideoCollectCreateModel]
}>()

const formRef = ref<FormInst>()
const model = ref<VideoCollectCreateModel>(createModel())
const expandedNames = ref<string[]>([])

const minDurationMinutes = computed({
  get: () => model.value.minVideoDuration / 60,
  set: (value: number | null) => (model.value.minVideoDuration = Math.round((value ?? 0) * 60)),
})
const maxDurationMinutes = computed({
  get: () => model.value.maxVideoDuration / 60,
  set: (value: number | null) => (model.value.maxVideoDuration = Math.round((value ?? 0) * 60)),
})

const rules: FormRules = {
  name: {
    required: true,
    message: '请输入征集名称',
    trigger: ['input', 'blur'],
  },
  startAt: {
    required: true,
    type: 'number',
    message: '请选择开放时间',
    trigger: ['change', 'blur'],
  },
  endAt: [
    { required: true, type: 'number', message: '请选择截止时间' },
    {
      message: '截止时间至少需要在当前时间一小时后',
      validator: (_rule: FormItemRule, value: number) => value >= Date.now() + 60 * 60 * 1000,
      trigger: ['change', 'blur'],
    },
    {
      message: '截止时间必须晚于开放时间',
      validator: (_rule: FormItemRule, value: number) => value > model.value.startAt,
      trigger: ['change', 'blur'],
    },
  ],
  maxVideoCount: {
    required: true,
    type: 'number',
    min: 1,
    max: 10000,
    message: '最大视频数需要在 1 到 10000 之间',
    trigger: ['input', 'blur'],
  },
  minVideoDuration: {
    message: '最短时长不能超过最长时长',
    validator: () => model.value.maxVideoDuration === 0 || model.value.minVideoDuration <= model.value.maxVideoDuration,
    trigger: ['input', 'blur'],
  },
}

watch(
  () => props.show,
  (show) => {
    if (!show) return
    model.value = createModel(props.initialValue)
    // 若初始值中包含了自定义高级限制，默认展开高级选项
    const hasCustomAdvanced = Boolean(
      props.initialValue?.minVideoDuration ||
      props.initialValue?.maxVideoDuration ||
      props.initialValue?.allowedPartitions?.length ||
      props.initialValue?.maxVideoPerUser ||
      props.initialValue?.requireDescription ||
      (props.initialValue?.duplicatePolicy &&
        props.initialValue.duplicatePolicy !== DuplicateVideoPolicy.MergeRecommendations),
    )
    expandedNames.value = hasCustomAdvanced ? ['advanced'] : []
    formRef.value?.restoreValidation()
  },
)

function createModel(value?: Partial<VideoCollectCreateModel>): VideoCollectCreateModel {
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

function close() {
  emit('update:show', false)
}

async function submit() {
  try {
    await formRef.value?.validate()
    emit('submit', { ...model.value, allowedPartitions: [...model.value.allowedPartitions] })
  } catch (errors: any) {
    // 校验失败时自动展开高级折叠面板，定位高亮未填/错误字段 (规则 #362)
    const advancedFields = ['minVideoDuration', 'maxVideoDuration', 'allowedPartitions', 'maxVideoPerUser']
    if (Array.isArray(errors)) {
      const hasAdvancedError = errors.some((errArr: any) =>
        Array.isArray(errArr)
          ? errArr.some((err: any) => advancedFields.includes(err?.field))
          : advancedFields.includes(errArr?.field),
      )
      if (hasAdvancedError && !expandedNames.value.includes('advanced')) {
        expandedNames.value = [...expandedNames.value, 'advanced']
      }
    }
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    class="collect-form-modal"
    style="width: 680px; max-width: calc(100vw - 32px)"
    @update:show="emit('update:show', $event)"
  >
    <NScrollbar style="max-height: min(75vh, 680px); padding-right: 8px">
      <NForm
        ref="formRef"
        :model="model"
        :rules="rules"
        label-placement="top"
        class="collect-form"
      >
        <!-- 主视图：核心必填与高频配置 (规则 #362) -->
        <section class="form-core-section">
          <NFormItem
            label="征集名称"
            path="name"
          >
            <NInput
              v-model:value="model.name"
              placeholder="例如：三周年回顾视频征集"
              maxlength="30"
              show-count
            />
          </NFormItem>

          <NFormItem
            label="征集说明"
            path="description"
          >
            <NInput
              v-model:value="model.description"
              type="textarea"
              placeholder="填写主题、投稿要求或注意事项（选填）"
              maxlength="300"
              show-count
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>

          <div class="field-grid field-grid--two">
            <NFormItem
              label="开放时间"
              path="startAt"
            >
              <NDatePicker
                v-model:value="model.startAt"
                type="datetime"
                style="width: 100%"
              />
            </NFormItem>
            <NFormItem
              label="截止时间"
              path="endAt"
            >
              <NDatePicker
                v-model:value="model.endAt"
                type="datetime"
                style="width: 100%"
              />
            </NFormItem>
          </div>

          <div class="field-grid field-grid--two">
            <NFormItem
              label="最大征集视频数"
              path="maxVideoCount"
            >
              <NInputNumber
                v-model:value="model.maxVideoCount"
                :min="1"
                :max="10000"
                :precision="0"
                style="width: 100%"
              />
            </NFormItem>

            <div class="switch-field-box">
              <div class="switch-field-info">
                <strong>允许游客投稿</strong>
                <span class="switch-field-desc">未绑定 B 站账号的用户也可提交</span>
              </div>
              <NSwitch v-model:value="model.allowUnregisteredUser" />
            </div>
          </div>
        </section>

        <!-- 低频高级限制与过滤选项 (默认折叠收纳) -->
        <NCollapse
          v-model:expanded-names="expandedNames"
          arrow-placement="right"
          class="advanced-collapse"
        >
          <NCollapseItem
            name="advanced"
            class="advanced-collapse-item"
          >
            <template #header>
              <div class="advanced-header">
                <NIcon :component="Filter24Regular" />
                <span>高级过滤与投稿限制</span>
                <NText
                  depth="3"
                  class="advanced-header-hint"
                >
                  （时长限制、分区白名单、重复策略、推荐人限额）
                </NText>
              </div>
            </template>

            <div class="advanced-content">
              <!-- 时长限制 -->
              <div class="field-grid field-grid--two">
                <NFormItem
                  label="最短时长"
                  path="minVideoDuration"
                >
                  <NInputNumber
                    v-model:value="minDurationMinutes"
                    :min="0"
                    :max="1440"
                    :precision="0"
                    placeholder="0 表示不限制"
                    style="width: 100%"
                  >
                    <template #suffix>分钟</template>
                  </NInputNumber>
                </NFormItem>
                <NFormItem
                  label="最长时长"
                  path="maxVideoDuration"
                >
                  <NInputNumber
                    v-model:value="maxDurationMinutes"
                    :min="0"
                    :max="1440"
                    :precision="0"
                    placeholder="0 表示不限制"
                    style="width: 100%"
                  >
                    <template #suffix>分钟</template>
                  </NInputNumber>
                </NFormItem>
              </div>

              <!-- 分区白名单 -->
              <NFormItem label="允许分区白名单">
                <NDynamicTags
                  v-model:value="model.allowedPartitions"
                  :max="20"
                />
                <template #feedback
                  >留空表示不限任何分区；填写 B 站视频分区名称（如：游戏、单机游戏），按 Enter 添加</template
                >
              </NFormItem>

              <!-- 重复策略与推荐理由必填 -->
              <div class="field-grid field-grid--two">
                <NFormItem label="重复视频处理">
                  <NRadioGroup v-model:value="model.duplicatePolicy">
                    <NRadioButton :value="DuplicateVideoPolicy.MergeRecommendations">合并推荐人</NRadioButton>
                    <NRadioButton :value="DuplicateVideoPolicy.Reject">直接拒绝</NRadioButton>
                  </NRadioGroup>
                </NFormItem>

                <NFormItem label="每位粉丝最多推荐">
                  <NInputNumber
                    v-model:value="model.maxVideoPerUser"
                    :min="0"
                    :max="100"
                    :precision="0"
                    placeholder="0 为不限制"
                    style="width: 100%"
                  >
                    <template #suffix>个视频</template>
                  </NInputNumber>
                </NFormItem>
              </div>

              <div class="switch-field-box is-inline">
                <div class="switch-field-info">
                  <strong>推荐理由必填</strong>
                  <span class="switch-field-desc">粉丝投稿时必须填写推荐看点与理由</span>
                </div>
                <NSwitch v-model:value="model.requireDescription" />
              </div>
            </div>
          </NCollapseItem>
        </NCollapse>
      </NForm>
    </NScrollbar>

    <template #footer>
      <div class="collect-form-modal__actions">
        <NButton @click="close">取消</NButton>
        <NButton
          type="primary"
          :loading="loading"
          @click="submit"
        >
          保存
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.collect-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-core-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field-grid {
  display: grid;
  gap: 14px;
  align-items: flex-start;
}

.field-grid--two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.switch-field-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  margin-top: 4px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  min-height: 40px;
}

.switch-field-box.is-inline {
  margin-top: 8px;
}

.switch-field-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.switch-field-info strong {
  font-size: 13px;
  color: var(--vtsuru-fg);
}

.switch-field-desc {
  font-size: 11px;
  color: var(--vtsuru-fg-muted);
}

.advanced-collapse {
  margin-top: 4px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
}

.advanced-header {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--vtsuru-fg);
}

.advanced-header-hint {
  font-size: 11px;
  font-weight: 400;
}

.advanced-content {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 8px 4px 4px;
}

.collect-form-modal__actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@media (max-width: 600px) {
  .field-grid--two {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
