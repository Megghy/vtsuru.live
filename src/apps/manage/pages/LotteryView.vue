<script setup lang="ts">
import type { LotteryUserInfo } from '@/api/api-models'
import { usePersistedStorage } from '@/shared/storage/persist'
import { format } from 'date-fns'
import { List } from 'linqts'
import {
  NAvatar, NButton, NCard, NCheckbox, NCollapseTransition, NCountdown, NDivider,
  NEmpty, NGrid, NGridItem, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber,
  NList, NListItem, NModal, NRadioButton, NRadioGroup, NScrollbar, NFlex, NStatistic,
  NTag, NText, NTime, NTooltip, useMessage, useNotification,
} from 'naive-ui'
import { Dice24Filled, History24Filled, Trophy24Filled } from '@vicons/fluent'
import { computed, h, onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'
import { QueryGetAPI } from '@/api/query'
import { LOTTERY_API_URL, TURNSTILE_KEY } from '@/shared/config'
import { NavigateToNewTab } from '@/shared/utils'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'

interface TempLotteryResponseModel {
  users: LotteryUserInfo[]
  createTime: number
  total: number
}
interface LotteryOption {
  resultCount: number
  lotteryType: 'single' | 'half'
  needVIP: boolean
  needFanCard: boolean
  needGuard: boolean
  needCharge: boolean
  fanCardLevel: number
}
interface LotteryHistory {
  users: LotteryUserInfo[]
  time: number
  type: 'comment' | 'forward'
  url: string
}

const lotteryHistory = usePersistedStorage<LotteryHistory[]>('LotteryHistory', [])

const message = useMessage()
const notification = useNotification()
const token = ref('')
const turnstile = ref()
const defaultOption = {
  resultCount: 1,
  lotteryType: 'single',
  needVIP: false,
  needFanCard: false,
  needGuard: false,
  needCharge: false,
  fanCardLevel: 1,
} as LotteryOption
const lotteryOption = usePersistedStorage('Settings.LotteryOption', defaultOption)

const isLoading = ref(false)
const isLottering = ref(false)
const isLotteried = ref(false)

const showModal = ref(false)

const inputDynamic = ref<string>()
const inputDynamicId = computed(() => {
  try {
    const id = BigInt(inputDynamic.value ?? '')
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
const currentType = ref<'comment' | 'forward'>('comment')

const resultUsers = ref<LotteryUserInfo[]>()
// 抽取动画中被淘汰用户的 uId 集合, 用于实时灰显
const eliminatedIds = ref<Set<number>>(new Set())
// 当前高亮滚动的用户 uId, 营造"正在抽取"效果
const rollingId = ref<number>()
const winnerIds = computed(() => new Set(resultUsers.value?.map(u => u.uId) ?? []))

const commentUsers = ref<TempLotteryResponseModel>()
const forwardUsers = ref<TempLotteryResponseModel>()

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const currentUsers = computed(() => {
  return getCurrentUsers()
})
function getCurrentUsers() {
  switch (currentType.value) {
    case 'comment': {
      return commentUsers.value
    }
    case 'forward': {
      return forwardUsers.value
    }
  }
  return undefined
}
const validUsers = computed(() => {
  return currentUsers.value?.users.filter(u => isUserValid(u))
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
  currentUsers.value?.users.forEach(u => (u.visiable = true))
}
async function fetchLotteryUsers(type: 'comments' | 'forward') {
  const dynamicId = inputDynamicId.value
  if (!dynamicId) {
    message.error('请输入正确的动态 ID 或链接')
    return
  }
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(
    `${LOTTERY_API_URL}${type}`,
    { id: dynamicId.toString() },
    [['Turnstile', token.value]],
  )
    .then((data) => {
      if (data.code == 200) {
        data.data.users = new List(data.data.users).DistinctBy(u => u.uId).ToArray()
        data.data.total = data.data.users.length
        if (type === 'comments') {
          commentUsers.value = data.data
        } else {
          forwardUsers.value = data.data
        }
        reset()
        isCommentCountDown.value = false
      } else {
        message.error(`获取用户失败: ${data.message}`)
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
const getCommentsUsers = () => fetchLotteryUsers('comments')
const getForwardUsers = () => fetchLotteryUsers('forward')
function getRandomInt(max: number) {
  return Math.floor(Math.random() * max)
}
function isUserValid(u: LotteryUserInfo) {
  if (lotteryOption.value.needVIP) {
    if (u.isVIP != true) return false
  }
  if (lotteryOption.value.needFanCard) {
    if ((u.card?.level ?? -1) < lotteryOption.value.fanCardLevel) return false
  }
  if (lotteryOption.value.needGuard) {
    if (u.card?.isGuard != true) return false
  }
  if (lotteryOption.value.needCharge) {
    if (u.card?.isCharge != true) return false
  }
  return true
}
async function startLottery() {
  if (isLottering.value || !currentUsers.value) return
  const valid = validUsers.value ?? []
  if (valid.length < lotteryOption.value.resultCount) {
    message.warning('符合条件的抽奖人数达不到抽选人数')
    return
  }

  isLottering.value = true
  isLotteried.value = false
  resultUsers.value = []
  eliminatedIds.value = new Set()
  rollingId.value = undefined

  try {
    const pool = [...valid]
    const target = lotteryOption.value.resultCount

    if (lotteryOption.value.lotteryType === 'single') {
      // 逐个淘汰, 池子越大节奏越快, 临近结果时放慢制造悬念
      while (pool.length > target) {
        rollingId.value = pool[getRandomInt(pool.length)].uId
        const removed = pool.splice(getRandomInt(pool.length), 1)[0]
        eliminatedIds.value = new Set(eliminatedIds.value).add(removed.uId)
        await delay(pool.length > 30 ? 90 : pool.length - target <= 3 ? 600 : 300)
      }
    } else {
      // 减半: 每轮淘汰约一半, 快速收敛
      while (pool.length > target) {
        const removeCount = Math.min(Math.ceil(pool.length / 2), pool.length - target)
        const next = new Set(eliminatedIds.value)
        for (let i = 0; i < removeCount; i++) {
          next.add(pool.splice(getRandomInt(pool.length), 1)[0].uId)
        }
        eliminatedIds.value = next
        await delay(650)
      }
    }
    rollingId.value = undefined
    onFinishLottery(pool)
  } catch (err) {
    console.error(err)
    message.error('抽奖过程中发生错误')
    isLottering.value = false
  }
}
function onFinishLottery(winners: LotteryUserInfo[]) {
  resultUsers.value = JSON.parse(JSON.stringify(winners))
  isLottering.value = false
  isLotteried.value = true
  notification.create({
    title: '🎉 抽奖完成',
    description: `共 ${winners.length} 位中奖者`,
    duration: 4000,
    content: () =>
      h(NFlex, { vertical: true, size: 6 },
        () => winners.map(user =>
          h(NFlex, { align: 'center', size: 8 }, () => [
            h(NAvatar, { round: true, size: 'small', src: `${user.avatar}@48w_48h`, imgProps: { referrerpolicy: 'no-referrer' } }),
            h('span', user.name),
          ]),
        ),
      ),
    meta: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  })
  lotteryHistory.value.unshift({
    users: winners,
    time: Date.now(),
    type: currentType.value,
    url: inputDynamicId.value ? `https://t.bilibili.com/${inputDynamicId.value}` : inputDynamic.value ?? '',
  })
  message.success('结果已保存至历史记录')
}
function reset() {
  isLotteried.value = false
  eliminatedIds.value = new Set()
  resultUsers.value = []
  rollingId.value = undefined
}
function getLevelColor(level: number) {
  switch (level) {
    case 1: {
      return 'gray'
    }
    case 2: {
      return '#8bd29d'
    }
    case 4: {
      return '#FEBB8B'
    }
    case 3: {
      return '#7BCDEF'
    }
    case 5: {
      return '#EE672A'
    }
    case 6: {
      return '#F04C49'
    }
    default: {
      return 'gray'
    }
  }
}

onUnmounted(() => {
  turnstile.value?.remove()
})
</script>

<template>
  <div class="lottery-view">
    <ManagePageHeader title="动态抽奖" subtitle="从 B 站动态的评论或转发中随机抽取幸运用户">
      <template #action>
        <NButton secondary size="small" @click="showModal = true">
          <template #icon>
            <NIcon :component="History24Filled" />
          </template>
          历史记录
          <NTag v-if="lotteryHistory.length" size="tiny" round :bordered="false" style="margin-left: 6px">
            {{ lotteryHistory.length }}
          </NTag>
        </NButton>
      </template>
    </ManagePageHeader>

    <NCard size="small" :bordered="true">
      <NInputGroup>
        <NInputGroupLabel>动态</NInputGroupLabel>
        <NInput
          v-model:value="inputDynamic"
          placeholder="粘贴动态链接, 或直接输入动态 ID"
          clearable
          :status="inputDynamic && !inputDynamicId ? 'error' : inputDynamicId ? 'success' : undefined"
          :disabled="isLoading || isLottering"
        />
      </NInputGroup>
      <NText v-if="inputDynamic && !inputDynamicId" depth="3" style="font-size: 12px">
        无法识别动态 ID, 请检查链接是否正确
      </NText>

      <NDivider style="margin: 12px 0" />

      <NCard size="small" embedded title="抽奖选项">
        <template #header-extra>
          <NButton size="tiny" secondary :disabled="isLottering" @click="lotteryOption = { ...defaultOption }">
            恢复默认
          </NButton>
        </template>
        <NFlex justify="center">
          <NRadioGroup v-model:value="currentType" :disabled="isLottering">
            <NRadioButton value="comment">
              评论区
            </NRadioButton>
            <NRadioButton value="forward">
              转发
            </NRadioButton>
          </NRadioGroup>
        </NFlex>
        <NDivider style="margin: 12px 0" />
        <NFlex align="center" :size="16" wrap>
          <NInputGroup style="width: 180px">
            <NInputGroupLabel>抽取人数</NInputGroupLabel>
            <NInputNumber
              v-model:value="lotteryOption.resultCount"
              :min="1"
              :disabled="isLottering"
            />
          </NInputGroup>
          <NRadioGroup v-model:value="lotteryOption.lotteryType" size="small" :disabled="isLottering">
            <NRadioButton value="single">
              <NTooltip>
                <template #trigger>
                  逐个淘汰
                </template>
                每次随机淘汰一人, 紧张刺激
              </NTooltip>
            </NRadioButton>
            <NRadioButton value="half">
              <NTooltip>
                <template #trigger>
                  快速减半
                </template>
                每轮淘汰约一半, 人数多时更快
              </NTooltip>
            </NRadioButton>
          </NRadioGroup>
        </NFlex>
        <NDivider style="margin: 12px 0" />
        <NFlex align="center" :size="16" wrap>
          <NText depth="3" style="font-size: 13px">
            参与条件
          </NText>
          <NCheckbox v-model:checked="lotteryOption.needVIP" :disabled="isLottering">
            大会员
          </NCheckbox>
          <template v-if="currentType === 'comment'">
            <NCheckbox v-model:checked="lotteryOption.needCharge" :disabled="isLottering">
              已充电
            </NCheckbox>
            <NCheckbox v-model:checked="lotteryOption.needGuard" :disabled="isLottering">
              舰长
            </NCheckbox>
            <NCheckbox v-model:checked="lotteryOption.needFanCard" :disabled="isLottering">
              佩戴粉丝牌
            </NCheckbox>
            <NCollapseTransition :show="lotteryOption.needFanCard">
              <NInputGroup style="width: 200px">
                <NInputGroupLabel>最低牌等级</NInputGroupLabel>
                <NInputNumber
                  v-model:value="lotteryOption.fanCardLevel"
                  :min="1"
                  :max="50"
                  :disabled="isLottering"
                />
              </NInputGroup>
            </NCollapseTransition>
          </template>
        </NFlex>
      </NCard>
      <NFlex justify="center" align="center" :size="12" style="margin-top: 16px">
        <NButton
          :disabled="!inputDynamicId || !isCommentCountDown || !token || isLottering"
          :loading="!token || isLoading"
          type="primary"
          @click="onGet"
        >
          {{ currentUsers ? '重新加载用户' : '加载用户' }}
        </NButton>
        <NFlex v-if="!isCommentCountDown" align="center" :size="6">
          <NText depth="3" style="font-size: 13px">
            冷却中
          </NText>
          <NCountdown
            :duration="(currentUsers?.createTime ?? -1) + 60000 - Date.now()"
            @finish="isCommentCountDown = true"
          />
        </NFlex>
      </NFlex>
    </NCard>

    <!-- 中奖结果展示 -->
    <NCard v-if="isLotteried && resultUsers?.length" size="small" class="winner-card">
      <NFlex align="center" :size="8" style="margin-bottom: 12px">
        <NIcon :component="Trophy24Filled" :size="22" color="#f0a020" />
        <NText strong style="font-size: 16px">
          恭喜以下 {{ resultUsers.length }} 位中奖
        </NText>
      </NFlex>
      <NFlex :size="16" wrap>
        <NFlex
          v-for="user in resultUsers"
          :key="user.uId"
          align="center"
          :size="10"
          class="winner-item"
        >
          <NAvatar
            round
            :size="44"
            :src="`${user.avatar}@88w_88h`"
            :img-props="{ referrerpolicy: 'no-referrer' }"
          />
          <NText strong>
            {{ user.name }}
          </NText>
        </NFlex>
      </NFlex>
    </NCard>

    <NCard v-if="currentUsers" size="small">
      <NFlex justify="space-between" align="center" wrap :size="12">
        <NFlex align="center" :size="8">
          <NStatistic label="符合条件" :value="validUsers?.length ?? 0" />
          <NDivider vertical />
          <NStatistic label="总参与" :value="currentUsers.total" />
        </NFlex>
        <NFlex :size="12">
          <NButton
            type="primary"
            size="large"
            :loading="isLottering"
            :disabled="isLotteried || !validUsers?.length"
            @click="startLottery"
          >
            <template #icon>
              <NIcon :component="Dice24Filled" />
            </template>
            {{ isLottering ? '抽取中...' : '开始抽取' }}
          </NButton>
          <NButton
            secondary
            size="large"
            :disabled="isLottering || !isLotteried"
            @click="reset"
          >
            重置
          </NButton>
        </NFlex>
      </NFlex>
      <NDivider style="margin: 12px 0" />
      <NEmpty v-if="!validUsers?.length" description="没有符合条件的用户, 试试放宽参与条件" />
      <NGrid
        v-else
        cols="2 500:3 800:5 1100:7"
        :x-gap="10"
        :y-gap="10"
      >
        <NGridItem
          v-for="item in validUsers"
          :key="item.uId"
        >
          <div
            class="user-cell"
            :class="{
              'is-eliminated': eliminatedIds.has(item.uId),
              'is-rolling': rollingId === item.uId,
              'is-winner': isLotteried && winnerIds.has(item.uId),
            }"
          >
            <NAvatar
              round
              lazy
              :size="52"
              :src="`${item.avatar}@104w_104h`"
              :img-props="{ referrerpolicy: 'no-referrer' }"
            />
            <NText class="user-cell__name" :depth="eliminatedIds.has(item.uId) ? 3 : 1">
              {{ item.name }}
            </NText>
            <NFlex justify="center" :size="4" :wrap="false">
              <NTag v-if="item.isVIP" size="tiny" round type="warning" :bordered="false">
                会员
              </NTag>
              <NTag
                v-if="item.level"
                size="tiny"
                round
                :bordered="false"
                :color="{ color: getLevelColor(item.level), textColor: '#fff' }"
              >
                LV{{ item.level }}
              </NTag>
              <NTooltip v-if="item.card">
                <template #trigger>
                  <NTag size="tiny" round :bordered="false" type="info">
                    {{ item.card.name }} {{ item.card.level }}
                  </NTag>
                </template>
                粉丝牌
              </NTooltip>
            </NFlex>
          </div>
        </NGridItem>
      </NGrid>
    </NCard>
    <NModal
      v-model:show="showModal"
      preset="card"
      title="历史记录"
      style="max-width: 90%; width: 800px"
      closable
    >
      <template #header-extra>
        <NButton
          v-if="lotteryHistory.length"
          type="error"
          size="small"
          secondary
          @click="lotteryHistory = []"
        >
          清空全部
        </NButton>
      </template>
      <NScrollbar
        v-if="lotteryHistory.length > 0"
        style="max-height: 70vh"
      >
        <NList style="padding-right: 12px">
          <NListItem
            v-for="item in lotteryHistory"
            :key="item.time"
          >
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="8">
                  <NTag size="small" round :bordered="false" :type="item.type === 'comment' ? 'success' : 'info'">
                    {{ item.type === 'comment' ? '评论' : '转发' }}
                  </NTag>
                  <NText depth="3" style="font-size: 13px">
                    <NTime :time="item.time" />
                  </NText>
                  <NText depth="3" style="font-size: 13px">
                    · {{ item.users.length }} 人
                  </NText>
                </NFlex>
              </template>
              <template #header-extra>
                <NFlex :size="8">
                  <NButton size="small" tertiary @click="NavigateToNewTab(item.url)">
                    目标动态
                  </NButton>
                  <NButton
                    type="error"
                    size="small"
                    quaternary
                    @click="lotteryHistory.splice(lotteryHistory.indexOf(item), 1)"
                  >
                    删除
                  </NButton>
                </NFlex>
              </template>
              <NFlex :size="16" wrap>
                <NFlex
                  v-for="user in item.users"
                  :key="user.uId"
                  align="center"
                  :size="8"
                >
                  <NAvatar
                    round
                    lazy
                    :size="32"
                    :src="`${user.avatar}@64w_64h`"
                    :img-props="{ referrerpolicy: 'no-referrer' }"
                  />
                  <NText>{{ user.name }}</NText>
                </NFlex>
              </NFlex>
            </NCard>
          </NListItem>
        </NList>
      </NScrollbar>
      <NEmpty
        v-else
        description="暂无抽奖记录"
      />
    </NModal>
    <VueTurnstile
      ref="turnstile"
      v-model="token"
      :site-key="TURNSTILE_KEY"
      theme="auto"
      style="text-align: center"
    />
  </div>
</template>

<style scoped>
.lottery-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 用户卡片 */
.user-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 10px;
  border: 1px solid var(--n-border-color, rgba(128, 128, 128, 0.18));
  transition: opacity 0.35s ease, transform 0.35s ease, box-shadow 0.35s ease, filter 0.35s ease;
}

.user-cell__name {
  font-size: 13px;
  font-weight: 500;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 已淘汰: 灰显缩小淡出 */
.user-cell.is-eliminated {
  opacity: 0.35;
  filter: grayscale(0.9);
  transform: scale(0.92);
}

/* 正在滚动选中 */
.user-cell.is-rolling {
  border-color: #f0a020;
  box-shadow: 0 0 0 2px rgba(240, 160, 32, 0.45);
  transform: scale(1.05);
}

/* 中奖高亮 */
.user-cell.is-winner {
  border-color: #f0a020;
  box-shadow: 0 0 12px rgba(240, 160, 32, 0.5);
  animation: winner-pop 0.5s ease;
}

@keyframes winner-pop {
  0% { transform: scale(0.85); }
  60% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

/* 中奖结果卡 */
.winner-card {
  border: 1px solid rgba(240, 160, 32, 0.5);
  background: linear-gradient(135deg, rgba(240, 160, 32, 0.08), transparent);
}

.winner-item {
  padding: 6px 14px 6px 6px;
  border-radius: 24px;
  background: rgba(240, 160, 32, 0.1);
}
</style>
