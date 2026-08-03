<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type {
  RequestApplyPointGuardDuplicateFixModel,
  RequestPointGuardDuplicatePointValues,
  ResponsePointGuardDuplicateApplyResult,
  ResponsePointGuardDuplicateDetailModel,
  ResponsePointGuardDuplicateLevelCounts,
  ResponsePointGuardDuplicateScanModel,
  ResponsePointGuardDuplicateUserModel,
} from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { formatPoints, formatTime } from '@/apps/manage/composables/formatters'
import { POINT_API_URL } from '@/shared/config'

interface DuplicateUserRow extends ResponsePointGuardDuplicateUserModel {
  previewPoints: number
}

const accountInfo = useAccount()
const toast = useToast()
const dayCount = ref(7)
const windowSeconds = ref(3)
const includeLiving = ref(true)
const includeFinished = ref(true)
const excludeFixed = ref(true)
const deductPoints = ref(true)
const deleteEvents = ref(true)
const cleanLiveData = ref(true)
const pointMode = ref<'current' | 'manual'>('current')
const manualPointValues = ref<RequestPointGuardDuplicatePointValues>({ jianzhang: 0, tidu: 0, zongdu: 0 })
const scanLoading = ref(false)
const applyLoading = ref(false)
const detailLoading = ref(false)
const showDetailModal = ref(false)
const confirmMode = ref<'all' | 'selected' | null>(null)
const scanResult = ref<ResponsePointGuardDuplicateScanModel | null>(null)
const detailResult = ref<ResponsePointGuardDuplicateDetailModel | null>(null)
const applyResult = ref<ResponsePointGuardDuplicateApplyResult | null>(null)
const selectedRowKeys = ref<string[]>([])

const currentPointValues = computed<RequestPointGuardDuplicatePointValues>(() => ({
  jianzhang: accountInfo.value?.settings?.point?.jianzhangPoint ?? 0,
  tidu: accountInfo.value?.settings?.point?.tiduPoint ?? 0,
  zongdu: accountInfo.value?.settings?.point?.zongduPoint ?? 0,
}))
const effectivePointValues = computed(() =>
  pointMode.value === 'manual' ? manualPointValues.value : currentPointValues.value,
)
const rows = computed<DuplicateUserRow[]>(() =>
  (scanResult.value?.users ?? []).map((user) => ({ ...user, previewPoints: calcEstimatedPoints(user.levelCounts) })),
)
const selectedUsers = computed(() => {
  const selected = new Set(selectedRowKeys.value)
  return rows.value.filter((row) => selected.has(row.guardOUId))
})
const selectedPreviewPoints = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.previewPoints, 0))
const selectedEventDuplicates = computed(() =>
  selectedUsers.value.reduce((sum, row) => sum + row.duplicateEventCount, 0),
)
const selectedLiveDuplicates = computed(() => selectedUsers.value.reduce((sum, row) => sum + row.duplicateLiveCount, 0))
const pointModeItems = [
  { label: '按当前积分设置', value: 'current' },
  { label: '手动三档设置', value: 'manual' },
]

watch(
  currentPointValues,
  (values) => {
    if (!manualPointValues.value.jianzhang && !manualPointValues.value.tidu && !manualPointValues.value.zongdu)
      manualPointValues.value = { ...values }
  },
  { immediate: true, deep: true },
)

function notify(title: string, color: 'success' | 'error' = 'error') {
  toast.add({ title, color })
}
function calcEstimatedPoints(levelCounts: ResponsePointGuardDuplicateLevelCounts, values = effectivePointValues.value) {
  return Number(
    (
      levelCounts.jianzhang * values.jianzhang +
      levelCounts.tidu * values.tidu +
      levelCounts.zongdu * values.zongdu
    ).toFixed(2),
  )
}
function getUserSecondaryText(user: ResponsePointGuardDuplicateUserModel) {
  return user.info?.userId
    ? `UID ${user.info.userId}`
    : user.info?.openId
      ? `OpenId ${user.info.openId.slice(0, 8)}...`
      : user.guardOUId
}
function sourceTypeLabel(sourceType: string) {
  return sourceType === 'Event'
    ? '事件记录'
    : sourceType === 'LivingLive'
      ? '直播中 Live'
      : sourceType === 'FinishedLive'
        ? '历史 Live'
        : sourceType
}
function resetManualPointValues() {
  manualPointValues.value = { ...currentPointValues.value }
}

