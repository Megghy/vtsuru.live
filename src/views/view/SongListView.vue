<template>
  <NSpin v-if="isLoading" show />
  <component v-else :is="songListType" :user-info="userInfo" :songs="songs" />
</template>

<script lang="ts" setup>
import { SongListTypes, SongsInfo } from '@/api/api-models'
import DefaultSongListTemplate from '@/views/view/songListTemplate/DefaultSongListTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'

const { biliInfo, userInfo } = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
}>()

const songListType = computed(() => {
  if (userInfo) {
    switch (userInfo.songListType) {
      case SongListTypes.Default:
        return DefaultSongListTemplate

      default:
        return DefaultSongListTemplate
    }
  } else {
    return DefaultSongListTemplate
  }
})
const songs = ref<SongsInfo[]>()
const isLoading = ref(true)
const message = useMessage()

const errMessage = ref('')

async function getSongs() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
    id: userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        songs.value = data.data
      } else {
        errMessage.value = data.message
        message.error('加载失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('加载失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}

onMounted(async () => {
  await getSongs()
})
</script>
