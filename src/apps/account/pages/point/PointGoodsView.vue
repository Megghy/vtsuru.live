<script setup lang="ts">
import { ArrowSync24Regular, Filter24Regular, Person24Regular, Search24Regular } from '@vicons/fluent'
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'

import type { ResponsePointGoodModel, UserInfo } from '@/api/api-models'
import PointGoodsExchangeDialog from '@/shared/components/points/PointGoodsExchangeDialog.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { NavigateToNewTab, toast } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  userInfo: UserInfo
}>()

const useAuth = useBiliAuth()
const isLoading = ref(false)
const biliAuth = computed(() => useAuth.biliAuth)

// --- 响应式状态 ---
const goods = ref<ResponsePointGoodModel[]>([]) // 礼物列表
const currentPoint = ref<number>(-1) // 当前用户积分
const currentGoods = ref<ResponsePointGoodModel>() // 兑换弹窗选中的礼物
const showBuyModal = ref(false)

// 筛选相关状态
const selectedTag = ref<string>() // 选中的标签
const onlyCanBuy = ref(false) // 只显示可兑换
const ignoreGuard = ref(false) // 忽略舰长限制
const sortOrder = ref<string>('default') // 排序方式
const searchKeyword = ref('') // 搜索关键词
const debouncedSearchKeyword = ref('') // 防抖后的搜索关键词

// 防抖搜索
const updateSearch = useDebounceFn((value: string) => {
  debouncedSearchKeyword.value = value
}, 300)

watch(searchKeyword, (newVal) => {
  updateSearch(newVal)
})

// --- 计算属性 ---

async function refreshCurrentPoint() {
  if (!useAuth.isAuthed) return
  if (!biliAuth.value.id) return
  try {
    const p = await useAuth.GetSpecificPoint(props.userInfo.id)
    currentPoint.value = p ?? -1
  } catch {
    currentPoint.value = -1
  }
}

// 格式化积分显示，保留两位小数
const formattedCurrentPoint = computed(() => {
  if (currentPoint.value < 0) return currentPoint.value
  return Number(currentPoint.value.toFixed(2))
})

const currentRoomGuardLevel = computed(() => biliAuth.value.guardInfo?.[props.userInfo.id] ?? 0)

const currentRoomGuardLabel = computed(() => {
  switch (currentRoomGuardLevel.value) {
    case 1:
      return '总督'
    case 2:
      return '提督'
    case 3:
      return '舰长'
    default:
      return ''
  }
})

// 礼物标签列表
const tags = computed(() => {
  return Array.from(new Set(goods.value.flatMap((g) => g.tags)))
})

// 经过筛选和排序后的礼物列表
const selectedItems = computed(() => {
  const filteredItems = goods.value
    // 标签筛选
    .filter((item) => !selectedTag.value || item.tags.includes(selectedTag.value))
    // 可兑换筛选 (只显示 getTooltip 返回 '开始兑换' 的礼物)
    .filter((item) => !onlyCanBuy.value || getTooltip(item) === '开始兑换')
    // 等级筛选：开启后只保留不属于任何等级专属的商品
    .filter((item) => !ignoreGuard.value || (item.allowGuardLevel ?? item.setting?.allowGuardLevel ?? 0) <= 0)
    // 关键词搜索 (匹配名称或描述)
    .filter(
      (item) =>
        !debouncedSearchKeyword.value ||
        item.name.toLowerCase().includes(debouncedSearchKeyword.value.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(debouncedSearchKeyword.value.toLowerCase())),
    )

  const compare = (() => {
    switch (sortOrder.value) {
      case 'price_asc':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => a.price - b.price
      case 'price_desc':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => b.price - a.price
      case 'name_asc':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => a.name.localeCompare(b.name)
      case 'name_desc':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => b.name.localeCompare(a.name)
      case 'type':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => a.type - b.type
      case 'recent':
        return (a: ResponsePointGoodModel, b: ResponsePointGoodModel) => b.createAt - a.createAt
      default:
        return undefined
    }
  })()

  return filteredItems
    .map((item, index) => ({ item, index }))
    .toSorted((a, b) => {
      if (a.item.isPinned !== b.item.isPinned) return a.item.isPinned ? -1 : 1
      return (compare?.(a.item, b.item) ?? 0) || a.index - b.index
    })
    .map(({ item }) => item)
})

