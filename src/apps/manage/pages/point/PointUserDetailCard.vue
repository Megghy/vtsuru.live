<script setup lang="ts">
import { AddSquare24Regular, Info24Filled } from '@vicons/fluent'
import { computed, onMounted, ref } from 'vue'

import type {
  ResponsePointGoodModel,
  ResponsePointHisrotyModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointUserModel,
} from '@/api/api-models'
import {
  getApiPointGetUserHistories,
  getApiPointGetUserOrders,
  postApiPointGivePoint,
} from '@/api/generated/point/point'
import { formatTime } from '@/apps/manage/composables/formatters'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { Tag } from '@/shared/ui/tag'
import { Textarea } from '@/shared/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useMessage } from '@/shared/utils'

const props = defineProps<{
  user: ResponsePointUserModel
  goods: ResponsePointGoodModel[]
}>()

const message = useMessage()

const isLoading = ref(false)
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const pointHistory = ref<ResponsePointHisrotyModel[]>([])

const showAddPointModal = ref(false)
const addPointCount = ref(0)
const addPointReason = ref<string>('')

const emptyOpenId = '00000000-0000-0000-0000-000000000000'

type PointTarget =
  | { type: 'auth'; authId: number }
  | { type: 'uid'; userId: number }
  | { type: 'openid'; openId: string }

const pointTarget = computed<PointTarget | null>(() => {
  const info = props.user.info
  if (!info) return null
  if (info.id > 0) return { type: 'auth', authId: info.id }
  if (info.userId > 0) return { type: 'uid', userId: info.userId }
  if (info.openId && info.openId !== emptyOpenId) return { type: 'openid', openId: info.openId }
  return null
})

const canAdjustPoint = computed(() => pointTarget.value !== null)

function getHistoryParams(target: PointTarget) {
  switch (target.type) {
    case 'auth':
      return { authId: target.authId }
    case 'uid':
      return { id: target.userId }
    case 'openid':
      return { id: target.openId }
  }
}

function getGivePointParams(target: PointTarget) {
  switch (target.type) {
    case 'auth':
      return { authId: target.authId }
    case 'uid':
      return { uId: target.userId }
    case 'openid':
      return { oId: target.openId }
  }
}

