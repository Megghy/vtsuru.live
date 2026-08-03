<script setup lang="ts">
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { showErrorToast } from '@/shared/services/toast'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'
import type { SongsInfo } from '@/api/api-models'
import { FunctionTypes, SongFrom } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import SongListAddSongModal from '@/apps/manage/components/song-list/SongListAddSongModal.vue'
import SongList from '@/components/SongList.vue'
import { CURRENT_HOST, SONG_API_URL } from '@/shared/config'
import { objectsToCSV } from '@/shared/utils'
const router = useRouter()
const accountInfo = useAccount()

const isLoading = ref(true)
const showModal = ref(false)
const songs = ref<SongsInfo[]>([])
const songListUrl = computed(() =>
  accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/song-list` : '',
)

async function getSongs() {
  isLoading.value = true
  try {
    const data = await QueryGetAPI<any>(`${SONG_API_URL}get`, { id: accountInfo.value?.id })
    if (data.code === 200) songs.value = data.data
  } catch (err) {
    showErrorToast(`获取歌曲失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

function onSongsAdded(addedSongs: SongsInfo[]) {
  songs.value.push(...addedSongs)
}

function exportData() {
  const source = songs.value
  const from = (f: SongFrom) => {
    switch (f) {
      case SongFrom.Custom:
        return '手动添加'
      case SongFrom.Netease:
        return '网易云'
      case SongFrom.FiveSing:
        return '5sing'
      default:
        return '其他'
    }
  }
  const csvData = source.map((s) => ({
    id: s.id,
    名称: s.name,
    翻译名称: s.translateName,
    作者: s.author?.join('/') ?? '未知',
    创建于: format(s.createTime, 'yyyy-MM-dd HH:mm:ss'),
    更新于: format(s.updateTime, 'yyyy-MM-dd HH:mm:ss'),
    描述: s.description,
    来自: from(s.from),
    语言: s.language.join(','),
    标签: s.tags?.join(',') ?? '',
    链接: s.url,
  }))
  const text = objectsToCSV(csvData)
  const BOM = new Uint8Array([0xef, 0xbb, 0xbf])
  const utf8array = new TextEncoder().encode(text)
  const fileName = `歌单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`
  saveAs(new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }), fileName)
}

const moreActions = [
  { label: '修改展示模板', key: 'template' },
  { label: '导出为 CSV', key: 'export' },
  { label: '前往点播管理页', key: 'live-request' },
  { label: '前往歌单展示页', key: 'song-list' },
]

function handleMoreAction(key: string) {
  switch (key) {
    case 'template':
      router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'template', template: 'songlist' } })
      break
    case 'export':
      exportData()
      break
    case 'live-request':
      router.push({ name: 'manage-liveRequest' })
      break
    case 'song-list':
      router.push({ name: 'user-songList', params: { id: accountInfo.value?.name } })
      break
  }
}

onMounted(getSongs)
</script>

<template>
  <ManagePageHeader
    title="歌单管理"
    :function-type="FunctionTypes.SongList"
    :links="[{ label: '展示页链接', value: songListUrl }]"
  >
    <template #action>
      <UButton
        @click="showModal = true"
      >
        添加歌曲
      </UButton>
      <UButton
        :loading="isLoading"
        color="neutral"
        variant="soft"
        @click="getSongs"
      >
        刷新
      </UButton>
      <UDropdownMenu :items="moreActions.map((item) => ({ ...item, onSelect: () => handleMoreAction(item.key) }))">
        <UButton color="neutral" variant="soft" label="更多"><template #trailing><UIcon name="i-lucide-ellipsis" /></template></UButton>
      </UDropdownMenu>
    </template>
  </ManagePageHeader>

  <SongListAddSongModal
    v-model:show="showModal"
    :songs="songs"
    @added="onSongsAdded"
  />

  <div v-if="isLoading" class="song-list-loading"><USkeleton class="h-8 w-full" /></div>
  <SongList
    v-else
    :songs="songs"
    is-self
  />
</template>