async function scanDuplicates() {
  scanLoading.value = true
  applyResult.value = null
  try {
    const result = unwrapOk(
      await QueryGetAPI<ResponsePointGuardDuplicateScanModel>(`${POINT_API_URL}scan-duplicate-guards`, {
        dayCount: dayCount.value,
        windowSeconds: windowSeconds.value,
        includeLiving: includeLiving.value,
        includeFinished: includeFinished.value,
        excludeFixed: excludeFixed.value,
      }),
      '扫描重复上舰失败',
    )
    scanResult.value = result
    selectedRowKeys.value = result.users.map((user) => user.guardOUId)
    toast.add({ title: `扫描完成，共 ${result.duplicatedUserCount} 位用户存在重复上舰`, color: 'success' })
  } catch (error) {
    console.error(error)
    notify(String(error))
  } finally {
    scanLoading.value = false
  }
}

async function openDetail(row: ResponsePointGuardDuplicateUserModel) {
  showDetailModal.value = true
  detailLoading.value = true
  detailResult.value = null
  try {
    detailResult.value = unwrapOk(
      await QueryGetAPI<ResponsePointGuardDuplicateDetailModel>(`${POINT_API_URL}get-duplicate-guard-detail`, {
        guardOuId: row.guardOUId,
        dayCount: dayCount.value,
        windowSeconds: windowSeconds.value,
        includeLiving: includeLiving.value,
        includeFinished: includeFinished.value,
        excludeFixed: excludeFixed.value,
      }),
      '获取重复详情失败',
    )
  } catch (error) {
    console.error(error)
    notify(String(error))
  } finally {
    detailLoading.value = false
  }
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
  if (!deductPoints.value && !deleteEvents.value && !cleanLiveData.value)
    return notify('扣分 / 删除事件 / 清理 Live 数据 至少选择一项')
  if (!applyAll && !selectedRowKeys.value.length) return notify('请先选择至少一个用户')
  applyLoading.value = true
  try {
    const result = unwrapOk(
      await QueryPostAPI<ResponsePointGuardDuplicateApplyResult>(
        `${POINT_API_URL}apply-duplicate-guards-fix`,
        createApplyPayload(applyAll),
      ),
      '执行重复上舰清理失败',
    )
    applyResult.value = result
    confirmMode.value = null
    toast.add({
      title: `执行完成，扣除 ${formatPoints(result.totalPointsDeducted)} 积分，清理 ${result.liveDuplicateRowsRemoved} 条 Live 重复`,
      color: 'success',
    })
    await scanDuplicates()
  } catch (error) {
    console.error(error)
    notify(String(error))
  } finally {
    applyLoading.value = false
  }
}
</script>