async function getOrders() {
  const info = props.user.info
  if (!info || info.id <= 0) return []

  try {
    isLoading.value = true
    const data = (await getApiPointGetUserOrders({
      authId: info.id,
    })) as unknown as {
      code: number
      message?: string
      data: ResponsePointOrder2OwnerModel[]
    }

    if (data.code === 200) {
      return data.data
    } else {
      message.error(`获取订单失败: ${data.message}`)
      console.error(data)
    }
  } catch (err) {
    message.error(`获取订单失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }

  return []
}

async function getPointHistory() {
  try {
    isLoading.value = true
    const target = pointTarget.value
    if (!target) return []

    const data = (await getApiPointGetUserHistories(getHistoryParams(target) as any)) as unknown as {
      code: number
      message?: string
      data: ResponsePointHisrotyModel[]
    }

    if (data.code === 200) {
      return data.data
    } else {
      message.error(`获取积分历史失败: ${data.message}`)
      console.error(data)
    }
  } catch (err) {
    message.error(`获取积分历史失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }

  return []
}

async function givePoint() {
  if (addPointCount.value === 0) {
    message.error('积分数量不能为 0')
    return
  }

  isLoading.value = true
  try {
    const target = pointTarget.value
    if (!target) {
      message.error('无法识别积分目标用户')
      return
    }

    const data = await postApiPointGivePoint({
      ...getGivePointParams(target),
      count: addPointCount.value,
      reason: addPointReason.value,
    } as any)

    if (data.code === 200) {
      message.success('添加成功')
      showAddPointModal.value = false
      props.user.point = Number((props.user.point + addPointCount.value).toFixed(1))

      setTimeout(async () => {
        pointHistory.value = await getPointHistory()
      }, 1500)

      addPointCount.value = 0
      addPointReason.value = ''
    } else {
      message.error(`添加积分失败: ${data.message}`)
      console.error(data)
    }
  } catch (err) {
    message.error(`添加积分失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  pointHistory.value = await getPointHistory()
  if ((props.user.info?.id ?? 0) > 0) {
    orders.value = await getOrders()
  }
})
</script>

<template>
  <div class="space-y-4 p-4">
    <!-- 用户基本信息 -->
    <Card class="border border-border">
      <CardContent class="p-5 space-y-4">
        <div class="flex items-start justify-between">
          <div class="flex items-center gap-4">
            <Avatar class="size-14 border border-border">
              <AvatarImage
                :src="user.info.avatar"
                fallback-src="/img/no-face.png"
              />
              <AvatarFallback>{{ user.info.name?.slice(0, 2) || '用户' }}</AvatarFallback>
            </Avatar>
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-base font-semibold text-foreground">{{ user.info.name || '未知用户' }}</span>
                <Tag
                  :type="user.isAuthed ? 'success' : 'warning'"
                  size="small"
                  round
                  :bordered="false"
                >
                  {{ user.isAuthed ? '已认证' : '未认证' }}
                </Tag>
              </div>
              <div class="text-xs text-muted-foreground flex flex-col gap-0.5">
                <span v-if="user.info.userId > 0">UID: {{ user.info.userId }}</span>
                <span v-if="user.info.openId && user.info.openId !== emptyOpenId">OpenId: {{ user.info.openId }}</span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            class="gap-1.5"
            :disabled="!canAdjustPoint"
            @click="showAddPointModal = true"
          >
            <AddSquare24Regular class="size-4" />
            积分调整
          </Button>
        </div>

        <Separator />

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <span class="text-xs text-muted-foreground block">当前积分</span>
            <span class="text-lg font-bold font-mono text-foreground mt-0.5 block">
              {{ user.point.toFixed(1) }}
            </span>
          </div>
          <div>
            <span class="text-xs text-muted-foreground block">订单总数</span>
            <span class="text-lg font-bold font-mono text-foreground mt-0.5 block">
              {{ user.orderCount }}
            </span>
          </div>
          <div>
            <span class="text-xs text-muted-foreground block">认证时间</span>
            <span class="text-xs font-medium text-foreground mt-1.5 block">
              {{ user.isAuthed && user.info.createAt ? formatTime(user.info.createAt) : '--' }}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 数据标签页 -->
    <Tabs
      default-value="orders"
      class="w-full"
    >
      <TabsList>
        <TabsTrigger value="orders">订单记录</TabsTrigger>
        <TabsTrigger value="history">积分流水</TabsTrigger>
      </TabsList>

      <TabsContent
        value="orders"
        class="pt-3"
      >
        <Spin :show="isLoading">
          <Empty
            v-if="orders.length === 0"
            description="暂无订单"
            class="py-8"
          />
          <PointOrderCard
            v-else
            :order="orders"
            type="owner"
            :goods="goods"
          />
        </Spin>
      </TabsContent>

      <TabsContent
        value="history"
        class="pt-3"
      >
        <Spin :show="isLoading">
          <Empty
            v-if="!pointHistory.length"
            description="暂无积分记录"
            class="py-8"
          />
          <PointHistoryCard
            v-else
            :histories="pointHistory"
          />
        </Spin>
      </TabsContent>
    </Tabs>

    <!-- 积分调整弹窗 -->
    <Dialog v-model:open="showAddPointModal">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">给予 / 扣除积分</DialogTitle>
        </DialogHeader>

        <div class="space-y-3 py-2">
          <div class="space-y-1">
            <div class="flex items-center gap-1.5">
              <label class="text-xs font-medium text-foreground">积分数量</label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Info24Filled class="size-3.5 text-muted-foreground/70 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p class="text-xs">正数为给予，负数为扣除</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <NInputNumber
              v-model="addPointCount"
              placeholder="积分数量"
              class="w-full"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-medium text-foreground">备注说明 (可选)</label>
            <Textarea
              v-model="addPointReason"
              placeholder="请输入调整备注"
              :maxlength="100"
              class="text-xs"
              :rows="3"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            :disabled="!canAdjustPoint || !addPointCount || addPointCount === 0 || isLoading"
            @click="givePoint"
          >
            {{ !addPointCount || addPointCount === 0 ? '确定' : addPointCount > 0 ? '确认给予' : '确认扣除' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
