<script setup lang="ts">
import { ref } from 'vue'

import type { SongRequestOption, SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import type { SelectOption } from '@/shared/types/VTsuruConfigTypes'

const props = defineProps<{
  existingSongs: SongsInfo[]
  authors: SelectOption[]
  tags: SelectOption[]
  songSelectOption: SelectOption[]
}>()

const emit = defineEmits<{
  added: [songs: SongsInfo[]]
  loadingChange: [value: boolean]
  resetRender: []
}>()

const toast = useToast()
const onlyResetNameOnAdded = ref(true)

function createSong(): SongsInfo {
  return {
    id: 0,
    key: '',
    name: '',
    author: [],
    url: '',
    from: SongFrom.Custom,
    language: [],
    tags: [],
    createTime: Date.now(),
    updateTime: Date.now(),
  }
}

const addSongModel = ref(createSong())

function resetAddingSong(onlyName = false) {
  if (onlyName) {
    addSongModel.value.name = ''
    addSongModel.value.description = ''
  } else {
    addSongModel.value = createSong()
  }
  emit('resetRender')
  toast.add({ title: '已重置', color: 'success' })
}

function setOptions(value: boolean | string) {
  addSongModel.value.options = value === true
    ? { needJianzhang: false, needTidu: false, needZongdu: false } as SongRequestOption
    : undefined
}

function setMinimum(field: 'scMinPrice' | 'fanMedalMinLevel', value: boolean | string) {
  if (!addSongModel.value.options) return
  addSongModel.value.options[field] = value === true ? (field === 'scMinPrice' ? 30 : 5) : undefined
}

async function addCustomSong() {
  const song = addSongModel.value
  if (!song.name.trim()) {
    toast.add({ title: '请输入歌曲名称', color: 'warning' })
    return
  }
  if (props.existingSongs.some((item) => item.name === song.name)) {
    toast.add({ title: '已存在相同名称的歌曲', color: 'error' })
    return
  }

  emit('loadingChange', true)
  try {
    const result = await addSongsToSongList([song], SongFrom.Custom)
    if (result.code !== 200) throw new Error(result.message)
    if (result.data.length !== 1) {
      toast.add({ title: '未能添加歌曲，可能已存在同名曲目', color: 'warning' })
      return
    }
    toast.add({ title: `成功添加歌曲：${song.name}`, color: 'success' })
    emit('added', result.data)
    resetAddingSong(onlyResetNameOnAdded.value)
  } catch (error) {
    toast.add({ title: `添加失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <form class="song-custom-form" @submit.prevent="addCustomSong">
    <UFormField label="名称" required>
      <UInput v-model="addSongModel.name" placeholder="歌曲名称" :color="existingSongs.some((song) => song.name === addSongModel.name) ? 'error' : undefined" />
    </UFormField>
    <UFormField label="作者">
      <USelectMenu v-model="addSongModel.author" :items="authors" value-key="value" placeholder="选择或输入作者，回车确认" multiple create-item clear />
    </UFormField>
    <UFormField label="备注">
      <UTextarea v-model="addSongModel.description" placeholder="可选" maxlength="250" autoresize />
    </UFormField>
    <UFormField label="语言">
      <USelectMenu v-model="addSongModel.language" :items="songSelectOption" value-key="value" placeholder="选择或输入语言，回车确认" multiple create-item clear />
    </UFormField>
    <UFormField label="标签">
      <USelectMenu v-model="addSongModel.tags" :items="tags" value-key="value" placeholder="选择或输入标签，回车确认" multiple create-item clear />
    </UFormField>
    <UFormField label="链接">
      <UInput v-model="addSongModel.url" placeholder="可选，音频链接会直接播放，其他链接会在新页面打开" />
    </UFormField>
    <UFormField label="点歌设置" hint="启用后覆盖该歌曲的全局点歌要求。">
      <div class="song-custom-form__requirements">
        <UCheckbox :model-value="addSongModel.options != null" label="启用独立要求" @update:model-value="setOptions" />
        <template v-if="addSongModel.options">
          <div class="song-custom-form__checks">
            <UCheckbox v-model="addSongModel.options.needJianzhang" label="需要舰长" />
            <UCheckbox v-model="addSongModel.options.needTidu" label="需要提督" />
            <UCheckbox v-model="addSongModel.options.needZongdu" label="需要总督" />
          </div>
          <div class="song-custom-form__minimum">
            <UCheckbox :model-value="addSongModel.options.scMinPrice != null" label="需要 SC" @update:model-value="setMinimum('scMinPrice', $event)" />
            <UInputNumber v-if="addSongModel.options.scMinPrice != null" v-model="addSongModel.options.scMinPrice" :min="30" />
          </div>
          <div class="song-custom-form__minimum">
            <UCheckbox :model-value="addSongModel.options.fanMedalMinLevel != null" label="需要粉丝牌" @update:model-value="setMinimum('fanMedalMinLevel', $event)" />
            <UInputNumber v-if="addSongModel.options.fanMedalMinLevel != null" v-model="addSongModel.options.fanMedalMinLevel" :min="0" />
          </div>
        </template>
      </div>
    </UFormField>
    <div class="song-custom-form__actions">
      <UButton type="submit" label="添加" />
      <UButton color="warning" variant="soft" label="还原" @click="resetAddingSong()" />
      <UButton color="warning" variant="ghost" label="仅还原歌名和备注" @click="resetAddingSong(true)" />
      <UCheckbox v-model="onlyResetNameOnAdded" label="添加后仅重置歌名和备注" />
    </div>
  </form>
</template>

<style scoped>
.song-custom-form, .song-custom-form__requirements { display: grid; gap: 14px; }
.song-custom-form__checks, .song-custom-form__actions, .song-custom-form__minimum { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.song-custom-form__minimum :deep(.w-full) { width: 140px; }
</style>
