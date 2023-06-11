<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NAlert, NButton, NCard, NDivider, NSpace, NTag, NText, NThing, NTime } from 'naive-ui'

const accountInfo = useAccount()
</script>

<template>
  <NCard embedded style="max-width: 500px">
    <NSpace align="center" justify="center" vertical>
      <NText style="font-size: 3rem">
        {{ accountInfo?.name }}
      </NText>
      <NText style="color: gray">
        于
        <NTime :time="accountInfo?.createAt" />
        注册
      </NText>
    </NSpace>

    <NDivider />
    <NAlert>
      Bilibili 账户:
      <NTag v-if="accountInfo?.isBiliVerified" type="success"> 已认证 </NTag>
      <template v-else>
        <NTag type="error" size="small"> 未认证 </NTag>
        <NDivider vertical />
        <NButton size="small" @click="$router.push({ name: 'manage-biliVerify' })" type="info"> 前往认证 </NButton>
      </template>
    </NAlert>
  </NCard>
</template>
