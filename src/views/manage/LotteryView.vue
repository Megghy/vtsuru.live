<script setup lang="ts">
import { LotteryUserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LOTTERY_API_URL, TURNSTILE_KEY } from '@/data/constants'
import { NButton, NTabPane, NTabs, useMessage } from 'naive-ui'
import { ref } from 'vue'
import VueTurnstile from 'vue-turnstile'

interface TempLotteryResponseModel {
  users: LotteryUserInfo[]
  createTime: number
  total: number
}
const message = useMessage()
const token = ref()
const turnstile = ref()

const commentUsers = ref<TempLotteryResponseModel>()

async function getCommentsUsers() {
  await QueryGetAPI<TempLotteryResponseModel>(
    LOTTERY_API_URL + 'comments',
    {
      id: 803541974225256452n,
    },
    [['Turnstile', token.value]]
  )
    .then((data) => {
      if (data.code == 200) {
        commentUsers.value = data.data
      } else {
        message.error('获取用户失败: ' + data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      message.error('获取失败')
    })
    .finally(() => {
      turnstile.value?.reset()
    })
}
</script>
<template>
  <NTabs>
    <NTabPane name="dynamic" tab="动态抽奖"> <NButton @click="getCommentsUsers" :loading="!token"> 11 </NButton> </NTabPane>
  </NTabs>
  <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
</template>
