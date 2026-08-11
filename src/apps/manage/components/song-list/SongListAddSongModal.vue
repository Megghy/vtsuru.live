<script setup lang="ts">
import { Bot24Regular } from '@vicons/fluent'
import { NAlert, NButton, NCheckbox, NFlex, NIcon, NModal, NScrollbar, NSpin, NTabPane, NTabs, NText } from 'naive-ui'
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

const emit = defineEmits<{
  (e: 'update:show', value: boolean): void
  (e: 'added', songs: SongsInfo[]): void
}>()

const route = useRoute()
const assistant = useAssistantStore()

const showModel = computed({
  get: () => props.show,
  set: (value) => emit('update:show', value),
})

const modalRenderKey = ref(0)
const isModalLoading = ref(false)

const activeTab = ref('custom')

type FooterTabRef =
  | InstanceType<typeof SongListAddSongModalCustomTab>
  | InstanceType<typeof SongListAddSongModalNeteaseTab>
  | InstanceType<typeof SongListAddSongModalFileTab>
  | InstanceType<typeof SongListAddSongModalDirectoryTab>

const customTabRef = ref<InstanceType<typeof SongListAddSongModalCustomTab>>()
const neteaseTabRef = ref<InstanceType<typeof SongListAddSongModalNeteaseTab>>()
const fileTabRef = ref<InstanceType<typeof SongListAddSongModalFileTab>>()
const directoryTabRef = ref<InstanceType<typeof SongListAddSongModalDirectoryTab>>()

const footerConfig = computed<{ hint: string; tab: FooterTabRef | null }>(() => {
  switch (activeTab.value) {
    case 'custom':
      return { hint: '填写上方表单后点击添加', tab: customTabRef.value }
    case 'netease':
      return { hint: '选择歌曲后添加到歌单', tab: neteaseTabRef.value }
    case 'file':
      return { hint: '解析文件后在右侧勾选歌曲', tab: fileTabRef.value }
    case 'directory':
      return { hint: '扫描文件夹后在右侧勾选歌曲', tab: directoryTabRef.value }
    default:
      return { hint: '在搜索结果表格中点击"添加"按钮将单曲加入歌单', tab: null }
  }
})

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
    <NScrollbar style="max-height: calc(80vh - 120px)">
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
          v-model:value="activeTab"
          default-value="custom"
          animated
        >
          <NTabPane
            name="custom"
            tab="手动录入"
          >
            <SongListAddSongModalCustomTab
              ref="customTabRef"
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
              ref="neteaseTabRef"
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
              ref="fileTabRef"
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
              ref="directoryTabRef"
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
    <template #footer>
      <NFlex
        v-if="footerConfig"
        align="center"
        justify="space-between"
      >
        <NText depth="3">{{ footerConfig.hint }}</NText>
        <NFlex
          v-if="activeTab === 'custom' && customTabRef"
          align="center"
        >
          <NCheckbox v-model:checked="customTabRef.onlyResetNameOnAdded">
            添加完成时仅重置歌名和备注
          </NCheckbox>
          <NButton @click="customTabRef.resetAll()"> 还原 </NButton>
          <NButton @click="customTabRef.resetName()"> 还原(仅歌名和备注) </NButton>
          <NButton
            type="primary"
            :disabled="!customTabRef.canAdd"
            :loading="isModalLoading"
            @click="customTabRef.add()"
          >
            添加歌曲
          </NButton>
        </NFlex>
        <NButton
          v-else-if="footerConfig.tab"
          type="primary"
          :disabled="!footerConfig.tab.canAdd"
          :loading="isModalLoading"
          @click="footerConfig.tab.add()"
        >
          {{ footerConfig.tab.label }}
        </NButton>
        <NButton
          v-else
          type="primary"
          disabled
        >
          在表格中点击添加
        </NButton>
      </NFlex>
    </template>
  </NModal>
</template>
