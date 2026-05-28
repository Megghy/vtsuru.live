<script setup lang="ts">
import type { OpenLiveInfo, OpenLiveLotteryUserInfo, UpdateLiveLotteryUsersModel } from '@/api/api-models'
import type { DanmakuInfo, GiftInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { Delete24Filled, Pause24Filled, PersonAdd24Filled, Play24Filled, Sparkle24Filled } from '@vicons/fluent'
import { usePersistedStorage } from '@/shared/storage/persist'
import { format } from 'date-fns'
import {
  NAlert, NAvatar, NButton, NCard, NDivider, NEmpty, NIcon, NNumberAnimation, NProgress, NResult, NFlex, NTag, useMessage, useNotification } from 'naive-ui';
import { h, onMounted, onUnmounted, ref } from 'vue'
import { useAccount } from '@/api/account'
import { OpenLiveLotteryType } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { LOTTERY_API_URL } from '@/shared/config'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import type { LotteryHistory, LotteryOption, ManualUserFormModel } from '@/apps/open-live/components/lottery/lotteryTypes'
import { getAvatarUrl, getRandomInt, isUserValid, shuffleArray } from '@/apps/open-live/components/lottery/lotteryUtils'
import LotterySettingsPanel from '@/apps/open-live/components/lottery/LotterySettingsPanel.vue'
import LotteryHistoryModal from '@/apps/open-live/components/lottery/LotteryHistoryModal.vue'
import LotteryObsModal from '@/apps/open-live/components/lottery/LotteryObsModal.vue'
import LotteryAddUserModal from '@/apps/open-live/components/lottery/LotteryAddUserModal.vue'
import OpenLivePageHeader from '@/apps/open-live/components/OpenLivePageHeader.vue'

interface CardState {
  flipped: boolean
  isWinner: boolean
  eliminated: boolean
}
const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()
const defaultOption = {
  resultCount: 1,
  type: 'danmaku',
  lotteryType: 'single',
  danmakuFilterType: 'all',
  needFanMedal: false,
  needWearFanMedal: false,
  needGuard: false,
  fanCardLevel: 1,
  animationSpeed: 1000,
} as LotteryOption
const lotteryOption = usePersistedStorage('Settings.OpenLive.LotteryOption', defaultOption)
const lotteryHistory = usePersistedStorage<LotteryHistory[]>('OpenLive.LotteryHistory', [])

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
const showAddUserModal = ref(false)
const lotteryProgress = ref(0)
const eliminatedUsers = ref<OpenLiveLotteryUserInfo[]>([])
const currentLotteryStep = ref(0)

// 动画状态
const cardStates = ref<Record<string, CardState>>({})
const wheelRotation = ref(0)
const wheelSpinning = ref(false)
// 仅当点击“进行抽取”并进入翻牌模式后才允许点击卡片
const flipEnabled = ref(false)
let flipFinishTimer: any = null

function ensureCardState(userId: string): CardState {
  if (!cardStates.value[userId]) {
    cardStates.value[userId] = {
      flipped: false,
      isWinner: false,
      eliminated: false,
    }
  }
  return cardStates.value[userId]
}

function syncCardStates(users: OpenLiveLotteryUserInfo[], options: { reset?: boolean } = {}) {
  const { reset = false } = options
  const nextStates: Record<string, CardState> = {}

  users.forEach((user) => {
    const existing = cardStates.value[user.openId]
    nextStates[user.openId] = reset || !existing
      ? { flipped: false, isWinner: false, eliminated: false }
      : { ...existing }
  })

  cardStates.value = nextStates
}

async function getUsers() {
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(`${LOTTERY_API_URL}live/get-users`, {
      code: props.code,
    })
    if (data.code === 200) {
      return data.data
    }
  } catch (err) {
    console.error(err)
  }
  return null
}
function updateUsers() {
  QueryPostAPI(`${LOTTERY_API_URL}live/update-users`, {
    code: props.code,
    users: originUsers.value,
    resultUsers: resultUsers.value,
    type: isLotteried.value ? OpenLiveLotteryType.Result : OpenLiveLotteryType.Waiting,
  }).catch((err) => {
    console.error('[OPEN-LIVE-Lottery] 更新历史抽奖用户失败', err)
  })
}
function addUser(user: OpenLiveLotteryUserInfo, danmu?: any) {
  if (originUsers.value.find(u => u.openId == user.openId) || (!isStartLottery.value && danmu)) {
    return
  }
  if (danmu && !isUserValid(user, danmu, lotteryOption.value)) {
    console.log(`[OPEN-LIVE-Lottery] ${user.name} 因不符合条件而被忽略`)
    return
  }
  originUsers.value.push(user)
  currentUsers.value.push(user)
  ensureCardState(user.openId)
  syncCardStates(currentUsers.value)
  console.log(`[OPEN-LIVE-Lottery] ${user.name} 添加到队列中`)
  updateUsers()
}

