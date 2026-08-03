<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { AddressInfo, ResponsePointGoodModel, ResponsePointOrder2UserModel, UserInfo } from '@/api/api-models'
import { GoodsTypes } from '@/api/api-models'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { POINT_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { NavigateToNewTab } from '@/shared/utils'
import { useBiliAuth } from '@/store/useBiliAuth'

interface AreaData {
  [province: string]: {
    [city: string]: {
      [district: string]: string[]
    }
  }
}

type BuySubItem = { subItemId: number; quantity: number }

const props = defineProps<{
  userInfo: UserInfo
}>()

const router = useRouter()
const toast = useToast()
const useAuth = useBiliAuth()
const biliAuth = computed(() => useAuth.biliAuth)

const isLoading = ref(false)
const goods = ref<ResponsePointGoodModel[]>([])
const currentPoint = ref(-1)
const currentGoods = ref<ResponsePointGoodModel>()
const currentAddress = ref<AddressInfo>()
const selectedAddressId = ref<string>()
const selectedSubItems = ref<BuySubItem[]>([])
const buyCount = ref(1)
const remark = ref('')
const userAgree = ref(false)
const showBuyModal = ref(false)
const showAddressModal = ref(false)
const showPurchaseConfirm = ref(false)
const showSuccessModal = ref(false)
const successfulOrder = ref<ResponsePointOrder2UserModel>()

const selectedTag = ref<string>()
const onlyCanBuy = ref(false)
const ignoreGuard = ref(false)
const sortOrder = ref<string | null>(null)
const searchKeyword = ref('')
const debouncedSearchKeyword = ref('')

const areas = usePersistedStorage<{
  createAt: number
  data: AreaData
}>('Data.Areas', { createAt: 0, data: {} })

const sortOptions = [
  { label: '默认排序', value: null },
  { label: '价格从低到高', value: 'price_asc' },
  { label: '价格从高到低', value: 'price_desc' },
  { label: '名称 A-Z', value: 'name_asc' },
  { label: '最近上架', value: 'recent' },
]

const hasSubItems = computed(() => (currentGoods.value?.subItems?.length ?? 0) > 0)
const selectedAddress = computed(() =>
  biliAuth.value.address?.find((address) => address.id === selectedAddressId.value),
)
const formattedCurrentPoint = computed(() =>
  currentPoint.value < 0 ? currentPoint.value : Number(currentPoint.value.toFixed(2)),
)
const currentRoomGuardLevel = computed(() => biliAuth.value.guardInfo?.[props.userInfo.id] ?? 0)
const currentRoomGuardLabel = computed(() => ['总督', '提督', '舰长'][currentRoomGuardLevel.value - 1] ?? '')
const addressOptions = computed(() =>
  (biliAuth.value.address ?? []).flatMap((address) =>
    address.id ? [{ label: `${address.name} · ${address.phone} · ${address.address}`, value: address.id }] : [],
  ),
)
const provinceOptions = computed(() => Object.keys(areas.value.data).map((value) => ({ label: value, value })))
const currentGoodsCost = computed(() => {
  if (!currentGoods.value || currentGoods.value.canFreeBuy) return 0
  if (!hasSubItems.value) return Number((currentGoods.value.price * (buyCount.value || 1)).toFixed(2))

  const subItems = new Map((currentGoods.value.subItems ?? []).map((item) => [item.id, item]))
  return Number(
    selectedSubItems.value
      .reduce((total, selection) => total + (subItems.get(selection.subItemId)?.price ?? 0) * selection.quantity, 0)
      .toFixed(2),
  )
})
const needAddress = computed(() => {
  if (!currentGoods.value) return false
  if (!hasSubItems.value) return currentGoods.value.type === GoodsTypes.Physical && !currentGoods.value.collectUrl

  const selectedIds = new Set(selectedSubItems.value.map((selection) => selection.subItemId))
  return (currentGoods.value.subItems ?? []).some(
    (item) => selectedIds.has(item.id) && item.type === GoodsTypes.Physical && !item.collectUrl,
  )
})
const canDoBuy = computed(() => {
  if (!currentGoods.value?.canPurchase) return false

  if (hasSubItems.value) {
    if (!selectedSubItems.value.length) return false
    const maxSelections = currentGoods.value.maxSubItemSelections
    if (maxSelections && selectedSubItems.value.length > maxSelections) return false

    const subItems = new Map((currentGoods.value.subItems ?? []).map((item) => [item.id, item]))
    const validSelection = selectedSubItems.value.every((selection) => {
      const item = subItems.get(selection.subItemId)
      return (
        !!item &&
        selection.quantity >= 1 &&
        Number.isInteger(selection.quantity) &&
        item.count !== 0 &&
        (item.count == null || selection.quantity <= item.count)
      )
    })
    return (
      validSelection &&
      (currentGoods.value.canFreeBuy || currentGoodsCost.value <= currentPoint.value) &&
      (!needAddress.value || !!selectedAddress.value)
    )
  }

  const totalCount = currentGoods.value.purchasedCount + buyCount.value
  return (
    totalCount <= (currentGoods.value.maxBuyCount ?? Number.MAX_VALUE) &&
    (currentGoods.value.canFreeBuy || currentGoodsCost.value <= currentPoint.value) &&
    (currentGoods.value.type !== GoodsTypes.Physical || !!currentGoods.value.collectUrl || !!selectedAddress.value)
  )
})
const tags = computed(() => Array.from(new Set(goods.value.flatMap((item) => item.tags))))
const selectedItems = computed(() => {
  const filteredItems = goods.value.filter((item) => {
    const keyword = debouncedSearchKeyword.value.toLowerCase()
    return (
      (!selectedTag.value || item.tags.includes(selectedTag.value)) &&
      (!onlyCanBuy.value || getBuyLabel(item) === '开始兑换') &&
      (!ignoreGuard.value || (item.allowGuardLevel ?? item.setting.allowGuardLevel) <= 0) &&
      (!keyword || item.name.toLowerCase().includes(keyword) || item.description.toLowerCase().includes(keyword))
    )
  })

  const comparators: Record<string, (left: ResponsePointGoodModel, right: ResponsePointGoodModel) => number> = {
    price_asc: (left, right) => left.price - right.price,
    price_desc: (left, right) => right.price - left.price,
    name_asc: (left, right) => left.name.localeCompare(right.name),
    recent: (left, right) => right.createAt - left.createAt,
  }
  const compare = sortOrder.value ? comparators[sortOrder.value] : undefined

  return filteredItems
    .map((item, index) => ({ item, index }))
    .toSorted((left, right) => {
      if (left.item.isPinned !== right.item.isPinned) return left.item.isPinned ? -1 : 1
      return (compare?.(left.item, right.item) ?? 0) || left.index - right.index
    })
    .map(({ item }) => item)
})
const purchaseSummary = computed(() => {
  if (!currentGoods.value) return ''
  if (!hasSubItems.value) return `${buyCount.value} 个「${currentGoods.value.name}」`

  const subItems = new Map((currentGoods.value.subItems ?? []).map((item) => [item.id, item]))
  return selectedSubItems.value
    .map((selection) => `${subItems.get(selection.subItemId)?.name ?? selection.subItemId} × ${selection.quantity}`)
    .join('、')
})
const successfulSubItems = computed(() => successfulOrder.value?.selectedSubItems ?? [])
const successfulKeys = computed(() =>
  successfulSubItems.value
    .flatMap((item) => item.assignedVirtualKeys.map((key) => `${item.nameSnapshot}: ${key}`))
    .join('\n'),
)

const updateSearch = useDebounceFn((value: string) => {
  debouncedSearchKeyword.value = value
}, 300)

watch(searchKeyword, updateSearch)

function cityOptions(province: string) {
  return Object.keys(areas.value.data[province] ?? {}).map((value) => ({ label: value, value }))
}

function districtOptions(province: string, city: string) {
  return Object.keys(areas.value.data[province]?.[city] ?? {}).map((value) => ({ label: value, value }))
}

function streetOptions(province: string, city: string, district: string) {
  return (areas.value.data[province]?.[city]?.[district] ?? []).map((value) => ({ label: value, value }))
}

function isSubItemChecked(id: number) {
  return selectedSubItems.value.some((item) => item.subItemId === id)
}

function toggleSubItem(id: number, checked: boolean) {
  if (checked) {
    const maximum = currentGoods.value?.maxSubItemSelections
    if (maximum && selectedSubItems.value.length >= maximum) {
      toast.add({ title: `最多只能选择 ${maximum} 种子商品`, color: 'warning' })
      return
    }
    selectedSubItems.value = [...selectedSubItems.value, { subItemId: id, quantity: 1 }]
    return
  }

  selectedSubItems.value = selectedSubItems.value.filter((item) => item.subItemId !== id)
}

function updateSubItemQuantity(id: number, value: number | undefined) {
  selectedSubItems.value = selectedSubItems.value.map((item) =>
    item.subItemId === id ? { ...item, quantity: Number(value ?? 1) } : item,
  )
}

function getBuyLabel(item: ResponsePointGoodModel) {
  if (!item.canPurchase && item.cannotPurchaseReason) return item.cannotPurchaseReason
  if (!biliAuth.value.id) return '请先进行账号认证'

  const subItems = item.subItems ?? []
  if (subItems.length) {
    const available = subItems.filter((subItem) => subItem.count == null || subItem.count > 0)
    if (!available.length) return '库存不足'
    const minimum = Math.min(...available.map((subItem) => subItem.price))
    if (currentPoint.value < minimum && !item.canFreeBuy) return `积分不足（最低需要 ${minimum}）`
    return '开始兑换'
  }

  if (item.count !== undefined && item.count <= 0) return '库存不足'
  if (!item.isAllowRebuy && item.hasPurchased) return '该礼物不允许重复兑换'
  if (item.purchasedCount >= (item.maxBuyCount ?? Number.MAX_VALUE)) return `已达兑换上限（${item.maxBuyCount}）`
  if (currentPoint.value < item.price && !item.canFreeBuy) return `积分不足（需要 ${item.price}）`
  return '开始兑换'
}

function resetBuyModalState() {
  showBuyModal.value = false
  showPurchaseConfirm.value = false
  selectedAddressId.value = undefined
  selectedSubItems.value = []
  buyCount.value = 1
  remark.value = ''
  currentGoods.value = undefined
}

function onBuyClick(goodsItem: ResponsePointGoodModel) {
  currentGoods.value = goodsItem
  showBuyModal.value = true
}

function clearFilters() {
  selectedTag.value = undefined
  searchKeyword.value = ''
  onlyCanBuy.value = false
  ignoreGuard.value = false
  sortOrder.value = null
}

function validatePurchase() {
  if (!currentGoods.value?.canPurchase) {
    toast.add({ title: currentGoods.value?.cannotPurchaseReason || '无法兑换该礼物', color: 'error' })
    return false
  }
  if (!canDoBuy.value) {
    toast.add({
      title: needAddress.value && !selectedAddress.value ? '请选择收货地址' : '兑换条件未满足',
      color: 'error',
    })
    return false
  }
  return true
}

function startPurchase() {
  if (validatePurchase()) showPurchaseConfirm.value = true
}

async function executePurchase() {
  if (!currentGoods.value || !validatePurchase()) return

  try {
    isLoading.value = true
    const count = hasSubItems.value
      ? selectedSubItems.value.reduce((total, item) => total + item.quantity, 0)
      : buyCount.value
    const result = await useAuth.QueryBiliAuthPostAPI<ResponsePointOrder2UserModel>(`${POINT_API_URL}buy`, {
      vId: props.userInfo.id,
      goodsId: currentGoods.value.id,
      count,
      addressId: selectedAddress.value?.id ?? null,
      remark: remark.value,
      ...(hasSubItems.value ? { selectedSubItems: selectedSubItems.value } : {}),
    })
    if (result.code !== 200) throw new Error(result.message || '兑换失败')

    successfulOrder.value = result.data
    showPurchaseConfirm.value = false
    showBuyModal.value = false
    showSuccessModal.value = true
    toast.add({ title: '兑换成功', color: 'success' })
    void refreshCurrentPoint()
    goods.value = await useAuth.GetGoods(props.userInfo.id)
  } catch (error) {
    console.error('Buy error:', error)
    toast.add({ title: error instanceof Error ? error.message : '兑换失败', color: 'error' })
  } finally {
    isLoading.value = false
  }
}

function openAddressModal() {
  currentAddress.value = { province: '', city: '', district: '', street: '', address: '', phone: 0, name: '' }
  userAgree.value = false
  showAddressModal.value = true
  void getArea()
}

function onAreaSelectChange(level: number) {
  if (!currentAddress.value) return
  if (level === 0) {
    currentAddress.value.city = undefined
    currentAddress.value.district = undefined
    currentAddress.value.street = undefined
  }
  if (level === 1) {
    currentAddress.value.district = undefined
    currentAddress.value.street = undefined
  }
  if (level === 2) currentAddress.value.street = undefined
}

async function saveAddress() {
  const address = currentAddress.value
  if (!address?.province || !address.city || !address.district || !address.address || !address.phone || !address.name) {
    toast.add({ title: '请完整填写收货地址', color: 'error' })
    return
  }

  try {
    isLoading.value = true
    const result = await useAuth.QueryBiliAuthPostAPI<AddressInfo>(`${POINT_API_URL}user/update-address`, address)
    if (result.code !== 200) throw new Error(result.message || '保存失败')

    const addressList = biliAuth.value.address ?? []
    const index = addressList.findIndex((item) => item.id === result.data.id)
    if (index >= 0) addressList.splice(index, 1, result.data)
    else addressList.push(result.data)
    biliAuth.value.address = addressList
    selectedAddressId.value = result.data.id
    showAddressModal.value = false
    toast.add({ title: '地址已保存', color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : '保存失败', color: 'error' })
  } finally {
    isLoading.value = false
  }
}

async function refreshCurrentPoint() {
  if (!useAuth.isAuthed || !biliAuth.value.id) return
  try {
    currentPoint.value = (await useAuth.GetSpecificPoint(props.userInfo.id)) ?? -1
  } catch {
    currentPoint.value = -1
  }
}

async function refreshAddressList() {
  if (!useAuth.isAuthed || !biliAuth.value.id) return
  await useAuth.getAuthInfo()
}

async function getArea() {
  if (Date.now() - areas.value.createAt < 1000 * 60 * 60 * 24 * 7) return
  const response = await fetch('https://oss.suki.club/vtsuru/area_data.json')
  if (response.ok) areas.value = { createAt: Date.now(), data: await response.json() }
}

function closeSuccessModal() {
  showSuccessModal.value = false
  successfulOrder.value = undefined
  resetBuyModalState()
}

function goToOrders() {
  closeSuccessModal()
  router.push({ name: 'bili-user-orders' })
}

onMounted(async () => {
  try {
    isLoading.value = true
    if (useAuth.isAuthed && !biliAuth.value.id) await useAuth.getAuthInfo()
    await refreshCurrentPoint()
    goods.value = await useAuth.GetGoods(props.userInfo.id)
  } catch (error) {
    console.error('Error loading initial data:', error)
    toast.add({ title: '加载数据时出错', color: 'error' })
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="point-goods-container">
    <UAlert
      v-if="!useAuth.isAuthed"
      color="warning"
      icon="i-lucide-shield-alert"
      title="需要认证"
      class="mb-4"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <span>你尚未进行 Bilibili 账号认证，可先浏览礼物，认证后可查看积分并兑换。</span>
        <UButton
          size="sm"
          to="/bili-auth"
        >
          立即认证
        </UButton>
      </div>
    </UAlert>

    <UCard
      v-if="useAuth.isAuthed"
      class="header-card"
      :ui="{ body: 'p-4 sm:p-5' }"
    >
      <div class="header-container">
        <div class="user-status-content">
          <div class="flex min-w-0 flex-wrap items-center gap-3">
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-user-round"
                class="size-5 text-primary"
              />
              <strong class="username">{{ biliAuth.name }}</strong>
              <UBadge
                v-if="currentRoomGuardLevel > 0"
                color="warning"
                variant="soft"
                size="xs"
              >
                ⚓ {{ currentRoomGuardLabel }}
              </UBadge>
            </div>
            <USeparator orientation="vertical" />
            <div class="flex items-baseline gap-2">
              <span class="text-sm text-(--vtsuru-fg-muted)">当前积分</span>
              <strong
                v-if="currentPoint >= 0"
                class="point-value"
                >{{ formattedCurrentPoint }}</strong
              >
              <span
                v-else
                class="text-sm text-(--vtsuru-fg-muted)"
                >加载中…</span
              >
            </div>
          </div>
          <div class="account-actions">
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-circle-user-round"
              @click="NavigateToNewTab('/bili-user/points')"
            >
              账号中心
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-refresh-cw"
              @click="NavigateToNewTab('/bili-user/settings')"
            >
              切换账号
            </UButton>
          </div>
        </div>

        <USeparator />

        <div class="toolbar-section">
          <div
            v-if="tags.length"
            class="flex flex-wrap items-center gap-2"
          >
            <span class="filter-label">分类</span>
            <UButton
              v-for="tag in tags"
              :key="tag"
              size="xs"
              :color="tag === selectedTag ? 'primary' : 'neutral'"
              :variant="tag === selectedTag ? 'solid' : 'soft'"
              @click="selectedTag = selectedTag === tag ? undefined : tag"
            >
              {{ tag }}
            </UButton>
          </div>

          <div class="toolbar-row">
            <div class="filter-controls">
              <UInput
                v-model="searchKeyword"
                class="search-input"
                icon="i-lucide-search"
                placeholder="搜索礼物名称…"
              />
              <USelectMenu
                v-model="sortOrder"
                class="sort-select"
                :items="sortOptions"
                value-key="value"
              />
              <div class="filter-checks">
                <UCheckbox
                  v-model="onlyCanBuy"
                  label="仅显示可兑换"
                />
                <UCheckbox
                  v-model="ignoreGuard"
                  label="只看非等级专属"
                />
              </div>
            </div>
            <div class="toolbar-actions">
              <UButton
                v-if="selectedTag || searchKeyword || onlyCanBuy || ignoreGuard || sortOrder"
                color="neutral"
                variant="ghost"
                size="sm"
                icon="i-lucide-filter-x"
                @click="clearFilters"
              >
                重置筛选
              </UButton>
              <UButton
                color="neutral"
                variant="soft"
                size="sm"
                icon="i-lucide-refresh-cw"
                @click="refreshCurrentPoint"
              >
                刷新积分
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </UCard>

    <div class="goods-list-container">
      <div
        v-if="isLoading"
        class="loading-state"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="size-5 animate-spin"
        />
        正在加载礼物…
      </div>
      <UEmpty
        v-else-if="!selectedItems.length"
        icon="i-lucide-package-open"
        :description="goods.length ? '没有找到符合筛选条件的礼物' : '当前没有可兑换的礼物哦'"
      />
      <div
        v-else
        class="goods-grid"
      >
        <PointGoodsItem
          v-for="item in selectedItems"
          :key="item.id"
          :goods="item"
          class="goods-item-card"
          :class="{ 'is-unavailable': getBuyLabel(item) !== '开始兑换' }"
        >
          <template #footer>
            <div class="flex flex-col gap-3">
              <div
                v-if="item.hasPurchased || !item.canPurchase"
                class="flex flex-wrap gap-1"
              >
                <UBadge
                  v-if="item.hasPurchased"
                  :color="item.isAllowRebuy ? 'info' : 'warning'"
                  variant="soft"
                  size="xs"
                >
                  {{ item.isAllowRebuy ? `已兑换 ${item.purchasedCount} 次` : '已兑换' }}
                </UBadge>
                <UBadge
                  v-if="!item.canPurchase && item.cannotPurchaseReason"
                  color="error"
                  variant="soft"
                  size="xs"
                >
                  {{ item.cannotPurchaseReason }}
                </UBadge>
              </div>
              <UButton
                block
                :color="item.isPinned ? 'primary' : 'neutral'"
                :variant="item.isPinned ? 'solid' : 'soft'"
                @click="onBuyClick(item)"
              >
                {{ getBuyLabel(item) === '开始兑换' ? (item.isPinned ? '立即兑换' : '兑换') : '查看详情' }}
              </UButton>
            </div>
          </template>
        </PointGoodsItem>
      </div>
    </div>

    <UModal
      v-if="currentGoods"
      v-model:open="showBuyModal"
      :title="currentGoods.name"
      :ui="{ content: 'sm:max-w-xl' }"
      @update:open="(open) => !open && resetBuyModalState()"
    >
      <template #body>
        <div class="buy-modal-body">
          <div class="flex items-center justify-between gap-3">
            <UBadge
              :color="currentGoods.type === GoodsTypes.Physical ? 'success' : 'info'"
              variant="soft"
            >
              {{ currentGoods.type === GoodsTypes.Physical ? '实体礼物' : '虚拟物品' }}
            </UBadge>
          </div>
          <PointGoodsItem
            :goods="currentGoods"
            content-style="height: auto; border: none; box-shadow: none;"
          />
          <UAlert
            v-if="currentGoods.soldCount"
            color="info"
            title="已售信息"
          >
            此礼物已被兑换 <strong>{{ currentGoods.soldCount }}</strong> 次
          </UAlert>
          <UAlert
            v-if="currentGoods.hasPurchased"
            :color="currentGoods.isAllowRebuy ? 'info' : 'warning'"
            :title="currentGoods.isAllowRebuy ? '购买记录' : '重要提示'"
          >
            你已兑换过此礼物 <strong>{{ currentGoods.purchasedCount }}</strong> 次
            <template v-if="!currentGoods.isAllowRebuy">，该礼物不允许重复兑换</template>
            <template v-else-if="currentGoods.maxBuyCount">
              ，最多可兑换 <strong>{{ currentGoods.maxBuyCount }}</strong> 次
            </template>
          </UAlert>

          <div v-if="hasSubItems">
            <label class="field-label">选择款式</label>
            <div class="sub-items">
              <div
                v-for="subItem in currentGoods.subItems ?? []"
                :key="subItem.id"
                class="sub-item-card"
                :class="{ active: isSubItemChecked(subItem.id), disabled: subItem.count === 0 }"
                @click="subItem.count !== 0 && toggleSubItem(subItem.id, !isSubItemChecked(subItem.id))"
              >
                <div class="flex min-w-0 items-center gap-3">
                  <UCheckbox
                    :model-value="isSubItemChecked(subItem.id)"
                    :disabled="subItem.count === 0"
                    @click.stop
                    @update:model-value="(checked) => toggleSubItem(subItem.id, Boolean(checked))"
                  />
                  <img
                    v-if="subItem.cover?.path"
                    :src="subItem.cover.path"
                    :alt="subItem.name"
                    class="sub-item-cover"
                  />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <strong :class="{ 'text-(--vtsuru-fg-muted)': subItem.count === 0 }">{{ subItem.name }}</strong>
                      <UBadge
                        color="primary"
                        variant="soft"
                        size="xs"
                      >
                        {{ subItem.price }} 积分
                      </UBadge>
                    </div>
                    <p
                      v-if="subItem.description"
                      class="sub-item-description"
                    >
                      {{ subItem.description }}
                    </p>
                    <p class="sub-item-description">
                      {{ subItem.count == null ? '库存不限' : subItem.count ? `库存 ${subItem.count}` : '缺货' }}
                    </p>
                  </div>
                </div>
                <UInputNumber
                  v-if="isSubItemChecked(subItem.id)"
                  :model-value="selectedSubItems.find((item) => item.subItemId === subItem.id)?.quantity ?? 1"
                  :min="1"
                  :max="Math.min(subItem.maxBuyCount ?? 100000, subItem.count ?? 100000)"
                  :step="1"
                  class="sub-item-quantity"
                  @click.stop
                  @update:model-value="(value) => updateSubItemQuantity(subItem.id, value)"
                />
              </div>
            </div>
            <p class="field-hint">
              可多选，价格按所选款式累计计算
              <template v-if="currentGoods.maxSubItemSelections"
                >（最多选 {{ currentGoods.maxSubItemSelections }} 种）</template
              >
            </p>
          </div>

          <div v-else>
            <label class="field-label">兑换数量</label>
            <div class="flex flex-wrap items-center gap-3">
              <UInputNumber
                v-model="buyCount"
                :min="1"
                :max="
                  Math.min(
                    currentGoods.maxBuyCount ?? 100000,
                    (currentGoods.maxBuyCount ?? 100000) - currentGoods.purchasedCount,
                  )
                "
                :step="1"
                class="w-36"
              />
              <span class="field-hint">
                {{
                  currentGoods.hasPurchased
                    ? `已兑换 ${currentGoods.purchasedCount} / ${currentGoods.maxBuyCount ?? '∞'}`
                    : `库存：${currentGoods.count ?? '无限'}`
                }}
              </span>
            </div>
          </div>

          <div v-if="needAddress">
            <label class="field-label">收货地址</label>
            <div class="flex gap-2">
              <USelectMenu
                v-model="selectedAddressId"
                :items="addressOptions"
                value-key="value"
                placeholder="请选择收货地址"
                class="min-w-0 flex-1"
              />
              <UButton
                color="primary"
                variant="soft"
                icon="i-lucide-plus"
                square
                aria-label="新增地址"
                @click="openAddressModal"
              />
              <UButton
                color="neutral"
                variant="soft"
                icon="i-lucide-refresh-cw"
                square
                aria-label="刷新地址"
                @click="refreshAddressList"
              />
            </div>
            <p class="field-hint">
              可前往
              <UButton
                color="primary"
                variant="link"
                size="xs"
                @click="NavigateToNewTab('/bili-user/settings')"
              >
                账号设置
              </UButton>
              管理地址
            </p>
          </div>

          <div>
            <label class="field-label">备注信息</label>
            <UTextarea
              v-model="remark"
              placeholder="如有特殊需求请留言（可选）"
              :rows="3"
              :maxlength="100"
            />
          </div>
        </div>
      </template>
      <template #footer>
        <div class="buy-modal-footer">
          <div>
            <span class="field-hint">总计花费</span>
            <strong class="cost-value">{{ currentGoodsCost }}</strong>
            <span class="field-hint">积分</span>
            <p class="field-hint">当前持有：{{ currentPoint >= 0 ? formattedCurrentPoint : '--' }}</p>
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="soft"
              @click="resetBuyModalState"
            >
              取消
            </UButton>
            <UButton
              :disabled="!canDoBuy"
              :loading="isLoading"
              @click="startPurchase"
            >
              确认兑换
            </UButton>
          </div>
        </div>
        <p
          v-if="!canDoBuy && (currentGoods.cannotPurchaseReason || currentGoodsCost > currentPoint)"
          class="purchase-error"
        >
          {{ currentGoods.cannotPurchaseReason || '积分不足或条件不满足' }}
        </p>
      </template>
    </UModal>

    <UModal
      v-model:open="showAddressModal"
      title="收货地址"
      :ui="{ content: 'sm:max-w-2xl' }"
    >
      <template #body>
        <div
          v-if="currentAddress"
          class="address-form"
        >
          <div>
            <label class="field-label">地区选择</label>
            <div class="area-fields">
              <USelectMenu
                v-model="currentAddress.province"
                :items="provinceOptions"
                value-key="value"
                placeholder="省"
                @update:model-value="onAreaSelectChange(0)"
              />
              <USelectMenu
                v-model="currentAddress.city"
                :items="cityOptions(currentAddress.province)"
                value-key="value"
                placeholder="市"
                :disabled="!currentAddress.province"
                @update:model-value="onAreaSelectChange(1)"
              />
              <USelectMenu
                v-model="currentAddress.district"
                :items="districtOptions(currentAddress.province, currentAddress.city ?? '')"
                value-key="value"
                placeholder="区"
                :disabled="!currentAddress.city"
                @update:model-value="onAreaSelectChange(2)"
              />
              <USelectMenu
                v-model="currentAddress.street"
                :items="
                  streetOptions(currentAddress.province, currentAddress.city ?? '', currentAddress.district ?? '')
                "
                value-key="value"
                placeholder="街道"
                :disabled="!currentAddress.district"
              />
            </div>
          </div>
          <div>
            <label class="field-label">详细地址</label>
            <UTextarea
              v-model="currentAddress.address"
              :rows="3"
              placeholder="请输入详细地址（楼栋号、单元号、门牌号等）"
            />
          </div>
          <div class="contact-fields">
            <div>
              <label class="field-label">联系电话</label>
              <UInputNumber
                v-model="currentAddress.phone"
                :min="0"
                placeholder="请输入联系电话"
                class="w-full"
              />
            </div>
            <div>
              <label class="field-label">联系人</label>
              <UInput
                v-model="currentAddress.name"
                placeholder="请输入联系人姓名"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="showAddressModal = false"
          >
            取消
          </UButton>
          <UButton
            :loading="isLoading"
            @click="saveAddress"
          >
            保存
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showPurchaseConfirm"
      title="确认兑换"
      :ui="{ content: 'sm:max-w-md' }"
    >
      <template #body>
        <p>确定要花费 {{ currentGoodsCost }} 积分兑换 {{ purchaseSummary }} 吗？</p>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="showPurchaseConfirm = false"
          >
            取消
          </UButton>
          <UButton
            :loading="isLoading"
            @click="executePurchase"
          >
            确定兑换
          </UButton>
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="showSuccessModal"
      title="兑换成功"
      :ui="{ content: 'sm:max-w-md' }"
      @update:open="(open) => !open && closeSuccessModal()"
    >
      <template #body>
        <div class="success-content">
          <p>兑换成功，订单号：{{ successfulOrder?.id }}</p>
          <template v-if="successfulSubItems.length">
            <USeparator label="已选款式" />
            <p>{{ successfulSubItems.map((item) => `${item.nameSnapshot} × ${item.quantity}`).join('、') }}</p>
          </template>
          <template v-if="successfulKeys">
            <USeparator label="密钥" />
            <UAlert color="success">
              <pre class="success-details">{{ successfulKeys }}</pre>
            </UAlert>
          </template>
          <template v-if="successfulOrder?.type === GoodsTypes.Virtual && successfulOrder.goods.content">
            <USeparator label="礼物内容" />
            <UAlert color="success">
              <pre class="success-details">{{ successfulOrder.goods.content }}</pre>
            </UAlert>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="soft"
            @click="closeSuccessModal"
          >
            关闭
          </UButton>
          <UButton @click="goToOrders"> 前往查看 </UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style scoped>
.point-goods-container,
.header-container,
.buy-modal-body,
.address-form,
.success-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}

.header-card {
  margin-bottom: 20px;
}

.user-status-content,
.toolbar-row,
.filter-controls,
.toolbar-actions,
.account-actions,
.buy-modal-footer,
.contact-fields,
.area-fields {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-status-content,
.toolbar-row,
.buy-modal-footer {
  justify-content: space-between;
}

.toolbar-row,
.filter-controls,
.filter-checks,
.toolbar-actions {
  flex-wrap: wrap;
}

.filter-controls {
  flex: 1;
}

.filter-checks {
  display: flex;
  gap: 12px;
}

.search-input {
  width: 240px;
}

.sort-select {
  width: 160px;
}

.username,
.point-value {
  font-size: 1.05rem;
}

.point-value,
.cost-value {
  color: var(--vtsuru-primary);
  font-size: 1.25rem;
  margin: 0 6px;
}

.filter-label,
.field-label {
  color: var(--vtsuru-fg-muted);
  font-size: 0.875rem;
  font-weight: 600;
}

.goods-list-container {
  min-height: 200px;
}

.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 240px;
  color: var(--vtsuru-fg-muted);
}

.goods-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.goods-item-card {
  height: 100%;
  transition: opacity 0.2s ease;
}

.is-unavailable {
  opacity: 0.78;
}

.sub-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sub-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  cursor: pointer;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease;
}

.sub-item-card:hover:not(.disabled),
.sub-item-card.active {
  border-color: var(--vtsuru-primary);
  background: var(--vtsuru-brand-soft);
}

.sub-item-card.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.sub-item-cover {
  width: 48px;
  height: 48px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 6px;
  object-fit: cover;
}

.sub-item-quantity {
  width: 104px;
}

.sub-item-description,
.field-hint,
.purchase-error {
  margin: 4px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 0.8125rem;
}

.purchase-error {
  color: var(--ui-error);
  text-align: right;
}

.area-fields > * {
  flex: 1 1 120px;
}

.contact-fields > * {
  flex: 1;
}

.success-details {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font: inherit;
}

@media (max-width: 768px) {
  .user-status-content,
  .toolbar-row,
  .buy-modal-footer {
    align-items: flex-start;
    flex-direction: column;
  }

  .account-actions,
  .toolbar-actions,
  .filter-controls,
  .search-input,
  .sort-select {
    width: 100%;
  }

  .account-actions,
  .toolbar-actions {
    justify-content: flex-end;
  }

  .contact-fields {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
