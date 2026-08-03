<script setup lang="ts">
import { useAccount } from '@/api/account'

const accountInfo = useAccount()
</script>

<template>
  <UAlert
    v-if="!accountInfo?.isBiliVerified"
    color="warning"
    variant="soft"
  >
    <template #description>
      使用此功能前你需要先
      <UButton
        color="primary"
        variant="link"
        @click="$router.push({ name: 'manage-biliVerify' })"
      >
        认证Bilibili账号
      </UButton>
    </template>
  </UAlert>
  <UAlert
    v-else-if="!accountInfo?.eventFetcherState.online"
    color="warning"
    variant="soft"
  >
    <template #description>
      使用此功能需要部署
      <UButton
        to="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
        color="primary"
        variant="link"
      >
        VtsuruEventFetcher
      </UButton>
      来获取你的直播数据
      <UButton
        to="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
        target="_blank"
        color="primary"
        size="sm"
      >
        查看部署教程
      </UButton>
    </template>
  </UAlert>
</template>
