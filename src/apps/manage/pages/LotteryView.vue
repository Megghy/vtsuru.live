<script setup lang="ts">
import { format } from 'date-fns'
import { List } from 'linqts'
import { showSuccessToast, showErrorToast, showWarningToast } from '@/shared/services/toast'
import { computed, onUnmounted, ref } from 'vue'
import VueTurnstile from 'vue-turnstile'

import type { LotteryUserInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import { LOTTERY_API_URL, TURNSTILE_KEY } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { NavigateToNewTab } from '@/shared/utils'

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
const toast = useToast()
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
const winnerIds = computed(() => new Set(resultUsers.value?.map((u) => u.uId) ?? []))

const commentUsers = ref<TempLotteryResponseModel>()
const forwardUsers = ref<TempLotteryResponseModel>()

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

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
  return currentUsers.value?.users.filter((u) => isUserValid(u))
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
async function fetchLotteryUsers(type: 'comments' | 'forward') {
  const dynamicId = inputDynamicId.value
  if (!dynamicId) {
    showErrorToast('请输入正确的动态 ID 或链接')
    return
  }
  isLoading.value = true
  await QueryGetAPI<TempLotteryResponseModel>(`${LOTTERY_API_URL}${type}`, { id: dynamicId.toString() }, [
    ['Turnstile', token.value],
  ])
    .then((data) => {
      if (data.code == 200) {
        data.data.users = new List(data.data.users).DistinctBy((u) => u.uId).ToArray()
        data.data.total = data.data.users.length
        if (type === 'comments') {
          commentUsers.value = data.data
        } else {
          forwardUsers.value = data.data
        }
        reset()
        isCommentCountDown.value = false
      } else {
        showErrorToast(`获取用户失败: ${data.message}`)
      }
    })
    .catch((err) => {
      console.error(err)
      showErrorToast('获取失败')
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
    showWarningToast('符合条件的抽奖人数达不到抽选人数')
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
    showErrorToast('抽奖过程中发生错误')
    isLottering.value = false
  }
}
function onFinishLottery(winners: LotteryUserInfo[]) {
  resultUsers.value = JSON.parse(JSON.stringify(winners))
  isLottering.value = false
  isLotteried.value = true
  toast.add({ title: '🎉 抽奖完成', description: `共 ${winners.length} 位中奖者`, color: 'success' })
  lotteryHistory.value.unshift({
    users: winners,
    time: Date.now(),
    type: currentType.value,
    url: inputDynamicId.value ? `https://t.bilibili.com/${inputDynamicId.value}` : (inputDynamic.value ?? ''),
  })
  showSuccessToast('结果已保存至历史记录')
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
    <ManagePageHeader
      title="动态抽奖"
      subtitle="从 B 站动态的评论或转发中随机抽取幸运用户"
    >
      <template #action>
        <UButton
          color="neutral"
          variant="soft"
          size="sm"
          @click="showModal = true"
        >
          <template #leading><UIcon name="i-lucide-history" /></template>
          历史记录
          <UBadge
            v-if="lotteryHistory.length"
            style="margin-left: 6px"
          >
            {{ lotteryHistory.length }}
          </UBadge>
        </UButton>
      </template>
    </ManagePageHeader>

    <UCard>
      <UFormField label="动态">
        <UInput
          v-model="inputDynamic"
          placeholder="粘贴动态链接, 或直接输入动态 ID"
          clearable
          :disabled="isLoading || isLottering"
        />
      </UFormField>
      <p
        v-if="inputDynamic && !inputDynamicId"
        class="hint error"
      >
        无法识别动态 ID, 请检查链接是否正确
      </p>

      <USeparator class="section-separator" />

      <UCard class="options-card" :ui="{ body: 'p-3' }">
        <template #header>抽奖选项</template>
        <template #footer>
          <UButton
            size="xs"
            color="neutral"
            variant="soft"
            :disabled="isLottering"
            @click="lotteryOption = { ...defaultOption }"
          >
            恢复默认
          </UButton>
        </template>
        <div class="options-content">
          <URadioGroup v-model="currentType" :items="[{ label: '评论区', value: 'comment' }, { label: '转发', value: 'forward' }]" :disabled="isLottering" />
          <USeparator />
          <div class="option-row">
            <UFormField label="抽取人数" class="count-input"><UInputNumber v-model="lotteryOption.resultCount"
              :min="1"
              :disabled="isLottering"
            /></UFormField>
            <URadioGroup v-model="lotteryOption.lotteryType" :items="[{ label: '逐个淘汰', value: 'single' }, { label: '快速减半', value: 'half' }]" :disabled="isLottering" />
          </div>
          <USeparator />
          <div class="option-row"><span class="hint">参与条件</span><UCheckbox v-model="lotteryOption.needVIP" label="大会员" :disabled="isLottering" />
          <template v-if="currentType === 'comment'">
            <UCheckbox
              v-model="lotteryOption.needCharge"
              :disabled="isLottering"
            >
              已充电
            </UCheckbox>
            <UCheckbox
              v-model="lotteryOption.needGuard"
              :disabled="isLottering"
            >
              舰长
            </UCheckbox>
            <UCheckbox
              v-model="lotteryOption.needFanCard"
              :disabled="isLottering"
            >
              佩戴粉丝牌
            </UCheckbox>
            <UFormField v-if="lotteryOption.needFanCard" label="最低牌等级" class="level-input"><UInputNumber
                  v-model="lotteryOption.fanCardLevel"
                  :min="1"
                  :max="50"
                  :disabled="isLottering"
                /></UFormField>
          </template>
          </div>
        </div>
      </UCard>
      <div class="load-actions">
        <UButton
          :disabled="!inputDynamicId || !isCommentCountDown || !token || isLottering"
          :loading="!token || isLoading"
          @click="onGet"
        >
          {{ currentUsers ? '重新加载用户' : '加载用户' }}
        </UButton>
        <div
          v-if="!isCommentCountDown"
          align="center"
        >
          <span class="hint">冷却中</span><time>{{ Math.max(0, Math.ceil(((currentUsers?.createTime ?? -1) + 60000 - Date.now()) / 1000)) }} 秒</time>
        </div>
      </div>
    </UCard>

    <UCard v-if="isLotteried && resultUsers?.length" class="winner-card"><div class="winner-heading"><UIcon name="i-lucide-trophy" /> <strong>恭喜以下 {{ resultUsers.length }} 位中奖</strong></div><div class="winner-list"><div v-for="user in resultUsers" :key="user.uId" class="winner-item"><UAvatar :src="`${user.avatar}@88w_88h`" :alt="user.name" /><strong>{{ user.name }}</strong></div></div></UCard>
    <UCard v-if="currentUsers"><div class="lottery-result-toolbar"><div class="statistics"><div><small>符合条件</small><strong>{{ validUsers?.length ?? 0 }}</strong></div><div><small>总参与</small><strong>{{ currentUsers.total }}</strong></div></div><div class="result-actions"><UButton size="lg" :loading="isLottering" :disabled="isLotteried || !validUsers?.length" @click="startLottery"><template #leading><UIcon name="i-lucide-dices" /></template>{{ isLottering ? '抽取中...' : '开始抽取' }}</UButton><UButton size="lg" color="neutral" variant="soft" :disabled="isLottering || !isLotteried" label="重置" @click="reset" /></div></div><USeparator class="section-separator" /><UEmpty v-if="!validUsers?.length" title="没有符合条件的用户, 试试放宽参与条件" /><div v-else class="user-grid"><div v-for="item in validUsers" :key="item.uId" class="user-cell" :class="{ 'is-eliminated': eliminatedIds.has(item.uId), 'is-rolling': rollingId === item.uId, 'is-winner': isLotteried && winnerIds.has(item.uId) }"><UAvatar :src="`${item.avatar}@104w_104h`" :alt="item.name" size="xl" /><strong class="user-cell__name">{{ item.name }}</strong><div class="user-badges"><UBadge v-if="item.isVIP" color="warning" variant="subtle">会员</UBadge><UBadge v-if="item.level" :style="{ background: getLevelColor(item.level), color: '#fff' }">LV{{ item.level }}</UBadge><UTooltip v-if="item.card" text="粉丝牌"><UBadge color="info" variant="subtle">{{ item.card.name }} {{ item.card.level }}</UBadge></UTooltip></div></div></div></UCard>
    <UModal v-model:open="showModal" title="历史记录">
      <template #body>
        <div class="history-modal">
          <UButton v-if="lotteryHistory.length" color="error" variant="soft" size="sm" label="清空全部" @click="lotteryHistory = []" />
          <div v-if="lotteryHistory.length" class="history-list"><UCard v-for="item in lotteryHistory" :key="item.time" :ui="{ body: 'p-3' }"><template #header><div class="history-heading"><UBadge :color="item.type === 'comment' ? 'success' : 'info'" variant="subtle">{{ item.type === 'comment' ? '评论' : '转发' }}</UBadge><span>{{ format(item.time, 'yyyy-MM-dd HH:mm:ss') }} · {{ item.users.length }} 人</span></div></template><template #footer><div class="history-actions"><UButton size="xs" color="neutral" variant="soft" label="目标动态" @click="NavigateToNewTab(item.url)" /><UButton size="xs" color="error" variant="ghost" label="删除" @click="lotteryHistory.splice(lotteryHistory.indexOf(item), 1)" /></div></template><div class="history-users"><div v-for="user in item.users" :key="user.uId" class="history-user"><UAvatar :src="`${user.avatar}@64w_64h`" :alt="user.name" size="sm" /><span>{{ user.name }}</span></div></div></UCard></div><UEmpty v-else title="暂无抽奖记录" /></div>
      </template>
    </UModal>
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
.options-content,.option-row,.load-actions,.winner-heading,.winner-list,.statistics,.statistics>div,.lottery-result-toolbar,.result-actions,.user-badges,.history-modal,.history-list,.history-heading,.history-actions,.history-users,.history-user { display:flex; }.options-content,.history-modal,.history-list { flex-direction:column; gap:12px; }.option-row,.load-actions,.winner-heading,.winner-list,.lottery-result-toolbar,.result-actions,.user-badges,.history-heading,.history-actions,.history-users,.history-user { flex-wrap:wrap; align-items:center; gap:8px; }.load-actions { justify-content:center; margin-top:16px; }.section-separator { margin:12px 0; }.hint { color:var(--vtsuru-fg-muted); font-size:13px; }.error { color:var(--vtsuru-error); }.count-input { width:180px; }.level-input { width:200px; }.winner-heading { margin-bottom:12px; color:#c98500; font-size:16px; }.winner-list { gap:16px; }.winner-item { display:flex; align-items:center; gap:10px; padding:6px 14px 6px 6px; background:rgb(240 160 32 / 10%); border-radius:999px; }.lottery-result-toolbar { justify-content:space-between; }.statistics { gap:16px; }.statistics>div { flex-direction:column; }.statistics small { color:var(--vtsuru-fg-muted); }.statistics strong { font-size:24px; }.user-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }.user-badges { justify-content:center; gap:4px; }.history-modal { max-height:70vh; overflow:auto; }.history-heading,.history-actions { justify-content:space-between; }.history-heading { color:var(--vtsuru-fg-muted); font-size:13px; }.history-users { gap:16px; }.history-user { gap:8px; }

/* 用户卡片 */
.user-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 12px 8px;
  border-radius: 10px;
  border: 1px solid var(--vtsuru-border, rgba(128, 128, 128, 0.18));
  transition:
    opacity 0.35s ease,
    transform 0.35s ease,
    box-shadow 0.35s ease,
    filter 0.35s ease;
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
  0% {
    transform: scale(0.85);
  }
  60% {
    transform: scale(1.08);
  }
  100% {
    transform: scale(1);
  }
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
