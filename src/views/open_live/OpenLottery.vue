<script setup lang="ts">
import type { OpenLiveInfo, OpenLiveLotteryUserInfo, UpdateLiveLotteryUsersModel } from '@/api/api-models'
import type { DanmakuInfo, GiftInfo } from '@/data/DanmakuClients/OpenLiveClient'
import { Add24Filled, Delete24Filled, Info24Filled, Pause24Filled, PersonAdd24Filled, Play24Filled, Sparkle24Filled, Target24Filled } from '@vicons/fluent'
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
  NForm,
  NFormItem,
  NGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NLi,
  NList,
  NListItem,
  NModal,
  NNumberAnimation,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NResult,
  NScrollbar,
  NSpace,
  NStatistic,
  NTag,
  NTime,
  NTooltip,
  NUl,
  useMessage,
  useNotification,
} from 'naive-ui'
import { computed, h, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAccount } from '@/api/account'
import { OpenLiveLotteryType } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
import { CURRENT_HOST, LOTTERY_API_URL } from '@/data/constants'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import LiveLotteryOBS from '../obs/LiveLotteryOBS.vue'

interface LotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half' | 'flip' | 'wheel' | 'cards' | 'elimination'
  type: 'danmaku' | 'gift'
  danmakuFilterType: 'all' | 'contains' | 'regex'
  danmakuKeyword: string
  needFanMedal: boolean
  needWearFanMedal: false
  needGuard: boolean
  fanCardLevel?: number
  giftMinPrice?: number
  giftName?: string
  animationSpeed: number
}
interface LotteryHistory {
  users: OpenLiveLotteryUserInfo[]
  time: number
}

interface CardState {
  flipped: boolean
  isWinner: boolean
  eliminated: boolean
}
const props = defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
}>()
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
  animationSpeed: 1000,
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
const showAddUserModal = ref(false)
const lotteryProgress = ref(0)
const eliminatedUsers = ref<OpenLiveLotteryUserInfo[]>([])
const currentLotteryStep = ref(0)

// 手动添加用户的表单数据
const manualUserForm = ref({
  name: '',
  avatar: 'https://i2.hdslb.com/bfs/face/member/noface.jpg',
  fans_medal_level: 0,
  fans_medal_name: '',
  guard_level: 0,
})

// 抽取方式描述
const lotteryTypeDescriptions = {
  single: '一个一个随机淘汰用户，直到剩余指定人数',
  half: '每次点击随机淘汰一半用户',
  flip: '点击翻牌，随机显示中奖用户',
  wheel: '转轮抽取，模拟幸运转轮',
  cards: '抽卡模式，随机翻开中奖卡片',
  elimination: '淘汰赛模式，分轮次进行抽取',
}

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

const refinedCode = computed(() => {
  if (props.code) {
    return props.code
  }
  return accountInfo.value?.biliAuthCode ?? window.$route.query.code?.toString()
})

async function getUsers() {
  try {
    const data = await QueryGetAPI<UpdateLiveLotteryUsersModel>(`${LOTTERY_API_URL}live/get-users`, {
      code: props.code,
    })
    if (data.code == 200) {
      return data.data
    }
  } catch (err) { }
  return null
}
function updateUsers() {
  QueryPostAPI(`${LOTTERY_API_URL}live/update-users`, {
    code: props.code,
    users: originUsers.value,
    resultUsers: resultUsers.value,
    type: isLotteried.value ? OpenLiveLotteryType.Result : OpenLiveLotteryType.Waiting,
  }).catch((err) => {
    console.error('[OPEN-LIVE-Lottery] 更新历史抽奖用户失败')
  })
}
function addUser(user: OpenLiveLotteryUserInfo, danmu?: any) {
  if (originUsers.value.find(u => u.openId == user.openId) || (!isStartLottery.value && danmu)) {
    return
  }
  if ((danmu && isUserValid(user, danmu)) || !danmu) {
    if (!originUsers.value.find(u => u.openId == user.openId)) {
      originUsers.value.push(user)
      currentUsers.value.push(user)
      ensureCardState(user.openId)
      syncCardStates(currentUsers.value)
      console.log(`[OPEN-LIVE-Lottery] ${user.name} 添加到队列中`)
      updateUsers()
    }
  } else if (danmu) {
    console.log(`[OPEN-LIVE-Lottery] ${user.name} 因不符合条件而被忽略`)
  }
}

