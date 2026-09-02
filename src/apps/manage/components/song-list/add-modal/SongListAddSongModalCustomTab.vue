<script setup lang="ts">
import { Info24Filled } from '@vicons/fluent'
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import {
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
  NSelect,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'

const props = defineProps<{
  existingSongs: SongsInfo[]
  authors: SelectOption[]
  tags: SelectOption[]
  songSelectOption: SelectOption[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
  (e: 'loadingChange', value: boolean): void
  (e: 'resetRender'): void
}>()

const message = useMessage()

const formRef = ref<FormInst | null>(null)
const addSongModel = ref<SongsInfo>({} as SongsInfo)
const onlyResetNameOnAdded = ref(true)

const addSongRules: FormRules = {
  name: [{ required: true, message: '请输入歌曲名称' }],
  password: [{ required: true, message: '请输入密码' }],
}

defineExpose({
  add: addCustomSong,
  canAdd: computed(() => Boolean(addSongModel.value.name?.trim())),
  resetAll: () => resetAddingSong(),
  resetName: () => resetAddingSong(true),
  onlyResetNameOnAdded,
})

function resetAddingSong(onlyName = false) {
  if (onlyName) {
    addSongModel.value.name = ''
    addSongModel.value.description = ''
  } else {
    addSongModel.value = {} as SongsInfo
  }

  emit('resetRender')
  message.success('已重置')
}

async function addCustomSong() {
  if (props.existingSongs.findIndex((s) => s.name === addSongModel.value.name) > -1) {
    message.error('已存在相同名称的歌曲')
    return
  }

  emit('loadingChange', true)
  try {
    await formRef.value?.validate()
    const result = await addSongsToSongList([addSongModel.value], SongFrom.Custom)
    if (result.code !== 200) {
      message.error(`添加失败: ${result.message}`)
      return
    }

    if (result.data.length !== 1) {
      message.error('未能添加歌曲, 已存在相同名称的曲目')
      return
    }

    message.success(`成功添加歌曲: ${addSongModel.value.name}`)
    emit('added', result.data)
    resetAddingSong(onlyResetNameOnAdded.value)
  } catch (err) {
    console.error(err)
    message.error('添加失败')
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <NForm
    ref="formRef"
    :rules="addSongRules"
    :model="addSongModel"
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
            v-model:value="addSongModel.name"
            placeholder="请输入歌曲名称"
            maxlength="200"
            :status="existingSongs.findIndex((s) => s.name === addSongModel.name) > -1 ? 'error' : undefined"
          />
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem
          path="author"
          label="作者 (可多选)"
        >
          <NSelect
            v-model:value="addSongModel.author"
            :options="authors"
            filterable
            multiple
            tag
            placeholder="输入后按回车新增"
          />
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem
          path="language"
          label="语言 (可多选)"
        >
          <NSelect
            v-model:value="addSongModel.language"
            filterable
            multiple
            clearable
            tag
            placeholder="可选，输入后按回车新增"
            :options="songSelectOption"
          />
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem
          path="tags"
          label="标签 (可多选)"
        >
          <NSelect
            v-model:value="addSongModel.tags"
            filterable
            multiple
            clearable
            tag
            placeholder="可选，输入后按回车新增"
            :options="tags"
          />
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem
          path="url"
          label="试听 / 伴奏链接"
        >
          <NInput
            v-model:value="addSongModel.url"
            placeholder="可选，音频直链可直接播放"
          />
        </NFormItem>
      </NGridItem>
      <NGridItem>
        <NFormItem
          path="description"
          label="备注说明"
        >
          <NInput
            v-model:value="addSongModel.description"
            placeholder="可选备注说明"
            :maxlength="250"
            show-count
            clearable
          />
        </NFormItem>
      </NGridItem>
      <NGridItem :span="2">
        <NFormItem path="options">
          <template #label>
            <NFlex
              align="center"
              :gap="4"
            >
              <span>独立点歌门槛设置</span>
              <NTooltip>
                <template #trigger>
                  <NIcon
                    :component="Info24Filled"
                    style="cursor: pointer; color: var(--vtsuru-fg-muted)"
                  />
                </template>
                启用后将覆盖全局点歌要求，单独控制本首歌曲的点歌门槛。
              </NTooltip>
            </NFlex>
          </template>
          <NFlex
            vertical
            :gap="10"
            style="width: 100%"
          >
            <NCheckbox
              :checked="addSongModel.options != null"
              @update:checked="
                (checked: boolean) => {
                  addSongModel.options = checked
                    ? ({
                        needJianzhang: false,
                        needTidu: false,
                        needZongdu: false,
                      } as SongRequestOption)
                    : undefined
                }
              "
            >
              为本首歌曲单独设置点歌门槛
            </NCheckbox>
            <div
              v-if="addSongModel.options != null"
              style="padding: 12px; border-radius: var(--vtsuru-radius); background-color: var(--vtsuru-bg-inset)"
            >
              <NFlex
                vertical
                :gap="12"
              >
                <NFlex :gap="16">
                  <NCheckbox v-model:checked="addSongModel.options.needJianzhang"> 要求舰长 </NCheckbox>
                  <NCheckbox v-model:checked="addSongModel.options.needTidu"> 要求提督 </NCheckbox>
                  <NCheckbox v-model:checked="addSongModel.options.needZongdu"> 要求总督 </NCheckbox>
                </NFlex>
                <NGrid
                  cols="1 s:2"
                  :x-gap="16"
                  :y-gap="8"
                >
                  <NGridItem>
                    <NFlex
                      align="center"
                      :gap="8"
                    >
                      <NCheckbox
                        :checked="addSongModel.options.scMinPrice != null"
                        @update:checked="
                          (checked: boolean) => {
                            if (addSongModel.options) addSongModel.options.scMinPrice = checked ? 30 : undefined
                          }
                        "
                      >
                        需要 SC
                      </NCheckbox>
                      <NInputGroup
                        v-if="addSongModel.options?.scMinPrice"
                        style="width: 180px"
                      >
                        <NInputGroupLabel>最低金额</NInputGroupLabel>
                        <NInputNumber
                          v-model:value="addSongModel.options.scMinPrice"
                          :min="30"
                          style="width: 100%"
                        />
                      </NInputGroup>
                    </NFlex>
                  </NGridItem>
                  <NGridItem>
                    <NFlex
                      align="center"
                      :gap="8"
                    >
                      <NCheckbox
                        :checked="addSongModel.options.fanMedalMinLevel != null"
                        @update:checked="
                          (checked: boolean) => {
                            if (addSongModel.options) addSongModel.options.fanMedalMinLevel = checked ? 5 : undefined
                          }
                        "
                      >
                        需要粉丝牌
                      </NCheckbox>
                      <NInputGroup
                        v-if="addSongModel.options?.fanMedalMinLevel"
                        style="width: 180px"
                      >
                        <NInputGroupLabel>最低等级</NInputGroupLabel>
                        <NInputNumber
                          v-model:value="addSongModel.options.fanMedalMinLevel"
                          :min="0"
                          style="width: 100%"
                        />
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
</template>
