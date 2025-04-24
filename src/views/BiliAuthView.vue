<script setup lang="ts">
import { QueryGetAPI } from '@/api/query'
import { BILI_AUTH_API_URL, CURRENT_HOST } from '@/data/constants'
import { useAuthStore } from '@/store/useAuthStore'
import { useStorage } from '@vueuse/core'
import {
  NAlert,
  NButton,
  NCard,
  NCountdown,
  NFlex,
  NInput,
  NInputGroup,
  NPopconfirm,
  NSpace,
  NSpin,
  NStep,
  NSteps,
  NText,
  useMessage
} from 'naive-ui'
import { v4 as uuidv4 } from 'uuid'
import { computed, onMounted, ref } from 'vue'

type AuthStartModel = {
  code: string
  endAt: number
  startAt: number
  targetRoomId: number
}

const message = useMessage()

const guidKey = useStorage('Bili.Auth.Key', uuidv4())
const currentToken = useStorage<string>('Bili.Auth.Selected', null)
const useAuth = useAuthStore()

const startModel = ref<AuthStartModel>()

const currentStep = ref(currentToken.value ? 2 : 0)

const isStart = computed(() => {
  return currentStep.value > 0
})
const timeLeft = ref(0)
const timeOut = ref(false)

const timer = ref()

function onStartVerify() {
  QueryGetAPI<AuthStartModel>(BILI_AUTH_API_URL + 'start', {
    key: guidKey.value,
  }).then((data) => {
    if (data.code == 200) {
      message.info('已开始认证流程, 请前往直播间发送认证码')
      checkStatus()
      currentStep.value = 1
      timer.value = setInterval(checkStatus, 2500)
      startModel.value = data.data
    } else {
      message.error('无法开启认证流程: ' + data.message)
    }
  })
}
async function checkStatus() {
  const data = await QueryGetAPI(BILI_AUTH_API_URL + 'status', {
    key: guidKey.value,
  })
  if (data.code == 201) {
    startModel.value = data.data as AuthStartModel
    checkTimeLeft()
    return true
  } else if (data.code == 200) {
    clearInterval(timer.value)
    message.success('认证成功')

    guidKey.value = uuidv4()
    useAuth.setCurrentAuth(data.data as string)

    currentStep.value = 2

    return true
  } else if (data.code == 400 && isStart.value) {
    timeOut.value = true
    clearInterval(timer.value)
    message.error('认证超时')
    return false
  }
  return false
}
function checkTimeLeft() {
  if (startModel.value) {
    timeLeft.value = startModel.value.endAt - Date.now()
    if (timeLeft.value <= 0) {
      timeOut.value = true
    }
  }
}
function copyCode() {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(startModel.value?.code ?? '')
    message.success('已复制认证码到剪切板')
  } else {
    message.warning('当前环境不支持自动复制, 请手动选择并复制')
  }
}

onMounted(async () => {
  if (!currentToken.value) {
    if (await checkStatus()) {
      currentStep.value = 1
      timer.value = setInterval(checkStatus, 5000)
    }
  }
})
</script>

<template>
  <NFlex
    justify="center"
    align="center"
    style="height: 100vh"
  >
    <NCard
      embedded
      style="margin: 20px; max-width: 1100px"
    >
      <template #header>
        Bilibili 身份验证
      </template>
      <NFlex :wrap="false">
        <NSteps
          :current="currentStep + 1"
          vertical
          style="max-width: 300px"
        >
          <NStep
            title="准备认证"
            description="就是开始认证前的一个步骤"
          />
          <NStep
            title="进行认证"
            description="你需要在指定直播间输入一串验证码来证明自己的身份"
          />
          <NStep
            title="认证完成"
            description="现在就已经通过了认证!"
          />
        </NSteps>
        <template v-if="currentStep == 1">
          <NSpace
            vertical
            justify="center"
            align="center"
            style="width: 100%"
          >
            <template v-if="!timeOut">
              <NSpin />
              <span> 剩余 <NCountdown :duration="timeLeft" /> </span>
              <NInputGroup>
                <NInput
                  :value="startModel?.code"
                  :allow-input="() => false"
                />
                <NButton @click="copyCode">
                  复制认证码
                </NButton>
              </NInputGroup>
              <NButton
                type="primary"
                tag="a"
                :href="'https://live.bilibili.com/' + startModel?.targetRoomId"
                target="_blank"
              >
                前往直播间
              </NButton>
            </template>
            <NAlert
              v-else
              type="error"
            >
              认证超时
              <NButton
                type="error"
                @click="
                  () => {
                    currentStep = 0
                    timeOut = false
                  }
                "
              >
                重新开始
              </NButton>
            </NAlert>
          </NSpace>
        </template>
        <template v-else-if="currentStep == 0">
          <NSpace
            vertical
            justify="center"
            align="center"
            style="width: 100%"
          >
            <NAlert type="info">
              <NText>
                点击
                <NText
                  type="primary"
                  strong
                >
                  开始认证
                </NText>
                后请在 5 分钟之内使用
                <NText
                  strong
                  type="primary"
                >
                  需要认证的账户
                </NText>
                在指定的直播间直播间内发送给出的验证码
              </NText>
            </NAlert>
            <NText
              depth="3"
              style="font-size: 15px"
            >
              准备好了吗?
            </NText>
            <NButton
              size="large"
              type="primary"
              @click="onStartVerify"
            >
              开始认证
            </NButton>
          </NSpace>
        </template>
        <template v-else-if="currentStep == 2">
          <NFlex
            justify="center"
            align="center"
            vertical
            style="width: 100%"
          >
            <NAlert type="success">
              你已完成验证! 请妥善保存你的登陆链接, 请勿让其他人获取. 丢失后可以再次通过认证流程获得. 把这个链接复制到浏览器打开即可登录
            </NAlert>
            <NText> 你的登陆链接为: </NText>
            <NInputGroup>
              <NInput
                :value="`${CURRENT_HOST}bili-user?auth=${currentToken}`"
                type="textarea"
                :allow-input="() => false"
              />
              <NButton
                type="info"
                style="height: 100%"
                @click="copyCode"
              >
                复制登陆链接
              </NButton>
            </NInputGroup>
            <NFlex>
              <NButton
                type="primary"
                @click="$router.push({ name: 'bili-user' })"
              >
                前往个人中心
              </NButton>
              <NPopconfirm
                positive-text="继续"
                @positive-click="
                  () => {
                    currentStep = 0
                    //@ts-ignore
                    currentToken = null
                    guidKey = uuidv4()
                  }
                "
              >
                <template #trigger>
                  <NButton type="warning">
                    认证其他账号
                  </NButton>
                </template>
                这将会登出当前已认证的账号, 请先在认证其他账号前保存你的登陆链接
              </NPopconfirm>
            </NFlex>
          </NFlex>
        </template>
      </NFlex>
    </NCard>
  </NFlex>
</template>
