<script setup lang="ts">
import { NavigateToNewTab } from '@/Utils'
// 移除未使用的 useAccount
import {
  AddressInfo,
  GoodsTypes,
  ResponsePointGoodModel,
  ResponsePointOrder2UserModel,
  UserInfo,
} from '@/api/api-models'
import AddressDisplay from '@/components/manage/AddressDisplay.vue'
import PointGoodsItem from '@/components/manage/PointGoodsItem.vue'
import { POINT_API_URL } from '@/data/constants'
import { useBiliAuth } from '@/store/useBiliAuth'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDivider,
  NEmpty,
  NFlex,
  NForm,
  NFormItem,
  NGrid,
  NGi,
  NInput,
  NInputNumber,
  NModal,
  NSelect,
  NSpin,
  NTag,
  NText,
  NTooltip,
  SelectOption,
  useDialog,
  useMessage,
} from 'naive-ui'
import { computed, h, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

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

// 筛选相关状态
const selectedTag = ref<string>() // 选中的标签
const onlyCanBuy = ref(false) // 只显示可兑换
const ignoreGuard = ref(false) // 忽略舰长限制
const sortOrder = ref<string | null>(null) // 排序方式
const searchKeyword = ref('') // 搜索关键词

// --- 计算属性 ---

// 地址选项，用于地址选择器
const addressOptions = computed(() => {
  if (!biliAuth.value.id) return []
  return (
    biliAuth.value.address?.map((item) => ({
      label: item.address, // 使用地址作为标签
      value: item.id, // 使用地址ID作为值
    })) ?? []
  )
})

// 判断是否可以执行购买操作
const canDoBuy = computed(() => {
  if (!currentGoods.value) return false
  // 检查积分是否足够
  const pointCheck = currentGoods.value.price * buyCount.value <= currentPoint.value
  // 如果是实物礼物且没有外部收集链接，则必须选择地址
  const addressCheck =
    currentGoods.value.type !== GoodsTypes.Physical ||
    currentGoods.value.collectUrl ||
    !!selectedAddress.value
  return pointCheck && addressCheck
})

// 礼物标签列表
const tags = computed(() => {
  return Array.from(new Set(goods.value.flatMap((g) => g.tags)))
})

// 经过筛选和排序后的礼物列表
const selectedItems = computed(() => {
  let filteredItems = goods.value
    // 标签筛选
    .filter((item) => !selectedTag.value || item.tags.includes(selectedTag.value))
    // 可兑换筛选 (只显示 getTooltip 返回 '开始兑换' 的礼物)
    .filter((item) => !onlyCanBuy.value || getTooltip(item) === '开始兑换')
    // 舰长等级筛选 (只显示允许所有等级或忽略舰长限制的礼物)
    .filter((item) => !ignoreGuard.value || item.allowGuardLevel === 0)
    // 关键词搜索 (匹配名称或描述)
    .filter(
      (item) =>
        !searchKeyword.value ||
        item.name.toLowerCase().includes(searchKeyword.value.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchKeyword.value.toLowerCase())),
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
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // 如果已有排序方式，则不再进行额外排序
    if (sortOrder.value) return 0;
    // 默认排序逻辑
    return 0;
  })
})

// 获取商品标签颜色
function getTagColor(index: number): 'default' | 'info' | 'success' | 'warning' | 'error' | 'primary' {
  const colors: Array<'default' | 'info' | 'success' | 'warning' | 'error' | 'primary'> = ['default', 'info', 'success', 'warning', 'error'];
  return colors[index % colors.length];
}

// --- 方法 ---

