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
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { List } from 'linqts'
import {
  NAlert,
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCollapseTransition,
  NCountdown,
  NDivider,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NGridItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NNumberAnimation,
  NPopconfirm,
  NProgress,
  NRadioButton,
  NRadioGroup,
  NResult,
  NScrollbar,
  NSpin,
  NStatistic,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
  useNotification,
} from 'naive-ui'
import { computed, h, onMounted, onUnmounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type {
  LotteryUserInfo,
  OpenLiveInfo,
  OpenLiveLotteryUserInfo,
  UpdateLiveLotteryUsersModel,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI } from '@/api/query'
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
  shuffleArray,
} from '@/apps/open-live/components/lottery/lotteryUtils'
import CaptchaWidget from '@/apps/user/components/CaptchaWidget.vue'
import { CURRENT_HOST, LOTTERY_API_URL } from '@/shared/config'
import type { DanmakuInfo, GiftInfo } from '@/shared/services/DanmakuClients/OpenLiveClient'
import { usePersistedStorage } from '@/shared/storage/persist'
import { copyToClipboard, objectsToCSV } from '@/shared/utils'
import { useDanmakuClient } from '@/store/useDanmakuClient'

// 主导航 Tab
const activeMainTab = ref<'live' | 'dynamic'>('live')

