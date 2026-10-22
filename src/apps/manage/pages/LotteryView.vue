<script setup lang="ts">
import {
  ArrowDownload24Regular,
  Comment24Regular,
  Copy24Regular,
  Delete24Filled,
  Games24Filled,
  Games24Regular,
  History24Filled,
  Link24Regular,
  Pause24Filled,
  PeopleQueue24Regular,
  PersonAdd24Filled,
  Play24Filled,
  Settings24Regular,
  Sparkle24Filled,
  Target24Regular,
  Trophy24Filled,
} from '@vicons/fluent'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import { useMessage } from '@/shared/utils'
import { computed, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type {
  LotteryUserInfo,
  OpenLiveLotteryUserInfo,
} from '@/api/api-models'
import {
  getApiLotteryComments,
  getApiLotteryForward,
  postApiLotteryLiveUpdateUsers,
} from '@/api/generated/lottery/lottery'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import LotteryAddUserModal from '@/apps/open-live/components/lottery/LotteryAddUserModal.vue'
import LotteryHistoryModal from '@/apps/open-live/components/lottery/LotteryHistoryModal.vue'
import LotteryObsModal from '@/apps/open-live/components/lottery/LotteryObsModal.vue'
import LotterySettingsPanel from '@/apps/open-live/components/lottery/LotterySettingsPanel.vue'
import type {
  LotteryHistory as LiveLotteryHistory,
  LotteryOption as LiveLotteryOption,
  ManualUserFormModel,
} from '@/apps/open-live/components/lottery/lotteryTypes'
import {
  buildLiveLotterySyncBody,
  buildLotteryObsUrl,
  formatLotteryAvatar,
  getAvatarUrl,
  getRandomInt as getLiveRandomInt,
  isUserValid as isLiveUserValid,
  resolveLotteryIdentityCode,
  shouldSyncLiveLottery,
} from '@/apps/open-live/components/lottery/lotteryUtils'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { refreshCaptcha, requestWithCaptchaRetry } from '@/shared/captcha'
import { CURRENT_HOST } from '@/shared/config'
import type { DanmakuInfo, GiftInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Input } from '@/shared/ui/input'
import { Separator } from '@/shared/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { objectsToCSV } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

// 主导航 Tab
const activeMainTab = ref<'live' | 'dynamic'>('live')

const message = useMessage()
const accountInfo = useAccount()

// ======================= 1. 直播间实时抽奖 (Live Lottery) =======================
const liveDefaultOption: LiveLotteryOption = {
  resultCount: 1,
  type: 'danmaku',
  lotteryType: 'single',
  danmakuFilterType: 'all',
  danmakuKeyword: '',
  needFanMedal: false,
  needWearFanMedal: false,
  needGuard: false,
  fanCardLevel: 1,
  animationSpeed: 1000,
}
const liveOption = usePersistedStorage('Settings.OpenLive.LotteryOption', liveDefaultOption)
const liveHistory = usePersistedStorage<LiveLotteryHistory[]>('OpenLive.LotteryHistory', [])

const client = await useDanmakuClient().initOpenlive()
const lotteryCode = computed(() => resolveLotteryIdentityCode(undefined, accountInfo.value?.biliAuthCode))
const obsUrl = computed(() => buildLotteryObsUrl(CURRENT_HOST, accountInfo.value?.id, lotteryCode.value))

const originUsers = ref<OpenLiveLotteryUserInfo[]>([])
const currentUsers = ref<OpenLiveLotteryUserInfo[]>([])
const liveResultUsers = ref<OpenLiveLotteryUserInfo[]>([])
const isStartLiveLottery = ref(false)
const isLiveLottering = ref(false)
const isLiveLotteried = ref(false)
const showLiveObsModal = ref(false)
const showLiveHistoryModal = ref(false)
const showLiveAddUserModal = ref(false)
const liveProgress = ref(0)
const eliminatedUsers = ref<OpenLiveLotteryUserInfo[]>([])

interface CardState {
  flipped: boolean
  isWinner: boolean
  eliminated: boolean
}
const cardStates = ref<Record<string, CardState>>({})
const flipEnabled = ref(false)

function ensureCardState(userId: string): CardState {
  if (!cardStates.value[userId]) {
    cardStates.value[userId] = { flipped: false, isWinner: false, eliminated: false }
  }
  return cardStates.value[userId]
}

function syncCardStates(users: OpenLiveLotteryUserInfo[], options: { reset?: boolean } = {}) {
  const nextStates: Record<string, CardState> = {}
  users.forEach((user) => {
    const existing = cardStates.value[user.openId]
    nextStates[user.openId] =
      options.reset || !existing ? { flipped: false, isWinner: false, eliminated: false } : { ...existing }
  })
  cardStates.value = nextStates
}

function updateLiveUsers(force = false) {
  if (
    !force &&
    !shouldSyncLiveLottery({
      originCount: originUsers.value.length,
      resultCount: liveResultUsers.value.length,
      drawing: isLiveLottering.value,
      finished: isLiveLotteried.value,
    })
  ) {
    return
  }
  postApiLotteryLiveUpdateUsers(
    buildLiveLotterySyncBody({
      code: lotteryCode.value,
      users: currentUsers.value,
      resultUsers: liveResultUsers.value,
      drawing: isLiveLottering.value,
      finished: isLiveLotteried.value,
    }) as any,
  ).catch((err) => {
    console.error('[Lottery] 更新历史抽奖用户失败', err)
  })
}

function addLiveUser(user: OpenLiveLotteryUserInfo, danmu?: any) {
  if (originUsers.value.find((u) => u.openId == user.openId) || (!isStartLiveLottery.value && danmu)) return
  if (danmu && !isLiveUserValid(user, danmu, liveOption.value)) return

  originUsers.value.push(user)
  currentUsers.value.push(user)
  ensureCardState(user.openId)
  syncCardStates(currentUsers.value)
  updateLiveUsers()
}

function addManualLiveUser(payload: ManualUserFormModel) {
  if (!payload.name.trim()) {
    message.error('请输入用户名')
    return
  }
  const formattedAvatar = formatLotteryAvatar(payload.avatar, 96)
  const newUser: OpenLiveLotteryUserInfo = {
    uId: Date.now(),
    openId: `manual_${Date.now()}`,
    name: payload.name.trim(),
    avatar: formattedAvatar,
    fans_medal_level: payload.fans_medal_level,
    fans_medal_name: payload.fans_medal_name,
    fans_medal_wearing_status: payload.fans_medal_level > 0,
    guard_level: payload.guard_level,
  }
  addLiveUser(newUser)
  message.success(`已添加观众: ${newUser.name}`)
  showLiveAddUserModal.value = false
}

function onDanmaku(data: DanmakuInfo) {
  if (liveOption.value.type !== 'danmaku') return
  addLiveUser(
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
    data,
  )
}

function onGift(data: GiftInfo) {
  if (liveOption.value.type !== 'gift') return
  addLiveUser(
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
    data,
  )
}

function clearLiveUsers() {
  originUsers.value = []
  currentUsers.value = []
  liveResultUsers.value = []
  eliminatedUsers.value = []
  cardStates.value = {}
  isLiveLotteried.value = false
  isLiveLottering.value = false
  liveProgress.value = 0
  updateLiveUsers(true)
  message.success('已清空抽奖池')
}

async function startLiveLottery() {
  if (currentUsers.value.length < liveOption.value.resultCount) {
    message.warning('当前奖池人数少于抽奖人数')
    return
  }
  isLiveLottering.value = true
  isLiveLotteried.value = false
  liveResultUsers.value = []
  eliminatedUsers.value = []
  liveProgress.value = 0
  flipEnabled.value = false

  updateLiveUsers()

  const pool = [...currentUsers.value]
  const target = liveOption.value.resultCount

  while (pool.length > target) {
    const removed = pool.splice(getLiveRandomInt(pool.length), 1)[0]
    eliminatedUsers.value.push(removed)
    const st = ensureCardState(removed.openId)
    st.eliminated = true
    liveProgress.value = Math.floor(
      ((currentUsers.value.length - pool.length) / (currentUsers.value.length - target)) * 100,
    )
    await new Promise((r) => setTimeout(r, Math.max(80, 500 - pool.length * 10)))
  }

  liveResultUsers.value = pool
  pool.forEach((w) => {
    const st = ensureCardState(w.openId)
    st.isWinner = true
    st.flipped = true
  })
  isLiveLottering.value = false
  isLiveLotteried.value = true
  liveProgress.value = 100
  updateLiveUsers(true)

  liveHistory.value.unshift({
    users: pool,
    time: Date.now(),
  })
  message.success(`抽奖完成，已产生 ${pool.length} 位中奖者`)
}

// ======================= 2. B站动态与评论抽奖 =======================
interface TempLotteryResponseModel {
  users: LotteryUserInfo[]
  createTime: number
  total: number
}
interface DynamicLotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half'
  needVIP: boolean
  needFanCard: boolean
  needGuard: boolean
  needCharge: boolean
  fanCardLevel: number
}
interface DynamicLotteryHistory {
  users: LotteryUserInfo[]
  time: number
  type: 'comment' | 'forward'
  url: string
}

