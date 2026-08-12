<script setup lang="ts">
import { NAlert, NButton } from 'naive-ui'
import { useRouter } from 'vue-router'

import { useAccount } from '@/api/account'

const accountInfo = useAccount()
const router = useRouter()

function goBindBili() {
  void router.push({ name: 'manage-index', query: { tab: 'info' } })
}
</script>

<template>
  <NAlert
    v-if="!accountInfo?.isBiliVerified"
    type="warning"
  >
    使用此功能前你需要先
    <NButton
      type="info"
      text
      @click="goBindBili"
    >
      在面板绑定 Bilibili 账号
    </NButton>
  </NAlert>
  <NAlert
    v-else-if="!accountInfo?.eventFetcherState.online"
    type="warning"
  >
    使用此功能需要部署
    <NButton
      tag="a"
      href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
      target="_blank"
      type="primary"
      text
    >
      VtsuruEventFetcher
    </NButton>
    来获取你的直播数据
    <NButton
      tag="a"
      href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
      target="_blank"
      type="primary"
      size="small"
    >
      查看部署教程
    </NButton>
  </NAlert>
</template>
