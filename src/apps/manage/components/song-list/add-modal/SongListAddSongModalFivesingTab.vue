<script setup lang="ts">
import { ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { FETCH_API } from '@/shared/config'

const { existingSongs } = defineProps<{ existingSongs: SongsInfo[] }>()
const emit = defineEmits<{ added: [songs: SongsInfo[]]; loadingChange: [value: boolean] }>()
const toast = useToast()
const fivesingSearchInput = ref('')
const fivesingResults = ref<SongsInfo[]>([])
const fivesingTotalPageCount = ref(1)
const fivesingCurrentPage = ref(1)
const isGettingFivesingSongPlayUrl = ref(0)

function extractTextFromHtml(html: string) {
  return /<em class="keyword">(.*?)<\/em>/.exec(html)?.[1] ?? html
}

async function getFivesingSongUrl(song: SongsInfo) {
  const url = `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`
  const result = await fetch(FETCH_API + url)
  const json = JSON.parse((await result.text()).slice(1, -1))
  return json.code === 0 ? json.data.lqurl as string : ''
}

async function playFivesingSong(song: SongsInfo) {
  isGettingFivesingSongPlayUrl.value = song.id
  try {
    song.url = await getFivesingSongUrl(song)
  } catch (error) {
    toast.add({ title: `获取歌曲链接失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    isGettingFivesingSongPlayUrl.value = 0
  }
}

async function getFivesingSearchList(restart = false) {
  if (!fivesingSearchInput.value.trim()) {
    toast.add({ title: '请输入搜索关键词', color: 'warning' })
    return
  }
  if (restart) fivesingCurrentPage.value = 1
  emit('loadingChange', true)
  try {
    const url = `http://search.5sing.kugou.com/home/json?keyword=${encodeURIComponent(fivesingSearchInput.value)}&sort=1&page=${fivesingCurrentPage.value}&filter=3`
    const json = await fetch(FETCH_API + url).then((response) => response.json())
    fivesingResults.value = json.list.map((song: { songId: number; songName: string; originSinger: string; singer: string }) => ({
      id: song.songId,
      key: String(song.songId),
      name: extractTextFromHtml(song.songName),
      author: [song.originSinger, song.singer].filter(Boolean),
      url: '',
      from: SongFrom.FiveSing,
      language: [],
      tags: [],
      createTime: Date.now(),
      updateTime: Date.now(),
    }))
    fivesingTotalPageCount.value = json.pageInfo.totalPages
    toast.add({ title: json.list.length ? `获取到 ${json.pageInfo.totalCount} 条结果` : '搜索结果为空', color: json.list.length ? 'success' : 'warning' })
  } catch (error) {
    toast.add({ title: `搜索失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}

async function addFivesingSong(song: SongsInfo) {
  emit('loadingChange', true)
  try {
    song.url ||= await getFivesingSongUrl(song)
    const result = await addSongsToSongList([song], SongFrom.FiveSing)
    if (result.code !== 200) throw new Error(result.message)
    emit('added', result.data)
    toast.add({ title: '已添加歌曲', color: 'success' })
  } catch (error) {
    toast.add({ title: `添加失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="fivesing-import">
    <UInput v-model="fivesingSearchInput" placeholder="输入要搜索的歌名" maxlength="15" @keyup.enter="getFivesingSearchList(true)" />
    <UButton :disabled="!fivesingSearchInput" label="搜索" @click="getFivesingSearchList(true)" />
    <div v-if="fivesingResults.length" class="fivesing-import__table-wrap">
      <table class="fivesing-import__table">
        <thead><tr><th>名称</th><th>作者</th><th>试听</th><th /></tr></thead>
        <tbody>
          <tr v-for="song in fivesingResults" :key="song.id">
            <td>{{ song.name }}</td>
            <td><UBadge v-for="author in song.author" :key="author" class="fivesing-import__author" color="neutral" variant="subtle" :label="author" /></td>
            <td><UButton v-if="!song.url" size="xs" :loading="isGettingFivesingSongPlayUrl === song.id" label="试听" @click="playFivesingSong(song)" /><audio v-else controls :src="song.url" /></td>
            <td><UButton size="xs" color="success" :disabled="existingSongs.some((item) => item.from === SongFrom.FiveSing && item.id === song.id)" label="添加" @click="addFivesingSong(song)" /></td>
          </tr>
        </tbody>
      </table>
      <div class="fivesing-import__pager">
        <UButton size="sm" variant="ghost" :disabled="fivesingCurrentPage <= 1" label="上一页" @click="fivesingCurrentPage -= 1; getFivesingSearchList()" />
        <span>{{ fivesingCurrentPage }} / {{ fivesingTotalPageCount }}</span>
        <UButton size="sm" variant="ghost" :disabled="fivesingCurrentPage >= fivesingTotalPageCount" label="下一页" @click="fivesingCurrentPage += 1; getFivesingSearchList()" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.fivesing-import { display: grid; gap: 14px; }
.fivesing-import__table-wrap { overflow-x: auto; }
.fivesing-import__table { width: 100%; border-collapse: collapse; }
.fivesing-import__table th, .fivesing-import__table td { padding: 10px; text-align: left; border-bottom: 1px solid var(--vtsuru-border); }
.fivesing-import__author { margin: 2px; }
.fivesing-import__pager { display: flex; justify-content: center; align-items: center; gap: 10px; padding-top: 14px; }
audio { max-width: 190px; height: 30px; }
</style>
