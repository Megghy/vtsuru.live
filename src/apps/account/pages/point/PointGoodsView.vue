<script setup lang="ts">
import type {
  SelectOption,
} from 'naive-ui'
// 移除未使用的 useAccount
import type {
  AddressInfo,
  ResponsePointGoodModel,
  ResponsePointOrder2UserModel,
  UserInfo,
} from '@/api/api-models'
import { useDebounceFn } from '@vueuse/core'
import { ArrowSync24Regular, Search24Regular, Filter24Regular, Person24Regular } from '@vicons/fluent'
import {
  NAlert, NButton, NCard, NCheckbox, NDivider, NEmpty, NFlex, NForm, NFormItem, NGi, NGrid, NIcon, NImage, NInput, NInputNumber, NModal, NScrollbar, NSelect, NSpin, NTag, NText, useDialog, useMessage } from 'naive-ui';
import { computed, h, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  GoodsTypes,
} from '@/api/api-models'
import AddressDisplay from '@/shared/components/points/AddressDisplay.vue'
import PointGoodsItem from '@/shared/components/points/PointGoodsItem.vue'
import { POINT_API_URL } from '@/shared/config'
import { useBiliAuth } from '@/store/useBiliAuth'
import { NavigateToNewTab } from '@/shared/utils'

// 移除未使用的 biliInfo prop
const props = defineProps<{
  userInfo: UserInfo
}>()
const router = useRouter()

const useAuth = useBiliAuth()
// 移除未使用的 accountInfo
const isLoading = ref(false)
const message = useMessage()
const dialog = useDialog()
const biliAuth = computed(() => useAuth.biliAuth)

// --- 响应式状态 ---
const goods = ref<ResponsePointGoodModel[]>([]) // 礼物列表
const currentPoint = ref<number>(-1) // 当前用户积分

// 购买模态框相关状态
const showBuyModal = ref(false)
const showAddressSelect = ref(false)
const currentGoods = ref<ResponsePointGoodModel>() // 当前选中的礼物
const buyCount = ref(1) // 购买数量
const selectedAddress = ref<AddressInfo>() // 选中的地址
const remark = ref('') // 新增：用于存储用户备注
type BuySubItem = { subItemId: number, quantity: number }
const selectedSubItems = ref<BuySubItem[]>([]) // 选中的子选项（可多选）

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

const currentGoodsCost = computed(() => {
  if (!currentGoods.value) return 0
  
  // 如果标记为免费，直接返回 0
  if (currentGoods.value.canFreeBuy) return 0

  // 子选项模式：按子选项的最终价累加
  if (hasSubItems.value) {
    // 建立 ID 到子项的映射，使用 String 键处理可能的类型不一致
    const subMap = new Map((currentGoods.value.subItems ?? []).map(s => [String(s.id), s]))
    const sum = selectedSubItems.value.reduce((acc, s) => {
      const sub = subMap.get(String(s.subItemId))
      if (!sub) return acc
      return acc + (Number(sub.price) || 0) * (Number(s.quantity) || 0)
    }, 0)
    return Number(sum.toFixed(2))
  }

  // 旧模式：按父商品价格 * 数量
  const unitPrice = currentGoods.value.price <= 0 ? 0 : currentGoods.value.price
  return Number((unitPrice * (buyCount.value || 1)).toFixed(2))
})

const hasSubItems = computed(() => (currentGoods.value?.subItems?.length ?? 0) > 0)

const needAddress = computed(() => {
  if (!currentGoods.value) return false
  if (!hasSubItems.value) return currentGoods.value.type === GoodsTypes.Physical && !currentGoods.value.collectUrl

  const selectedIds = new Set(selectedSubItems.value.map(s => String(s.subItemId)))
  return (currentGoods.value.subItems ?? []).some(s =>
    selectedIds.has(String(s.id))
    && s.type === GoodsTypes.Physical
    && !s.collectUrl,
  )
})

function isSubItemChecked(id: number) {
  return selectedSubItems.value.some(s => String(s.subItemId) === String(id))
}

