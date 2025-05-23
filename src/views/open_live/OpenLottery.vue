<script setup lang="ts">
import { useAccount } from '@/api/account'
import { OpenLiveInfo, OpenLiveLotteryType, OpenLiveLotteryUserInfo, UpdateLiveLotteryUsersModel } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { CURRENT_HOST, LOTTERY_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { Delete24Filled, Info24Filled } from '@vicons/fluent'
import { useLocalStorage, useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCollapse,
  NCollapseItem,
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
  NLi,
  NList,
  NListItem,
  NModal,
  NRadioButton,
  NRadioGroup,
  NResult,
  NScrollbar,
  NSpace,
  NTag,
  NTime,
  NTooltip,
  NUl,
  useMessage,
  useNotification,
} from 'naive-ui'
import { h, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import LiveLotteryOBS from '../obs/LiveLotteryOBS.vue'
import { DanmakuInfo, GiftInfo } from '@/data/DanmakuClients/OpenLiveClient'

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
  users: OpenLiveLotteryUserInfo[]
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
const client = await useDanmakuClient().initOpenlive()

const originUsers = ref<OpenLiveLotteryUserInfo[]>([])
const currentUsers = ref<OpenLiveLotteryUserInfo[]>([])
const resultUsers = ref<OpenLiveLotteryUserInfo[]>([])
const isStartLottery = ref(false)
const isLottering = ref(false)
const isLotteried = ref(false)
const showModal = ref(false)
const showOBSModal = ref(false)

const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()

const refinedCode = computed(() => {
  if (props.code) {
    return props.code
  }
  return accountInfo.value?.biliAuthCode ?? window.$route.query.code?.toString()
})

async function getUsers() {
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(LOTTERY_API_URL + 'live/get-users', {
      code: props.code,
    })
    if (data.code == 200) {
      return data.data
    }
  } catch (err) { }
  return null
}
function updateUsers() {
  QueryPostAPI(LOTTERY_API_URL + 'live/update-users', {
    code: props.code,
    users: originUsers.value,
    resultUsers: resultUsers.value,
    type: isLotteried.value ? OpenLiveLotteryType.Result : OpenLiveLotteryType.Waiting,
  }).catch((err) => {
    console.error('[OPEN-LIVE-Lottery] 更新历史抽奖用户失败')
  })
}
function addUser(user: OpenLiveLotteryUserInfo, danmu: any) {
  if (originUsers.value.find((u) => u.openId == user.openId) || !isStartLottery.value) {
    return
  }
  if (isUserValid(user, danmu) && !originUsers.value.find((u) => u.openId == user.openId)) {
    originUsers.value.push(user)
    currentUsers.value.push(user)
    console.log(`[OPEN-LIVE-Lottery] ${user.name} 添加到队列中`)
    updateUsers()
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
              console.log(
                `[${currentUsers.value.length}] 移除` +
                currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name,
              )
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
              console.log(
                `[${currentUsers.value.length}] 移除` +
                currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name,
              )
            }
            onFinishLottery()
          } else {
            const half = Math.floor(currentUsers.value.length / 2)
            console.log(`[OPEN-LIVE-Lottery] 人数减半至${half}人`)
            message.success('人数减半至 ' + half + ' 人')
            while (currentUsers.value.length > half) {
              console.log(
                `[${currentUsers.value.length}] 移除` +
                currentUsers.value.splice(getRandomInt(currentUsers.value.length), 1)[0].name,
              )
            }
          }
          isLottering.value = false
        }
      }
    } catch (err) {
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
        resultUsers.value?.map((user) =>
          h(NSpace, null, () => [
            h(NAvatar, { src: user.avatar + '@32w_32h', imgProps: { referrerpolicy: 'no-referrer' } }),
            h('span', user.name),
          ]),
        ),
      ),
    meta: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    onAfterLeave: () => {
      message.success('已保存至历史')
    },
  })
  updateUsers()
  lotteryHistory.value.push({
    users: currentUsers.value ?? [],
    time: Date.now(),
  })
}
function reset() {
  currentUsers.value = JSON.parse(JSON.stringify(originUsers.value))
  isLotteried.value = false
  updateUsers()
}
function clear() {
  originUsers.value = []
  isLotteried.value = false
  resultUsers.value = []
  currentUsers.value = []
  message.success('已清空队列')

  updateUsers()
}
function removeUser(user: OpenLiveLotteryUserInfo) {
  currentUsers.value = currentUsers.value.filter((u) => u.openId != user.openId)
  originUsers.value = originUsers.value.filter((u) => u.openId != user.openId)

  updateUsers()
}

