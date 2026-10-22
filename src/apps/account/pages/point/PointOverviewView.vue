<script setup lang="ts">
import { ArrowRight24Regular, ArrowSync24Regular, Gift24Regular, Open24Regular, Wallet24Regular } from '@vicons/fluent'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserInfo } from '@/api/api-models'
import { getApiPointUserGetAllPoint } from '@/api/generated/point/point'
import AccountPageHeader from '@/apps/account/components/AccountPageHeader.vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/avatar'
import { Button } from '@/shared/ui/button'
import { Empty } from '@/shared/ui/empty'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

interface PointAccount {
  owner: UserInfo
  points: number
}

const auth = useBiliAuth()
const router = useRouter()
const isLoading = ref(false)
const points = ref<PointAccount[]>([])

const totalPoints = computed(() => points.value.reduce((total, item) => total + item.points, 0))

async function loadPoints() {
  isLoading.value = true
  try {
    const response = (await getApiPointUserGetAllPoint({
      headers: Object.fromEntries(await auth.getBiliAuthHeaders()),
    })) as unknown as {
      code: number
      message?: string
      data: PointAccount[]
    }
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
  <TooltipProvider>
    <div class="point-overview flex flex-col gap-4">
      <AccountPageHeader
        title="我的积分"
        subtitle="查看你在不同主播频道中的积分余额与兑换入口。"
      >
        <template #actions>
          <Button variant="outline" :disabled="isLoading" class="flex items-center gap-1.5" @click="loadPoints">
            <component :is="ArrowSync24Regular" class="size-4" :class="{ 'animate-spin': isLoading }" />
            刷新
          </Button>
        </template>
      </AccountPageHeader>

      <div class="summary-grid grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div class="summary-item summary-item--primary flex items-center gap-3.5 p-4 rounded-lg border border-primary/30 bg-primary/5">
          <span class="summary-icon size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <component :is="Wallet24Regular" class="size-5" />
          </span>
          <div class="summary-content flex flex-col min-w-0">
            <span class="summary-label text-xs text-muted-foreground">积分总计</span>
            <strong class="summary-value text-xl font-bold tracking-tight">{{ totalPoints.toLocaleString() }}</strong>
          </div>
        </div>
        <div class="summary-item flex items-center gap-3.5 p-4 rounded-lg border border-border bg-card">
          <span class="summary-icon size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
            <component :is="Gift24Regular" class="size-5" />
          </span>
          <div class="summary-content flex flex-col min-w-0">
            <span class="summary-label text-xs text-muted-foreground">已加入频道</span>
            <strong class="summary-value text-xl font-bold tracking-tight">{{ points.length }}</strong>
          </div>
        </div>
      </div>

      <section class="balance-panel rounded-lg border border-border bg-card p-4 space-y-4">
        <div class="balance-panel__heading pb-2 border-b border-border/60">
          <h2 class="text-sm font-semibold text-foreground">频道积分列表</h2>
          <p class="text-xs text-muted-foreground mt-0.5">进入各主播频道即可兑换当前可用的礼物与特权。</p>
        </div>

        <div v-if="isLoading" class="py-12 flex justify-center">
          <Spin />
        </div>

        <Empty
          v-else-if="points.length === 0"
          description="暂无任何频道的积分"
          class="py-10"
        >
          <template #extra>
            <span class="text-xs text-muted-foreground mt-1 block">在已开通积分的主播直播间互动、签到或赠送礼物后，即可在此查看积分。</span>
          </template>
        </Empty>

        <div
          v-else
          class="balance-list divide-y divide-border/60"
        >
          <article
            v-for="item in points"
            :key="item.owner.id"
            class="balance-row py-3 flex items-center gap-3.5 first:pt-0 last:pb-0"
          >
            <Avatar class="size-10 shrink-0">
              <AvatarImage :src="item.owner.faceUrl" />
              <AvatarFallback>{{ item.owner.name.slice(0, 1) }}</AvatarFallback>
            </Avatar>
            <div class="balance-owner flex-1 min-w-0">
              <div class="balance-owner__name-row flex items-center gap-1.5">
                <strong class="text-sm font-medium truncate">{{ item.owner.name }}</strong>
                <Tooltip v-if="item.owner.biliId">
                  <TooltipTrigger as-child>
                    <a
                      :href="`https://space.bilibili.com/${item.owner.biliId}`"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-muted-foreground hover:text-primary transition"
                      title="打开 B 站空间"
                    >
                      <component :is="Open24Regular" class="size-3.5" />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>查看主播 Bilibili 空间</TooltipContent>
                </Tooltip>
              </div>
              <span class="balance-owner__sub text-xs text-muted-foreground">频道专属积分</span>
            </div>
            <div class="balance-value-cell text-right shrink-0">
              <strong class="balance-value text-base font-bold font-mono text-foreground">{{ item.points.toLocaleString() }}</strong>
              <span class="balance-unit text-xs text-muted-foreground ml-1">分</span>
            </div>
            <div class="balance-actions shrink-0">
              <Button variant="outline" class="flex items-center gap-1" @click="router.push({ name: 'user-goods', params: { id: item.owner.name } })">
                前往兑换
                <component :is="ArrowRight24Regular" class="size-3.5" />
              </Button>
            </div>
          </article>
        </div>
      </section>
    </div>
  </TooltipProvider>
</template>
