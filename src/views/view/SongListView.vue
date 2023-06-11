<script setup lang="ts">
import { SongsInfo } from '@/api/api-models'
import { QueryGetPaginationAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { USER_API_URL } from '@/data/constants'
import { onMounted, ref } from 'vue'
import { useRouteParams } from '@vueuse/router'

const songs = ref<SongsInfo[]>()
const uId = useRouteParams('id', '-1', { transform: Number })

async function RequestData() {
  songs.value = [
    {
      id: '1',
      name: 'test',
      author: '雪路',
      url: 'https://music.163.com/song/media/outer/url?id=1995844771.mp3',
      cover: 'https://ukamnads.icu/file/components.png',
      from: '网易云',
      language: '中文',
      desc: 'xuelu',
      tags: ['hao'],
    },
    {
      id: '2',
      name: 'test2',
      author: '雪路2',
      url: 'https://music.163.com/song/media/outer/url?id=1995844771.mp3',
      cover: 'https://ukamnads.icu/file/components.png',
      from: '网易云2',
      language: '中文2',
      desc: 'xuelu',
      tags: ['hao'],
    },
  ]
  await QueryGetPaginationAPI<SongsInfo[]>(`${USER_API_URL}info`, {
    uId: uId.value,
  })
    .then((result) => {
      if (result.code == 200) {
        songs.value = result.data.datas
      } else {
      }
    })
    .catch((err) => {
      console.error(err)
    })
}

onMounted(async () => {
  await RequestData()
})
</script>

<template>
  歌单
  <SongList :songs="songs ?? []" />
</template>