// 获取礼物兑换按钮的提示文本
function getTooltip(item: ResponsePointGoodModel): string {
  if (!item.canPurchase && item.cannotPurchaseReason) {
    return item.cannotPurchaseReason
  }

  if (!biliAuth.value.id) return '请先进行账号认证'

  const hasSubs = (item.subItems?.length ?? 0) > 0
  if (hasSubs) {
    const available = (item.subItems ?? []).filter((s) => s.count == null || s.count > 0)
    if (!available.length) return '库存不足'
    const minPrice = Math.min(...available.map((s) => Number(s.price)))
    if ((currentPoint.value ?? 0) < minPrice && !item.canFreeBuy)
      return `积分不足(最低需要${minPrice}, 当前${currentPoint.value ?? 0})`
  } else {
    if ((item?.count ?? Number.MAX_VALUE) <= 0) return '库存不足'
    if (!item.isAllowRebuy && item.hasPurchased) return '该礼物不允许重复兑换'
    if (item.purchasedCount >= (item.maxBuyCount ?? Number.MAX_VALUE)) return `已达兑换上限(${item.maxBuyCount})`
    if ((currentPoint.value ?? 0) < item.price && !item.canFreeBuy)
      return `积分不足(需要${item.price}, 当前${currentPoint.value ?? 0})`
  }

  return '开始兑换'
}

function onBuyClick(good: ResponsePointGoodModel) {
  currentGoods.value = good
  showBuyModal.value = true
}

async function onExchangeSuccess() {
  await refreshCurrentPoint()
  goods.value = await useAuth.GetGoods(props.userInfo.id)
}

function gotoAuthPage() {
  NavigateToNewTab('/bili-user/points')
}

function clearFilters() {
  selectedTag.value = undefined
  searchKeyword.value = ''
  onlyCanBuy.value = false
  ignoreGuard.value = false
  sortOrder.value = 'default'
}

