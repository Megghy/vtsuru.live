<script setup lang="ts">
import { SongsInfo } from '@/api/api-models'
import { QueryGetAPI, QueryGetPaginationAPI } from '@/api/query'
import SongList from '@/components/SongList.vue'
import { SONG_API_URL, USER_API_URL } from '@/data/constants'
import { onMounted, ref } from 'vue'
import { useRouteParams } from '@vueuse/router'
import { useAccount } from '@/api/account'
import { NAlert } from 'naive-ui'

const accountInfo = useAccount()
const songs = ref<SongsInfo[]>()
const uId = useRouteParams('id', '-1', { transform: Number })

const errMessage = ref('')

async function getSongs() {
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
    id: uId.value,
  }).then((data) => {
    if (data.code == 200) {
      songs.value = data.data
    }
    else {
      errMessage.value = data.message
    }
  })
}

onMounted(async () => {
  await getSongs()
})
</script>

<template>
  <SongList v-if="songs" :songs="songs ?? []" />
  <NAlert v-else-if="errMessage" type="error">
    {{ errMessage }}
  </NAlert>
</template>