const dynamicHistory = usePersistedStorage<DynamicLotteryHistory[]>('LotteryHistory', [])
const dynamicOption = usePersistedStorage<DynamicLotteryOption>('Settings.LotteryOption', {
  resultCount: 1,
  lotteryType: 'single',
  needVIP: false,
  needFanCard: false,
  needGuard: false,
  needCharge: false,
  fanCardLevel: 1,
})

const turnstileToken = ref('')
const turnstile = ref()
const isDynamicLoading = ref(false)
const isDynamicLottering = ref(false)
const isDynamicLotteried = ref(false)

const inputDynamic = ref<string>('')
const inputDynamicId = computed(() => {
  try {
    const id = BigInt(inputDynamic.value ?? '')
    return id
  } catch {
    try {
      const url = new URL(inputDynamic.value ?? '')
      if (url.host.endsWith('bilibili.com')) {
        const sp = url.pathname.split('/')
        return BigInt(sp.length > 1 ? sp[sp.length - 1] : sp[0])
      }
    } catch {
      return null
    }
  }
  return null
})

const dynamicType = ref<'comment' | 'forward'>('comment')
const commentUsers = ref<TempLotteryResponseModel>()
const forwardUsers = ref<TempLotteryResponseModel>()
const dynamicResultUsers = ref<LotteryUserInfo[]>([])
const dynamicEliminatedIds = ref<Set<number>>(new Set())
const rollingId = ref<number>()

