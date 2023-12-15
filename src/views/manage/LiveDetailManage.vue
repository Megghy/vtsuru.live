<script setup lang="ts">
import { useAccount } from '@/api/account'
import { DanmakuModel, ResponseLiveInfoModel } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import DanmakuContainer from '@/components/DanmakuContainer.vue'
import { LIVE_API_URL } from '@/data/constants'
import { NButton, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

interface ResponseLiveDetail {
  live: ResponseLiveInfoModel
  danmakus: DanmakuModel[]
}

const accountInfo = useAccount()
const message = useMessage()
const route = useRoute()
const router = useRouter()

const liveInfo = ref<ResponseLiveDetail | undefined>(await get())

async function get() {
  try {
    const data = await QueryGetAPI<ResponseLiveDetail>(LIVE_API_URL + 'get', {
      id: route.params.id,
      useEmoji: true,
    })
    if (data.code == 200) {
      return data.data
    } else {
      message.error('无法获取数据: ' + data.message)
      return undefined
    }
  } catch (err) {
    message.error('无法获取数据')
  }
  return undefined
}
</script>

<template>
  <NButton @click="router.go(-1)" text>
    {{ '< 返回' }}
  </NButton>
  <DanmakuContainer
    v-if="liveInfo"
    ref="danmakuContainerRef"
    :current-live="liveInfo.live"
    :current-danmakus="liveInfo.danmakus"
    :height="750"
    show-rank
    show-liver
    show-live-info
    show-tools
    show-name
    to="userDanmakus"
    :item-range="100"
    :item-height="25"
  />
</template>
