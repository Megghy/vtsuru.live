<script setup lang="ts">
import {
  CheckCircle2,
  Clock,
  Coins,
  Gift,
  Package,
  RefreshCw,
  Search,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import { getApiOrgOrgIdPointsStats } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Spin } from '@/shared/ui/spin'
import { toast } from '@/shared/utils'

import { getOrgPointGoodsPaged } from '../api'
import { useOrgContext } from '../composables/useOrgContext'
import { injectOrgStreamers } from '../composables/useOrgStreamers'
import type { OrgPointGoodsItem } from '../types'

const ctx = useOrgContext()
const { orgId } = ctx
const { pointManagedOptions: streamerOptions } = injectOrgStreamers()

const isLoading = ref(false)
const loadError = ref<string | null>(null)
const pointStats = ref<Record<string, number> | null>(null)
const pointGoods = ref<OrgPointGoodsItem[]>([])
const goodsSearch = ref('')
const showAllGoods = ref(false)

const selectedStreamerId = ref<number | null>(null)
const pendingStreamerId = ref<number | null | undefined>(undefined)
const pointSettingsRef = ref<InstanceType<typeof PointSettings> | null>(null)

function handleStreamerChange(val: string) {
  const nextId = val === 'all' ? null : Number(val)
  if (nextId === selectedStreamerId.value) return
  if (pointSettingsRef.value?.isDirty) {
    pendingStreamerId.value = nextId
    return
  }
  selectedStreamerId.value = nextId
  void loadData()
}

function confirmDiscardSwitch() {
  if (pendingStreamerId.value === undefined) return
  selectedStreamerId.value = pendingStreamerId.value
  pendingStreamerId.value = undefined
  void loadData()
}

const filteredGoods = computed(() => {
  const q = goodsSearch.value.trim().toLowerCase()
  if (!q) return pointGoods.value
  return pointGoods.value.filter(
    (g) =>
      g.name.toLowerCase().includes(q)
      || (g.description ?? '').toLowerCase().includes(q)
      || (g.streamerName ?? '').toLowerCase().includes(q),
  )
})

const displayedGoods = computed(() => (showAllGoods.value ? filteredGoods.value : filteredGoods.value.slice(0, 8)))

const statItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '总发放积分', value: s?.totalPointsIssued ?? 0, icon: Coins },
    { label: '总使用积分', value: s?.totalPointsUsed ?? 0, icon: Gift },
    { label: '活跃用户', value: s?.activeUsers ?? 0, icon: Users },
    { label: '总订单数', value: s?.totalOrders ?? 0, icon: ShoppingBag },
  ]
})

const orderItems = computed(() => {
  const s = pointStats.value
  return [
    { label: '待处理订单', value: s?.pendingOrders ?? 0, icon: Clock, color: 'text-amber-500' },
    { label: '已发货订单', value: s?.shippedOrders ?? 0, icon: Truck, color: 'text-primary' },
    { label: '已完成订单', value: s?.completedOrders ?? 0, icon: CheckCircle2, color: 'text-emerald-500' },
  ]
})

async function loadData() {
  if (!orgId.value) return
  isLoading.value = true
  loadError.value = null
  const streamerParam = selectedStreamerId.value ? { streamerId: selectedStreamerId.value } : undefined
  try {
    const [statsResp, goodsResp] = await Promise.all([
      getApiOrgOrgIdPointsStats(orgId.value, streamerParam),
      getOrgPointGoodsPaged(orgId.value, { ...streamerParam, page: 1, pageSize: 100 }),
    ])
    pointStats.value = unwrapOk(statsResp as any, '加载积分统计失败')
    const rawGoods = unwrapOk(goodsResp as any, '加载积分商品失败')
    pointGoods.value = Array.isArray(rawGoods) ? rawGoods : []
  } catch (err) {
    const msg = err instanceof Error ? err.message : '加载积分数据失败'
    loadError.value = msg
    toast.error(msg)
  } finally {
    isLoading.value = false
  }
}

watch(
  () => ctx.refreshTick.value,
  () => {
    void loadData()
  },
)

onMounted(loadData)
</script>

