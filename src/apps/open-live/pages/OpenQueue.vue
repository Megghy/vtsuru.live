<script setup lang="ts">
import type { DataTableColumns } from 'naive-ui'
import type { VNodeChild } from 'vue'
import type { OpenLiveInfo, ResponseQueueModel } from '@/api/api-models'
import { Checkmark12Regular, Copy24Regular, Delete24Filled, PeopleQueue24Filled, Search24Regular } from '@vicons/fluent'
import { ReloadCircleSharp } from '@vicons/ionicons5'
import { isSameDay } from 'date-fns'
import {
  NAlert, NButton, NCard, NCheckbox, NDataTable, NDivider, NEmpty, NFlex, NIcon, NInput, NInputGroup, NInputGroupLabel, NPopconfirm, NRadioButton, NRadioGroup, NSpin, NTabPane, NTabs, NTag, NTime, NTooltip, useMessage } from 'naive-ui';
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useAccount } from '@/api/account'
import { QueueFrom, QueueSortType, QueueStatus } from '@/api/api-models'
import { getQueuePaymentMeta, getQueueSourceText, STATUS_MAP, useQueue } from '@/composables/useQueue'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import ObsConfigModal from '@/apps/open-live/components/ObsConfigModal.vue'
import OpenLivePageLayout from '@/apps/open-live/components/OpenLivePageLayout.vue'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'

defineProps<{
  roomInfo?: OpenLiveInfo
  code?: string | undefined
  isOpenLive?: boolean
}>()

const accountInfo = useAccount()
const message = useMessage()
const client = await useDanmakuClient().initOpenlive()
const store = useQueue()

const showOBSModal = ref(false)
const obsScrollSpeed = ref(1.0)
const obsStyleType = ref<'classic' | 'fresh' | 'minimal'>('classic')

const table = ref()

