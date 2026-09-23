<script setup lang="ts">
import { ArrowSync24Regular, Search24Regular, Filter24Regular, Person24Regular } from '@vicons/fluent'
import { useDebounceFn } from '@vueuse/core'
import { NAlert, NButton, NCard, NCheckbox, NDivider, NEmpty, NFlex, NGi, NGrid, NIcon, NSelect, NSpin, NTag, NText, useMessage } from 'naive-ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { ResponsePointGoodModel, UserInfo } from '@/api/api-models'
import { GoodsTypes } from '@/api/api-models'
import PointGoodsExchangeDialog from '@/shared/components/points/PointGoodsExchangeDialog.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { NavigateToNewTab } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

const props = defineProps<{
  userInfo: UserInfo
}>()

const useAuth = useBiliAuth()
const isLoading = ref(false)
const message = useMessage()
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
const sortOrder = ref<string | null>(null) // 排序方式
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

// 格式化积分显示，保留两位小数（后端按 2 位精度落库）
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

// --- 方法 ---

// 获取礼物兑换按钮的提示文本
function getTooltip(item: ResponsePointGoodModel): string {
  // 优先使用后端返回的购买状态信息
  if (!item.canPurchase && item.cannotPurchaseReason) {
    return item.cannotPurchaseReason
  }

  // 后备检查逻辑
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

// 打开兑换弹窗
function onBuyClick(good: ResponsePointGoodModel) {
  currentGoods.value = good
  showBuyModal.value = true
}

// 兑换成功后刷新积分与礼物列表
async function onExchangeSuccess() {
  await refreshCurrentPoint()
  goods.value = await useAuth.GetGoods(props.userInfo.id, message)
}

// 跳转到 Bilibili 用户中心页面
function gotoAuthPage() {
  NavigateToNewTab('/bili-user/points')
}

// 清空筛选条件
function clearFilters() {
  selectedTag.value = undefined
  searchKeyword.value = ''
  onlyCanBuy.value = false
  ignoreGuard.value = false
  sortOrder.value = null
}

// --- 生命周期钩子 ---
onMounted(async () => {
  isLoading.value = true // 开始加载
  try {
    // 如果用户已登录 B站 认证系统
    if (useAuth.isAuthed) {
      // 如果本地没有 B站 用户信息，则获取
      if (!biliAuth.value.id) {
        await useAuth.getAuthInfo()
      }
      // 如果获取到 B站 用户信息，则获取该主播直播间的积分
      if (biliAuth.value.id) {
        await refreshCurrentPoint()
      }
    }
    // 获取礼物列表
    goods.value = await useAuth.GetGoods(props.userInfo.id, message)
  } catch (error) {
    console.error('Error loading initial data:', error)
    message.error('加载数据时出错')
  } finally {
    isLoading.value = false // 结束加载
  }
})
</script>

<template>
  <div class="point-goods-container">
    <!-- 未认证提示 -->
    <div v-if="!useAuth.isAuthed">
      <NAlert
        type="warning"
        title="需要认证"
        size="small"
        :bordered="false"
      >
        <NFlex
          vertical
          :gap="8"
        >
          <NText>你尚未进行 Bilibili 账号认证, 可先浏览礼物，认证后可查看积分并兑换礼物。</NText>
          <NFlex>
            <NButton
              type="primary"
              size="small"
              @click="$router.push({ name: 'bili-auth' })"
            >
              立即认证
            </NButton>
          </NFlex>
        </NFlex>
      </NAlert>
      <NDivider />
    </div>

    <!-- 用户信息与工具栏 -->
    <NCard
      v-if="useAuth.isAuthed"
      class="header-card"
      embedded
    >
      <div class="header-container">
        <!-- 用户简要信息 -->
        <div class="user-status-bar">
          <NFlex
            class="user-status-content"
            justify="space-between"
            align="center"
          >
            <NFlex
              align="center"
              :gap="16"
            >
              <NFlex
                align="center"
                :gap="8"
              >
                <NIcon
                  :component="Person24Regular"
                  size="20"
                  class="status-icon"
                />
                <NText
                  strong
                  class="username"
                >
                  {{ biliAuth.name }}
                </NText>
                <NTag
                  v-if="currentRoomGuardLevel > 0"
                  size="small"
                  type="warning"
                  :bordered="false"
                  round
                >
                  ⚓ {{ currentRoomGuardLabel }}
                </NTag>
              </NFlex>

              <NDivider vertical />

              <NFlex
                align="center"
                :gap="4"
              >
                <NText depth="3"> 当前积分: </NText>
                <NText
                  v-if="currentPoint >= 0"
                  type="primary"
                  strong
                  class="point-value"
                >
                  {{ formattedCurrentPoint }}
                </NText>
                <NText
                  v-else
                  depth="3"
                  italic
                >
                  加载中...
                </NText>
              </NFlex>
            </NFlex>

            <NFlex
              class="account-actions"
              align="center"
              :gap="12"
            >
              <NButton
                quaternary
                size="small"
                @click="gotoAuthPage"
              >
                <template #icon>
                  <NIcon :component="Person24Regular" />
                </template>
                账号中心
              </NButton>
              <NButton
                quaternary
                size="small"
                @click="NavigateToNewTab('/bili-user/settings')"
              >
                <template #icon>
                  <NIcon :component="ArrowSync24Regular" />
                </template>
                切换账号
              </NButton>
            </NFlex>
          </NFlex>
        </div>

        <NDivider style="margin: 4px 0" />

        <!-- 筛选工具栏 -->
        <div class="toolbar-section">
          <NFlex
            vertical
            :gap="16"
          >
            <!-- 标签分类 -->
            <NFlex
              v-if="tags.length > 0"
              align="center"
              :gap="12"
            >
              <NText
                depth="3"
                class="filter-label"
              >
                分类:
              </NText>
              <NFlex
                :gap="8"
                wrap
              >
                <NButton
                  v-for="tag in tags"
                  :key="tag"
                  size="tiny"
                  round
                  :type="tag === selectedTag ? 'primary' : 'default'"
                  :secondary="tag !== selectedTag"
                  @click="selectedTag = selectedTag === tag ? undefined : tag"
                >
                  {{ tag }}
                </NButton>
              </NFlex>
            </NFlex>

            <!-- 搜索与排序 -->
            <NFlex
              justify="space-between"
              align="center"
              wrap
              :gap="12"
            >
              <NFlex
                class="filter-controls"
                align="center"
                :gap="12"
                wrap
              >
                <NInput
                  v-model:value="searchKeyword"
                  class="search-input"
                  placeholder="搜索礼物名称..."
                  clearable
                  size="medium"
                  style="width: 240px"
                >
                  <template #prefix>
                    <NIcon :component="Search24Regular" />
                  </template>
                </NInput>

                <NSelect
                  v-model:value="sortOrder"
                  class="sort-select"
                  :options="[
                    { label: '默认排序', value: null },
                    { label: '价格从低到高', value: 'price_asc' },
                    { label: '价格从高到低', value: 'price_desc' },
                    { label: '名称 A-Z', value: 'name_asc' },
                    { label: '最近上架', value: 'recent' },
                  ]"
                  placeholder="排序方式"
                  size="medium"
                  style="width: 160px"
                  clearable
                />

                <NFlex
                  class="filter-checks"
                  align="center"
                  :gap="16"
                >
                  <NCheckbox v-model:checked="onlyCanBuy"> 仅显示可兑换 </NCheckbox>
                  <NCheckbox v-model:checked="ignoreGuard"> 只看非等级专属 </NCheckbox>
                </NFlex>
              </NFlex>

              <NFlex class="toolbar-actions">
                <NButton
                  v-if="selectedTag || searchKeyword || onlyCanBuy || ignoreGuard || sortOrder"
                  quaternary
                  size="medium"
                  @click="clearFilters"
                >
                  <template #icon>
                    <NIcon :component="Filter24Regular" />
                  </template>
                  重置筛选
                </NButton>
                <NButton
                  secondary
                  size="medium"
                  @click="refreshCurrentPoint"
                >
                  <template #icon>
                    <NIcon :component="ArrowSync24Regular" />
                  </template>
                  刷新积分
                </NButton>
              </NFlex>
            </NFlex>
          </NFlex>
        </div>
      </div>
    </NCard>

    <div
      v-if="useAuth.isAuthed"
      style="margin-top: 20px"
    />

    <!-- 礼物列表区域 -->
    <NSpin :show="isLoading">
      <NEmpty
        v-if="!isLoading && selectedItems.length === 0"
        :description="goods.length === 0 ? '当前没有可兑换的礼物哦~' : '没有找到符合筛选条件的礼物'"
      />
      <NGrid
        v-else
        class="goods-grid"
        cols="1 500:2 800:3 1100:4 1500:5"
        :x-gap="16"
        :y-gap="16"
      >
        <NGi
          v-for="item in selectedItems"
          :key="item.id"
        >
          <PointGoodsItem
            :goods="item"
            class="goods-item-card"
            :class="{ 'is-unavailable': getTooltip(item) !== '开始兑换' }"
          >
            <template #footer>
              <NFlex
                vertical
                :gap="12"
              >
                <NFlex
                  v-if="item.hasPurchased || !item.canPurchase"
                  :gap="4"
                  wrap
                >
                  <NTag
                    v-if="item.hasPurchased"
                    :type="item.isAllowRebuy ? 'info' : 'warning'"
                    size="tiny"
                    :bordered="false"
                    round
                  >
                    {{ item.isAllowRebuy ? `已兑换 ${item.purchasedCount} 次` : '已兑换' }}
                  </NTag>
                  <NTag
                    v-if="!item.canPurchase && item.cannotPurchaseReason"
                    type="error"
                    size="tiny"
                    :bordered="false"
                    round
                  >
                    {{ item.cannotPurchaseReason }}
                  </NTag>
                </NFlex>

                <NButton
                  block
                  :type="item.isPinned ? 'primary' : 'default'"
                  :secondary="!item.isPinned"
                  size="medium"
                  @click="onBuyClick(item)"
                >
                  {{ getTooltip(item) === '开始兑换' ? (item.isPinned ? '立即兑换' : '兑换') : '查看详情' }}
                </NButton>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGi>
      </NGrid>

      <NDivider v-if="selectedItems.length > 0" />
    </NSpin>

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

