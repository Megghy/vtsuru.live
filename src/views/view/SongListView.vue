<template>
  <NSpin v-if="isLoading" show />
  <component v-else :is="componentType" :user-info="userInfo" :currentData="currentData" />
</template>

<script lang="ts" setup>
import { SongsInfo } from '@/api/api-models'
import DefaultSongListTemplate from '@/views/view/songListTemplate/DefaultSongListTemplate.vue'
import { computed, onMounted, ref } from 'vue'
import { UserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { SONG_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'

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

onMounted(async () => {
  if (!props.fakeData) {
    await getSongs()
  } else {
    currentData.value = props.fakeData
    isLoading.value = false
  }
})
</script>
