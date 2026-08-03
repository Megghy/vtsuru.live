<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { format } from 'date-fns'
import { saveAs } from 'file-saver'
import { computed, onMounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import { EventDataTypes } from '@/api/api-models'
import type { ResponsePointGoodModel, ResponsePointUserModel, Setting_Point } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { formatNumber, formatTime } from '@/apps/manage/composables/formatters'
import { useApiAction } from '@/apps/manage/composables/useApiAction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { POINT_API_URL } from '@/shared/config'
import { usePersistedStorage } from '@/shared/storage/persist'
import { objectsToCSV } from '@/shared/utils'

import PointUserDetailCard from './PointUserDetailCard.vue'

interface PointUserSettings {
  onlyAuthed: boolean
}
type PointUserTargetParams = { authId: number } | { uId: number } | { oId: string }

const props = defineProps<{ goods: ResponsePointGoodModel[]; pointSetting?: Setting_Point }>()
const emit = defineEmits<{ openSourceSettings: [] }>()
const accountInfo = useAccount()
const toast = useToast()
const settings = usePersistedStorage<PointUserSettings>('Settings.Point.Users', { onlyAuthed: false })
const page = ref(1)
const pageSize = ref(25)
const showDetail = ref(false)
const showGivePoint = ref(false)
const showReset = ref(false)
const deleteTarget = ref<ResponsePointUserModel>()
const { loading: isLoading, run } = useApiAction()
const addPointCount = ref(0)
const addPointReason = ref('')
const addPointTarget = ref<number>()
const selectedTargetUserName = ref<string>()
const resetConfirmText = ref('')
const users = ref<ResponsePointUserModel[]>([])
const currentUser = ref<ResponsePointUserModel>()
const searchKeyword = ref('')
const debouncedSearchKeyword = ref('')
const resetConfirmPhrase = '我确认删除'
const emptyOpenId = '00000000-0000-0000-0000-000000000000'
const pointSourceOptions = [
  { type: EventDataTypes.Guard, label: '上舰' },
  { type: EventDataTypes.SC, label: 'Superchat' },
  { type: EventDataTypes.Gift, label: '礼物' },
] as const

const enabledPointSources = computed(() =>
  pointSourceOptions
    .filter((source) => (props.pointSetting?.allowType ?? []).includes(source.type))
    .map((source) => source.label),
)
const pointSourceText = computed(() =>
  !props.pointSetting ? '加载中' : enabledPointSources.value.length ? enabledPointSources.value.join('、') : '未启用',
)
const hasPaymentPointSource = computed(() =>
  (props.pointSetting?.allowType ?? []).some((type) => type === EventDataTypes.SC || type === EventDataTypes.Gift),
)
const pointSourceHelpText = computed(() =>
  !props.pointSetting
    ? '正在读取当前积分来源。'
    : hasPaymentPointSource.value
      ? '只有启用的来源会写入积分记录。'
      : 'SC / 礼物未启用时，送礼记录不会生成积分用户。',
)
const filteredUsers = computed(() =>
  users.value
    .filter((user) => {
      if (settings.value.onlyAuthed && !user.isAuthed) return false
      const keyword = debouncedSearchKeyword.value.toLowerCase()
      return !keyword || user.info.name?.toLowerCase().includes(keyword) || user.info.userId?.toString() === keyword
    })
    .toSorted((left, right) => right.updateAt - left.updateAt),
)
const pageCount = computed(() => Math.max(1, Math.ceil(filteredUsers.value.length / pageSize.value)))
const displayedUsers = computed(() =>
  filteredUsers.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value),
)
const userStats = computed(() => {
  const totalPoints = users.value.reduce((sum, user) => sum + user.point, 0)
  return {
    total: users.value.length,
    authed: users.value.filter((user) => user.isAuthed).length,
    totalPoints: Number(totalPoints.toFixed(1)),
    totalOrders: users.value.reduce((sum, user) => sum + (user.orderCount || 0), 0),
    avgPoints: users.value.length ? Number((totalPoints / users.value.length).toFixed(1)) : 0,
    filtered: filteredUsers.value.length,
  }
})

