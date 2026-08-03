<script setup lang="ts">
import { ref } from 'vue'

import type { SongRequestOption } from '@/api/api-models'

interface SelectItem {
  label: string
  value: string
}

type BatchTab = 'author' | 'tag' | 'language' | 'option' | 'delete'
type UpdateMode = 'replace' | 'append'

defineProps<{
  selectedCount: number
  languageOptions: SelectItem[]
  tagOptions: SelectItem[]
  authorOptions: SelectItem[]
}>()

const emit = defineEmits<{
  delete: []
  updateAuthor: [value: string[], mode: UpdateMode]
  updateTag: [value: string[], mode: UpdateMode]
  updateLanguage: [value: string[], mode: UpdateMode]
  updateOption: [value: SongRequestOption | undefined]
}>()

const toast = useToast()
const show = ref(false)
const activeTab = ref<BatchTab>('author')
const batchAuthor = ref<string[]>([])
const batchTag = ref<string[]>([])
const batchLanguage = ref<string[]>([])
const batchOption = ref<SongRequestOption>()
const authorMode = ref<UpdateMode>('append')
const tagMode = ref<UpdateMode>('append')
const languageMode = ref<UpdateMode>('append')

function open() {
  show.value = true
}

function close() {
  show.value = false
}

function ensureValues(values: string[], label: string) {
  if (values.length === 0) {
    toast.add({ title: `请选择${label}`, color: 'warning' })
    return false
  }

  return true
}

function updateAuthors() {
  if (!ensureValues(batchAuthor.value, '作者')) return
  emit('updateAuthor', batchAuthor.value, authorMode.value)
  batchAuthor.value = []
}

function updateTags() {
  if (!ensureValues(batchTag.value, '标签')) return
  emit('updateTag', batchTag.value, tagMode.value)
  batchTag.value = []
}

function updateLanguages() {
  if (!ensureValues(batchLanguage.value, '语言')) return
  emit('updateLanguage', batchLanguage.value, languageMode.value)
  batchLanguage.value = []
}

function setOptionEnabled(value: boolean | string) {
  batchOption.value = value === true ? { needJianzhang: false, needTidu: false, needZongdu: false } : undefined
}

function setMinimumEnabled(field: 'scMinPrice' | 'fanMedalMinLevel', value: boolean | string) {
  if (!batchOption.value) return
  batchOption.value[field] = value === true ? (field === 'scMinPrice' ? 30 : 1) : undefined
}

function applyOption() {
  emit('updateOption', batchOption.value)
  batchOption.value = undefined
}

defineExpose({ open, close })
</script>