const currentDynamicUsers = computed(() => (dynamicType.value === 'comment' ? commentUsers.value : forwardUsers.value))
const validDynamicUsers = computed(() => currentDynamicUsers.value?.users.filter((u) => isDynamicUserValid(u)) ?? [])

function isDynamicUserValid(u: LotteryUserInfo) {
  if (dynamicOption.value.needVIP && !u.isVIP) return false
  if (dynamicOption.value.needFanCard && (u.card?.level ?? -1) < dynamicOption.value.fanCardLevel) return false
  if (dynamicOption.value.needGuard && !u.card?.isGuard) return false
  if (dynamicOption.value.needCharge && !u.card?.isCharge) return false
  return true
}

async function fetchDynamicUsers() {
  const dynamicId = inputDynamicId.value
  if (!dynamicId) {
    message.error('请输入正确的 B 站动态 ID 或链接')
    return
  }
  isDynamicLoading.value = true
  try {
    const res = await requestWithCaptchaRetry({
      getToken: () => turnstileToken.value,
      refresh: () => refreshCaptcha(turnstile.value),
      request: (captchaToken) => {
        const params = { id: dynamicId as unknown as number }
        const options = { headers: { Turnstile: captchaToken } }
        return dynamicType.value === 'comment'
          ? getApiLotteryComments(params, options)
          : getApiLotteryForward(params, options)
      },
    })
    if (res.code === 200 && res.data) {
      res.data.users = new List(res.data.users).DistinctBy((u) => u.uId).ToArray()
      res.data.total = res.data.users.length
      if (dynamicType.value === 'comment') {
        commentUsers.value = res.data as unknown as TempLotteryResponseModel
      } else {
        forwardUsers.value = res.data as unknown as TempLotteryResponseModel
      }
      dynamicResultUsers.value = []
      dynamicEliminatedIds.value = new Set()
      isDynamicLotteried.value = false
      message.success(`成功拉取 ${res.data.total} 条用户数据`)
    } else {
      message.error(`拉取失败: ${res.message}`)
    }
  } catch (err: any) {
    message.error(`拉取失败: ${err?.message || err}`)
  } finally {
    turnstile.value?.reset()
    isDynamicLoading.value = false
  }
}