// 手动添加用户
function addManualUser(payload: ManualUserFormModel) {
  if (!payload.name.trim()) {
    message.error('请输入用户名')
    return
  }

  const newUser: OpenLiveLotteryUserInfo = {
    uId: Date.now(),
    openId: `manual_${Date.now()}`,
    name: payload.name,
    avatar: payload.avatar,
    fans_medal_level: payload.fans_medal_level,
    fans_medal_name: payload.fans_medal_name,
    fans_medal_wearing_status: payload.fans_medal_level > 0,
    guard_level: payload.guard_level,
  }

  addUser(newUser)
  message.success(`已添加用户: ${newUser.name}`)
  showAddUserModal.value = false
}

function resetOption() {
  lotteryOption.value = { ...defaultOption }
}

function clearHistory() {
  lotteryHistory.value = []
}

function removeHistoryItem(time: number) {
  const index = lotteryHistory.value.findIndex(h => h.time === time)
  if (index === -1) return
  lotteryHistory.value.splice(index, 1)
}
function startLottery() {
  if (!isLottering.value && originUsers.value) {
    isLottering.value = true
    lotteryProgress.value = 0
    currentLotteryStep.value = 0
    eliminatedUsers.value = []

    try {
      if (originUsers.value.length < lotteryOption.value.resultCount) {
        message.warning('符合条件的抽奖人数达不到抽选人数')
        isLottering.value = false
        return
      }

      switch (lotteryOption.value.lotteryType) {
        case 'single':
          startSingleLottery()
          break
        case 'half':
          startHalfLottery()
          break
        case 'flip':
          startFlipLottery()
          break
        case 'wheel':
          startWheelLottery()
          break
        case 'cards':
          startCardsLottery()
          break
        case 'elimination':
          startEliminationLottery()
          break
      }
    } catch {
      message.error('发生错误')
      isLottering.value = false
    }
  }
}

// 单个淘汰模式
function startSingleLottery() {
  console.log('开始单个淘汰模式')
  const totalSteps = currentUsers.value.length - lotteryOption.value.resultCount
  if (totalSteps <= 0) {
    onFinishLottery()
    return
  }

  function removeSingleUser() {
    if (currentUsers.value.length > lotteryOption.value.resultCount) {
      const randomIndex = getRandomInt(currentUsers.value.length)
      const eliminatedUser = currentUsers.value.splice(randomIndex, 1)[0]
      eliminatedUsers.value.push(eliminatedUser)

      ensureCardState(eliminatedUser.openId).eliminated = true
      lotteryProgress.value = ((totalSteps - (currentUsers.value.length - lotteryOption.value.resultCount)) / totalSteps) * 100

      console.log(`[${currentUsers.value.length}] 移除 ${eliminatedUser.name}`)

      setTimeout(() => {
        removeSingleUser()
      }, lotteryOption.value.animationSpeed / 2)
    } else {
      onFinishLottery()
    }
  }
  removeSingleUser()
}