<template>
  <UModal
    v-model:open="show"
    :title="`批量操作 · 已选 ${selectedCount} 首`"
    :dismissible="false"
    :ui="{ content: 'max-w-[min(560px,calc(100vw-32px))]' }"
  >
    <template #body>
      <div
        class="song-batch-modal__tabs"
        role="tablist"
      >
        <UButton
          v-for="tab in [
            ['author', '作者'],
            ['tag', '标签'],
            ['language', '语言'],
            ['option', '点歌要求'],
            ['delete', '删除'],
          ] as const"
          :key="tab[0]"
          :color="activeTab === tab[0] ? (tab[0] === 'delete' ? 'error' : 'primary') : 'neutral'"
          :variant="activeTab === tab[0] ? 'soft' : 'ghost'"
          size="sm"
          :label="tab[1]"
          @click="activeTab = tab[0]"
        />
      </div>

      <div class="song-batch-modal__content">
        <template v-if="activeTab === 'author'">
          <div class="song-batch-modal__mode">
            <UButton
              :variant="authorMode === 'append' ? 'soft' : 'ghost'"
              size="sm"
              label="追加"
              @click="authorMode = 'append'"
            />
            <UButton
              :variant="authorMode === 'replace' ? 'soft' : 'ghost'"
              size="sm"
              label="替换"
              @click="authorMode = 'replace'"
            />
          </div>
          <USelectMenu
            v-model="batchAuthor"
            :items="authorOptions"
            value-key="value"
            placeholder="选择或输入作者"
            multiple
            create-item
            clear
          />
          <UButton
            label="应用"
            @click="updateAuthors"
          />
        </template>

        <template v-else-if="activeTab === 'tag'">
          <div class="song-batch-modal__mode">
            <UButton
              :variant="tagMode === 'append' ? 'soft' : 'ghost'"
              size="sm"
              label="追加"
              @click="tagMode = 'append'"
            />
            <UButton
              :variant="tagMode === 'replace' ? 'soft' : 'ghost'"
              size="sm"
              label="替换"
              @click="tagMode = 'replace'"
            />
          </div>
          <USelectMenu
            v-model="batchTag"
            :items="tagOptions"
            value-key="value"
            placeholder="选择或输入标签"
            multiple
            create-item
            clear
          />
          <UButton
            label="应用"
            @click="updateTags"
          />
        </template>

        <template v-else-if="activeTab === 'language'">
          <div class="song-batch-modal__mode">
            <UButton
              :variant="languageMode === 'append' ? 'soft' : 'ghost'"
              size="sm"
              label="追加"
              @click="languageMode = 'append'"
            />
            <UButton
              :variant="languageMode === 'replace' ? 'soft' : 'ghost'"
              size="sm"
              label="替换"
              @click="languageMode = 'replace'"
            />
          </div>
          <USelectMenu
            v-model="batchLanguage"
            :items="languageOptions"
            value-key="value"
            placeholder="选择或输入语言"
            multiple
            create-item
            clear
          />
          <UButton
            label="应用"
            @click="updateLanguages"
          />
        </template>

        <template v-else-if="activeTab === 'option'">
          <UCheckbox
            :model-value="batchOption != null"
            label="启用独立要求（将覆盖原有设置）"
            @update:model-value="setOptionEnabled"
          />
          <template v-if="batchOption">
            <div class="song-batch-modal__checkboxes">
              <UCheckbox
                v-model="batchOption.needJianzhang"
                label="舰长"
              />
              <UCheckbox
                v-model="batchOption.needTidu"
                label="提督"
              />
              <UCheckbox
                v-model="batchOption.needZongdu"
                label="总督"
              />
            </div>
            <div class="song-batch-modal__requirement-row">
              <UCheckbox
                :model-value="batchOption.scMinPrice != null"
                label="SC"
                @update:model-value="setMinimumEnabled('scMinPrice', $event)"
              />
              <UFieldGroup v-if="batchOption.scMinPrice != null">
                <span class="song-batch-modal__addon">≥</span>
                <UInputNumber
                  v-model="batchOption.scMinPrice"
                  :min="1"
                />
                <span class="song-batch-modal__addon">元</span>
              </UFieldGroup>
            </div>
            <div class="song-batch-modal__requirement-row">
              <UCheckbox
                :model-value="batchOption.fanMedalMinLevel != null"
                label="粉丝牌"
                @update:model-value="setMinimumEnabled('fanMedalMinLevel', $event)"
              />
              <UFieldGroup v-if="batchOption.fanMedalMinLevel != null">
                <span class="song-batch-modal__addon">≥</span>
                <UInputNumber
                  v-model="batchOption.fanMedalMinLevel"
                  :min="1"
                />
                <span class="song-batch-modal__addon">级</span>
              </UFieldGroup>
            </div>
          </template>
          <UButton
            label="应用"
            @click="applyOption"
          />
        </template>

        <template v-else>
          <UAlert
            color="error"
            variant="soft"
            title="删除不可恢复"
          >
            <template #description>确定要删除选中的 {{ selectedCount }} 首歌曲？</template>
          </UAlert>
          <UButton
            color="error"
            label="确认删除"
            @click="emit('delete')"
          />
        </template>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.song-batch-modal__tabs,
.song-batch-modal__mode,
.song-batch-modal__checkboxes,
.song-batch-modal__requirement-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.song-batch-modal__tabs {
  padding-bottom: 12px;
  border-bottom: 1px solid var(--vtsuru-border);
}

.song-batch-modal__content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.song-batch-modal__addon {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
</style>
