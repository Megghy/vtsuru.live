<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import type { ResponsePointGoodModel, ResponsePointUserModel } from '@/api/api-models'
import { QueryGetAPI as get, QueryPostAPI as post } from '@/api/query'
import { POINT_API_URL } from '@/shared/config'

interface EligibilityResult {
  eligible: boolean
  reason?: string
  userPoint: number
  purchasedCount: number
  canFreeBuy: boolean
  currentGuardLevel: number
  requestCount: number
  needPoint: number
}

type EligibleUserKey = `auth:${number}` | `uid:${number}` | `oid:${string}`

const accountInfo = useAccount()
const toast = useToast()
const testForm = ref({
  type: EventDataTypes.Message,
  giftName: '',
  giftPrice: 0,
  giftCount: 1,
  guardLevel: '舰长',
})
const testAccountPoint = ref(0)
const isLoading = ref(false)
const isTesting = ref(false)
const resetOpen = ref(false)
const eligibilityForm = ref({ count: 1 })
const isLoadingEligibilityOptions = ref(false)
const allUsers = ref<ResponsePointUserModel[]>([])
const allGoods = ref<ResponsePointGoodModel[]>([])
const selectedUserKey = ref<EligibleUserKey | null>(null)
const selectedGoodsId = ref<number | null>(null)
const isCheckingEligibility = ref(false)
const eligibilityResult = ref<EligibilityResult | null>(null)

const eventTypeOptions = [
  { label: '弹幕', value: EventDataTypes.Message },
  { label: '礼物', value: EventDataTypes.Gift },
  { label: '上舰', value: EventDataTypes.Guard },
  { label: 'SC', value: EventDataTypes.SC },
]
const guardLevelOptions = [
  { label: '舰长', value: '舰长' },
  { label: '提督', value: '提督' },
  { label: '总督', value: '总督' },
]
const userOptions = computed(() =>
  allUsers.value.map((user) => {
    const authId = user.info?.id ?? -1
    const userId = user.info?.userId ?? -1
    const openId = user.info?.openId ?? ''
    const value: EligibleUserKey =
      user.isAuthed && authId > 0 ? `auth:${authId}` : userId > 0 ? `uid:${userId}` : `oid:${openId}`
    const identity =
      user.isAuthed && authId > 0 ? `AuthId: ${authId}` : userId > 0 ? `UID: ${userId}` : `OID: ${openId}`
    return { label: `${user.info?.name || '未知用户'} (${identity})`, value }
  }),
)
const goodsOptions = computed(() =>
  allGoods.value.map((goods) => ({ label: `${goods.name} (#${goods.id})`, value: goods.id })),
)
const selectedGoods = computed(() => allGoods.value.find((goods) => goods.id === selectedGoodsId.value) ?? null)
const showGiftFields = computed(() => testForm.value.type === EventDataTypes.Gift)
const showGuardFields = computed(() => testForm.value.type === EventDataTypes.Guard)

function notify(title: string, color: 'success' | 'error' | 'warning' | 'info' = 'info') {
  toast.add({ title, color })
}

async function fetchTestAccountPoint() {
  isLoading.value = true
  try {
    const result = await get<number>(`${POINT_API_URL}get-test-account-point`)
    if (result.code === 200) testAccountPoint.value = result.data ?? 0
  } catch (error) {
    console.error('获取测试账户积分失败:', error)
    notify('获取测试账户积分失败', 'error')
  } finally {
    isLoading.value = false
  }
}

async function runTest() {
  const state = testForm.value
  if (state.type === EventDataTypes.Gift && !state.giftName.trim()) return notify('请输入礼物名称', 'error')
  if (state.type === EventDataTypes.Gift && state.giftPrice < 0) return notify('礼物价格不能为负数', 'error')
  if (state.type === EventDataTypes.SC && state.giftPrice <= 0) return notify('SC价格必须大于0', 'error')

  isTesting.value = true
  try {
    const payload: Record<string, unknown> = { type: state.type }
    if (state.type === EventDataTypes.Gift)
      Object.assign(payload, { giftName: state.giftName, giftPrice: state.giftPrice, giftCount: state.giftCount })
    if (state.type === EventDataTypes.Guard) payload.guardLevel = state.guardLevel
    if (state.type === EventDataTypes.SC) payload.giftPrice = state.giftPrice
    const result = await post<{ success: boolean; message: string }>(`${POINT_API_URL}test-point`, payload)
    if (result.code !== 200 || !result.data) return notify(result.message || '测试失败', 'error')
    notify(result.data.message, result.data.success ? 'success' : 'warning')
    if (result.data.success) await fetchTestAccountPoint()
  } catch (error) {
    console.error('测试失败:', error)
    notify(`测试失败: ${String(error)}`, 'error')
  } finally {
    isTesting.value = false
  }
}

