<script setup lang="ts">
const Delete24Filled = 'i-lucide-circle'
const ReloadCircleSharp = 'i-lucide-circle'
import { isSameDay } from 'date-fns'
import type { VNodeChild } from 'vue'
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch, resolveComponent } from 'vue'

import { useAccount } from '@/api/account'
import type { OpenLiveInfo, ResponseQueueModel } from '@/api/api-models'
import { QueueFrom, QueueSortType, QueueStatus } from '@/api/api-models'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import ObsConfigModal from '@/apps/open-live/components/ObsConfigModal.vue'
import OpenLivePageLayout from '@/apps/open-live/components/OpenLivePageLayout.vue'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'
import { getQueuePaymentMeta, getQueueSourceText, STATUS_MAP, useQueue } from '@/composables/useQueue'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const store = useQueue()

const showOBSModal = ref(false)
const obsScrollSpeed = ref(1.0)
const obsStyleType = ref<'classic' | 'fresh' | 'minimal'>('classic')

const table = ref()

const todayFinishedCount = computed(
  () =>
    store.historySongs.filter((s) => s.status === QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length,
)
const waitingCount = computed(() => store.queue.filter((s) => s.status === QueueStatus.Waiting).length)

function copyQueueList() {
  const text = formatListForCopy(store.queue, (q) => q.user?.name ?? '未知用户')
  if (!text) {
    return
  }
  copyToClipboard(text)
}

const statusFilterOptions = computed(() =>
  Object.values(QueueStatus)
    .filter((t): t is QueueStatus => typeof t === 'number')
    .map((t) => ({ label: STATUS_MAP[t], value: t })),
)

const columns = computed<any[]>(() => [
  {
    title: '用户名',
    key: 'user.name',
    render: (data) =>
      h(
        resolveComponent('UTooltip'),
        { trigger: 'hover' },
        {
          trigger: () => data.user?.name || '未知用户',
          default: () => (data.from === QueueFrom.Manual ? '主播手动添加' : `UID: ${data.user?.uid ?? 'N/A'}`),
        },
      ),
    filterOptionValue: null,
    filter: (value, row) => {
      const name = row.user?.name?.toLowerCase() ?? ''
      const filterVal = store.filterName.toLowerCase()
      if (!filterVal) return true
      return store.filterNameContains ? name.includes(filterVal) : name === filterVal
    },
  },
  {
    title: '来源',
    key: 'from',
    width: 180,
    render(data) {
      const fromType =
        (
          {
            [QueueFrom.Danmaku]: 'info',
            [QueueFrom.Gift]: 'error',
            [QueueFrom.Web]: 'success',
            [QueueFrom.Manual]: 'default',
          } as const
        )[data.from] ?? 'default'
      const tag = h(resolveComponent('UBadge'), { size: 'small', type: fromType, bordered: false }, () =>
        getQueueSourceText(data),
      )
      const detailText = getQueuePaymentMeta(data).detailText
      return detailText ? h(resolveComponent('UTooltip'), null, { trigger: () => tag, default: () => detailText }) : tag
    },
  },
  {
    title: '状态',
    key: 'status',
    filterMultiple: false,
    filterOptions: statusFilterOptions.value,
    filter: (value, row) => row.status === value,
    render(data) {
      const statusType = (
        {
          [QueueStatus.Progressing]: 'success',
          [QueueStatus.Waiting]: 'warning',
          [QueueStatus.Finish]: 'info',
          [QueueStatus.Cancel]: 'error',
        } as const
      )[data.status]
      return h(
        resolveComponent('UBadge'),
        { type: statusType, size: 'small', bordered: false },
        () => STATUS_MAP[data.status] ?? '未知状态',
      )
    },
  },
  {
    title: '时间',
    key: 'createAt',
    sorter: true,
    render: (data) => h('time', { time: data.createAt, type: 'datetime' }),
  },
  {
    title: '操作',
    key: 'manage',
    width: 120,
    align: 'center',
    render(data) {
      const buttons: VNodeChild[] = []
      if (data.status === QueueStatus.Finish || data.status === QueueStatus.Cancel) {
        buttons.push(
          h(resolveComponent('UTooltip'), null, {
            trigger: () =>
              h(
                resolveComponent('UButton'),
                {
                  size: 'tiny',
                  type: 'info',
                  circle: true,
                  loading: store.isLoading && store.queueDataBeingManaged === data.id,
                  onClick: () => {
                    store.queueDataBeingManaged = data.id
                    store.updateStatus(data, QueueStatus.Waiting)
                  },
                  style: 'margin: 0 2px;',
                },
                { icon: () => h(resolveComponent('UIcon'), { component: ReloadCircleSharp }) },
              ),
            default: () => '重新放回等待',
          }),
        )
      }
      buttons.push(
        h(
          resolveComponent('UPopover'),
          { onPositiveClick: () => store.deleteQueue([data]) },
          {
            trigger: () =>
              h(resolveComponent('UTooltip'), null, {
                trigger: () =>
                  h(
                    resolveComponent('UButton'),
                    {
                      size: 'tiny',
                      type: 'error',
                      circle: true,
                      loading: store.isLoading && store.queueDataBeingManaged === data.id,
                      onClick: () => (store.queueDataBeingManaged = data.id),
                      style: 'margin: 0 2px;',
                    },
                    { icon: () => h(resolveComponent('UIcon'), { component: Delete24Filled }) },
                  ),
                default: () => '删除记录',
              }),
            default: () => `确定删除 ${data.user?.name} 的记录吗?`,
          },
        ),
      )
      return h('div', { justify: 'center', size: 4 }, () => buttons)
    },
  },
])

watch([() => store.filterName, () => store.filterNameContains], () => {
  if (table.value) {
    const cols = table.value.columns
    cols[0].filterOptionValue = store.filterName + store.filterNameContains.toString()
    table.value.filter(cols[0])
  }
})

onMounted(async () => {
  if (accountInfo.value.id) {
    store.settings = accountInfo.value.settings.queue
  }
  client.onEvent('danmaku', store.onGetDanmaku)
  client.onEvent('gift', store.onGetGift)
  await store.init()
})

onActivated(async () => {
  await store.init()
})

onDeactivated(() => {
  store.dispose()
})

onUnmounted(() => {
  client.offEvent('danmaku', store.onGetDanmaku)
  client.offEvent('gift', store.onGetGift)
  store.dispose()
})
</script>

<template>
  <OpenLivePageLayout
    title="弹幕排队"
    description="通过弹幕或礼物加入队列，支持过滤条件、排序策略与 OBS 展示"
    :is-logged-in="!!accountInfo?.id"
    show-function-switch
    switch-label="启用弹幕队列功能"
    :enabled="store.enabled"
    :loading="store.isLoading"
    login-tip-text="你尚未注册并登录 VTsuru.live，部分功能和设置将不可用。队列将在本地临时存储。"
    @update:enabled="store.toggleFunction"
  >
    <template
      v-if="accountInfo?.id"
      #footers
    >
      <UTooltip :disabled="store.configCanEdit">
        <UButton
          color="primary"
          size="small"
          class="open-live-action-btn"
          :disabled="!store.configCanEdit"
          @click="showOBSModal = true"
        >
          OBS 组件
        </UButton>
        <template #content> 登录后可使用 OBS 组件功能 </template>
      </UTooltip>
    </template>

    <template #switch-extra>
      <UAlert
        type="info"
        size="small"
        :bordered="false"
        closable
        style="margin-top: 10px"
      >
        如果没有部署
        <UButton
          variant="link"
          color="primary"
          tag="a"
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
        >
          VtsuruEventFetcher
        </UButton>
        则其需要保持此页面开启才能点播, 也不要同时开多个页面, 会导致点播重复 (部署了则不影响)
      </UAlert>
    </template>

    <UCard
      size="small"
      bordered
    >
      <div
        v-if="!accountInfo.id || store.enabled"
        type="line"
        animated
        size="small"
        display-directive="show:lazy"
        pane-style="padding-top: 10px;"
      >
        <!-- 当前队列 -->
        <section
          name="list"
          tab="当前队列"
        >
          <UCard
            size="small"
            :bordered="false"
          >
            <div
              align="center"
              justify="space-between"
              wrap
              :item-style="{ marginBottom: '8px' }"
            >
              <div align="center">
                <UBadge
                  type="info"
                  :bordered="false"
                  round
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  等待中: {{ waitingCount }} 人
                </UBadge>
                <UBadge
                  type="success"
                  :bordered="false"
                  round
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                  今日已处理: {{ todayFinishedCount }} 人
                </UBadge>
              </div>

              <div style="max-width: 250px">
                <UInput
                  v-model="store.activeFilterName"
                  placeholder="搜索当前队列用户"
                  clearable
                >
                  <template #leading>
                    <UIcon name="i-lucide-circle" />
                  </template>
                </UInput>
              </div>

              <div style="max-width: 250px">
                <UInput
                  v-model="store.newQueueName"
                  placeholder="手动添加用户"
                  clearable
                  @keyup.enter="store.addManual"
                />
                <UButton
                  color="primary"
                  ghost
                  :disabled="!store.newQueueName"
                  @click="store.addManual"
                >
                  添加
                </UButton>
              </div>

              <div align="center">
                <UTooltip>
                  <UButton
                    size="small"
                    ghost
                    :disabled="store.queue.length === 0"
                    @click="copyQueueList"
                  >
                    <template #leading>
                      <UIcon name="i-lucide-circle" />
                    </template>
                    复制名单
                  </UButton>
                  <template #content> 复制当前队列为文本名单 </template>
                </UTooltip>
                <UPopover>
                  <UButton
                    color="error"
                    size="sm"
                    ghost
                  >
                    全部取消
                  </UButton>
                  <template #content="{ close }">
                    <div class="space-y-3 p-3">
                      <div>确定要取消所有等待中和处理中的队列项吗?</div>
                      <div class="flex justify-end gap-2">
                        <UButton
                          size="xs"
                          color="neutral"
                          variant="ghost"
                          @click="close"
                          >取消</UButton
                        >
                        <UButton
                          size="xs"
                          color="error"
                          @click="(close(), store.deactiveAllSongs)"
                          >确认</UButton
                        >
                      </div>
                    </div>
                  </template>
                </UPopover>
                <URadioGroup
                  v-model="store.settings.sortType"
                  :disabled="!store.configCanEdit"
                  :items="[
                    { label: '时间', value: QueueSortType.TimeFirst },
                    { label: '付费', value: QueueSortType.PaymentFist },
                    { label: '舰长', value: QueueSortType.GuardFirst },
                    { label: '粉丝牌', value: QueueSortType.FansMedalFirst },
                  ]"
                  orientation="horizontal"
                  @update:model-value="store.saveSettings"
                />
                <UCheckbox
                  v-if="store.configCanEdit"
                  v-model="store.settings.isReverse"
                  size="small"
                  @update:model-value="store.saveSettings"
                >
                  倒序
                </UCheckbox>
                <UCheckbox
                  v-else
                  v-model="store.localIsReverse"
                  size="small"
                >
                  倒序
                </UCheckbox>
              </div>
            </div>
          </UCard>

          <USeparator style="margin: 10px 0" />

          <div :show="store.isLoading && store.originQueue.length === 0">
            <div
              v-if="store.queue.length > 0"
              class="queue-list-container"
            >
              <TransitionGroup name="list">
                <div
                  v-for="(queueData, index) in store.queue"
                  :key="queueData.id"
                  class="queue-item-wrapper"
                >
                  <QueueItem
                    :queue-data="queueData"
                    :index="index + 1"
                  />
                </div>
              </TransitionGroup>
            </div>
            <UEmpty
              v-else
              description="当前队列为空"
              style="margin-top: 50px"
            />
          </div>
        </section>

        <!-- 历史记录 -->
        <section
          name="history"
          tab="历史记录"
        >
          <UCard
            size="small"
            :bordered="false"
            style="margin-bottom: 10px"
          >
            <div
              align="center"
              justify="space-between"
            >
              <div align="center">
                <div style="width: 300px">
                  <span> 筛选用户 </span>
                  <UInput
                    v-model="store.filterName"
                    clearable
                    placeholder="输入用户名"
                  />
                </div>
                <UCheckbox v-model="store.filterNameContains"> 模糊匹配 </UCheckbox>
              </div>
              <UButton
                size="small"
                color="error"
                ghost
                :disabled="store.historySongs.length === 0"
                @click="store.deleteQueue(store.historySongs)"
              >
                清空所有历史记录
              </UButton>
            </div>
          </UCard>
          <UTable
            ref="table"
            size="small"
            :columns="columns"
            :data="store.historySongs"
            :pagination="{ pageIndex: 1, pageSize: 20 }"
            :loading="store.isLoading"
            remote
            :row-key="(row) => row.id"
            striped
          />
        </section>

        <!-- 设置 -->
        <section
          name="setting"
          tab="设置"
          :disabled="!store.configCanEdit"
        >
          <QueueSettingsTab
            :is-loading="store.isLoading"
            :settings="store.settings"
            @change="store.saveSettings"
          />
        </section>
      </div>
      <UAlert
        v-else
        title="功能未启用"
        type="info"
        size="small"
        :bordered="false"
      >
        请在页面顶部的开关处启用弹幕队列功能。
      </UAlert>
    </UCard>
  </OpenLivePageLayout>

  <ObsConfigModal
    v-model:show="showOBSModal"
    v-model:speed="obsScrollSpeed"
    v-model:style-type="obsStyleType"
    obs-path="obs/queue"
    :user-id="accountInfo?.id"
    description="将等待队列显示在 OBS 中，并可像点播组件一样切换不同视觉风格。"
  >
    <template #preview="{ styleType, speed }">
      <QueueOBS
        :id="accountInfo?.id"
        :key="`${accountInfo?.id}-${styleType}-${speed}`"
        :style="styleType"
        :speed-multiplier="speed"
      />
    </template>
  </ObsConfigModal>
</template>

<style>
.queue-list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item-wrapper {
  min-width: 0;
}

.u-data-table-td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