function toggleSubItem(id: number, checked: boolean) {
  const targetId = Number(id)
  if (checked) {
    const maxSelections = currentGoods.value?.maxSubItemSelections
    if (maxSelections && maxSelections > 0 && selectedSubItems.value.length >= maxSelections) {
      message.warning(`最多只能选择 ${maxSelections} 种子商品`)
      return
    }
    if (!selectedSubItems.value.some(s => Number(s.subItemId) === targetId)) {
      // 使用赋值操作触发响应式
      selectedSubItems.value = [...selectedSubItems.value, { subItemId: targetId, quantity: 1 }]
    }
  } else {
    selectedSubItems.value = selectedSubItems.value.filter(s => Number(s.subItemId) !== targetId)
  }
}

function updateSubItemQuantity(id: number, quantity: number | null) {
  const targetId = Number(id)
  const q = Number(quantity ?? 1)
  selectedSubItems.value = selectedSubItems.value.map(s => {
    if (Number(s.subItemId) === targetId) {
      return { ...s, quantity: q }
    }
    return s
  })
}

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

// 地址选项，用于地址选择器
const addressOptions = computed(() => {
  if (!biliAuth.value.id) return []
  return (
    biliAuth.value.address?.map(item => ({
      label: item.address, // 使用地址作为标签
      value: item.id, // 使用地址ID作为值
    })) ?? []
  )
})

// 判断是否可以执行购买操作
const canDoBuy = computed(() => {
  if (!currentGoods.value) return false

  // 优先使用后端返回的购买状态
  if (!currentGoods.value.canPurchase) return false

  // 子选项模式：必须先选择子选项
  if (hasSubItems.value) {
    if (selectedSubItems.value.length === 0) return false
    const maxSelections = currentGoods.value.maxSubItemSelections
    if (maxSelections && maxSelections > 0 && selectedSubItems.value.length > maxSelections) return false
    if (selectedSubItems.value.some(s => s.quantity < 1 || !Number.isInteger(s.quantity))) return false

    const subMap = new Map((currentGoods.value.subItems ?? []).map(s => [String(s.id), s]))
    // 简单库存校验（后端仍会强校验）
    for (const s of selectedSubItems.value) {
      const sub = subMap.get(String(s.subItemId))
      if (!sub) return false
      if (sub.count === 0) return false
      if (sub.count != null && s.quantity > sub.count) return false
    }

    const pointCheck = currentGoods.value.canFreeBuy || currentGoodsCost.value <= currentPoint.value
    const addressCheck = !needAddress.value || !!selectedAddress.value
    return pointCheck && addressCheck
  }

  // 旧模式：按父商品数量购买
  const totalCount = (currentGoods.value.purchasedCount ?? 0) + buyCount.value
  if (totalCount > (currentGoods.value.maxBuyCount ?? Number.MAX_VALUE)) return false

  // 检查积分是否足够
  const pointCheck = currentGoods.value.canFreeBuy || currentGoodsCost.value <= currentPoint.value

  // 如果是实物礼物且没有外部收集链接，则必须选择地址
  const addressCheck
    = currentGoods.value.type !== GoodsTypes.Physical
      || currentGoods.value.collectUrl
      || !!selectedAddress.value

  return pointCheck && addressCheck
})

// 礼物标签列表
const tags = computed(() => {
  return Array.from(new Set(goods.value.flatMap(g => g.tags)))
})

// 经过筛选和排序后的礼物列表
const selectedItems = computed(() => {
  let filteredItems = goods.value
    // 标签筛选
    .filter(item => !selectedTag.value || item.tags.includes(selectedTag.value))
    // 可兑换筛选 (只显示 getTooltip 返回 '开始兑换' 的礼物)
    .filter(item => !onlyCanBuy.value || getTooltip(item) === '开始兑换')
    // 舰长等级筛选 (只显示允许所有等级或忽略舰长限制的礼物)
    .filter(item => !ignoreGuard.value || item.allowGuardLevel === 0)
    // 关键词搜索 (匹配名称或描述)
    .filter(
      item =>
        !debouncedSearchKeyword.value
        || item.name.toLowerCase().includes(debouncedSearchKeyword.value.toLowerCase())
        || (item.description && item.description.toLowerCase().includes(debouncedSearchKeyword.value.toLowerCase())),
    )

  // 应用排序方式
  if (sortOrder.value) {
    switch (sortOrder.value) {
      case 'price_asc':
        filteredItems = filteredItems.sort((a, b) => a.price - b.price)
        break
      case 'price_desc':
        filteredItems = filteredItems.sort((a, b) => b.price - a.price)
        break
      case 'name_asc':
        filteredItems = filteredItems.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name_desc':
        filteredItems = filteredItems.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'type':
        filteredItems = filteredItems.sort((a, b) => a.type - b.type)
        break
      case 'popular':
        // 按照热门程度排序（置顶的排在前面）
        filteredItems = filteredItems.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1
          if (!a.isPinned && b.isPinned) return 1
          return 0
        })
        break
    }
  }

  // 无论是否有其他排序，置顶礼物始终排在前面
  return filteredItems.sort((a, b) => {
    // 先按置顶状态排序
    if (a.isPinned && !b.isPinned) return -1
    if (!a.isPinned && b.isPinned) return 1
    // 如果已有排序方式，则不再进行额外排序
    if (sortOrder.value) return 0
    // 默认排序逻辑
    return 0
  })
})

