<script setup lang="ts">
import { computed, ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { SONG_API_URL } from '@/shared/config'

const props = defineProps<{ existingSongs: SongsInfo[] }>()
const emit = defineEmits<{ added: [songs: SongsInfo[]]; loadingChange: [value: boolean] }>()
const toast = useToast()
const neteaseIdInput = ref('')
const neteaseSongs = ref<SongsInfo[]>([])
const selectedNeteaseSongs = ref<string[]>([])
const addedSongIds = ref<number[]>([])

const neteaseSongListId = computed(() => {
  const input = neteaseIdInput.value.trim()
  const id = /(?:id=|^)(\d+)/.exec(input)?.[1]
  return id ? Number(id) : null
})

function isUnavailable(song: SongsInfo) {
  return props.existingSongs.some((item) => item.id === song.id) || addedSongIds.value.includes(song.id)
}

async function getNeteaseSongList() {
  const id = neteaseSongListId.value
  if (!id) {
    toast.add({ title: '请输入有效的网易云歌单 ID 或链接', color: 'warning' })
    return
  }
  emit('loadingChange', true)
  try {
    const result = await QueryGetAPI<SongsInfo[]>(`${SONG_API_URL}get-netease-list`, { id })
    if (result.code !== 200) throw new Error(result.message)
    neteaseSongs.value = result.data
    selectedNeteaseSongs.value = []
    addedSongIds.value = []
    toast.add({ title: `已获取 ${result.data.length} 首歌曲，其中 ${result.data.filter(isUnavailable).length} 首已存在`, color: 'success' })
  } catch (error) {
    toast.add({ title: `获取歌单失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}

async function addNeteaseSongs() {
  const selected = neteaseSongs.value.filter((song) => selectedNeteaseSongs.value.includes(song.key) && !isUnavailable(song))
  if (selected.length === 0) {
    toast.add({ title: '请选择可导入的歌曲', color: 'warning' })
    return
  }
  emit('loadingChange', true)
  try {
    const result = await addSongsToSongList(selected, SongFrom.Netease)
    if (result.code !== 200) throw new Error(result.message)
    addedSongIds.value.push(...result.data.map((song) => song.id))
    selectedNeteaseSongs.value = []
    emit('added', result.data)
    toast.add({ title: `已添加 ${result.data.length} 首歌曲`, color: 'success' })
  } catch (error) {
    toast.add({ title: `添加失败：${error instanceof Error ? error.message : String(error)}`, color: 'error' })
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="song-import">
    <UFormField label="网易云歌单">
      <UInput v-model="neteaseIdInput" placeholder="直接输入歌单 ID 或网页链接" icon="i-lucide-list-music" />
    </UFormField>
    <UButton :disabled="!neteaseSongListId" label="获取歌曲" @click="getNeteaseSongList" />
    <template v-if="neteaseSongs.length">
      <USeparator />
      <label v-for="song in neteaseSongs" :key="song.key" class="song-import__row" :class="{ 'is-disabled': isUnavailable(song) }">
        <input v-model="selectedNeteaseSongs" type="checkbox" :value="song.key" :disabled="isUnavailable(song)">
        <span>{{ song.name }}</span>
        <span class="song-import__meta">{{ song.author.join(' / ') }}</span>
        <UBadge v-if="isUnavailable(song)" color="neutral" variant="subtle" label="已存在" />
      </label>
      <UButton :disabled="selectedNeteaseSongs.length === 0" :label="`添加到歌单（${selectedNeteaseSongs.length}）`" @click="addNeteaseSongs" />
    </template>
  </div>
</template>

<style scoped>
.song-import { display: grid; gap: 14px; }
.song-import__row { display: grid; grid-template-columns: auto minmax(0, 1fr) minmax(120px, .7fr) auto; gap: 10px; align-items: center; padding: 9px 10px; border: 1px solid var(--vtsuru-border); border-radius: 8px; }
.song-import__meta { color: var(--vtsuru-fg-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.song-import__row.is-disabled { opacity: .58; }
</style>
