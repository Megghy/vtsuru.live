<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import {
  NButton,
  NDatePicker,
  NDynamicTags,
  NForm,
  NFormItem,
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
      validator: (_rule, value: number) => value >= Date.now() + 60 * 60 * 1000,
      trigger: ['change', 'blur'],
    },
    {
      message: '截止时间必须晚于开放时间',
      validator: (_rule, value: number) => value > model.value.startAt,
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
  await formRef.value?.validate()
  emit('submit', { ...model.value, allowedPartitions: [...model.value.allowedPartitions] })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    class="collect-form-modal"
    style="width: 760px; max-width: calc(100vw - 32px)"
    @update:show="emit('update:show', $event)"
  >
    <NScrollbar style="max-height: min(72vh, 720px); padding-right: 10px">
      <NForm
        ref="formRef"
        :model="model"
        :rules="rules"
        label-placement="top"
      >
        <section class="form-section">
          <div class="section-heading">
            <h3>基本信息</h3>
            <NText depth="3">名称、说明与征集开放时间</NText>
          </div>
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
              placeholder="填写主题、投稿要求或注意事项"
              maxlength="300"
              show-count
              :autosize="{ minRows: 3, maxRows: 6 }"
            />
          </NFormItem>
          <div class="field-grid field-grid--time">
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
        </section>

        <section class="form-section">
          <div class="section-heading">
            <h3>视频要求</h3>
            <NText depth="3">按 B 站返回的视频信息自动校验</NText>
          </div>
          <div class="field-grid field-grid--three">
            <NFormItem
              label="最大视频数"
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
            <NFormItem
              label="最短时长"
              path="minVideoDuration"
            >
              <NInputNumber
                v-model:value="minDurationMinutes"
                :min="0"
                :max="1440"
                :precision="0"
                style="width: 100%"
              >
                <template #suffix>分钟</template>
              </NInputNumber>
            </NFormItem>
            <NFormItem label="最长时长">
              <NInputNumber
                v-model:value="maxDurationMinutes"
                :min="0"
                :max="1440"
                :precision="0"
                style="width: 100%"
              >
                <template #suffix>分钟</template>
              </NInputNumber>
            </NFormItem>
          </div>
          <NFormItem label="允许分区">
            <NDynamicTags
              v-model:value="model.allowedPartitions"
              :max="20"
            />
            <template #feedback>留空表示不限；填写视频页显示的分区名称，按 Enter 添加</template>
          </NFormItem>
          <NFormItem label="重复视频">
            <NRadioGroup v-model:value="model.duplicatePolicy">
              <NRadioButton :value="DuplicateVideoPolicy.MergeRecommendations">合并推荐人</NRadioButton>
              <NRadioButton :value="DuplicateVideoPolicy.Reject">拒绝重复</NRadioButton>
            </NRadioGroup>
          </NFormItem>
        </section>

        <section class="form-section form-section--last">
          <div class="section-heading">
            <h3>投稿者要求</h3>
            <NText depth="3">控制身份、推荐次数和表单必填项</NText>
          </div>
          <div class="setting-row">
            <div>
              <strong>允许未绑定 B 站账号投稿</strong>
              <NText depth="3">关闭后仅接受已完成 B 站身份绑定的用户</NText>
            </div>
            <NSwitch v-model:value="model.allowUnregisteredUser" />
          </div>
          <div class="setting-row">
            <div>
              <strong>推荐理由必填</strong>
              <NText depth="3">投稿时必须说明推荐这个视频的原因</NText>
            </div>
            <NSwitch v-model:value="model.requireDescription" />
          </div>
          <NFormItem label="每位推荐者最多推荐">
            <NInputNumber
              v-model:value="model.maxVideoPerUser"
              :min="0"
              :max="100"
              :precision="0"
              style="width: 180px; max-width: 100%"
            >
              <template #suffix>个视频</template>
            </NInputNumber>
            <template #feedback>0 表示不限制；未绑定账号时按填写的 UID 或推荐人名称判断</template>
          </NFormItem>
        </section>
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
.form-section {
  padding-bottom: 20px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.form-section--last {
  padding-bottom: 0;
  margin-bottom: 0;
  border-bottom: 0;
}

.section-heading {
  display: flex;
  gap: 8px 14px;
  align-items: baseline;
  margin-bottom: 14px;
}

.section-heading h3 {
  margin: 0;
  font-size: 15px;
  letter-spacing: 0;
}

.section-heading .n-text {
  font-size: 12px;
}

.field-grid {
  display: grid;
  gap: 14px;
  min-width: 0;
}

.field-grid--time {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.field-grid--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.setting-row {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 10px 0;
  border-bottom: 1px solid var(--vtsuru-border);
}

.setting-row > div {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.setting-row strong {
  font-size: 14px;
}

.setting-row .n-text {
  font-size: 12px;
}

.setting-row .n-switch {
  flex: 0 0 auto;
}

.collect-form-modal__actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

@media (max-width: 620px) {
  .field-grid--time,
  .field-grid--three {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .section-heading {
    display: grid;
  }
}
</style>
