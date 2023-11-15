<script setup lang="ts">
import { useAccount } from '@/api/account'
import DanmakuClient, { AuthInfo, DanmakuInfo, RoomAuthInfo, SCInfo } from '@/data/DanmakuClient'
import { useMessage } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const accountInfo = useAccount()
const message = useMessage()

const props = defineProps<{
  client: DanmakuClient
  roomInfo: RoomAuthInfo
  code: string | undefined
}>()

function onGetDanmaku(danmaku: DanmakuInfo) {

}
function onGetSC(danmaku: SCInfo) {

}

onMounted(() => {
  const authInfo = route.query as unknown as AuthInfo
  if (!authInfo?.Code && !accountInfo.value?.isBiliVerified) {
    message.warning('你并不是从幻星平台进入此页面, 且本站账号也未进行 Bilibili 账号认证, 此功能将不可用')
    return
  }
  props.client.on('danmaku', onGetDanmaku)
  props.client.on('sc', onGetSC)
})
onUnmounted(() => {
  props.client.off('danmaku', onGetDanmaku)
  props.client.off('sc', onGetSC)
})
</script>

<template>开发中...</template>
