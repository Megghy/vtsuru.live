<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NCard, NButton, NForm, NFormItem, NInputNumber, NInput, NSelect, NFlex, NAlert, NStatistic, NPopconfirm, useMessage, NSpin, NTag, NDivider } from 'naive-ui';
import type { SelectOption } from 'naive-ui'
import { EventDataTypes   } from '@/api/api-models'
import type {ResponsePointGoodModel, ResponsePointUserModel} from '@/api/api-models';
import { useAccount } from '@/api/account'
import { QueryPostAPI as Post, QueryGetAPI as Get } from '@/api/query'
import { POINT_API_URL } from '@/shared/config'

const message = useMessage()
const accountInfo = useAccount()

// 测试表单数据
const testForm = ref({
  type: EventDataTypes.Message,
  giftName: '',
  giftPrice: 0,
  giftCount: 1,
  guardLevel: '舰长',
})

// 测试账户积分
const testAccountPoint = ref<number>(0)
const isLoading = ref(false)
const isTesting = ref(false)

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

const eligibilityForm = ref<{ count: number }>({
  count: 1,
})

const isLoadingEligibilityOptions = ref(false)
const allUsers = ref<ResponsePointUserModel[]>([])
const allGoods = ref<ResponsePointGoodModel[]>([])

const selectedUserKey = ref<EligibleUserKey | null>(null)
const selectedGoodsId = ref<number | null>(null)

const userOptions = computed<SelectOption[]>(() => {
  return allUsers.value.map((u) => {
    const authId = u?.info?.id ?? -1
    const uid = u?.info?.userId ?? -1
    const openId = u?.info?.openId

    let key: EligibleUserKey
    if (u.isAuthed && authId > 0) {
      key = `auth:${authId}`
    } else if (uid > 0) {
      key = `uid:${uid}`
    } else {
      key = `oid:${openId}`
    }

    const userName = u?.info?.name || '未知用户'
    const suffix = u.isAuthed && authId > 0
      ? `AuthId: ${authId}`
      : uid > 0
        ? `UID: ${uid}`
        : `OID: ${openId}`

    return {
      label: `${userName} (${suffix})`,
      value: key,
    } satisfies SelectOption
  })
})

const goodsOptions = computed<SelectOption[]>(() => {
  return allGoods.value.map(g => ({
    label: `${g.name} (#${g.id})`,
    value: g.id,
  }))
})

const selectedGoods = computed(() => {
  if (!selectedGoodsId.value) return null
  return allGoods.value.find(g => g.id === selectedGoodsId.value) ?? null
})

const isCheckingEligibility = ref(false)
const eligibilityResult = ref<EligibilityResult | null>(null)

// 事件类型选项
const eventTypeOptions = [
  { label: '弹幕', value: EventDataTypes.Message },
  { label: '礼物', value: EventDataTypes.Gift },
  { label: '上舰', value: EventDataTypes.Guard },
  { label: 'SC', value: EventDataTypes.SC },
]

// 舰长等级选项
const guardLevelOptions = [
  { label: '舰长', value: '舰长' },
  { label: '提督', value: '提督' },
  { label: '总督', value: '总督' },
]

// 是否显示礼物相关字段
const showGiftFields = computed(() => testForm.value.type === EventDataTypes.Gift)
const showGuardFields = computed(() => testForm.value.type === EventDataTypes.Guard)

