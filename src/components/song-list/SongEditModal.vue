<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import {
  NButton,
  NCheckbox,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NSelect,
  NTooltip,
} from 'naive-ui'
import { ref } from 'vue'

import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'

defineProps<{
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
  } catch {
    /* validation failed */
  }
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
    style="width: 680px; max-width: 95vw"
    :title="`修改歌曲 - ${model.name || ''}`"
    :mask-closable="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
  >
    <NForm
      ref="formRef"
      :rules="rules"
      :model="model"
      label-placement="top"
    >
      <NGrid
        cols="1 s:2"
        :x-gap="16"
        :y-gap="0"
      >
        <NGridItem>
          <NFormItem
            path="name"
            label="歌曲名称"
            required
          >
            <NInput
              v-model:value="model.name"
              placeholder="请输入歌曲名称"
              clearable
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem
            path="translateName"
            label="翻译 / 别名"
          >
            <NInput
              v-model:value="model.translateName"
              placeholder="可选翻译或别名"
              clearable
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem
            path="author"
            label="作者"
          >
            <NSelect
              v-model:value="model.author"
              :options="authorOptions"
              placeholder="选择或输入，回车确认"
              filterable
              multiple
              tag
              clearable
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem
            path="language"
            label="语言"
          >
            <NSelect
              v-model:value="model.language"
              :options="languageOptions"
              placeholder="选择或输入，回车确认"
              filterable
              multiple
              tag
              clearable
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem
            path="tags"
            label="标签"
          >
            <NSelect
              v-model:value="model.tags"
              :options="tagOptions"
              placeholder="选择或输入，回车确认"
              filterable
              multiple
              tag
              clearable
            />
          </NFormItem>
        </NGridItem>
        <NGridItem>
          <NFormItem
            path="url"
            label="试听 / 伴奏链接"
          >
            <NInput
              v-model:value="model.url"
              placeholder="可选，音频链接可试听"
              clearable
              :disabled="model.from !== SongFrom.Custom"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem :span="2">
          <NFormItem
            path="description"
            label="备注说明"
          >
            <NInput
              v-model:value="model.description"
              type="textarea"
              placeholder="可选备注说明"
              :maxlength="250"
              show-count
              clearable
              :rows="2"
            />
          </NFormItem>
        </NGridItem>
        <NGridItem :span="2">
          <NFormItem path="options">
            <template #label>
              <NFlex
                align="center"
                :size="4"
              >
                <span>独立点歌门槛设置</span>
                <NTooltip>
                  <template #trigger>
                    <NIcon
                      :component="Info24Filled"
                      style="cursor: help; color: var(--vtsuru-fg-muted)"
                    />
                  </template>
                  启用后将覆盖全局点歌设置，用于单独设置歌曲要求
                </NTooltip>
              </NFlex>
            </template>
            <NFlex
              vertical
              :gap="10"
              style="width: 100%"
            >
              <NCheckbox
                :checked="model.options != null"
                @update:checked="
                  (v: boolean) =>
                    (model.options = v
                      ? ({ needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption)
                      : undefined)
                "
              >
                为本首歌曲单独设置点歌门槛
              </NCheckbox>
              <div
                v-if="model.options"
                style="padding: 12px; border-radius: var(--vtsuru-radius); background-color: var(--vtsuru-bg-inset)"
              >
                <NFlex
                  vertical
                  :gap="12"
                >
                  <NFlex :size="16">
                    <NCheckbox v-model:checked="model.options!.needJianzhang"> 舰长 </NCheckbox>
                    <NCheckbox v-model:checked="model.options!.needTidu"> 提督 </NCheckbox>
                    <NCheckbox v-model:checked="model.options!.needZongdu"> 总督 </NCheckbox>
                  </NFlex>
                  <NGrid
                    cols="1 s:2"
                    :x-gap="16"
                    :y-gap="8"
                  >
                    <NGridItem>
                      <NFlex
                        align="center"
                        :size="8"
                      >
                        <NCheckbox
                          :checked="model.options!.scMinPrice != null"
                          @update:checked="(v: boolean) => (model.options!.scMinPrice = v ? 30 : undefined)"
                        >
                          需要 SC
                        </NCheckbox>
                        <NInputGroup
                          v-if="model.options!.scMinPrice != null"
                          style="width: 160px"
                        >
                          <NInputGroupLabel size="small"> ≥ </NInputGroupLabel>
                          <NInputNumber
                            v-model:value="model.options!.scMinPrice"
                            :min="1"
                            size="small"
                            style="width: 100%"
                          />
                          <NInputGroupLabel size="small"> 元 </NInputGroupLabel>
                        </NInputGroup>
                      </NFlex>
                    </NGridItem>
                    <NGridItem>
                      <NFlex
                        align="center"
                        :size="8"
                      >
                        <NCheckbox
                          :checked="model.options!.fanMedalMinLevel != null"
                          @update:checked="(v: boolean) => (model.options!.fanMedalMinLevel = v ? 1 : undefined)"
                        >
                          需要粉丝牌
                        </NCheckbox>
                        <NInputGroup
                          v-if="model.options!.fanMedalMinLevel != null"
                          style="width: 160px"
                        >
                          <NInputGroupLabel size="small"> ≥ </NInputGroupLabel>
                          <NInputNumber
                            v-model:value="model.options!.fanMedalMinLevel"
                            :min="1"
                            size="small"
                            style="width: 100%"
                          />
                          <NInputGroupLabel size="small"> 级 </NInputGroupLabel>
                        </NInputGroup>
                      </NFlex>
                    </NGridItem>
                  </NGrid>
                </NFlex>
              </div>
            </NFlex>
          </NFormItem>
        </NGridItem>
      </NGrid>
    </NForm>
    <template #footer>
      <NFlex
        justify="end"
        :gap="12"
      >
        <NButton
          secondary
          @click="show = false"
        >
          取消
        </NButton>
        <NButton
          type="primary"
          :loading="loading"
          @click="handleSave"
        >
          确认保存
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>
