<script setup lang="ts">
import Add24Filled from '@vicons/fluent/es/Add24Filled'
import ArrowSync24Filled from '@vicons/fluent/es/ArrowSync24Filled'
import Copy24Regular from '@vicons/fluent/es/Copy24Regular'
import Delete24Filled from '@vicons/fluent/es/Delete24Filled'
import Edit24Filled from '@vicons/fluent/es/Edit24Filled'
import Grid24Regular from '@vicons/fluent/es/Grid24Regular'
import Open24Regular from '@vicons/fluent/es/Open24Regular'
import Pin16Filled from '@vicons/fluent/es/Pin16Filled'
import Pin16Regular from '@vicons/fluent/es/Pin16Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import Table24Regular from '@vicons/fluent/es/Table24Regular'
import { useRouteHash } from '@vueuse/router'
import { KeyRound, MoreHorizontal } from 'lucide-vue-next'
import { computed, onMounted, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponsePointGoodModel } from '@/api/client-types'
import {
  FunctionTypes,
  GoodsStatus,
  GoodsTypes,
  PointOrderStatus,
  VirtualKeySelectionMode,
} from '@/api/generated/model'
import {
  postApiPointDeleteGoods,
  postApiPointToggleGoodsPin,
  postApiPointUpdateGoodsStatus,
} from '@/api/generated/point/point'
import { fetchOwnerGrants } from '@/api/point-grants'
import { fetchOwnerOrders } from '@/api/point-orders'
import EventFetcherStatusCard from '@/apps/manage/components/event-fetcher/EventFetcherStatusCard.vue'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import PointOrderManage from '@/shared/components/points/PointOrderManage.vue'
import PointSettings from '@/shared/components/points/PointSettings.vue'
import { CURRENT_HOST } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { SmartImage } from '@/shared/ui/image'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { copyToClipboard, useMessage } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

import { formatGoodsPriceText } from './goods-dialog/goodsFormHelpers'
import PointCheckInOverview from './PointCheckInOverview.vue'
import PointGlobalHistoryView from './PointGlobalHistoryView.vue'
import PointGoodsEditDialog from './PointGoodsEditDialog.vue'
import PointGrantManage from './PointGrantManage.vue'
import PointGuardDuplicateManage from './PointGuardDuplicateManage.vue'
import PointTestPanel from './PointTestPanel.vue'
import PointUserManage from './PointUserManage.vue'

type MainTab = 'goods' | 'grants' | 'orders' | 'users' | 'settings' | 'test' | 'guard-duplicates'
type UsersSubTab = 'list' | 'histories' | 'checkin'
type GoodsStatusFilter = 'all' | 'onShelf' | 'offShelf' | 'soldOut' | 'lowKey'
type GoodsViewMode = 'grid' | 'table'

const message = useMessage()
const accountInfo = useAccount()
const biliAuth = useBiliAuth()

const showAddGoodsModal = ref(false)
const editingGoods = ref<ResponsePointGoodModel | undefined>(undefined)
const duplicateFromGoods = ref<ResponsePointGoodModel | undefined>(undefined)
const confirmDeleteGoods = ref<ResponsePointGoodModel | null>(null)
const usersSubTab = ref<UsersSubTab>('list')

// 路由哈希兼容
const realHash = useRouteHash('goods', { mode: 'replace' })
const rawHash = computed(() => (realHash.value?.startsWith('#') ? realHash.value.slice(1) : realHash.value || 'goods'))

const MAIN_TABS = new Set<MainTab>(['goods', 'grants', 'orders', 'users', 'settings', 'test', 'guard-duplicates'])

const activeTab = computed<MainTab>({
  get() {
    return MAIN_TABS.has(rawHash.value as MainTab) ? (rawHash.value as MainTab) : 'goods'
  },
  set(val) {
    realHash.value = `#${val}`
  },
})

const currentPointSetting = computed(() => accountInfo.value?.settings.point)
const goodsPageUrl = computed(() => (accountInfo.value?.name ? `${CURRENT_HOST}@${accountInfo.value.name}/goods` : ''))