const message = useMessage()
const notification = useNotification()
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
  QueryPostAPI(
    `${LOTTERY_API_URL}live/update-users`,
    buildLiveLotterySyncBody({
      code: lotteryCode.value,
      users: currentUsers.value,
      resultUsers: liveResultUsers.value,
      drawing: isLiveLottering.value,
      finished: isLiveLotteried.value,
    }),
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

// ======================= 2. B站动态与评论抽奖 (Dynamic Lottery) =======================
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
    const endpoint = dynamicType.value === 'comment' ? 'comments' : 'forward'
    const res = await QueryGetAPI<TempLotteryResponseModel>(
      `${LOTTERY_API_URL}${endpoint}`,
      { id: dynamicId.toString() },
      [['Turnstile', turnstileToken.value]],
    )
    if (res.code === 200 && res.data) {
      res.data.users = new List(res.data.users).DistinctBy((u) => u.uId).ToArray()
      res.data.total = res.data.users.length
      if (dynamicType.value === 'comment') {
        commentUsers.value = res.data
      } else {
        forwardUsers.value = res.data
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
})
</script>

<template>
  <div class="lottery-manage-view">
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

    <NTabs
      v-model:value="activeMainTab"
      type="segment"
      animated
      class="main-nav-tabs"
      style="margin-top: 14px"
    >
      <!-- ================= Tab 1: 直播间实时弹幕/礼物抽奖 ================= -->
      <NTabPane name="live">
        <template #tab>
          <NFlex
            align="center"
            :size="6"
            :wrap="false"
          >
            <NIcon :component="Games24Regular" />
            <span>直播间实时弹幕抽奖</span>
          </NFlex>
        </template>
        <NFlex
          vertical
          :size="16"
          style="margin-top: 14px"
        >
          <!-- 控制工具条卡片 -->
          <NCard size="small">
            <NFlex
              justify="space-between"
              align="center"
              wrap
            >
              <!-- 状态与人数 -->
              <NFlex
                align="center"
                :size="8"
              >
                <NTag
                  :type="isStartLiveLottery ? 'success' : 'default'"
                  round
                >
                  {{ isStartLiveLottery ? '正在抓取弹幕/送礼' : '已暂停采集' }}
                </NTag>
                <NTag
                  type="info"
                  :bordered="false"
                  round
                >
                  奖池观众: {{ currentUsers.length }} 人
                </NTag>
                <NTag
                  v-if="liveResultUsers.length > 0"
                  type="warning"
                  :bordered="false"
                  round
                >
                  中奖人数: {{ liveResultUsers.length }} 人
                </NTag>
              </NFlex>

              <!-- 动作按钮组 -->
              <NFlex
                align="center"
                :size="8"
              >
                <NButton
                  size="small"
                  :type="isStartLiveLottery ? 'warning' : 'success'"
                  @click="isStartLiveLottery = !isStartLiveLottery"
                >
                  <template #icon>
                    <NIcon :component="isStartLiveLottery ? Pause24Filled : Play24Filled" />
                  </template>
                  {{ isStartLiveLottery ? '暂停收集' : '开始收集观众' }}
                </NButton>

                <NButton
                  size="small"
                  type="primary"
                  :loading="isLiveLottering"
                  :disabled="currentUsers.length === 0"
                  @click="startLiveLottery"
                >
                  <template #icon><NIcon :component="Sparkle24Filled" /></template>
                  开始翻牌抽取
                </NButton>

                <NButton
                  size="small"
                  secondary
                  @click="showLiveAddUserModal = true"
                >
                  <template #icon><NIcon :component="PersonAdd24Filled" /></template>
                  手动加人
                </NButton>

                <NButton
                  size="small"
                  secondary
                  @click="showLiveObsModal = true"
                >
                  OBS 组件大屏
                </NButton>

                <NButton
                  size="small"
                  secondary
                  @click="showLiveHistoryModal = true"
                >
                  <template #icon><NIcon :component="History24Filled" /></template>
                  历史
                </NButton>

                <NPopconfirm @positive-click="clearLiveUsers">
                  <template #trigger>
                    <NButton
                      size="small"
                      secondary
                      type="error"
                      >清空奖池</NButton
                    >
                  </template>
                  确定清空当前收集的所有观众吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>
          </NCard>

          <!-- 奖池卡片流与设置分栏 -->
          <NGrid
            :x-gap="16"
            :y-gap="16"
            :cols="12"
            responsive="screen"
          >
            <!-- 奖池卡片 (占 8 列) -->
            <NGi :span="8">
              <NCard size="small">
                <template #header>
                  <NFlex
                    align="center"
                    :size="6"
                  >
                    <NIcon :component="PeopleQueue24Regular" />
                    <span>实时奖池观众卡片</span>
                  </NFlex>
                </template>
                <div
                  v-if="isLiveLottering"
                  style="margin-bottom: 12px"
                >
                  <NProgress
                    type="line"
                    :percentage="liveProgress"
                    processing
                  />
                </div>

                <div
                  v-if="currentUsers.length > 0"
                  class="user-cards-grid"
                >
                  <div
                    v-for="user in currentUsers"
                    :key="user.openId"
                    class="live-user-card"
                    :class="{
                      'is-winner': cardStates[user.openId]?.isWinner,
                      'is-eliminated': cardStates[user.openId]?.eliminated,
                    }"
                  >
                    <NAvatar
                      round
                      size="medium"
                      :src="getAvatarUrl(user.avatar)"
                      class="card-avatar"
                    />
                    <div
                      class="card-name"
                      :title="user.name"
                    >
                      {{ user.name }}
                    </div>
                    <NTag
                      v-if="cardStates[user.openId]?.isWinner"
                      size="tiny"
                      type="warning"
                      round
                    >
                      中奖
                    </NTag>
                  </div>
                </div>
                <NEmpty
                  v-else
                  description="暂无观众加入，请开启收集让观众发弹幕/送礼"
                  style="padding: 60px 0"
                />
              </NCard>
            </NGi>

            <!-- 规则设置 (占 4 列) -->
            <NGi :span="4">
              <LotterySettingsPanel
                :option="liveOption"
                :is-start-lottery="isStartLiveLottery"
                :is-lottering="isLiveLottering"
                :current-users-length="currentUsers.length"
                @reset="clearLiveUsers"
              />
            </NGi>
          </NGrid>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 2: B站动态与视频评论抽奖 ================= -->
      <NTabPane name="dynamic">
        <template #tab>
          <NFlex
            align="center"
            :size="6"
            :wrap="false"
          >
            <NIcon :component="Comment24Regular" />
            <span>B站动态/评论智能抽奖</span>
          </NFlex>
        </template>
        <NFlex
          vertical
          :size="16"
          style="margin-top: 14px"
        >
          <!-- 动态 URL 解析与拉取 -->
          <NCard size="small">
            <template #header>
              <NFlex
                align="center"
                :size="6"
              >
                <NIcon :component="Link24Regular" />
                <span>输入动态或视频链接</span>
              </NFlex>
            </template>
            <NFlex
              align="center"
              :size="10"
            >
              <NRadioGroup
                v-model:value="dynamicType"
                size="small"
              >
                <NRadioButton value="comment">评论抽奖</NRadioButton>
                <NRadioButton value="forward">转发抽奖</NRadioButton>
              </NRadioGroup>

              <NInputGroup style="flex: 1">
                <NInput
                  v-model:value="inputDynamic"
                  size="small"
                  placeholder="输入 B站动态 ID、动态链接 (如 https://t.bilibili.com/123456) 或视频链接"
                  clearable
                />
                <NButton
                  size="small"
                  type="primary"
                  :loading="isDynamicLoading"
                  @click="fetchDynamicUsers"
                >
                  拉取用户数据
                </NButton>
              </NInputGroup>
            </NFlex>
          </NCard>

          <!-- 抽奖控制与结果 -->
          <NGrid
            :x-gap="16"
            :y-gap="16"
            :cols="12"
            responsive="screen"
          >
            <!-- 候选池与抽取 (占 8 列) -->
            <NGi :span="8">
              <NCard size="small">
                <template #header>
                  <NFlex
                    align="center"
                    :size="6"
                  >
                    <NIcon :component="Target24Regular" />
                    <span>候选观众与中奖结果</span>
                  </NFlex>
                </template>
                <template #header-extra>
                  <NFlex
                    align="center"
                    :size="8"
                  >
                    <NButton
                      v-if="dynamicResultUsers.length > 0"
                      size="tiny"
                      secondary
                      @click="exportWinnersCsv"
                    >
                      <template #icon><NIcon :component="ArrowDownload24Regular" /></template>
                      导出中奖 CSV
                    </NButton>
                    <NButton
                      size="small"
                      type="primary"
                      :loading="isDynamicLottering"
                      :disabled="validDynamicUsers.length === 0"
                      @click="startDynamicLottery"
                    >
                      开始抽奖 (抽取 {{ dynamicOption.resultCount }} 人)
                    </NButton>
                  </NFlex>
                </template>

                <div
                  v-if="validDynamicUsers.length > 0"
                  class="dynamic-user-pool"
                >
                  <div
                    v-for="user in validDynamicUsers"
                    :key="user.uId"
                    class="dynamic-user-pill"
                    :class="{
                      'is-winner': dynamicResultUsers.some((w) => w.uId === user.uId),
                      'is-eliminated': dynamicEliminatedIds.has(user.uId),
                      'is-rolling': rollingId === user.uId,
                    }"
                  >
                    <NAvatar
                      round
                      :size="22"
                      :src="getAvatarUrl(user.avatar)"
                    />
                    <span class="uname">{{ user.name }}</span>
                    <span
                      v-if="dynamicResultUsers.some((w) => w.uId === user.uId)"
                      class="winner-tag"
                      >中奖</span
                    >
                  </div>
                </div>
                <NEmpty
                  v-else
                  description="请输入动态链接并拉取评论/转发名单"
                  style="padding: 60px 0"
                />
              </NCard>
            </NGi>

            <!-- 规则过滤 (占 4 列) -->
            <NGi :span="4">
              <NCard size="small">
                <template #header>
                  <NFlex
                    align="center"
                    :size="6"
                  >
                    <NIcon :component="Settings24Regular" />
                    <span>抽选条件与过滤</span>
                  </NFlex>
                </template>
                <NFlex
                  vertical
                  :size="12"
                >
                  <NFlex
                    justify="space-between"
                    align="center"
                  >
                    <span>抽取人数：</span>
                    <NInputNumber
                      v-model:value="dynamicOption.resultCount"
                      :min="1"
                      size="small"
                      style="width: 120px"
                    />
                  </NFlex>

                  <NDivider style="margin: 4px 0" />

                  <NCheckbox v-model:checked="dynamicOption.needVIP">仅限大会员</NCheckbox>
                  <NCheckbox v-model:checked="dynamicOption.needGuard">仅限大航海舰长</NCheckbox>
                  <NCheckbox v-model:checked="dynamicOption.needFanCard">限制粉丝牌等级</NCheckbox>
                  <NInputNumber
                    v-if="dynamicOption.needFanCard"
                    v-model:value="dynamicOption.fanCardLevel"
                    :min="1"
                    :max="40"
                    size="small"
                    placeholder="最低牌子等级"
                  />
                </NFlex>
              </NCard>
            </NGi>
          </NGrid>
        </NFlex>
      </NTabPane>
    </NTabs>

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

