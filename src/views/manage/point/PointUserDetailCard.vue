<script setup lang="ts">
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
import { useAuthStore } from '@/store/useAuthStore'
import {
  DataTableColumns,
  NButton,
  NCard,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NDivider,
  NEmpty,
  NFlex,
  NInput,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NSpin,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { h, onMounted, ref } from 'vue'

const props = defineProps<{
  user: ResponsePointUserModel
  goods: ResponsePointGoodModel[]
}>()

const message = useMessage()

const isLoading = ref(false)
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const pointHistory = ref<ResponsePointHisrotyModel[]>([])

const showAddPointModal = ref(false)
const addPointCount = ref(0)
const addPointReason = ref<string>()

async function getOrders() {
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
async function getPointHistory() {
  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointHisrotyModel[]>(
      POINT_API_URL + 'get-user-histories',
      props.user.info.id > 0
        ? {
            authId: props.user.info.id,
          }
        : {
            id: props.user.info.userId ?? props.user.info.openId,
          },
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
async function givePoint() {
  if (addPointCount.value <= 0) {
    message.error('积分数量必须大于0')
    return
  }
  isLoading.value = true
  try {
    const data = await QueryGetAPI(POINT_API_URL + 'give-point', {
      authId: props.user.info?.id,
      count: addPointCount.value,
      reason: addPointReason.value,
    })
    if (data.code == 200) {
      message.success('添加成功')
      showAddPointModal.value = false
      props.user.point += addPointCount.value
      setTimeout(async () => {
        pointHistory.value = await getPointHistory()
      }, 1500)
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

onMounted(async () => {
  pointHistory.value = await getPointHistory()
  if (props.user.info?.id) {
    orders.value = await getOrders()
  }
})
</script>

<template>
  <NCard :bordered="false" content-style="padding-top: 0">
    <NCard :title="`用户信息 | ${user.isAuthed ? '已认证' : '未认证'}`">
      <template #header>
        <NFlex align="center">
          <NTag :bordered="false" :type="user.isAuthed ? 'success' : 'error'" size="small">
            {{ user.isAuthed ? '已认证' : '未认证' }}
          </NTag>
          关于
        </NFlex>
      </template>
      <NDescriptions label-placement="left" bordered size="small">
        <NDescriptionsItem label="用户名">
          {{ user.info.name }}
        </NDescriptionsItem>
        <NDescriptionsItem v-if="user.info.userId > 0" label="UId">
          {{ user.info.userId }}
        </NDescriptionsItem>
        <NDescriptionsItem v-else label="OpenId">
          {{ user.info.openId }}
        </NDescriptionsItem>
        <NDescriptionsItem label="积分">
          {{ user.point }}
        </NDescriptionsItem>
        <NDescriptionsItem v-if="user.isAuthed" label="认证时间">
          <NTime :time="user.info.createAt" />
        </NDescriptionsItem>
      </NDescriptions>
      <template #footer>
        <NFlex>
          <NTooltip :disabled="user.isAuthed">
            <template #trigger>
              <NButton type="primary" @click="showAddPointModal = true" :disabled="!user.isAuthed" size="small">
                给予积分
              </NButton>
            </template>
            <NText> 未认证用户无法给予积分 </NText>
          </NTooltip>
        </NFlex>
      </template>
    </NCard>
    <NDivider> 订单 </NDivider>
    <NSpin :show="isLoading">
      <template v-if="orders.length == 0">
        <NEmpty description="暂无订单" />
      </template>
      <PointOrderCard v-else :order="orders" type="owner" :goods="goods" />
    </NSpin>
    <NDivider> 积分历史 </NDivider>
    <NSpin :show="isLoading">
      <PointHistoryCard :histories="pointHistory" />
    </NSpin>
    <NModal v-model:show="showAddPointModal" preset="card" style="width: 500px; max-width: 90vw; height: auto">
      <template #header> 给予积分 </template>
      <NFlex vertical>
        <NInputNumber
          v-model:value="addPointCount"
          type="number"
          placeholder="请输入积分数量"
          min="0"
          style="max-width: 120px"
        />
        <NInput placeholder="请输入备注" v-model:value="addPointReason" :maxlength="100" show-count clearable />
        <NButton type="primary" @click="givePoint" :loading="isLoading"> 给予 </NButton>
      </NFlex>
    </NModal>
  </NCard>
</template>
