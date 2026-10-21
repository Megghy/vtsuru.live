<script setup lang="ts">
import {
  CashOutline,
  CubeOutline,
  GiftOutline,
  PeopleOutline,
  RefreshOutline,
  StorefrontOutline,
  TimeOutline,
} from '@vicons/ionicons5'
import { computed, onMounted, ref } from 'vue'

import {
  getApiOrgOrgIdAudit,
  getApiOrgOrgIdPointsGoods,
  getApiOrgOrgIdPointsStats,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

import { useOrgContext } from '../composables/useOrgContext'
import { injectOrgStreamers } from '../composables/useOrgStreamers'
import OrgAuditList from './OrgAuditList.vue'

const { orgId } = useOrgContext()
const { options: streamerOptions } = injectOrgStreamers()

const isLoading = ref(true)
const pointStats = ref<Record<string, number> | null>(null)
const pointGoods = ref<{ id: number; name: string; description?: string; price: number; stock: number }[]>([])
const auditLogs = ref<
  { id: number; action: string; detail: string; createdAt: number; userId: number; userName?: string }[]
>([])
const selectedStreamerId = ref<number | null>(null)

const statItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '总发放积分', value: s?.totalPointsIssued ?? 0, icon: CashOutline },
    { label: '总使用积分', value: s?.totalPointsUsed ?? 0, icon: GiftOutline },
    { label: '活跃用户', value: s?.activeUsers ?? 0, icon: PeopleOutline },
    { label: '总订单数', value: s?.totalOrders ?? 0, icon: StorefrontOutline },
  ]
})

const orderItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '待处理订单', value: s?.pendingOrders ?? 0, icon: TimeOutline, color: 'text-amber-500' },
    { label: '已发货订单', value: s?.shippedOrders ?? 0, icon: CubeOutline, color: 'text-primary' },
    { label: '已完成订单', value: s?.completedOrders ?? 0, icon: GiftOutline, color: 'text-emerald-500' },
  ]
})

async function loadData() {
  if (!orgId.value) return
  isLoading.value = true
  const streamerParam = selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined
  try {
    pointStats.value = unwrapOk(
      (await getApiOrgOrgIdPointsStats(orgId.value, streamerParam)) as any,
      '加载积分统计失败',
    )
    pointGoods.value = unwrapOk(
      (await getApiOrgOrgIdPointsGoods(orgId.value, streamerParam)) as any,
      '加载积分商品失败',
    )
    auditLogs.value = unwrapOk(
      (await getApiOrgOrgIdAudit(orgId.value, { take: 100 })) as any,
      '加载操作审计失败',
    )
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <div class="space-y-3.5 text-xs">
    <!-- 主播选择筛选 -->
    <Card class="border border-border/80">
      <CardHeader class="p-3 pb-2 border-b border-border/60">
        <CardTitle class="text-xs font-semibold">主播筛选</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <Select
          :model-value="selectedStreamerId ? String(selectedStreamerId) : 'all'"
          @update:model-value="selectedStreamerId = $event === 'all' ? null : Number($event); loadData()"
        >
          <SelectTrigger class="w-full sm:w-80 h-8 text-xs">
            <SelectValue placeholder="选择主播后，可单独查看/修改积分规则与筛选统计" />
          </SelectTrigger>
          <SelectContent class="max-h-56">
            <SelectItem value="all" class="text-xs">全部主播</SelectItem>
            <SelectItem
              v-for="opt in streamerOptions"
              :key="opt.value"
              :value="String(opt.value)"
              class="text-xs"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>

    <!-- 总体统计卡片 -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <Card
        v-for="item in statItems"
        :key="item.label"
        class="border border-border/80"
      >
        <CardContent class="p-3 flex items-center justify-between gap-2">
          <div class="space-y-0.5">
            <span class="text-[11px] text-muted-foreground block">{{ item.label }}</span>
            <span class="text-base font-semibold font-mono text-foreground">{{ item.value }}</span>
          </div>
          <component :is="item.icon" class="size-5 text-muted-foreground/60 shrink-0" />
        </CardContent>
      </Card>
    </div>

    <!-- 订单统计卡片 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
      <Card
        v-for="item in orderItems"
        :key="item.label"
        class="border border-border/80"
      >
        <CardContent class="p-3 flex items-center justify-between gap-2">
          <div class="space-y-0.5">
            <span class="text-[11px] text-muted-foreground block">{{ item.label }}</span>
            <span class="text-base font-semibold font-mono" :class="item.color">{{ item.value }}</span>
          </div>
          <component :is="item.icon" class="size-5 text-muted-foreground/60 shrink-0" />
        </CardContent>
      </Card>
    </div>

    <!-- 刷新按钮 -->
    <div class="flex items-center">
      <Button
        variant="outline"
        size="sm"
        class="h-7 text-xs gap-1"
        :disabled="isLoading"
        @click="loadData"
      >
        <component :is="RefreshOutline" class="size-3.5" />
        刷新
      </Button>
    </div>

    <div v-if="isLoading" class="py-12 flex justify-center">
      <Spin />
    </div>
    <div v-else-if="!pointStats && !pointGoods.length" class="py-8">
      <Empty description="暂无积分数据" />
    </div>

    <!-- 积分商品列表摘要 -->
    <Card v-if="pointGoods.length > 0" class="border border-border/80">
      <CardHeader class="p-3 pb-2 border-b border-border/60">
        <CardTitle class="text-xs font-semibold">积分商品</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <div class="divide-y divide-border/60">
          <div
            v-for="goods in pointGoods.slice(0, 5)"
            :key="goods.id"
            class="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 text-xs"
          >
            <div class="min-w-0 flex-1 space-y-0.5">
              <strong class="font-medium text-foreground text-xs block truncate">{{ goods.name }}</strong>
              <p class="text-[11px] text-muted-foreground truncate m-0">{{ goods.description }}</p>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <Badge variant="secondary" class="text-[10px] h-4.5 px-1.5 font-normal">
                {{ goods.price }} 积分
              </Badge>
              <Badge
                variant="outline"
                class="text-[10px] h-4.5 px-1.5 font-normal"
                :class="goods.stock > 0 ? 'text-emerald-600 border-emerald-500/30' : 'text-destructive border-destructive/30'"
              >
                {{ goods.stock > 0 ? `库存: ${goods.stock}` : '缺货' }}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 积分规则配置 -->
    <Card class="border border-border/80">
      <CardHeader class="p-3 pb-2 border-b border-border/60">
        <CardTitle class="text-xs font-semibold">积分规则</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <Alert
          v-if="!selectedStreamerId"
          class="text-xs bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
        >
          <AlertDescription class="text-xs">请选择一个主播后再修改积分规则</AlertDescription>
        </Alert>
        <PointSettings
          v-else
          :org-id="orgId"
          :streamer-id="selectedStreamerId"
        />
      </CardContent>
    </Card>

    <!-- 操作审计 -->
    <Card v-if="auditLogs.length" class="border border-border/80">
      <CardHeader class="p-3 pb-2 border-b border-border/60">
        <CardTitle class="text-xs font-semibold">操作审计</CardTitle>
      </CardHeader>
      <CardContent class="p-3">
        <OrgAuditList :logs="auditLogs" />
      </CardContent>
    </Card>
  </div>
</template>