<style scoped>
.lottery-manage-view {
  width: 100%;
}

.main-nav-tabs {
  --n-tab-padding: 6px 16px !important;
}

.main-nav-tabs :deep(.n-tabs-rail) {
  width: fit-content;
  max-width: 100%;
}

.main-nav-tabs :deep(.n-tabs-tab) {
  white-space: nowrap;
  font-weight: 500;
}

/* 直播抽奖卡片网格 */
.user-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 10px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px;
}

.live-user-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  border-radius: 8px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  transition: all 0.25s ease;
}

.live-user-card.is-winner {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.15);
  transform: scale(1.05);
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.35);
}

.live-user-card.is-eliminated {
  opacity: 0.3;
  filter: grayscale(1);
}

.card-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--vtsuru-fg);
  text-align: center;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 动态抽奖名单流 */
.dynamic-user-pool {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 480px;
  overflow-y: auto;
  padding: 4px;
}

.dynamic-user-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 16px;
  background: var(--vtsuru-bg-muted);
  border: 1px solid var(--vtsuru-border);
  font-size: 12px;
  transition: all 0.2s ease;
}

.dynamic-user-pill.is-winner {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
  font-weight: 700;
}

.dynamic-user-pill.is-eliminated {
  opacity: 0.35;
  filter: grayscale(0.8);
}

.dynamic-user-pill.is-rolling {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.25);
  transform: scale(1.08);
}

.winner-tag {
  color: #f59e0b;
  font-weight: 800;
}
</style>