function openPointSourceSettings() {
  activeTab.value = 'settings'
  window.setTimeout(() => {
    document.getElementById('point-source-settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, 50)
}

// 订单统计角标
const orderStatsBadge = ref({ total: 0, pending: 0, inProgress: 0, needTracking: 0 })
const pendingOrderBadgeCount = computed(() => orderStatsBadge.value.pending + orderStatsBadge.value.inProgress)

// 定向发放角标
const grantStatsBadge = ref({ unclaimed: 0, failed: 0 })

// 商品数据与筛选
const goods = ref<ResponsePointGoodModel[]>([])
const isLoadingGoods = ref(true)
const goodsSearch = ref('')
const goodsStatusFilter = ref<GoodsStatusFilter>('all')
const goodsTypeFilter = ref<string>('all')
const goodsTagFilter = ref<string>('all')
const goodsViewMode = usePersistedStorage<GoodsViewMode>('Settings.Point.GoodsViewMode', 'grid')
const selectedGoodsIds = ref<number[]>([])
const isBatchGoodsLoading = ref(false)

async function refreshGoods() {
  isLoadingGoods.value = true
  try {
    goods.value = await biliAuth.GetGoods(accountInfo.value?.id, message)
    const validIds = new Set(goods.value.map((g) => g.id))
    selectedGoodsIds.value = selectedGoodsIds.value.filter((id) => validIds.has(id))
  } finally {
    isLoadingGoods.value = false
  }
}

async function refreshOrderStatsBadge() {
  try {
    const list = await fetchOwnerOrders({ kind: 'owner' })
    orderStatsBadge.value = {
      total: list.length,
      pending: list.filter((o) => o.status === PointOrderStatus.Pending).length,
      inProgress: list.filter((o) => o.status === PointOrderStatus.InProgress).length,
      needTracking: list.filter(
        (o) => o.type === GoodsTypes.Physical && o.status === PointOrderStatus.Shipped && !o.trackingNumber,
      ).length,
    }
  } catch (err) {
    console.warn('[PointManage] 获取初始订单统计失败', err)
  }
}

async function refreshGrantStatsBadge() {
  try {
    const res = await fetchOwnerGrants({ page: 1, pageSize: 1 })
    grantStatsBadge.value = { unclaimed: res.unclaimedCount, failed: res.failedCount }
  } catch (err) {
    console.warn('[PointManage] 获取定向发放统计失败', err)
  }
}

onMounted(() => {
  void refreshGoods()
  void refreshOrderStatsBadge()
  void refreshGrantStatsBadge()
})

function isGoodsSoldOut(item: ResponsePointGoodModel) {
  if (item.subItems?.length) {
    return item.subItems.every((s) => s.count === 0)
  }
  return item.count === 0
}

function isGoodsVirtualKeyLowStock(item: ResponsePointGoodModel) {
  return (
    item.type === GoodsTypes.Virtual &&
    item.keySelectionMode !== undefined &&
    item.keySelectionMode !== VirtualKeySelectionMode.None &&
    item.status !== GoodsStatus.Discontinued &&
    (item.virtualKeys?.length ?? 0) < 5
  )
}

const lowKeyWarningCount = computed(() => goods.value.filter(isGoodsVirtualKeyLowStock).length)

function getGoodsStockText(item: ResponsePointGoodModel) {
  if (isGoodsSoldOut(item)) return '售罄'
  if (item.subItems?.length) {
    const avail = item.subItems.filter((s) => s.count == null || s.count > 0).length
    return `${avail}/${item.subItems.length} 款可兑`
  }
  return item.count == null ? '不限' : `余 ${item.count}`
}

function getGoodsTypeText(type: GoodsTypes) {
  switch (type) {
    case GoodsTypes.Physical:
      return '实物'
    case GoodsTypes.Service:
      return '服务'
    default:
      return '虚拟'
  }
}

function sortGoods(a: ResponsePointGoodModel, b: ResponsePointGoodModel) {
  if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1
  return b.id - a.id
}

const existTags = computed(() => {
  const tags = new Set<string>()
  for (const item of goods.value) {
    for (const tag of item.tags ?? []) {
      if (tag) tags.add(tag)
    }
  }
  return Array.from(tags)
})

const filteredGoods = computed(() => {
  const kw = goodsSearch.value.trim().toLowerCase()
  return goods.value
    .filter((item) => {
      if (goodsStatusFilter.value === 'onShelf' && item.status === GoodsStatus.Discontinued) return false
      if (goodsStatusFilter.value === 'offShelf' && item.status !== GoodsStatus.Discontinued) return false
      if (goodsStatusFilter.value === 'soldOut' && !isGoodsSoldOut(item)) return false
      if (goodsStatusFilter.value === 'lowKey' && !isGoodsVirtualKeyLowStock(item)) return false
      if (goodsTypeFilter.value !== 'all' && String(item.type) !== goodsTypeFilter.value) return false
      if (goodsTagFilter.value !== 'all' && !(item.tags ?? []).includes(goodsTagFilter.value)) return false
      if (kw) {
        const hitName = item.name?.toLowerCase().includes(kw)
        const hitDesc = item.description?.toLowerCase().includes(kw)
        const hitTag = (item.tags ?? []).some((t) => t.toLowerCase().includes(kw))
        if (!hitName && !hitDesc && !hitTag) return false
      }
      return true
    })
    .toSorted(sortGoods)
})

const onShelfGoods = computed(() => filteredGoods.value.filter((g) => g.status !== GoodsStatus.Discontinued))
const offShelfGoods = computed(() => filteredGoods.value.filter((g) => g.status === GoodsStatus.Discontinued))

const totalOnShelfCount = computed(() => goods.value.filter((g) => g.status !== GoodsStatus.Discontinued).length)

const shelfSections = computed(() => {
  const sections = []
  if (goodsStatusFilter.value !== 'offShelf') {
    sections.push({
      key: 'onShelf',
      items: onShelfGoods.value,
      isOffShelf: false,
      emptyText:
        goodsSearch.value || goodsTypeFilter.value !== 'all' || goodsTagFilter.value !== 'all'
          ? '没有匹配的礼物'
          : '暂无在售礼物',
      emptyClass: 'py-10',
      nextStatus: GoodsStatus.Discontinued,
      shelfActionLabel: '下架',
      shelfConfirmPositive: '确认下架',
      shelfConfirmText: '确定要下架这个礼物吗？',
      shelfBtnClass: 'text-amber-500 hover:text-amber-600',
      cardClass: 'h-full flex flex-col',
    })
  }
  if (goodsStatusFilter.value !== 'onShelf') {
    sections.push({
      key: 'offShelf',
      items: offShelfGoods.value,
      isOffShelf: true,
      emptyText: '暂无已下架礼物',
      emptyClass: 'py-6',
      nextStatus: GoodsStatus.Normal,
      shelfActionLabel: '上架',
      shelfConfirmPositive: '重新上架',
      shelfConfirmText: '确定要重新上架这个礼物吗？',
      shelfBtnClass: 'text-emerald-500 hover:text-emerald-600',
      cardClass: 'h-full flex flex-col opacity-75 hover:opacity-100 transition-opacity',
    })
  }
  return sections
})

function toggleGoodsSelect(id: number, checked: boolean) {
  if (checked) {
    if (!selectedGoodsIds.value.includes(id)) selectedGoodsIds.value = [...selectedGoodsIds.value, id]
  } else {
    selectedGoodsIds.value = selectedGoodsIds.value.filter((item) => item !== id)
  }
}

const isAllFilteredSelected = computed(
  () => filteredGoods.value.length > 0 && filteredGoods.value.every((g) => selectedGoodsIds.value.includes(g.id)),
)

function toggleSelectAllFiltered(checked: boolean) {
  const filteredIds = filteredGoods.value.map((g) => g.id)
  if (checked) {
    const selectedSet = new Set(selectedGoodsIds.value)
    const added = filteredIds.filter((id) => !selectedSet.has(id))
    selectedGoodsIds.value = [...selectedGoodsIds.value, ...added]
  } else {
    const filteredSet = new Set(filteredIds)
    selectedGoodsIds.value = selectedGoodsIds.value.filter((id) => !filteredSet.has(id))
  }
}

function onModalOpen() {
  editingGoods.value = undefined
  duplicateFromGoods.value = undefined
  showAddGoodsModal.value = true
}

function onUpdateClick(item: ResponsePointGoodModel) {
  editingGoods.value = item
  duplicateFromGoods.value = undefined
  showAddGoodsModal.value = true
}

function onDuplicateClick(item: ResponsePointGoodModel) {
  editingGoods.value = undefined
  duplicateFromGoods.value = item
  showAddGoodsModal.value = true
}

async function toggleGoodsPin(item: ResponsePointGoodModel) {
  const targetPinned = !item.isPinned
  try {
    const res = await postApiPointToggleGoodsPin({ id: item.id, isPinned: targetPinned })
    if (res.code === 200) {
      item.isPinned = targetPinned
      message.success(targetPinned ? `已置顶「${item.name}」` : `已取消置顶「${item.name}」`)
    } else {
      message.error(res.message || '置顶操作失败')
    }
  } catch (err) {
    message.error(`置顶操作失败: ${err}`)
  }
}

function handleGoodsSaved(saved: ResponsePointGoodModel) {
  const index = goods.value.findIndex((g) => g.id === saved.id)
  if (index >= 0) {
    const existing = goods.value[index]
    goods.value[index] = {
      ...saved,
      soldCount: saved.soldCount || existing.soldCount,
      purchasedCount: saved.purchasedCount || existing.purchasedCount,
      hasPurchased: saved.hasPurchased || existing.hasPurchased,
    }
  } else {
    goods.value.push(saved)
  }
}

async function batchSetGoodsStatus(ids: number[], status: GoodsStatus) {
  if (!ids.length) return
  isBatchGoodsLoading.value = true
  try {
    const res = await postApiPointUpdateGoodsStatus({ ids, status })
    if (res.code === 200) {
      const idSet = new Set(ids)
      goods.value.forEach((g) => {
        if (idSet.has(g.id)) g.status = status
      })
      selectedGoodsIds.value = selectedGoodsIds.value.filter((id) => !idSet.has(id))
      message.success(status === GoodsStatus.Normal ? `已上架 ${ids.length} 件礼物` : `已下架 ${ids.length} 件礼物`)
    } else {
      message.error(`失败: ${res.message}`)
    }
  } catch (err) {
    message.error(`失败: ${err}`)
  } finally {
    isBatchGoodsLoading.value = false
  }
}

async function onDeleteClick(item: ResponsePointGoodModel) {
  try {
    const res = await postApiPointDeleteGoods({ id: item.id })
    if (res.code === 200) {
      message.success('删除成功')
      goods.value = goods.value.filter((g) => g.id !== item.id)
      selectedGoodsIds.value = selectedGoodsIds.value.filter((id) => id !== item.id)
    } else {
      message.error(`删除失败: ${res.message}`)
    }
  } catch (err) {
    message.error(`删除失败: ${err}`)
  }
}

async function batchDeleteGoods() {
  if (!selectedGoodsIds.value.length) return
  const targets = [...selectedGoodsIds.value]
  isBatchGoodsLoading.value = true
  try {
    const results = await Promise.allSettled(targets.map((id) => postApiPointDeleteGoods({ id })))
    const deletedIds = new Set<number>()
    results.forEach((r, idx) => {
      if (r.status === 'fulfilled' && r.value.code === 200) {
        deletedIds.add(targets[idx])
      }
    })
    goods.value = goods.value.filter((g) => !deletedIds.has(g.id))
    selectedGoodsIds.value = selectedGoodsIds.value.filter((id) => !deletedIds.has(id))
    const failedCount = targets.length - deletedIds.size
    if (deletedIds.size === 0) {
      message.error(`批量删除失败（${failedCount} 件未删除）`)
    } else if (failedCount > 0) {
      message.warning(`已删除 ${deletedIds.size} 件礼物，${failedCount} 件删除失败`)
    } else {
      message.success(`已删除 ${deletedIds.size} 件礼物`)
    }
  } finally {
    isBatchGoodsLoading.value = false
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- 头部 -->
    <ManagePageHeader
      title="积分管理"
      subtitle="礼物、订单履约、用户积分与规则配置"
      :function-type="FunctionTypes.Point"
    >
      <template #action>
        <div class="flex items-center gap-2 flex-wrap w-full sm:w-auto">
          <div
            v-if="goodsPageUrl"
            class="flex items-center gap-1.5 w-full sm:w-auto"
          >
            <Input
              :model-value="goodsPageUrl"
              readonly
              class="hidden md:flex w-60 lg:w-72 font-mono bg-muted/40 text-muted-foreground select-all"
              title="礼物展示页链接（点击全选）"
              @click="($event.target as HTMLInputElement).select()"
            />
            <Button
              variant="outline"
              class="flex-1 sm:flex-initial"
              @click="copyToClipboard(goodsPageUrl)"
            >
              <Copy24Regular class="size-3.5 mr-1" />
              复制链接
            </Button>
            <Button
              variant="outline"
              class="flex-1 sm:flex-initial"
              as="a"
              :href="goodsPageUrl"
              target="_blank"
            >
              <Open24Regular class="size-3.5 mr-1" />
              前往展示页
            </Button>
          </div>
          <EventFetcherStatusCard class="w-full sm:w-auto" />
        </div>
      </template>
    </ManagePageHeader>

    <!-- 主标签页（4 主线 + 1 运维诊断） -->
    <Tabs
      v-model="activeTab"
      class="w-full"
    >
      <TabsList>
        <TabsTrigger
          value="goods"
          class="gap-1.5"
        >
          <span>礼物管理</span>
          <Badge
            v-if="totalOnShelfCount > 0"
            variant="secondary"
            size="xs"
            class="font-mono"
          >
            {{ totalOnShelfCount }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          value="grants"
          class="gap-1.5"
        >
          <span>定向发放</span>
          <Badge
            v-if="grantStatsBadge.failed > 0"
            variant="destructive"
            size="xs"
            class="font-mono"
          >
            {{ grantStatsBadge.failed }}
          </Badge>
          <Badge
            v-else-if="grantStatsBadge.unclaimed > 0"
            variant="secondary"
            size="xs"
            class="font-mono"
          >
            {{ grantStatsBadge.unclaimed }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          class="gap-1.5"
        >
          <span>订单履约</span>
          <Badge
            v-if="pendingOrderBadgeCount > 0"
            variant="warning"
            size="xs"
            class="font-mono"
          >
            {{ pendingOrderBadgeCount }}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="users">用户积分</TabsTrigger>
        <TabsTrigger value="settings">积分规则</TabsTrigger>
        <TabsTrigger value="test">模拟测试</TabsTrigger>
      </TabsList>

      <!-- 礼物管理 -->
      <TabsContent
        value="goods"
        class="pt-4 space-y-3.5"
      >
        <!-- 礼物工具栏 -->
        <div class="p-3 rounded-lg border border-border/80 bg-card flex-between flex-wrap gap-2.5 text-xs">
          <div class="flex items-center gap-2 flex-wrap flex-1 min-w-0">
            <div class="relative w-52 max-w-full">
              <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                v-model="goodsSearch"
                placeholder="搜索礼物名称 / 标签"
                class="pl-8"
              />
            </div>

            <ToggleGroup
              type="single"
              :model-value="goodsStatusFilter"
              @update:model-value="(val) => val && (goodsStatusFilter = val as GoodsStatusFilter)"
            >
              <ToggleGroupItem value="all">全部</ToggleGroupItem>
              <ToggleGroupItem value="onShelf">在售</ToggleGroupItem>
              <ToggleGroupItem value="offShelf">已下架</ToggleGroupItem>
              <ToggleGroupItem value="soldOut">已售罄</ToggleGroupItem>
              <ToggleGroupItem
                v-if="lowKeyWarningCount > 0 || goodsStatusFilter === 'lowKey'"
                value="lowKey"
                class="gap-1"
              >
                <span>卡密预警</span>
                <Badge
                  v-if="lowKeyWarningCount > 0"
                  variant="destructive"
                  size="xs"
                  class="font-mono"
                >
                  {{ lowKeyWarningCount }}
                </Badge>
              </ToggleGroupItem>
            </ToggleGroup>

            <Select v-model="goodsTypeFilter">
              <SelectTrigger class="w-28">
                <SelectValue placeholder="类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部类型</SelectItem>
                <SelectItem :value="String(GoodsTypes.Virtual)">虚拟</SelectItem>
                <SelectItem :value="String(GoodsTypes.Physical)">实物</SelectItem>
                <SelectItem :value="String(GoodsTypes.Service)">服务</SelectItem>
              </SelectContent>
            </Select>

            <Select
              v-if="existTags.length > 0"
              v-model="goodsTagFilter"
            >
              <SelectTrigger class="w-28">
                <SelectValue placeholder="标签" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部标签</SelectItem>
                <SelectItem
                  v-for="tag in existTags"
                  :key="tag"
                  :value="tag"
                >
                  {{ tag }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <ToggleGroup
              type="single"
              :model-value="goodsViewMode"
              @update:model-value="(val) => val && (goodsViewMode = val as GoodsViewMode)"
            >
              <ToggleGroupItem
                value="grid"
                title="卡片视图"
              >
                <Grid24Regular class="size-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem
                value="table"
                title="表格视图"
              >
                <Table24Regular class="size-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>

            <Button
              variant="outline"
              :loading="isLoadingGoods"
              @click="refreshGoods"
            >
              <ArrowSync24Filled class="size-3.5 mr-1" />
              刷新
            </Button>

            <Button
              class="gap-1.5"
              @click="onModalOpen"
            >
              <Add24Filled class="size-4" />
              添加礼物
            </Button>
          </div>
        </div>

        <!-- 批量操作栏 -->
        <div
          v-if="selectedGoodsIds.length > 0"
          class="flex-between flex-wrap gap-2 px-3.5 py-2 rounded-lg border border-primary/30 bg-primary/5 text-xs"
        >
          <div class="flex items-center gap-2.5">
            <Checkbox
              :checked="isAllFilteredSelected"
              @update:checked="(v) => toggleSelectAllFiltered(Boolean(v))"
            />
            <span class="font-medium text-foreground">已选择 {{ selectedGoodsIds.length }} 件礼物</span>
            <Button
              variant="ghost"
              size="xs"
              @click="selectedGoodsIds = []"
            >
              取消选择
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <Button
              variant="outline"
              size="xs"
              :loading="isBatchGoodsLoading"
              @click="batchSetGoodsStatus(selectedGoodsIds, GoodsStatus.Normal)"
            >
              批量上架
            </Button>
            <Button
              variant="outline"
              size="xs"
              :loading="isBatchGoodsLoading"
              @click="batchSetGoodsStatus(selectedGoodsIds, GoodsStatus.Discontinued)"
            >
              批量下架
            </Button>
            <Popconfirm
              positive-text="确认删除"
              negative-text="取消"
              @positive-click="batchDeleteGoods"
            >
              <template #trigger>
                <Button
                  variant="destructive"
                  size="xs"
                  :loading="isBatchGoodsLoading"
                >
                  批量删除
                </Button>
              </template>
              确定要永久删除选中的 {{ selectedGoodsIds.length }} 件礼物吗？
            </Popconfirm>
          </div>
        </div>

        <Spin :show="isLoadingGoods && goods.length === 0">
          <!-- 表格视图 -->
          <div
            v-if="goodsViewMode === 'table'"
            class="rounded-lg border border-border/80 bg-card overflow-hidden text-xs"
          >
            <Empty
              v-if="filteredGoods.length === 0"
              description="暂无匹配礼物"
              class="py-12"
            />
            <Table v-else>
              <TableHeader>
                <TableRow>
                  <TableHead class="w-10 px-3">
                    <Checkbox
                      :checked="isAllFilteredSelected"
                      @update:checked="(v) => toggleSelectAllFiltered(Boolean(v))"
                    />
                  </TableHead>
                  <TableHead>礼物</TableHead>
                  <TableHead class="w-20">类型</TableHead>
                  <TableHead class="w-28">所需积分</TableHead>
                  <TableHead class="w-28">库存</TableHead>
                  <TableHead class="w-24">状态</TableHead>
                  <TableHead class="w-44 text-right pr-3">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="item in filteredGoods"
                  :key="item.id"
                  :class="item.status === GoodsStatus.Discontinued ? 'opacity-70' : ''"
                >
                  <TableCell class="px-3">
                    <Checkbox
                      :checked="selectedGoodsIds.includes(item.id)"
                      @update:checked="(v) => toggleGoodsSelect(item.id, Boolean(v))"
                    />
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center gap-2.5 min-w-0">
                      <SmartImage
                        v-if="item.cover?.path"
                        :src="item.cover.path"
                        :file-id="item.cover.id"
                        :is-public="true"
                        :preview="true"
                        :alt="item.name"
                        class="size-9 rounded object-cover shrink-0 border border-border/60"
                      />
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <Pin16Filled
                            v-if="item.isPinned"
                            class="size-3.5 text-primary shrink-0"
                          />
                          <span class="font-medium text-foreground truncate">{{ item.name }}</span>
                          <Badge
                            v-if="item.isOnDiscount"
                            variant="destructive"
                            size="xs"
                          >
                            特惠
                          </Badge>
                          <Badge
                            v-if="isGoodsVirtualKeyLowStock(item)"
                            variant="destructive"
                            size="xs"
                            class="gap-0.5 font-mono"
                          >
                            <KeyRound class="size-2.5" />
                            卡密余 {{ item.virtualKeys?.length ?? 0 }}
                          </Badge>
                        </div>
                        <div
                          v-if="item.tags?.length"
                          class="flex items-center gap-1 mt-0.5 flex-wrap"
                        >
                          <Badge
                            v-for="tag in item.tags"
                            :key="tag"
                            variant="outline"
                            size="xs"
                          >
                            {{ tag }}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      size="xs"
                    >
                      {{ getGoodsTypeText(item.type) }}
                    </Badge>
                  </TableCell>
                  <TableCell class="font-mono font-semibold text-primary">
                    {{ formatGoodsPriceText(item) }}
                  </TableCell>
                  <TableCell class="font-mono text-muted-foreground">
                    {{ getGoodsStockText(item) }}
                  </TableCell>
                  <TableCell>
                    <Badge
                      :variant="
                        item.status === GoodsStatus.Discontinued
                          ? 'secondary'
                          : isGoodsSoldOut(item)
                            ? 'destructive'
                            : 'success'
                      "
                      size="xs"
                    >
                      {{ item.status === GoodsStatus.Discontinued ? '已下架' : isGoodsSoldOut(item) ? '售罄' : '在售' }}
                    </Badge>
                  </TableCell>
                  <TableCell class="text-right pr-3">
                    <div class="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="xs"
                        @click="onUpdateClick(item)"
                      >
                        修改
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        :title="item.isPinned ? '取消置顶' : '置顶'"
                        @click="toggleGoodsPin(item)"
                      >
                        {{ item.isPinned ? '取消置顶' : '置顶' }}
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        @click="onDuplicateClick(item)"
                      >
                        复制
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        :class="item.status === GoodsStatus.Discontinued ? 'text-emerald-600' : 'text-amber-600'"
                        @click="
                          batchSetGoodsStatus(
                            [item.id],
                            item.status === GoodsStatus.Discontinued ? GoodsStatus.Normal : GoodsStatus.Discontinued,
                          )
                        "
                      >
                        {{ item.status === GoodsStatus.Discontinued ? '上架' : '下架' }}
                      </Button>
                      <Popconfirm
                        positive-text="确认删除"
                        negative-text="取消"
                        @positive-click="onDeleteClick(item)"
                      >
                        <template #trigger>
                          <Button
                            variant="ghost"
                            size="xs"
                            class="text-destructive hover:bg-destructive/10"
                          >
                            删除
                          </Button>
                        </template>
                        确定要删除「{{ item.name }}」吗？
                      </Popconfirm>
                    </div>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <!-- 卡片视图 -->
          <div
            v-else
            class="space-y-4"
          >
            <div
              v-for="section in shelfSections"
              :key="section.key"
              :class="section.isOffShelf ? 'pt-2' : ''"
            >
              <div
                v-if="section.isOffShelf"
                class="flex items-center gap-2 mb-3"
              >
                <span class="text-xs font-semibold text-muted-foreground uppercase tracking-wider">已下架礼物</span>
                <Separator class="flex-1" />
              </div>

              <Empty
                v-if="section.items.length === 0"
                :description="section.emptyText"
                :class="section.emptyClass"
              />
              <div
                v-else
                class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              >
                <PointGoodsItem
                  v-for="item in section.items"
                  :key="item.id"
                  :goods="item"
                  :is-manage="true"
                  :class="section.cardClass"
                >
                  <template #footer>
                    <div class="w-full min-w-0 space-y-2.5 pt-2.5 border-t border-border/60 mt-auto">
                      <div class="flex-between gap-2 text-xs text-muted-foreground">
                        <label class="flex items-center gap-1.5 cursor-pointer select-none">
                          <Checkbox
                            :checked="selectedGoodsIds.includes(item.id)"
                            @update:checked="(v) => toggleGoodsSelect(item.id, Boolean(v))"
                          />
                          <span>批量选中</span>
                        </label>
                        <span class="font-mono text-[11px]">已兑 {{ item.soldCount || 0 }}</span>
                      </div>
                      <div class="flex items-center gap-1.5 min-w-0">
                        <Button
                          variant="outline"
                          size="xs"
                          class="flex-1 gap-1"
                          @click="onUpdateClick(item)"
                        >
                          <Edit24Filled class="size-3 shrink-0" />
                          <span>修改礼物</span>
                        </Button>
                        <Button
                          :variant="item.isPinned ? 'default' : 'outline'"
                          size="icon-xs"
                          :title="item.isPinned ? '取消置顶' : '置顶显示'"
                          @click="toggleGoodsPin(item)"
                        >
                          <component
                            :is="item.isPinned ? Pin16Filled : Pin16Regular"
                            class="size-3.5"
                          />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger as-child>
                            <Button
                              variant="outline"
                              size="icon-xs"
                              title="更多操作"
                            >
                              <MoreHorizontal class="size-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            class="w-36"
                          >
                            <DropdownMenuItem @click="onDuplicateClick(item)">
                              <Copy24Regular class="size-3.5 mr-2" />
                              <span>复制为新礼物</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem @click="batchSetGoodsStatus([item.id], section.nextStatus)">
                              <ArrowSync24Filled class="size-3.5 mr-2" />
                              <span>{{ section.shelfActionLabel }}礼物</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              class="text-destructive focus:text-destructive"
                              @click="confirmDeleteGoods = item"
                            >
                              <Delete24Filled class="size-3.5 mr-2" />
                              <span>删除礼物</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </template>
                </PointGoodsItem>
              </div>
            </div>
          </div>
        </Spin>
      </TabsContent>

      <!-- 定向发放 -->
      <TabsContent
        value="grants"
        class="pt-4"
      >
        <PointGrantManage
          v-if="activeTab === 'grants'"
          :goods-list="goods"
          @stats-change="grantStatsBadge = $event"
          @goods-stock-changed="refreshGoods"
        />
      </TabsContent>

      <!-- 订单履约 -->
      <TabsContent
        value="orders"
        class="pt-4"
      >
        <PointOrderManage @stats-change="orderStatsBadge = $event" />
      </TabsContent>

      <!-- 用户积分 -->
      <TabsContent
        value="users"
        class="pt-4 space-y-3.5"
      >
        <div class="flex-between flex-wrap gap-2">
          <ToggleGroup
            type="single"
            :model-value="usersSubTab"
            @update:model-value="(v) => v && (usersSubTab = v as UsersSubTab)"
          >
            <ToggleGroupItem value="list">用户列表</ToggleGroupItem>
            <ToggleGroupItem value="histories">全站流水</ToggleGroupItem>
            <ToggleGroupItem value="checkin">签到榜</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <PointUserManage
          v-show="usersSubTab === 'list'"
          :point-setting="currentPointSetting"
          @open-source-settings="openPointSourceSettings"
        />
        <PointGlobalHistoryView v-if="usersSubTab === 'histories'" />
        <PointCheckInOverview v-if="usersSubTab === 'checkin'" />
      </TabsContent>

      <!-- 积分规则（保留未保存草稿状态） -->
      <TabsContent
        value="settings"
        :force-mount="true"
        class="pt-4 data-[state=inactive]:hidden"
      >
        <PointSettings source-anchor-id="point-source-settings" />
      </TabsContent>

      <!-- 模拟测试（按需加载） -->
      <TabsContent
        value="test"
        class="pt-4"
      >
        <PointTestPanel v-if="activeTab === 'test'" />
      </TabsContent>

      <!-- 重复上舰排查已从可见导航隐藏，保留直达哈希 -->
      <TabsContent
        value="guard-duplicates"
        class="pt-4"
      >
        <PointGuardDuplicateManage v-if="activeTab === 'guard-duplicates'" />
      </TabsContent>
    </Tabs>

    <!-- 添加 / 修改 / 复制礼物模态框 -->
    <PointGoodsEditDialog
      v-model:open="showAddGoodsModal"
      :editing-goods="editingGoods"
      :duplicate-from="duplicateFromGoods"
      :exist-tags="existTags"
      @saved="handleGoodsSaved"
    />

    <!-- 卡片操作菜单删除确认 -->
    <Dialog
      :open="confirmDeleteGoods !== null"
      @update:open="(v) => !v && (confirmDeleteGoods = null)"
    >
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">删除礼物</DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            确定要删除「{{ confirmDeleteGoods?.name }}」吗？若有历史兑换订单，礼物将被安全移入回收状态。
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            @click="confirmDeleteGoods = null"
          >
            取消
          </Button>
          <Button
            variant="destructive"
            @click="confirmDeleteGoods && (onDeleteClick(confirmDeleteGoods), (confirmDeleteGoods = null))"
          >
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
