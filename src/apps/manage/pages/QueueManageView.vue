<script setup lang="ts">
import {
  Add24Regular,
  Checkmark12Regular,
  CheckmarkCircle24Regular,
  Color24Regular,
  Copy24Regular,
  Delete24Filled,
  Desktop24Regular,
  Eye24Regular,
  Flash24Regular,
  History24Regular,
  PeopleQueue24Filled,
  PeopleQueue24Regular,
  PersonAdd24Regular,
  Search24Regular,
  Settings24Regular,
  ShieldCheckmark24Regular,
  Sparkle24Regular,
} from '@vicons/fluent'
import { ReloadCircleSharp } from '@vicons/ionicons5'
import { isSameDay } from 'date-fns'
import type { DataTableColumns } from 'naive-ui'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NDataTable,
  NDivider,
  NEmpty,
  NFlex,
  NGi,
  NGrid,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSelect,
  NSpin,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTime,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'

import { useAccount } from '@/api/account'
import type { OpenLiveInfo, ResponseQueueModel } from '@/api/api-models'
import { FunctionTypes, QueueFrom, QueueSortType, QueueStatus } from '@/api/api-models'
import ManagePageHeader from '@/apps/manage/components/ManagePageHeader.vue'
import QueueOBS from '@/apps/obs/pages/QueueOBS.vue'
import QueueItem from '@/apps/open-live/components/queue/QueueItem.vue'
import QueueSettingsTab from '@/apps/open-live/components/queue/QueueSettingsTab.vue'
import { getQueuePaymentMeta, getQueueSourceText, STATUS_MAP, useQueue } from '@/composables/useQueue'
import { CURRENT_HOST } from '@/shared/config'
import { buildObsSourceUrl } from '@/shared/obs/obsUrl'
import { copyToClipboard } from '@/shared/utils'
import { formatListForCopy } from '@/shared/utils/queue'
import { useDanmakuClient } from '@/store/useDanmakuClient'

const message = useMessage()
const accountInfo = useAccount()
const client = await useDanmakuClient().initOpenlive()
const store = useQueue()

// 主 Tab
const activeMainTab = ref<'queue' | 'preview' | 'settings'>('queue')

// OBS 调试与样式参数
const obsStyleType = ref<'glass' | 'transparent' | 'classic' | 'fresh' | 'minimal'>('glass')
const obsScrollSpeed = ref(1.0)
const previewBg = ref<'checker' | 'dark' | 'light' | 'game'>('checker')

// 计算完整的 OBS 链接
const obsUrl = computed(() => {
  const params: Record<string, string> = {
    style: obsStyleType.value,
  }
  if (obsScrollSpeed.value !== 1.0) {
    params.speed = obsScrollSpeed.value.toString()
  }
  return buildObsSourceUrl({
    path: 'obs/queue',
    host: CURRENT_HOST,
    credential: 'public-id',
    userId: accountInfo.value?.id,
    params,
  })
})

const todayFinishedCount = computed(
  () => store.historySongs.filter((s) => s.status === QueueStatus.Finish && isSameDay(s.finishAt ?? 0, Date.now())).length,
)
const waitingCount = computed(() => store.queue.filter((s) => s.status === QueueStatus.Waiting).length)

function copyQueueList() {
  const text = formatListForCopy(store.queue, (q) => q.user?.name ?? '未知用户')
  if (!text) {
    message.warning('当前队列为空')
    return
  }
  copyToClipboard(text)
  message.success('排队名单已复制到剪贴板')
}

async function copyObsLink() {
  if (!obsUrl.value) {
    message.warning('尚未登录或未生成有效链接')
    return
  }
  await copyToClipboard(obsUrl.value)
  message.success('OBS 源链接已复制 (已携带当前调试样式参数)')
}

// 模拟加人与测试
const sampleNames = ['小鱼干爱好者', '星尘远航者', '魔法少女喵', '橘子汽水', '秋风扫落叶', '可乐要加冰', '月下漫步']
function injectMockUser() {
  const name = sampleNames[Math.floor(Math.random() * sampleNames.length)]
  store.newQueueName = `${name} #${Math.floor(Math.random() * 100)}`
  store.addManual()
  message.success(`已添加模拟观众「${store.newQueueName}」`)
  store.newQueueName = ''
}

