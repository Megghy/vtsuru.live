<script setup lang="ts">
import { Pause, Play } from 'lucide-vue-next'
import { computed, onBeforeUnmount, ref } from 'vue'

import type { ResponseSongModel } from '@/api/generated/model'
import { SongPlatform } from '@/api/generated/model'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { FETCH_API } from '@/shared/config'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Pagination } from '@/shared/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  existingSongs: ResponseSongModel[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: ResponseSongModel[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const fivesingSearchInput = ref('')
const fivesingResults = ref<ResponseSongModel[]>([])
const fivesingTotalPageCount = ref(1)
const fivesingCurrentPage = ref(1)
const isGettingFivesingSongPlayUrl = ref(0)
const playingSongId = ref<number | null>(null)
let audioEl: HTMLAudioElement | null = null

const existingFivesingIds = computed(
  () => new Set(props.existingSongs.filter((s) => s.from === SongPlatform.FiveSing).map((s) => s.id)),
)

function stopAudio() {
  if (audioEl) {
    audioEl.pause()
    audioEl.src = ''
    audioEl = null
  }
  playingSongId.value = null
}

onBeforeUnmount(stopAudio)

function extractTextFromHtml(html: string): string {
  const match = /<em class="keyword">(.*?)<\/em>/.exec(html)
  if (match) return match[1]
  return html
}

async function getFivesingSongUrl(song: ResponseSongModel): Promise<string> {
  const apiUrl = `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`
  const data = await fetch(FETCH_API + apiUrl)
  const result = await data.text()

  const json = JSON.parse(result.substring(1, result.length - 1))
  if (json.code === 0) return json.data.lqurl
  return ''
}

async function togglePlayFivesingSong(song: ResponseSongModel) {
  if (playingSongId.value === song.id) {
    stopAudio()
    return
  }

  isGettingFivesingSongPlayUrl.value = song.id
  try {
    if (!song.url) {
      song.url = await getFivesingSongUrl(song)
    }
    if (!song.url) {
      message.warning('未获取到可播放伴奏链接')
      return
    }
    stopAudio()
    audioEl = new Audio(song.url)
    audioEl.addEventListener('ended', () => {
      if (playingSongId.value === song.id) playingSongId.value = null
    })
    playingSongId.value = song.id
    await audioEl.play()
  } catch (err) {
    message.error(`播放失败: ${err instanceof Error ? err.message : String(err)}`)
    stopAudio()
  } finally {
    isGettingFivesingSongPlayUrl.value = 0
  }
}

async function getFivesingSearchList(isRestart = false) {
  if (!fivesingSearchInput.value.trim()) {
    message.error('请输入搜索关键词')
    return
  }

  stopAudio()
  emit('loadingChange', true)
  try {
    if (isRestart) fivesingCurrentPage.value = 1

    const kw = encodeURIComponent(fivesingSearchInput.value.trim())
    const searchUrl = `http://search.5sing.kugou.com/home/json?keyword=${kw}&sort=1&page=${fivesingCurrentPage.value}&filter=3`
    const json = await fetch(FETCH_API + searchUrl).then((data) => data.json())
    if (!json.list?.length) {
      fivesingResults.value = []
      message.warning('搜索结果为空')
      return
    }

    fivesingResults.value = json.list.map(
      (song: any) =>
        ({
          id: song.songId,
          name: extractTextFromHtml(song.songName),
          author: [song.originSinger, song.singer].filter(Boolean),
        }) as ResponseSongModel,
    )

    fivesingTotalPageCount.value = Math.max(1, json.pageInfo?.totalPages ?? 1)
  } catch (err) {
    message.error(`搜索失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    emit('loadingChange', false)
  }
}

async function addFivesingSongs(song: ResponseSongModel) {
  emit('loadingChange', true)
  try {
    if (!song.url) {
      try {
        song.url = await getFivesingSongUrl(song)
      } catch {
        message.warning('未能获取到歌曲链接，将留空')
      }
    }

    const data = await addSongsToSongList([song], SongPlatform.FiveSing)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }
    message.success(`已添加《${song.name}》`)
    emit('added', data.data as unknown as ResponseSongModel[])
  } catch (err) {
    message.error('添加失败')
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center gap-2">
      <Input
        v-model="fivesingSearchInput"
        placeholder="输入要搜索的伴奏或歌名"
        maxlength="40"
        class="flex-1"
        @keyup.enter="getFivesingSearchList(true)"
      />
      <Button
        :disabled="!fivesingSearchInput.trim()"
        @click="getFivesingSearchList(true)"
      >
        搜索
      </Button>
    </div>

    <div
      v-if="fivesingResults.length > 0"
      class="space-y-3"
    >
      <div class="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>作者</TableHead>
              <TableHead class="w-24 text-center">试听</TableHead>
              <TableHead class="w-24 text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="song in fivesingResults"
              :key="song.id"
            >
              <TableCell class="font-medium">{{ song.name }}</TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge
                    v-for="author in song.author"
                    :key="author"
                    variant="secondary"
                    size="xs"
                  >
                    {{ author }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell class="text-center">
                <Button
                  size="icon-xs"
                  :variant="playingSongId === song.id ? 'default' : 'outline'"
                  :loading="isGettingFivesingSongPlayUrl === song.id"
                  :aria-label="playingSongId === song.id ? '停止试听' : '试听伴奏'"
                  @click="togglePlayFivesingSong(song)"
                >
                  <component
                    :is="playingSongId === song.id ? Pause : Play"
                    class="size-3.5"
                  />
                </Button>
              </TableCell>
              <TableCell class="text-center">
                <Button
                  size="xs"
                  :variant="existingFivesingIds.has(song.id) ? 'secondary' : 'default'"
                  :disabled="existingFivesingIds.has(song.id)"
                  @click="addFivesingSongs(song)"
                >
                  {{ existingFivesingIds.has(song.id) ? '已在歌单' : '添加' }}
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Pagination
        v-if="fivesingTotalPageCount > 1"
        v-model:page="fivesingCurrentPage"
        :total="fivesingTotalPageCount * 10"
        :page-size="10"
        @update:page="getFivesingSearchList(false)"
      />
    </div>
  </div>
</template>