<template>
  <div class="space-y-4 text-xs">
    <!-- 顶部统一筛选与操作栏 -->
    <div class="p-3 rounded-lg border border-border/80 bg-card flex-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
        <span class="text-muted-foreground shrink-0">主播范围</span>
        <Select
          :model-value="selectedStreamerId ? String(selectedStreamerId) : 'all'"
          @update:model-value="handleStreamerChange(String($event))"
        >
          <SelectTrigger class="w-full sm:w-64">
            <SelectValue placeholder="选择主播查看统计或配置积分规则" />
          </SelectTrigger>
          <SelectContent class="max-h-56">
            <SelectItem value="all">全部允许代管的主播</SelectItem>
            <SelectItem
              v-for="opt in streamerOptions"
              :key="opt.value"
              :value="String(opt.value)"
            >
              {{ opt.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant="outline"
        class="gap-1.5"
        :disabled="isLoading"
        @click="loadData"
      >
        <RefreshCw
          class="size-3.5"
          :class="{ 'animate-spin': isLoading }"
        />
        刷新
      </Button>
    </div>

    <Alert
      v-if="loadError"
      variant="destructive"
    >
      <AlertDescription class="flex-between gap-2">
        <span>{{ loadError }}</span>
        <Button
          variant="outline"
          size="xs"
          @click="loadData"
        >
          重试
        </Button>
      </AlertDescription>
    </Alert>

    <div
      v-else-if="isLoading && !pointStats"
      class="py-12 flex-center"
    >
      <Spin />
    </div>

    <template v-else>
      <!-- 总体统计卡片 -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card
          v-for="item in statItems"
          :key="item.label"
        >
          <CardContent class="p-3 flex-between gap-2">
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">{{ item.label }}</span>
              <span class="text-base font-semibold font-mono tabular-nums text-foreground">{{ item.value }}</span>
            </div>
            <component
              :is="item.icon"
              class="size-4 text-muted-foreground/70 shrink-0"
            />
          </CardContent>
        </Card>
      </div>

      <!-- 订单状态卡片 -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <Card
          v-for="item in orderItems"
          :key="item.label"
        >
          <CardContent class="p-3 flex-between gap-2">
            <div class="space-y-0.5">
              <span class="text-[11px] text-muted-foreground block">{{ item.label }}</span>
              <span
                class="text-base font-semibold font-mono tabular-nums"
                :class="item.color"
              >
                {{ item.value }}
              </span>
            </div>
            <component
              :is="item.icon"
              class="size-4 text-muted-foreground/70 shrink-0"
            />
          </CardContent>
        </Card>
      </div>

      <!-- 积分商品列表 -->
      <Card>
        <CardHeader class="p-3 border-b border-border/60 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <Package class="size-3.5 text-primary" />
            在售积分商品 ({{ filteredGoods.length }})
          </CardTitle>

          <div
            v-if="pointGoods.length > 0"
            class="relative w-52 max-w-full"
          >
            <Input
              v-model="goodsSearch"
              placeholder="搜索商品名称 / 主播"
              class="pl-8"
            />
            <Search class="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </CardHeader>

        <CardContent class="p-3">
          <Empty
            v-if="filteredGoods.length === 0"
            description="暂无在售积分商品"
            class="py-6"
          />
          <div
            v-else
            class="space-y-2"
          >
            <div class="divide-y divide-border/60">
              <div
                v-for="goods in displayedGoods"
                :key="goods.id"
                class="py-2.5 first:pt-0 last:pb-0 flex-between gap-3 flex-wrap text-xs"
              >
                <div class="min-w-0 flex-1 space-y-0.5">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <strong class="font-medium text-foreground text-xs truncate">{{ goods.name }}</strong>
                    <Badge
                      v-if="goods.streamerName && !selectedStreamerId"
                      variant="outline"
                      size="xs"
                      class="text-muted-foreground"
                    >
                      {{ goods.streamerName }}
                    </Badge>
                  </div>
                  <p
                    v-if="goods.description"
                    class="text-[11px] text-muted-foreground truncate m-0"
                  >
                    {{ goods.description }}
                  </p>
                </div>
                <div class="flex items-center gap-1.5 shrink-0 font-mono tabular-nums">
                  <Badge
                    variant="secondary"
                    size="xs"
                  >
                    {{ goods.price }} 积分
                  </Badge>
                  <Badge
                    variant="outline"
                    size="xs"
                    :class="
                      goods.stock > 0
                        ? 'text-emerald-600 border-emerald-500/30'
                        : 'text-destructive border-destructive/30'
                    "
                  >
                    {{ goods.stock > 0 ? `库存: ${goods.stock}` : '缺货' }}
                  </Badge>
                </div>
              </div>
            </div>

            <div
              v-if="filteredGoods.length > 8"
              class="pt-2 border-t border-border/60 flex-center"
            >
              <Button
                variant="ghost"
                size="xs"
                @click="showAllGoods = !showAllGoods"
              >
                {{ showAllGoods ? '收起商品列表' : `展开全部 ${filteredGoods.length} 件商品` }}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <!-- 积分规则配置 -->
      <Card>
        <CardHeader class="p-3 border-b border-border/60">
          <CardTitle class="text-xs font-semibold">积分规则配置</CardTitle>
        </CardHeader>
        <CardContent class="p-3">
          <Alert
            v-if="!selectedStreamerId"
            size="sm"
            variant="warning"
          >
            <AlertDescription>请在顶部选择一个具体主播后查看并修改其积分规则。</AlertDescription>
          </Alert>
          <PointSettings
            v-else
            ref="pointSettingsRef"
            :org-id="orgId"
            :streamer-id="selectedStreamerId"
          />
        </CardContent>
      </Card>
    </template>

    <!-- 未保存切换确认 -->
    <AlertDialog
      :open="pendingStreamerId !== undefined"
      @update:open="(v) => { if (!v) pendingStreamerId = undefined }"
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>放弃未保存的积分规则修改？</AlertDialogTitle>
          <AlertDialogDescription>
            当前主播的积分规则尚有未保存的更改，切换主播后这些更改将丢失。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>继续编辑</AlertDialogCancel>
          <AlertDialogAction @click="confirmDiscardSwitch">放弃并切换</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
