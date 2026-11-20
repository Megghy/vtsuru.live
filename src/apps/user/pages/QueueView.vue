<script setup lang="ts">
import ArrowClockwise24Regular from '@vicons/fluent/es/ArrowClockwise24Regular'
import ArrowTrending24Regular from '@vicons/fluent/es/ArrowTrending24Regular'
import PeopleQueue24Regular from '@vicons/fluent/es/PeopleQueue24Regular'
import PersonAdd24Regular from '@vicons/fluent/es/PersonAdd24Regular'
import { computed, onActivated, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import type { ResponseQueueModel, ResponseUserInfo, SettingQueue } from '@/api/generated/model'
import { QueueFrom, QueueSortType, QueueStatus } from '@/api/generated/model'
import {
  getApiQueueGetActiveAndSettings,
  postApiQueueJoinFromWeb,
  postApiQueuePriorityFromWeb,
} from '@/api/generated/queue/queue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Spin } from '@/shared/ui/spin'
import { useMessage } from '@/shared/utils'
import { sortByQueueType } from '@/shared/utils/queue'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  userInfo: ResponseUserInfo | undefined
}>()

const message = useMessage()
const biliAuth = useBiliAuth()

const isLoading = ref(false)
const isSubmitting = ref(false)
const prioritizingId = ref<number | null>(null)
const noteContent = ref('')
const usePriority = ref(false)
const userPoints = ref<number | null>(null)

const queueList = ref<ResponseQueueModel[]>([])
const settings = ref<SettingQueue | null>(null)

const progressingItem = computed(() => queueList.value.find((q) => q.status === QueueStatus.Progressing))

const waitingItems = computed(() => {
  const waiting = queueList.value.filter((q) => q.status === QueueStatus.Waiting)
  if (!settings.value) return waiting
  return sortByQueueType(
    waiting,
    settings.value.sortType ?? QueueSortType.TimeFirst,
    settings.value.isReverse ?? false,
    {
      createAt: (item) => item.createAt,
      guardLevel: (item) => item.user?.guard_level,
      price: (item) => item.giftPrice,
      fansMedalLevel: (item) => item.user?.fans_medal_level,
      fansMedalWearing: (item) => item.user?.fans_medal_wearing_status,
      priorityLevel: (item) => item.priorityLevel,
      sortOrder: (item) => item.sortOrder,
      isPinned: (item) => item.isPinned,
    },
  )
})

function isCurrentViewerEntry(item: ResponseQueueModel) {
  const uid = biliAuth.biliAuth?.userId
  const openId = biliAuth.biliAuth?.openId
  if (uid && item.user?.uid === uid) return true
  if (openId && item.user?.oid === openId) return true
  return false
}

const myWaitingItems = computed(() => {
  if (!biliAuth.isAuthed) return []
  return waitingItems.value.filter(isCurrentViewerEntry)
})

const hasJoined = computed(() => {
  if (!biliAuth.isAuthed) return false
  return queueList.value.some(isCurrentViewerEntry)
})

const basePointCost = computed(() =>
  settings.value?.enablePointJoin ? Math.max(0, settings.value.pointJoinCost ?? 0) : 0,
)
const priorityPointCost = computed(() =>
  settings.value?.allowPointPriority ? Math.max(0, settings.value.pointPriorityCost ?? 0) : 0,
)
const totalJoinCost = computed(() => basePointCost.value + (usePriority.value ? priorityPointCost.value : 0))

const eligibilityHints = computed(() => {
  const s = settings.value
  if (!s) return []
  const list: string[] = []
  const guards: string[] = []
  if (s.needJianzhang) guards.push('舰长')
  if (s.needTidu) guards.push('提督')
  if (s.needZongdu) guards.push('总督')
  if (guards.length) list.push(`大航海: ${guards.join(' / ')}`)
  if ((s.fanMedalMinLevel ?? 0) > 0) list.push(`粉丝牌 ≥ ${s.fanMedalMinLevel} 级`)
  if (basePointCost.value > 0) list.push(`入队消耗 ${basePointCost.value} 积分`)
  if (s.allowPointPriority && priorityPointCost.value > 0) {
    list.push(`积分插队 ${priorityPointCost.value} 积分`)
  }
  return list
})

let pointsReqSeq = 0
let queueReqSeq = 0

async function refreshUserPoints() {
  const seq = ++pointsReqSeq
  if (!props.userInfo?.id || !biliAuth.isAuthed) {
    userPoints.value = null
    return
  }
  const pts = await biliAuth.GetSpecificPoint(props.userInfo.id)
  if (seq !== pointsReqSeq) return
  userPoints.value = typeof pts === 'number' ? pts : null
}

