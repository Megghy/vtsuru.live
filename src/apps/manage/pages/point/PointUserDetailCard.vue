<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import type {
  ResponsePointGoodModel,
  ResponsePointHisrotyModel,
  ResponsePointOrder2OwnerModel,
  ResponsePointUserModel,
} from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { formatTime } from '@/apps/manage/composables/formatters'
import PointHistoryCard from '@/shared/components/points/PointHistoryCard.vue'
import PointOrderCard from '@/shared/components/points/PointOrderCard.vue'
import { POINT_API_URL } from '@/shared/config'

const props = defineProps<{ user: ResponsePointUserModel; goods: ResponsePointGoodModel[] }>()
const toast = useToast()
const isLoading = ref(false)
const orders = ref<ResponsePointOrder2OwnerModel[]>([])
const pointHistory = ref<ResponsePointHisrotyModel[]>([])
const showAddPointModal = ref(false)
const addPointCount = ref(0)
const addPointReason = ref('')
const activeTab = ref('orders')
const emptyOpenId = '00000000-0000-0000-0000-000000000000'

type PointTarget =
  | { type: 'auth'; authId: number }
  | { type: 'uid'; userId: number }
  | { type: 'openid'; openId: string }

const pointTarget = computed<PointTarget | null>(() => {
  const info = props.user.info
  if (info.id > 0) return { type: 'auth', authId: info.id }
  if (info.userId > 0) return { type: 'uid', userId: info.userId }
  return info.openId && info.openId !== emptyOpenId ? { type: 'openid', openId: info.openId } : null
})
const canAdjustPoint = computed(() => pointTarget.value !== null)
const tabItems = [
  { label: '订单记录', value: 'orders' },
  { label: '积分流水', value: 'history' },
]

function notify(title: string, color: 'success' | 'error' = 'error') {
  toast.add({ title, color })
}

function getHistoryParams(target: PointTarget) {
  return target.type === 'auth'
    ? { authId: target.authId }
    : target.type === 'uid'
      ? { id: target.userId }
      : { id: target.openId }
}

function getGivePointParams(target: PointTarget) {
  return target.type === 'auth'
    ? { authId: target.authId }
    : target.type === 'uid'
      ? { uId: target.userId }
      : { oId: target.openId }
}

async function getOrders() {
  if (props.user.info.id <= 0) return []
  isLoading.value = true
  try {
    const result = await QueryGetAPI<ResponsePointOrder2OwnerModel[]>(`${POINT_API_URL}get-user-orders`, {
      authId: props.user.info.id,
    })
    if (result.code === 200) return result.data ?? []
    notify(`获取订单失败: ${result.message}`)
  } catch (error) {
    console.error(error)
    notify(`获取订单失败: ${String(error)}`)
  } finally {
    isLoading.value = false
  }
  return []
}

async function getPointHistory() {
  const target = pointTarget.value
  if (!target) return []
  isLoading.value = true
  try {
    const result = await QueryGetAPI<ResponsePointHisrotyModel[]>(
      `${POINT_API_URL}get-user-histories`,
      getHistoryParams(target),
    )
    if (result.code === 200) return result.data ?? []
    notify(`获取积分历史失败: ${result.message}`)
  } catch (error) {
    console.error(error)
    notify(`获取积分历史失败: ${String(error)}`)
  } finally {
    isLoading.value = false
  }
  return []
}

async function givePoint() {
  if (!addPointCount.value) return notify('积分数量不能为 0')
  const target = pointTarget.value
  if (!target) return notify('无法识别积分目标用户')
  isLoading.value = true
  try {
    const result = await QueryGetAPI(`${POINT_API_URL}give-point`, {
      ...getGivePointParams(target),
      count: addPointCount.value,
      reason: addPointReason.value,
    })
    if (result.code !== 200) return notify(`添加积分失败: ${result.message}`)
    props.user.point = Number((props.user.point + addPointCount.value).toFixed(1))
    showAddPointModal.value = false
    addPointCount.value = 0
    addPointReason.value = ''
    pointHistory.value = await getPointHistory()
    notify('积分已调整', 'success')
  } catch (error) {
    console.error(error)
    notify(`添加积分失败: ${String(error)}`)
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  pointHistory.value = await getPointHistory()
  orders.value = await getOrders()
})
</script>