// 获取测试账户积分
async function fetchTestAccountPoint() {
  isLoading.value = true
  try {
    const res = await Get<number>(POINT_API_URL + 'get-test-account-point')
    if (res.code === 200) {
      testAccountPoint.value = res.data ?? 0
    }
  } catch (err) {
    console.error('获取测试账户积分失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 执行测试
async function runTest() {
  isTesting.value = true
  try {
    const payload: any = {
      type: testForm.value.type,
    }

    // 根据类型添加参数
    if (testForm.value.type === EventDataTypes.Gift) {
      if (!testForm.value.giftName.trim()) {
        message.error('请输入礼物名称')
        return
      }
      if (testForm.value.giftPrice < 0) {
        message.error('礼物价格不能为负数')
        return
      }
      payload.giftName = testForm.value.giftName
      payload.giftPrice = testForm.value.giftPrice
      payload.giftCount = testForm.value.giftCount
    } else if (testForm.value.type === EventDataTypes.Guard) {
      payload.guardLevel = testForm.value.guardLevel
    } else if (testForm.value.type === EventDataTypes.SC) {
      if (testForm.value.giftPrice <= 0) {
        message.error('SC价格必须大于0')
        return
      }
      payload.giftPrice = testForm.value.giftPrice
    }

    const res = await Post<{ success: boolean; message: string; pointsAwarded?: number }>(POINT_API_URL + 'test-point',
      payload
    )

    if (res.code === 200 && res.data) {
      if (res.data.success) {
        message.success(res.data.message)
        // 刷新测试账户积分
        await fetchTestAccountPoint()
      } else {
        message.warning(res.data.message)
      }
    } else {
      message.error(res.message || '测试失败')
    }
  } catch (err: any) {
    message.error(`测试失败: ${err.message || err}`)
    console.error('测试失败:', err)
  } finally {
    isTesting.value = false
  }
}

// 重置测试账户
async function resetTestAccount() {
  isLoading.value = true
  try {
    const res = await Post(POINT_API_URL + 'reset-test-account', {})
    if (res.code === 200) {
      message.success('测试账户已重置')
      testAccountPoint.value = 0
    } else {
      message.error(res.message || '重置失败')
    }
  } catch (err: any) {
    message.error(`重置失败: ${err.message || err}`)
    console.error('重置失败:', err)
  } finally {
    isLoading.value = false
  }
}

// 初始化时获取积分
fetchTestAccountPoint()

async function loadEligibilityOptions() {
  if (!accountInfo.value?.id) return

  isLoadingEligibilityOptions.value = true
  try {
    const [usersRes, goodsRes] = await Promise.all([
      Get<ResponsePointUserModel[]>(POINT_API_URL + 'get-all-users'),
      Get<ResponsePointGoodModel[]>(POINT_API_URL + 'get-goods', { id: accountInfo.value.id }),
    ])

    if (usersRes.code === 200) {
      allUsers.value = usersRes.data ?? []
    } else {
      message.error(usersRes.message || '加载用户列表失败')
    }

    if (goodsRes.code === 200) {
      allGoods.value = goodsRes.data ?? []
    } else {
      message.error(goodsRes.message || '加载礼物列表失败')
    }
  } catch (err: any) {
    message.error(`加载下拉选项失败: ${err.message || err}`)
    console.error(err)
  } finally {
    isLoadingEligibilityOptions.value = false
  }
}

loadEligibilityOptions()

async function checkEligibility() {
  if (!selectedGoodsId.value) {
    message.error('请选择礼物')
    return
  }

  if (!selectedUserKey.value) {
    message.error('请选择用户')
    return
  }

  if (!eligibilityForm.value.count || eligibilityForm.value.count < 1) {
    message.error('兑换数量不能小于 1')
    return
  }

  isCheckingEligibility.value = true
  eligibilityResult.value = null
  try {
    const params: any = {
      goodsId: selectedGoodsId.value,
      count: eligibilityForm.value.count,
    }

    const key = selectedUserKey.value
    if (key.startsWith('auth:')) {
      params.authId = Number(key.slice('auth:'.length))
    } else if (key.startsWith('uid:')) {
      params.uId = Number(key.slice('uid:'.length))
    } else if (key.startsWith('oid:')) {
      params.oId = key.slice('oid:'.length)
    }

    const res = await Get<EligibilityResult>(POINT_API_URL + 'check-eligibility', params)
    if (res.code === 200 && res.data) {
      eligibilityResult.value = res.data
    } else {
      message.error(res.message || '查询失败')
    }
  } catch (err: any) {
    message.error(`查询失败: ${err.message || err}`)
    console.error(err)
  } finally {
    isCheckingEligibility.value = false
  }
}
</script>

<template>
  <NCard title="积分测试系统">
    <template #header-extra>
      <NTag type="info">
        测试账户 OUId: 00000000-0000-0000-0000-000000000000
      </NTag>
    </template>

    <NSpin :show="isLoading">
      <NFlex
        vertical
        :gap="16"
      >
        <NAlert
          type="info"
          closable
        >
          此功能用于测试积分系统的配置，所有测试事件将记录到一个专用的 mock 账户（OUId=0）。你可以在这里测试不同类型事件的积分获取情况。
        </NAlert>

        <!-- 测试账户积分显示 -->
        <NCard
          size="small"
          :bordered="false"
        >
          <NFlex
            justify="space-between"
            align="center"
          >
            <div>
              <NStatistic
                label="测试账户当前积分"
                :value="testAccountPoint"
              >
                <template #suffix>
                  <span style="font-size: 16px">分</span>
                </template>
              </NStatistic>
            </div>
            <NPopconfirm
              @positive-click="resetTestAccount"
            >
              <template #trigger>
                <NButton
                  type="error"
                  :loading="isLoading"
                  secondary
                >
                  重置积分
                </NButton>
              </template>
              确定要重置测试账户的积分吗？
            </NPopconfirm>
          </NFlex>
        </NCard>

        <NDivider>测试表单</NDivider>

        <!-- 测试表单 -->
        <NForm
          label-placement="left"
          label-width="120"
        >
          <NFormItem
            label="事件类型"
            required
          >
            <NSelect
              v-model:value="testForm.type"
              :options="eventTypeOptions"
              placeholder="选择事件类型"
            />
          </NFormItem>

          <!-- 礼物相关字段 -->
          <template v-if="showGiftFields">
            <NFormItem
              label="礼物名称"
              required
            >
              <NInput
                v-model:value="testForm.giftName"
                placeholder="例如: 小心心、辣条"
                clearable
              />
            </NFormItem>

            <NFormItem
              label="礼物价格"
              required
            >
              <NInputNumber
                v-model:value="testForm.giftPrice"
                placeholder="礼物价格（元）"
                :min="0"
                :precision="2"
                style="width: 100%"
              />
            </NFormItem>

            <NFormItem label="礼物数量">
              <NInputNumber
                v-model:value="testForm.giftCount"
                placeholder="礼物数量"
                :min="1"
                style="width: 100%"
              />
            </NFormItem>
          </template>

          <!-- 上舰相关字段 -->
          <NFormItem
            v-if="showGuardFields"
            label="舰长等级"
            required
          >
            <NSelect
              v-model:value="testForm.guardLevel"
              :options="guardLevelOptions"
              placeholder="选择舰长等级"
            />
          </NFormItem>

          <!-- SC 价格字段 -->
          <NFormItem
            v-if="testForm.type === EventDataTypes.SC"
            label="SC价格"
            required
          >
            <NInputNumber
              v-model:value="testForm.giftPrice"
              placeholder="SC价格（元）"
              :min="0.01"
              :precision="2"
              style="width: 100%"
            />
          </NFormItem>

          <NFormItem>
            <NFlex
              justify="end"
              style="width: 100%"
            >
              <NButton
                type="primary"
                :loading="isTesting"
                @click="runTest"
              >
                执行测试
              </NButton>
            </NFlex>
          </NFormItem>
        </NForm>

        <NAlert
          v-if="!accountInfo?.settings?.point"
          type="warning"
        >
          请先配置积分设置
        </NAlert>

        <NDivider>兑换资格查询</NDivider>

        <NCard
          size="small"
          :bordered="false"
        >
          <NSpin :show="isCheckingEligibility || isLoadingEligibilityOptions">
            <NForm
              label-placement="left"
              label-width="120"
            >
              <NFormItem label="目标用户" required>
                <NSelect
                  v-model:value="selectedUserKey"
                  :options="userOptions"
                  placeholder="请选择用户"
                  filterable
                  clearable
                />
              </NFormItem>

              <NFormItem label="礼物" required>
                <NSelect
                  v-model:value="selectedGoodsId"
                  :options="goodsOptions"
                  placeholder="请选择礼物"
                  filterable
                  clearable
                />
              </NFormItem>

              <NFormItem label="兑换数量" required>
                <NInputNumber
                  v-model:value="eligibilityForm.count"
                  placeholder="兑换数量"
                  :min="1"
                  style="width: 100%"
                />
              </NFormItem>

              <NAlert
                v-if="selectedGoods"
                type="info"
                :bordered="false"
                style="margin-bottom: 12px"
              >
                当前选择: {{ selectedGoods.name }} (ID: {{ selectedGoods.id }})
              </NAlert>

              <NFormItem>
                <NFlex
                  justify="end"
                  style="width: 100%"
                >
                  <NButton
                    type="primary"
                    :loading="isCheckingEligibility"
                    :disabled="!selectedUserKey || !selectedGoodsId"
                    @click="checkEligibility"
                  >
                    查询
                  </NButton>
                </NFlex>
              </NFormItem>
            </NForm>

            <NAlert
              v-if="eligibilityResult"
              :type="eligibilityResult.eligible ? 'success' : 'error'"
              style="margin-top: 12px"
            >
              <template #header>
                {{ eligibilityResult.eligible ? '可兑换' : '不可兑换' }}
              </template>
              <div v-if="!eligibilityResult.eligible">
                原因: {{ eligibilityResult.reason || '未知原因' }}
              </div>
              <NFlex
                :wrap="true"
                :gap="12"
                style="margin-top: 8px"
              >
                <NTag :type="eligibilityResult.canFreeBuy ? 'success' : 'default'">
                  {{ eligibilityResult.canFreeBuy ? '可免费兑换' : '非免费兑换' }}
                </NTag>
                <NTag type="info">
                  当前积分: {{ eligibilityResult.userPoint }}
                </NTag>
                <NTag type="info">
                  已兑换次数: {{ eligibilityResult.purchasedCount }}
                </NTag>
                <NTag type="warning">
                  需要积分: {{ eligibilityResult.needPoint }}
                </NTag>
              </NFlex>
            </NAlert>
          </NSpin>
        </NCard>
      </NFlex>
    </NSpin>
  </NCard>
</template>

<style scoped>
</style>