async function resetTestAccount() {
  isLoading.value = true
  try {
    const result = await post(`${POINT_API_URL}reset-test-account`, {})
    if (result.code !== 200) return notify(result.message || '重置失败', 'error')
    testAccountPoint.value = 0
    resetOpen.value = false
    notify('测试账户已重置', 'success')
  } catch (error) {
    console.error('重置失败:', error)
    notify(`重置失败: ${String(error)}`, 'error')
  } finally {
    isLoading.value = false
  }
}

async function loadEligibilityOptions() {
  if (!accountInfo.value?.id) return
  isLoadingEligibilityOptions.value = true
  try {
    const [usersResult, goodsResult] = await Promise.all([
      get<ResponsePointUserModel[]>(`${POINT_API_URL}get-all-users`),
      get<ResponsePointGoodModel[]>(`${POINT_API_URL}get-goods`, { id: accountInfo.value.id }),
    ])
    if (usersResult.code === 200) allUsers.value = usersResult.data ?? []
    else notify(usersResult.message || '加载用户列表失败', 'error')
    if (goodsResult.code === 200) allGoods.value = goodsResult.data ?? []
    else notify(goodsResult.message || '加载礼物列表失败', 'error')
  } catch (error) {
    console.error('加载下拉选项失败:', error)
    notify(`加载下拉选项失败: ${String(error)}`, 'error')
  } finally {
    isLoadingEligibilityOptions.value = false
  }
}

async function checkEligibility() {
  if (!selectedGoodsId.value) return notify('请选择礼物', 'error')
  if (!selectedUserKey.value) return notify('请选择用户', 'error')
  if (eligibilityForm.value.count < 1) return notify('兑换数量不能小于 1', 'error')

  isCheckingEligibility.value = true
  eligibilityResult.value = null
  try {
    const params: Record<string, string | number> = {
      goodsId: selectedGoodsId.value,
      count: eligibilityForm.value.count,
    }
    const key = selectedUserKey.value
    if (key.startsWith('auth:')) params.authId = Number(key.slice(5))
    else if (key.startsWith('uid:')) params.uId = Number(key.slice(4))
    else params.oId = key.slice(4)
    const result = await get<EligibilityResult>(`${POINT_API_URL}check-eligibility`, params)
    if (result.code === 200 && result.data) eligibilityResult.value = result.data
    else notify(result.message || '查询失败', 'error')
  } catch (error) {
    console.error('查询失败:', error)
    notify(`查询失败: ${String(error)}`, 'error')
  } finally {
    isCheckingEligibility.value = false
  }
}

void fetchTestAccountPoint()
void loadEligibilityOptions()
</script>

