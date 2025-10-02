<script setup lang="ts">
import type { AutoActionItem } from '@/client/store/useAutoAction'
import { ArrowDown24Regular, ArrowUp24Regular, Edit16Regular, Target24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NDataTable,
  NDivider,
  NDropdown,
  NEmpty,
  NIcon,
  NInput,
  NInputNumber,
  NModal,
  NPopconfirm,
  NSelect,
  NSpace,
  NSwitch,
  NTabPane,
  NTabs,
  NTag,
  NText,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, h, reactive, ref } from 'vue'
import { TriggerType, useAutoAction } from '@/client/store/useAutoAction'
import { useBiliCookie } from '@/client/store/useBiliCookie'
import { useBiliFunction } from '@/client/store/useBiliFunction'
import { useDanmakuClient } from '@/store/useDanmakuClient'
import { useWebFetcher } from '@/store/useWebFetcher'
import ActionHistoryViewer from './components/autoaction/ActionHistoryViewer.vue'
import AutoActionEditor from './components/autoaction/AutoActionEditor.vue'
import DataManager from './components/autoaction/DataManager.vue'
import CheckInSettings from './components/autoaction/settings/CheckInSettings.vue'
import GlobalScheduledSettings from './components/autoaction/settings/GlobalScheduledSettings.vue'
import TimerCountdown from './components/autoaction/TimerCountdown.vue'

const autoActionStore = useAutoAction()
const message = useMessage()
const danmakuClient = useDanmakuClient()
const biliCookieStore = useBiliCookie()
const webFetcherStore = useWebFetcher()
const biliFunc = useBiliFunction()

// 从 store 获取 enabledTriggerTypes
const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

// 分类标签
const typeMap = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '上舰感谢',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC感谢',
}

const activeTab = ref(TriggerType.GIFT)
const activeMainTab = ref('action-management')
const showAddModal = ref(false)
const selectedTriggerType = ref<TriggerType>(TriggerType.GIFT)
const editingActionId = ref<string | null>(null)
const showSetNextModal = ref(false)
const targetNextActionId = ref<string | null>(null)
const showTestModal = ref(false)
const testUid = ref<string>('10004')
const currentTestType = ref<TriggerType | null>(null)

