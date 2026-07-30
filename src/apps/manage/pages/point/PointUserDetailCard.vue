<script setup lang="ts">
import type {
  ResponsePointGoodModel,
  ResponsePointHisrotyModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointUserModel,
} from '@/api/api-models'
import { AddSquare24Regular, Info24Filled } from '@vicons/fluent'
import {
  NAvatar, NButton, NDivider, NEmpty, NFlex, NGrid, NGridItem, NIcon, NInput, NInputNumber, NModal, NSpin, NStatistic, NTabPane, NTabs, NTag, NTime, NTooltip, useMessage,
} from 'naive-ui'
import { computed, onMounted, ref } from 'vue'
import { QueryGetAPI } from '@/api/query'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { POINT_API_URL } from '@/shared/config'

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
const addPointReason = ref<string>('')

const emptyOpenId = '00000000-0000-0000-0000-000000000000'

type PointTarget =
  | { type: 'auth'; authId: number }
  | { type: 'uid'; userId: number }
  | { type: 'openid'; openId: string }

const pointTarget = computed<PointTarget | null>(() => {
  const info = props.user.info
  if (!info) {
    return null
  }
  if (info.id > 0) {
    return { type: 'auth', authId: info.id }
  }
  if (info.userId > 0) {
    return { type: 'uid', userId: info.userId }
  }
  if (info.openId && info.openId !== emptyOpenId) {
    return { type: 'openid', openId: info.openId }
  }
  return null
})

const canAdjustPoint = computed(() => pointTarget.value !== null)

function getHistoryParams(target: PointTarget) {
  switch (target.type) {
    case 'auth':
      return { authId: target.authId }
    case 'uid':
      return { id: target.userId }
    case 'openid':
      return { id: target.openId }
  }
}

function getGivePointParams(target: PointTarget) {
  switch (target.type) {
    case 'auth':
      return { authId: target.authId }
    case 'uid':
      return { uId: target.userId }
    case 'openid':
      return { oId: target.openId }
  }
}

async function getOrders() {
  const info = props.user.info
  if (!info || info.id <= 0) {
    return []
  }

  try {
    isLoading.value = true
    const data = await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(`${POINT_API_URL}get-user-orders`, {
      authId: info.id,
    })

    if (data.code == 200) {
      return data.data
    }
    else {
      message.error(`获取订单失败: ${data.message}`)
      console.error(data)
    }
  }
  catch (err) {
    message.error(`获取订单失败: ${err}`)
    console.error(err)
  }
  finally {
    isLoading.value = false
  }

  return []
}

async function getPointHistory() {
  try {
    isLoading.value = true

    const target = pointTarget.value
    if (!target) {
      return []
    }

    const data = await QueryGetAPI<ResponsePointHisrotyModel[]>(
      `${POINT_API_URL}get-user-histories`,
      getHistoryParams(target),
    )

    if (data.code == 200) {
      return data.data
    }
    else {
      message.error(`获取积分历史失败: ${data.message}`)
      console.error(data)
    }
  }
  catch (err) {
    message.error(`获取积分历史失败: ${err}`)
    console.error(err)
  }
  finally {
    isLoading.value = false
  }

  return []
}

async function givePoint() {
  if (addPointCount.value == 0) {
    message.error('积分数量不能为 0')
    return
  }

  isLoading.value = true
  try {
    const target = pointTarget.value
    if (!target) {
      message.error('无法识别积分目标用户')
      return
    }

    const data = await QueryGetAPI(`${POINT_API_URL}give-point`, {
      ...getGivePointParams(target),
      count: addPointCount.value,
      reason: addPointReason.value,
    })

    if (data.code == 200) {
      message.success('添加成功')
      showAddPointModal.value = false
      props.user.point = Number((props.user.point + addPointCount.value).toFixed(1))

      setTimeout(async () => {
        pointHistory.value = await getPointHistory()
      }, 1500)

      addPointCount.value = 0
      addPointReason.value = ''
    }
    else {
      message.error(`添加积分失败: ${data.message}`)
      console.error(data)
    }
  }
  catch (err) {
    message.error(`添加积分失败: ${err}`)
    console.error(err)
  }
  finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  pointHistory.value = await getPointHistory()

  if ((props.user.info?.id ?? 0) > 0) {
    orders.value = await getOrders()
  }
})
</script>