function onDanmaku(data: DanmakuInfo, command: any) {
  if (lotteryOption.value.type == 'danmaku') {
    addUser(
      {
        uId: data.uid,
        openId: data.open_id,
        name: data.uname,
        avatar: data.uface,
        fans_medal_level: data.fans_medal_level,
        fans_medal_name: data.fans_medal_name,
        fans_medal_wearing_status: data.fans_medal_wearing_status,
        guard_level: data.guard_level,
      },
      command,
    )
  }
}
function onGift(data: GiftInfo, command: any) {
  if (lotteryOption.value.type == 'gift') {
    addUser(
      {
        uId: data.uid,
        openId: data.open_id,
        name: data.uname,
        avatar: data.uface,
        fans_medal_level: data.fans_medal_level,
        fans_medal_name: data.fans_medal_name,
        fans_medal_wearing_status: data.fans_medal_wearing_status,
        guard_level: data.guard_level,
      },
      command,
    )
  }
}
function pause() {
  isStartLottery.value = false
  message.info('已暂停新用户加入')
}
function continueLottery() {
  isStartLottery.value = true
  message.info('开始监听')
}

let timer: any
onMounted(async () => {
  if (props.code) {
    const users = (await getUsers())?.users ?? []
    originUsers.value = users
    currentUsers.value = JSON.parse(JSON.stringify(users))
    console.log('[OPEN-LIVE-Lottery] 从历史记录中加载 ' + users.length + ' 位用户')
    if (users.length > 0) {
      message.info('从历史记录中加载 ' + users.length + ' 位用户')
    }
  }
  client?.on('danmaku', onDanmaku)
  client?.on('gift', onGift)
  timer = setInterval(updateUsers, 1000 * 10)
})
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
  client?.off('danmaku', onDanmaku)
  client?.off('gift', onGift)
})
</script>

