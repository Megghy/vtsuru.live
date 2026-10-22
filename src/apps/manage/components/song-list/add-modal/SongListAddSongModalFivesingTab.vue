<script setup lang="ts">
import { ref } from 'vue'

import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { FETCH_API } from '@/shared/config'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'

defineProps<{
  existingSongs: SongsInfo[]
}>()

const emit = defineEmits<{
  (e: 'added', songs: SongsInfo[]): void
  (e: 'loadingChange', value: boolean): void
}>()

const message = useMessage()

const fivesingSearchInput = ref<string>('')
const fivesingResults = ref<SongsInfo[]>([])
const fivesingTotalPageCount = ref(1)
const fivesingCurrentPage = ref(1)
const isGettingFivesingSongPlayUrl = ref(0)

function extractTextFromHtml(html: string): string {
  const match = /<em class="keyword">(.*?)<\/em>/.exec(html)
  if (match) return match[1]
  return html
}

async function getFivesingSongUrl(song: SongsInfo): Promise<string> {
  const apiUrl = `http://service.5sing.kugou.com/song/getsongurl?songid=${song.id}&songtype=bz&from=web&version=6.6.72`
  const data = await fetch(FETCH_API + apiUrl)
  const result = await data.text()

  const json = JSON.parse(result.substring(1, result.length - 1))
  if (json.code === 0) return json.data.lqurl
  return ''
}

async function playFivesingSong(song: SongsInfo) {
  isGettingFivesingSongPlayUrl.value = song.id
  try {
    song.url = await getFivesingSongUrl(song)
  } catch (err) {
    message.error(`获取歌曲链接失败: ${err}`)
  } finally {
    isGettingFivesingSongPlayUrl.value = 0
  }
}

async function getFivesingSearchList(isRestart = false) {
  if (!fivesingSearchInput.value) {
    message.error('请输入搜索关键词')
    return
  }

  emit('loadingChange', true)
  try {
    if (isRestart) fivesingCurrentPage.value = 1

    const searchUrl = `http://search.5sing.kugou.com/home/json?keyword=${fivesingSearchInput.value}&sort=1&page=${fivesingCurrentPage.value}&filter=3`
    const json = await fetch(FETCH_API + searchUrl).then((data) => data.json())
    if (json.list.length === 0) message.error('搜索结果为空')

    fivesingResults.value = []
    json.list.forEach((song: any) => {
      const songInfo = {
        id: song.songId,
        name: extractTextFromHtml(song.songName),
        author: [song.originSinger, song.singer].filter(Boolean),
      } as SongsInfo
      fivesingResults.value.push(songInfo)
    })

    fivesingTotalPageCount.value = json.pageInfo.totalPages
    message.success(`成功获取搜索信息，共 ${json.pageInfo.totalCount} 条`)
  } catch (err) {
    message.error(`获取歌单失败: ${err}`)
  } finally {
    emit('loadingChange', false)
  }
}

async function addFivesingSongs(song: SongsInfo) {
  emit('loadingChange', true)
  try {
    if (!song.url) {
      try {
        song.url = await getFivesingSongUrl(song)
      } catch {
        message.error('未能获取到歌曲链接，将留空')
      }
    }

    const data = await addSongsToSongList([song], SongFrom.FiveSing)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }
    message.success('已添加歌曲')
    emit('added', data.data as unknown as SongsInfo[])
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
        placeholder="输入要搜索的歌名"
        maxlength="15"
        class="flex-1"
        @keyup.enter="getFivesingSearchList(true)"
      />
      <Button
        :disabled="!fivesingSearchInput"
        @click="getFivesingSearchList(true)"
      >
        搜索
      </Button>
    </div>

    <div
      v-if="fivesingResults.length > 0"
      class="border rounded-lg overflow-hidden"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>名称</TableHead>
            <TableHead>作者</TableHead>
            <TableHead class="w-32 text-center">试听</TableHead>
            <TableHead class="w-20 text-center">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="song in fivesingResults"
            :key="song.id"
          >
            <TableCell class="text-xs font-medium">{{ song.name }}</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Tag
                  v-for="author in song.author"
                  :key="author"
                  size="small"
                >
                  {{ author }}
                </Tag>
              </div>
            </TableCell>
            <TableCell class="text-center">
              <Button
                v-if="!song.url"
                size="xs"
                variant="outline"
                :disabled="isGettingFivesingSongPlayUrl === song.id"
                @click="playFivesingSong(song)"
              >
                {{ isGettingFivesingSongPlayUrl === song.id ? '获取中...' : '试听' }}
              </Button>
              <audio
                v-else
                controls
                class="h-7 w-40 max-w-full"
              >
                <source :src="song.url" />
              </audio>
            </TableCell>
            <TableCell class="text-center">
              <Button
                size="xs"
                @click="addFivesingSongs(song)"
              >
                添加
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
