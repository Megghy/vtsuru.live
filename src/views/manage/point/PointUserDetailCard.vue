<script setup lang="ts">
import { GuidUtils } from '@/Utils'
import {
  ResponsePointGoodModel,
  ResponsePointHisrotyModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointUserModel,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import PointHistoryCard from '@/components/manage/PointHistoryCard.vue'
import PointOrderCard from '@/components/manage/PointOrderCard.vue'
import { POINT_API_URL } from '@/data/constants'
import { Info24Filled } from '@vicons/fluent'
import {
  NButton,
  NCard,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NEmpty,
  NFlex,
  NInput,
  NInputNumber,
  NModal,
  NSpin,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { onMounted, ref } from 'vue'

// 组件属性定义
const props = defineProps<{
  user: ResponsePointUserModel
  goods: ResponsePointGoodModel[]
}>()

const message = useMessage()

// 加载状态
const isLoading = ref(false)
// 用户订单列表
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
// 用户积分历史
const pointHistory = ref<ResponsePointHisrotyModel[]>([])

// 积分调整弹窗状态
const showAddPointModal = ref(false)
const addPointCount = ref(0)
const addPointReason = ref<string>('')

// 获取用户订单
async function getOrders() {
  if (!props.user.info?.id) {
    return []
  }

  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(POINT_API_URL + 'get-user-orders', {
      authId: props.user.info?.id,
    })

    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取订单失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('获取订单失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }

  return []
}

// 获取用户积分历史
async function getPointHistory() {
  try {
    isLoading.value = true

    // 根据用户认证状态使用不同的请求参数
    const params = props.user.info.id > 0
      ? { authId: props.user.info.id }
      : { id: props.user.info.userId ?? props.user.info.openId }

    const data = await QueryGetAPI<ResponsePointHisrotyModel[]>(
      POINT_API_URL + 'get-user-histories',
      params
    )

    if (data.code == 200) {
      return data.data
    } else {
      message.error('获取积分历史失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('获取积分历史失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }

  return []
}

// 给用户增加/减少积分
async function givePoint() {
  // 验证积分数量
  if (addPointCount.value == 0) {
    message.error('积分数量不能为 0')
    return
  }

  isLoading.value = true
  try {
    // 根据用户认证状态构建不同的请求参数
    let params = {}

    if (props.user.info?.id >= 0) {
      params = {
        authId: props.user.info?.id,
        count: addPointCount.value,
        reason: addPointReason.value ?? '',
      }
    } else if (props.user.info?.userId) {
      params = {
        uId: props.user.info?.userId,
        count: addPointCount.value,
        reason: addPointReason.value ?? '',
      }
    } else {
      params = {
        oId: props.user.info?.openId,
        count: addPointCount.value,
        reason: addPointReason.value ?? '',
      }
    }

    const data = await QueryGetAPI(POINT_API_URL + 'give-point', params)

    if (data.code == 200) {
      message.success('添加成功')
      showAddPointModal.value = false
      props.user.point += addPointCount.value

      // 重新加载积分历史
      setTimeout(async () => {
        pointHistory.value = await getPointHistory()
      }, 1500)

      // 重置表单
      addPointCount.value = 0
      addPointReason.value = ''
    } else {
      message.error('添加积分失败: ' + data.message)
      console.error(data)
    }
  } catch (err) {
    message.error('添加积分失败: ' + err)
    console.error(err)
  } finally {
    isLoading.value = false
  }
}

// 组件挂载时加载数据
onMounted(async () => {
  pointHistory.value = await getPointHistory()

  if (props.user.info?.id) {
    orders.value = await getOrders()
  }
})
</script>

<template>
  <NCard
    :bordered="false"
    content-style="padding-top: 0"
    class="user-detail-card"
  >
    <!-- 用户基本信息 -->
    <NCard :title="`用户信息 | ${user.isAuthed ? '已认证' : '未认证'}`">
      <template #header>
        <NFlex
          align="center"
          :gap="8"
        >
          <NTag
            :bordered="false"
            :type="user.isAuthed ? 'success' : 'error'"
            size="small"
          >
            {{ user.isAuthed ? '已认证' : '未认证' }}
          </NTag>
          <span>关于</span>
        </NFlex>
      </template>

      <NDescriptions
        label-placement="left"
        bordered
        size="small"
        :column="2"
      >
        <NDescriptionsItem label="用户名">
          {{ user.info.name || '未知' }}
        </NDescriptionsItem>

        <NDescriptionsItem
          v-if="user.info.userId > 0"
          label="UId"
        >
          {{ user.info.userId }}
        </NDescriptionsItem>

        <NDescriptionsItem
          v-if="user.info.openId && user.info.openId != '00000000-0000-0000-0000-000000000000'"
          label="OpenId"
        >
          {{ user.info.openId }}
        </NDescriptionsItem>

        <NDescriptionsItem label="积分">
          {{ user.point }}
        </NDescriptionsItem>

        <NDescriptionsItem
          v-if="user.isAuthed"
          label="认证时间"
        >
          <NTime :time="user.info.createAt" />
        </NDescriptionsItem>
      </NDescriptions>

      <template #footer>
        <NFlex justify="end">
          <NButton
            type="primary"
            size="small"
            @click="showAddPointModal = true"
          >
            给予/扣除积分
          </NButton>
        </NFlex>
      </template>
    </NCard>

    <!-- 订单信息 -->
    <NDivider> 订单 </NDivider>
    <NSpin :show="isLoading">
      <NEmpty
        v-if="orders.length == 0"
        description="暂无订单"
        class="empty-container"
      />
      <PointOrderCard
        v-else
        :order="orders"
        type="owner"
        :goods="goods"
      />
    </NSpin>

    <!-- 积分历史 -->
    <NDivider> 积分历史 </NDivider>
    <NSpin :show="isLoading">
      <NEmpty
        v-if="!pointHistory.length"
        description="暂无积分记录"
        class="empty-container"
      />
      <PointHistoryCard
        v-else
        :histories="pointHistory"
      />
    </NSpin>

    <!-- 积分调整弹窗 -->
    <NModal
      v-model:show="showAddPointModal"
      preset="card"
      style="width: 500px; max-width: 90vw; height: auto"
    >
      <template #header>
        给予/扣除积分
      </template>

      <NFlex
        vertical
        :gap="16"
      >
        <NFlex
          align="center"
          :wrap="false"
          :gap="8"
        >
          <NInputNumber
            v-model:value="addPointCount"
            type="number"
            placeholder="负数为扣除"
            style="max-width: 120px"
          />

          <NTooltip>
            <template #trigger>
              <NIcon :component="Info24Filled" />
            </template>
            负数为扣除积分
          </NTooltip>
        </NFlex>

        <NInput
          v-model:value="addPointReason"
          placeholder="请输入备注"
          :maxlength="100"
          show-count
          clearable
        />

        <NButton
          type="primary"
          :loading="isLoading"
          @click="givePoint"
        >
          {{ addPointCount > 0 ? '给予' : '扣除' }}
        </NButton>
      </NFlex>
    </NModal>
  </NCard>
</template>

<style scoped>
.user-detail-card {
  width: 100%;
}

.empty-container {
  margin: 16px 0;
  min-height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