<template>
  <div class="duplicate-page">
    <UAlert
      color="info"
      icon="i-lucide-info"
      title="重复上舰清理"
      description="默认同时扣除重复积分、删除重复事件，并清理 Live 历史中的重复上舰；可以取消任意动作或使用手动积分值。"
    />
    <UCard
      ><template #header><h2>扫描条件</h2></template>
      <div class="inline-form">
        <UFormField label="最近天数"
          ><UInputNumber
            v-model="dayCount"
            :min="1"
            :max="90" /></UFormField
        ><UFormField label="时间窗口（秒）"
          ><UInputNumber
            v-model="windowSeconds"
            :min="1"
            :max="30" /></UFormField
        ><UCheckbox
          v-model="includeLiving"
          label="包含正在直播"
        /><UCheckbox
          v-model="includeFinished"
          label="包含历史直播"
        /><UCheckbox
          v-model="excludeFixed"
          label="排除已处理"
        /><UButton
          icon="i-lucide-scan-search"
          label="扫描重复上舰"
          :loading="scanLoading"
          @click="scanDuplicates"
        /></div
    ></UCard>
    <UCard
      ><template #header><h2>扣分设置</h2></template>
      <div class="settings-stack">
        <URadioGroup
          v-model="pointMode"
          :items="pointModeItems"
        />
        <div class="point-inputs">
          <UFormField label="舰长"
            ><UInputNumber
              v-model="manualPointValues.jianzhang"
              :min="0"
              :step="0.01"
              :disabled="pointMode !== 'manual'" /></UFormField
          ><UFormField label="提督"
            ><UInputNumber
              v-model="manualPointValues.tidu"
              :min="0"
              :step="0.01"
              :disabled="pointMode !== 'manual'" /></UFormField
          ><UFormField label="总督"
            ><UInputNumber
              v-model="manualPointValues.zongdu"
              :min="0"
              :step="0.01"
              :disabled="pointMode !== 'manual'" /></UFormField
          ><UButton
            color="neutral"
            variant="soft"
            label="恢复当前设置"
            :disabled="pointMode !== 'manual'"
            @click="resetManualPointValues"
          />
        </div>
        <p>
          当前生效：舰长 {{ formatPoints(effectivePointValues.jianzhang) }} / 提督
          {{ formatPoints(effectivePointValues.tidu) }} / 总督 {{ formatPoints(effectivePointValues.zongdu) }}
        </p>
      </div></UCard
    >
    <UCard
      ><template #header><h2>执行选项</h2></template>
      <div class="settings-stack">
        <div class="inline-form">
          <UCheckbox
            v-model="deductPoints"
            label="扣除重复积分"
          /><UCheckbox
            v-model="deleteEvents"
            label="删除重复事件"
          /><UCheckbox
            v-model="cleanLiveData"
            label="清理 Live 数据"
          />
        </div>
        <div class="summary-actions">
          <UBadge
            color="warning"
            :label="`已选 ${selectedUsers.length} 人`"
          /><UBadge
            color="error"
            :label="`预计扣分 ${formatPoints(selectedPreviewPoints)}`"
          /><UBadge
            color="warning"
            :label="`事件重复 ${selectedEventDuplicates}`"
          /><UBadge
            color="warning"
            :label="`Live 重复 ${selectedLiveDuplicates}`"
          /><UButton
            color="error"
            icon="i-lucide-trash-2"
            label="一键清理全部重复数据"
            :loading="applyLoading"
            @click="confirmMode = 'all'"
          /><UButton
            label="清理已选用户"
            :loading="applyLoading"
            :disabled="!selectedRowKeys.length"
            @click="confirmMode = 'selected'"
          />
        </div></div
    ></UCard>
    <UAlert
      v-if="scanResult"
      color="success"
      :title="`扫描结果：${scanResult.duplicatedUserCount} 位用户，${scanResult.duplicateGroupCount} 组重复`"
      :description="`事件重复 ${scanResult.duplicateEventCount} 条，Live 重复 ${scanResult.duplicateLiveCount} 条。`"
    />
    <UAlert
      v-if="applyResult"
      color="warning"
      title="本次执行结果"
      :description="`扣除 ${formatPoints(applyResult.totalPointsDeducted)} 积分，删除事件 ${applyResult.eventRowsDeleted} 条，删除临时 Live 记录 ${applyResult.tempEventRowsDeleted} 条，更新 Live ${applyResult.liveRowsUpdated} 场，清理 Live 重复 ${applyResult.liveDuplicateRowsRemoved} 条。`"
    />
    <UCard
      ><template #header><h2>重复用户列表</h2></template>
      <div
        v-if="scanLoading"
        class="loading"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="spin"
        />
        正在扫描
      </div>
      <UEmpty
        v-else-if="!scanResult"
        icon="i-lucide-search"
        title="先扫描重复上舰数据" /><UEmpty
        v-else-if="!rows.length"
        icon="i-lucide-circle-check"
        title="当前筛选条件下没有重复上舰" />
      <div
        v-else
        class="duplicate-list"
      >
        <article
          v-for="row in rows"
          :key="row.guardOUId"
          class="duplicate-row"
        >
          <UCheckbox
            :model-value="selectedRowKeys.includes(row.guardOUId)"
            :label="row.info?.name || '未知用户'"
            @update:model-value="
              (checked) =>
                (selectedRowKeys = checked
                  ? [...selectedRowKeys, row.guardOUId]
                  : selectedRowKeys.filter((key) => key !== row.guardOUId))
            "
          />
          <p>
            {{ getUserSecondaryText(row) }} · {{ formatTime(row.firstEventAt) }} ~ {{ formatTime(row.lastEventAt) }}
          </p>
          <div class="row-meta">
            <UBadge
              color="neutral"
              :label="`${row.duplicateGroups} 组`"
            /><UBadge
              color="warning"
              :label="`事件重复 ${row.duplicateEventCount}`"
            /><UBadge
              color="warning"
              :label="`Live 重复 ${row.duplicateLiveCount}`"
            /><UBadge
              color="error"
              :label="`预计扣分 ${formatPoints(row.previewPoints)}`"
            /><UButton
              color="neutral"
              variant="soft"
              size="sm"
              icon="i-lucide-eye"
              label="详情"
              @click="openDetail(row)"
            />
          </div>
        </article></div
    ></UCard>
  </div>
  <UModal
    v-model:open="showDetailModal"
    title="重复上舰详情"
    ><template #body
      ><div
        v-if="detailLoading"
        class="loading"
      >
        <UIcon
          name="i-lucide-loader-circle"
          class="spin"
        />
        正在加载
      </div>
      <UEmpty
        v-else-if="!detailResult"
        icon="i-lucide-list-x"
        title="暂无详情"
      />
      <div
        v-else
        class="detail-stack"
      >
        <UAlert
          color="info"
          :title="detailResult.user.info?.name || '未知用户'"
          :description="`${detailResult.user.duplicateGroups} 组重复，事件重复 ${detailResult.user.duplicateEventCount} 条，Live 重复 ${detailResult.user.duplicateLiveCount} 条。`"
        /><UCard
          v-for="(group, index) in detailResult.groups"
          :key="`${group.sourceType}-${group.liveId || 'none'}-${group.anchorAt}-${index}`"
          ><div class="group-head">
            <div>
              <UBadge
                color="warning"
                :label="sourceTypeLabel(group.sourceType)"
              /><UBadge
                color="info"
                :label="`重复 ${group.duplicateCount} 条`"
              /><strong v-if="group.liveTitle">{{ group.liveTitle }}</strong>
            </div>
            <span>{{ formatTime(group.anchorAt) }} ~ {{ formatTime(group.lastAt) }}</span>
          </div>
          <div class="entries">
            <div
              v-for="entry in group.entries"
              :key="`${entry.eventId}-${entry.time}-${entry.isDuplicate ? 'dup' : 'keep'}`"
              class="entry"
            >
              <div>
                <UBadge
                  :color="entry.isDuplicate ? 'warning' : 'success'"
                  :label="entry.isDuplicate ? '重复' : '保留'"
                /><span>{{ formatTime(entry.time) }}</span
                ><span class="muted">{{ entry.message }}</span>
              </div>
              <span>数量 {{ entry.num }} · 价格 {{ formatPoints(entry.price) }} · 等级 {{ entry.guardLevel }}</span>
            </div>
          </div></UCard
        >
      </div></template
    ></UModal
  >
  <UModal
    :open="confirmMode !== null"
    title="确认清理"
    ><template #body>{{
      confirmMode === 'all' ? '确认按当前筛选条件清理全部重复上舰数据？' : '确认仅清理已选中的重复上舰用户？'
    }}</template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="confirmMode = null"
        /><UButton
          color="error"
          label="确认清理"
          :loading="applyLoading"
          @click="applyCleanup(confirmMode === 'all')"
        /></div></template
  ></UModal>
</template>

<style scoped>
.duplicate-page,
.settings-stack,
.detail-stack,
.entries {
  display: grid;
  gap: 16px;
}
.inline-form,
.point-inputs,
.summary-actions,
.row-meta,
.group-head,
.group-head > div,
.entry > div,
.modal-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.point-inputs {
  align-items: end;
}
.point-inputs :deep(.u-form-field) {
  width: 120px;
}
.settings-stack p,
.duplicate-row p,
.group-head > span,
.muted {
  margin: 0;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.summary-actions,
.modal-actions {
  justify-content: flex-end;
}
.duplicate-list {
  display: grid;
  gap: 10px;
}
.duplicate-row {
  padding: 14px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-muted);
}
.row-meta {
  margin-top: 10px;
}
.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  padding: 32px;
}
.spin {
  animation: spin 1s linear infinite;
}
.group-head {
  justify-content: space-between;
}
.entries {
  margin-top: 12px;
}
.entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  background: var(--vtsuru-bg-muted);
  font-size: 13px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 640px) {
  .entry,
  .group-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