// 减半模式
function startHalfLottery() {
  if (currentUsers.value.length / 2 <= lotteryOption.value.resultCount) {
    console.log(`[OPEN-LIVE-Lottery] 人数减半至${lotteryOption.value.resultCount}人`)
    while (currentUsers.value.length > lotteryOption.value.resultCount) {
      const randomIndex = getRandomInt(currentUsers.value.length)
      const eliminatedUser = currentUsers.value.splice(randomIndex, 1)[0]
      eliminatedUsers.value.push(eliminatedUser)
      ensureCardState(eliminatedUser.openId).eliminated = true
    }
    onFinishLottery()
  } else {
    const half = Math.floor(currentUsers.value.length / 2)
    console.log(`[OPEN-LIVE-Lottery] 人数减半至${half}人`)
    message.success(`人数减半至 ${half} 人，再次点击"开始抽取"继续`)
    while (currentUsers.value.length > half) {
      const randomIndex = getRandomInt(currentUsers.value.length)
      const eliminatedUser = currentUsers.value.splice(randomIndex, 1)[0]
      eliminatedUsers.value.push(eliminatedUser)
      ensureCardState(eliminatedUser.openId).eliminated = true
    }
    lotteryProgress.value = (eliminatedUsers.value.length / (eliminatedUsers.value.length + currentUsers.value.length - lotteryOption.value.resultCount)) * 100
    isLottering.value = false
  }
}

// 翻牌模式
function startFlipLottery() {
  console.log('开始翻牌模式')

  // 预先随机选择获奖者
  const shuffledUsers = shuffleArray(currentUsers.value)
  const winners = shuffledUsers.slice(0, Math.min(lotteryOption.value.resultCount, currentUsers.value.length))

  syncCardStates(currentUsers.value, { reset: true })
  winners.forEach((winner) => {
    ensureCardState(winner.openId).isWinner = true
  })

  message.info('点击用户卡片进行翻牌抽取！')
  // 开启翻牌可点击
  flipEnabled.value = true
  if (flipFinishTimer) {
    clearTimeout(flipFinishTimer)
    flipFinishTimer = null
  }
  isLottering.value = false
}

// 转轮模式
function startWheelLottery() {
  console.log('开始转轮模式')
  if (currentUsers.value.length < 2) {
    message.warning('转轮模式至少需要 2 位用户')
    return
  }
  wheelSpinning.value = true
  wheelRotation.value = 0

  // 随机转动角度
  const randomFloat = crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF
  const spins = 3 + randomFloat * 3
  const finalAngle = (crypto.getRandomValues(new Uint32Array(1))[0] / 0xFFFFFFFF) * 360
  const totalRotation = spins * 360 + finalAngle

  wheelRotation.value = totalRotation

  setTimeout(() => {
    wheelSpinning.value = false
    // 根据最终角度选择获奖者
    const anglePerUser = 360 / currentUsers.value.length
    // 指针位于顶部（90°），切片从正东（0°）开始，求旋转前位于指针方向的角度
    const pointerAngle = 90
    const preAngle = (pointerAngle - (finalAngle % 360) + 360) % 360
    const winnerIndex = Math.floor(preAngle / anglePerUser) % currentUsers.value.length

    const winner = currentUsers.value[winnerIndex]
    resultUsers.value = [winner]
    // 不再改变 currentUsers，让转盘保持原样
    onFinishLottery()
  }, 3000)
}

// 抽卡模式
function startCardsLottery() {
  console.log('开始抽卡模式')
  message.info('正在随机选择获奖卡片...')

  // 随机选择获奖者
  const shuffledUsers = shuffleArray(currentUsers.value)
  const winners = shuffledUsers.slice(0, Math.min(lotteryOption.value.resultCount, currentUsers.value.length))

  // 设置获奖者标记
  syncCardStates(currentUsers.value, { reset: true })
  winners.forEach((user) => {
    ensureCardState(user.openId).isWinner = true
  })

  // 延迟显示结果
  setTimeout(() => {
    // 翻开所有卡片
    currentUsers.value.forEach((user) => {
      ensureCardState(user.openId).flipped = true
    })

    setTimeout(() => {
      resultUsers.value = winners
      currentUsers.value = winners
      onFinishLottery()
    }, 1500)
  }, 1000)
}

