<template>
  <NSpin
    v-if="isLoading"
    show
  />
  <component
    :is="SongListTemplateMap[componentType ?? '']?.compoent"
    v-else
    ref="dynamicConfigRef"
    :config="selectedTemplateConfig?.name ? currentConfig : undefined"
    :user-info="userInfo"
    :bili-info="biliInfo"
    :data="currentData"
    :live-request-settings="settings"
    :live-request-active="songsActive"
    v-bind="$attrs"
    @request-song="requestSong"
  />
</template>

<script lang="ts" setup>
import { DownloadConfig, downloadConfigDirect, useAccount } from '@/api/account'
import { Setting_LiveRequest, SongRequestInfo, SongsInfo, UserInfo } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPIWithParams } from '@/api/query'
import { TemplateConfig } from '@/data/VTsuruTypes'
import { SONG_API_URL, SONG_REQUEST_API_URL, SongListTemplateMap, VTSURU_API_URL } from '@/data/constants'
import { useStorage } from '@vueuse/core'
import { addSeconds } from 'date-fns'
import { NSpin, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'

const accountInfo = useAccount()
const nextRequestTime = useStorage('SongList.NextRequestTime', new Date())

const minRequestTime = 30

const props = defineProps<{
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
        message.error('加载歌单失败: ' + data.message)
      }
    })
    .catch((err) => {
      message.error('加载失败: ' + err)
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function getConfig() {
  if(!selectedTemplateConfig.value) return
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
      message.error('加载失败: ' + err)
    })
    .finally(() => {
      isLoading.value = false
    })
}
async function requestSong(song: SongsInfo) {
  if (song.options || !settings.value.allowFromWeb || (settings.value.allowFromWeb && !settings.value.allowAnonymousFromWeb)) {
    navigator.clipboard.writeText(`${settings.value.orderPrefix} ${song.name}`)
    if (!settings.value.allowAnonymousFromWeb) {
      message.warning('主播不允许匿名点歌, 需要从网页点歌的话请注册登录, 点歌弹幕已复制到剪切板')
    }
    else if (!accountInfo.value.id) {
      message.warning('要从网页点歌请先登录, 点歌弹幕已复制到剪切板')
    } else {
      message.success('复制成功')
    }
  } else {
    if (props.userInfo) {
      if (!accountInfo.value.id && nextRequestTime.value > new Date()) {
        message.warning('距离点歌冷却还有' + (nextRequestTime.value.getTime() - new Date().getTime()) / 1000 + '秒')
        return
      }
      try {
        const data = await QueryPostAPIWithParams(SONG_REQUEST_API_URL + 'add-from-web', {
          target: props.userInfo?.id,
          song: song.key,
        })

        if (data.code == 200) {
          message.success('点歌成功')
          nextRequestTime.value = addSeconds(new Date(), minRequestTime)
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
        await getConfig()
      }, 300)
    } catch (err) {
      message.error('加载失败: ' + err)
      console.error(err)
    }
  } else {
    currentData.value = props.fakeData
    isLoading.value = false
  }
})
</script>
