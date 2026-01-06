<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import { format } from 'date-fns'
// @ts-ignore
import { saveAs } from 'file-saver'
import { NButton, NDivider, NFlex, NInput, NInputGroup, NSpin, useMessage } from 'naive-ui'
import { onMounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { FunctionTypes, SongFrom } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import SongListAddSongModal from '@/apps/manage/components/song-list/SongListAddSongModal.vue'
import SongList from '@/components/SongList.vue'
import { CURRENT_HOST, SONG_API_URL } from '@/shared/config'
import { copyToClipboard, objectsToCSV } from '@/shared/utils'

const message = useMessage()
const accountInfo = useAccount()

const isLoading = ref(true)
const showModal = ref(false)
const songs = ref<SongsInfo[]>([])

async function getSongs() {
  isLoading.value = true
  try {
    const data = await QueryGetAPI<any>(`${SONG_API_URL}get`, { id: accountInfo.value?.id })
    if (data.code === 200) songs.value = data.data
  } catch (err) {
    message.error(`获取歌曲失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

function onSongsAdded(addedSongs: SongsInfo[]) {
  songs.value.push(...addedSongs)
}

function exportData() {
  const from = (f: SongFrom) => {
    switch (f) {
      case SongFrom.Custom: return '手动添加'
      case SongFrom.Netease: return '网易云'
      case SongFrom.FiveSing: return '5sing'
    }
  }

  const csvData = songs.value.map(s => ({
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
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF])
  const utf8encoder = new TextEncoder()
  const utf8array = utf8encoder.encode(text)

  const fileName = `歌单_${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}_${accountInfo.value?.name}_.csv`
  saveAs(new Blob([BOM, utf8array], { type: 'text/csv;charset=utf-8;' }), fileName)
}

onMounted(async () => {
  await getSongs()
})
</script>

<template>
  <ManagePageHeader
    title="歌单管理"
    :function-type="FunctionTypes.SongList"
  >
    <template #action>
      <NButton type="primary" @click="showModal = true">
        添加歌曲
      </NButton>
      <NButton
        type="primary"
        @click="$router.push({ name: 'manage-index', query: { tab: 'setting', setting: 'template', template: 'songlist' } })"
      >
        修改展示模板
      </NButton>
      <NButton type="primary" secondary @click="exportData">
        导出为 CSV
      </NButton>
      <NButton secondary @click="$router.push({ name: 'manage-liveRequest' })">
        前往点播管理页
      </NButton>
      <NButton secondary @click="$router.push({ name: 'user-songList', params: { id: accountInfo?.name } })">
        前往歌单展示页
      </NButton>
      <NButton
        :loading="isLoading"
        @click="() => {
          getSongs()
          message.success('完成')
        }"
      >
        刷新
      </NButton>
    </template>

    <NDivider style="margin: 16px 0 16px 0" title-placement="left">
      歌单展示页链接
    </NDivider>
    <NFlex align="center">
      <NInputGroup style="max-width: 400px;">
        <NInput :value="`${CURRENT_HOST}@${accountInfo.name}/song-list`" readonly />
        <NButton secondary @click="copyToClipboard(`${CURRENT_HOST}@${accountInfo.name}/song-list`)">
          复制
        </NButton>
      </NInputGroup>
    </NFlex>
    <NDivider style="margin: 16px 0 16px 0" />
  </ManagePageHeader>

  <SongListAddSongModal v-model:show="showModal" :songs="songs" @added="onSongsAdded" />

  <NSpin v-if="isLoading" show />
  <SongList v-else :songs="songs" is-self />
  <NDivider />
</template>