watch(
  searchKeyword,
  useDebounceFn((value: string) => {
    debouncedSearchKeyword.value = value
    page.value = 1
  }, 300),
)
watch([pageSize, pageCount], () => {
  if (page.value > pageCount.value) page.value = pageCount.value
})

function getPointUserTargetParams(user: ResponsePointUserModel): PointUserTargetParams | null {
  const info = user.info
  if (info.id > 0) return { authId: info.id }
  if (info.userId > 0) return { uId: info.userId }
  return info.openId && info.openId !== emptyOpenId ? { oId: info.openId } : null
}

async function refresh() {
  users.value =
    (await run(() => QueryGetAPI<ResponsePointUserModel[]>(`${POINT_API_URL}get-all-users`), {
      fail: '获取用户失败',
    })) ?? []
}
function openUserDetail(user: ResponsePointUserModel) {
  currentUser.value = user
  showDetail.value = true
}

async function givePoint() {
  if (!addPointCount.value) return toast.add({ title: '积分数量不能为 0', color: 'error' })
  if (!addPointTarget.value || addPointTarget.value <= 0) return toast.add({ title: '请输入用户ID', color: 'error' })
  const data = await run(
    () =>
      QueryGetAPI<{ totalPoint: number; userName?: string }>(`${POINT_API_URL}give-point`, {
        uId: addPointTarget.value!,
        count: addPointCount.value,
        reason: addPointReason.value,
      }),
    { fail: '添加失败' },
  )
  if (!data) return
  const userName = data.userName || selectedTargetUserName.value || `UID: ${addPointTarget.value}`
  toast.add({
    title: `已为 ${userName}${addPointCount.value > 0 ? '添加' : '扣除'} ${Math.abs(addPointCount.value)} 积分`,
    color: 'success',
  })
  showGivePoint.value = false
  addPointCount.value = 0
  addPointReason.value = ''
  addPointTarget.value = undefined
  selectedTargetUserName.value = undefined
  await refresh()
}

async function deleteUser(user: ResponsePointUserModel) {
  const params = getPointUserTargetParams(user)
  if (!params) return toast.add({ title: '无法识别积分用户', color: 'error' })
  if (await run(() => QueryGetAPI(`${POINT_API_URL}delete-user`, params), { success: '已删除', fail: '删除失败' }))
    users.value = users.value.filter((item) => item !== user)
}

async function resetAllPoints() {
  if (resetConfirmText.value !== resetConfirmPhrase)
    return toast.add({ title: `请输入“${resetConfirmPhrase}”以确认操作`, color: 'error' })
  if (await run(() => QueryGetAPI(`${POINT_API_URL}reset`), { success: '已重置所有用户积分', fail: '重置失败' })) {
    resetConfirmText.value = ''
    showReset.value = false
    await refresh()
  }
}

function exportData() {
  try {
    const csv = objectsToCSV(
      users.value.map((user) => ({
        用户ID: user.info.userId || user.info.openId,
        用户名: user.info.name || '未知',
        认证状态: user.isAuthed ? '已认证' : '未认证',
        积分: Number(user.point.toFixed(1)),
        订单数量: user.orderCount || 0,
        最后更新时间: format(user.updateAt, 'yyyy-MM-dd HH:mm:ss'),
      })),
    )
    saveAs(
      new Blob([new Uint8Array([0xef, 0xbb, 0xbf]), new TextEncoder().encode(csv)], {
        type: 'text/csv;charset=utf-8;',
      }),
      `用户积分_${format(Date.now(), 'yyyy-MM-dd_HH-mm-ss')}_${accountInfo.value?.name}.csv`,
    )
    toast.add({ title: '导出成功', color: 'success' })
  } catch (error) {
    console.error(error)
    toast.add({ title: `导出失败: ${String(error)}`, color: 'error' })
  }
}

onMounted(refresh)
</script>

