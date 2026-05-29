<script setup lang="ts">
import type { SelectOption } from 'naive-ui'
import type { SongRequestOption } from '@/api/api-models'
import {
  NButton, NCheckbox, NFlex, NInputGroup, NInputGroupLabel,
  NInputNumber, NModal, NRadioButton, NRadioGroup, NSelect, NTabPane, NTabs, NText,
  useMessage,
} from 'naive-ui'
import { ref } from 'vue'

const props = defineProps<{
  selectedCount: number
  languageOptions: SelectOption[]
  tagOptions: SelectOption[]
  authorOptions: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'delete'): void
  (e: 'updateAuthor', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateTag', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateLanguage', value: string[], mode: 'replace' | 'append'): void
  (e: 'updateOption', value: SongRequestOption | undefined): void
}>()

const message = useMessage()
const show = ref(false)

const batchAuthor = ref<string[]>([])
const batchTag = ref<string[]>([])
const batchLanguage = ref<string[]>([])
const batchOption = ref<SongRequestOption | undefined>()

const authorMode = ref<'replace' | 'append'>('append')
const tagMode = ref<'replace' | 'append'>('append')
const languageMode = ref<'replace' | 'append'>('append')

function open() { show.value = true }
function close() { show.value = false }

function handleUpdateAuthor() {
  if (batchAuthor.value.length === 0) { message.warning('请选择作者'); return }
  emit('updateAuthor', batchAuthor.value, authorMode.value)
  batchAuthor.value = []
}
function handleUpdateTag() {
  if (batchTag.value.length === 0) { message.warning('请选择标签'); return }
  emit('updateTag', batchTag.value, tagMode.value)
  batchTag.value = []
}
function handleUpdateLanguage() {
  if (batchLanguage.value.length === 0) { message.warning('请选择语言'); return }
  emit('updateLanguage', batchLanguage.value, languageMode.value)
  batchLanguage.value = []
}

function handleUpdateOption() {
  emit('updateOption', batchOption.value)
  batchOption.value = undefined
}

defineExpose({ open, close })
</script>

<template>
  <NModal
    v-model:show="show" preset="card" style="max-width: 560px;"
    :title="`批量操作 · 已选 ${selectedCount} 首`" :mask-closable="false"
  >
    <NTabs type="line" animated>
      <NTabPane name="author" tab="作者">
        <NFlex vertical :size="12">
          <NRadioGroup v-model:value="authorMode" size="small">
            <NRadioButton value="append">
              追加
            </NRadioButton>
            <NRadioButton value="replace">
              替换
            </NRadioButton>
          </NRadioGroup>
          <NSelect
            v-model:value="batchAuthor" :options="authorOptions"
            placeholder="选择或输入作者" filterable multiple tag clearable
          />
          <NButton type="primary" @click="handleUpdateAuthor">
            应用
          </NButton>
        </NFlex>
      </NTabPane>
      <NTabPane name="tag" tab="标签">
        <NFlex vertical :size="12">
          <NRadioGroup v-model:value="tagMode" size="small">
            <NRadioButton value="append">
              追加
            </NRadioButton>
            <NRadioButton value="replace">
              替换
            </NRadioButton>
          </NRadioGroup>
          <NSelect
            v-model:value="batchTag" :options="tagOptions"
            placeholder="选择或输入标签" filterable multiple tag clearable
          />
          <NButton type="primary" @click="handleUpdateTag">
            应用
          </NButton>
        </NFlex>
      </NTabPane>
      <NTabPane name="language" tab="语言">
        <NFlex vertical :size="12">
          <NRadioGroup v-model:value="languageMode" size="small">
            <NRadioButton value="append">
              追加
            </NRadioButton>
            <NRadioButton value="replace">
              替换
            </NRadioButton>
          </NRadioGroup>
          <NSelect
            v-model:value="batchLanguage" :options="languageOptions"
            placeholder="选择或输入语言" filterable multiple tag clearable
          />
          <NButton type="primary" @click="handleUpdateLanguage">
            应用
          </NButton>
        </NFlex>
      </NTabPane>
      <NTabPane name="option" tab="点歌要求">
        <NFlex vertical :size="12">
          <NCheckbox
            :checked="batchOption != null"
            @update:checked="(v: boolean) => batchOption = v ? { needJianzhang: false, needTidu: false, needZongdu: false } : undefined"
          >
            启用独立要求（将覆盖原有设置）
          </NCheckbox>
          <template v-if="batchOption">
            <NFlex :size="12">
              <NCheckbox v-model:checked="batchOption!.needJianzhang">
                舰长
              </NCheckbox>
              <NCheckbox v-model:checked="batchOption!.needTidu">
                提督
              </NCheckbox>
              <NCheckbox v-model:checked="batchOption!.needZongdu">
                总督
              </NCheckbox>
            </NFlex>
            <NFlex align="center" :size="8">
              <NCheckbox
                :checked="batchOption!.scMinPrice != null"
                @update:checked="(v: boolean) => batchOption!.scMinPrice = v ? 30 : undefined"
              >
                SC
              </NCheckbox>
              <NInputGroup v-if="batchOption!.scMinPrice != null" style="width: auto;">
                <NInputGroupLabel size="small">
                  ≥
                </NInputGroupLabel>
                <NInputNumber v-model:value="batchOption!.scMinPrice" :min="1" size="small" style="width: 80px;" />
                <NInputGroupLabel size="small">
                  元
                </NInputGroupLabel>
              </NInputGroup>
            </NFlex>
            <NFlex align="center" :size="8">
              <NCheckbox
                :checked="batchOption!.fanMedalMinLevel != null"
                @update:checked="(v: boolean) => batchOption!.fanMedalMinLevel = v ? 1 : undefined"
              >
                粉丝牌
              </NCheckbox>
              <NInputGroup v-if="batchOption!.fanMedalMinLevel != null" style="width: auto;">
                <NInputGroupLabel size="small">
                  ≥
                </NInputGroupLabel>
                <NInputNumber v-model:value="batchOption!.fanMedalMinLevel" :min="1" size="small" style="width: 80px;" />
                <NInputGroupLabel size="small">
                  级
                </NInputGroupLabel>
              </NInputGroup>
            </NFlex>
          </template>
          <NButton type="primary" @click="handleUpdateOption">
            应用
          </NButton>
        </NFlex>
      </NTabPane>
      <NTabPane name="delete" tab="删除">
        <NFlex vertical :size="12">
          <NText type="error">
            确定要删除选中的 {{ selectedCount }} 首歌曲？此操作不可恢复。
          </NText>
          <NButton type="error" @click="emit('delete')">
            确认删除
          </NButton>
        </NFlex>
      </NTabPane>
    </NTabs>
  </NModal>
</template>