// 手动添加用户
function addManualUser() {
  if (!manualUserForm.value.name.trim()) {
    message.error('请输入用户名')
    return
  }

  const newUser: OpenLiveLotteryUserInfo = {
    uId: Date.now(),
    openId: `manual_${Date.now()}`,
    name: manualUserForm.value.name,
    avatar: manualUserForm.value.avatar,
    fans_medal_level: manualUserForm.value.fans_medal_level,
    fans_medal_name: manualUserForm.value.fans_medal_name,
    fans_medal_wearing_status: manualUserForm.value.fans_medal_level > 0,
    guard_level: manualUserForm.value.guard_level,
  }

  addUser(newUser)
  message.success(`已添加用户: ${newUser.name}`)

  // 重置表单
  manualUserForm.value = {
    name: '',
    avatar: 'https://i2.hdslb.com/bfs/face/member/noface.jpg',
    fans_medal_level: 0,
    fans_medal_name: '',
    guard_level: 0,
  }
  showAddUserModal.value = false
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
    } catch (err) {
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
    message.success(`人数减半至 ${half} 人`)
    while (currentUsers.value.length > half) {
      const randomIndex = getRandomInt(currentUsers.value.length)
      const eliminatedUser = currentUsers.value.splice(randomIndex, 1)[0]
      eliminatedUsers.value.push(eliminatedUser)
      ensureCardState(eliminatedUser.openId).eliminated = true
    }
    isLottering.value = false
  }
}