<template>
  <div class="user-detail-container">
    <!-- 用户基本信息 -->
    <div class="user-header">
      <NFlex
        justify="space-between"
        align="start"
        :wrap="false"
      >
        <NFlex
          :gap="16"
          align="center"
        >
          <NAvatar
            :src="user.info.avatar"
            round
            :size="64"
            fallback-src="/img/no-face.png"
            style="border: 1px solid var(--vtsuru-border);"
          />
          <div class="user-basic-info">
            <NFlex
              align="center"
              :gap="8"
              style="margin-bottom: 4px;"
            >
              <span class="user-name">{{ user.info.name || '未知用户' }}</span>
              <NTag
                :type="user.isAuthed ? 'success' : 'warning'"
                size="small"
                round
                :bordered="false"
              >
                {{ user.isAuthed ? '已认证' : '未认证' }}
              </NTag>
            </NFlex>
            <NFlex
              vertical
              :gap="2"
              class="user-ids"
            >
              <span v-if="user.info.userId > 0">UID: {{ user.info.userId }}</span>
              <span v-if="user.info.openId && user.info.openId !== emptyOpenId">OpenId: {{ user.info.openId }}</span>
            </NFlex>
          </div>
        </NFlex>

        <NButton
          type="primary"
          secondary
          :disabled="!canAdjustPoint"
          @click="showAddPointModal = true"
        >
          <template #icon>
            <NIcon :component="AddSquare24Regular" />
          </template>
          积分调整
        </NButton>
      </NFlex>

      <NDivider style="margin: 20px 0" />

      <NGrid
        cols="2 400:4"
        :x-gap="24"
        :y-gap="12"
      >
        <NGridItem>
          <NStatistic
            label="当前积分"
            :value="user.point"
            :precision="1"
          />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="订单总数"
            :value="user.orderCount"
          />
        </NGridItem>
        <NGridItem>
          <div class="info-item-static">
            <div class="info-label">
              认证时间
            </div>
            <div class="info-value">
              <NTime
                v-if="user.isAuthed"
                :time="user.info.createAt"
              />
              <span v-else>--</span>
            </div>
          </div>
        </NGridItem>
      </NGrid>
    </div>

    <!-- 数据标签页 -->
    <div class="data-tabs">
      <NTabs
        type="line"
        animated
        default-value="orders"
      >
        <NTabPane
          name="orders"
          tab="订单记录"
        >
          <NSpin :show="isLoading">
            <NEmpty
              v-if="orders.length === 0"
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
        </NTabPane>
        <NTabPane
          name="history"
          tab="积分流水"
        >
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
        </NTabPane>
      </NTabs>
    </div>

    <!-- 积分调整弹窗 -->
    <NModal
      v-model:show="showAddPointModal"
      preset="card"
      style="width: 480px; max-width: 90vw;"
      title="给予/扣除积分"
      :bordered="false"
      size="small"
    >
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
            placeholder="积分数量"
            style="flex: 1"
          >
            <template #prefix>
              <NIcon :component="AddSquare24Regular" />
            </template>
          </NInputNumber>

          <NTooltip>
            <template #trigger>
              <NIcon
                :component="Info24Filled"
                class="info-icon"
              />
            </template>
            正数为给予，负数为扣除
          </NTooltip>
        </NFlex>

        <NInput
          v-model:value="addPointReason"
          placeholder="请输入备注 (可选)"
          :maxlength="100"
          show-count
          clearable
          type="textarea"
          :autosize="{ minRows: 2, maxRows: 4 }"
        />

        <div style="display: flex; justify-content: flex-end;">
          <NButton
            type="primary"
            :loading="isLoading"
            :disabled="!canAdjustPoint || !addPointCount || addPointCount === 0"
            @click="givePoint"
          >
            {{ !addPointCount || addPointCount === 0 ? '确定' : (addPointCount > 0 ? '确认给予' : '确认扣除') }}
          </NButton>
        </div>
      </NFlex>
    </NModal>
  </div>
</template>

<style scoped>
.user-detail-container {
  padding: 20px;
}

.user-header {
  background-color: var(--vtsuru-bg-surface);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 24px;
  margin-bottom: 16px;
}

.user-name {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.user-ids {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
}

.info-item-static {
  display: flex;
  flex-direction: column;
}

.info-label {
  font-size: 12px;
  color: var(--vtsuru-fg-muted);
  margin-bottom: 4px;
}

.info-value {
  font-size: 20px; /* match NStatistic value size approximately */
  color: var(--vtsuru-fg);
  font-variant-numeric: tabular-nums;
}

.data-tabs {
  background-color: var(--vtsuru-bg-surface);
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  padding: 16px 24px;
}

.empty-container {
  margin: 32px 0;
  min-height: 100px;
}

.info-icon {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}
</style>
