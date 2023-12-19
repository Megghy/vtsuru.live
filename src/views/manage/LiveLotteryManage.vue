<script setup lang="ts">
import { useAccount } from '@/api/account'
import DanmakuClient from '@/data/DanmakuClient'
import { NAlert } from 'naive-ui'
import { onMounted, onUnmounted } from 'vue'
import OpenLottery from '../open_live/OpenLottery.vue'

const accountInfo = useAccount()
let client = new DanmakuClient(null)

onMounted(() => {
  client.Start()
})
onUnmounted(() => {
  client.Stop()
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified != true" type="info"> 尚未进行Bilibili认证 </NAlert>
  <OpenLottery v-else :client="client" :room-info="client.roomAuthInfo.value" :code="accountInfo?.biliAuthCode" />
</template>