// --- 方法 ---

// 获取礼物兑换按钮的提示文本
function getTooltip(goods: ResponsePointGoodModel): string {
  // 优先使用后端返回的购买状态信息
  if (!goods.canPurchase && goods.cannotPurchaseReason) {
    return goods.cannotPurchaseReason
  }

  // 后备检查逻辑
  if (!biliAuth.value.id) return '请先进行账号认证'

  const hasSubs = (goods.subItems?.length ?? 0) > 0
  if (hasSubs) {
    const available = (goods.subItems ?? []).filter(s => s.count == null || s.count > 0)
    if (!available.length) return '库存不足'
    const minPrice = Math.min(...available.map(s => Number(s.price)))
    if ((currentPoint.value ?? 0) < minPrice && !goods.canFreeBuy) return `积分不足(最低需要${minPrice}, 当前${currentPoint.value ?? 0})`
  } else {
    if ((goods?.count ?? Number.MAX_VALUE) <= 0) return '库存不足'
    if (!goods.isAllowRebuy && goods.hasPurchased) return '该礼物不允许重复兑换'
    if (goods.purchasedCount >= (goods.maxBuyCount ?? Number.MAX_VALUE)) return `已达兑换上限(${goods.maxBuyCount})`
    if ((currentPoint.value ?? 0) < goods.price && !goods.canFreeBuy) return `积分不足(需要${goods.price}, 当前${currentPoint.value ?? 0})`
  }

  // 检查舰长等级要求
  const currentGuardLevel = biliAuth.value.guardInfo?.[props.userInfo.id] ?? 0
  if (goods.allowGuardLevel > 0 && currentGuardLevel < goods.allowGuardLevel) {
    const needText = goods.allowGuardLevel === 1 ? '总督' : goods.allowGuardLevel === 2 ? '提督' : '舰长'
    const curText = currentGuardLevel === 1 ? '总督' : currentGuardLevel === 2 ? '提督' : currentGuardLevel === 3 ? '舰长' : '无'
    return `舰长等级不足(需要${needText}+, 当前${curText})`
  }

  return '开始兑换'
}

// 重置购买模态框状态
function resetBuyModalState() {
  showBuyModal.value = false
  showAddressSelect.value = false
  selectedAddress.value = undefined
  buyCount.value = 1
  selectedSubItems.value = []
  currentGoods.value = undefined
  remark.value = '' // 新增：重置备注
}

// 处理模态框显示状态变化
function handleModalUpdateShow(show: boolean) {
  if (!show) {
    resetBuyModalState()
  }
}

