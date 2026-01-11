<script setup lang="ts">
import type { FormInst, FormRules, SelectOption } from 'naive-ui'
import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { Info24Filled } from '@vicons/fluent'
import {
  NButton,
  NCheckbox,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NSelect,
  NSpace,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { ref } from 'vue'
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
  if (props.existingSongs.findIndex(s => s.name === addSongModel.value.name) > -1) {
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
  <NForm ref="formRef" :rules="addSongRules" :model="addSongModel">
    <NFormItem path="name" label="名称">
      <NInput
        v-model:value="addSongModel.name"
        autosize
        style="min-width: 200px"
        placeholder="就是歌曲名称"
        :status="existingSongs.findIndex((s) => s.name === addSongModel.name) > -1 ? 'error' : 'success'"
      />
    </NFormItem>
    <NFormItem path="author" label="作者 (可多选)">
      <NSelect
        v-model:value="addSongModel.author"
        :options="authors"
        filterable
        multiple
        tag
        placeholder="输入后按回车新增"
      />
    </NFormItem>
    <NFormItem path="description" label="备注">
      <NInput
        v-model:value="addSongModel.description"
        placeholder="可选"
        :maxlength="250"
        show-count
        autosize
        style="min-width: 300px"
        clearable
      />
    </NFormItem>
    <NFormItem path="language" label="语言 (可多选)">
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
    <NFormItem path="tags" label="标签 (可多选)">
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
    <NFormItem path="url" label="链接">
      <NInput
        v-model:value="addSongModel.url"
        placeholder="可选, 后缀为mp3、wav、ogg时将会尝试播放, 否则会在新页面打开"
      />
    </NFormItem>
    <NFormItem path="options">
      <template #label>
        点歌设置
        <NTooltip>
          <template #trigger>
            <NIcon :component="Info24Filled" />
          </template>
          这个不是控制是否允许点歌的! 启用后将会覆盖点歌功能中的设置, 用于单独设置歌曲要求
        </NTooltip>
      </template>
      <NSpace vertical>
        <NCheckbox
          :checked="addSongModel.options !== undefined"
          @update:checked="(checked: boolean) => {
            addSongModel.options = checked
              ? ({
                needJianzhang: false,
                needTidu: false,
                needZongdu: false,
              } as SongRequestOption)
              : undefined
          }"
        >
          是否启用
        </NCheckbox>
        <template v-if="addSongModel.options !== undefined">
          <NSpace>
            <NCheckbox v-model:checked="addSongModel.options.needJianzhang">
              需要舰长
            </NCheckbox>
            <NCheckbox v-model:checked="addSongModel.options.needTidu">
              需要提督
            </NCheckbox>
            <NCheckbox v-model:checked="addSongModel.options.needZongdu">
              需要总督
            </NCheckbox>
          </NSpace>
          <NSpace align="center">
            <NCheckbox
              :checked="addSongModel.options.scMinPrice !== undefined"
              @update:checked="(checked: boolean) => {
                if (addSongModel.options) addSongModel.options.scMinPrice = checked ? 30 : undefined
              }"
            >
              需要SC
            </NCheckbox>
            <NInputGroup v-if="addSongModel.options?.scMinPrice" style="width: 200px">
              <NInputGroupLabel> SC最低价格 </NInputGroupLabel>
              <NInputNumber v-model:value="addSongModel.options.scMinPrice" min="30" />
            </NInputGroup>
          </NSpace>
          <NSpace align="center">
            <NCheckbox
              :checked="addSongModel.options.fanMedalMinLevel !== undefined"
              @update:checked="(checked: boolean) => {
                if (addSongModel.options) addSongModel.options.fanMedalMinLevel = checked ? 5 : undefined
              }"
            >
              需要粉丝牌
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" />
                </template>
                这个即使不开也会遵循全局点歌设置的粉丝牌等级
              </NTooltip>
            </NCheckbox>
            <NInputGroup v-if="addSongModel.options?.fanMedalMinLevel" style="width: 200px">
              <NInputGroupLabel> 最低等级 </NInputGroupLabel>
              <NInputNumber v-model:value="addSongModel.options.fanMedalMinLevel" min="0" />
            </NInputGroup>
          </NSpace>
        </template>
      </NSpace>
    </NFormItem>
  </NForm>
  <NFlex align="center">
    <NButton type="primary" @click="addCustomSong">
      添加
    </NButton>
    <NButton type="warning" @click="resetAddingSong()">
      还原
    </NButton>
    <NButton type="warning" @click="resetAddingSong(true)">
      还原(仅歌名和备注)
    </NButton>
    <NCheckbox v-model:checked="onlyResetNameOnAdded">
      添加完成时仅重置歌名和备注
    </NCheckbox>
  </NFlex>
</template>
