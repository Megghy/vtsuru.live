<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type {
  RequestApplyPointGuardDuplicateFixModel,
  RequestPointGuardDuplicatePointValues,
  ResponsePointGuardDuplicateApplyResult,
  ResponsePointGuardDuplicateDetailModel,
  ResponsePointGuardDuplicateLevelCounts,
  ResponsePointGuardDuplicateScanModel,
  ResponsePointGuardDuplicateUserModel,
} from '@/api/api-models'
import { ArrowSync24Regular, Delete24Regular, Eye24Regular } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NEmpty,
  NFlex,
  NIcon,
  NInputNumber,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NScrollbar,
  NSpin,
  NSwitch,
  NTag,
  NText,
  useMessage,
} from 'naive-ui'
import { computed, h, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { POINT_API_URL } from '@/shared/config'

interface DuplicateUserRow extends ResponsePointGuardDuplicateUserModel {
  previewPoints: number
}

const message = useMessage()
const accountInfo = useAccount()

const dayCount = ref(7)
const windowSeconds = ref(3)
const includeLiving = ref(true)
const includeFinished = ref(true)
const excludeFixed = ref(true)

const deductPoints = ref(true)
const deleteEvents = ref(true)
const cleanLiveData = ref(true)

const pointMode = ref<'current' | 'manual'>('current')
const manualPointValues = ref<RequestPointGuardDuplicatePointValues>({
  jianzhang: 0,
  tidu: 0,
  zongdu: 0,
})

const scanLoading = ref(false)
const applyLoading = ref(false)
const detailLoading = ref(false)
const showDetailModal = ref(false)
const scanResult = ref<ResponsePointGuardDuplicateScanModel | null>(null)
const detailResult = ref<ResponsePointGuardDuplicateDetailModel | null>(null)
const applyResult = ref<ResponsePointGuardDuplicateApplyResult | null>(null)
const selectedRowKeys = ref<string[]>([])

const currentPointValues = computed<RequestPointGuardDuplicatePointValues>(() => ({
  jianzhang: accountInfo.value?.settings?.point?.jianzhangPoint ?? 0,
  tidu: accountInfo.value?.settings?.point?.tiduPoint ?? 0,
  zongdu: accountInfo.value?.settings?.point?.zongduPoint ?? 0,
}))

watch(currentPointValues, (values) => {
  if (manualPointValues.value.jianzhang === 0 && manualPointValues.value.tidu === 0 && manualPointValues.value.zongdu === 0) {
    manualPointValues.value = { ...values }
  }
}, { immediate: true, deep: true })

const effectivePointValues = computed(() => pointMode.value === 'manual' ? manualPointValues.value : currentPointValues.value)

function calcEstimatedPoints(levelCounts: ResponsePointGuardDuplicateLevelCounts, values = effectivePointValues.value) {
  return Number((levelCounts.jianzhang * values.jianzhang + levelCounts.tidu * values.tidu + levelCounts.zongdu * values.zongdu).toFixed(2))
}

const rows = computed<DuplicateUserRow[]>(() => (scanResult.value?.users ?? []).map(user => ({
  ...user,
  previewPoints: calcEstimatedPoints(user.levelCounts),
})))

const selectedUsers = computed(() => {
  const selected = new Set(selectedRowKeys.value)
  return rows.value.filter(row => selected.has(row.guardOUId))
})

const selectedPreviewPoints = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.previewPoints, 0))
const selectedEventDuplicates = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.duplicateEventCount, 0))
const selectedLiveDuplicates = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.duplicateLiveCount, 0))

function formatUnixTime(unix: number) {
  return new Date(unix).toLocaleString('zh-CN', { hour12: false })
}

function formatPoints(value: number) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

function getUserSecondaryText(user: ResponsePointGuardDuplicateUserModel) {
  if (user.info?.userId) return `UID ${user.info.userId}`
  if (user.info?.openId) return `OpenId ${user.info.openId.slice(0, 8)}...`
  return user.guardOUId
}

function sourceTypeLabel(sourceType: string) {
  switch (sourceType) {
    case 'Event':
      return '事件记录'
    case 'LivingLive':
      return '直播中 Live'
    case 'FinishedLive':
      return '历史 Live'
    default:
      return sourceType
  }
}

