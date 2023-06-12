<script setup lang="ts">
import { SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryGetPaginationAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { SONG_API_URL, USER_API_URL } from '@/data/constants'
import { onMounted, ref } from 'vue'
import { useRouteParams } from '@vueuse/router'
import { useAccount } from '@/api/account'

const accountInfo = useAccount()
const songs = ref<SongsInfo[]>()
const uId = useRouteParams('id', '-1', { transform: Number })

async function getSongs() {
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
    uId: uId.value,
  }).then((data) => {
    if (data.code == 200) {
      songs.value = data.data
    }
  })
}

onMounted(async () => {
  await getSongs()
})
</script>

<template>
  歌单
  <SongList :songs="songs ?? []" />
</template>