<template>
  <NResult
    v-if="!code && !accountInfo"
    status="403"
    title="403"
    description="该页面只能从幻星平台访问或者注册用户使用"
  />
  <template v-else>
    <NCard>
      <template #header>
        直播抽奖
        <NDivider vertical />
        <NButton
          text
          type="primary"
          tag="a"
          href="https://vtsuru.live"
          target="_blank"
        >
          前往 VTsuru.live 主站
        </NButton>
      </template>
      <NAlert
        v-if="!code && accountInfo && !accountInfo.isBiliVerified"
        type="error"
      >
        请先绑定B站账号
      </NAlert>
      <NAlert
        v-else-if="!code && accountInfo && accountInfo.biliAuthCodeStatus != 1"
        type="error"
      >
        身份码状态异常, 请重新绑定
      </NAlert>
      <NCard>
        <NSpace align="center">
          <NButton
            type="info"
            size="small"
            @click="showModal = true"
          >
            抽奖历史
          </NButton>
          <NButton
            type="success"
            size="small"
            @click="showOBSModal = true"
          >
            OBS组件
          </NButton>
        </NSpace>
      </NCard>
      <NCard
        size="small"
        embedded
        title="抽奖选项"
      >
        <template #header-extra>
          <NButton
            size="small"
            secondary
            :disabled="isStartLottery"
            @click="lotteryOption = defaultOption"
          >
            恢复默认
          </NButton>
        </template>
        <NSpace
          justify="center"
          align="center"
        >
          <NTag :bordered="false">
            抽奖类型
          </NTag>
          <NRadioGroup
            v-model:value="lotteryOption.type"
            :disabled="isLottering"
            size="small"
          >
            <NRadioButton
              value="danmaku"
              :disabled="isStartLottery"
            >
              弹幕
            </NRadioButton>
            <NRadioButton
              value="gift"
              :disabled="isStartLottery"
            >
              礼物
            </NRadioButton>
          </NRadioGroup>
        </NSpace>
        <NDivider style="margin: 10px 0 10px 0" />
        <NSpace align="center">
          <NInputGroup style="max-width: 200px">
            <NInputGroupLabel> 抽选人数 </NInputGroupLabel>
            <NInputNumber
              v-model:value="lotteryOption.resultCount"
              :disabled="isStartLottery"
              placeholder=""
              min="1"
            />
          </NInputGroup>
          <NCheckbox
            v-model:checked="lotteryOption.needGuard"
            :disabled="isStartLottery"
          >
            需要上舰
          </NCheckbox>
          <NCheckbox
            v-model:checked="lotteryOption.needFanMedal"
            :disabled="isStartLottery"
          >
            需要粉丝牌
          </NCheckbox>
          <NCollapseTransition>
            <NInputGroup
              v-if="lotteryOption.needFanMedal"
              style="max-width: 200px"
            >
              <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
              <NInputNumber
                v-model:value="lotteryOption.fanCardLevel"
                min="1"
                max="50"
                :default-value="1"
                :disabled="isLottering || isStartLottery"
              />
            </NInputGroup>
          </NCollapseTransition>
          <template v-if="lotteryOption.type == 'danmaku'">
            <NTooltip>
              <template #trigger>
                <NInputGroup style="max-width: 250px">
                  <NInputGroupLabel> 弹幕内容 </NInputGroupLabel>
                  <NInput
                    v-model:value="lotteryOption.danmakuKeyword"
                    :disabled="isStartLottery"
                    placeholder="留空则任何弹幕都可以"
                  />
                </NInputGroup>
              </template>
              符合规则的弹幕才会被添加到抽奖队列中
            </NTooltip>
            <NRadioGroup
              v-model:value="lotteryOption.danmakuFilterType"
              name="判定类型"
              :disabled="isLottering"
              size="small"
            >
              <NRadioButton
                :disabled="isStartLottery"
                value="all"
              >
                完全一致
              </NRadioButton>
              <NRadioButton
                :disabled="isStartLottery"
                value="contains"
              >
                包含
              </NRadioButton>
              <NRadioButton
                :disabled="isStartLottery"
                value="regex"
              >
                正则
              </NRadioButton>
            </NRadioGroup>
          </template>
          <template v-else-if="lotteryOption.type == 'gift'">
            <NInputGroup style="max-width: 250px">
              <NInputGroupLabel> 最低价格 </NInputGroupLabel>
              <NInputNumber
                v-model:value="lotteryOption.giftMinPrice"
                :disabled="isStartLottery"
                placeholder="留空则不限制"
              />
            </NInputGroup>
            <NInputGroup style="max-width: 200px">
              <NInputGroupLabel> 礼物名称 </NInputGroupLabel>
              <NInput
                v-model:value="lotteryOption.giftName"
                :disabled="isStartLottery"
                placeholder="留空则不限制"
              />
            </NInputGroup>
          </template>
        </NSpace>
        <NDivider style="margin: 10px 0 10px 0" />
        <NSpace
          justify="center"
          align="center"
        >
          <NTag :bordered="false">
            抽取方式
          </NTag>
          <NRadioGroup
            v-model:value="lotteryOption.lotteryType"
            name="抽取类型"
            size="small"
            :disabled="isLottering"
          >
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
      <NCard
        v-if="originUsers"
        size="small"
      >
        <NSpace
          justify="center"
          align="center"
        >
          <NButton
            type="primary"
            :loading="isStartLottery"
            :disabled="isStartLottery || isLotteried || !client"
            @click="continueLottery"
          >
            开始
          </NButton>
          <NButton
            type="warning"
            :disabled="!isStartLottery"
            @click="pause"
          >
            停止
          </NButton>
          <NButton
            type="error"
            :disabled="isLottering || originUsers.length == 0"
            @click="clear"
          >
            清空
          </NButton>
        </NSpace>
        <NDivider style="margin: 20px 0 20px 0">
          <template v-if="isStartLottery">
            进行抽取前需要先停止
          </template>
        </NDivider>
        <NSpace justify="center">
          <NButton
            type="primary"
            secondary
            :loading="isLottering"
            :disabled="isStartLottery || isLotteried"
            data-umami-event="Open-Live Use Lottery"
            :data-umami-event-uid="client?.authInfo?.anchor_info?.uid"
            @click="startLottery"
          >
            进行抽取
          </NButton>
          <NButton
            type="info"
            secondary
            :disabled="isStartLottery || isLottering || !isLotteried"
            @click="reset"
          >
            重置
          </NButton>
        </NSpace>
        <NDivider style="margin: 10px 0 10px 0">
          共 {{ currentUsers?.length }} 人
        </NDivider>
        <NGrid
          v-if="currentUsers.length > 0"
          cols="1 500:2 800:3 1000:4"
          :x-gap="12"
          :y-gap="8"
        >
          <NGridItem
            v-for="item in currentUsers"
            :key="item.openId"
          >
            <NCard
              size="small"
              :title="item.name"
              style="height: 155px"
              embedded
            >
              <template #header>
                <NSpace
                  align="center"
                  vertical
                  :size="5"
                >
                  <NAvatar
                    round
                    lazy
                    borderd
                    :size="64"
                    :src="item.avatar + '@64w_64h'"
                    :img-props="{ referrerpolicy: 'no-referrer' }"
                    style="box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2)"
                  />
                  <NSpace v-if="item.fans_medal_wearing_status">
                    <NTag
                      size="tiny"
                      round
                    >
                      <NTag
                        size="tiny"
                        round
                        :bordered="false"
                      >
                        {{ item.fans_medal_level }}
                      </NTag>
                      <span style="color: #577fb8">
                        {{ item.fans_medal_name }}
                      </span>
                    </NTag>
                  </NSpace>
                  <NTag
                    v-else
                    size="tiny"
                    round
                    :bordered="false"
                  >
                    无粉丝牌
                  </NTag>
                  {{ item.name }}
                </NSpace>

                <NButton
                  style="position: absolute; right: 5px; top: 5px; color: #753e3e"
                  size="small"
                  circle
                  @click="removeUser(item)"
                >
                  <template #icon>
                    <NIcon :component="Delete24Filled" />
                  </template>
                </NButton>
              </template>
            </NCard>
          </NGridItem>
        </NGrid>
        <NEmpty
          v-else
          description="暂无用户"
        />
      </NCard>
    </NCard>
  </template>
  <NModal
    v-model:show="showModal"
    preset="card"
    title="抽奖结果"
    style="max-width: 90%; width: 800px"
    closable
  >
    <template #header-extra>
      <NButton
        type="error"
        size="small"
        @click="lotteryHistory = []"
      >
        清空
      </NButton>
    </template>
    <NScrollbar
      v-if="lotteryHistory.length > 0"
      style="max-height: 80vh"
    >
      <NList>
        <NListItem
          v-for="item in lotteryHistory"
          :key="item.time"
        >
          <NCard size="small">
            <template #header>
              <NTime :time="item.time" />
            </template>
            <template #header-extra>
              <NButton
                type="error"
                size="small"
                @click="lotteryHistory.splice(lotteryHistory.indexOf(item), 1)"
              >
                删除
              </NButton>
            </template>
            <NSpace vertical>
              <NSpace
                v-for="user in item.users"
                :key="user.openId"
              >
                <NAvatar
                  round
                  lazy
                  :src="user.avatar + '@64w_64h'"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                {{ user.name }}
              </NSpace>
            </NSpace>
          </NCard>
        </NListItem>
      </NList>
    </NScrollbar>
    <NEmpty
      v-else
      description="暂无记录"
    />
  </NModal>
  <NModal
    v-model:show="showOBSModal"
    preset="card"
    title="OBS 组件"
    style="max-width: 90%; width: 800px; max-height: 90vh"
    closable
    content-style="overflow: auto"
  >
    <NAlert
      title="这是什么?  "
      type="info"
    >
      将等待队列以及结果显示在OBS中
    </NAlert>
    <NDivider> 浏览 </NDivider>
    <div style="height: 400px; width: 250px; position: relative; margin: 0 auto">
      <LiveLotteryOBS :code="code" />
    </div>
    <br>
    <NInput :value="`${CURRENT_HOST}obs/live-lottery?code=` + code" />
    <NDivider />
    <NCollapse>
      <NCollapseItem title="使用说明">
        <NUl>
          <NLi>在 OBS 来源中添加源, 选择 浏览器</NLi>
          <NLi>在 URL 栏填入上方链接</NLi>
          <NLi>根据自己的需要调整宽度和高度 (这里是宽 250px 高 400px)</NLi>
          <NLi>完事</NLi>
        </NUl>
      </NCollapseItem>
    </NCollapse>

    <NDivider />
  </NModal>
</template>