// 淘汰赛模式
function startEliminationLottery() {
  console.log('开始淘汰赛模式')
  const ratio = currentUsers.value.length / lotteryOption.value.resultCount
  const totalRounds = ratio > 1 ? Math.ceil(Math.log2(ratio)) : 1
  currentLotteryStep.value = 1

  function nextRound() {
    if (currentUsers.value.length <= lotteryOption.value.resultCount) {
      onFinishLottery()
      return
    }

    const targetCount = Math.max(
      lotteryOption.value.resultCount,
      Math.floor(currentUsers.value.length / 2),
    )

    message.info(`第 ${currentLotteryStep.value} 轮淘汰赛，目标人数: ${targetCount}`)

    // 随机淘汰到目标人数
    while (currentUsers.value.length > targetCount) {
      const randomIndex = getRandomInt(currentUsers.value.length)
      const eliminatedUser = currentUsers.value.splice(randomIndex, 1)[0]
      eliminatedUsers.value.push(eliminatedUser)
      cardStates.value[eliminatedUser.openId].eliminated = true
    }

    lotteryProgress.value = ((totalRounds - Math.ceil(Math.log2(currentUsers.value.length / lotteryOption.value.resultCount))) / totalRounds) * 100
    currentLotteryStep.value++

    if (currentUsers.value.length > lotteryOption.value.resultCount) {
      setTimeout(() => {
        nextRound()
      }, lotteryOption.value.animationSpeed)
    } else {
      onFinishLottery()
    }
  }

  nextRound()
}
function onFinishLottery() {
  if (lotteryOption.value.lotteryType !== 'wheel') {
    resultUsers.value = JSON.parse(JSON.stringify(currentUsers.value))
  }
  isLottering.value = false
  isLotteried.value = true
  // 结束后关闭翻牌可点击
  flipEnabled.value = false
  notification.create({
    title: '抽奖完成',
    description: `共${resultUsers.value?.length}人`,
    duration: 3000,
    content: () =>
      h(NFlex, { vertical: true }, () =>
        resultUsers.value?.map(user =>
          h(NFlex, null, () => [
            h(NAvatar, { src: `${user.avatar}@32w_32h`, imgProps: { referrerpolicy: 'no-referrer' } }),
            h('span', user.name),
          ]),
        )),
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
// 翻牌点击处理
function flipCard(user: OpenLiveLotteryUserInfo) {
  if (lotteryOption.value.lotteryType !== 'flip' || isLottering.value || !flipEnabled.value) return

  const state = ensureCardState(user.openId)
  // 再次点击可翻回去
  state.flipped = !state.flipped

  // 检查是否已经选够了获奖者
  const flippedWinners = currentUsers.value.filter(u =>
    ensureCardState(u.openId).flipped && ensureCardState(u.openId).isWinner,
  )

  if (flippedWinners.length >= lotteryOption.value.resultCount) {
    // 已满足中奖人数，延迟展示并完成
    if (flipFinishTimer) {
      clearTimeout(flipFinishTimer)
      flipFinishTimer = null
    }
    flipFinishTimer = setTimeout(() => {
      currentUsers.value.forEach((u) => {
        const st = ensureCardState(u.openId)
        if (!st.flipped) st.flipped = true
      })
      flipFinishTimer = setTimeout(() => {
        const winners = currentUsers.value.filter(u => ensureCardState(u.openId).isWinner)
        resultUsers.value = winners
        currentUsers.value = winners
        onFinishLottery()
        flipFinishTimer = null
      }, 1500)
    }, 500)
  } else {
    // 未满足中奖人数，若存在完成计时则取消
    if (flipFinishTimer) {
      clearTimeout(flipFinishTimer)
      flipFinishTimer = null
    }
  }
}

function onCardClick(user: OpenLiveLotteryUserInfo) {
  if (lotteryOption.value.lotteryType !== 'flip' || !flipEnabled.value || isLotteried.value) return
  flipCard(user)
}

function reset() {
  currentUsers.value = JSON.parse(JSON.stringify(originUsers.value))
  isLotteried.value = false
  lotteryProgress.value = 0
  currentLotteryStep.value = 0
  eliminatedUsers.value = []
  syncCardStates(currentUsers.value, { reset: true })
  flipEnabled.value = false
  if (flipFinishTimer) {
    clearTimeout(flipFinishTimer)
    flipFinishTimer = null
  }
  updateUsers()
}

function clear() {
  originUsers.value = []
  isLotteried.value = false
  resultUsers.value = []
  currentUsers.value = []
  lotteryProgress.value = 0
  currentLotteryStep.value = 0
  eliminatedUsers.value = []
  cardStates.value = {}
  flipEnabled.value = false
  if (flipFinishTimer) {
    clearTimeout(flipFinishTimer)
    flipFinishTimer = null
  }
  message.success('已清空队列')

  updateUsers()
}
// 洗牌（仅翻牌模式）
function shuffleFlipCards() {
  if (lotteryOption.value.lotteryType !== 'flip') return
  // 打乱顺序
  currentUsers.value = shuffleArray(currentUsers.value)
  // 重置翻牌状态，但保留 isWinner 标记
  const next: Record<string, CardState> = {}
  currentUsers.value.forEach((u) => {
    const st = ensureCardState(u.openId)
    next[u.openId] = { flipped: false, isWinner: st?.isWinner ?? false, eliminated: false }
  })
  cardStates.value = next
  // 取消可能存在的完成计时
  if (flipFinishTimer) {
    clearTimeout(flipFinishTimer)
    flipFinishTimer = null
  }
  message.success('已洗牌')
}
function removeUser(user: OpenLiveLotteryUserInfo) {
  currentUsers.value = currentUsers.value.filter(u => u.openId != user.openId)
  originUsers.value = originUsers.value.filter(u => u.openId != user.openId)
  syncCardStates(currentUsers.value)
  updateUsers()
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement
  img.src = 'https://i2.hdslb.com/bfs/face/member/noface.jpg@96w_96h'
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
    console.log(`[OPEN-LIVE-Lottery] 从历史记录中加载 ${users.length} 位用户`)
    if (users.length > 0) {
      message.info(`从历史记录中加载 ${users.length} 位用户`)
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
    <NCard size="small" bordered>
      <template #header>
        <OpenLivePageHeader
          title="直播抽奖"
          description="收集用户并抽取结果，支持条件过滤、动画效果与 OBS 展示"
        >
          <template #actions>
            <NButton
              text
              type="primary"
              size="small"
              tag="a"
              href="https://vtsuru.live"
              target="_blank"
            >
              主站
            </NButton>
            <NButton
              type="info"
              size="small"
              secondary
              @click="showModal = true"
            >
              抽奖历史
            </NButton>
            <NButton
              type="success"
              size="small"
              secondary
              @click="showOBSModal = true"
            >
              OBS 组件
            </NButton>
            <NButton
              type="primary"
              size="small"
              :disabled="isLottering"
              @click="showAddUserModal = true"
            >
              <template #icon>
                <NIcon :component="PersonAdd24Filled" />
              </template>
              手动添加
            </NButton>
          </template>
        </OpenLivePageHeader>
      </template>
      <NAlert
        v-if="!code && accountInfo && !accountInfo.isBiliVerified"
        type="error"
        size="small"
        :bordered="false"
      >
        请先绑定B站账号
      </NAlert>
      <NAlert
        v-else-if="!code && accountInfo && accountInfo.biliAuthCodeStatus !== 1"
        type="error"
        size="small"
        :bordered="false"
      >
        身份码状态异常, 请重新绑定
      </NAlert>
      <LotterySettingsPanel
        :option="lotteryOption"
        :is-start-lottery="isStartLottery"
        :is-lottering="isLottering"
        :current-users-length="currentUsers.length"
        @reset="resetOption"
      />
      <NCard
        v-if="originUsers"
        size="small"
        style="margin-top: 16px; min-height: 400px"
      >
        <template #header>
          <NFlex
            align="center"
            justify="space-between"
          >
            <div class="user-count-stat">
              <span class="label">当前参与</span>
              <NNumberAnimation
                :from="0"
                :to="currentUsers.length"
                active
              />
              <span class="unit">人</span>
            </div>
            <NFlex>
              <NButton
                :type="isStartLottery ? 'warning' : 'success'"
                @click="isStartLottery ? pause() : continueLottery()"
              >
                <template #icon>
                  <NIcon :component="isStartLottery ? Pause24Filled : Play24Filled" />
                </template>
                {{ isStartLottery ? '暂停监听' : '开始监听' }}
              </NButton>
              <NButton
                type="error"
                secondary
                :disabled="isLottering || originUsers.length === 0"
                @click="clear"
              >
                清空
              </NButton>
            </NFlex>
          </NFlex>
        </template>

        <div
          v-if="isLottering || lotteryProgress > 0 || isStartLottery"
          class="status-bar"
        >
          <div
            v-if="isStartLottery"
            style="color: var(--n-primary-color)"
          >
            <NFlex
              align="center"
              justify="center"
            >
              <NIcon
                :component="Sparkle24Filled"
                class="n-icon-spin"
              />
              正在监听弹幕/礼物中...
            </NFlex>
          </div>
          <div v-else-if="lotteryProgress > 0 && lotteryProgress < 100">
            <NProgress
              type="line"
              :percentage="lotteryProgress"
              indicator-placement="inside"
              processing
            />
            <div style="margin-top: 8px">
              <template v-if="currentLotteryStep > 0 && lotteryOption.lotteryType === 'elimination'">
                淘汰赛第 {{ currentLotteryStep }} 轮
              </template>
              <template v-else>
                正在抽取中...
              </template>
            </div>
          </div>
        </div>

        <div class="action-bar">
          <NButton
            type="success"
            size="large"
            :loading="isLottering"
            :disabled="isStartLottery || isLotteried || currentUsers.length === 0"
            data-umami-event="Open-Live Use Lottery"
            :data-umami-event-uid="client?.authInfo?.anchor_info?.uid"
            style="width: 180px; height: 48px; font-size: 18px"
            @click="startLottery"
          >
            <template #icon>
              <NIcon :component="Sparkle24Filled" />
            </template>
            开始抽取
          </NButton>
          <NButton
            secondary
            size="large"
            :disabled="isLottering || !isLotteried"
            style="width: 120px; height: 48px"
            @click="reset"
          >
            重置结果
          </NButton>
          <NButton
            v-if="lotteryOption.lotteryType === 'flip'"
            size="large"
            type="info"
            secondary
            :disabled="!flipEnabled || isLottering || isStartLottery || currentUsers.length === 0"
            style="height: 48px"
            @click="shuffleFlipCards"
          >
            洗牌
          </NButton>
        </div>
        <NDivider style="margin: 10px 0 20px 0" />
        <!-- 转轮模式特殊显示 -->
        <div v-if="lotteryOption.lotteryType === 'wheel' && currentUsers.length >= 2" class="wheel-container">
          <div class="wheel-area">
            <div
              class="lottery-wheel"
              :style="{
                transform: `rotate(${wheelRotation}deg)`,
                transition: wheelSpinning ? 'transform 3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none',
              }"
            >
              <div
                v-for="(user, index) in currentUsers"
                :key="user.openId"
                class="wheel-slice"
                :style="{
                  '--slice-angle': `${360 / currentUsers.length}deg`,
                  '--slice-offset': `${index * (360 / currentUsers.length)}deg`,
                  '--slice-bg': `hsl(${index * (360 / currentUsers.length)}, 70%, 80%)`,
                }"
              >
                <div class="wheel-user-name">
                  {{ user.name }}
                </div>
              </div>
            </div>
            <div class="wheel-pointer" />
          </div>
        </div>
        <div v-else-if="lotteryOption.lotteryType === 'wheel'" class="wheel-container">
          <NEmpty description="转轮模式至少需要 2 位用户" />
        </div>

        <!-- 卡片显示 -->
        <div
          v-else-if="currentUsers.length > 0"
          class="lottery-cards-container"
        >
          <div
            v-for="item in currentUsers"
            :key="item.openId"
            class="lottery-card-wrapper" :class="[
              {
                'flip-mode': lotteryOption.lotteryType === 'flip' && flipEnabled,
                'flipped': (lotteryOption.lotteryType !== 'flip' && lotteryOption.lotteryType !== 'cards') || cardStates[item.openId]?.flipped,
                'eliminated': cardStates[item.openId]?.eliminated,
                'winner': cardStates[item.openId]?.isWinner && cardStates[item.openId]?.flipped,
              },
            ]"
            @click="onCardClick(item)"
          >
            <div class="lottery-card">
              <!-- 卡片背面 -->
              <NCard class="card-face card-back" :bordered="false" content-style="padding: 0; display: flex; align-items: center; justify-content: center;">
                <div class="mystery-card">
                  <div class="mystery-icon">
                    <NIcon :component="Sparkle24Filled" size="40" />
                  </div>
                  <div class="mystery-text">
                    点击翻开
                  </div>
                  <div class="card-pattern" />
                  <NButton
                    v-if="!isLottering"
                    class="remove-btn"
                    size="small"
                    circle
                    quaternary
                    @click.stop="removeUser(item)"
                  >
                    <template #icon>
                      <NIcon :component="Delete24Filled" />
                    </template>
                  </NButton>
                </div>
              </NCard>

              <!-- 卡片正面 -->
              <NCard
                class="card-face card-front"
                :class="{ 'winner-card': cardStates[item.openId]?.isWinner }"
                :bordered="cardStates[item.openId]?.isWinner"
                content-style="padding: 16px; display: flex; flex-direction: column; align-items: center; justify-content: center;"
              >
                <div class="user-card-content">
                  <div class="user-avatar-wrapper">
                    <NAvatar
                      :src="getAvatarUrl(item.avatar)"
                      :size="80"
                      circle
                      :img-props="{
                        referrerpolicy: 'no-referrer',
                      }"
                      @error="handleImageError"
                    />
                    <div v-if="cardStates[item.openId]?.isWinner" class="winner-badge">
                      <NIcon :component="Sparkle24Filled" size="16" />
                    </div>
                  </div>

                  <div class="user-info">
                    <div class="user-name">
                      {{ item.name }}
                    </div>
                    <div class="user-badges">
                      <NTag v-if="item.fans_medal_wearing_status" :bordered="false" size="small" type="info">
                        <template #icon>
                          <span class="medal-level">{{ item.fans_medal_level }}</span>
                        </template>
                        {{ item.fans_medal_name }}
                      </NTag>
                      <NTag v-else :bordered="false" size="small">
                        无粉丝牌
                      </NTag>
                      <NTag v-if="item.guard_level > 0" :bordered="false" size="small" type="warning">
                        舰长{{ item.guard_level }}
                      </NTag>
                    </div>
                  </div>

                  <div v-if="cardStates[item.openId]?.isWinner && cardStates[item.openId]?.flipped" class="winner-celebration">
                    <div class="winner-text">
                      🎉 中奖了！
                    </div>
                  </div>

                  <NButton
                    v-if="!isLottering"
                    class="remove-btn"
                    size="small"
                    circle
                    quaternary
                    @click.stop="removeUser(item)"
                  >
                    <template #icon>
                      <NIcon :component="Delete24Filled" />
                    </template>
                  </NButton>
                </div>
              </NCard>
            </div>
          </div>
        </div>
        <NEmpty
          v-else
          description="暂无用户"
        />
      </NCard>
    </NCard>
  </template>
  <LotteryHistoryModal
    v-model:show="showModal"
    :history="lotteryHistory"
    @clear="clearHistory"
    @remove="removeHistoryItem"
  />
  <LotteryObsModal
    v-model:show="showOBSModal"
    :code="code"
  />
  <LotteryAddUserModal
    v-model:show="showAddUserModal"
    :disabled="isLottering"
    @submit="addManualUser"
  />
</template>

<style scoped>
.user-count-stat {
  display: flex;
  align-items: baseline;
  gap: 4px;
  font-size: 14px;
  color: var(--n-text-color-2);
}
.user-count-stat .n-number-animation {
  font-size: 24px;
  font-weight: bold;
  color: var(--n-primary-color);
  font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
}
.user-count-stat .unit {
  font-size: 14px;
}

.action-bar {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
}

.status-bar {
  margin: 16px 0;
  text-align: center;
  color: var(--n-text-color-2);
}


.mode-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  filter: grayscale(1);
}

