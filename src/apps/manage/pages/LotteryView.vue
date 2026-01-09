<script setup lang="ts">
import type { LotteryUserInfo } from '@/api/api-models'
import { useLocalStorage, useStorage } from '@vueuse/core'
import { format } from 'date-fns'
import { List } from 'linqts'
import {
  NAvatar,
  NButton,
  NCard,
  NCheckbox,
  NCollapseTransition,
  NCountdown,
  NDivider,
  NEmpty,
  NGrid,
  NGridItem,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSpace,
  NTag,
  NTime,
  NTooltip,
  useMessage,
  useNotification,
} from 'naive-ui'
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

const lotteryHistory = useStorage<LotteryHistory[]>('LotteryHistory', [])

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
const lotteryOption = useLocalStorage('Settings.LotteryOption', defaultOption)

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
const originCommentUsers = ref<TempLotteryResponseModel>()
const originForwardUsers = ref<TempLotteryResponseModel>()
const currentType = ref<'comment' | 'forward'>('comment')

const resultUsers = ref<LotteryUserInfo[]>()

const commentUsers = ref<TempLotteryResponseModel>()
const forwardUsers = ref<TempLotteryResponseModel>()

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
async function getCommentsUsers() {
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(
    `${LOTTERY_API_URL}comments`,
    {
      id: inputDynamicId.value,
    },
    [['Turnstile', token.value]],
  )
    .then((data) => {
      if (data.code == 200) {
        data.data.users = new List(data.data.users).DistinctBy(u => u.uId).ToArray()
        data.data.total = data.data.users.length

        originCommentUsers.value = JSON.parse(JSON.stringify(data.data))
        commentUsers.value = data.data
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
async function getForwardUsers() {
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(
    `${LOTTERY_API_URL}forward`,
    {
      id: inputDynamicId.value,
    },
    [['Turnstile', token.value]],
  )
    .then((data) => {
      if (data.code == 200) {
        data.data.users = new List(data.data.users).DistinctBy(u => u.uId).ToArray()
        data.data.total = data.data.users.length

        originForwardUsers.value = JSON.parse(JSON.stringify(data.data))
        forwardUsers.value = data.data
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
function startLottery() {
  if (!isLottering.value && currentUsers.value) {
    isLottering.value = true
    try {
      const data = currentUsers.value
      if ((validUsers.value?.length ?? -1) < lotteryOption.value.resultCount) {
        message.warning('符合条件的抽奖人数达不到抽选人数')
        isLottering.value = false
        return
      }

      const tempUsers = getCurrentUsers()
      if (tempUsers) tempUsers.users = validUsers.value ?? []

      switch (lotteryOption.value.lotteryType) {
        case 'single': {
          console.log('开始抽取单个用户')
          removeSingleUser()
          function removeSingleUser() {
            if (data.users.length > lotteryOption.value.resultCount) {
              console.log(`[${data.users.length}] 移除${data.users.splice(getRandomInt(data.users.length), 1)[0].name}`)
              setTimeout(() => {
                removeSingleUser()
              }, 500)
            } else {
              onFinishLottery()
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
function onFinishLottery() {
  resultUsers.value = JSON.parse(JSON.stringify(currentUsers.value?.users))
  isLottering.value = false
  isLotteried.value = true
  notification.create({
    title: '抽奖完成',
    description: `共${resultUsers.value?.length}人`,
    duration: 3000,
    content: () =>
      h(
        NSpace,
        { vertical: true },
        resultUsers.value?.map(user =>
          h(NSpace, null, [
            h(NAvatar, { src: `${user.avatar}@32w_32h`, imgProps: { referrerpolicy: 'no-referrer' } }),
            h('span', user.name),
          ]),
        ),
      ),
    meta: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
    onAfterLeave: () => {
      message.success('已保存至历史')
    },
  })
  lotteryHistory.value.push({
    users: currentUsers.value?.users ?? [],
    time: Date.now(),
    type: currentType.value,
    url: inputDynamicId.value ? `https://t.bilibili.com/${inputDynamicId.value}` : inputDynamic.value ?? '',
  })
}
function reset() {
  switch (currentType.value) {
    case 'comment': {
      commentUsers.value = JSON.parse(JSON.stringify(originCommentUsers.value))
      break
    }
    case 'forward': {
      forwardUsers.value = JSON.parse(JSON.stringify(originForwardUsers.value))
      break
    }
  }
  isLotteried.value = false
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
    <ManagePageHeader title="动态抽奖" subtitle="从动态评论/转发中抽取用户">
      <template #action>
        <NButton secondary size="small" @click="showModal = true">
          历史记录
        </NButton>
      </template>
    </ManagePageHeader>

    <NCard size="small" :bordered="true">
    <NInput
      v-model:value="inputDynamic"
      placeholder="动态链接或直接输入动态Id"
      :status="inputDynamicId ? 'success' : 'warning'"
      :disabled="isLoading || isLottering"
    />
    <NDivider style="margin: 10px 0 10px 0" />
    <NCard
      size="small"
      embedded
      title="选项"
    >
      <template #header-extra>
        <NButton
          size="small"
          secondary
          @click="lotteryOption = defaultOption"
        >
          恢复默认
        </NButton>
      </template>
      <NSpace justify="center">
        <NRadioGroup
          v-model:value="currentType"
          name="用户类型"
          :disabled="isLottering"
        >
          <NRadioButton value="comment">
            评论
          </NRadioButton>
          <NRadioButton value="forward">
            转发
          </NRadioButton>
        </NRadioGroup>
      </NSpace>
      <NDivider style="margin: 10px 0 10px 0" />
      <NSpace align="center">
        <NInputGroup style="max-width: 200px">
          <NInputGroupLabel> 抽选人数 </NInputGroupLabel>
          <NInputNumber
            v-model:value="lotteryOption.resultCount"
            placeholder=""
            min="1"
          />
        </NInputGroup>
        <NCheckbox v-model:checked="lotteryOption.needVIP">
          需要大会员
        </NCheckbox>
        <template v-if="currentType === 'comment'">
          <NCheckbox v-model:checked="lotteryOption.needCharge">
            需要充电
          </NCheckbox>
          <NCheckbox v-model:checked="lotteryOption.needFanCard">
            需要粉丝牌
          </NCheckbox>
          <NCollapseTransition>
            <NInputGroup
              v-if="lotteryOption.needFanCard"
              style="max-width: 200px"
            >
              <NInputGroupLabel> 最低粉丝牌等级 </NInputGroupLabel>
              <NInputNumber
                v-model:value="lotteryOption.fanCardLevel"
                min="1"
                max="50"
                :default-value="1"
                :disabled="isLottering"
              />
            </NInputGroup>
          </NCollapseTransition>
        </template>
        <NRadioGroup
          v-model:value="lotteryOption.lotteryType"
          name="抽取类型"
          size="small"
          :disabled="isLottering"
        >
          <NRadioButton value="single">
            单个
          </NRadioButton>
          <NRadioButton value="half">
            减半
          </NRadioButton>
        </NRadioGroup>
      </NSpace>
    </NCard>
    <NSpace
      justify="center"
      align="center"
    >
      <NButton
        :disabled="!inputDynamicId || !isCommentCountDown || !token || isLottering"
        :loading="!token || isLoading"
        type="primary"
        @click="onGet"
      >
        加载用户
      </NButton>
      <NCountdown
        v-if="!isCommentCountDown"
        :duration="(currentUsers?.createTime ?? -1) + 60000 - Date.now()"
        @finish="isCommentCountDown = true"
      />
    </NSpace>
    <br>
    <NCard
      v-if="currentUsers"
      size="small"
    >
      <NSpace justify="center">
        <NButton
          type="primary"
          :loading="isLottering"
          :disabled="isLotteried"
          @click="startLottery"
        >
          开始抽取
        </NButton>
        <NButton
          type="info"
          :disabled="isLottering || !isLotteried"
          @click="reset"
        >
          重置
        </NButton>
      </NSpace>
      <NDivider style="margin: 10px 0 10px 0">
        共 {{ validUsers?.length }} 人
      </NDivider>
      <NGrid
        cols="1 500:2 800:3 1000:4"
        :x-gap="12"
        :y-gap="8"
      >
        <NGridItem
          v-for="item in validUsers"
          :key="item.uId"
        >
          <NCard
            size="small"
            :title="item.name"
            style="height: 155px"
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
                  :src="`${item.avatar}@64w_64h`"
                  :img-props="{ referrerpolicy: 'no-referrer' }"
                />
                <NSpace>
                  <NTag
                    v-if="item.isVIP"
                    size="tiny"
                    round
                    type="warning"
                  >
                    大会员
                  </NTag>
                  <NTooltip>
                    <template #trigger>
                      <NTag
                        v-if="item.level"
                        size="tiny"
                        :color="{ color: getLevelColor(item.level), textColor: 'white', borderColor: 'white' }"
                        :borderd="false"
                      >
                        LV {{ item.level }}
                      </NTag>
                    </template>
                    用户等级
                  </NTooltip>
                  <NTag
                    v-if="item.card"
                    size="tiny"
                    round
                  >
                    <NTag
                      size="tiny"
                      round
                      :bordered="false"
                    >
                      {{ item.card.level }}
                    </NTag>
                    <NText type="info" style="margin-left: 6px">
                      {{ item.card.name }}
                    </NText>
                  </NTag>
                </NSpace>
                {{ item.name }}
              </NSpace>
            </template>
          </NCard>
        </NGridItem>
      </NGrid>
    </NCard>
    </NCard>
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
                :key="user.uId"
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
            <NDivider style="margin: 10px 0 10px 0" />
            <NButton
              secondary
              @click="NavigateToNewTab(item.url)"
            >
              目标动态
            </NButton>
          </NCard>
        </NListItem>
      </NList>
    </NScrollbar>
    <NEmpty
      v-else
      description="暂无记录"
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
</style>
