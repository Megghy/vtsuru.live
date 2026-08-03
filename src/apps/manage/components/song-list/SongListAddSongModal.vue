<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import SongListAddSongModalCustomTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalCustomTab.vue'
import SongListAddSongModalDirectoryTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalDirectoryTab.vue'
import SongListAddSongModalFileTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFileTab.vue'
import SongListAddSongModalFivesingTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFivesingTab.vue'
import SongListAddSongModalNeteaseTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalNeteaseTab.vue'
import type { SelectOption } from '@/shared/types/VTsuruConfigTypes'

type AddSongTab = 'custom' | 'netease' | 'fivesing' | 'file' | 'directory'

const props = defineProps<{
  show: boolean
  songs: SongsInfo[]
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  added: [songs: SongsInfo[]]
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})
const activeTab = ref<AddSongTab>('custom')
const modalRenderKey = ref(0)
const isModalLoading = ref(false)

const songSelectOption: SelectOption[] = [
  { label: '中文', value: '中文' },
  { label: '日语', value: '日语' },
  { label: '英语', value: '英语' },
  { label: '韩语', value: '韩语' },
  { label: '法语', value: '法语' },
  { label: '西语', value: '西语' },
  { label: '其他', value: '其他' },
]

function uniqueOptions(values: Iterable<string>): SelectOption[] {
  return [...new Set(values)].map((value) => ({ label: value, value }))
}

const authors = computed(() => uniqueOptions(props.songs.flatMap((song) => song.author)))
const tags = computed(() => uniqueOptions(props.songs.flatMap((song) => song.tags ?? [])))
const languageSelectOption = computed(() => uniqueOptions([...songSelectOption.map(({ value }) => String(value)), ...props.songs.flatMap((song) => song.language)]))

function onAdded(songs: SongsInfo[]) {
  emit('added', songs)
}

function onLoadingChange(value: boolean) {
  isModalLoading.value = value
}

function bumpRenderKey() {
  modalRenderKey.value += 1
}
</script>

<template>
  <UModal
    v-model:open="showModel"
    title="添加歌曲"
    :ui="{ content: 'max-w-[min(1000px,calc(100vw-32px))]' }"
  >
    <template #body>
      <div
        :key="modalRenderKey"
        class="song-add-modal"
        :aria-busy="isModalLoading"
      >
        <div class="song-add-modal__tabs" role="tablist">
          <UButton
            v-for="tab in [
              ['custom', '手动录入'],
              ['netease', '网易云歌单'],
              ['fivesing', '5sing 搜索'],
              ['file', '文件导入'],
              ['directory', '文件夹读取'],
            ] as const"
            :key="tab[0]"
            :label="tab[1]"
            size="sm"
            :variant="activeTab === tab[0] ? 'soft' : 'ghost'"
            @click="activeTab = tab[0]"
          />
        </div>
        <UProgress v-if="isModalLoading" animation="carousel" />
        <div class="song-add-modal__content">
          <SongListAddSongModalCustomTab
            v-if="activeTab === 'custom'"
            :existing-songs="songs"
            :authors="authors"
            :tags="tags"
            :song-select-option="songSelectOption"
            @added="onAdded"
            @loading-change="onLoadingChange"
            @reset-render="bumpRenderKey"
          />
          <SongListAddSongModalNeteaseTab
            v-else-if="activeTab === 'netease'"
            :existing-songs="songs"
            @added="onAdded"
            @loading-change="onLoadingChange"
          />
          <SongListAddSongModalFivesingTab
            v-else-if="activeTab === 'fivesing'"
            :existing-songs="songs"
            @added="onAdded"
            @loading-change="onLoadingChange"
          />
          <SongListAddSongModalFileTab
            v-else-if="activeTab === 'file'"
            :existing-songs="songs"
            @added="onAdded"
            @loading-change="onLoadingChange"
          />
          <SongListAddSongModalDirectoryTab
            v-else
            :existing-songs="songs"
            :authors="authors"
            :tags="tags"
            :language-select-option="languageSelectOption"
            @added="onAdded"
            @loading-change="onLoadingChange"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.song-add-modal { display: grid; gap: 16px; }
.song-add-modal__tabs { display: flex; flex-wrap: wrap; gap: 4px; }
.song-add-modal__content { max-height: min(70vh, 720px); overflow: auto; padding-right: 4px; }
</style>
