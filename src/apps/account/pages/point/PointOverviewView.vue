<script setup lang="ts">
import { format } from 'date-fns'
import { ArrowRight, CalendarCheck, ChevronDown, ChevronUp, Flame, Gift, RefreshCw, Wallet } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { ResponseAllPointsModel } from '@/api/generated/model'
import { getApiPointUserGetAllPoint } from '@/api/generated/point/point'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const auth = useBiliAuth()
const router = useRouter()
const isLoading = ref(false)
const points = ref<ResponseAllPointsModel[]>([])
const expandedOwnerId = ref<number | null>(null)

const totalPoints = computed(() => points.value.reduce((total, item) => total + item.points, 0))
const maxStreak = computed(() =>
  points.value.reduce((max, item) => Math.max(max, item.consecutiveCheckInDays ?? 0), 0),
)
const totalCheckIns = computed(() =>
  points.value.reduce((sum, item) => sum + (item.totalCheckInDays ?? 0), 0),
)

function formatDate(ts?: number | null) {
  if (!ts) return ''
  const value = ts < 1e12 ? ts * 1000 : ts
  return format(value, 'MM-dd')
}

function formatFullDate(ts?: number | null) {
  if (!ts) return ''
  const value = ts < 1e12 ? ts * 1000 : ts
  return format(value, 'yyyy-MM-dd')
}

function toggleCheckInHistory(ownerId: number) {
  expandedOwnerId.value = expandedOwnerId.value === ownerId ? null : ownerId
}