// 执行购买操作
async function buyGoods() {
  if (!currentGoods.value) return

  // 检查后端购买状态
  if (!currentGoods.value.canPurchase) {
    message.error(currentGoods.value.cannotPurchaseReason || '无法兑换该礼物')
    return
  }

  const subMap = new Map((currentGoods.value.subItems ?? []).map(s => [String(s.id), s]))
  const hasSubs = hasSubItems.value

  // 输入验证
  if (hasSubs) {
    if (selectedSubItems.value.length === 0) {
      message.error('请选择至少一个款式')
      return
    }
    for (const s of selectedSubItems.value) {
      const sub = subMap.get(String(s.subItemId))
      if (!sub) {
        message.error('款式数据异常，请刷新后重试')
        return
      }
      if (s.quantity < 1) {
        message.error('款式数量不能小于1')
        return
      }
      if (!Number.isInteger(s.quantity)) {
        message.error('款式数量必须为整数')
        return
      }
      if (sub.type === GoodsTypes.Virtual && s.quantity !== 1) {
        message.error(`${sub.name} 为虚拟礼物，数量固定为 1`)
        return
      }
    }
  } else {
    if (buyCount.value < 1) {
      message.error('兑换数量不能小于1')
      return
    }
    if (!Number.isInteger(buyCount.value)) {
      message.error('兑换数量必须为整数')
      return
    }

    // 检查是否超出兑换次数限制
    const totalCount = (currentGoods.value.purchasedCount ?? 0) + buyCount.value
    if (totalCount > (currentGoods.value.maxBuyCount ?? Number.MAX_VALUE)) {
      message.error(`超出最大兑换次数限制(${currentGoods.value.maxBuyCount})`)
      return
    }
  }

  if (needAddress.value && !selectedAddress.value) {
    message.error('请选择收货地址')
    return
  }

  const selectedSummary = hasSubs
    ? selectedSubItems.value
      .map(s => `${subMap.get(String(s.subItemId))?.name ?? s.subItemId}×${s.quantity}`)
      .join('、')
    : `${buyCount.value} 个`

  const dialogContent = hasSubs
    ? `确定要花费 ${currentGoodsCost.value} 积分兑换 \"${currentGoods.value!.name}\" 吗？\n款式：${selectedSummary}`
    : `确定要花费 ${currentGoodsCost.value} 积分兑换 ${buyCount.value} 个 \"${currentGoods.value!.name}\" 吗？`

  // 确认对话框
  dialog.warning({
    title: '确认兑换',
    content: dialogContent,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        isLoading.value = true
        const count = hasSubs ? selectedSubItems.value.reduce((acc, s) => acc + s.quantity, 0) : buyCount.value
        const data = await useAuth.QueryBiliAuthPostAPI<ResponsePointOrder2UserModel>(`${POINT_API_URL}buy`, {
          vId: props.userInfo.id,
          goodsId: currentGoods.value!.id,
          count,
          addressId: selectedAddress.value?.id ?? null, // 如果地址未选择，则传 null
          remark: remark.value, // 新增：将备注添加到请求中
          ...(hasSubs ? { selectedSubItems: selectedSubItems.value } : {}),
        })

        if (data.code === 200) {
          message.success('兑换成功')
          // 不做本地扣减：避免小数精度/并发增长导致与账户页不一致
          void refreshCurrentPoint()

          // 构建对话框内容
          const isVirtualGoods = data.data.type === GoodsTypes.Virtual
          const hasContent = data.data.goods.content
          const orderSubItems = data.data.selectedSubItems ?? []
          const subItemText = orderSubItems.length
            ? orderSubItems.map(s => `${s.nameSnapshot}×${s.quantity}`).join('、')
            : ''
          const keyText = orderSubItems
            .flatMap(s => (s.assignedVirtualKeys || []).map(k => `${s.nameSnapshot}: ${k}`))
            .join('\n')

          // 显示成功对话框
          dialog.success({
            title: '成功',
            content: () => {
              const elements: any[] = [
                h(NText, null, { default: () => `兑换成功，订单号：${data.data.id}` }),
              ]

              if (subItemText) {
                elements.push(
                  h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '已选款式' }),
                  h(NText, null, { default: () => subItemText }),
                )
              }

              if (keyText) {
                elements.push(
                  h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '密钥' }),
                  h(
                    NAlert,
                    { type: 'success', bordered: false, style: 'white-space: pre-wrap; word-break: break-word;' },
                    { default: () => keyText },
                  ),
                )
              }

              // 如果是虚拟礼物且有内容，则显示礼物内容
              if (isVirtualGoods && hasContent) {
                elements.push(
                  h(NDivider, { style: 'margin: 16px 0;' }, { default: () => '礼物内容' }),
                  h(
                    NAlert,
                    {
                      type: 'success',
                      bordered: false,
                      style: 'white-space: pre-wrap; word-break: break-word;',
                    },
                    { default: () => data.data.goods.content },
                  ),
                )
              }

              return h(NFlex, { vertical: true, size: 'small' }, { default: () => elements })
            },
            positiveText: '前往查看',
            negativeText: '关闭',
            onPositiveClick: () => {
              router.push({ name: 'bili-user', hash: '#orders' })
              resetBuyModalState() // 跳转后也重置状态
            },
            onNegativeClick: () => {
              resetBuyModalState() // 关闭成功提示后重置状态
            },
          })
          // 重新获取礼物列表
          goods.value = await useAuth.GetGoods(props.userInfo.id, message)
        } else {
          message.error(`兑换失败: ${data.message}`)
          console.error('Buy failed:', data)
        }
      } catch (err: any) {
        console.error('Buy error:', err)
        message.error(`兑换失败: ${err.message || err}`)
      } finally {
        isLoading.value = false
        // 无论成功失败，如果模态框还开着，理论上应该重置部分状态或关闭模态框
        // 但成功时已有处理，失败时保留模态框让用户修改或取消
      }
    },
  })
}