<template>
  <div class="user-detail">
    <section class="user-summary">
      <div class="user-top">
        <div class="identity">
          <img
            :src="user.info.avatar || '/img/no-face.png'"
            :alt="user.info.name || '用户头像'"
          />
          <div>
            <div class="name-line">
              <strong>{{ user.info.name || '未知用户' }}</strong
              ><UBadge
                :color="user.isAuthed ? 'success' : 'warning'"
                :label="user.isAuthed ? '已认证' : '未认证'"
              />
            </div>
            <p v-if="user.info.userId > 0">UID: {{ user.info.userId }}</p>
            <p v-if="user.info.openId && user.info.openId !== emptyOpenId">OpenId: {{ user.info.openId }}</p>
          </div>
        </div>
        <UButton
          icon="i-lucide-circle-plus"
          label="积分调整"
          :disabled="!canAdjustPoint"
          @click="showAddPointModal = true"
        />
      </div>
      <USeparator />
      <dl class="stats">
        <div>
          <dt>当前积分</dt>
          <dd>{{ user.point.toFixed(1) }}</dd>
        </div>
        <div>
          <dt>订单总数</dt>
          <dd>{{ user.orderCount }}</dd>
        </div>
        <div>
          <dt>认证时间</dt>
          <dd>{{ user.isAuthed ? formatTime(user.info.createAt) : '--' }}</dd>
        </div>
      </dl>
    </section>
    <section
      class="records"
      :aria-busy="isLoading"
    >
      <UTabs
        v-model="activeTab"
        :items="tabItems"
      />
      <div
        v-if="activeTab === 'orders'"
        class="tab-content"
      >
        <UEmpty
          v-if="!orders.length"
          icon="i-lucide-package-open"
          title="暂无订单"
        /><PointOrderCard
          v-else
          :order="orders"
          type="owner"
          :goods="goods"
        />
      </div>
      <div
        v-else
        class="tab-content"
      >
        <UEmpty
          v-if="!pointHistory.length"
          icon="i-lucide-list-x"
          title="暂无积分记录"
        /><PointHistoryCard
          v-else
          :histories="pointHistory"
        />
      </div>
    </section>
  </div>
  <UModal
    v-model:open="showAddPointModal"
    title="给予/扣除积分"
    ><template #body
      ><div class="adjust-form">
        <UFormField
          label="积分数量"
          description="正数为给予，负数为扣除"
          ><UInputNumber
            v-model="addPointCount"
            :min="-99999999"
            :max="99999999" /></UFormField
        ><UFormField label="备注"
          ><UTextarea
            v-model="addPointReason"
            :maxlength="100"
            :rows="3"
            placeholder="可选"
        /></UFormField></div></template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="showAddPointModal = false"
        /><UButton
          :color="addPointCount < 0 ? 'error' : 'primary'"
          :label="addPointCount > 0 ? '确认给予' : addPointCount < 0 ? '确认扣除' : '确定'"
          :loading="isLoading"
          :disabled="!addPointCount"
          @click="givePoint"
        /></div></template
  ></UModal>
</template>

<style scoped>
.user-detail {
  display: grid;
  gap: 16px;
  padding: 20px;
}
.user-summary,
.records {
  padding: 20px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-surface);
}
.user-top,
.identity,
.name-line,
.modal-actions {
  display: flex;
  gap: 12px;
  align-items: center;
}
.user-top {
  justify-content: space-between;
}
.identity img {
  width: 64px;
  height: 64px;
  border: 1px solid var(--vtsuru-border);
  border-radius: 999px;
  object-fit: cover;
}
.name-line strong {
  font-size: 18px;
}
.identity p {
  margin: 3px 0;
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 20px;
  margin: 0;
}
.stats dt {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.stats dd {
  margin: 5px 0 0;
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.tab-content {
  padding-top: 16px;
}
.adjust-form {
  display: grid;
  gap: 16px;
}
.modal-actions {
  justify-content: flex-end;
}
@media (max-width: 640px) {
  .user-top {
    align-items: flex-start;
    flex-direction: column;
  }
  .stats {
    grid-template-columns: 1fr;
  }
}
</style>