async function startDynamicLottery() {
  const valid = validDynamicUsers.value
  if (valid.length < dynamicOption.value.resultCount) {
    message.warning('符合筛选条件的有效用户数不足')
    return
  }
  isDynamicLottering.value = true
  isDynamicLotteried.value = false
  dynamicResultUsers.value = []
  dynamicEliminatedIds.value = new Set()

  try {
    const pool = [...valid]
    const target = dynamicOption.value.resultCount

    while (pool.length > target) {
      rollingId.value = pool[getLiveRandomInt(pool.length)].uId
      const removed = pool.splice(getLiveRandomInt(pool.length), 1)[0]
      dynamicEliminatedIds.value = new Set(dynamicEliminatedIds.value).add(removed.uId)
      await new Promise((r) => setTimeout(r, pool.length > 30 ? 60 : 250))
    }
    rollingId.value = undefined
    dynamicResultUsers.value = pool
    isDynamicLottering.value = false
    isDynamicLotteried.value = true

    dynamicHistory.value.unshift({
      users: pool,
      time: Date.now(),
      type: dynamicType.value,
      url: inputDynamicId.value ? `https://t.bilibili.com/${inputDynamicId.value}` : inputDynamic.value,
    })
    message.success('动态抽奖完成，已存入历史')
  } catch (err) {
    isDynamicLottering.value = false
  }
}

function exportWinnersCsv() {
  if (!dynamicResultUsers.value.length) return
  const csv = objectsToCSV(
    dynamicResultUsers.value.map((u) => ({
      用户名: u.name,
      UID: u.uId,
      等级: u.level,
    })),
  )
  saveAs(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }), `dynamic-lottery-${Date.now()}.csv`)
  message.success('中奖名单已导出 CSV')
}

onMounted(() => {
  client.onEvent('danmaku', onDanmaku)
  client.onEvent('gift', onGift)
})

onUnmounted(() => {
  client.offEvent('danmaku', onDanmaku)
  client.offEvent('gift', onGift)
  turnstile.value?.remove?.()
})
</script>