// 获取礼物兑换按钮的提示文本
function getTooltip(goods: ResponsePointGoodModel): '开始兑换' | '当前积分不足' | '请先进行账号认证' | '库存不足' | '舰长等级不足' | '兑换时间未到' | '已达兑换上限' | '需要设置地址' {
  if (!biliAuth.value.id) return '请先进行账号认证' // 未认证
  if ((goods?.count ?? Number.MAX_VALUE) <= 0) return '库存不足' // 库存不足
  if ((currentPoint.value ?? 0) < goods.price && !goods.canFreeBuy) return '当前积分不足' // 积分不足且不能免费兑换
  // 检查舰长等级要求
  // 使用 guardInfo 判断用户在当前主播房间的舰长等级
  const currentGuardLevel = biliAuth.value.guardInfo?.[props.userInfo.id] ?? 0
  if (goods.allowGuardLevel > 0 && currentGuardLevel < goods.allowGuardLevel) {
    return '舰长等级不足'
  }

  // 在当前模型中没有兑换时间限制字段，可以根据需要添加相关功能
  // 如果将来添加了时间限制功能，可以取消下面注释并调整代码
  /*
  if (goods.startTime && new Date() < new Date(goods.startTime)) {
    return '兑换时间未到'
  }
  if (goods.endTime && new Date() > new Date(goods.endTime)) {
    return '兑换已结束'
  }
  */

  // 检查用户兑换上限
  // 注意：当前模型中没有 userBoughtCount 属性，
  // 需要后端提供已购买数量信息才能实现此功能
  /*
  if (goods.userBoughtCount !== undefined && goods.maxBuyCount !== undefined &&
      goods.userBoughtCount >= goods.maxBuyCount && goods.maxBuyCount > 0) {
    return '已达兑换上限'
  }
  */

  // 检查实物礼物的地址要求 - 仅对没有外部收集链接的实物礼物检查
  if (goods.type === GoodsTypes.Physical &&
      !goods.collectUrl && // 修复：如果有站外链接收集地址，不需要检查用户是否设置了地址
      (!biliAuth.value.address || biliAuth.value.address.length === 0)) {
    return '需要设置地址'
  }

  return '开始兑换' // 可以兑换
}

// 重置购买模态框状态
function resetBuyModalState() {
  showBuyModal.value = false
  showAddressSelect.value = false
  selectedAddress.value = undefined
  buyCount.value = 1
  currentGoods.value = undefined
}

// 处理模态框显示状态变化
function handleModalUpdateShow(show: boolean) {
  if (!show) {
    resetBuyModalState()
  }
}

