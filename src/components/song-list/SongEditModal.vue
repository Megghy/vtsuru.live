<script setup lang="ts">
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NButton, NCheckbox, NFlex, NForm, NFormItem, NIcon, NInput,
  NInputGroup, NInputGroupLabel, NInputNumber, NModal, NSelect, NTooltip,
} from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  languageOptions: SelectOption[]
  tagOptions: SelectOption[]
  authorOptions: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'save', song: SongsInfo): void
}>()

const show = ref(false)
const model = ref<SongsInfo>({} as SongsInfo)
const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const rules: FormRules = {
  name: [{ required: true, message: '请输入歌曲名称', trigger: ['input', 'blur'] }],
}

function open(song: SongsInfo) {
  model.value = JSON.parse(JSON.stringify(song))
  show.value = true
}

async function handleSave() {
  try {
    await formRef.value?.validate()
    loading.value = true
    emit('save', model.value)
  } catch { /* validation failed */ }
}

function close() {
  show.value = false
  loading.value = false
}

defineExpose({ open, close, loading })
</script>

<template>
  <NModal
    v-model:show="show"
    preset="card"
    style="max-width: 600px;"
    :title="`修改 - ${model.name}`"
    :mask-closable="false"
  >
    <NForm ref="formRef" :rules="rules" :model="model" label-placement="left" label-width="auto">
      <NFormItem path="name" label="名称">
        <NInput v-model:value="model.name" placeholder="歌曲名称" clearable />
      </NFormItem>
      <NFormItem path="translateName" label="翻译名称">
        <NInput v-model:value="model.translateName" placeholder="可选，翻译/别名" clearable />
      </NFormItem>
      <NFormItem path="author" label="作者">
        <NSelect
          v-model:value="model.author" :options="authorOptions"
          placeholder="选择或输入，回车确认" filterable multiple tag clearable
        />
      </NFormItem>
      <NFormItem path="description" label="备注">
        <NInput
          v-model:value="model.description" type="textarea" placeholder="可选"
          :maxlength="250" show-count clearable autosize style="min-width: 300px;"
        />
      </NFormItem>
      <NFormItem path="language" label="语言">
        <NSelect
          v-model:value="model.language" :options="languageOptions"
          placeholder="选择或输入，回车确认" filterable multiple tag clearable
        />
      </NFormItem>
      <NFormItem path="tags" label="标签">
        <NSelect
          v-model:value="model.tags" :options="tagOptions"
          placeholder="选择或输入，回车确认" filterable multiple tag clearable
        />
      </NFormItem>
      <NFormItem path="options">
        <template #label>
          <NFlex align="center" :size="4">
            点歌要求
            <NTooltip>
              <template #trigger>
                <NIcon :component="Info24Filled" style="cursor: help;" />
              </template>
              启用后将覆盖全局点歌设置，用于单独设置歌曲要求
            </NTooltip>
          </NFlex>
        </template>
        <NFlex vertical>
          <NCheckbox
            :checked="model.options != null"
            @update:checked="(v: boolean) => model.options = v ? { needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption : undefined"
          >
            启用独立要求
          </NCheckbox>
          <template v-if="model.options">
            <NFlex :size="12">
              <NCheckbox v-model:checked="model.options!.needJianzhang">
                舰长
              </NCheckbox>
              <NCheckbox v-model:checked="model.options!.needTidu">
                提督
              </NCheckbox>
              <NCheckbox v-model:checked="model.options!.needZongdu">
                总督
              </NCheckbox>
            </NFlex>
            <NFlex align="center" :size="8">
              <NCheckbox
                :checked="model.options!.scMinPrice != null"
                @update:checked="(v: boolean) => model.options!.scMinPrice = v ? 30 : undefined"
              >
                SC
              </NCheckbox>
              <NInputGroup v-if="model.options!.scMinPrice != null" style="width: auto;">
                <NInputGroupLabel size="small">
                  ≥
                </NInputGroupLabel>
                <NInputNumber v-model:value="model.options!.scMinPrice" :min="1" size="small" style="width: 80px;" />
                <NInputGroupLabel size="small">
                  元
                </NInputGroupLabel>
              </NInputGroup>
            </NFlex>
            <NFlex align="center" :size="8">
              <NCheckbox
                :checked="model.options!.fanMedalMinLevel != null"
                @update:checked="(v: boolean) => model.options!.fanMedalMinLevel = v ? 1 : undefined"
              >
                粉丝牌
              </NCheckbox>
              <NInputGroup v-if="model.options!.fanMedalMinLevel != null" style="width: auto;">
                <NInputGroupLabel size="small">
                  ≥
                </NInputGroupLabel>
                <NInputNumber v-model:value="model.options!.fanMedalMinLevel" :min="1" size="small" style="width: 80px;" />
                <NInputGroupLabel size="small">
                  级
                </NInputGroupLabel>
              </NInputGroup>
            </NFlex>
          </template>
        </NFlex>
      </NFormItem>
      <NFormItem path="url" label="链接">
        <NInput
          v-model:value="model.url" placeholder="可选，音频链接可试听"
          clearable :disabled="model.from !== SongFrom.Custom"
        />
      </NFormItem>
    </NForm>
    <template #footer>
      <NFlex justify="end">
        <NButton @click="show = false">
          取消
        </NButton>
        <NButton type="primary" :loading="loading" @click="handleSave">
          确认更新
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>