<template>
  <UCard>
    <template #header>
      <div class="card-heading">
        <div>
          <h2>积分测试系统</h2>
          <p>测试事件积分与兑换资格</p>
        </div>
        <UBadge
          color="info"
          variant="subtle"
          label="测试账户 OUId: 00000000-0000-0000-0000-000000000000"
        />
      </div>
    </template>
    <div
      class="panel-stack"
      :aria-busy="isLoading"
    >
      <UAlert
        color="info"
        icon="i-lucide-info"
        title="测试账户"
        description="所有测试事件会记录到专用 mock 账户，可以在这里验证不同事件类型的积分配置。"
      />
      <section class="metric-row">
        <div>
          <span>测试账户当前积分</span><strong>{{ testAccountPoint }}<small>分</small></strong>
        </div>
        <UButton
          color="error"
          variant="soft"
          icon="i-lucide-rotate-ccw"
          label="重置积分"
          :loading="isLoading"
          @click="resetOpen = true"
        />
      </section>
      <USeparator label="测试事件模拟" />
      <form
        class="form-grid"
        @submit.prevent="runTest"
      >
        <UFormField
          label="事件类型"
          required
          ><USelect
            v-model="testForm.type"
            :items="eventTypeOptions"
        /></UFormField>
        <template v-if="showGiftFields"
          ><UFormField
            label="礼物名称"
            required
            ><UInput
              v-model="testForm.giftName"
              placeholder="例如: 小心心、辣条" /></UFormField
          ><UFormField
            label="礼物价格"
            required
            ><UInputNumber
              v-model="testForm.giftPrice"
              :min="0"
              :step="0.01" /></UFormField
          ><UFormField label="礼物数量"
            ><UInputNumber
              v-model="testForm.giftCount"
              :min="1" /></UFormField
        ></template>
        <UFormField
          v-if="showGuardFields"
          label="舰长等级"
          required
          ><USelect
            v-model="testForm.guardLevel"
            :items="guardLevelOptions"
        /></UFormField>
        <UFormField
          v-if="testForm.type === EventDataTypes.SC"
          label="SC价格"
          required
          ><UInputNumber
            v-model="testForm.giftPrice"
            :min="0.01"
            :step="0.01"
        /></UFormField>
        <div class="form-actions">
          <UButton
            type="submit"
            icon="i-lucide-play"
            label="执行测试"
            :loading="isTesting"
          />
        </div>
      </form>
      <UAlert
        v-if="!accountInfo?.settings?.point"
        color="warning"
        icon="i-lucide-triangle-alert"
        title="请先配置积分设置"
      />
      <USeparator label="兑换资格查询" />
      <section
        class="form-grid"
        :aria-busy="isCheckingEligibility || isLoadingEligibilityOptions"
      >
        <UFormField
          label="目标用户"
          required
          ><USelectMenu
            v-model="selectedUserKey"
            :items="userOptions"
            value-key="value"
            searchable
            placeholder="请选择用户"
        /></UFormField>
        <UFormField
          label="礼物"
          required
          ><USelectMenu
            v-model="selectedGoodsId"
            :items="goodsOptions"
            value-key="value"
            searchable
            placeholder="请选择礼物"
        /></UFormField>
        <UFormField
          label="兑换数量"
          required
          ><UInputNumber
            v-model="eligibilityForm.count"
            :min="1"
        /></UFormField>
        <UAlert
          v-if="selectedGoods"
          color="info"
          :title="`当前选择: ${selectedGoods.name} (ID: ${selectedGoods.id})`"
        />
        <div class="form-actions">
          <UButton
            icon="i-lucide-search"
            label="查询"
            :loading="isCheckingEligibility"
            :disabled="!selectedUserKey || !selectedGoodsId"
            @click="checkEligibility"
          />
        </div>
      </section>
      <UAlert
        v-if="eligibilityResult"
        :color="eligibilityResult.eligible ? 'success' : 'error'"
        :title="eligibilityResult.eligible ? '可兑换' : '不可兑换'"
        :description="eligibilityResult.eligible ? undefined : `原因: ${eligibilityResult.reason || '未知原因'}`"
        ><template #description
          ><div v-if="!eligibilityResult.eligible">原因: {{ eligibilityResult.reason || '未知原因' }}</div>
          <div class="result-tags">
            <UBadge
              :color="eligibilityResult.canFreeBuy ? 'success' : 'neutral'"
              :label="eligibilityResult.canFreeBuy ? '可免费兑换' : '非免费兑换'"
            /><UBadge
              color="info"
              :label="`当前积分: ${eligibilityResult.userPoint}`"
            /><UBadge
              color="info"
              :label="`已兑换次数: ${eligibilityResult.purchasedCount}`"
            /><UBadge
              color="warning"
              :label="`需要积分: ${eligibilityResult.needPoint}`"
            /></div></template
      ></UAlert>
    </div>
  </UCard>
  <UModal
    v-model:open="resetOpen"
    title="重置测试账户"
    ><template #body>测试账户的积分将归零。</template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="resetOpen = false"
        /><UButton
          color="error"
          label="确认重置"
          :loading="isLoading"
          @click="resetTestAccount"
        /></div></template
  ></UModal>
</template>

<style scoped>
.card-heading,
.metric-row,
.form-actions,
.modal-actions,
.result-tags {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card-heading,
.metric-row {
  justify-content: space-between;
}
.card-heading h2 {
  margin: 0;
  font-size: 16px;
}
.card-heading p,
.metric-row span {
  margin: 4px 0 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.panel-stack {
  display: grid;
  gap: 24px;
}
.metric-row {
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
}
.metric-row strong {
  display: block;
  margin-top: 4px;
  font-size: 28px;
}
.metric-row small {
  margin-left: 4px;
  font-size: 14px;
  font-weight: 400;
}
.form-grid {
  display: grid;
  gap: 16px;
  max-width: 640px;
}
.form-actions,
.modal-actions {
  justify-content: flex-end;
}
.result-tags {
  flex-wrap: wrap;
  margin-top: 12px;
}
@media (max-width: 640px) {
  .card-heading,
  .metric-row {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