<template>
  <div class="space-y-4 w-full">
    <ManagePageHeader
      title="抽奖管理控制台"
      subtitle="集成直播间实时弹幕/礼物翻牌抽奖（支持 OBS 实时同步大屏）与 B站动态/视频评论离线智能抽选"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 600x800 或按需调整',
        },
      ]"
    />

    <Tabs
      v-model="activeMainTab"
      class="w-full"
    >
      <TabsList class="grid w-full grid-cols-2 max-w-sm p-0.5 bg-muted">
        <TabsTrigger
          value="live"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Games24Regular"
            class="h-3.5 w-3.5"
          />
          直播间实时弹幕抽奖
        </TabsTrigger>
        <TabsTrigger
          value="dynamic"
          class="text-xs h-7 gap-1"
        >
          <component
            :is="Comment24Regular"
            class="h-3.5 w-3.5"
          />
          B站动态/评论智能抽奖
        </TabsTrigger>
      </TabsList>

      <!-- Tab 1: 直播间实时抽奖 -->
      <TabsContent
        value="live"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardContent class="p-3.5 flex items-center justify-between gap-3 flex-wrap">
            <div class="flex items-center gap-2">
              <Badge
                :variant="isStartLiveLottery ? 'success' : 'outline'"
                class="text-xs"
              >
                {{ isStartLiveLottery ? '正在抓取弹幕/送礼' : '已暂停采集' }}
              </Badge>
              <Badge
                variant="brand"
                class="text-xs"
              >
                奖池观众: {{ currentUsers.length }} 人
              </Badge>
              <Badge
                v-if="liveResultUsers.length > 0"
                variant="warning"
                class="text-xs"
              >
                中奖人数: {{ liveResultUsers.length }} 人
              </Badge>
            </div>

            <div class="flex items-center gap-2 flex-wrap">
              <Button :variant="isStartLiveLottery ? 'outline' : 'default'" :class="{ 'border-amber-500 text-amber-500 hover:bg-amber-500/10': isStartLiveLottery }" @click="isStartLiveLottery = !isStartLiveLottery">
                <component
                  :is="isStartLiveLottery ? Pause24Filled : Play24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                {{ isStartLiveLottery ? '暂停收集' : '开始收集观众' }}
              </Button>

              <Button variant="secondary" :loading="isLiveLottering" :disabled="currentUsers.length === 0" @click="startLiveLottery">
                <component
                  :is="Sparkle24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                开始翻牌抽取
              </Button>

              <Button variant="outline" @click="showLiveAddUserModal = true">
                <component
                  :is="PersonAdd24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                手动加人
              </Button>

              <Button variant="outline" @click="showLiveObsModal = true">
                OBS 组件大屏
              </Button>

              <Button variant="outline" @click="showLiveHistoryModal = true">
                <component
                  :is="History24Filled"
                  class="h-3.5 w-3.5 mr-1"
                />
                历史
              </Button>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button variant="ghost" class="text-destructive hover:bg-destructive/10" :disabled="currentUsers.length === 0">
                    清空奖池
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent class="sm:max-w-md">
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空当前抽奖池？</AlertDialogTitle>
                    <AlertDialogDescription class="text-xs">
                      确定清空当前收集的所有观众吗？
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="clearLiveUsers"
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        <!-- 奖池卡片流与设置分栏 -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 奖池卡片 (8 列) -->
          <Card class="lg:col-span-8 flex flex-col">
            <CardHeader class="p-3.5 pb-2">
              <div class="flex items-center gap-2">
                <component
                  :is="PeopleQueue24Regular"
                  class="h-4 w-4 text-muted-foreground"
                />
                <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                  实时奖池观众卡片
                </CardTitle>
              </div>
            </CardHeader>

            <CardContent class="p-3.5 flex-1 flex flex-col space-y-3">
              <!-- 抽奖中进度条 -->
              <div
                v-if="isLiveLottering"
                class="w-full bg-muted rounded-full h-2 overflow-hidden"
              >
                <div
                  class="bg-brand h-full rounded-full transition-all duration-150 animate-pulse"
                  :style="{ width: `${liveProgress}%` }"
                />
              </div>

              <!-- 观众卡片网格 -->
              <div
                v-if="currentUsers.length > 0"
                class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[500px] overflow-y-auto p-1"
              >
                <div
                  v-for="user in currentUsers"
                  :key="user.openId"
                  class="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-card/60 transition-all text-center relative overflow-hidden"
                  :class="{
                    'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500': cardStates[user.openId]?.isWinner,
                    'opacity-30 scale-95': cardStates[user.openId]?.eliminated,
                  }"
                >
                  <Avatar class="h-9 w-9 mb-1.5 border border-border">
                    <AvatarImage :src="getAvatarUrl(user.avatar)" />
                    <AvatarFallback>{{ user.name.slice(0, 1) }}</AvatarFallback>
                  </Avatar>
                  <span
                    class="text-xs font-medium text-foreground truncate w-full"
                    :title="user.name"
                  >
                    {{ user.name }}
                  </span>
                  <Badge
                    v-if="cardStates[user.openId]?.isWinner"
                    variant="warning"
                    class="text-[9px] px-1 py-0 h-3.5 mt-1"
                  >
                    中奖
                  </Badge>
                </div>
              </div>
              <div
                v-else
                class="text-center py-16 text-xs text-muted-foreground"
              >
                暂无观众加入，请开启收集让观众发弹幕或赠送礼物
              </div>
            </CardContent>
          </Card>

          <!-- 规则设置 (4 列) -->
          <div class="lg:col-span-4">
            <LotterySettingsPanel
              :option="liveOption"
              :is-start-lottery="isStartLiveLottery"
              :is-lottering="isLiveLottering"
              :current-users-length="currentUsers.length"
              @reset="clearLiveUsers"
            />
          </div>
        </div>
      </TabsContent>

      <!-- Tab 2: B站动态/评论智能抽奖 -->
      <TabsContent
        value="dynamic"
        class="mt-3 space-y-3"
      >
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <div class="flex items-center gap-2">
              <component
                :is="Link24Regular"
                class="h-4 w-4 text-muted-foreground"
              />
              <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                输入动态或视频链接
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent class="p-3.5 space-y-3">
            <div class="flex items-center gap-3 flex-wrap">
              <div class="flex items-center gap-1 bg-muted p-0.5 rounded-md">
                <Button size="xs" :variant="dynamicType === 'comment' ? 'default' : 'ghost'" class="px-2.5" @click="dynamicType = 'comment'">
                  评论抽奖
                </Button>
                <Button size="xs" :variant="dynamicType === 'forward' ? 'default' : 'ghost'" class="px-2.5" @click="dynamicType = 'forward'">
                  转发抽奖
                </Button>
              </div>

              <div class="flex items-center gap-1.5 flex-1 min-w-[280px]">
                <Input v-model="inputDynamic" placeholder="输入 B站动态 ID、动态链接 (如 https://t.bilibili.com/123456) 或视频链接" class="flex-1" />
                <Button size="xs" variant="brand" :loading="isDynamicLoading" :disabled="!turnstileToken" @click="fetchDynamicUsers">
                  拉取用户数据
                </Button>
              </div>
            </div>

            <CaptchaWidget
              ref="turnstile"
              v-model="turnstileToken"
              class="pt-1"
            />
          </CardContent>
        </Card>

        <!-- 动态抽奖主控制区 -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <!-- 候选池与抽取 (8 列) -->
          <Card class="lg:col-span-8 flex flex-col">
            <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between">
              <div class="flex items-center gap-2">
                <component
                  :is="Target24Regular"
                  class="h-4 w-4 text-muted-foreground"
                />
                <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                  候选观众与中奖结果
                </CardTitle>
              </div>

              <div class="flex items-center gap-2">
                <Button v-if="dynamicResultUsers.length> 0"
                  size="xs"
                  variant="outline"
                  @click="exportWinnersCsv"
                >
                  <component
                    :is="ArrowDownload24Regular"
                    class="h-3.5 w-3.5 mr-1"
                  />
                  导出中奖 CSV
                </Button>

                <Button size="xs" variant="brand" :loading="isDynamicLottering" :disabled="validDynamicUsers.length === 0" @click="startDynamicLottery">
                  开始抽奖 (抽取 {{ dynamicOption.resultCount }} 人)
                </Button>
              </div>
            </CardHeader>

            <CardContent class="p-3.5 flex-1">
              <div
                v-if="validDynamicUsers.length > 0"
                class="flex flex-wrap gap-2 max-h-[460px] overflow-y-auto p-1"
              >
                <div
                  v-for="user in validDynamicUsers"
                  :key="user.uId"
                  class="flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card/60 text-xs transition-all"
                  :class="{
                    'border-amber-500 bg-amber-500/10 font-bold ring-1 ring-amber-500 text-amber-500': dynamicResultUsers.some((w) => w.uId === user.uId),
                    'opacity-30': dynamicEliminatedIds.has(user.uId),
                    'ring-2 ring-brand scale-105 bg-brand/10': rollingId === user.uId,
                  }"
                >
                  <Avatar class="h-5 w-5">
                    <AvatarImage :src="getAvatarUrl(user.avatar)" />
                    <AvatarFallback>{{ user.name.slice(0, 1) }}</AvatarFallback>
                  </Avatar>
                  <span class="truncate max-w-[100px]">{{ user.name }}</span>
                  <Badge
                    v-if="dynamicResultUsers.some((w) => w.uId === user.uId)"
                    variant="warning"
                    class="text-[9px] px-1 py-0 h-3.5"
                  >
                    中奖
                  </Badge>
                </div>
              </div>
              <div
                v-else
                class="text-center py-16 text-xs text-muted-foreground"
              >
                请输入动态链接并拉取评论/转发名单
              </div>
            </CardContent>
          </Card>

          <!-- 抽选条件与过滤 (4 列) -->
          <div class="lg:col-span-4">
            <Card>
              <CardHeader class="p-3.5 pb-2">
                <div class="flex items-center gap-2">
                  <component
                    :is="Settings24Regular"
                    class="h-4 w-4 text-muted-foreground"
                  />
                  <CardTitle class="text-xs font-semibold uppercase tracking-wide">
                    抽选条件与过滤
                  </CardTitle>
                </div>
              </CardHeader>

              <CardContent class="p-3.5 space-y-3.5">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs font-medium text-foreground">抽取人数</span>
                  <Input v-model.number="dynamicOption.resultCount" type="number" min="1" class="w-24 font-mono" />
                </div>

                <Separator />

                <div class="space-y-2.5">
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                    <Checkbox v-model="dynamicOption.needVIP" />
                    <span>仅限大会员</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                    <Checkbox v-model="dynamicOption.needGuard" />
                    <span>仅限大航海舰长</span>
                  </label>
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground select-none">
                    <Checkbox v-model="dynamicOption.needFanCard" />
                    <span>限制粉丝牌等级</span>
                  </label>

                  <div
                    v-if="dynamicOption.needFanCard"
                    class="pl-6 pt-1 flex items-center gap-2"
                  >
                    <span class="text-xs text-muted-foreground">最低等级:</span>
                    <Input size="xs" v-model.number="dynamicOption.fanCardLevel" type="number" min="1" max="40" class="w-20 font-mono" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>
    </Tabs>

    <!-- 弹窗组件 -->
    <LotteryAddUserModal
      v-model:show="showLiveAddUserModal"
      @submit="addManualLiveUser"
    />
    <LotteryHistoryModal
      v-model:show="showLiveHistoryModal"
      :history="liveHistory"
    />
    <LotteryObsModal
      v-model:show="showLiveObsModal"
      :user-id="accountInfo?.id"
      :code="lotteryCode"
    />
  </div>
</template>