<template>
  <div
    class="user-manage"
    :aria-busy="isLoading"
  >
    <section class="stats">
      <div>
        <span>总用户</span><strong>{{ userStats.total }}</strong>
      </div>
      <div>
        <span>已认证</span><strong class="success">{{ userStats.authed }}</strong>
      </div>
      <div>
        <span>总积分</span><strong class="primary">{{ userStats.totalPoints }}</strong>
      </div>
      <div>
        <span>总订单</span><strong class="info">{{ userStats.totalOrders }}</strong>
      </div>
      <div>
        <span>平均积分</span><strong>{{ userStats.avgPoints }}</strong>
      </div>
    </section>
    <UAlert
      :color="hasPaymentPointSource ? 'info' : 'warning'"
      icon="i-lucide-circle-info"
      :title="`当前积分来源：${pointSourceText}`"
      :description="pointSourceHelpText"
      ><template #actions
        ><UButton
          color="neutral"
          variant="soft"
          size="sm"
          icon="i-lucide-settings-2"
          label="来源设置"
          @click="emit('openSourceSettings')" /></template
    ></UAlert>
    <section class="toolbar">
      <div class="filters">
        <UInput
          v-model="searchKeyword"
          icon="i-lucide-search"
          placeholder="搜索用户（用户名或 UID）"
        /><UCheckbox
          v-model="settings.onlyAuthed"
          label="只显示已认证用户"
        /><UTooltip text="开放平台连接下，UID 无法查询部分未认证用户；用户名会保留首次记录时的名称。"
          ><UIcon
            name="i-lucide-info"
            class="info-icon"
        /></UTooltip>
      </div>
      <div class="actions">
        <UButton
          color="neutral"
          variant="soft"
          icon="i-lucide-refresh-cw"
          label="刷新"
          :loading="isLoading"
          @click="refresh"
        /><UButton
          color="info"
          variant="soft"
          icon="i-lucide-circle-plus"
          label="积分调整"
          @click="showGivePoint = true"
        /><UButton
          color="info"
          variant="soft"
          icon="i-lucide-download"
          label="导出"
          @click="exportData"
        /><UButton
          color="error"
          variant="soft"
          icon="i-lucide-trash-2"
          label="重置"
          @click="showReset = true"
        />
      </div>
    </section>
    <UEmpty
      v-if="!displayedUsers.length"
      :icon="isLoading ? 'i-lucide-loader-circle' : 'i-lucide-users-round'"
      :title="isLoading ? '加载中...' : settings.onlyAuthed ? '没有已认证的用户' : '没有用户'"
    />
    <section
      v-else
      class="users-table"
    >
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>认证</th>
              <th>用户名</th>
              <th>积分</th>
              <th>订单数量</th>
              <th>最后更新于</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in displayedUsers"
              :key="`${user.info.id}-${user.info.userId}-${user.info.openId}`"
            >
              <td>
                <UBadge
                  :color="user.isAuthed ? 'success' : 'error'"
                  :label="user.isAuthed ? '已认证' : '未认证'"
                />
              </td>
              <td>
                <strong>{{ user.info.name || '未知用户' }}</strong
                ><span
                  v-if="!user.info.name"
                  class="muted"
                  >{{ user.info.userId || user.info.openId }}</span
                >
              </td>
              <td>
                <strong>{{ formatNumber(Number(user.point.toFixed(1))) }}</strong>
              </td>
              <td>{{ user.isAuthed ? (user.orderCount > 0 ? formatNumber(user.orderCount) : '无订单') : '未认证' }}</td>
              <td>{{ formatTime(user.updateAt) }}</td>
              <td>
                <div class="row-actions">
                  <UButton
                    size="xs"
                    color="info"
                    variant="soft"
                    label="详情"
                    @click="openUserDetail(user)"
                  /><UButton
                    size="xs"
                    color="error"
                    variant="soft"
                    label="删除"
                    @click="deleteTarget = user"
                  />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="pagination">
        <span>共 {{ userStats.filtered }} 位用户</span
        ><USelect
          v-model="pageSize"
          :items="[10, 25, 50, 100]"
        /><UButton
          color="neutral"
          variant="outline"
          size="sm"
          label="上一页"
          :disabled="page === 1"
          @click="page--"
        /><span>{{ page }} / {{ pageCount }}</span
        ><UButton
          color="neutral"
          variant="outline"
          size="sm"
          label="下一页"
          :disabled="page === pageCount"
          @click="page++"
        />
      </div>
    </section>
  </div>
  <UModal
    v-model:open="showDetail"
    title="用户详情"
    ><template #body
      ><PointUserDetailCard
        v-if="currentUser"
        :user="currentUser"
        :goods="goods" /></template
  ></UModal>
  <UModal
    v-model:open="showGivePoint"
    title="给予/扣除积分"
    ><template #body
      ><div class="modal-form">
        <UFormField
          label="目标用户"
          description="输入 UID 后会自动读取 B 站用户信息"
          ><BiliUserSelector
            v-model:value="addPointTarget"
            placeholder="请输入 B 站用户 UID"
            @user-info-loaded="(info) => (selectedTargetUserName = info?.name)" /></UFormField
        ><UFormField
          label="积分数量"
          description="正数为给予，负数为扣除"
          ><UInputNumber
            v-model="addPointCount"
            :min="-99999999"
            :max="99999999" /></UFormField
        ><UFormField label="备注"
          ><UInput
            v-model="addPointReason"
            :maxlength="100"
            placeholder="可选"
        /></UFormField></div></template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="showGivePoint = false"
        /><UButton
          :color="addPointCount < 0 ? 'error' : 'primary'"
          :loading="isLoading"
          :disabled="!addPointCount"
          :label="addPointCount > 0 ? '给予' : '扣除'"
          @click="givePoint"
        /></div></template
  ></UModal>
  <UModal
    v-model:open="showReset"
    title="重置所有用户积分"
    ><template #body
      ><div class="modal-form">
        <UAlert
          color="error"
          icon="i-lucide-triangle-alert"
          title="此操作将删除所有用户积分记录，不可恢复。"
        /><UFormField :label="`请输入“${resetConfirmPhrase}”以确认`"
          ><UInput
            v-model="resetConfirmText"
            placeholder="请输入确认文本"
        /></UFormField></div></template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="showReset = false"
        /><UButton
          color="error"
          :loading="isLoading"
          :disabled="resetConfirmText !== resetConfirmPhrase"
          label="确认重置所有用户积分"
          @click="resetAllPoints"
        /></div></template
  ></UModal>
  <UModal
    :open="Boolean(deleteTarget)"
    title="删除积分用户"
    @update:open="(open) => !open && (deleteTarget = undefined)"
    ><template #body>确认删除 {{ deleteTarget?.info.name || '该用户' }} 的积分记录？此操作不可恢复。</template
    ><template #footer
      ><div class="modal-actions">
        <UButton
          color="neutral"
          variant="soft"
          label="取消"
          @click="deleteTarget = undefined"
        /><UButton
          color="error"
          :loading="isLoading"
          label="删除"
          @click="
            deleteTarget && deleteUser(deleteTarget)
            deleteTarget = undefined
          "
        /></div></template
  ></UModal>
