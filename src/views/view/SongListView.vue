<template>
  <NSpin v-if="isLoading" show />
  <component v-else :is="songListType" :user-info="userInfo" :songs="songs" />
</template>

<script lang="ts" setup>
import { useUser } from '@/api/user'
import { SongListTypes, SongsInfo } from '@/api/api-models'
import DefaultSongListTemplate from '@/views/view/songListTemplate/DefaultSongListTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'
import { useRouteParams } from '@vueuse/router'
import { QueryGetAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'

defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
}>()

const songListType = computed(() => {
  if (userInfo.value) {
    switch (userInfo.value.songListType) {
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
const uId = useRouteParams('id', '-1', { transform: Number })
const isLoading = ref(true)
const message = useMessage()

const errMessage = ref('')

async function getSongs() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
    id: uId.value,
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

const userInfo = ref<UserInfo>()

onMounted(async () => {
  userInfo.value = await useUser()
  await getSongs()
})
</script>