.mode-icon {
  font-size: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mode-title {
  font-size: 14px;
  font-weight: bold;
}

.mode-desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  display: none; /* 默认不显示描述，hover或大屏可以显示，目前保持简洁 */
}

/* 卡片容器 */
.lottery-cards-container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  padding: 8px;
}

@media (max-width: 768px) {
  .lottery-cards-container {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 12px;
  }
}

/* 卡片包装器 */
.lottery-card-wrapper {
  perspective: 1000px;
  height: 220px;
  position: relative;
}

.lottery-card-wrapper.flip-mode {
  cursor: pointer;
}

.lottery-card-wrapper.eliminated {
  opacity: 0.4;
  filter: grayscale(0.8);
}

.lottery-card-wrapper.winner {
  outline: 2px solid var(--n-success-color);
  outline-offset: 2px;
  border-radius: var(--n-border-radius);
}

/* 主卡片 */
.lottery-card {
  width: 100%;
  height: 100%;
  position: relative;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.lottery-card-wrapper.flipped .lottery-card {
  transform: rotateY(180deg);
}

/* 卡片面 */
.card-face {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.card-back {
  background: var(--n-card-color);
  color: var(--n-text-color);
}

.card-front {
  transform: rotateY(180deg);
}

.winner-card {
  --n-border-color: var(--n-success-color) !important;
}

/* 神秘卡片样式 */
.mystery-card {
  text-align: center;
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.mystery-icon {
  margin-bottom: 12px;
}

.mystery-text {
  font-size: 16px;
  font-weight: 600;
}

.card-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: none;
}

/* 用户卡片内容 */
.user-card-content {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
}

.user-avatar-wrapper {
  position: relative;
  margin-bottom: 12px;
}

.winner-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 24px;
  height: 24px;
  background: var(--n-warning-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.user-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 16px;
  font-weight: 600;
  word-break: break-all;
  line-height: 1.2;
}

.user-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}

.medal-level {
  background: var(--n-color-embedded);
  color: var(--n-text-color);
  padding: 1px 4px;
  border-radius: var(--n-border-radius);
  font-weight: bold;
  margin-right: 4px;
}

.winner-celebration {
  position: absolute;
  top: 8px;
  left: 8px;
  right: 8px;
  text-align: center;
  z-index: 5;
}

.winner-text {
  background: var(--n-success-color);
  color: white;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: bold;
}

.remove-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 10;
}

