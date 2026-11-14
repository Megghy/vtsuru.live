<script setup lang="ts">
import { computed, ref } from 'vue'

import { useAccount } from '@/api/account'
import type { ResponseBasePointGoodsModel, ResponsePointUserModel } from '@/api/generated/model'
import { EventDataTypes } from '@/api/generated/model'
import {
  getApiPointCheckEligibility,
  getApiPointGetAllUsers,
  getApiPointGetGoods,
  getApiPointGetTestAccountPoint,
  postApiPointResetTestAccount,
  postApiPointTestPoint,
} from '@/api/generated/point/point'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Tag } from '@/shared/ui/tag'
import { useMessage } from '@/shared/utils'

interface SelectOption {
  label: string
  value: any
}

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
const allGoods = ref<ResponseBasePointGoodsModel[]>([])

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
    const suffix = u.isAuthed && authId > 0 ? `AuthId: ${authId}` : uid > 0 ? `UID: ${uid}` : `OID: ${openId}`

    return {
      label: `${userName} (${suffix})`,
      value: key,
    } satisfies SelectOption
  })
})

const goodsOptions = computed<SelectOption[]>(() => {
  return allGoods.value.map((g) => ({
    label: `${g.name} (#${g.id})`,
    value: g.id,
  }))
})

const selectedGoods = computed(() => {
  if (!selectedGoodsId.value) return null
  return allGoods.value.find((g) => g.id === selectedGoodsId.value) ?? null
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
    const res = await getApiPointGetTestAccountPoint()
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

    const res = await postApiPointTestPoint(payload as any)

    if (res.code === 200 && res.data) {
      if (res.data.success) {
        message.success(res.data.message)
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
    const res = await postApiPointResetTestAccount()
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

fetchTestAccountPoint()

async function loadEligibilityOptions() {
  if (!accountInfo.value?.id) return

  isLoadingEligibilityOptions.value = true
  try {
    const [usersRes, goodsRes] = await Promise.all([
      getApiPointGetAllUsers(),
      getApiPointGetGoods({ id: String(accountInfo.value.id) }),
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

    const res = await getApiPointCheckEligibility(params)
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
  <Card>
    <CardHeader class="p-4 flex flex-row items-center justify-between space-y-0 border-b">
      <CardTitle>积分测试系统</CardTitle>
      <Tag
        type="info"
        size="small"
        :bordered="false"
      >
        测试账户 OUId: 00000000-0000-0000-0000-000000000000
      </Tag>
    </CardHeader>

    <CardContent class="p-4 space-y-6">
      <Alert variant="info">
        <AlertDescription>
          此功能用于测试积分系统的配置，所有测试事件将记录到一个专用的 mock
          账户（OUId=0）。你可以在这里测试不同类型事件的积分获取情况。
        </AlertDescription>
      </Alert>

      <!-- 测试账户积分显示 -->
      <div class="rounded-lg border border-border bg-card p-4 flex-between">
        <div>
          <span class="text-xs text-muted-foreground block">测试账户当前积分</span>
          <div class="flex items-baseline gap-1 mt-1">
            <span class="text-2xl font-bold text-foreground font-mono">{{ testAccountPoint }}</span>
            <span class="text-xs text-muted-foreground">分</span>
          </div>
        </div>

        <Popconfirm
          positive-text="确定重置"
          negative-text="取消"
          @positive-click="resetTestAccount"
        >
          <template #trigger>
            <Button
              variant="destructive"
              :disabled="isLoading"
            >
              重置积分
            </Button>
          </template>
          确定要重置测试账户的积分吗？
        </Popconfirm>
      </div>

      <div>
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">测试事件模拟</h4>
        <div class="space-y-3 max-w-lg">
          <FormField
            type="select"
            label="事件类型"
            required
            :options="eventTypeOptions.map((opt) => ({ label: opt.label, value: String(opt.value) }))"
            :model-value="String(testForm.type)"
            @change="testForm.type = Number($event) as any"
          />

          <!-- 礼物相关字段 -->
          <template v-if="showGiftFields">
            <FormField
              type="text"
              label="礼物名称"
              required
              placeholder="例如: 小心心、辣条"
              v-model="testForm.giftName"
            />

            <FormField
              type="number"
              label="礼物价格（元）"
              required
              :min="0"
              v-model="testForm.giftPrice"
            />

            <FormField
              type="number"
              label="礼物数量"
              :min="1"
              v-model="testForm.giftCount"
            />
          </template>

          <!-- 上舰相关字段 -->
          <FormField
            v-if="showGuardFields"
            type="select"
            label="舰长等级"
            required
            :options="guardLevelOptions"
            v-model="testForm.guardLevel"
          />

          <!-- SC 价格字段 -->
          <FormField
            v-if="testForm.type === EventDataTypes.SC"
            type="number"
            label="SC价格（元）"
            required
            :min="0.01"
            v-model="testForm.giftPrice"
          />

          <div class="flex justify-end pt-2">
            <Button
              :disabled="isTesting"
              @click="runTest"
            >
              {{ isTesting ? '执行中...' : '执行测试' }}
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      <!-- 兑换资格查询 -->
      <div>
        <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">兑换资格查询</h4>
        <div class="rounded-lg border border-border bg-card p-4 max-w-lg space-y-3">
          <FormField
            type="select"
            label="目标用户"
            required
            placeholder="请选择用户"
            :options="userOptions"
            :model-value="selectedUserKey ?? ''"
            @change="selectedUserKey = $event ? ($event as EligibleUserKey) : null"
          />

          <FormField
            type="select"
            label="礼物"
            required
            placeholder="请选择礼物"
            :options="goodsOptions.map((opt) => ({ label: opt.label, value: String(opt.value) }))"
            :model-value="selectedGoodsId ? String(selectedGoodsId) : ''"
            @change="selectedGoodsId = $event ? Number($event) : null"
          />

          <FormField
            type="number"
            label="兑换数量"
            required
            :min="1"
            v-model="eligibilityForm.count"
          />

          <div
            v-if="selectedGoods"
            class="text-xs text-muted-foreground bg-muted/40 p-2 rounded"
          >
            当前选择: <strong class="text-foreground">{{ selectedGoods.name }}</strong> (ID: {{ selectedGoods.id }})
          </div>

          <div class="flex justify-end pt-2">
            <Button
              :disabled="!selectedUserKey || !selectedGoodsId || isCheckingEligibility"
              @click="checkEligibility"
            >
              {{ isCheckingEligibility ? '查询中...' : '查询' }}
            </Button>
          </div>

          <Alert
            v-if="eligibilityResult"
            :variant="eligibilityResult.eligible ? 'default' : 'destructive'"
            class="mt-3"
          >
            <AlertTitle>
              {{ eligibilityResult.eligible ? '可兑换' : '不可兑换' }}
            </AlertTitle>
            <AlertDescription class="space-y-2">
              <div v-if="!eligibilityResult.eligible">原因: {{ eligibilityResult.reason || '未知原因' }}</div>
              <div class="flex flex-wrap gap-1.5 pt-1">
                <Tag :type="eligibilityResult.canFreeBuy ? 'success' : 'default'">
                  {{ eligibilityResult.canFreeBuy ? '可免费兑换' : '非免费兑换' }}
                </Tag>
                <Tag type="info">当前积分: {{ eligibilityResult.userPoint }}</Tag>
                <Tag type="info">已兑换次数: {{ eligibilityResult.purchasedCount }}</Tag>
                <Tag type="warning">需要积分: {{ eligibilityResult.needPoint }}</Tag>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