</template>

<style scoped>
.user-manage {
  display: grid;
  gap: 16px;
}
.stats {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}
.stats > div,
.toolbar,
.users-table {
  padding: 16px;
  border: 1px solid var(--vtsuru-border);
  background: var(--vtsuru-bg-surface);
}
.stats span,
.muted {
  display: block;
  color: var(--vtsuru-fg-muted);
  font-size: 13px;
}
.stats strong {
  display: block;
  margin-top: 4px;
  font-size: 24px;
}
.primary {
  color: var(--vtsuru-primary);
}
.success {
  color: var(--vtsuru-success);
}
.info {
  color: var(--vtsuru-info);
}
.toolbar,
.filters,
.actions,
.row-actions,
.pagination,
.modal-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.toolbar {
  justify-content: space-between;
}
.filters :deep(.u-input) {
  width: 240px;
}
.info-icon {
  color: var(--vtsuru-fg-muted);
  cursor: help;
}
.table-scroll {
  overflow: auto;
}
table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
}
th,
td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--vtsuru-border);
  white-space: nowrap;
}
th {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  font-weight: 500;
}
.pagination {
  justify-content: flex-end;
  padding-top: 16px;
}
.modal-form {
  display: grid;
  gap: 16px;
}
.modal-actions {
  justify-content: flex-end;
}
@media (max-width: 900px) {
  .stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
