<template>
  <NSpin v-if="isLoading" show />
  <component v-else ref="dynamicConfigRef" :config="currentConfig"
    :is="SongListTemplateMap[componentType ?? '']?.compoent" :user-info="userInfo" :bili-info="biliInfo"
    :currentData="currentData" :live-request-settings="settings" :live-request-active="songsActive"
    @request-song="requestSong" v-bind="$attrs" />
</template>

<script lang="ts" setup>
import { DownloadConfig, downloadConfigDirect, useAccount } from '@/api/account'
import { Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { SONG_API_URL, SONG_REQUEST_API_URL, SongListTemplateMap, VTSURU_API_URL } from '@/data/constants'
import { NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

const accountInfo = useAccount()

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  biliInfo: any | undefined
  userInfo: UserInfo | undefined
  template?: string | undefined
  fakeData?: SongsInfo[]
}>()

const componentType = computed(() => {
  return props.template ?? props.userInfo?.extra?.templateTypes['songlist']?.toLowerCase()
})
const currentData = ref<SongsInfo[]>()
const dynamicConfigRef = ref()
const selectedTemplateConfig = computed(() => {
  if (dynamicConfigRef.value?.Config) {
    return dynamicConfigRef.value?.Config as TemplateConfig<any>
  }
  return undefined
})
const currentConfig = ref()
watch(
  () => dynamicConfigRef,
  () => {
    getConfig()
  },
)

const isLoading = ref(true)
const message = useMessage()

const errMessage = ref('')
const songsActive = ref<SongRequestInfo[]>([])
const settings = ref<Setting_LiveRequest>({} as Setting_LiveRequest)

async function getSongRequestInfo() {
  try {
    const data = await QueryGetAPI<{ songs: SongRequestInfo[]; setting: Setting_LiveRequest }>(
      SONG_REQUEST_API_URL + 'get-active-and-settings',
      {
        id: props.userInfo?.id,
      },
    )
    if (data.code == 200) {
      return data.data
    }
  } catch (err) { }
  return {} as { songs: SongRequestInfo[]; setting: Setting_LiveRequest }
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
      message.error('加载失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function getConfig() {
  isLoading.value = true
  await DownloadConfig(selectedTemplateConfig.value!.name)
    .then((data) => {
      if (data.msg) {
        message.error('加载失败: ' + data.msg)
      } else {
        currentConfig.value = data.data
      }
    })
    .catch((err) => {
      message.error('加载失败')
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function requestSong(song: SongsInfo) {
  if (song.options || !settings.value.allowFromWeb) {
    navigator.clipboard.writeText(`${settings.value.orderPrefix} ${song.name}`)
    if (!accountInfo.value) {
      message.warning('要从网页点歌请先登录, 点歌弹幕已复制到剪切板')
    } else {
      message.success('复制成功')
    }
  } else {
    if (props.userInfo) {
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
}

onMounted(async () => {
  if (!props.fakeData) {
    try {
      await getSongs()
      setTimeout(async () => {
        const r = await getSongRequestInfo()
        if (r) {
          songsActive.value = r.songs
          settings.value = r.setting
        }
      }, 1000)
    } catch (err) {
      message.error('加载失败')
    }
  } else {
    currentData.value = props.fakeData
    isLoading.value = false
  }
})
</script>
