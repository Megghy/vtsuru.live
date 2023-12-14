<script setup lang="ts">
import { GetSelfAccount, useAccount } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { BILI_API_URL } from '@/data/constants'
import { NAlert, NButton, NCard, NCode, NInput, NInputNumber, NSpace, NSpin, NText, NCountdown, NInputGroup, useMessage } from 'naive-ui'
import { isTaggedTemplateExpression } from 'typescript'
import { onMounted, ref } from 'vue'

const message = useMessage()

const accountInfo = useAccount()
const isStart = ref(false)
const timeLeft = ref(0)
const timeOut = ref(false)

const uId = ref()
const roomId = ref()
const timer = ref()

function onStartVerify() {
  QueryGetAPI(BILI_API_URL() + 'verify', {
    uId: uId.value,
  }).then((data) => {
    if (data.code == 200) {
      message.info('已开始认证流程, 请前往直播间发送认证码')
      checkStatus()
      isStart.value = true
      timer.value = setInterval(checkStatus, 2500)
    }
  })
}
async function checkStatus() {
  const data = await QueryGetAPI<{
    uId: number
    roomId: number
    endTime: number
  }>(BILI_API_URL() + 'status')
  if (data.code == 200) {
    //正在进行认证
    roomId.value ??= data.data.roomId
    timeLeft.value = data.data.endTime
    return true
  } else if (data.code == 201) {
    clearInterval(timer.value)
    message.success('认证成功')
    setTimeout(() => {
      GetSelfAccount()
    }, 1)
    return true
  } else if (data.code == 400 && isStart.value) {
    timeOut.value = true
    clearInterval(timer.value)
    message.error('认证超时')
    return false
  }
  return false
}
function copyCode() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(accountInfo.value?.biliVerifyCode ?? '')
    message.success('已复制认证码到剪切板')
  } else {
    message.warning('当前环境不支持自动复制, 请手动选择并复制')
  }
}

onMounted(async () => {
  if (accountInfo.value && !accountInfo.value.isBiliVerified) {
    if (await checkStatus()) {
      isStart.value = true
      timer.value = setInterval(checkStatus, 5000)
    }
  }
})
</script>

<template>
  <NAlert v-if="accountInfo?.isBiliVerified" type="success"> 你已通过验证 </NAlert>
  <NAlert v-else-if="!accountInfo">尚未登录</NAlert>
  <NCard embedded v-else>
    <template #header> Bilibili 身份验证 </template>
    <template v-if="isStart">
      <NSpace vertical justify="center" align="center">
        <template v-if="!timeOut">
          <NSpin />
          <span> 剩余 <NCountdown :duration="timeLeft - Date.now()" /> </span>
        </template>
        <NAlert v-else type="error">
          认证超时
          <NButton
            @click="
              () => {
                isStart = false
                timeOut = false
              }
            "
            type="info"
          >
            重新开始
          </NButton>
        </NAlert>
        <NInputGroup>
          <NInput :allow-input="() => false" v-model:value="accountInfo.biliVerifyCode" />
          <NButton @click="copyCode"> 复制认证码 </NButton>
        </NInputGroup>
        <NButton v-if="roomId" type="primary" tag="a" :href="'https://live.bilibili.com/' + roomId" target="_blank"> 前往直播间 </NButton>
      </NSpace>
    </template>
    <template v-else>
      <NSpace vertical justify="center" align="center">
        <NAlert type="info">
          <NText>
            请在点击
            <NText type="primary" strong> 开始认证 </NText>
            后2分钟之内使用
            <NText strong type="primary"> 需要认证的账户 </NText>
            在自己的直播间内发送
            <NButton type="info" text @click="copyCode">
              {{ accountInfo?.biliVerifyCode }}
            </NButton>
          </NText>
        </NAlert>
        <NInputNumber size="small" placeholder="输入用户UId" v-model:value="uId" :min="1" :show-button="false" />
        <NButton size="large" type="primary" @click="onStartVerify"> 开始认证 </NButton>
      </NSpace>
    </template>
  </NCard>
</template>
