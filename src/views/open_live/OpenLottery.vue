<script setup lang="ts">
import { computed, h, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { QueryPostAPI } from '@/api/query'
import { OPEN_LIVE_API_URL } from '@/data/constants'
import { LotteryUserInfo, OpenLiveInfo } from '@/api/api-models'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCollapseTransition,
  NDivider,
  NEmpty,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLayoutContent,
  NList,
  NListItem,
  NModal,
  NRadioButton,
  NRadioGroup,
  NResult,
  NScrollbar,
  NSpace,
  NSpin,
  NTag,
  NTime,
  NTooltip,
  useMessage,
  useNotification,
} from 'naive-ui'
import { useAccount } from '@/api/account'
import ChatClientDirectOpenLive from '@/data/chat/ChatClientDirectOpenLive.js'
import { useLocalStorage, useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { Delete24Filled, Info24Filled } from '@vicons/fluent'

interface AuthInfo {
  Timestamp: string
  Code: string
  Mid: string
  Caller: string
  CodeSign: string
}
interface OpenLiveLotteryBaseUserInfo {
  name: string
  uId: number
  level?: number
  avatar: string
}
interface OpenLiveLotteryUserInfo extends OpenLiveLotteryBaseUserInfo {
  fans_medal_level: number
  fans_medal_name: string //粉丝勋章名
  fans_medal_wearing_status: boolean //该房间粉丝勋章佩戴情况
  guard_level: number
}
interface LotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half'
  type: 'danmaku' | 'gift'
  danmakuFilterType: 'all' | 'contains' | 'regex'
  danmakuKeyword: string
  needFanMedal: boolean
  needWearFanMedal: false
  needGuard: boolean
  fanCardLevel?: number
  giftMinPrice?: number
  giftName?: string
}
interface LotteryHistory {
  users: OpenLiveLotteryBaseUserInfo[]
  time: number
}
const CMD_CALLBACK_MAP = {
  LIVE_OPEN_PLATFORM_DM: onDanmaku,
  LIVE_OPEN_PLATFORM_SEND_GIFT: onGift,
}
const defaultOption = {
  resultCount: 1,
  type: 'danmaku',
  lotteryType: 'single',
  danmakuFilterType: 'all',
  needFanMedal: false,
  needWearFanMedal: false,
  needGuard: false,
  fanCardLevel: 1,
} as LotteryOption
const lotteryOption = useLocalStorage('Settings.OpenLive.LotteryOption', defaultOption)
const lotteryHistory = useStorage<LotteryHistory[]>('OpenLive.LotteryHistory', [])

const route = useRoute()
const message = useMessage()
const accountInfo = useAccount()
const notification = useNotification()

const authInfo = ref<AuthInfo>()
const authResult = ref<OpenLiveInfo | null>(null)

const originUsers = ref<OpenLiveLotteryUserInfo[]>([])
const currentUsers = ref<OpenLiveLotteryUserInfo[]>([])
const resultUsers = ref<OpenLiveLotteryUserInfo[]>([])
const isStartLottery = ref(false)
const isLottering = ref(false)
const isLotteried = ref(false)
const isConnected = ref(false)
const showModal = ref(false)

let chatClient: any