// 翻牌模式
function startFlipLottery() {
  console.log('开始翻牌模式')

  // 预先随机选择获奖者
  const shuffledUsers = [...currentUsers.value].sort(() => Math.random() - 0.5)
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
  const spins = 3 + Math.random() * 3 // 3-6圈
  const finalAngle = Math.random() * 360
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
  const shuffledUsers = [...currentUsers.value].sort(() => Math.random() - 0.5)
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
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max)
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
      h(NSpace, { vertical: true }, () =>
        resultUsers.value?.map(user =>
          h(NSpace, null, () => [
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
  currentUsers.value = [...currentUsers.value].sort(() => Math.random() - 0.5)
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

// 处理头像URL
function getAvatarUrl(avatar: string) {
  if (!avatar || avatar === 'https://i2.hdslb.com/bfs/face/member/noface.jpg') {
    return 'https://i2.hdslb.com/bfs/face/member/noface.jpg'
  }

  // 确保头像URL有正确的尺寸参数
  if (avatar.includes('@')) {
    return avatar.replace(/@\w+/, '@96w_96h')
  } else {
    return `${avatar}@96w_96h`
  }
}

// 处理图片加载错误
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
          <NButton
            type="primary"
            size="small"
            :disabled="isLottering"
            @click="showAddUserModal = true"
          >
            <template #icon>
              <NIcon :component="PersonAdd24Filled" />
            </template>
            手动添加用户
          </NButton>
        </NSpace>
      </NCard>
      <div class="settings-wrapper">
        <div class="settings-header">
          <NSpace align="center">
            <NIcon :component="Sparkle24Filled" color="#f0a020" />
            <span style="font-weight: bold; font-size: 16px">抽奖设置</span>
          </NSpace>
          <NButton
            size="tiny"
            secondary
            :disabled="isStartLottery"
            @click="lotteryOption = defaultOption"
          >
            恢复默认
          </NButton>
        </div>

        <div class="settings-layout">
          <!-- 左侧：参与规则 -->
          <div class="setting-column">
            <div class="setting-section">
              <div class="section-header">
                <NIcon :component="Target24Filled" />
                参与规则
              </div>
              <NForm
                label-placement="left"
                label-width="80"
                size="small"
              >
                <NFormItem label="参与方式">
                  <NRadioGroup
                    v-model:value="lotteryOption.type"
                    :disabled="isLottering || isStartLottery"
                  >
                    <NRadioButton value="danmaku">
                      弹幕
                    </NRadioButton>
                    <NRadioButton value="gift">
                      礼物
                    </NRadioButton>
                  </NRadioGroup>
                </NFormItem>

                <template v-if="lotteryOption.type == 'danmaku'">
                  <NFormItem label="弹幕内容">
                    <NInput
                      v-model:value="lotteryOption.danmakuKeyword"
                      :disabled="isStartLottery"
                      placeholder="留空则任意弹幕"
                    />
                  </NFormItem>
                  <NFormItem
                    v-if="lotteryOption.danmakuKeyword"
                    label="匹配规则"
                  >
                    <NRadioGroup
                      v-model:value="lotteryOption.danmakuFilterType"
                      :disabled="isStartLottery"
                    >
                      <NRadioButton value="all">
                        完全一致
                      </NRadioButton>
                      <NRadioButton value="contains">
                        包含
                      </NRadioButton>
                      <NRadioButton value="regex">
                        正则
                      </NRadioButton>
                    </NRadioGroup>
                  </NFormItem>
                </template>

                <template v-else-if="lotteryOption.type == 'gift'">
                  <NFormItem label="礼物限制">
                    <NInputGroup>
                      <NInputNumber
                        v-model:value="lotteryOption.giftMinPrice"
                        :disabled="isStartLottery"
                        placeholder="最低价格"
                        :min="0"
                        style="width: 50%"
                      >
                        <template #suffix>
                          元
                        </template>
                      </NInputNumber>
                      <NInput
                        v-model:value="lotteryOption.giftName"
                        :disabled="isStartLottery"
                        placeholder="指定礼物名称"
                        style="width: 50%"
                      />
                    </NInputGroup>
                  </NFormItem>
                </template>

                <NFormItem label="身份限制">
                  <NSpace>
                    <NCheckbox
                      v-model:checked="lotteryOption.needGuard"
                      :disabled="isStartLottery"
                    >
                      舰长
                    </NCheckbox>
                    <NCheckbox
                      v-model:checked="lotteryOption.needFanMedal"
                      :disabled="isStartLottery"
                    >
                      粉丝牌
                    </NCheckbox>
                    <NCheckbox
                      v-model:checked="lotteryOption.needWearFanMedal"
                      :disabled="isStartLottery"
                    >
                      佩戴
                    </NCheckbox>
                  </NSpace>
                </NFormItem>

                <NCollapseTransition :show="lotteryOption.needFanMedal">
                  <NFormItem label="粉丝牌等级">
                    <NInputNumber
                      v-model:value="lotteryOption.fanCardLevel"
                      :min="1"
                      :max="50"
                      :disabled="isStartLottery"
                    />
                  </NFormItem>
                </NCollapseTransition>
              </NForm>
            </div>
          </div>

          <!-- 右侧：玩法设置 -->
          <div class="setting-column">
            <div class="setting-section">
              <div class="section-header">
                <NIcon :component="Sparkle24Filled" />
                玩法设置
              </div>
              <NForm
                label-placement="left"
                label-width="auto"
                size="small"
              >
                <div class="form-row">
                  <NFormItem label="抽取人数" style="flex: 1">
                    <NInputNumber
                      v-model:value="lotteryOption.resultCount"
                      :min="1"
                      :disabled="isStartLottery"
                      style="width: 100%"
                    />
                  </NFormItem>
                  <NFormItem label="动画速度" style="flex: 1">
                    <NInputNumber
                      v-model:value="lotteryOption.animationSpeed"
                      :step="100"
                      :min="100"
                      :max="5000"
                      :disabled="isLottering"
                      style="width: 100%"
                    >
                      <template #suffix>
                        ms
                      </template>
                    </NInputNumber>
                  </NFormItem>
                </div>

                <NFormItem label="玩法模式">
                  <div class="mode-selector-grid">
                    <div
                      v-for="(desc, key) in lotteryTypeDescriptions"
                      :key="key"
                      class="mode-card"
                      :class="{
                        active: lotteryOption.lotteryType === key,
                        disabled: isLottering || (key === 'wheel' && currentUsers.length < 2)
                      }"
                      @click="!isLottering && (key !== 'wheel' || currentUsers.length >= 2) && (lotteryOption.lotteryType = key as any)"
                    >
                      <div class="mode-icon">
                        <NIcon v-if="key === 'single'" :component="Delete24Filled" />
                        <NIcon v-else-if="key === 'half'" :component="Pause24Filled" style="transform: rotate(90deg)" />
                        <NIcon v-else-if="key === 'flip'" :component="Sparkle24Filled" />
                        <NIcon v-else-if="key === 'wheel'" :component="Target24Filled" />
                        <NIcon v-else-if="key === 'cards'" :component="Add24Filled" />
                        <NIcon v-else-if="key === 'elimination'" :component="Play24Filled" />
                      </div>
                      <div class="mode-info">
                        <div class="mode-title">
                          {{ key === 'single' ? '单个淘汰' :
                             key === 'half' ? '减半淘汰' :
                             key === 'flip' ? '翻牌抽取' :
                             key === 'wheel' ? '转轮抽取' :
                             key === 'cards' ? '抽卡模式' : '淘汰赛' }}
                        </div>
                        <div class="mode-desc">{{ desc }}</div>
                      </div>
                    </div>
                  </div>
                </NFormItem>
              </NForm>
            </div>
          </div>
        </div>
      </div>
      <NCard
        v-if="originUsers"
        size="small"
        style="margin-top: 16px; min-height: 400px"
      >
        <template #header>
          <NSpace
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
            <NSpace>
              <NButton
                :type="isStartLottery ? 'warning' : 'success'"
                :loading="isStartLottery && !isLotteried"
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
                :disabled="isLottering || originUsers.length == 0"
                @click="clear"
              >
                清空
              </NButton>
            </NSpace>
          </NSpace>
        </template>

        <div
          v-if="isLottering || lotteryProgress > 0 || isStartLottery"
          class="status-bar"
        >
          <div
            v-if="isStartLottery"
            style="color: var(--n-primary-color)"
          >
            <NSpace
              align="center"
              justify="center"
            >
              <NIcon
                :component="Sparkle24Filled"
                class="n-icon-spin"
              />
              正在监听弹幕/礼物中...
            </NSpace>
          </div>
          <div v-else-if="lotteryProgress > 0 && lotteryProgress < 100">
            <NProgress
              type="line"
              :percentage="lotteryProgress"
              :indicator-placement="'inside'"
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
          <NButton
            v-if="!wheelSpinning && !isLottering"
            type="primary"
            size="large"
            style="margin-top: 20px"
            @click="startWheelLottery"
          >
            <template #icon>
              <NIcon :component="Target24Filled" />
            </template>
            开始转动
          </NButton>
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
                  :src="`${user.avatar}@64w_64h`"
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
    <NInput :value="`${CURRENT_HOST}obs/live-lottery?code=${code}`" />
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

  <!-- 手动添加用户模态框 -->
  <NModal
    v-model:show="showAddUserModal"
    preset="card"
    title="手动添加用户"
    style="max-width: 90%; width: 500px"
    closable
  >
    <NForm>
      <NFormItem label="用户名" required>
        <NInput
          v-model:value="manualUserForm.name"
          placeholder="请输入用户名"
        />
      </NFormItem>
      <NFormItem label="头像链接">
        <NInput
          v-model:value="manualUserForm.avatar"
          placeholder="请输入头像链接"
        />
      </NFormItem>
      <NSpace>
        <NFormItem label="粉丝牌等级">
          <NInputNumber
            v-model:value="manualUserForm.fans_medal_level"
            :min="0"
            :max="50"
            style="width: 120px"
          />
        </NFormItem>
        <NFormItem label="粉丝牌名称">
          <NInput
            v-model:value="manualUserForm.fans_medal_name"
            placeholder="粉丝牌名称"
            style="width: 150px"
          />
        </NFormItem>
      </NSpace>
      <NFormItem label="舰长等级">
        <NInputNumber
          v-model:value="manualUserForm.guard_level"
          :min="0"
          :max="3"
          style="width: 120px"
        />
      </NFormItem>
    </NForm>

    <template #footer>
      <NSpace justify="end">
        <NButton @click="showAddUserModal = false">
          取消
        </NButton>
        <NButton type="primary" @click="addManualUser">
          <template #icon>
            <NIcon :component="Add24Filled" />
          </template>
          添加用户
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>

<style scoped>
.settings-wrapper {
  margin-bottom: 16px;
  margin-top: 16px;
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 4px;
}


.settings-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.setting-column {
  flex: 1;
  min-width: 300px;
}

.form-row {
  display: flex;
  gap: 16px;
  width: 100%;
}

@media (max-width: 600px) {
  .form-row {
    flex-direction: column;
    gap: 0;
  }
}

.setting-section {
  background: var(--n-card-color);
  border-radius: 12px;
  padding: 20px;
  height: 100%;
  border: 1px solid var(--n-border-color);
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.setting-section:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.section-header {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--n-text-color);
  border-bottom: 1px dashed var(--n-border-color);
  padding-bottom: 12px;
}

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

.mode-selector-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
}

.mode-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: 8px;
  background-color: var(--n-card-color);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
  gap: 8px;
}

.mode-card:hover:not(.disabled) {
  border-color: var(--n-primary-color);
  background-color: rgba(var(--n-primary-color-rgb), 0.05);
  transform: translateY(-2px);
}

.mode-card.active {
  border-color: var(--n-primary-color);
  background-color: rgba(var(--n-primary-color-rgb), 0.1);
  color: var(--n-primary-color);
  box-shadow: 0 0 0 2px rgba(var(--n-primary-color-rgb), 0.2);
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
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.lottery-card-wrapper.flip-mode {
  cursor: pointer;
}

.lottery-card-wrapper.flip-mode:hover {
  transform: scale(1.02);
}

.lottery-card-wrapper.eliminated {
  opacity: 0.4;
  transform: scale(0.9);
  filter: grayscale(0.8);
}

.lottery-card-wrapper.winner {
  animation: winnerGlow 1s ease-in-out infinite alternate;
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
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.card-front {
  transform: rotateY(180deg);
}

.winner-card {
  --n-border-color: #18a058 !important;
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
  animation: float 2s ease-in-out infinite;
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
  background:
    radial-gradient(circle at 20% 20%, rgba(255,255,255,0.1) 2px, transparent 2px),
    radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 2px, transparent 2px),
    radial-gradient(circle at 40% 60%, rgba(255,255,255,0.1) 2px, transparent 2px);
  background-size: 30px 30px;
  opacity: 0.3;
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
  background: linear-gradient(45deg, #ffd700, #ffed4a);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #d97706;
  animation: bounce 1s ease-in-out infinite;
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
  background: rgba(0, 0, 0, 0.2);
  color: white;
  padding: 1px 4px;
  border-radius: 6px;
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
  background: linear-gradient(45deg, #18a058, #36ad6a);
  color: white;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: bold;
  animation: celebrate 0.5s ease-in-out;
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
  border: 4px solid #18a058;
  box-shadow: 0 0 15px rgba(0,0,0,0.2);
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
  border-bottom: 20px solid #d03050;
  z-index: 10;
  filter: drop-shadow(1px 1px 2px rgba(0,0,0,0.3));
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
    color: #333;
    white-space: nowrap;
    text-shadow: 0 0 2px white;
}

/* 动画效果 */
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
}

@keyframes bounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}

@keyframes celebrate {
  0% { transform: scale(0) rotate(0deg); }
  50% { transform: scale(1.2) rotate(180deg); }
  100% { transform: scale(1) rotate(360deg); }
}

@keyframes winnerGlow {
  0% {
    box-shadow: 0 0 5px rgba(24, 160, 88, 0.3);
  }
  100% {
    box-shadow: 0 0 20px rgba(24, 160, 88, 0.6), 0 0 30px rgba(24, 160, 88, 0.3);
  }
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