async function loadPoints() {
  isLoading.value = true
  try {
    const response = await getApiPointUserGetAllPoint({
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })
    if (response.code !== 200) throw new Error(response.message)
    points.value = response.data
  } catch (error) {
    toast.error(`获取积分失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    isLoading.value = false
  }
}

onMounted(loadPoints)
</script>

<template>
  <div class="point-overview flex flex-col gap-4">
    <AccountPageHeader
      title="我的积分与签到"
      subtitle="查看你在各主播频道的积分余额、连签进度与兑换入口。"
    >
      <template #actions>
        <Button
          variant="outline"
          :disabled="isLoading"
          class="flex items-center gap-1.5"
          @click="loadPoints"
        >
          <RefreshCw
            class="size-3.5"
            :class="{ 'animate-spin': isLoading }"
          />
          刷新
        </Button>
      </template>
    </AccountPageHeader>

    <div class="summary-grid grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div
        class="summary-item summary-item--primary flex items-center gap-3.5 p-4 rounded-lg border border-primary/30 bg-primary/5"
      >
        <span class="summary-icon size-10 rounded-lg bg-primary/10 text-primary flex-center shrink-0">
          <Wallet class="size-5" />
        </span>
        <div class="summary-content flex flex-col min-w-0">
          <span class="summary-label text-xs text-muted-foreground">积分总计</span>
          <strong class="summary-value text-xl font-bold font-mono tabular-nums tracking-tight">{{
            totalPoints.toLocaleString()
          }}</strong>
        </div>
      </div>

      <div class="summary-item flex items-center gap-3.5 p-4 rounded-lg border border-border bg-card">
        <span class="summary-icon size-10 rounded-lg bg-muted text-muted-foreground flex-center shrink-0">
          <Gift class="size-5" />
        </span>
        <div class="summary-content flex flex-col min-w-0">
          <span class="summary-label text-xs text-muted-foreground">已加入频道</span>
          <strong class="summary-value text-xl font-bold font-mono tabular-nums tracking-tight">{{
            points.length
          }}</strong>
        </div>
      </div>

      <div class="summary-item flex items-center gap-3.5 p-4 rounded-lg border border-border bg-card">
        <span class="summary-icon size-10 rounded-lg bg-amber-500/10 text-amber-500 flex-center shrink-0">
          <Flame class="size-5" />
        </span>
        <div class="summary-content flex flex-col min-w-0">
          <span class="summary-label text-xs text-muted-foreground">
            累计签到 {{ totalCheckIns }} 天
          </span>
          <strong class="summary-value text-xl font-bold font-mono tabular-nums tracking-tight">
            最高连签 {{ maxStreak }} 天
          </strong>
        </div>
      </div>
    </div>

    <section class="balance-panel rounded-lg border border-border bg-card p-4 space-y-4">
      <div class="balance-panel__heading pb-2 border-b border-border/60">
        <h2 class="text-sm font-semibold text-foreground">频道积分与打卡</h2>
        <p class="text-xs text-muted-foreground mt-0.5">进入各主播频道即可签到打卡或兑换礼物与特权。</p>
      </div>

      <div
        v-if="isLoading"
        class="py-12 flex justify-center"
      >
        <Spin />
      </div>

      <Empty
        v-else-if="points.length === 0"
        description="暂无任何频道的积分"
        class="py-10"
      >
        <template #extra>
          <span class="text-xs text-muted-foreground mt-1 block">
            在已开通积分的主播直播间互动、签到或赠送礼物后，即可在此查看积分与打卡记录。
          </span>
        </template>
      </Empty>

      <div
        v-else
        class="balance-list divide-y divide-border/60"
      >
        <article
          v-for="item in points"
          :key="item.owner.id"
          class="py-3 first:pt-0 last:pb-0 space-y-2.5"
        >
          <div class="flex items-center justify-between flex-wrap gap-3">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <Avatar class="size-10 shrink-0">
                <AvatarImage :src="item.owner.faceUrl" />
                <AvatarFallback>{{ item.owner.name.slice(0, 1) }}</AvatarFallback>
              </Avatar>
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <strong class="text-sm font-medium truncate">{{ item.owner.name }}</strong>
                  <Badge
                    v-if="(item.consecutiveCheckInDays ?? 0) > 0"
                    variant="secondary"
                    size="xs"
                    class="gap-1"
                  >
                    <Flame class="size-3 text-amber-500" />
                    连签 {{ item.consecutiveCheckInDays }} 天
                  </Badge>
                </div>
                <div class="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                  <span>频道专属积分</span>
                  <template v-if="(item.totalCheckInDays ?? 0) > 0">
                    <span>· 累计签到 {{ item.totalCheckInDays }} 天</span>
                    <span v-if="item.lastCheckInAt">· 最近 {{ formatFullDate(item.lastCheckInAt) }}</span>
                  </template>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0 ml-auto">
              <div class="text-right">
                <strong class="text-base font-bold font-mono tabular-nums text-foreground">
                  {{ item.points.toLocaleString() }}
                </strong>
                <span class="text-xs text-muted-foreground ml-1">分</span>
              </div>

              <div class="flex items-center gap-1.5">
                <Button
                  v-if="item.recentCheckInDates && item.recentCheckInDates.length > 0"
                  size="xs"
                  variant="ghost"
                  class="gap-1"
                  @click="toggleCheckInHistory(item.owner.id)"
                >
                  <CalendarCheck class="size-3.5" />
                  打卡
                  <ChevronUp
                    v-if="expandedOwnerId === item.owner.id"
                    class="size-3"
                  />
                  <ChevronDown
                    v-else
                    class="size-3"
                  />
                </Button>
                <Button
                  size="xs"
                  variant="outline"
                  class="gap-1"
                  @click="router.push({ name: 'user-goods', params: { id: item.owner.name } })"
                >
                  前往兑换
                  <ArrowRight class="size-3" />
                </Button>
              </div>
            </div>
          </div>

          <div
            v-if="expandedOwnerId === item.owner.id && item.recentCheckInDates?.length"
            class="pl-13 pt-1 flex flex-col gap-2"
          >
            <div class="flex-between gap-2 text-xs text-muted-foreground">
              <span>近期签到记录（最近 {{ item.recentCheckInDates.length }} 次）</span>
              <Button
                variant="link"
                size="xs"
                class="h-auto p-0 text-xs"
                @click="router.push({ name: 'user-checkin', params: { id: item.owner.name } })"
              >
                查看频道签到榜
              </Button>
            </div>
            <div class="flex flex-wrap gap-1.5">
              <Badge
                v-for="ts in item.recentCheckInDates"
                :key="ts"
                variant="outline"
                size="xs"
                class="font-mono tabular-nums"
              >
                {{ formatDate(ts) }}
              </Badge>
            </div>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