async function get() {
  try {
    const data = await QueryPostAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'start', authInfo.value?.Code ? authInfo.value : undefined)
    if (data.code == 200) {
      console.log('[OPEN-LIVE] 已获取场次信息')
      return data.data
    } else {
      message.error('无法获取场次数据: ' + data.message)
      return null
    }
  } catch (err) {
    console.error(err)
  }
  return null
}
async function start() {
  if (!chatClient) {
    const auth = await get()
    if (auth) {
      authResult.value = auth
    } else {
      return
    }
    initChatClient()
    isConnected.value = true
    setInterval(() => {
      QueryPostAPI<OpenLiveInfo>(OPEN_LIVE_API_URL + 'heartbeat', authInfo.value)
    }, 20 * 1000)
  }
}
async function initChatClient() {
  chatClient = new ChatClientDirectOpenLive(authResult.value)

  //chatClient.msgHandler = this;
  chatClient.CMD_CALLBACK_MAP = CMD_CALLBACK_MAP
  chatClient.start()
  console.log('[OPEN-LIVE] 已连接房间: ' + authResult.value?.anchor_info.room_id)
}
function addUser(user: OpenLiveLotteryUserInfo, danmu: any) {
  if (originUsers.value.find((u) => u.uId == user.uId)) {
    return
  }
  if (isUserValid(user, danmu)) {
    originUsers.value.push(user)
    currentUsers.value.push(user)
    console.log(`[OPEN-LIVE-Lottery] ${user.name} 添加到队列中`)
  } else {
    console.log(`[OPEN-LIVE-Lottery] ${user.name} 因不符合条件而被忽略`)
  }
}
function isUserValid(u: OpenLiveLotteryUserInfo, danmu: any) {
  const cmd = danmu.cmd
  const data = danmu.data
  if (lotteryOption.value.needWearFanMedal) {
    if (!u.fans_medal_wearing_status) return false
  }
  if (lotteryOption.value.needFanMedal) {
    if (u.fans_medal_level == 0) return false
  }
  if (lotteryOption.value.needGuard) {
    if (u.guard_level == 0) return false
  }
  if (lotteryOption.value.danmakuKeyword && cmd === 'LIVE_OPEN_PLATFORM_DM') {
    if (lotteryOption.value.danmakuFilterType == 'contains') {
      if (!data.msg.includes(lotteryOption.value.danmakuKeyword)) return false
    } else if (lotteryOption.value.danmakuFilterType == 'regex') {
      if (!data.msg.match(lotteryOption.value.danmakuKeyword)) return false
    } else {
      if (data.msg != lotteryOption.value.danmakuKeyword) return false
    }
  }
  if ((lotteryOption.value.giftMinPrice ?? 0) > 0 && cmd == 'LIVE_OPEN_PLATFORM_SEND_GIFT') {
    if ((data.price * data.gift_num) / 1000 < (lotteryOption.value.giftMinPrice ?? 0)) return false
  }
  if (lotteryOption.value.giftName && cmd == 'LIVE_OPEN_PLATFORM_SEND_GIFT') {
    if (data.gift_name != lotteryOption.value.giftName) return false
  }
  return true
}
function startLottery() {
  if (!isLottering.value && originUsers.value) {
    isLottering.value = true
    try {
      if (originUsers.value.length < lotteryOption.value.resultCount) {
        message.warning('符合条件的抽奖人数达不到抽选人数')
        isLottering.value = false
        return
      }

      switch (lotteryOption.value.lotteryType) {
        case 'single': {
          console.log('开始抽取单个用户')
          removeSingleUser()
          function removeSingleUser() {
            if (currentUsers.value.length > lotteryOption.value.resultCount) {
              console.log(`[${currentUsers.value.length}] 移除` + currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name)
              setTimeout(() => {
                removeSingleUser()
              }, 500)
            } else {
              onFinishLottery()
            }
          }
          break
        }
        case 'half': {
          //每次点击随机减少一半的用户, 如果人数减半后达不到最低用户, 则减少至最低用户
          if (currentUsers.value.length / 2 <= lotteryOption.value.resultCount) {
            console.log(`[OPEN-LIVE-Lottery] 人数减半至${lotteryOption.value.resultCount}人`)
            while (currentUsers.value.length > lotteryOption.value.resultCount) {
              console.log(`[${currentUsers.value.length}] 移除` + currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name)
            }
            onFinishLottery()
          } else {
            const half = Math.floor(currentUsers.value.length / 2)
            console.log(`[OPEN-LIVE-Lottery] 人数减半至${half}人`)
            message.success('人数减半至 ' + half + ' 人')
            while (currentUsers.value.length > half) {
              console.log(`[${currentUsers.value.length}] 移除` + currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name)
            }
          }
          isLottering.value = false
        }
      }
    } catch (err) {
      console.error(err)
      message.error('发生错误')
    }
  }
}
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max)
}
function onFinishLottery() {
  resultUsers.value = JSON.parse(JSON.stringify(currentUsers.value))
  isLottering.value = false
  isLotteried.value = true
  notification.create({
    title: '抽奖完成',
    description: '共' + resultUsers.value?.length + '人',
    duration: 3000,
    content: () =>
      h(NSpace, { vertical: true }, () =>
        resultUsers.value?.map((user) => h(NSpace, null, () => [h(NAvatar, { src: user.avatar + '@32w_32h', imgProps: { referrerpolicy: 'no-referrer' } }), h('span', user.name)]))
      ),
    meta: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    onAfterLeave: () => {
      message.success('已保存至历史')
    },
  })
  lotteryHistory.value.push({
    users: currentUsers.value ?? [],
    time: Date.now(),
  })
}
function reset() {
  currentUsers.value = JSON.parse(JSON.stringify(originUsers.value))
  isLotteried.value = false
}
function clear() {
  originUsers.value = []
  isLotteried.value = false
  resultUsers.value = []
  currentUsers.value = []
  message.success('已清空队列')
}
function removeUser(user: OpenLiveLotteryUserInfo) {
  currentUsers.value = currentUsers.value.filter((u) => u.uId != user.uId)
  originUsers.value = originUsers.value.filter((u) => u.uId != user.uId)
}