// 表格列定义
const columns = computed<DataTableColumns<ResponseQueueModel>>(() => [
  {
    title: '用户名',
    key: 'user.name',
    render: (data) =>
      h(
        NTooltip,
        { trigger: 'hover' },
        {
          trigger: () => data.user?.name || '未知用户',
          default: () => (data.from === QueueFrom.Manual ? '手动添加' : `UID: ${data.user?.uid ?? 'N/A'}`),
        },
      ),
  },
  {
    title: '来源',
    key: 'from',
    width: 140,
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
      return h(NTag, { size: 'small', type: fromType, bordered: false }, () => getQueueSourceText(data))
    },
  },
  {
    title: '加入时间',
    key: 'createAt',
    width: 160,
    render: (data) => h(NTime, { time: data.createAt, format: 'MM-dd HH:mm:ss' }),
  },
  {
    title: '操作',
    key: 'action',
    width: 130,
    render: (data) =>
      h(NFlex, { size: 6 }, () => [
        h(
          NButton,
          {
            size: 'tiny',
            type: 'info',
            onClick: () => store.updateStatus(data, QueueStatus.Waiting),
          },
          { default: () => '重置' },
        ),
        h(
          NPopconfirm,
          { onPositiveClick: () => store.deleteQueue([data]) },
          {
            trigger: () => h(NButton, { size: 'tiny', type: 'error' }, { default: () => '删除' }),
            default: () => `确定删除 ${data.user?.name} 吗？`,
          },
        ),
      ]),
  },
])