/* 转轮样式 */
.wheel-container {
  text-align: center;
  margin: 20px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  /* 避免旋转时产生横向滚动条导致页面抖动 */
  overflow-x: hidden;
}
.wheel-area {
  position: relative;
  width: 300px;
  height: 300px;
}
.lottery-wheel {
  position: relative;
  width: 300px;
  height: 300px;
  border-radius: 50%;
  overflow: hidden;
  border: 4px solid var(--n-primary-color);
}

.wheel-pointer {
  position: absolute;
  top: -10px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 20px solid var(--n-error-color);
  z-index: 10;
}

.wheel-slice {
  position: absolute;
  width: 50%;
  height: 100%;
  top: 0;
  left: 50%;
  transform-origin: 0 50%;
  transform: rotate(var(--slice-offset));
  background: var(--slice-bg);
  clip-path: polygon(0% 0%, 100% 0, 100% 50%, 100% 100%, 0% 100%);
}

.wheel-user-name {
    position: absolute;
    top: 50%;
    left: 75%;
    transform: translate(-50%, -50%) rotate(calc(var(--slice-angle) / 2));
    font-size: 12px;
    font-weight: bold;
    color: var(--n-text-color);
    white-space: nowrap;
}

/* 响应式优化 */
@media (max-width: 480px) {
  .lottery-cards-container {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .lottery-card-wrapper {
    height: 200px;
  }
}
</style>