function onDanmaku(command: any) {
  const data = command.data
  addUser(
    {
      uId: data.uid,
      name: data.uname,
      avatar: data.uface,
      fans_medal_level: data.fans_medal_level,
      fans_medal_name: data.fans_medal_name,
      fans_medal_wearing_status: data.fans_medal_wearing_status,
      guard_level: data.guard_level,
    },
    command
  )
}
function onGift(command: any) {
  const data = command.data
  addUser(
    {
      uId: data.uid,
      name: data.uname,
      avatar: data.uface,
      fans_medal_level: data.fans_medal_level,
      fans_medal_name: data.fans_medal_name,
      fans_medal_wearing_status: data.fans_medal_wearing_status,
      guard_level: data.guard_level,
    },
    command
  )
}
function pause() {
  isStartLottery.value = false
  message.info('已暂停新用户加入')
}
function continueLottery() {
  isStartLottery.value = true
  message.info('开始监听')
}

onMounted(() => {
  authInfo.value = route.query as unknown as AuthInfo
})
</script>

<template>
  <NLayoutContent style="height: 100vh">
    <NResult v-if="!authInfo?.Code && !accountInfo" status="403" title="403" description="该页面只能从饭贩访问或者注册用户使用" />
    <template v-else>
      <NCard style="margin: 20px">
        <template #header>
          直播抽奖
          <NDivider vertical />
          <NButton text type="primary" tag="a" href="https://vtsuru.live" target="_blank"> 前往 VTsuru.live 主站 </NButton>
        </template>
        <NAlert v-if="!authInfo?.Code && accountInfo && !accountInfo.isBiliVerified" type="error"> 请先绑定B站账号 </NAlert>
        <NAlert v-else-if="!authInfo?.Code && accountInfo && accountInfo.biliAuthCodeStatus != 1" type="error"> 身份码状态异常, 请重新绑定 </NAlert>
        <NCard>
          <NSpace align="center">
            连接状态:
            <NTag :type="isConnected ? 'success' : 'warning'"> {{ isConnected ? `已连接 | ${authResult?.anchor_info.uname}` : '未连接' }} </NTag>
            <NButton v-if="!isConnected" type="primary" @click="start" size="small" :disabled="!authInfo?.Code && (!accountInfo?.isBiliVerified || accountInfo.biliAuthCodeStatus != 1)">
              连接直播间
            </NButton>
            <NButton type="info" @click="showModal = true" size="small"> 抽奖历史</NButton>
          </NSpace>
        </NCard>
        <NCard size="small" embedded title="抽奖选项">
          <template #header-extra>
            <NButton size="small" secondary @click="lotteryOption = defaultOption" :disabled="isStartLottery"> 恢复默认 </NButton>
          </template>
          <NSpace justify="center" align="center">
            <NTag :bordered="false"> 抽奖类型 </NTag>
            <NRadioGroup v-model:value="lotteryOption.type" :disabled="isLottering" size="small">
              <NRadioButton value="danmaku" :disabled="isStartLottery"> 弹幕 </NRadioButton>
              <NRadioButton value="gift" :disabled="isStartLottery"> 礼物 </NRadioButton>
            </NRadioGroup>
          </NSpace>
          <NDivider style="margin: 10px 0 10px 0"></NDivider>
          <NSpace align="center">
            <NInputGroup style="max-width: 200px">
              <NInputGroupLabel> 抽选人数 </NInputGroupLabel>
              <NInputNumber :disabled="isStartLottery" v-model:value="lotteryOption.resultCount" placeholder="" min="1" />
            </NInputGroup>
            <NCheckbox :disabled="isStartLottery" v-model:checked="lotteryOption.needGuard"> 需要上舰 </NCheckbox>
            <NCheckbox :disabled="isStartLottery" v-model:checked="lotteryOption.needFanMedal"> 需要粉丝牌 </NCheckbox>
            <template v-if="lotteryOption.type == 'danmaku'">
              <NCollapseTransition>
                <NInputGroup v-if="lotteryOption.needFanMedal" style="max-width: 200px">
                  <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
                  <NInputNumber v-model:value="lotteryOption.fanCardLevel" min="1" max="50" :default-value="1" :disabled="isLottering || isStartLottery" />
                </NInputGroup>
              </NCollapseTransition>
              <NTooltip>
                <template #trigger>
                  <NInputGroup style="max-width: 250px">
                    <NInputGroupLabel> 弹幕内容 </NInputGroupLabel>
                    <NInput :disabled="isStartLottery" v-model:value="lotteryOption.danmakuKeyword" placeholder="留空则任何弹幕都可以" />
                  </NInputGroup>
                </template>
                符合规则的弹幕才会被添加到抽奖队列中
              </NTooltip>
              <NRadioGroup v-model:value="lotteryOption.danmakuFilterType" name="判定类型" :disabled="isLottering" size="small">
                <NRadioButton :disabled="isStartLottery" value="all"> 完全一致 </NRadioButton>
                <NRadioButton :disabled="isStartLottery" value="contains"> 包含 </NRadioButton>
                <NRadioButton :disabled="isStartLottery" value="regex"> 正则 </NRadioButton>
              </NRadioGroup>
            </template>
            <template v-else-if="lotteryOption.type == 'gift'">
              <NInputGroup style="max-width: 250px">
                <NInputGroupLabel> 最低价格 </NInputGroupLabel>
                <NInputNumber :disabled="isStartLottery" v-model:value="lotteryOption.giftMinPrice" placeholder="留空则不限制" />
              </NInputGroup>
              <NInputGroup style="max-width: 200px">
                <NInputGroupLabel> 礼物名称 </NInputGroupLabel>
                <NInput :disabled="isStartLottery" v-model:value="lotteryOption.giftName" placeholder="留空则不限制" />
              </NInputGroup>
            </template>
          </NSpace>
          <NDivider style="margin: 10px 0 10px 0"></NDivider>
          <NSpace justify="center" align="center">
            <NTag :bordered="false"> 抽取方式 </NTag>
            <NRadioGroup v-model:value="lotteryOption.lotteryType" name="抽取类型" size="small" :disabled="isLottering">
              <NRadioButton value="single">
                单个
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  一个一个减少
                </NTooltip>
              </NRadioButton>
              <NRadioButton value="half">
                减半
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  点一次减少一半
                </NTooltip>
              </NRadioButton>
            </NRadioGroup>
          </NSpace>
        </NCard>
        <NCard v-if="originUsers" size="small">
          <NSpace justify="center" align="center">
            <NTag :bordered="false" type="warning" v-if="!isConnected"> 开始前需要先连接直播间 </NTag>
            <NSpin v-if="isStartLottery" size="small" />
            <NButton type="primary" @click="continueLottery" :loading="isLottering" :disabled="isStartLottery || isLotteried || !isConnected"> 开始 </NButton>
            <NButton type="warning" :disabled="!isStartLottery" @click="pause"> 停止 </NButton>
            <NButton type="error" :disabled="isLottering || originUsers.length == 0" @click="clear"> 清空 </NButton>
          </NSpace>
          <NDivider style="margin: 20px 0 20px 0"> <template v-if="isStartLottery"> 进行抽取前需要先停止 </template> </NDivider>
          <NSpace justify="center">
            <NButton type="primary" secondary @click="startLottery" :loading="isLottering" :disabled="isStartLottery || isLotteried"> 进行抽取 </NButton>
            <NButton type="info" secondary :disabled="isStartLottery || isLottering || !isLotteried" @click="reset"> 重置 </NButton>
          </NSpace>
          <NDivider style="margin: 10px 0 10px 0"> 共 {{ currentUsers?.length }} 人</NDivider>
          <NGrid v-if="currentUsers.length > 0" cols="1 500:2 800:3 1000:4" :x-gap="12" :y-gap="8">
            <NGridItem v-for="item in currentUsers" v-bind:key="item.uId">
              <NCard size="small" :title="item.name" style="height: 155px">
                <template #header>
                  <NSpace align="center" vertical :size="5">
                    <NAvatar round lazy borderd :size="64" :src="item.avatar + '@64w_64h'" :img-props="{ referrerpolicy: 'no-referrer' }" style="box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2)" />
                    <NSpace>
                      <NTag size="tiny" round>
                        <NTag size="tiny" round :bordered="false">
                          {{ item.fans_medal_level }}
                        </NTag>
                        <span style="color: #577fb8">
                          {{ item.fans_medal_name }}
                        </span>
                      </NTag>
                    </NSpace>
                    {{ item.name }}
                  </NSpace>

                  <NButton style="position: absolute; right: 5px; top: 5px; color: #753e3e" @click="removeUser(item)" size="small" circle>
                    <template #icon>
                      <NIcon :component="Delete24Filled" />
                    </template>
                  </NButton>
                </template>
              </NCard>
            </NGridItem>
          </NGrid>
          <NEmpty v-else description="暂无用户" />
        </NCard>
        <NSpace justify="center" style="margin-top: 20px">
          <NButton type="info" text tag="a" href="https://vtsuru.live" target="_blank"> vtsuru.live </NButton>
        </NSpace>
      </NCard>
    </template>
    <NModal v-model:show="showModal" preset="card" title="抽奖结果" style="max-width: 90%; width: 800px" closable>
      <template #header-extra>
        <NButton type="error" size="small" @click="lotteryHistory = []"> 清空 </NButton>
      </template>
      <NScrollbar v-if="lotteryHistory.length > 0" style="max-height: 80vh">
        <NList>
          <NListItem v-for="item in lotteryHistory" :key="item.time">
            <NCard size="small">
              <template #header>
                <NTime :time="item.time" />
              </template>
              <template #header-extra>
                <NButton type="error" size="small" @click="lotteryHistory.splice(lotteryHistory.indexOf(item), 1)"> 删除 </NButton>
              </template>
              <NSpace vertical>
                <NSpace v-for="user in item.users" :key="user.uId">
                  <NAvatar round lazy :src="user.avatar + '@64w_64h'" :img-props="{ referrerpolicy: 'no-referrer' }" />
                  {{ user.name }}
                </NSpace>
              </NSpace>
            </NCard>
          </NListItem>
        </NList>
      </NScrollbar>
      <NEmpty v-else description="暂无记录" />
    </NModal>
  </NLayoutContent>
</template>
