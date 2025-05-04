<script setup lang="ts">
import { QueryGetAPI } from '@/api/query'
import { BILI_AUTH_API_URL, CURRENT_HOST } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'
import { useStorage, useBreakpoints as useVueUseBreakpoints, breakpointsTailwind } from '@vueuse/core'
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
  useMessage,
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
const breakpoints = useVueUseBreakpoints(breakpointsTailwind)
const isSmallScreen = breakpoints.smaller('sm')

const guidKey = useStorage('Bili.Auth.Key', uuidv4())
const currentToken = useStorage<string>('Bili.Auth.Selected', null)
const useAuth = useBiliAuth()

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
  const textToCopy = currentStep.value === 2
    ? `${CURRENT_HOST}bili-user?auth=${currentToken.value}`
    : startModel.value?.code ?? ''

  if (navigator.clipboard && textToCopy) {
    navigator.clipboard.writeText(textToCopy)
    message.success(currentStep.value === 2 ? '已复制登陆链接到剪切板' : '已复制认证码到剪切板')
  } else {
    message.warning('无法复制内容, 请手动选择并复制')
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
    style="min-height: 100vh; padding: 20px; box-sizing: border-box"
  >
    <NCard
      embedded
      style="width: 100%; max-width: 1000px"
    >
      <template #header>
        <NText style="font-size: 1.2em; font-weight: bold">
          Bilibili 身份验证
        </NText>
      </template>
      <NFlex
        :wrap="false"
        :vertical="isSmallScreen"
      >
        <NSteps
          :current="currentStep + 1"
          vertical
          style="min-width: 200px; max-width: 300px; margin-bottom: 20px"
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
        <div style="flex-grow: 1; padding-left: 20px; border-left: 1px solid var(--n-border-color); min-width: 0;">
          <template v-if="currentStep == 1">
            <NFlex
              vertical
              justify="center"
              align="center"
              style="width: 100%; height: 100%; padding-top: 20px; min-height: 250px;"
            >
              <template v-if="!timeOut">
                <NSpin size="large" />
                <NText style="margin-top: 15px; font-size: 1.1em;">
                  剩余时间：<NCountdown :duration="timeLeft" />
                </NText>
                <NText
                  depth="3"
                  style="margin-top: 20px;"
                >
                  请复制下方的认证码，并前往指定直播间发送：
                </NText>
                <NInputGroup style="margin-top: 10px; max-width: 300px;">
                  <NInput
                    :value="startModel?.code"
                    readonly
                    placeholder="认证码"
                    style="text-align: center; font-size: 1.2em; letter-spacing: 2px;"
                  />
                  <NButton
                    type="primary"
                    @click="copyCode"
                  >
                    复制
                  </NButton>
                </NInputGroup>
                <NButton
                  type="info"
                  tag="a"
                  :href="'https://live.bilibili.com/' + startModel?.targetRoomId"
                  target="_blank"
                  style="margin-top: 20px"
                >
                  前往直播间
                </NButton>
              </template>
              <NAlert
                v-else
                type="error"
                title="认证超时"
                style="width: 100%; max-width: 400px;"
              >
                <NFlex justify="center">
                  <NButton
                    type="error"
                    style="margin-top: 10px"
                    @click="
                      () => {
                        currentStep = 0
                        timeOut = false
                      }
                    "
                  >
                    重新开始认证
                  </NButton>
                </NFlex>
              </NAlert>
            </NFlex>
          </template>
          <template v-else-if="currentStep == 0">
            <NSpace
              vertical
              align="stretch"
              style="width: 100%; padding-top: 10px"
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
              <NFlex
                justify="center"
                style="margin-top: 20px"
              >
                <NButton
                  size="large"
                  type="primary"
                  @click="onStartVerify"
                >
                  开始认证
                </NButton>
              </NFlex>
            </NSpace>
          </template>
          <template v-else-if="currentStep == 2">
            <NSpace
              vertical
              align="stretch"
              style="width: 100%; padding-top: 10px"
            >
              <NAlert
                type="success"
                title="验证成功！"
                style="margin-bottom: 15px"
              >
                你已完成验证! 请妥善保存你的登陆链接, 请勿让其他人获取. 丢失后可以再次通过认证流程获得.
                <br>
                要在其他地方登陆, 或者需要重新登陆的话把这个链接复制到浏览器地址栏打开即可
              </NAlert>
              <NText strong>
                你的登陆链接为:
              </NText>
              <NInput
                :value="`${CURRENT_HOST}bili-user?auth=${currentToken}`"
                type="textarea"
                readonly
                style="margin-top: 5px"
              />
              <NFlex
                justify="end"
                style="margin-top: 10px"
              >
                <NButton
                  type="primary"
                  @click="copyCode"
                >
                  复制登陆链接
                </NButton>
              </NFlex>
              <NFlex
                justify="center"
                style="margin-top: 20px"
                :wrap="true"
              >
                <NButton
                  type="primary"
                  @click="$router.push({ name: 'bili-user' })"
                >
                  前往个人中心
                </NButton>
                <NPopconfirm
                  positive-text="继续"
                  negative-text="取消"
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
            </NSpace>
          </template>
        </div>
      </NFlex>
    </NCard>
  </NFlex>
</template>
