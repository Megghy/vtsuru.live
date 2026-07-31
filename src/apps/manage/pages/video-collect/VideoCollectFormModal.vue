<script setup lang="ts">
import type { FormInst, FormRules } from 'naive-ui'
import { NButton, NDatePicker, NForm, NFormItem, NInput, NInputNumber, NModal, NText } from 'naive-ui'
import { ref, watch } from 'vue'

import type { VideoCollectCreateModel } from '@/api/api-models'

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

const rules: FormRules = {
  name: {
    required: true,
    message: '请输入征集名称',
    trigger: ['input', 'blur'],
  },
  endAt: [
    { required: true, type: 'number', message: '请选择截止时间' },
    {
      message: '截止时间至少需要在当前时间一小时后',
      validator: (_rule, value: number) => value >= Date.now() + 60 * 60 * 1000,
      trigger: ['change', 'blur'],
    },
  ],
  maxVideoCount: {
    required: true,
    type: 'number',
    min: 1,
    message: '最大视频数不能少于 1',
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
    endAt: value?.endAt ?? Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxVideoCount: value?.maxVideoCount ?? 50,
  }
}

function close() {
  emit('update:show', false)
}

async function submit() {
  await formRef.value?.validate()
  emit('submit', { ...model.value })
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="title"
    class="collect-form-modal"
    @update:show="emit('update:show', $event)"
  >
    <NForm
      ref="formRef"
      :model="model"
      :rules="rules"
      label-placement="top"
    >
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
          placeholder="说明主题、投稿要求或注意事项"
          maxlength="300"
          show-count
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </NFormItem>

      <div class="collect-form-modal__grid">
        <NFormItem
          label="最大视频数"
          path="maxVideoCount"
        >
          <NInputNumber
            v-model:value="model.maxVideoCount"
            :min="1"
            :precision="0"
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
            :is-date-disabled="(timestamp: number) => timestamp < Date.now() + 60 * 60 * 1000"
            style="width: 100%"
          />
        </NFormItem>
      </div>

      <NText
        depth="3"
        class="collect-form-modal__hint"
      >
        截止时间至少需要在当前时间一小时后。
      </NText>
    </NForm>

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
.collect-form-modal {
  width: min(600px, calc(100vw - 32px));
}

.collect-form-modal__grid {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 16px;
}

.collect-form-modal__hint {
  display: block;
  margin-top: -4px;
  font-size: 12px;
}

.collect-form-modal__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

@media (max-width: 560px) {
  .collect-form-modal__grid {
    grid-template-columns: 1fr;
    gap: 0;
  }
}
</style>
