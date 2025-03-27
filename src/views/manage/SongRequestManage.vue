<script setup lang="ts">
import { useAccount } from '@/api/account'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { NAlert } from 'naive-ui'
import MusicRequest from '../open_live/MusicRequest.vue'

const accountInfo = useAccount()
const client = await useDanmakuClient().initClient()
</script>

<template>
  <NAlert
    v-if="accountInfo?.isBiliVerified != true"
    type="info"
  >
    尚未进行Bilibili认证
  </NAlert>
  <MusicRequest
    v-else
    :client="client"
    :room-info="client.authInfo!"
    :code="accountInfo?.biliAuthCode"
  />
</template>