const triggerTypeOptions = [
  { label: '自动回复', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '上舰感谢', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
]

const customColumnsByType = reactive<Record<string, any[]>>({})

function toggleActionStatus(action: AutoActionItem) {
  autoActionStore.toggleAutoAction(action.id, !action.enabled)
  message.success(`已${!action.enabled ? '启用' : '禁用'}操作: ${action.name || '未命名自动操作'}`)
}

function getStatusTag(action: AutoActionItem) {
  // 检查是否需要登录且未登录
  const config = action.actionConfig as any // 使用类型断言访问 type
  const requiresLogin = config.type === 'sendDanmaku' || config.type === 'sendMessage'
  if (requiresLogin && !biliCookieStore.isCookieValid) {
    return { type: 'error' as const, text: '需登录', tooltip: '发送弹幕或私信需要登录B站账号' }
  }
  // 1. Check type enable switch (从 store 读取)
  if (!enabledTriggerTypes.value[action.triggerType]) {
    return { type: 'warning' as const, text: '类型已禁用', tooltip: `所有${typeMap[action.triggerType]}类型的操作已禁用` }
  }
  // 2. Check action self enabled
  if (!action.enabled) {
    return { type: 'error' as const, text: '已禁用', tooltip: '此操作已被手动禁用' }
  }
  // 3. Check if template is empty
  if (!action.template
    || (typeof action.template === 'string' && action.template.trim() === '')
    || (Array.isArray(action.template) && action.template.length === 0)) {
    return { type: 'warning' as const, text: '模板为空', tooltip: '请设置有效的模板内容' }
  }
  // 4. Check onlyDuringLive condition
  if (action.triggerConfig.onlyDuringLive && !autoActionStore.isLive) {
    return { type: 'warning' as const, text: '待机中', tooltip: '此操作设置为仅在直播时触发' }
  }
  // 5. Check ignoreTianXuan condition
  if (action.triggerConfig.ignoreTianXuan && autoActionStore.isTianXuanActive) {
    return { type: 'warning' as const, text: '暂停中', tooltip: '此操作设置为忽略天选时刻，当前正在进行天选' }
  }
  // 6. All conditions met, enabled
  return { type: 'success' as const, text: '已启用', tooltip: '此操作当前处于活动状态' }
}

const baseColumns = [
  {
    title: '名称',
    key: 'name',
    render: (row: AutoActionItem) => {
      return h('div', { style: 'font-weight: 500' }, row.name || '未命名自动操作')
    },
  },
  {
    title: '状态',
    key: 'enabled',
    width: 100,
    render: (row: AutoActionItem) => {
      const status = getStatusTag(row)

      const options = [
        {
          label: row.enabled ? '禁用此操作' : '启用此操作',
          key: 'toggleEnable',
          props: {
            onClick: () => {
              autoActionStore.toggleAutoAction(row.id, !row.enabled)
              message.success(`已${!row.enabled ? '启用' : '禁用'}操作: ${row.name || '未命名自动操作'}`)
            },
          },
        },
        {
          label: row.triggerConfig.onlyDuringLive ? '取消"仅直播触发"' : '设为"仅直播触发"',
          key: 'toggleLive',
          props: {
            onClick: () => {
              row.triggerConfig.onlyDuringLive = !row.triggerConfig.onlyDuringLive
              message.success(`操作"${row.name || '未命名'}"已${row.triggerConfig.onlyDuringLive ? '设为' : '取消'}仅直播触发`)
              if (row.triggerType === TriggerType.SCHEDULED) {
                if (row.triggerConfig.useGlobalTimer) {
                  autoActionStore.restartGlobalTimer()
                } else {
                  autoActionStore.stopIndividualTimer(row.id)
                  autoActionStore.startIndividualTimer(row)
                }
              }
            },
          },
        },
        {
          label: row.triggerConfig.ignoreTianXuan ? '取消"忽略天选暂停"' : '设为"忽略天选暂停"',
          key: 'toggleTianXuan',
          props: {
            onClick: () => {
              row.triggerConfig.ignoreTianXuan = !row.triggerConfig.ignoreTianXuan
              message.success(`操作"${row.name || '未命名'}"已${row.triggerConfig.ignoreTianXuan ? '设为' : '取消'}忽略天选暂停`)
              if (row.triggerType === TriggerType.SCHEDULED) {
                if (row.triggerConfig.useGlobalTimer) {
                  autoActionStore.restartGlobalTimer()
                } else {
                  autoActionStore.stopIndividualTimer(row.id)
                  autoActionStore.startIndividualTimer(row)
                }
              }
            },
          },
        },
      ]

      return h(
        NDropdown,
        {
          trigger: 'click',
          options,
          showArrow: true,
        },
        {
          default: () => h(
            NTooltip,
            { trigger: 'hover' },
            {
              trigger: () => h(
                NTag,
                {
                  type: status.type,
                  size: 'small',
                  round: true,
                  style: 'cursor: pointer;',
                },
                { default: () => status.text },
              ),
              default: () => status.tooltip,
            },
          ),
        },
      )
    },
  },
]

const remainingTimeColumn = {
  title: '下一次发送 (估算)',
  key: 'remainingTime',
  width: 180,
  render: (row: AutoActionItem) => {
    if (!enabledTriggerTypes.value[TriggerType.SCHEDULED]) {
      return h(NText, { depth: 3 }, '类型已禁用')
    }
    return h(TimerCountdown, { actionId: row.id })
  },
}

function createActionsColumn(type: TriggerType, items: AutoActionItem[]) {
  return {
    title: '操作',
    key: 'actions',
    width: type === TriggerType.SCHEDULED ? 240 : 180,
    render: (row: AutoActionItem, index: number) => {
      const buttons = [
        h(
          NButton,
          {
            size: 'small',
            type: 'primary',
            ghost: true,
            onClick: () => editAction(row.id),
          },
          { default: () => '编辑' },
        ),
      ]

      if (type === TriggerType.SCHEDULED) {
        buttons.unshift(
          h(NButton, {
            size: 'small',
            circle: true,
            tertiary: true,
            disabled: index === 0,
            onClick: () => moveAction(row.id, 'up'),
            title: '上移',
          }, { icon: () => h(NIcon, { component: ArrowUp24Regular }) }),
          h(NButton, {
            size: 'small',
            circle: true,
            tertiary: true,
            style: 'margin-left: 6px;',
            disabled: index === items.length - 1,
            onClick: () => moveAction(row.id, 'down'),
            title: '下移',
          }, { icon: () => h(NIcon, { component: ArrowDown24Regular }) }),
        )
      }

      buttons.push(
        h(
          NDropdown,
          {
            trigger: 'hover',
            options: [
              { label: '复制', key: 'duplicate' },
              { label: '删除', key: 'delete' },
            ],
            onSelect: (key: string) => {
              if (key === 'duplicate') duplicateAutoAction(row)
              if (key === 'delete') removeAutoAction(row)
            },
          },
          {
            default: () => h(
              NButton,
              { size: 'small', tertiary: true, style: 'padding: 0 8px; margin-left: 6px;' },
              { default: () => '•••' },
            ),
          },
        ),
      )

      return h(NSpace, { justify: 'end', align: 'center' }, { default: () => buttons })
    },
  }
}

function getColumnsForType(type: TriggerType) {
  const items = groupedActions.value[type] || []
  const customCols = customColumnsByType[type] || []
  const actionsCol = createActionsColumn(type, items)

  if (type === TriggerType.SCHEDULED) {
    return [...baseColumns, remainingTimeColumn, ...customCols, actionsCol]
  }

  return [...baseColumns, ...customCols, actionsCol]
}

const groupedActions = computed(() => {
  const grouped: Record<string, AutoActionItem[]> = {}
  Object.values(TriggerType).forEach((type) => {
    grouped[type as string] = []
  })
  autoActionStore.autoActions.forEach((action) => {
    if (grouped[action.triggerType]) {
      grouped[action.triggerType].push(action)
    }
  })
  Object.keys(grouped).forEach((type) => {
    grouped[type].sort((a, b) => {
      if (a.enabled === b.enabled) return 0
      return a.enabled ? -1 : 1
    })
  })
  return grouped
})

const eligibleGlobalActions = computed(() => {
  if (!enabledTriggerTypes.value) return []
  return autoActionStore.autoActions.filter(action =>
    action.triggerType === TriggerType.SCHEDULED
    && enabledTriggerTypes.value[TriggerType.SCHEDULED]
    && action.enabled
    && action.triggerConfig.useGlobalTimer
    && (!action.triggerConfig.onlyDuringLive || autoActionStore.isLive)
    && (!action.triggerConfig.ignoreTianXuan || !autoActionStore.isTianXuanActive),
  ).map(action => ({
    label: action.name || '未命名操作',
    value: action.id,
  }))
})

function openSetNextModal() {
  targetNextActionId.value = autoActionStore.nextScheduledAction?.id ?? null
  showSetNextModal.value = true
}

function confirmSetNextAction() {
  if (targetNextActionId.value) {
    autoActionStore.setNextGlobalAction(targetNextActionId.value)
    message.success('已指定下一条执行的操作')
  }
  showSetNextModal.value = false
}

function addAutoAction() {
  if (!selectedTriggerType.value) {
    message.error('请选择触发类型')
    return
  }
  const newAction = autoActionStore.addAutoAction(selectedTriggerType.value)
  showAddModal.value = false
  activeTab.value = selectedTriggerType.value
  editingActionId.value = newAction.id
  message.success('已添加新的自动操作')
}

function removeAutoAction(action: AutoActionItem) {
  autoActionStore.removeAutoAction(action.id)
  if (editingActionId.value === action.id) {
    editingActionId.value = null
  }
  message.success('已删除自动操作')
}

function duplicateAutoAction(action: AutoActionItem) {
  const newActionData = JSON.parse(JSON.stringify(action))
  const newActionId = `auto-action-${Date.now()}`
  newActionData.id = newActionId
  newActionData.name += ' (复制)'
  autoActionStore.autoActions.push(newActionData)
  if (newActionData.triggerType === TriggerType.SCHEDULED) {
    const addedAction = autoActionStore.autoActions.find(a => a.id === newActionId)
    if (addedAction) {
      if (addedAction.triggerConfig.useGlobalTimer) {
        autoActionStore.restartGlobalTimer()
      } else {
        autoActionStore.startIndividualTimer(addedAction)
      }
    } else {
      console.error('[ClientAutoAction] Could not find duplicated action after pushing.')
    }
  }
  message.success('已复制自动操作')
}

function moveAction(actionId: string, direction: 'up' | 'down') {
  autoActionStore.moveAction(actionId, direction)
}

function editAction(actionId: string) {
  editingActionId.value = actionId
}

function backToOverview() {
  editingActionId.value = null
}

function toggleTypeStatus(type: string) {
  const triggerType = type as TriggerType
  const newState = !enabledTriggerTypes.value[triggerType]
  autoActionStore.setTriggerTypeEnabled(triggerType, newState)
  message.success(`已${newState ? '启用' : '禁用'}所有 ${typeMap[triggerType]}`)
}

function handleTestClick(type: TriggerType) {
  const requiresLogin = [TriggerType.DANMAKU, TriggerType.GUARD, TriggerType.SUPER_CHAT].includes(type)
  if (requiresLogin && !biliCookieStore.isCookieValid) {
    message.error('此测试需要登录B站账号，请先前往设置页面登录')
    return
  }

  if (type === TriggerType.GUARD) {
    // 为舰长相关(私信)测试显示UID输入对话框
    currentTestType.value = type
    testUid.value = '10004' // 默认值
    showTestModal.value = true
  } else {
    // 其他类型直接测试
    autoActionStore.triggerTestActionByType(type)
  }
}

function confirmTest() {
  if (currentTestType.value === TriggerType.GUARD) {
    // 在执行私信测试前再次确认登录状态
    if (!biliCookieStore.isCookieValid) {
      message.error('无法发送私信测试，请先登录B站账号')
      showTestModal.value = false
      return
    }
    const uid = Number.parseInt(testUid.value)
    if (isNaN(uid) || uid <= 0) {
      message.error('请输入有效的UID')
      return
    }
    autoActionStore.triggerTestActionByType(currentTestType.value, uid)
  }
  showTestModal.value = false
}
</script>

<template>
  <div>
    <NCard
      title="自动操作设置"
      size="small"
    >
      <template #header-extra>
        <NButton
          type="primary"
          @click="showAddModal = true"
        >
          添加自动操作
        </NButton>
      </template>

      <!-- 添加全局登录提示 -->
      <NAlert
        v-if="!biliCookieStore.isCookieValid"
        type="warning"
        title="未登录B站账号"
        style="margin-bottom: 16px;"
        :bordered="false"
        closable
      >
        部分需要发送弹幕或私信的自动操作（如自动回复、上舰感谢）将无法执行。请前往【设置】- 【账号设置】页面登录。
      </NAlert>

      <NSpace
        vertical
        size="large"
      >
        <NTabs
          v-model:value="activeMainTab"
          type="line"
          animated
          @update:value="editingActionId = null"
        >
          <!-- 操作管理标签页 -->
          <NTabPane
            name="action-management"
            tab="操作管理"
          >
            <NTabs
              v-model:value="activeTab"
              type="segment"
              animated
              style="margin-bottom: 16px"
            >
              <NTabPane
                v-for="(label, type) in typeMap"
                :key="type"
                :name="type"
              >
                <template #tab>
                  <span
                    :style="{
                      color: enabledTriggerTypes && enabledTriggerTypes[type] ? '#18a058' : '#d03050',
                      fontWeight: 'medium',
                    }"
                    :title="enabledTriggerTypes && enabledTriggerTypes[type] ? '已启用' : '已禁用'"
                  >
                    {{ label }}
                  </span>
                </template>
                <NSpace vertical>
                  <NSpace
                    v-if="enabledTriggerTypes"
                    align="center"
                    style="padding: 8px 0; margin-bottom: 8px"
                  >
                    <NSwitch
                      :value="enabledTriggerTypes[type]"
                      @update:value="toggleTypeStatus(type)"
                    />
                    <span>{{ enabledTriggerTypes[type] ? '启用' : '禁用' }}所有{{ label }}</span>
                  </NSpace>

                  <NAlert
                    v-if="type === TriggerType.GUARD && webFetcherStore.webfetcherType === 'openlive'"
                    type="warning"
                    title="功能限制提醒"
                    style="margin-bottom: 12px;"
                    :bordered="false"
                  >
                    当前连接模式 (OpenLive) 无法获取用户UID，因此无法执行【发送私信】操作。如需使用私信功能，请考虑切换至直连模式。
                  </NAlert>

                  <NSpace
                    justify="end"
                    style="margin-bottom: 12px;"
                  >
                    <NPopconfirm
                      negative-text="取消"
                      positive-text="确认测试"
                      @positive-click="() => handleTestClick(type as TriggerType)"
                    >
                      <template #trigger>
                        <NButton
                          size="small"
                          type="warning"
                          ghost
                        >
                          测试 {{ label }} 类型
                        </NButton>
                      </template>
                      {{ `确认模拟一个 ${label} 事件来测试所有启用的 ${label} 操作吗？\n注意：这可能会发送真实的消息、执行操作，并可能触发B站风控限制。` }}
                    </NPopconfirm>
                  </NSpace>

                  <div v-if="activeTab === TriggerType.SCHEDULED">
                    <GlobalScheduledSettings />
                    <div
                      v-if="enabledTriggerTypes && enabledTriggerTypes[TriggerType.SCHEDULED] && autoActionStore.globalSchedulingMode === 'sequential' && autoActionStore.nextScheduledAction"
                      class="next-action-display"
                    >
                      <NDivider style="margin: 12px 0 8px 0;" />
                      <NSpace
                        align="center"
                        justify="space-between"
                      >
                        <NText type="success">
                          <NIcon
                            :component="Target24Filled"
                            style="vertical-align: -0.15em; margin-right: 4px;"
                          />
                          下一个执行:
                          <NTag
                            type="info"
                            size="small"
                            round
                          >
                            {{ autoActionStore.nextScheduledAction?.name || '未命名操作' }}
                          </NTag>
                        </NText>
                        <NTooltip trigger="hover">
                          <template #trigger>
                            <NButton
                              text
                              icon-placement="right"
                              size="small"
                              @click="openSetNextModal"
                            >
                              <template #icon>
                                <NIcon :component="Edit16Regular" />
                              </template>
                              手动指定
                            </NButton>
                          </template>
                          手动设置下一个要执行的操作
                        </NTooltip>
                      </NSpace>
                    </div>
                    <NAlert
                      v-else-if="enabledTriggerTypes && !enabledTriggerTypes[TriggerType.SCHEDULED]"
                      type="warning"
                      :bordered="false"
                      style="margin-bottom: 12px;"
                    >
                      定时发送类型已被禁用，所有相关操作不会执行。
                    </NAlert>
                  </div>
                  <NEmpty
                    v-if="groupedActions[type].length === 0"
                    description="暂无自动操作"
                  >
                    <template #extra>
                      <NButton
                        type="primary"
                        @click="() => { selectedTriggerType = type as TriggerType; showAddModal = true; }"
                      >
                        添加{{ typeMap[type as TriggerType] }}
                      </NButton>
                    </template>
                  </NEmpty>

                  <div
                    v-else-if="editingActionId === null"
                    class="overview-container"
                  >
                    <NDataTable
                      :bordered="false"
                      :single-line="false"
                      :columns="getColumnsForType(type as TriggerType)"
                      :data="groupedActions[type]"
                      :row-key="(row: AutoActionItem) => row.id"
                    >
                      <template #empty>
                        <NEmpty description="暂无数据" />
                      </template>
                    </NDataTable>

                    <NButton
                      type="default"
                      style="width: 100%; margin-top: 16px;"
                      class="btn-with-transition"
                      @click="() => { selectedTriggerType = type as TriggerType; showAddModal = true; }"
                    >
                      + 添加{{ typeMap[type as TriggerType] }}
                    </NButton>
                  </div>

                  <div
                    v-else
                    class="edit-container"
                  >
                    <NSpace vertical>
                      <NButton
                        size="small"
                        style="align-self: flex-start; margin-bottom: 8px"
                        class="back-btn btn-with-transition"
                        @click="backToOverview"
                      >
                        ← 返回列表
                      </NButton>

                      <transition-group
                        name="fade-slide"
                        tag="div"
                      >
                        <div
                          v-for="action in groupedActions[type]"
                          v-show="action.id === editingActionId"
                          :key="action.id"
                          class="action-item"
                        >
                          <AutoActionEditor :action="action" />
                        </div>
                      </transition-group>
                    </NSpace>
                  </div>
                </NSpace>
              </NTabPane>
            </NTabs>
          </NTabPane>

          <!-- 新增：签到设置标签页 -->
          <NTabPane
            name="check-in-settings"
            tab="签到设置"
          >
            <CheckInSettings />
          </NTabPane>

          <!-- 历史记录标签页 -->
          <NTabPane
            name="action-history"
            tab="执行历史"
          >
            <ActionHistoryViewer />
          </NTabPane>

          <!-- 数据管理标签页 -->
          <NTabPane
            name="data-manager"
            tab="数据管理"
          >
            <DataManager />
          </NTabPane>

          <!-- 新增：消息队列设置标签页 -->
          <NTabPane
            name="queue-settings"
            tab="消息队列设置"
          >
            <NCard
              title="全局消息队列设置"
              size="small"
            >
              <NSpace
                vertical
                size="large"
              >
                <NSpace align="center">
                  <span>弹幕队列间隔(毫秒):</span>
                  <NInputNumber
                    v-model:value="biliFunc.danmakuInterval"
                    style="width: 120px"
                    @update:value="v => biliFunc.setDanmakuInterval(Number(v))"
                  />
                  <NText
                    depth="3"
                    style="margin-left: 8px;"
                  >
                    每{{ biliFunc.danmakuInterval }}ms 发送一条弹幕
                  </NText>
                </NSpace>
                <NSpace align="center">
                  <span>私信队列间隔(毫秒):</span>
                  <NInputNumber
                    v-model:value="biliFunc.pmInterval"
                    style="width: 120px"
                    @update:value="v => biliFunc.setPmInterval(Number(v))"
                  />
                  <NText
                    depth="3"
                    style="margin-left: 8px;"
                  >
                    每{{ biliFunc.pmInterval }}ms 发送一条私信
                  </NText>
                </NSpace>
              </NSpace>
            </NCard>
          </NTabPane>
        </NTabs>
      </NSpace>
    </NCard>

    <NModal
      v-model:show="showAddModal"
      preset="dialog"
      title="添加新的自动操作"
      positive-text="确认"
      negative-text="取消"
      class="modal-with-transition"
      @positive-click="addAutoAction"
    >
      <NSpace vertical>
        <div>请选择要添加的自动操作类型：</div>
        <NSelect
          v-model:value="selectedTriggerType"
          :options="triggerTypeOptions"
          placeholder="选择触发类型"
          style="width: 100%"
        />
      </NSpace>
    </NModal>

    <NModal
      v-model:show="showSetNextModal"
      preset="dialog"
      title="手动指定下一条 (顺序模式)"
      positive-text="确认指定"
      negative-text="取消"
      @positive-click="confirmSetNextAction"
    >
      <NSpace vertical>
        <div>选择下一个要执行的定时操作：</div>
        <NSelect
          v-model:value="targetNextActionId"
          :options="eligibleGlobalActions"
          placeholder="选择操作"
          filterable
          clearable
          style="width: 100%"
        />
        <NText
          type="info"
          :depth="3"
          style="font-size: 12px;"
        >
          只会列出当前已启用、类型也已启用且使用全局定时器的操作。
          选择后，下一个全局定时周期将执行您指定的操作。
        </NText>
      </NSpace>
    </NModal>

    <NModal
      v-model:show="showTestModal"
      preset="dialog"
      title="测试舰长私信"
      positive-text="确认测试"
      negative-text="取消"
      @positive-click="confirmTest"
    >
      <NSpace vertical>
        <div>请输入私信接收者的UID：</div>
        <NInput
          v-model:value="testUid"
          placeholder="请输入UID"
          type="text"
        />
        <NText
          type="info"
          :depth="3"
          style="font-size: 12px;"
        >
          这是接收私信消息的B站用户UID，测试将向此UID发送私信。请确保该UID有效且您有权限向其发送私信。
        </NText>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.action-item {
  position: relative;
  margin-bottom: 16px;
}

.action-menu-button {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 10;
}

.config-description {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}

code {
  background-color: rgba(0, 0, 0, 0.06);
  padding: 2px 4px;
  border-radius: 4px;
  font-family: monospace;
}

/* 淡入淡出过渡 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 列表动画 */
.list-item {
  transition: all 0.3s ease;
}

.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.list-move {
  transition: transform 0.3s ease;
}

/* 淡入滑动过渡 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* 按钮过渡 */
.btn-with-transition {
  transition: all 0.2s ease;
}

.btn-with-transition:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
}

/* 返回按钮特殊动画 */
.back-btn {
  position: relative;
  overflow: hidden;
}

.back-btn::after {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.back-btn:hover::after {
  left: 100%;
}

/* 容器过渡 */
.overview-container,
.edit-container {
  transition: all 0.4s ease;
  transform-origin: center top;
}

.next-action-display {
  margin-top: 12px;
  padding: 8px 12px;
  background-color: var(--n-color-embedded);
  border-radius: var(--n-border-radius);
  font-size: 13px;
}
</style>