async function scanDuplicates() {
  scanLoading.value = true
  applyResult.value = null
  try {
    const result = unwrapOk(await QueryGetAPI<ResponsePointGuardDuplicateScanModel>(`${POINT_API_URL}scan-duplicate-guards`, {
      dayCount: dayCount.value,
      windowSeconds: windowSeconds.value,
      includeLiving: includeLiving.value,
      includeFinished: includeFinished.value,
      excludeFixed: excludeFixed.value,
    }), '扫描重复上舰失败')
    scanResult.value = result
    selectedRowKeys.value = result.users.map(user => user.guardOUId)
    message.success(`扫描完成，共 ${result.duplicatedUserCount} 位用户存在重复上舰`)
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    scanLoading.value = false
  }
}

async function openDetail(row: ResponsePointGuardDuplicateUserModel) {
  showDetailModal.value = true
  detailLoading.value = true
  detailResult.value = null
  try {
    detailResult.value = unwrapOk(await QueryGetAPI<ResponsePointGuardDuplicateDetailModel>(`${POINT_API_URL}get-duplicate-guard-detail`, {
      guardOuId: row.guardOUId,
      dayCount: dayCount.value,
      windowSeconds: windowSeconds.value,
      includeLiving: includeLiving.value,
      includeFinished: includeFinished.value,
      excludeFixed: excludeFixed.value,
    }), '获取重复详情失败')
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    detailLoading.value = false
  }
}

function resetManualPointValues() {
  manualPointValues.value = { ...currentPointValues.value }
}

function createApplyPayload(applyAll: boolean): RequestApplyPointGuardDuplicateFixModel {
  return {
    dayCount: dayCount.value,
    windowSeconds: windowSeconds.value,
    includeLiving: includeLiving.value,
    includeFinished: includeFinished.value,
    excludeFixed: excludeFixed.value,
    deductPoints: deductPoints.value,
    deleteEvents: deleteEvents.value,
    cleanLiveData: cleanLiveData.value,
    useManualPointValues: pointMode.value === 'manual',
    manualPointValues: pointMode.value === 'manual' ? { ...manualPointValues.value } : null,
    guardOuIds: applyAll ? null : [...selectedRowKeys.value],
  }
}

async function applyCleanup(applyAll: boolean) {
  if (!deductPoints.value && !deleteEvents.value && !cleanLiveData.value) {
    message.error('扣分 / 删除事件 / 清理 Live 数据 至少选择一项')
    return
  }

  if (!applyAll && selectedRowKeys.value.length === 0) {
    message.error('请先选择至少一个用户')
    return
  }

  applyLoading.value = true
  try {
    const result = unwrapOk(await QueryPostAPI<ResponsePointGuardDuplicateApplyResult>(
      `${POINT_API_URL}apply-duplicate-guards-fix`,
      createApplyPayload(applyAll),
    ), '执行重复上舰清理失败')
    applyResult.value = result
    message.success(`执行完成，扣除 ${formatPoints(result.totalPointsDeducted)} 积分，清理 ${result.liveDuplicateRowsRemoved} 条 Live 重复`) 
    await scanDuplicates()
  } catch (error) {
    console.error(error)
    message.error(String(error))
  } finally {
    applyLoading.value = false
  }
}

const columns: DataTableColumns<DuplicateUserRow> = [
  {
    type: 'selection',
  },
  {
    title: '用户',
    key: 'user',
    render: row => h(NFlex, { vertical: true, size: 2 }, {
      default: () => [
        h(NText, { strong: true }, { default: () => row.info?.name || '未知用户' }),
        h(NText, { depth: 3 }, { default: () => getUserSecondaryText(row) }),
      ],
    }),
  },
  {
    title: '组数',
    key: 'duplicateGroups',
    width: 80,
  },
  {
    title: '事件重复',
    key: 'duplicateEventCount',
    width: 100,
  },
  {
    title: 'Live 重复',
    key: 'duplicateLiveCount',
    width: 100,
  },
  {
    title: '影响场次',
    key: 'affectedLiveCount',
    width: 100,
  },
  {
    title: '预计扣分',
    key: 'previewPoints',
    width: 120,
    render: row => formatPoints(row.previewPoints),
  },
  {
    title: '时间范围',
    key: 'timeRange',
    width: 260,
    render: row => `${formatUnixTime(row.firstEventAt)} ~ ${formatUnixTime(row.lastEventAt)}`,
  },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: row => h(NButton, {
      size: 'small',
      type: 'info',
      onClick: () => openDetail(row),
    }, {
      icon: () => h(NIcon, { component: Eye24Regular }),
      default: () => '详情',
    }),
  },
]
</script>