async function fetchQueueState() {
  const targetId = props.userInfo?.id
  if (!targetId) return
  const seq = ++queueReqSeq
  isLoading.value = true
  try {
    const res = await getApiQueueGetActiveAndSettings({ id: targetId })
    if (seq !== queueReqSeq) return
    if (res.code === 200 && res.data) {
      queueList.value = res.data.queue || []
      settings.value = res.data.setting || null
    } else {
      message.error(`获取排队状态失败: ${res.message}`)
    }
  } catch (err) {
    if (seq !== queueReqSeq) return
    message.error(`获取排队状态失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    if (seq === queueReqSeq) {
      isLoading.value = false
    }
  }
}

async function handleJoinQueue() {
  if (!props.userInfo?.id) return
  if (!biliAuth.isAuthed) {
    message.warning('请先绑定 B 站账号后再加入排队')
    return
  }

  isSubmitting.value = true
  try {
    const res = await postApiQueueJoinFromWeb(
      {
        target: props.userInfo.id,
        usePriority: usePriority.value,
        content: noteContent.value.trim() || undefined,
      },
      { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) },
    )
    if (res.code === 200) {
      message.success(usePriority.value ? '已加入排队并使用积分插队' : '加入排队成功')
      noteContent.value = ''
      usePriority.value = false
      await Promise.all([fetchQueueState(), refreshUserPoints()])
    } else {
      message.error(`排队失败: ${res.message}`)
    }
  } catch (err) {
    message.error(`排队失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSubmitting.value = false
  }
}

async function handlePriority(item: ResponseQueueModel) {
  if (!props.userInfo?.id) return
  if (!biliAuth.isAuthed) {
    message.warning('请先绑定 B 站账号后再使用积分插队')
    return
  }
  prioritizingId.value = item.id
  try {
    const res = await postApiQueuePriorityFromWeb(
      { target: props.userInfo.id, id: item.id },
      { headers: Object.fromEntries(await biliAuth.getBiliAuthHeaders()) },
    )
    if (res.code === 200) {
      message.success('积分插队成功，已置顶您的排队顺序')
      await Promise.all([fetchQueueState(), refreshUserPoints()])
    } else {
      message.error(`插队失败: ${res.message}`)
    }
  } catch (err) {
    message.error(`插队失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    prioritizingId.value = null
  }
}

function formatFromLabel(from: QueueFrom) {
  if (from === QueueFrom.Web) return '网页排队'
  if (from === QueueFrom.Gift) return '礼物/SC'
  if (from === QueueFrom.Manual) return '主播添加'
  return '弹幕'
}

watch(
  () => [props.userInfo?.id, biliAuth.isAuthed] as const,
  () => {
    void fetchQueueState()
    void refreshUserPoints()
  },
)

onMounted(() => {
  void fetchQueueState()
  void refreshUserPoints()
})

onActivated(() => {
  void fetchQueueState()
  void refreshUserPoints()
})
</script>

<template>
  <div class="max-w-4xl mx-auto space-y-4 py-4">
    <Card class="shadow-xs">
      <CardHeader class="pb-3 border-b border-border/60">
        <div class="flex-between flex-wrap gap-3">
          <div class="flex items-center gap-2">
            <PeopleQueue24Regular class="size-5 text-primary" />
            <CardTitle class="text-base">
              {{ userInfo?.name ? `${userInfo.name} 的直播排队` : '直播排队' }}
            </CardTitle>
            <Badge variant="secondary">等待中 {{ waitingItems.length }} 人</Badge>
          </div>

          <Button
            variant="outline"
            :loading="isLoading"
            @click="fetchQueueState"
          >
            <ArrowClockwise24Regular class="size-4 mr-1" />
            刷新队列
          </Button>
        </div>
      </CardHeader>

      <CardContent class="pt-4 space-y-4">
        <div
          v-if="eligibilityHints.length > 0"
          class="flex flex-wrap items-center gap-1.5"
        >
          <span class="text-xs text-muted-foreground mr-1">当前规则:</span>
          <Badge
            v-for="hint in eligibilityHints"
            :key="hint"
            variant="outline"
          >
            {{ hint }}
          </Badge>
        </div>

        <!-- 网页自助排队表单 -->
        <div
          v-if="settings?.allowFromWeb"
          class="rounded-lg border border-border bg-muted/20 p-3.5 space-y-3"
        >
          <div class="flex-between flex-wrap gap-2 text-xs">
            <div class="flex items-center gap-2">
              <span class="font-medium text-foreground">网页自助排队</span>
              <span
                v-if="biliAuth.isAuthed"
                class="text-muted-foreground"
              >
                当前已绑定: <strong class="text-foreground">{{ biliAuth.biliAuth?.name }}</strong>
                <template v-if="userPoints !== null">
                  · 我的积分: <strong class="font-mono text-foreground">{{ userPoints }}</strong>
                </template>
              </span>
              <RouterLink
                v-else
                to="/bili-auth"
                class="text-primary underline underline-offset-2"
              >
                绑定 B 站账号以加入排队
              </RouterLink>
            </div>

            <Badge
              v-if="hasJoined"
              variant="success"
            >
              您已在当前队列中
            </Badge>
          </div>

          <div
            v-if="!hasJoined"
            class="space-y-2.5"
          >
            <div class="flex items-center gap-2 flex-wrap">
              <Input
                v-model="noteContent"
                maxlength="100"
                placeholder="可选：填写排队留言或上号备注（最多 100 字）"
                class="flex-1 min-w-56"
                :disabled="!biliAuth.isAuthed"
              />
              <Button
                :loading="isSubmitting"
                :disabled="!biliAuth.isAuthed"
                @click="handleJoinQueue"
              >
                <PersonAdd24Regular class="size-4 mr-1" />
                {{ totalJoinCost > 0 ? `消耗 ${totalJoinCost} 积分加入` : '加入排队' }}
              </Button>
            </div>

            <label
              v-if="settings.allowPointPriority"
              class="inline-flex items-center gap-2 text-xs cursor-pointer select-none"
            >
              <Checkbox
                v-model:checked="usePriority"
                :disabled="!biliAuth.isAuthed"
              />
              <span>同时使用积分插队（+{{ priorityPointCost }} 积分，排在普通队伍前）</span>
            </label>
          </div>
        </div>

        <Alert
          v-else-if="settings"
          size="sm"
          class="bg-muted/40 border-border/80"
        >
          <AlertDescription class="text-muted-foreground">
            主播暂未开启网页端自助排队，请前往直播间发送弹幕
            <template v-if="settings.keyword">「{{ settings.keyword }}」</template>
            加入排队。
          </AlertDescription>
        </Alert>

        <!-- 我的待排位置与插队 -->
        <div
          v-if="settings?.allowPointPriority && myWaitingItems.length > 0"
          class="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex-between flex-wrap gap-2 text-xs"
        >
          <span>您当前有 {{ myWaitingItems.length }} 个等待中的排队记录</span>
          <div class="flex items-center gap-2 flex-wrap">
            <Button
              v-for="item in myWaitingItems"
              :key="item.id"
              size="xs"
              variant="outline"
              :disabled="(item.priorityLevel ?? 0) > 0"
              :loading="prioritizingId === item.id"
              @click="handlePriority(item)"
            >
              <ArrowTrending24Regular class="size-3.5 mr-1" />
              {{ (item.priorityLevel ?? 0) > 0 ? '已置顶插队' : `积分插队 (${priorityPointCost} 积分)` }}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>

    <Spin :show="isLoading">
      <div class="space-y-4">
        <!-- 正在进行 -->
        <Card v-if="progressingItem">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-sm text-emerald-600">正在进行中</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0">
            <div class="flex-between gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5">
              <div class="flex items-center gap-2.5 min-w-0">
                <Badge
                  variant="success"
                  class="shrink-0"
                >
                  进行中
                </Badge>
                <span class="font-semibold text-sm text-foreground truncate">{{
                  progressingItem.user?.name || '未知用户'
                }}</span>
                <span
                  v-if="progressingItem.content"
                  class="text-xs text-muted-foreground truncate"
                >
                  {{ progressingItem.content }}
                </span>
              </div>
              <Badge
                variant="outline"
                class="shrink-0"
              >
                {{ formatFromLabel(progressingItem.from) }}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- 等待队列 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-sm">等待队列 ({{ waitingItems.length }})</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0">
            <div
              v-if="waitingItems.length > 0"
              class="space-y-2"
            >
              <div
                v-for="(item, idx) in waitingItems"
                :key="item.id"
                class="grid grid-cols-1 sm:grid-cols-[13rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-xs"
              >
                <div class="flex items-center gap-2.5 min-w-0">
                  <span
                    class="inline-flex-center size-6 rounded-full bg-primary/10 text-primary font-mono font-bold shrink-0"
                  >
                    {{ idx + 1 }}
                  </span>
                  <span class="font-medium text-foreground truncate">{{ item.user?.name || '未知用户' }}</span>
                </div>

                <div class="flex items-center gap-1.5 min-w-0 flex-wrap sm:flex-nowrap">
                  <Badge
                    v-if="(item.priorityLevel ?? 0) > 0"
                    variant="warning"
                    size="xs"
                    class="shrink-0"
                  >
                    插队
                  </Badge>
                  <Badge
                    v-if="(item.pointCost ?? 0) > 0"
                    variant="secondary"
                    size="xs"
                    class="shrink-0"
                  >
                    {{ item.pointCost }} 积分
                  </Badge>
                  <span
                    v-if="item.content"
                    class="text-muted-foreground truncate min-w-0"
                  >
                    「{{ item.content }}」
                  </span>
                </div>

                <Badge
                  variant="outline"
                  size="xs"
                  class="shrink-0 justify-self-start sm:justify-self-end"
                >
                  {{ formatFromLabel(item.from) }}
                </Badge>
              </div>
            </div>
            <Empty
              v-else
              description="当前暂无等待排队的观众"
            />
          </CardContent>
        </Card>
      </div>
    </Spin>
  </div>
</template>
