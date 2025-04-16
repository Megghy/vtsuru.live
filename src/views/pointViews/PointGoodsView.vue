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
import { useAuthStore } from '@/store/useAuthStore'
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
  NInput, // 引入 NInput
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

const useAuth = useAuthStore()
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
const priceOrder = ref<'asc' | 'desc' | null>(null) // 价格排序
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

  // 价格排序
  if (priceOrder.value) {
    filteredItems = filteredItems.sort((a, b) => {
      return priceOrder.value === 'asc' ? a.price - b.price : b.price - a.price
    })
  }

  return filteredItems
})

// --- 方法 ---

// 获取礼物兑换按钮的提示文本
function getTooltip(goods: ResponsePointGoodModel): '开始兑换' | '当前积分不足' | '请先进行账号认证' | '库存不足' {
  if (!biliAuth.value.id) return '请先进行账号认证' // 未认证
  if ((goods?.count ?? Number.MAX_VALUE) <= 0) return '库存不足' // 库存不足
  if ((currentPoint.value ?? 0) < goods.price) return '当前积分不足' // 积分不足
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
  <div>
    <!-- 未认证提示 -->
    <NAlert
      v-if="!useAuth.isAuthed"
      type="warning"
      title="需要认证"
    >
      你尚未进行 Bilibili 账号认证, 无法查看积分或兑换礼物。
      <br>
      <NButton
        type="primary"
        size="small"
        style="margin-top: 12px"
        @click="$router.push({ name: 'bili-auth' })"
      >
        立即认证
      </NButton>
    </NAlert>

    <!-- 用户信息与积分展示 -->
    <NCard
      v-else
      style="max-width: 600px; margin: 0 auto;"
      embedded
      hoverable
    >
      <template #header>
        你好, {{ biliAuth.name }} <!-- 直接使用计算属性 -->
      </template>
      <template #header-extra>
        <NFlex>
          <NButton
            type="info"
            secondary
            size="small"
            @click="gotoAuthPage"
          >
            前往认证用户中心
          </NButton>
          <NButton
            secondary
            size="small"
            @click="NavigateToNewTab('/bili-user#settings')"
          >
            切换账号
          </NButton>
        </NFlex>
      </template>
      <NText v-if="currentPoint >= 0">
        你在 {{ userInfo.extra?.streamerInfo?.name ?? userInfo.name }} 的直播间的积分为 {{ currentPoint }}
      </NText>
      <NText v-else>
        正在加载积分...
      </NText>
    </NCard>

    <NDivider />

    <!-- 礼物筛选区域 -->
    <NCard
      v-if="tags.length > 0 || goods.length > 0"
      size="small"
      title="礼物筛选与排序"
      style="margin-bottom: 16px;"
    >
      <!-- 标签筛选 -->
      <NFlex
        v-if="tags.length > 0"
        align="center"
        justify="start"
        wrap
        style="margin-bottom: 12px;"
      >
        <NText style="margin-right: 8px;">
          标签:
        </NText>
        <NButton
          v-for="tag in tags"
          :key="tag"
          :type="tag === selectedTag ? 'success' : 'default'"
          :ghost="tag !== selectedTag"
          style="margin: 2px;"
          size="small"
          @click="selectedTag = selectedTag === tag ? undefined : tag"
        >
          {{ tag }}
        </NButton>
        <NButton
          v-if="selectedTag"
          text
          type="warning"
          size="small"
          style="margin-left: 8px;"
          @click="selectedTag = undefined"
        >
          清除标签
        </NButton>
      </NFlex>

      <!-- 搜索与选项 -->
      <NFlex
        wrap
        justify="space-between"
        align="center"
        :size="[12, 8]"
      >
        <!-- 搜索框 -->
        <NInput
          v-model:value="searchKeyword"
          placeholder="搜索礼物名称或描述"
          clearable
          style="min-width: 200px; flex-grow: 1;"
        />

        <!-- 筛选选项 -->
        <NFlex
          wrap
          :gap="12"
          align="center"
        >
          <NCheckbox v-model:checked="onlyCanBuy">
            只显示可兑换
          </NCheckbox>
          <NCheckbox v-model:checked="ignoreGuard">
            忽略舰长限制
          </NCheckbox>
          <!-- 价格排序 -->
          <NSelect
            v-model:value="priceOrder"
            :options="[
              { label: '默认排序', value: null },
              { label: '价格 低→高', value: 'asc' },
              { label: '价格 高→低', value: 'desc' }
            ]"
            placeholder="价格排序"
            clearable
            style="min-width: 140px"
          />
        </NFlex>
      </NFlex>
    </NCard>

    <!-- 礼物列表区域 -->
    <NSpin :show="isLoading">
      <template #description>
        加载中...
      </template>
      <NEmpty
        v-if="!isLoading && selectedItems.length === 0"
        description="没有找到符合条件的礼物"
      >
        <template #extra>
          <NButton
            v-if="selectedTag || searchKeyword || onlyCanBuy || ignoreGuard || priceOrder"
            size="small"
            @click="() => { selectedTag = undefined; searchKeyword = ''; onlyCanBuy = false; ignoreGuard = false; priceOrder = null; }"
          >
            清空筛选条件
          </NButton>
        </template>
      </NEmpty>
      <NFlex
        v-else
        wrap
        justify="center"
        :gap="16"
      >
        <PointGoodsItem
          v-for="item in selectedItems"
          :key="item.id"
          :goods="item"
          content-style="max-width: 300px; min-width: 250px; height: 380px;"
          style="flex-grow: 1;"
        >
          <template #footer>
            <NFlex
              justify="space-between"
              align="center"
            >
              <NTooltip placement="bottom">
                <template #trigger>
                  <!-- 按钮禁用状态由 getTooltip 控制 -->
                  <NButton
                    :disabled="getTooltip(item) !== '开始兑换'"
                    size="small"
                    type="primary"
                    @click="onBuyClick(item)"
                  >
                    兑换
                  </NButton>
                </template>
                {{ getTooltip(item) }} <!-- 显示提示信息 -->
              </NTooltip>
              <NFlex
                align="center"
                justify="end"
                style="flex-grow: 1;"
              >
                <NTooltip placement="bottom">
                  <template #trigger>
                    <NText
                      style="font-size: 1.1em; font-weight: bold;"
                      :delete="item.canFreeBuy"
                    >
                      🪙
                      {{ item.price > 0 ? item.price : '免费' }}
                    </NText>
                  </template>
                  {{ item.canFreeBuy ? '你可以免费兑换此礼物' : '所需积分' }}
                </NTooltip>
              </NFlex>
            </NFlex>
          </template>
        </PointGoodsItem>
      </NFlex>
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
/* 可以添加一些 scoped 样式来优化布局或外观 */
.n-card {
  margin-bottom: 16px; /* 为卡片添加一些底部间距 */
}
</style>