<template>
  <NFlex vertical :size="16">
    <NAlert type="info" :show-icon="false">
      默认会同时扣除重复积分、删除重复事件，并清理 live 历史里的重复上舰。你可以在执行前取消其中任意动作，也可以切换为手动三档积分值预览和执行。
    </NAlert>

    <NCard size="small" title="扫描条件">
      <NFlex wrap :size="12" align="center">
        <NText depth="3">
          最近
        </NText>
        <NInputNumber v-model:value="dayCount" :min="1" :max="90" style="width: 110px;" />
        <NText depth="3">
          天
        </NText>
        <NText depth="3">
          窗口
        </NText>
        <NInputNumber v-model:value="windowSeconds" :min="1" :max="30" style="width: 110px;" />
        <NText depth="3">
          秒
        </NText>
        <NSwitch v-model:value="includeLiving" />
        <NText depth="3">
          包含正在直播
        </NText>
        <NSwitch v-model:value="includeFinished" />
        <NText depth="3">
          包含历史直播
        </NText>
        <NSwitch v-model:value="excludeFixed" />
        <NText depth="3">
          排除已处理
        </NText>
        <NButton type="primary" :loading="scanLoading" @click="scanDuplicates">
          <template #icon>
            <NIcon :component="ArrowSync24Regular" />
          </template>
          扫描重复上舰
        </NButton>
      </NFlex>
    </NCard>

    <NCard size="small" title="扣分设置">
      <NFlex vertical :size="12">
        <NRadioGroup v-model:value="pointMode" name="point-mode">
          <NRadioButton value="current">
            按当前积分设置
          </NRadioButton>
          <NRadioButton value="manual">
            手动三档设置
          </NRadioButton>
        </NRadioGroup>
        <NFlex wrap :size="12" align="center">
          <NText depth="3">
            舰长
          </NText>
          <NInputNumber v-model:value="manualPointValues.jianzhang" :min="0" :precision="2" :disabled="pointMode !== 'manual'" style="width: 120px;" />
          <NText depth="3">
            提督
          </NText>
          <NInputNumber v-model:value="manualPointValues.tidu" :min="0" :precision="2" :disabled="pointMode !== 'manual'" style="width: 120px;" />
          <NText depth="3">
            总督
          </NText>
          <NInputNumber v-model:value="manualPointValues.zongdu" :min="0" :precision="2" :disabled="pointMode !== 'manual'" style="width: 120px;" />
          <NButton secondary :disabled="pointMode !== 'manual'" @click="resetManualPointValues">
            恢复当前设置
          </NButton>
        </NFlex>
        <NText depth="3">
          当前生效：舰长 {{ formatPoints(effectivePointValues.jianzhang) }} / 提督 {{ formatPoints(effectivePointValues.tidu) }} / 总督 {{ formatPoints(effectivePointValues.zongdu) }}
        </NText>
      </NFlex>
    </NCard>

    <NCard size="small" title="执行选项">
      <NFlex wrap :size="12" align="center">
        <NSwitch v-model:value="deductPoints" />
        <NText>扣除重复积分</NText>
        <NSwitch v-model:value="deleteEvents" />
        <NText>删除重复事件</NText>
        <NSwitch v-model:value="cleanLiveData" />
        <NText>清理 Live 数据</NText>
      </NFlex>
      <NFlex wrap :size="12" align="center" style="margin-top: 12px;">
        <NTag type="warning" :bordered="false">
          已选 {{ selectedUsers.length }} 人
        </NTag>
        <NTag type="error" :bordered="false">
          预计扣分 {{ formatPoints(selectedPreviewPoints) }}
        </NTag>
        <NTag type="warning" :bordered="false">
          事件重复 {{ selectedEventDuplicates }}
        </NTag>
        <NTag type="warning" :bordered="false">
          Live 重复 {{ selectedLiveDuplicates }}
        </NTag>
        <NPopconfirm @positive-click="applyCleanup(true)">
          <template #trigger>
            <NButton type="error" :loading="applyLoading">
              <template #icon>
                <NIcon :component="Delete24Regular" />
              </template>
              一键清理全部重复数据
            </NButton>
          </template>
          确认按当前筛选条件清理全部重复上舰数据？
        </NPopconfirm>
        <NPopconfirm @positive-click="applyCleanup(false)">
          <template #trigger>
            <NButton type="primary" :loading="applyLoading" :disabled="selectedRowKeys.length === 0">
              清理已选用户
            </NButton>
          </template>
          确认仅清理已选中的重复上舰用户？
        </NPopconfirm>
      </NFlex>
    </NCard>

    <NAlert v-if="scanResult" type="success" :show-icon="false">
      扫描结果：{{ scanResult.duplicatedUserCount }} 位用户，{{ scanResult.duplicateGroupCount }} 组重复，事件重复 {{ scanResult.duplicateEventCount }} 条，Live 重复 {{ scanResult.duplicateLiveCount }} 条。
    </NAlert>

    <NAlert v-if="applyResult" type="warning" :show-icon="true">
      本次执行：扣除 {{ formatPoints(applyResult.totalPointsDeducted) }} 积分，删除事件 {{ applyResult.eventRowsDeleted }} 条，删除临时 Live 记录 {{ applyResult.tempEventRowsDeleted }} 条，更新 Live {{ applyResult.liveRowsUpdated }} 场，清理 Live 重复 {{ applyResult.liveDuplicateRowsRemoved }} 条。
    </NAlert>

    <NCard size="small" title="重复用户列表">
      <NSpin :show="scanLoading">
        <NEmpty v-if="!scanResult" description="先扫描重复上舰数据" />
        <NEmpty v-else-if="rows.length === 0" description="当前筛选条件下没有重复上舰" />
        <NDataTable
          v-else
          v-model:checked-row-keys="selectedRowKeys"
          :columns="columns"
          :data="rows"
          :pagination="{ pageSize: 10 }"
          :row-key="row => row.guardOUId"
          max-height="620"
        />
      </NSpin>
    </NCard>
  </NFlex>

  <NModal v-model:show="showDetailModal" preset="card" style="width: 920px; max-width: 96vw;" title="重复上舰详情">
    <NSpin :show="detailLoading">
      <NEmpty v-if="!detailResult && !detailLoading" description="暂无详情" />
      <template v-else-if="detailResult">
        <NFlex vertical :size="12">
          <NAlert type="info" :show-icon="false">
            {{ detailResult.user.info?.name || '未知用户' }}：{{ detailResult.user.duplicateGroups }} 组重复，事件重复 {{ detailResult.user.duplicateEventCount }} 条，Live 重复 {{ detailResult.user.duplicateLiveCount }} 条。
          </NAlert>
          <NScrollbar style="max-height: 70vh;">
            <NFlex vertical :size="12">
              <NCard v-for="(group, index) in detailResult.groups" :key="`${group.sourceType}-${group.liveId || 'none'}-${group.anchorAt}-${index}`" size="small">
                <NFlex justify="space-between" align="center" wrap>
                  <NFlex align="center" :size="8">
                    <NTag :bordered="false" type="warning">
                      {{ sourceTypeLabel(group.sourceType) }}
                    </NTag>
                    <NTag :bordered="false" type="info">
                      重复 {{ group.duplicateCount }} 条
                    </NTag>
                    <NText v-if="group.liveTitle">
                      {{ group.liveTitle }}
                    </NText>
                  </NFlex>
                  <NText depth="3">
                    {{ formatUnixTime(group.anchorAt) }} ~ {{ formatUnixTime(group.lastAt) }}
                  </NText>
                </NFlex>
                <NFlex vertical :size="8" style="margin-top: 12px;">
                  <NFlex
                    v-for="entry in group.entries"
                    :key="`${entry.eventId}-${entry.time}-${entry.isDuplicate ? 'dup' : 'keep'}`"
                    justify="space-between"
                    align="center"
                    wrap
                    style="padding: 10px 12px; border-radius: 10px; background: rgba(127, 127, 127, 0.08);"
                  >
                    <NFlex align="center" :size="8" wrap>
                      <NTag :type="entry.isDuplicate ? 'warning' : 'success'" :bordered="false">
                        {{ entry.isDuplicate ? '重复' : '保留' }}
                      </NTag>
                      <NText>{{ formatUnixTime(entry.time) }}</NText>
                      <NText depth="3">
                        {{ entry.message }}
                      </NText>
                    </NFlex>
                    <NFlex align="center" :size="12" wrap>
                      <NText depth="3">
                        数量 {{ entry.num }}
                      </NText>
                      <NText depth="3">
                        价格 {{ formatPoints(entry.price) }}
                      </NText>
                      <NText depth="3">
                        等级 {{ entry.guardLevel }}
                      </NText>
                    </NFlex>
                  </NFlex>
                </NFlex>
              </NCard>
            </NFlex>
          </NScrollbar>
        </NFlex>
      </template>
    </NSpin>
  </NModal>
</template>