// 点击兑换按钮，打开模态框
function onBuyClick(good: ResponsePointGoodModel) {
  currentGoods.value = good
  buyCount.value = 1 // 重置购买数量
  selectedSubItems.value = [] // 重置子选项
  selectedAddress.value = undefined // 重置地址选择
  showBuyModal.value = true
}

// 自定义渲染地址选择器的标签
function renderLabel(option: SelectOption) {
  const address = biliAuth.value.address?.find(a => a.id === option.value)
  return h(AddressDisplay, { address, size: 'small' })
}

// 自定义渲染地址选择器的选项
function renderOption({ option }: { node: any, option: SelectOption }) {
  const address = biliAuth.value.address?.find(a => a.id === option.value)
  return h(
    NButton,
    {
      style: 'width: 100%; height: 100%; margin: 5px; padding: 12px; justify-content: flex-start;', // 优化样式
      secondary: true,
      type: selectedAddress.value?.id !== option.value ? 'default' : 'info', // 根据是否选中改变类型
      onClick: () => {
        selectedAddress.value = address // 选中地址
        showAddressSelect.value = false // 关闭选择下拉框
      },
    },
    // 按钮内容为地址显示组件
    () => h(AddressDisplay, { address }),
  )
}

// 跳转到 Bilibili 用户中心页面
function gotoAuthPage() {
  // 移除旧的注释代码
  NavigateToNewTab('/bili-user')
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
    <NAlert
      v-if="!useAuth.isAuthed"
      type="warning"
      title="需要认证"
      size="small"
      :bordered="false"
    >
      <NFlex vertical :gap="8">
        <NText>你尚未进行 Bilibili 账号认证, 无法查看积分或兑换礼物。</NText>
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

    <template v-else>
      <!-- 用户信息与工具栏 -->
      <NCard class="header-card" :bordered="false">
        <div class="header-container">
          <!-- 用户简要信息 -->
          <div class="user-status-bar">
            <NFlex justify="space-between" align="center">
              <NFlex align="center" :gap="16">
                <NFlex align="center" :gap="8">
                  <NIcon :component="Person24Regular" size="20" class="status-icon" />
                  <NText strong class="username">
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
                
                <NFlex align="center" :gap="4">
                  <NText depth="3">
                    当前积分:
                  </NText>
                  <NText v-if="currentPoint >= 0" type="primary" strong class="point-value">
                    {{ formattedCurrentPoint }}
                  </NText>
                  <NText v-else depth="3" italic>
                    加载中...
                  </NText>
                </NFlex>
              </NFlex>

              <NFlex align="center" :gap="12">
                <NButton quaternary size="small" @click="gotoAuthPage">
                  <template #icon>
                    <NIcon :component="Person24Regular" />
                  </template>
                  账号中心
                </NButton>
                <NButton quaternary size="small" @click="NavigateToNewTab('/bili-user#settings')">
                  <template #icon>
                    <NIcon :component="ArrowSync24Regular" />
                  </template>
                  切换账号
                </NButton>
              </NFlex>
            </NFlex>
          </div>

          <NDivider style="margin: 4px 0;" />

          <!-- 筛选工具栏 -->
          <div class="toolbar-section">
            <NFlex vertical :gap="16">
              <!-- 标签分类 -->
              <NFlex v-if="tags.length > 0" align="center" :gap="12">
                <NText depth="3" class="filter-label">
                  分类:
                </NText>
                <NFlex :gap="8" wrap>
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
              <NFlex justify="space-between" align="center" wrap :gap="12">
                <NFlex align="center" :gap="12" wrap>
                  <NInput
                    v-model:value="searchKeyword"
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
                    :options="[
                      { label: '默认排序', value: null },
                      { label: '价格从低到高', value: 'price_asc' },
                      { label: '价格从高到低', value: 'price_desc' },
                      { label: '名称 A-Z', value: 'name_asc' },
                      { label: '最近更新', value: 'popular' },
                    ]"
                    placeholder="排序方式"
                    size="medium"
                    style="width: 160px"
                    clearable
                  />

                  <NFlex align="center" :gap="16">
                    <NCheckbox v-model:checked="onlyCanBuy">
                      仅显示可兑换
                    </NCheckbox>
                    <NCheckbox v-model:checked="ignoreGuard">
                      忽略等级限制
                    </NCheckbox>
                  </NFlex>
                </NFlex>

                <NFlex>
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
                  <NButton secondary size="medium" @click="refreshCurrentPoint">
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

      <div style="margin-top: 20px;" />

      <!-- 礼物列表区域 -->
      <NSpin :show="isLoading">
        <NEmpty
          v-if="!isLoading && selectedItems.length === 0"
          :description="goods.length === 0 ? '当前没有可兑换的礼物哦~' : '没有找到符合筛选条件的礼物'"
        />
        <NGrid
          v-else
          cols="1 500:2 800:3 1100:4 1500:5"
          :x-gap="16"
          :y-gap="16"
        >
          <NGi v-for="item in selectedItems" :key="item.id">
            <PointGoodsItem
              :goods="item"
              class="goods-item-card"
              :class="{ 'is-unavailable': getTooltip(item) !== '开始兑换' }"
            >
              <template #footer>
                <NFlex vertical :gap="12">
                  <NFlex v-if="item.hasPurchased || !item.canPurchase" :gap="4" wrap>
                    <NTag v-if="item.hasPurchased" :type="item.isAllowRebuy ? 'info' : 'warning'" size="tiny" :bordered="false" round>
                      {{ item.isAllowRebuy ? `已兑换 ${item.purchasedCount} 次` : '已兑换' }}
                    </NTag>
                    <NTag v-if="!item.canPurchase && item.cannotPurchaseReason" type="error" size="tiny" :bordered="false" round>
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
      </NSpin>
    </template>

    <!-- 兑换确认模态框 -->
    <NModal
      v-if="currentGoods"
      :show="showBuyModal"
      preset="card"
      :title="currentGoods.name"
      style="width: 520px; max-width: 95vw;"
      :mask-closable="!isLoading"
      :close-on-esc="!isLoading"
      :segmented="{ content: true, action: true }"
      @update:show="handleModalUpdateShow"
    >
      <template #header-extra>
        <NTag
          :type="currentGoods.type === GoodsTypes.Physical ? 'info' : 'default'"
          :bordered="false"
          round
          size="small"
        >
          {{ currentGoods.type === GoodsTypes.Physical ? '实体礼物' : '虚拟物品' }}
        </NTag>
      </template>

      <!-- 滚动区域 -->
      <NScrollbar style="max-height: 60vh; padding-right: 12px;">
        <!-- 礼物信息展示 -->
        <div style="margin-bottom: 16px;">
          <PointGoodsItem
            :goods="currentGoods"
            :show-footer="false"
            content-style="height: auto; border: none; box-shadow: none;"
            style="border: 1px solid var(--n-border-color); border-radius: var(--n-border-radius);"
          />
        </div>

        <!-- 购买历史提示 -->
        <NAlert
          v-if="currentGoods.hasPurchased"
          :type="currentGoods.isAllowRebuy ? 'info' : 'warning'"
          style="margin-bottom: 16px;"
          :bordered="false"
        >
          <template #header>
            {{ currentGoods.isAllowRebuy ? '购买记录' : '重要提示' }}
          </template>
          你已兑换过此礼物 <strong>{{ currentGoods.purchasedCount }}</strong> 次
          <span v-if="!currentGoods.isAllowRebuy">，该礼物不允许重复兑换</span>
          <span v-else-if="currentGoods.maxBuyCount">
            ，最多可兑换 <strong>{{ currentGoods.maxBuyCount }}</strong> 次
            (剩余 <strong>{{ currentGoods.maxBuyCount - currentGoods.purchasedCount }}</strong> 次)
          </span>
        </NAlert>

        <!-- 兑换选项 -->
        <NForm
          label-placement="top"
          :show-feedback="false"
        >
          <!-- 款式选择（可多选） -->
          <NFormItem
            v-if="hasSubItems"
            label="选择款式"
            required
          >
            <NFlex vertical :gap="12" style="width: 100%;">
              <div
                v-for="sub in (currentGoods.subItems ?? [])"
                :key="sub.id"
                class="sub-item-card"
                :class="{ 
                  'active': isSubItemChecked(sub.id), 
                  'disabled': sub.count === 0 || (currentGoods.maxSubItemSelections && currentGoods.maxSubItemSelections > 0 && selectedSubItems.length >= currentGoods.maxSubItemSelections && !isSubItemChecked(sub.id))
                }"
                @click="(sub.count === 0 || (currentGoods.maxSubItemSelections && currentGoods.maxSubItemSelections > 0 && selectedSubItems.length >= currentGoods.maxSubItemSelections && !isSubItemChecked(sub.id))) ? null : toggleSubItem(sub.id, !isSubItemChecked(sub.id))"
              >
                <NFlex align="center" justify="space-between" :gap="12" style="width: 100%;">
                  <NFlex align="center" :gap="12" style="flex: 1; overflow: hidden;">
                    <!-- Checkbox -->
                    <NCheckbox
                      :checked="isSubItemChecked(sub.id)"
                      :disabled="sub.count === 0 || (currentGoods.maxSubItemSelections && currentGoods.maxSubItemSelections > 0 && selectedSubItems.length >= currentGoods.maxSubItemSelections && !isSubItemChecked(sub.id))"
                      @click.stop
                      @update:checked="(v) => toggleSubItem(sub.id, v)"
                    />
                    
                    <!-- Cover -->
                    <NImage
                      v-if="sub.cover?.path"
                      :src="sub.cover.path"
                      width="48"
                      height="48"
                      class="sub-item-cover"
                      object-fit="cover"
                      @click.stop
                    />
                    
                    <!-- Info -->
                    <NFlex vertical :gap="4" style="flex: 1; min-width: 0;">
                      <NFlex align="center" :gap="8">
                        <NText strong :depth="sub.count === 0 ? 3 : 1" class="sub-item-name">
                          {{ sub.name }}
                        </NText>
                        <NTag size="tiny" :bordered="false" round type="primary" secondary>
                          {{ sub.price }} 积分
                        </NTag>
                      </NFlex>
                      
                      <!-- Description -->
                      <NText v-if="sub.description" depth="3" style="font-size: 12px; line-height: 1.2;">
                        {{ sub.description }}
                      </NText>

                      <NText depth="3" style="font-size: 12px;">
                        <span v-if="sub.count === 0">缺货</span>
                        <span v-else-if="sub.count != null">库存 {{ sub.count }}</span>
                        <span v-else>库存不限</span>
                      </NText>
                    </NFlex>
                  </NFlex>

                  <!-- Quantity -->
                  <div v-if="isSubItemChecked(sub.id)" @click.stop>
                    <NInputNumber
                      :value="selectedSubItems.find(s => s.subItemId === sub.id)?.quantity ?? 1"
                      :min="1"
                      :max="Math.min(
                        sub.maxBuyCount ?? 100000,
                        sub.count == null ? 100000 : sub.count,
                      )"
                      button-placement="both"
                      size="small"
                      style="width: 100px"
                      step="1"
                      :precision="0"
                      @update:value="(v) => updateSubItemQuantity(sub.id, v)"
                    />
                  </div>
                </NFlex>
              </div>
              <NText depth="3" style="font-size: 12px; margin-left: 4px;">
                * 可多选，价格按所选款式累计计算
                <span v-if="currentGoods.maxSubItemSelections && currentGoods.maxSubItemSelections > 0">
                  （最多选 {{ currentGoods.maxSubItemSelections }} 种，已选 {{ selectedSubItems.length }} 种）
                </span>
              </NText>
            </NFlex>
          </NFormItem>

          <!-- 旧模式：父商品数量 -->
          <NFormItem
            v-else
            label="兑换数量"
            required
          >
            <NInputNumber
              v-model:value="buyCount"
              :min="1"
              :max="Math.min(
                currentGoods.maxBuyCount ?? 100000,
                (currentGoods.maxBuyCount ?? 100000) - (currentGoods.purchasedCount ?? 0),
              )"
              button-placement="both"
              style="max-width: 140px"
              step="1"
              :precision="0"
            />
            <NText
              depth="3"
              style="margin-left: 12px; font-size: 12px;"
            >
              {{
                currentGoods.hasPurchased
                  ? `已兑换 ${currentGoods.purchasedCount} / ${currentGoods.maxBuyCount ?? '∞'}`
                  : `库存: ${currentGoods.count ?? '无限'} | 限购: ${currentGoods.maxBuyCount ?? '无限'}`
              }}
            </NText>
          </NFormItem>

          <!-- 地址选择 -->
          <NFormItem
            v-if="needAddress"
            label="收货地址"
            required
          >
            <NFlex style="width: 100%" :gap="8">
              <NSelect
                v-model:show="showAddressSelect"
                :value="selectedAddress?.id"
                :options="addressOptions"
                :render-label="renderLabel"
                :render-option="renderOption"
                placeholder="请选择收货地址"
                style="flex-grow: 1;"
              />
              <NButton
                secondary
                type="primary"
                @click="NavigateToNewTab('/bili-user#settings')"
              >
                管理地址
              </NButton>
            </NFlex>
          </NFormItem>

          <!-- 备注输入 -->
          <NFormItem label="备注信息">
            <NInput
              v-model:value="remark"
              type="textarea"
              placeholder="如有特殊需求请留言（可选）"
              :autosize="{ minRows: 2, maxRows: 4 }"
              maxlength="100"
              show-count
            />
          </NFormItem>
        </NForm>
      </NScrollbar>

      <!-- 底部操作栏 -->
      <template #action>
        <NFlex justify="space-between" align="center">
          <NFlex vertical :gap="2">
            <NFlex align="baseline" :gap="4">
              <NText depth="3" style="font-size: 12px;">
                总计花费
              </NText>
              <NText type="primary" style="font-size: 18px; font-weight: bold;">
                {{ currentGoodsCost }}
              </NText>
              <NText depth="3" style="font-size: 12px;">
                积分
              </NText>
            </NFlex>
            <NText depth="3" style="font-size: 12px;">
              当前持有: {{ currentPoint >= 0 ? formattedCurrentPoint : '--' }}
            </NText>
          </NFlex>

          <NFlex align="center">
            <NButton @click="showBuyModal = false">
              取消
            </NButton>
            <NButton
              type="primary"
              :disabled="!canDoBuy || isLoading"
              :loading="isLoading"
              @click="buyGoods"
            >
              确认兑换
            </NButton>
          </NFlex>
        </NFlex>
        
        <!-- 错误提示 -->
        <div v-if="!canDoBuy && (currentGoods.cannotPurchaseReason || currentGoodsCost > currentPoint)" style="margin-top: 12px; text-align: right;">
          <NText type="error" style="font-size: 12px;">
            {{ currentGoods.cannotPurchaseReason || '积分不足或条件不满足' }}
          </NText>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.point-goods-container {
  width: 100%;
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

.goods-list-container {
  min-height: 200px;
}

.goods-item-card {
  height: 100%;
  transition: all 0.3s var(--n-bezier);
}

.is-unavailable {
  opacity: 0.8;
  filter: grayscale(0.2);
}

.sub-item-card {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  transition: all 0.2s ease;
  cursor: pointer;
  background-color: var(--n-color);
}

.sub-item-card:hover:not(.disabled) {
  border-color: var(--n-primary-color);
  background-color: color-mix(in srgb, var(--n-primary-color), transparent 95%);
}

.sub-item-card.active {
  border-color: var(--n-primary-color);
  background-color: color-mix(in srgb, var(--n-primary-color), transparent 90%);
  box-shadow: 0 0 0 1px var(--n-primary-color) inset;
}

.sub-item-card.disabled {
  opacity: 0.6;
  cursor: not-allowed;
  background-color: var(--n-color-modal);
}

.sub-item-cover {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--n-border-color);
}

.sub-item-name {
  font-size: 14px;
}

@media (max-width: 768px) {
  .user-status-bar, .toolbar-section {
    padding: 12px;
  }
}
</style>
