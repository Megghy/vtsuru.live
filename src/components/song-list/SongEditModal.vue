<script setup lang="ts">
import { ref } from 'vue'

import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'

interface SelectItem {
  label: string
  value: string
}

defineProps<{
  languageOptions: SelectItem[]
  tagOptions: SelectItem[]
  authorOptions: SelectItem[]
}>()

const emit = defineEmits<{
  save: [song: SongsInfo]
}>()

const show = ref(false)
const model = ref<SongsInfo>({} as SongsInfo)
const loading = ref(false)
const nameError = ref('')

function open(song: SongsInfo) {
  model.value = structuredClone(song)
  nameError.value = ''
  show.value = true
}

function handleSave() {
  if (!model.value.name.trim()) {
    nameError.value = '请输入歌曲名称'
    return
  }

  loading.value = true
  emit('save', model.value)
}

function setOptionEnabled(value: boolean | string) {
  model.value.options =
    value === true ? ({ needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption) : undefined
}

function setMinimumEnabled(field: 'scMinPrice' | 'fanMedalMinLevel', value: boolean | string) {
  if (!model.value.options) return
  model.value.options[field] = value === true ? (field === 'scMinPrice' ? 30 : 1) : undefined
}

function close() {
  show.value = false
  loading.value = false
}

defineExpose({ open, close, loading })
</script>

<template>
  <UModal
    v-model:open="show"
    :title="`修改 - ${model.name}`"
    :dismissible="false"
    :ui="{ content: 'max-w-[min(600px,calc(100vw-32px))]' }"
  >
    <template #body>
      <div class="song-edit-modal__form">
        <UFormField
          label="名称"
          :error="nameError"
        >
          <UInput
            v-model="model.name"
            placeholder="歌曲名称"
            @update:model-value="nameError = ''"
          />
        </UFormField>
        <UFormField label="翻译名称">
          <UInput
            v-model="model.translateName"
            placeholder="可选，翻译/别名"
          />
        </UFormField>
        <UFormField label="作者">
          <USelectMenu
            v-model="model.author"
            :items="authorOptions"
            value-key="value"
            placeholder="选择或输入，回车确认"
            multiple
            create-item
            clear
          />
        </UFormField>
        <UFormField label="备注">
          <UTextarea
            v-model="model.description"
            placeholder="可选"
            :maxlength="250"
            autoresize
          />
        </UFormField>
        <UFormField label="语言">
          <USelectMenu
            v-model="model.language"
            :items="languageOptions"
            value-key="value"
            placeholder="选择或输入，回车确认"
            multiple
            create-item
            clear
          />
        </UFormField>
        <UFormField label="标签">
          <USelectMenu
            v-model="model.tags"
            :items="tagOptions"
            value-key="value"
            placeholder="选择或输入，回车确认"
            multiple
            create-item
            clear
          />
        </UFormField>
        <UFormField label="点歌要求">
          <div class="song-edit-modal__requirements">
            <p>
              启用后将覆盖全局点歌设置，用于单独设置歌曲要求
              <UTooltip text="启用后将覆盖全局点歌设置，用于单独设置歌曲要求">
                <UIcon name="i-lucide-info" />
              </UTooltip>
            </p>
            <UCheckbox
              :model-value="model.options != null"
              label="启用独立要求"
              @update:model-value="setOptionEnabled"
            />
            <template v-if="model.options">
              <div class="song-edit-modal__checkboxes">
                <UCheckbox
                  v-model="model.options.needJianzhang"
                  label="舰长"
                />
                <UCheckbox
                  v-model="model.options.needTidu"
                  label="提督"
                />
                <UCheckbox
                  v-model="model.options.needZongdu"
                  label="总督"
                />
              </div>
              <div class="song-edit-modal__requirement-row">
                <UCheckbox
                  :model-value="model.options.scMinPrice != null"
                  label="SC"
                  @update:model-value="setMinimumEnabled('scMinPrice', $event)"
                />
                <UFieldGroup v-if="model.options.scMinPrice != null">
                  <span class="song-edit-modal__addon">≥</span>
                  <UInputNumber
                    v-model="model.options.scMinPrice"
                    :min="1"
                  />
                  <span class="song-edit-modal__addon">元</span>
                </UFieldGroup>
              </div>
              <div class="song-edit-modal__requirement-row">
                <UCheckbox
                  :model-value="model.options.fanMedalMinLevel != null"
                  label="粉丝牌"
                  @update:model-value="setMinimumEnabled('fanMedalMinLevel', $event)"
                />
                <UFieldGroup v-if="model.options.fanMedalMinLevel != null">
                  <span class="song-edit-modal__addon">≥</span>
                  <UInputNumber
                    v-model="model.options.fanMedalMinLevel"
                    :min="1"
                  />
                  <span class="song-edit-modal__addon">级</span>
                </UFieldGroup>
              </div>
            </template>
          </div>
        </UFormField>
        <UFormField label="链接">
          <UInput
            v-model="model.url"
            placeholder="可选，音频链接可试听"
            :disabled="model.from !== SongFrom.Custom"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="song-edit-modal__footer">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="close"
        />
        <UButton
          color="primary"
          :loading="loading"
          label="确认更新"
          @click="handleSave"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.song-edit-modal__form,
.song-edit-modal__requirements {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.song-edit-modal__requirements p {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}

.song-edit-modal__checkboxes,
.song-edit-modal__requirement-row,
.song-edit-modal__footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.song-edit-modal__footer {
  justify-content: flex-end;
}

.song-edit-modal__addon {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
</style>