onMounted(async () => {
  isLoading.value = true
  try {
    if (useAuth.isAuthed) {
      if (!biliAuth.value.id) {
        await useAuth.getAuthInfo()
      }
      if (biliAuth.value.id) {
        await refreshCurrentPoint()
      }
    }
    goods.value = await useAuth.GetGoods(props.userInfo.id)
  } catch (error) {
    console.error('Error loading initial data:', error)
    toast.error('加载数据时出错')
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="point-goods-container space-y-4">
    <!-- 未认证提示 -->
    <div
      v-if="!useAuth.isAuthed"
      class="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-xs space-y-2"
    >
      <div class="font-semibold text-amber-600 dark:text-amber-400">需要认证</div>
      <p class="text-foreground">你尚未进行 Bilibili 账号认证, 可先浏览礼物，认证后可查看积分并兑换礼物。</p>
      <Button
        size="sm"
        class="h-7 text-xs"
        @click="$router.push({ name: 'bili-auth' })"
      >
        立即认证
      </Button>
    </div>

    <!-- 用户信息与工具栏 -->
    <Card
      v-if="useAuth.isAuthed"
      class="header-card shadow-sm"
    >
      <CardContent class="p-4 space-y-3 text-xs">
        <!-- 用户简要信息 -->
        <div class="user-status-bar flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div class="flex items-center gap-3 flex-wrap">
            <div class="flex items-center gap-1.5 font-medium">
              <component :is="Person24Regular" class="size-4 text-primary" />
              <strong class="text-sm text-foreground">{{ biliAuth.name }}</strong>
              <Badge
                v-if="currentRoomGuardLevel > 0"
                variant="secondary"
                class="text-[10px] h-4.5 px-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400"
              >
                ⚓ {{ currentRoomGuardLabel }}
              </Badge>
            </div>

            <Separator orientation="vertical" class="h-4" />

            <div class="flex items-center gap-1 text-muted-foreground">
              <span>当前积分:</span>
              <strong
                v-if="currentPoint >= 0"
                class="text-primary font-mono text-sm"
              >
                {{ formattedCurrentPoint }}
              </strong>
              <span
                v-else
                class="italic text-muted-foreground"
              >
                加载中...
              </span>
            </div>
          </div>

          <div class="account-actions flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs flex items-center gap-1"
              @click="gotoAuthPage"
            >
              <component :is="Person24Regular" class="size-3.5" />
              账号中心
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-7 text-xs flex items-center gap-1"
              @click="NavigateToNewTab('/bili-user/settings')"
            >
              <component :is="ArrowSync24Regular" class="size-3.5" />
              切换账号
            </Button>
          </div>
        </div>

        <!-- 筛选工具栏 -->
        <div class="toolbar-section space-y-3 pt-1">
          <!-- 标签分类 -->
          <div
            v-if="tags.length > 0"
            class="flex items-center gap-2 flex-wrap"
          >
            <span class="text-muted-foreground text-[11px] shrink-0">分类:</span>
            <div class="flex items-center gap-1.5 flex-wrap">
              <button
                v-for="tag in tags"
                :key="tag"
                type="button"
                class="px-2.5 py-0.5 rounded-full text-xs transition cursor-pointer"
                :class="
                  tag === selectedTag
                    ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                "
                @click="selectedTag = selectedTag === tag ? undefined : tag"
              >
                {{ tag }}
              </button>
            </div>
          </div>

          <!-- 搜索与排序 -->
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2.5">
              <div class="relative w-48">
                <component :is="Search24Regular" class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  v-model="searchKeyword"
                  placeholder="搜索礼物名称..."
                  class="h-8 pl-8 text-xs"
                />
              </div>

              <Select v-model="sortOrder">
                <SelectTrigger class="w-36 h-8 text-xs">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" class="text-xs">默认排序</SelectItem>
                  <SelectItem value="price_asc" class="text-xs">价格从低到高</SelectItem>
                  <SelectItem value="price_desc" class="text-xs">价格从高到低</SelectItem>
                  <SelectItem value="name_asc" class="text-xs">名称 A-Z</SelectItem>
                  <SelectItem value="recent" class="text-xs">最近上架</SelectItem>
                </SelectContent>
              </Select>

              <div class="flex items-center gap-3 text-xs">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox v-model:checked="onlyCanBuy" />
                  <span>仅显示可兑换</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox v-model:checked="ignoreGuard" />
                  <span>只看非等级专属</span>
                </label>
              </div>
            </div>

            <div class="toolbar-actions flex items-center gap-2">
              <Button
                v-if="selectedTag || searchKeyword || onlyCanBuy || ignoreGuard || sortOrder !== 'default'"
                variant="ghost"
                size="sm"
                class="h-8 text-xs flex items-center gap-1 text-muted-foreground hover:text-foreground"
                @click="clearFilters"
              >
                <component :is="Filter24Regular" class="size-3.5" />
                重置筛选
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs flex items-center gap-1"
                @click="refreshCurrentPoint"
              >
                <component :is="ArrowSync24Regular" class="size-3.5" />
                刷新积分
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 礼物列表区域 -->
    <div v-if="isLoading" class="py-16 flex justify-center">
      <Spin />
    </div>

    <Empty
      v-else-if="selectedItems.length === 0"
      :description="goods.length === 0 ? '当前没有可兑换的礼物哦~' : '没有找到符合筛选条件的礼物'"
      class="py-12"
    />

    <div
      v-else
      class="goods-grid grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
    >
      <div
        v-for="item in selectedItems"
        :key="item.id"
      >
        <PointGoodsItem
          :goods="item"
          class="goods-item-card h-full flex flex-col justify-between"
          :class="{ 'opacity-70': getTooltip(item) !== '开始兑换' }"
        >
          <template #footer>
            <div class="space-y-2 pt-2">
              <div
                v-if="item.hasPurchased || !item.canPurchase"
                class="flex items-center gap-1 flex-wrap"
              >
                <Badge
                  v-if="item.hasPurchased"
                  variant="secondary"
                  class="text-[10px] h-4.5 px-1 font-normal"
                >
                  {{ item.isAllowRebuy ? `已兑换 ${item.purchasedCount} 次` : '已兑换' }}
                </Badge>
                <Badge
                  v-if="!item.canPurchase && item.cannotPurchaseReason"
                  variant="destructive"
                  class="text-[10px] h-4.5 px-1 font-normal"
                >
                  {{ item.cannotPurchaseReason }}
                </Badge>
              </div>

              <Button
                class="w-full text-xs h-8"
                :variant="item.isPinned ? 'default' : 'secondary'"
                @click="onBuyClick(item)"
              >
                {{ getTooltip(item) === '开始兑换' ? (item.isPinned ? '立即兑换' : '兑换') : '查看详情' }}
              </Button>
            </div>
          </template>
        </PointGoodsItem>
      </div>
    </div>

    <!-- 兑换弹窗 -->
    <PointGoodsExchangeDialog
      v-model:show="showBuyModal"
      v-model:goods="currentGoods"
      :v-id="props.userInfo.id"
      :current-point="currentPoint"
      @success="onExchangeSuccess"
    />
  </div>
</template>

<style scoped>
.point-goods-container {
  width: 100%;
  min-width: 0;
}
</style>
