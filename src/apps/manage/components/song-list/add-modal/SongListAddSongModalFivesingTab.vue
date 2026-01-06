<script setup lang="ts">
import type { SongsInfo } from '@/api/api-models'
import { SongFrom } from '@/api/api-models'
import { addSongsToSongList } from '@/apps/manage/components/song-list/useSongListAddSongs'
import { FETCH_API } from '@/shared/config'
import { NButton, NDivider, NInput, NPagination, NSpace, NTable, NTag, useMessage } from 'naive-ui'
import { ref } from 'vue'

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
    const json = await fetch(FETCH_API + searchUrl).then(data => data.json())
    if (json.list.length === 0) message.error('搜索结果为空')

    fivesingResults.value = []
    json.list.forEach((song: any) => {
      const songInfo = {
        id: song.songId,
        name: extractTextFromHtml(song.songName),
        author: [song.originSinger, song.singer],
      } as SongsInfo
      fivesingResults.value.push(songInfo)
    })

    fivesingTotalPageCount.value = json.pageInfo.totalPages
    message.success(`成功获取搜索信息, 共 ${json.pageInfo.totalCount} 条, 当前第 ${fivesingCurrentPage.value} 页`)
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
        message.error('未能获取到歌曲链接, 将留空')
      }
    }

    const data = await addSongsToSongList([song], SongFrom.FiveSing)
    if (data.code !== 200) {
      message.error(`添加失败: ${data.message}`)
      return
    }
    message.success('已添加歌曲')
    emit('added', data.data)
  } catch (err) {
    message.error('添加失败')
    console.error(err)
  } finally {
    emit('loadingChange', false)
  }
}
</script>

<template>
  <NInput
    v-model:value="fivesingSearchInput"
    clearable
    style="width: 100%"
    autosize
    placeholder="输入要搜索的歌名"
    maxlength="15"
  />
  <NDivider style="margin: 10px" />
  <NButton type="primary" :disabled="!fivesingSearchInput" @click="getFivesingSearchList(true)">
    搜索
  </NButton>
  <template v-if="fivesingResults.length > 0">
    <NDivider style="margin: 10px" />
    <div style="overflow-x: auto">
      <NTable size="small" style="overflow-x: auto">
        <thead>
          <tr>
            <th>名称</th>
            <th>作者</th>
            <th>试听</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="song in fivesingResults" :key="song.id">
            <td>{{ song.name }}</td>
            <td>
              <NSpace>
                <NTag v-for="author in song.author" :key="author" size="small">
                  {{ author }}
                </NTag>
              </NSpace>
            </td>
            <td style="display: flex; justify-content: flex-end">
              <NButton
                v-if="!song.url"
                size="small"
                :loading="isGettingFivesingSongPlayUrl === song.id"
                @click="playFivesingSong(song)"
              >
                试听
              </NButton>
              <audio v-else controls style="max-height: 30px">
                <source :src="song.url">
              </audio>
            </td>
            <td>
              <NButton
                size="small"
                color="green"
                :disabled="existingSongs.findIndex((s) => s.from === SongFrom.FiveSing && s.id === song.id) > -1"
                @click="addFivesingSongs(song)"
              >
                添加
              </NButton>
            </td>
          </tr>
        </tbody>
      </NTable>
    </div>
    <br>
    <NPagination
      v-model:page="fivesingCurrentPage"
      :page-count="fivesingTotalPageCount"
      simple
      @update-page="getFivesingSearchList(false)"
    />
  </template>
</template>
