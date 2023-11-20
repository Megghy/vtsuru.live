<template>
  <NSpin v-if="isLoading" show />
  <component
    v-else
    :is="componentType"
    :user-info="userInfo"
    :bili-info="biliInfo"
    :currentData="currentData"
    :song-request-settings="settings"
    :song-request-active="songs"
    @request-song="requestSong"
  />
</template>

<script lang="ts" setup>
import { Setting_SongRequest, SongRequestInfo, SongsInfo } from '@/api/api-models'
import DefaultSongListTemplate from '@/views/view/songListTemplate/DefaultSongListTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import { SONG_API_URL, SONG_REQUEST_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'
import { useAccount } from '@/api/account'

const accountInfo = useAccount()

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
  fakeData?: SongsInfo[]
}>()

const componentType = computed(() => {
  const type = props.template ?? props.userInfo?.extra?.templateTypes['songlist']?.toLowerCase()
  if (props.userInfo) {
    switch (type?.toLocaleLowerCase()) {
      case '':
        return DefaultSongListTemplate

      default:
        return DefaultSongListTemplate
    }
  } else {
    return DefaultSongListTemplate
  }
})
const currentData = ref<SongsInfo[]>()
const isLoading = ref(true)
const message = useMessage()

const errMessage = ref('')
const songs = ref<SongRequestInfo[]>([])
const settings = ref<Setting_SongRequest>({} as Setting_SongRequest)

async function getSongRequestInfo() {
  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_SongRequest }>(SONG_REQUEST_API_URL + 'get-active-and-settings', {
      id: props.userInfo?.id,
    })
    if (data.code == 200) {
      return data.data
    }
  } catch (err) {
    console.error(err)
  }
  return {} as { songs: SongRequestInfo[]; setting: Setting_SongRequest }
}
async function getSongs() {
  isLoading.value = true
  await QueryGetAPI<SongsInfo[]>(SONG_API_URL + 'get', {
    id: props.userInfo?.id,
  })
    .then((data) => {
      if (data.code == 200) {
        currentData.value = data.data
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
async function requestSong(song: SongsInfo) {
  if (props.userInfo && accountInfo.value?.id != props.userInfo?.id) {
    try {
      const data = await QueryPostAPIWithParams(SONG_REQUEST_API_URL + 'add-from-web', {
        target: props.userInfo?.id,
        song: song.key,
      })

      if (data.code == 200) {
        message.success('点歌成功')
      } else {
        message.error('点歌失败: ' + data.message)
      }
    } catch (err) {
      message.error('点歌失败: ' + err)
    }
  }
}

onMounted(async () => {
  if (!props.fakeData) {
    await getSongs()
    const r = await getSongRequestInfo()
    if (r) {
      songs.value = r.songs
      settings.value = r.setting
    }
  } else {
    currentData.value = props.fakeData
    isLoading.value = false
  }
})
</script>