// 执行购买操作
async function buyGoods() {
  // 输入验证
  if (buyCount.value < 1) {
    message.error('兑换数量不能小于1')
    return
  }
  if (!Number.isInteger(buyCount.value)) {
    message.error('兑换数量必须为整数')
    return
  }
  if (
    currentGoods.value?.type === GoodsTypes.Physical && // 是实物
    !currentGoods.value.collectUrl && // 没有外部收集链接
    !selectedAddress.value // 且没有选择地址
  ) {
    message.error('请选择收货地址')
    return
  }

  // 确认对话框
  dialog.warning({
    title: '确认兑换',
    content: `确定要花费 ${currentGoods.value!.price * buyCount.value} 积分兑换 ${buyCount.value} 个 "${currentGoods.value!.name}" 吗？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        isLoading.value = true
        const data = await useAuth.QueryBiliAuthPostAPI<ResponsePointOrder2UserModel>(POINT_API_URL + 'buy', {
          vId: props.userInfo.id,
          goodsId: currentGoods.value?.id,
          count: buyCount.value,
          addressId: selectedAddress.value?.id ?? null, // 如果地址未选择，则传 null
        })

        if (data.code === 200) {
          message.success('兑换成功')
          // 更新本地积分显示
          currentPoint.value -= currentGoods.value!.price * buyCount.value
          // 显示成功对话框
          dialog.success({
            title: '成功',
            content: `兑换成功，订单号：${data.data.id}`,
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
          goods.value = await useAuth.GetGoods(props.userInfo.id, message);
        } else {
          message.error('兑换失败: ' + data.message)
          console.error('Buy failed:', data)
        }
      } catch (err: any) {
        console.error('Buy error:', err)
        message.error('兑换失败: ' + (err.message || err))
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
  selectedAddress.value = undefined // 重置地址选择
  showBuyModal.value = true
}

// 自定义渲染地址选择器的标签
const renderLabel = (option: SelectOption) => {
  const address = biliAuth.value.address?.find((a) => a.id === option.value)
  return h(AddressDisplay, { address: address, size: 'small' })
}

// 自定义渲染地址选择器的选项
const renderOption = ({ option }: { node: any; option: SelectOption }) => {
  const address = biliAuth.value.address?.find((a) => a.id === option.value)
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
    () => h(AddressDisplay, { address: address }),
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
        currentPoint.value = (await useAuth.GetSpecificPoint(props.userInfo.id)) ?? -1
      }
    }
    // 获取礼物列表
    goods.value = await useAuth.GetGoods(props.userInfo.id, message)
  } catch (error) {
    console.error("Error loading initial data:", error)
    message.error("加载数据时出错")
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
    >
      你尚未进行 Bilibili 账号认证, 无法查看积分或兑换礼物。
      <NButton
        type="primary"
        size="small"
        style="margin-top: 8px"
        @click="$router.push({ name: 'bili-auth' })"
      >
        立即认证
      </NButton>
    </NAlert>

    <!-- 优化后的用户信息与筛选区域 -->
    <div
      v-else
      class="header-section"
    >
      <!-- 用户信息区域 -->
      <div class="user-info-section">
        <NFlex
          justify="space-between"
          align="center"
        >
          <NFlex align="center">
            <NText class="username">
              你好, {{ biliAuth.name }}
            </NText>
            <NText
              v-if="currentPoint >= 0"
              class="point-info"
            >
              你在本直播间的积分: <strong>{{ currentPoint }}</strong>
            </NText>
            <NText
              v-else
              class="point-info loading"
            >
              积分加载中...
            </NText>
          </NFlex>
          <NFlex :size="8">
            <NButton
              quaternary
              size="small"
              @click="gotoAuthPage"
            >
              账号中心
            </NButton>
            <NButton
              quaternary
              size="small"
              @click="NavigateToNewTab('/bili-user#settings')"
            >
              切换账号
            </NButton>
          </NFlex>
        </NFlex>
      </div>

      <!-- 礼物筛选区域 -->
      <div
        v-if="tags.length > 0 || goods.length > 0"
        class="filter-section"
      >
        <!-- 标签筛选 -->
        <NFlex
          v-if="tags.length > 0"
          wrap
          class="tags-container"
        >
          <div class="filter-label">
            分类:
          </div>
          <div class="tags-wrapper">
            <NButton
              v-for="tag in tags"
              :key="tag"
              :type="tag === selectedTag ? 'primary' : 'default'"
              :ghost="tag !== selectedTag"
              class="tag-button"
              size="tiny"
              @click="selectedTag = selectedTag === tag ? undefined : tag"
            >
              {{ tag }}
            </NButton>
            <NButton
              v-if="selectedTag"
              text
              type="error"
              size="tiny"
              @click="selectedTag = undefined"
            >
              ✕
            </NButton>
          </div>
        </NFlex>

        <!-- 搜索与高级筛选 -->
        <NFlex
          justify="space-between"
          align="center"
          wrap
          class="search-filter-row"
        >
          <!-- 搜索框 -->
          <NInput
            v-model:value="searchKeyword"
            placeholder="搜索礼物名称"
            clearable
            size="small"
            class="search-input"
          >
            <template #prefix>
              🔍
            </template>
          </NInput>

          <!-- 筛选选项 -->
          <NFlex
            wrap
            align="center"
            class="filter-options"
          >
            <NCheckbox
              v-model:checked="onlyCanBuy"
              size="small"
              class="filter-checkbox"
            >
              仅显示可兑换
            </NCheckbox>
            <NCheckbox
              v-model:checked="ignoreGuard"
              size="small"
              class="filter-checkbox"
            >
              忽略舰长限制
            </NCheckbox>
            <!-- 排序方式 -->
            <NSelect
              v-model:value="sortOrder"
              :options="[
                { label: '默认排序', value: 'null' },
                { label: '价格 ↑', value: 'price_asc' },
                { label: '价格 ↓', value: 'price_desc' },
                { label: '名称 ↑', value: 'name_asc' },
                { label: '名称 ↓', value: 'name_desc' },
                { label: '类型', value: 'type' },
                { label: '置顶', value: 'popular' }
              ]"
              placeholder="排序方式"
              size="small"
              class="sort-select"
            />
          </NFlex>
        </NFlex>
      </div>
    </div>

    <!-- 礼物列表区域 -->
    <NSpin
      :show="isLoading"
      class="goods-list-container"
    >
      <template #description>
        加载中...
      </template>
      <NEmpty
        v-if="!isLoading && selectedItems.length === 0"
        :description="goods.length === 0 ? '当前没有可兑换的礼物哦~' : '没有找到符合筛选条件的礼物'"
      >
        <template #extra>
          <NButton
            v-if="goods.length > 0 && (selectedTag || searchKeyword || onlyCanBuy || ignoreGuard || sortOrder)"
            size="small"
            @click="clearFilters"
          >
            清空筛选条件
          </NButton>
        </template>
      </NEmpty>
      <NGrid
        v-else
        cols="1 500:2 750:3 1000:4 1300:5"
        :x-gap="12"
        :y-gap="12"
        class="goods-list"
        style="justify-items: center;"
      >
        <NGi
          v-for="item in selectedItems"
          :key="item.id"
          style="width: 100%;"
        >
          <PointGoodsItem
            :goods="item"
            content-style="max-width: 300px; min-width: 250px; height: 380px;"
            class="goods-item"
            :class="{ 'pinned-item': item.isPinned }"
          >
            <template #footer>
              <NFlex
                justify="space-between"
                align="center"
                class="goods-footer"
              >
                <NTooltip placement="bottom">
                  <template #trigger>
                    <NButton
                      :disabled="getTooltip(item) !== '开始兑换'"
                      size="small"
                      type="primary"
                      class="exchange-btn"
                      @click="onBuyClick(item)"
                    >
                      {{ item.isPinned ? '🔥 兑换' : '兑换' }}
                    </NButton>
                  </template>
                  {{ getTooltip(item) }}
                </NTooltip>
              </NFlex>
            </template>
          </PointGoodsItem>
        </NGi>
      </NGrid>
    </NSpin>

    <!-- 兑换确认模态框 -->
    <NModal
      v-if="currentGoods"
      :show="showBuyModal"
      preset="card"
      :title="`确认兑换: ${currentGoods.name}`"
      style="width: 500px; max-width: 90vw;"
      :mask-closable="!isLoading"
      :close-on-esc="!isLoading"
      @update:show="handleModalUpdateShow"
    >
      <template #header>
        <NFlex align="baseline">
          <NTag
            :type="currentGoods.type === GoodsTypes.Physical ? 'info' : 'default'"
            :bordered="false"
          >
            {{ currentGoods.type === GoodsTypes.Physical ? '实体礼物' : '虚拟物品' }}
          </NTag>
          <NText strong>
            {{ currentGoods.name }}
          </NText>
        </NFlex>
      </template>

      <!-- 礼物信息展示 -->
      <PointGoodsItem
        :goods="currentGoods"
        :show-footer="false"
        content-style="height: auto;"
      />

      <!-- 兑换选项 (仅对实物或需要数量选择的礼物显示) -->
      <template v-if="currentGoods.type === GoodsTypes.Physical || (currentGoods.maxBuyCount ?? 1) > 1">
        <NDivider style="margin-top: 12px; margin-bottom: 12px;">
          兑换选项
        </NDivider>
        <NForm
          label-placement="left"
          label-width="auto"
        >
          <NFormItem
            label="兑换数量"
            required
          >
            <NInputNumber
              v-model:value="buyCount"
              :min="1"
              :max="currentGoods.maxBuyCount ?? 100000"
              style="max-width: 120px"
              step="1"
              :precision="0"
            />
            <NText
              depth="3"
              style="margin-left: 8px;"
            >
              (最多可兑换 {{ currentGoods.maxBuyCount ?? '无限' }} 个)
            </NText>
          </NFormItem>
          <!-- 地址选择 (仅对无外部收集链接的实物礼物显示) -->
          <NFormItem
            v-if="currentGoods.type === GoodsTypes.Physical && !currentGoods.collectUrl"
            label="收货地址"
            required
          >
            <NSelect
              v-model:show="showAddressSelect"
              :value="selectedAddress?.id"
              :options="addressOptions"
              :render-label="renderLabel"
              :render-option="renderOption"
              placeholder="请选择地址"
              style="flex-grow: 1; margin-right: 8px;"
            />
            <NButton
              size="small"
              type="info"
              secondary
              @click="NavigateToNewTab('/bili-user#settings')"
            >
              管理地址
            </NButton>
          </NFormItem>
        </NForm>
      </template>

      <NDivider style="margin-top: 16px; margin-bottom: 16px;">
        <NTag :type="!canDoBuy ? 'error' : 'success'">
          {{ !canDoBuy ? (currentGoods.price * buyCount > currentPoint ? '积分不足' : '信息不完整') : '可兑换' }}
        </NTag>
      </NDivider>

      <!-- 操作按钮和信息 -->
      <NFlex
        justify="space-between"
        align="center"
      >
        <NButton
          type="primary"
          :disabled="!canDoBuy || isLoading"
          :loading="isLoading"
          @click="buyGoods"
        >
          确认兑换
        </NButton>
        <NText depth="2">
          所需积分: {{ currentGoods.price * buyCount }}
          <NDivider vertical />
          当前积分: {{ currentPoint >= 0 ? currentPoint : '加载中' }}
        </NText>
      </NFlex>
    </NModal>
  </div>
</template>

<style scoped>
.point-goods-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 0 8px;
}

.header-section {
  margin-bottom: 16px;
  background-color: var(--card-color);
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  overflow: hidden;
}

.user-info-section {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color);
}

.username {
  font-weight: var(--font-weight-strong);
  margin-right: 16px;
}

.point-info {
  color: var(--text-color-2);
}

.point-info.loading {
  font-style: italic;
  color: var(--text-color-3);
}

.filter-section {
  padding: 12px 16px;
  background-color: var(--action-color);
}

.tags-container {
  margin-bottom: 12px;
  align-items: center;
}

.filter-label {
  font-size: var(--font-size-small);
  color: var(--text-color-2);
  margin-right: 8px;
  white-space: nowrap;
}

.tags-wrapper {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-grow: 1;
}

.tag-button {
  margin: 0;
  padding: 0 8px;
  border-radius: var(--border-radius-small);
}

.search-filter-row {
  gap: 12px;
}

.search-input {
  max-width: 200px;
}

.filter-options {
  gap: 16px;
}

.filter-checkbox {
  margin: 0;
}

.sort-select {
  width: 120px;
}

.goods-list-container {
  min-height: 200px;
}

.goods-list {
  margin-top: 16px;
  justify-items: center;
}

.goods-item {
  break-inside: avoid;
  background-color: var(--card-color);
  transition: all 0.3s ease-in-out;
  border-radius: var(--border-radius);
  border: 1px solid var(--border-color);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.02);
  position: relative;
  overflow: hidden;
  margin: 0 auto;
}

.goods-item:hover {
  transform: translateY(-3px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  z-index: 1;
}

.pinned-item {
  border: 2px solid var(--primary-color);
  box-shadow: 0 2px 12px rgba(var(--primary-color-rgb), 0.15);
  position: relative;
}

.pinned-item::before {
  content: none;
}

.pin-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9em;
  margin-right: 2px;
}

.goods-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.price-section {
  margin-bottom: 8px;
}

.price-display {
  gap: 8px;
}

.price-text {
  font-size: 1.2em;
  font-weight: bold;
  color: var(--primary-color);
}

.free-tag {
  animation: pulse 2s infinite;
}

.description-container {
  flex-grow: 1;
  overflow-y: auto;
  position: relative;
  padding: 8px 0;
  max-height: 120px;
  margin-bottom: 8px;
}

.goods-description {
  line-height: 1.5;
  font-size: 0.95em;
  white-space: pre-line;
}

.tags-section {
  margin-top: auto;
  margin-bottom: 8px;
}

.goods-tag {
  transition: all 0.2s ease;
}

.goods-tag:hover {
  transform: translateY(-2px);
}

.stock-info {
  margin-top: 4px;
}

.goods-footer {
  padding: 8px;
  border-top: 1px solid var(--border-color-1);
  background-color: rgba(var(--card-color-rgb), 0.7);
}

.exchange-btn {
  min-width: 80px;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.exchange-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.2),
    transparent
  );
  transition: all 0.6s ease;
}

.exchange-btn:not(:disabled):hover::after {
  left: 100%;
}

@keyframes pulse {
  0% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    opacity: 1;
  }
}

@media (max-width: 768px) {
  .price-text {
    font-size: 1.1em;
  }
}
</style>
