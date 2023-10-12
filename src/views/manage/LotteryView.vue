<script setup lang="ts">
import { LotteryUserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { LOTTERY_API_URL, TURNSTILE_KEY } from '@/data/constants'
import { useLocalStorage } from '@vueuse/core'
import { randomInt } from 'crypto'
import { List } from 'linqts'
import {
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCollapseTransition,
  NCountdown,
  NDivider,
  NGrid,
  NGridItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NRadioButton,
  NRadioGroup,
  NSpace,
  NTabPane,
  NTabs,
  NTag,
  useMessage,
} from 'naive-ui'
import { breadcrumbLight } from 'naive-ui/es/breadcrumb/styles'
import { computed, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'

interface TempLotteryResponseModel {
  users: LotteryUserInfo[]
  createTime: number
  total: number
}
interface LotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half'
  needVIP: boolean
}

const message = useMessage()
const token = ref()
const turnstile = ref()
const defaultOption = {
  resultCount: 1,
  lotteryType: 'single',
  needVIP: false,
} as LotteryOption
const lotteryOption = useLocalStorage('Settings.LotteryOption', defaultOption)

const isLoading = ref(false)
const isLottering = ref(false)

const inputDynamic = ref<string>()
const inputDynamicId = computed(() => {
  try {
    var id = BigInt(inputDynamic.value ?? '')
    return id
  } catch {
    try {
      const url = new URL(inputDynamic.value ?? '')
      if (url.host.endsWith('bilibili.com')) {
        const sp = url.pathname.split('/')
        const id = BigInt(sp.length > 1 ? sp[sp.length - 1] : sp[0])
        return id
      }
    } catch {
      return null
    }
  }
  return null
})
const isCommentCountDown = ref(true)
const originCommentUsers = ref<TempLotteryResponseModel>()
const originForwardUsers = ref<TempLotteryResponseModel>()
const currentType = ref<'comment' | 'forward'>('comment')

const commentUsers = ref<TempLotteryResponseModel>()
const forwardUsers = ref<TempLotteryResponseModel>()

const currentUsers = computed(() => {
  switch (currentType.value) {
    case 'comment': {
      return commentUsers.value
    }
    case 'forward': {
      return forwardUsers.value
    }
  }
  return undefined
})

async function onGet() {
  switch (currentType.value) {
    case 'comment': {
      await getCommentsUsers()
      break
    }
    case 'forward': {
      await getForwardUsers()
      break
    }
  }
  currentUsers.value?.users.forEach((u) => (u.visiable = true))
}
async function getCommentsUsers() {
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(
    LOTTERY_API_URL + 'comments',
    {
      id: inputDynamicId.value,
    },
    [['Turnstile', token.value]]
  )
    .then((data) => {
      if (data.code == 200) {
        originCommentUsers.value = data.data
        commentUsers.value = data.data
        isCommentCountDown.value = false
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
      isLoading.value = false
    })
}
async function getForwardUsers() {
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(
    LOTTERY_API_URL + 'forward',
    {
      id: inputDynamicId.value,
    },
    [['Turnstile', token.value]]
  )
    .then((data) => {
      if (data.code == 200) {
        originForwardUsers.value = data.data
        forwardUsers.value = data.data
        isCommentCountDown.value = false
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
      isLoading.value = false
    })
}
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max)
}
function startLottery() {
  if (!isLottering.value && currentUsers.value) {
    isLottering.value = true
    try {
      const data = currentUsers.value
      const users = data.users.filter((u) => {
        if (lotteryOption.value.needVIP) {
          return u.isVIP == true
        }
      })
      switch (lotteryOption.value.lotteryType) {
        case 'single': {
          console.log('开始抽取单个用户')
          const removed = [] as number[]
          removeSingleUser()
          function removeSingleUser() {
            if (data.users.length > lotteryOption.value.resultCount) {
              console.log(`[${data.users.length}] 移除` + data.users.splice(getRandomInt(data.users.length), 1)[0].name)
              setTimeout(() => {
                removeSingleUser()
              }, 500)
            } else {
              isLottering.value = false
            }
          }
          break
        }
      }
    } catch (err) {
      console.error(err)
      message.error('发生错误')
    }
  }
}
</script>
<template>
  <NCard size="medium" embedded title="抽奖">
    <NInput v-model:value="inputDynamic" placeholder="动态链接或直接输入动态Id" :status="inputDynamicId ? 'success' : 'warning'" />
    <NDivider style="margin: 10px 0 10px 0" />
    <NCard size="small" embedded title="选项">
      <template #header-extra>
        <NButton size="small" secondary @click="lotteryOption = defaultOption"> 恢复默认 </NButton>
      </template>
      <NSpace justify="center">
        <NRadioGroup v-model:value="currentType" name="用户类型">
          <NRadioButton value="comment"> 评论 </NRadioButton>
          <NRadioButton value="forward"> 转发 </NRadioButton>
        </NRadioGroup>
      </NSpace>
      <NSpace align="center">
        <NInputGroup style="max-width: 200px">
          <NInputGroupLabel> 抽选人数 </NInputGroupLabel>
          <NInputNumber v-model:value="lotteryOption.resultCount" placeholder="" min="1" />
        </NInputGroup>
        <NCheckbox> 是否大会员 </NCheckbox>
        <NRadioGroup v-model:value="lotteryOption.lotteryType" name="抽取类型">
          <NRadioButton value="single"> 单个 </NRadioButton>
          <NRadioButton value="half"> 减半 </NRadioButton>
        </NRadioGroup>
      </NSpace>
    </NCard>
    <NDivider style="margin: 10px 0 10px 0" />
    <NSpace justify="center" align="center">
      <NButton :disabled="!inputDynamicId || !isCommentCountDown || !token || isLottering" :loading="!token || isLoading" @click="onGet" type="primary"> 加载用户 </NButton>
      <NCountdown v-if="!isCommentCountDown" :duration="(currentUsers?.createTime ?? -1) + 60000 - Date.now()" @finish="isCommentCountDown = true" />
    </NSpace>
    <NDivider style="margin: 10px 0 10px 0" />
    <template v-if="currentUsers">
      <NSpace justify="space-between">
        <span> 共 {{ currentUsers.users.length }} 人 </span>
      </NSpace>
      <NSpace justify="center">
        <NButton type="primary" @click="startLottery" secondary :loading="isLottering"> 开始抽取 </NButton>
      </NSpace>
      <NDivider style="margin: 10px 0 10px 0" />
      <NGrid cols="1 400:2 700:3 800:4" :x-gap="12" :y-gap="8">
        <NGridItem v-for="item in currentUsers.users" v-bind:key="item.uId" :span="item.visiable ? 1 : 0">
          <NCard size="small" :title="item.name">
            <template #header>
              <NSpace align="center">
                <NAvatar round lazy :src="item.avatar + '@64w_64h'" :img-props="{ referrerpolicy: 'no-referrer' }" />
                <NTag v-if="item.level" size="tiny">
                  {{ item.level }}
                </NTag>
                {{ item.name }}

                <NTag v-if="item.card" size="tiny">
                  {{ item.card.level }}
                  {{ item.card.name }}
                </NTag>
              </NSpace>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
    </template>
  </NCard>
  <VueTurnstile ref="turnstile" :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
</template>
