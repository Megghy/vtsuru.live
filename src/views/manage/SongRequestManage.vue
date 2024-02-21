<script setup lang="ts">
import { useAccount } from '@/api/account'
import DanmakuClient from '@/data/DanmakuClient'
import { NAlert } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
import MusicRequest from '../open_live/MusicRequest.vue'

const accountInfo = useAccount()
const client = new DanmakuClient(null)

onMounted(() => {
  client.Start()
})
onUnmounted(() => {
  client.Stop()
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <MusicRequest v-else :client="client" :room-info="client.roomAuthInfo.value" :code="accountInfo?.biliAuthCode" />
</template>