.header-card {
  margin-bottom: 24px;
}

.header-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.user-status-bar {
  padding: 4px 0;
}

.user-status-content,
.filter-controls,
.toolbar-actions,
.goods-grid {
  min-width: 0;
}

.goods-grid :deep(.n-grid-item) {
  min-width: 0;
}

.username {
  font-size: 1.1em;
}

.point-value {
  font-size: 1.1em;
}

.toolbar-section {
  padding: 8px 0;
}

.filter-label {
  font-weight: 500;
  white-space: nowrap;
}

.goods-item-card {
  height: 100%;
  transition: all 0.3s var(--vtsuru-bezier);
}

.is-unavailable {
  opacity: 0.8;
  filter: grayscale(0.2);
}

@media (max-width: 768px) {
  .user-status-bar,
  .toolbar-section {
    padding: 12px;
  }

  .user-status-content {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .account-actions {
    width: 100%;
    justify-content: flex-end;
  }

  .filter-controls,
  .toolbar-actions,
  .search-input,
  .sort-select {
    width: 100% !important;
  }

  .search-input,
  .sort-select {
    min-width: 0;
  }

  .filter-checks {
    width: 100%;
    justify-content: space-between;
    gap: 8px !important;
    flex-wrap: wrap;
  }

  .toolbar-actions {
    justify-content: flex-end;
  }
}
</style>
