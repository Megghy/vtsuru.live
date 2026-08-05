<script setup lang="ts">
import { Bot24Regular } from '@vicons/fluent'
import { NAlert, NButton, NFlex, NIcon, NModal, NScrollbar, NSpin, NTabPane, NTabs } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { SongsInfo } from '@/api/api-models'
import { useAssistantStore } from '@/apps/assistant/store/useAssistantStore'
import SongListAddSongModalCustomTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalCustomTab.vue'
import SongListAddSongModalDirectoryTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalDirectoryTab.vue'
import SongListAddSongModalFileTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFileTab.vue'
import SongListAddSongModalFivesingTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalFivesingTab.vue'
import SongListAddSongModalNeteaseTab from '@/apps/manage/components/song-list/add-modal/SongListAddSongModalNeteaseTab.vue'

const props = defineProps<{
  show: boolean
  songs: SongsInfo[]
}>()

const route = useRoute()
const assistant = useAssistantStore()

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'added', songs: SongsInfo[]): void
}>()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const modalRenderKey = ref(0)
const isModalLoading = ref(false)

const songSelectOption = [
  { label: '中文', value: '中文' },
  { label: '日语', value: '日语' },
  { label: '英语', value: '英语' },
  { label: '韩语', value: '韩语' },
  { label: '法语', value: '法语' },
  { label: '西语', value: '西语' },
  { label: '其他', value: '其他' },
]

const authors = computed(() => {
  const items = new Set<string>()
  props.songs.forEach((s) => {
    s?.author?.forEach((a) => items.add(a))
  })
  return [...items].map((t) => ({ label: t, value: t }))
})

const tags = computed(() => {
  const items = new Set<string>()
  props.songs.forEach((s) => {
    s?.tags?.forEach((t) => items.add(t))
  })
  return [...items].map((t) => ({ label: t, value: t }))
})

const languageSelectOption = computed(() => {
  const items = new Set<string>(songSelectOption.map((s) => s.label))
  props.songs.forEach((s) => {
    s?.language?.forEach((l) => items.add(l))
  })
  return [...items].map((t) => ({ label: t, value: t }))
})

function onAdded(songs: SongsInfo[]) {
  emit('added', songs)
}

function onLoadingChange(value: boolean) {
  isModalLoading.value = value
}

function bumpRenderKey() {
  modalRenderKey.value++
}

function openAssistant() {
  showModel.value = false
  assistant.open({
    routeName: route.name?.toString() ?? '',
    title: (route.meta?.title as string) ?? route.name?.toString() ?? '歌单管理',
    path: route.path,
  })
}
</script>

<template>
  <NModal
    :key="modalRenderKey"
    v-model:show="showModel"
    style="max-width: 1000px"
    preset="card"
  >
    <template #header> 添加歌曲 </template>
    <NScrollbar style="max-height: 80vh">
      <NSpin :show="isModalLoading">
        <NAlert
          title="也可以使用 VTsuru 助手"
          type="info"
          :bordered="false"
          style="margin-bottom: 12px"
        >
          <NFlex
            align="center"
            justify="space-between"
          >
            <span>上传歌曲信息截图，或直接粘贴歌曲信息，Agent 会自动识别并生成添加操作。</span>
            <NButton
              type="primary"
              secondary
              size="small"
              @click="openAssistant"
            >
              <template #icon>
                <NIcon :component="Bot24Regular" />
              </template>
              打开助手
            </NButton>
          </NFlex>
        </NAlert>
        <NTabs
          default-value="custom"
          animated
        >
          <NTabPane
            name="custom"
            tab="手动录入"
          >
            <SongListAddSongModalCustomTab
              :existing-songs="songs"
              :authors="authors"
              :tags="tags"
              :song-select-option="songSelectOption"
              @added="onAdded"
              @loading-change="onLoadingChange"
              @reset-render="bumpRenderKey"
            />
          </NTabPane>
          <NTabPane
            name="netease"
            tab="从网易云歌单导入"
          >
            <SongListAddSongModalNeteaseTab
              :existing-songs="songs"
              @added="onAdded"
              @loading-change="onLoadingChange"
            />
          </NTabPane>
          <NTabPane
            name="5sing"
            tab="从5sing搜索"
          >
            <SongListAddSongModalFivesingTab
              :existing-songs="songs"
              @added="onAdded"
              @loading-change="onLoadingChange"
            />
          </NTabPane>
          <NTabPane
            name="file"
            tab="从文件导入"
          >
            <SongListAddSongModalFileTab
              :existing-songs="songs"
              @added="onAdded"
              @loading-change="onLoadingChange"
            />
          </NTabPane>
          <NTabPane
            name="directory"
            tab="从文件夹读取"
          >
            <SongListAddSongModalDirectoryTab
              :existing-songs="songs"
              :authors="authors"
              :tags="tags"
              :language-select-option="languageSelectOption"
              @added="onAdded"
              @loading-change="onLoadingChange"
            />
          </NTabPane>
        </NTabs>
      </NSpin>
    </NScrollbar>
  </NModal>
</template>