const todayFinishedCount = computed(() =>
  store.historySongs.filter(s => s.status === QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length,
)
const waitingCount = computed(() => store.queue.filter(s => s.status === QueueStatus.Waiting).length)

function copyQueueList() {
  const text = formatListForCopy(store.queue, q => q.user?.name ?? '未知用户')
  if (!text) {
    return
  }
  copyToClipboard(text)
}

const statusFilterOptions = computed(() =>
  Object.values(QueueStatus)
    .filter((t): t is QueueStatus => typeof t === 'number')
    .map(t => ({ label: STATUS_MAP[t], value: t })),
)

const columns = computed<DataTableColumns<ResponseQueueModel>>(() => [
  {
    title: '用户名',
    key: 'user.name',
    render: data => h(NTooltip, { trigger: 'hover' }, {
      trigger: () => data.user?.name || '未知用户',
      default: () => (data.from === QueueFrom.Manual ? '主播手动添加' : `UID: ${data.user?.uid ?? 'N/A'}`),
    }),
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
      const fromType = ({
        [QueueFrom.Danmaku]: 'info',
        [QueueFrom.Gift]: 'error',
        [QueueFrom.Web]: 'success',
        [QueueFrom.Manual]: 'default',
      } as const)[data.from] ?? 'default'
      const tag = h(NTag, { size: 'small', type: fromType, bordered: false }, () => getQueueSourceText(data))
      const detailText = getQueuePaymentMeta(data).detailText
      return detailText ? h(NTooltip, null, { trigger: () => tag, default: () => detailText }) : tag
    },
  },
  {
    title: '状态',
    key: 'status',
    filterMultiple: false,
    filterOptions: statusFilterOptions.value,
    filter: (value, row) => row.status === value,
    render(data) {
      const statusType = ({
        [QueueStatus.Progressing]: 'success',
        [QueueStatus.Waiting]: 'warning',
        [QueueStatus.Finish]: 'info',
        [QueueStatus.Cancel]: 'error',
      } as const)[data.status]
      return h(NTag, { type: statusType, size: 'small', bordered: false }, () => STATUS_MAP[data.status] ?? '未知状态')
    },
  },
  {
    title: '时间',
    key: 'createAt',
    sorter: true,
    render: data => h(NTime, { time: data.createAt, type: 'datetime' }),
  },
  {
    title: '操作',
    key: 'manage',
    width: 120,
    align: 'center',
    render(data) {
      const buttons: VNodeChild[] = []
      if (data.status === QueueStatus.Finish || data.status === QueueStatus.Cancel) {
        buttons.push(h(NTooltip, null, {
          trigger: () => h(NButton, {
            size: 'tiny',
            type: 'info',
            circle: true,
            loading: store.isLoading && store.queueDataBeingManaged === data.id,
            onClick: () => {
              store.queueDataBeingManaged = data.id
              store.updateStatus(data, QueueStatus.Waiting)
            },
            style: 'margin: 0 2px;',
          }, { icon: () => h(NIcon, { component: ReloadCircleSharp }) }),
          default: () => '重新放回等待',
        }))
      }
      buttons.push(h(NPopconfirm, { onPositiveClick: () => store.deleteQueue([data]) }, {
        trigger: () => h(NTooltip, null, {
          trigger: () => h(NButton, {
            size: 'tiny',
            type: 'error',
            circle: true,
            loading: store.isLoading && store.queueDataBeingManaged === data.id,
            onClick: () => store.queueDataBeingManaged = data.id,
            style: 'margin: 0 2px;',
          }, { icon: () => h(NIcon, { component: Delete24Filled }) }),
          default: () => '删除记录',
        }),
        default: () => `确定删除 ${data.user?.name} 的记录吗?`,
      }))
      return h(NFlex, { justify: 'center', size: 4 }, () => buttons)
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
    <template v-if="accountInfo?.id" #actions>
      <NTooltip :disabled="store.configCanEdit">
        <template #trigger>
          <NButton
            type="primary"
            size="small"
            class="open-live-action-btn"
            :disabled="!store.configCanEdit"
            @click="showOBSModal = true"
          >
            OBS 组件
          </NButton>
        </template>
        登录后可使用 OBS 组件功能
      </NTooltip>
    </template>

    <template #switch-extra>
      <NAlert
        type="info"
        size="small"
        :bordered="false"
        closable
        style="margin-top: 10px"
      >
        如果没有部署
        <NButton text type="primary" tag="a" href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs" target="_blank">
          VtsuruEventFetcher
        </NButton>
        则其需要保持此页面开启才能点播, 也不要同时开多个页面, 会导致点播重复 (部署了则不影响)
      </NAlert>
    </template>

    <NCard size="small" bordered>
      <NTabs
        v-if="!accountInfo.id || store.enabled"
        type="line"
        animated
        size="small"
        display-directive="show:lazy"
        pane-style="padding-top: 10px;"
      >
        <!-- 当前队列 -->
        <NTabPane name="list" tab="当前队列">
          <NCard size="small" :bordered="false">
            <NFlex align="center" justify="space-between" wrap :item-style="{ marginBottom: '8px' }">
              <NFlex align="center">
                <NTag type="info" :bordered="false" round>
                  <template #icon>
                    <NIcon :component="PeopleQueue24Filled" />
                  </template>
                  等待中: {{ waitingCount }} 人
                </NTag>
                <NTag type="success" :bordered="false" round>
                  <template #icon>
                    <NIcon :component="Checkmark12Regular" />
                  </template>
                  今日已处理: {{ todayFinishedCount }} 人
                </NTag>
              </NFlex>

              <NInputGroup style="max-width: 250px;">
                <NInput
                  v-model:value="store.activeFilterName"
                  placeholder="搜索当前队列用户"
                  clearable
                >
                  <template #prefix>
                    <NIcon :component="Search24Regular" />
                  </template>
                </NInput>
              </NInputGroup>

              <NInputGroup style="max-width: 250px;">
                <NInput
                  v-model:value="store.newQueueName"
                  placeholder="手动添加用户"
                  clearable
                  @keyup.enter="store.addManual"
                />
                <NButton type="primary" ghost :disabled="!store.newQueueName" @click="store.addManual">
                  添加
                </NButton>
              </NInputGroup>

              <NFlex align="center">
                <NTooltip>
                  <template #trigger>
                    <NButton size="small" ghost :disabled="store.queue.length === 0" @click="copyQueueList">
                      <template #icon>
                        <NIcon :component="Copy24Regular" />
                      </template>
                      复制名单
                    </NButton>
                  </template>
                  复制当前队列为文本名单
                </NTooltip>
                <NPopconfirm @positive-click="store.deactiveAllSongs">
                  <template #trigger>
                    <NButton type="error" size="small" ghost>
                      全部取消
                    </NButton>
                  </template>
                  确定要取消所有等待中和处理中的队列项吗?
                </NPopconfirm>
                <NRadioGroup
                  v-model:value="store.settings.sortType"
                  :disabled="!store.configCanEdit"
                  size="small"
                  @update:value="store.saveSettings"
                >
                  <NRadioButton :value="QueueSortType.TimeFirst">
                    时间
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.PaymentFist">
                    付费
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.GuardFirst">
                    舰长
                  </NRadioButton>
                  <NRadioButton :value="QueueSortType.FansMedalFirst">
                    粉丝牌
                  </NRadioButton>
                </NRadioGroup>
                <NCheckbox
                  v-if="store.configCanEdit"
                  v-model:checked="store.settings.isReverse"
                  size="small"
                  @update:checked="store.saveSettings"
                >
                  倒序
                </NCheckbox>
                <NCheckbox v-else v-model:checked="store.localIsReverse" size="small">
                  倒序
                </NCheckbox>
              </NFlex>
            </NFlex>
          </NCard>

          <NDivider style="margin: 10px 0;" />

          <NSpin :show="store.isLoading && store.originQueue.length === 0">
            <div v-if="store.queue.length > 0" class="queue-list-container">
              <TransitionGroup name="list">
                <div
                  v-for="(queueData, index) in store.queue"
                  :key="queueData.id"
                  class="queue-item-wrapper"
                >
                  <QueueItem :queue-data="queueData" :index="index + 1" />
                  <NDivider style="margin: 0" />
                </div>
              </TransitionGroup>
            </div>
            <NEmpty v-else description="当前队列为空" style="margin-top: 50px;" />
          </NSpin>
        </NTabPane>

        <!-- 历史记录 -->
        <NTabPane name="history" tab="历史记录">
          <NCard size="small" :bordered="false" style="margin-bottom: 10px;">
            <NFlex align="center" justify="space-between">
              <NFlex align="center">
                <NInputGroup style="width: 300px">
                  <NInputGroupLabel> 筛选用户 </NInputGroupLabel>
                  <NInput v-model:value="store.filterName" clearable placeholder="输入用户名" />
                </NInputGroup>
                <NCheckbox v-model:checked="store.filterNameContains">
                  模糊匹配
                </NCheckbox>
              </NFlex>
              <NButton
                size="small"
                type="error"
                ghost
                :disabled="store.historySongs.length === 0"
                @click="store.deleteQueue(store.historySongs)"
              >
                清空所有历史记录
              </NButton>
            </NFlex>
          </NCard>
          <NDataTable
            ref="table"
            size="small"
            :columns="columns"
            :data="store.historySongs"
            :pagination="{ pageSize: 20, showSizePicker: true, pageSizes: [20, 50, 100] }"
            :loading="store.isLoading"
            remote
            :row-key="(row) => row.id"
            striped
          />
        </NTabPane>

        <!-- 设置 -->
        <NTabPane name="setting" tab="设置" :disabled="!store.configCanEdit">
          <QueueSettingsTab
            :is-loading="store.isLoading"
            :settings="store.settings"
            @change="store.saveSettings"
          />
        </NTabPane>
      </NTabs>
      <NAlert v-else title="功能未启用" type="info" size="small" :bordered="false">
        请在页面顶部的开关处启用弹幕队列功能。
      </NAlert>
    </NCard>
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
.n-data-table-td {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