onMounted(async () => {
  if (accountInfo.value?.id) {
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
  <div class="queue-manage-view">
    <ManagePageHeader
      title="弹幕排队系统"
      subtitle="观众通过发送指定弹幕或赠送礼物加入等待队列，支持多策略排序、过滤合并与 1080P OBS 动态呈现"
      :function-type="FunctionTypes.Queue"
      :links="[
        {
          label: 'OBS 浏览器源地址',
          value: obsUrl,
          description: '将此链接作为 OBS 浏览器源添加，建议分辨率 400x600 或按需调整',
        },
      ]"
    >
      <template #action>
        <NButton size="small" secondary @click="copyQueueList">
          <template #icon><NIcon :component="Copy24Regular" /></template>
          复制队列名单
        </NButton>
      </template>
    </ManagePageHeader>

    <NTabs
      v-model:value="activeMainTab"
      type="segment"
      animated
      class="main-nav-tabs"
      style="margin-top: 14px"
    >
      <!-- ================= Tab 1: 当前队列与处理 ================= -->
      <NTabPane name="queue">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="PeopleQueue24Regular" />
            <span>当前排队队列</span>
          </NFlex>
        </template>
        <NFlex vertical :size="14" style="margin-top: 14px">
          <NCard size="small">
            <NFlex justify="space-between" align="center" wrap>
              <!-- 统计指示 -->
              <NFlex align="center" :size="8">
                <NTag type="info" :bordered="false" round>
                  <template #icon><NIcon :component="PeopleQueue24Filled" /></template>
                  等待中: {{ waitingCount }} 人
                </NTag>
                <NTag type="success" :bordered="false" round>
                  <template #icon><NIcon :component="Checkmark12Regular" /></template>
                  今日已完成: {{ todayFinishedCount }} 人
                </NTag>
              </NFlex>

              <!-- 快速搜索与手动添加 -->
              <NFlex align="center" :size="8">
                <NInputGroup style="width: 200px">
                  <NInput
                    v-model:value="store.activeFilterName"
                    size="small"
                    placeholder="搜索队列用户"
                    clearable
                  >
                    <template #prefix><NIcon :component="Search24Regular" /></template>
                  </NInput>
                </NInputGroup>

                <NInputGroup style="width: 220px">
                  <NInput
                    v-model:value="store.newQueueName"
                    size="small"
                    placeholder="手动输入用户名"
                    clearable
                    @keyup.enter="store.addManual"
                  />
                  <NButton size="small" type="primary" @click="store.addManual">
                    <template #icon><NIcon :component="Add24Regular" /></template>
                    添加
                  </NButton>
                </NInputGroup>

                <NPopconfirm @positive-click="store.deleteQueue(store.queue)">
                  <template #trigger>
                    <NButton size="small" secondary type="error">清空当前</NButton>
                  </template>
                  确定要清空全部等待中的排队记录吗？
                </NPopconfirm>
              </NFlex>
            </NFlex>
          </NCard>

          <!-- 列表卡片 -->
          <NCard size="small" :bordered="false">
            <NSpin :show="store.isLoading && store.originQueue.length === 0">
              <div v-if="store.queue.length > 0" class="queue-list-container">
                <TransitionGroup name="list">
                  <div
                    v-for="(queueData, index) in store.queue"
                    :key="queueData.id"
                    class="queue-item-wrapper"
                  >
                    <QueueItem :queue-data="queueData" :index="index + 1" />
                  </div>
                </TransitionGroup>
              </div>
              <NEmpty
                v-else
                description="当前排队队列为空，等待观众发送弹幕或送礼加入"
                style="padding: 60px 0"
              />
            </NSpin>
          </NCard>
        </NFlex>
      </NTabPane>

      <!-- ================= Tab 2: OBS 1080P 舞台预览与仿真调试 ================= -->
      <NTabPane name="preview">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Desktop24Regular" />
            <span>OBS 舞台预览与仿真</span>
          </NFlex>
        </template>
        <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen" style="margin-top: 14px">
          <!-- 舞台视口 (占 8 列) -->
          <NGi :span="8">
            <NCard size="small">
              <template #header>
                <NFlex justify="space-between" align="center">
                  <NFlex align="center" :size="8">
                    <NIcon :component="Eye24Regular" />
                    <NText strong>OBS 画布实时预览 (1080P 比例视口)</NText>
                  </NFlex>

                  <NRadioGroup v-model:value="previewBg" size="small">
                    <NRadioButton value="checker">透明网格</NRadioButton>
                    <NRadioButton value="dark">纯黑背景</NRadioButton>
                    <NRadioButton value="light">浅色背景</NRadioButton>
                    <NRadioButton value="game">游戏场景</NRadioButton>
                  </NRadioGroup>
                </NFlex>
              </template>

              <!-- 舞台视口 -->
              <div class="stage-viewport" :class="[`bg-${previewBg}`]">
                <div class="stage-canvas">
                  <QueueOBS
                    :id="accountInfo?.id"
                    :key="`${accountInfo?.id}-${obsStyleType}-${obsScrollSpeed}`"
                    :style="obsStyleType"
                    :speed-multiplier="obsScrollSpeed"
                  />
                </div>
              </div>

              <template #action>
                <NFlex justify="space-between" align="center">
                  <NText depth="3" style="font-size: 12px">
                    推荐 OBS 来源尺寸：宽 360px ~ 420px，高 540px ~ 680px。
                  </NText>
                  <NButton size="small" type="primary" @click="copyObsLink">
                    <template #icon><NIcon :component="Copy24Regular" /></template>
                    复制当前样式 OBS 链接
                  </NButton>
                </NFlex>
              </template>
            </NCard>
          </NGi>

          <!-- 样式与仿真控制器 (占 4 列) -->
          <NGi :span="4">
            <NFlex vertical :size="16">
              <!-- 样式预设选择 -->
              <NCard size="small">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Color24Regular" />
                    <span>OBS 视觉预设</span>
                  </NFlex>
                </template>
                <NFlex vertical :size="12">
                  <NRadioGroup v-model:value="obsStyleType" size="small">
                    <NFlex vertical :size="8">
                      <NRadioButton value="glass" style="width: 100%">
                        毛玻璃质感 (Modern Glass)
                      </NRadioButton>
                      <NRadioButton value="transparent" style="width: 100%">
                        纯透明无底壳 (Transparent - 贴图专用)
                      </NRadioButton>
                      <NRadioButton value="minimal" style="width: 100%">
                        极简通透流 (Minimal Text)
                      </NRadioButton>
                      <NRadioButton value="classic" style="width: 100%">
                        经典卡片 (Classic Dark)
                      </NRadioButton>
                      <NRadioButton value="fresh" style="width: 100%">
                        清新自然 (Fresh Light)
                      </NRadioButton>
                    </NFlex>
                  </NRadioGroup>

                  <NDivider style="margin: 4px 0" />

                  <NFlex justify="space-between" align="center">
                    <span style="font-size: 12px; color: var(--vtsuru-fg-muted)">滚动轮播速度：</span>
                    <NInputNumber
                      v-model:value="obsScrollSpeed"
                      :min="0.5"
                      :max="3"
                      :step="0.2"
                      size="tiny"
                      style="width: 100px"
                    >
                      <template #suffix>x</template>
                    </NInputNumber>
                  </NFlex>
                </NFlex>
              </NCard>

              <!-- 仿真调试工具 -->
              <NCard size="small">
                <template #header>
                  <NFlex align="center" :size="6">
                    <NIcon :component="Flash24Regular" />
                    <span>舞台仿真调试</span>
                  </NFlex>
                </template>
                <NFlex vertical :size="10">
                  <NButton size="small" block secondary @click="injectMockUser">
                    <template #icon><NIcon :component="PersonAdd24Regular" /></template>
                    注入一个测试观众 (+1)
                  </NButton>

                  <NButton
                    v-if="store.queue.length > 0"
                    size="small"
                    block
                    type="success"
                    secondary
                    @click="store.updateStatus(store.queue[0], QueueStatus.Finish)"
                  >
                    <template #icon><NIcon :component="CheckmarkCircle24Regular" /></template>
                    完成当前首位观众
                  </NButton>
                </NFlex>
              </NCard>
            </NFlex>
          </NGi>
        </NGrid>
      </NTabPane>

      <!-- ================= Tab 3: 历史排队与规则设置 ================= -->
      <NTabPane name="settings">
        <template #tab>
          <NFlex align="center" :size="6" :wrap="false">
            <NIcon :component="Settings24Regular" />
            <span>规则设置与历史</span>
          </NFlex>
        </template>
        <NGrid :x-gap="16" :y-gap="16" :cols="12" responsive="screen" style="margin-top: 14px">
          <!-- 左侧：历史记录 (占 7 列) -->
          <NGi :span="7">
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="6">
                  <NIcon :component="History24Regular" />
                  <span>历史处理记录</span>
                </NFlex>
              </template>
              <NDataTable
                :columns="columns"
                :data="store.historySongs"
                :loading="store.isLoading"
                size="small"
                :pagination="{ pageSize: 8 }"
              />
            </NCard>
          </NGi>

          <!-- 右侧：规则配置面板 (占 5 列) -->
          <NGi :span="5">
            <NCard size="small">
              <template #header>
                <NFlex align="center" :size="6">
                  <NIcon :component="ShieldCheckmark24Regular" />
                  <span>触发条件与防刷规则</span>
                </NFlex>
              </template>
              <QueueSettingsTab
                :is-loading="store.isLoading"
                :settings="accountInfo.settings.queue"
                @change="store.saveSettings"
              />
            </NCard>
          </NGi>
        </NGrid>
      </NTabPane>
    </NTabs>
  </div>
</template>

<style scoped>
.queue-manage-view {
  width: 100%;
}

.main-nav-tabs {
  --n-tab-padding: 6px 16px !important;
}

.main-nav-tabs :deep(.n-tabs-rail) {
  width: fit-content;
  max-width: 100%;
}

.main-nav-tabs :deep(.n-tabs-tab) {
  white-space: nowrap;
  font-weight: 500;
}

.queue-list-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.queue-item-wrapper {
  min-width: 0;
}

/* 1080P 舞台视口 */
.stage-viewport {
  width: 100%;
  height: 520px;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  border: 1px solid var(--vtsuru-border);
}

.stage-viewport.bg-checker {
  background-image: linear-gradient(45deg, #1e293b 25%, transparent 25%),
    linear-gradient(-45deg, #1e293b 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1e293b 75%),
    linear-gradient(-45deg, transparent 75%, #1e293b 75%);
  background-size: 20px 20px;
  background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
  background-color: #0f172a;
}

.stage-viewport.bg-dark { background-color: #000000; }
.stage-viewport.bg-light { background-color: #f1f5f9; }
.stage-viewport.bg-game {
  background: linear-gradient(rgba(15, 23, 42, 0.75), rgba(15, 23, 42, 0.75)),
    radial-gradient(circle at 80% 20%, #3b82f6 0%, transparent 40%),
    radial-gradient(circle at 20% 80%, #ec4899 0%, transparent 40%), #090d16;
}

.stage-canvas {
  width: 380px;
  height: 480px;
  position: relative;
}
</style>
