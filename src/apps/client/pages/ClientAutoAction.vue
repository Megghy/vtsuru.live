<script setup lang="ts">
import type { Component } from 'vue'
import {
  AppGeneric24Regular,
  Chat24Regular,
  Clock24Regular,
  DataUsage24Regular,
  Gift24Regular,
  History24Regular,
  PersonAdd24Regular,
  Shield24Regular,
  DoorArrowLeft24Regular,
  Star24Regular,
  Timer24Regular,
  Settings24Regular,
  Target24Filled,
  Edit16Regular
} from '@vicons/fluent'
import { useAccount } from '@/api/account'
import {
  NAlert, NBadge, NButton, NCard, NDivider, NFlex, NIcon, NInputNumber, NLayout, NLayoutContent,
  NLayoutSider, NMenu, NModal, NSelect, NTag, NText, useMessage
} from 'naive-ui'
import { computed, h, ref } from 'vue'
import { TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import { useWebFetcher } from '@/store/useWebFetcher'

import ActionList from '@/apps/client/components/autoaction/ActionList.vue'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import ActionHistoryViewer from '@/apps/client/components/autoaction/ActionHistoryViewer.vue'
import AutoActionEditor from '@/apps/client/components/autoaction/AutoActionEditor.vue'
import DataManager from '@/apps/client/components/autoaction/DataManager.vue'
import CheckInSettings from '@/apps/client/components/autoaction/settings/CheckInSettings.vue'
import GlobalScheduledSettings from '@/apps/client/components/autoaction/settings/GlobalScheduledSettings.vue'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'

const autoActionStore = useAutoAction()
const accountStore = useAccount()
const message = useMessage()
const biliCookieStore = useBiliCookie()
const webFetcherStore = useWebFetcher()
const biliFunc = useBiliFunction()

// 状态管理
const currentMenuKey = ref<string>(TriggerType.GIFT) // 默认选中礼物感谢
const editingActionId = ref<string | null>(null)
const showAddModal = ref(false)
const selectedTriggerType = ref<TriggerType>(TriggerType.GIFT)

// 模态框状态
const showSetNextModal = ref(false)
const targetNextActionId = ref<string | null>(null)
const showTestModal = ref(false)
const testUid = ref<number | undefined>(10004)
const currentTestType = ref<TriggerType | null>(null)

// 菜单配置
function renderIcon(icon: Component) {
  return () => h(NIcon, null, { default: () => h(icon) })
}

function renderMenuLabel(label: string, key: string) {
  const isTriggerType = Object.values(TriggerType).includes(key as TriggerType)
  const isCheckIn = key === 'check-in-settings'
  
  if (!isTriggerType && !isCheckIn) return () => h('span', null, { default: () => label })

  let isEnabled = false
  let count = 0

  if (isTriggerType) {
    const type = key as TriggerType
    isEnabled = autoActionStore.enabledTriggerTypes?.[type] ?? false
    count = autoActionStore.autoActions.filter(a => a.triggerType === type && a.enabled).length
  } else if (isCheckIn) {
    isEnabled = accountStore.value?.settings?.point?.enableCheckIn ?? false
    // 签到只有开关状态，没有多个子条目概念，或者可以看做 1
    count = isEnabled ? 1 : 0
  }

  return () => h(NFlex, { 
    align: 'center', 
    justify: 'space-between', 
    style: 'width: 100%; padding-right: 4px;',
    wrap: false
  }, {
    default: () => [
      h('span', { style: 'overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, { default: () => label }),
      h(NFlex, { align: 'center', size: 4, wrap: false, style: 'flex-shrink: 0;' }, {
        default: () => [
          count > 0 && isTriggerType ? h(NBadge, { 
            value: count, 
            type: isEnabled ? 'success' : 'default',
            showZero: false,
            style: 'transform: scale(0.85);'
          }) : null,
          h('div', { 
            class: ['status-dot', isEnabled ? 'status-dot--active' : 'status-dot--inactive']
          })
        ]
      })
    ]
  })
}

const menuOptions = computed(() => [
  {
    label: '自动操作',
    key: 'group-actions',
    type: 'group',
    children: [
      { label: renderMenuLabel('自动回复', TriggerType.DANMAKU), key: TriggerType.DANMAKU, icon: renderIcon(Chat24Regular) },
      { label: renderMenuLabel('礼物感谢', TriggerType.GIFT), key: TriggerType.GIFT, icon: renderIcon(Gift24Regular) },
      { label: renderMenuLabel('上舰感谢', TriggerType.GUARD), key: TriggerType.GUARD, icon: renderIcon(Shield24Regular) },
      { label: renderMenuLabel('关注感谢', TriggerType.FOLLOW), key: TriggerType.FOLLOW, icon: renderIcon(PersonAdd24Regular) },
      { label: renderMenuLabel('入场欢迎', TriggerType.ENTER), key: TriggerType.ENTER, icon: renderIcon(DoorArrowLeft24Regular) },
      { label: renderMenuLabel('定时发送', TriggerType.SCHEDULED), key: TriggerType.SCHEDULED, icon: renderIcon(Timer24Regular) },
      { label: renderMenuLabel('SC感谢', TriggerType.SUPER_CHAT), key: TriggerType.SUPER_CHAT, icon: renderIcon(Star24Regular) },
    ]
  },
  {
    label: '功能设置',
    key: 'group-settings',
    type: 'group',
    children: [
      { label: renderMenuLabel('签到设置', 'check-in-settings'), key: 'check-in-settings', icon: renderIcon(AppGeneric24Regular) },
      { label: renderMenuLabel('消息队列', 'queue-settings'), key: 'queue-settings', icon: renderIcon(Settings24Regular) },
    ]
  },
  {
    label: '数据与记录',
    key: 'group-data',
    type: 'group',
    children: [
      { label: renderMenuLabel('执行历史', 'action-history'), key: 'action-history', icon: renderIcon(History24Regular) },
      { label: renderMenuLabel('数据管理', 'data-manager'), key: 'data-manager', icon: renderIcon(DataUsage24Regular) },
    ]
  }
])

// 标题映射
const typeMap: Record<string, string> = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '上舰感谢',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC感谢',
}

// 计算属性
const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

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

const currentEditingAction = computed(() => {
  if (!editingActionId.value) return null
  return autoActionStore.autoActions.find(a => a.id === editingActionId.value)
})

// 方法
function handleMenuUpdate(key: string) {
  currentMenuKey.value = key
  editingActionId.value = null // 切换菜单时退出编辑模式
}

function handleAddAction() {
  // 如果当前在某个具体的触发类型页面，直接添加该类型
  if (Object.values(TriggerType).includes(currentMenuKey.value as TriggerType)) {
    selectedTriggerType.value = currentMenuKey.value as TriggerType
    addAutoAction()
  } else {
    showAddModal.value = true
  }
}

function addAutoAction() {
  const newAction = autoActionStore.addAutoAction(selectedTriggerType.value)
  showAddModal.value = false
  currentMenuKey.value = selectedTriggerType.value
  editingActionId.value = newAction.id
  message.success('已添加新的自动操作')
}

function handleEdit(id: string) {
  editingActionId.value = id
}

function backToOverview() {
  editingActionId.value = null
}

// 测试相关逻辑
function handleTestClick(type: TriggerType) {
  const requiresLogin = [TriggerType.DANMAKU, TriggerType.GUARD, TriggerType.SUPER_CHAT].includes(type)
  if (requiresLogin && !biliCookieStore.isCookieValid) {
    message.error('此测试需要登录B站账号，请先前往设置页面登录')
    return
  }

  if (type === TriggerType.GUARD) {
    currentTestType.value = type
    testUid.value = 10004
    showTestModal.value = true
  } else {
    autoActionStore.triggerTestActionByType(type)
  }
}

function confirmTest() {
  if (currentTestType.value === TriggerType.GUARD) {
    if (!biliCookieStore.isCookieValid) {
      message.error('无法发送私信测试，请先登录B站账号')
      showTestModal.value = false
      return
    }
    const uid = Number(testUid.value)
    if (!Number.isFinite(uid) || uid <= 0) {
      message.error('请输入有效的UID')
      return
    }
    autoActionStore.triggerTestActionByType(currentTestType.value, uid)
  }
  showTestModal.value = false
}

// 定时任务相关逻辑
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

const triggerTypeOptions = [
  { label: '自动回复', value: TriggerType.DANMAKU },
  { label: '礼物感谢', value: TriggerType.GIFT },
  { label: '上舰感谢', value: TriggerType.GUARD },
  { label: '关注感谢', value: TriggerType.FOLLOW },
  { label: '入场欢迎', value: TriggerType.ENTER },
  { label: '定时发送', value: TriggerType.SCHEDULED },
  { label: 'SC感谢', value: TriggerType.SUPER_CHAT },
]
</script>

<template>
  <NFlex vertical :size="0" class="full-height">
    <!-- Header Area -->
    <div class="header-container">
      <ClientPageHeader
        title="自动操作"
        description="管理自动回复、礼物感谢、入场欢迎、定时发送等规则"
      />
      <NAlert
        v-if="!biliCookieStore.isCookieValid"
        type="warning"
        title="未登录B站账号"
        size="small"
        closable
        style="margin-top: 12px"
      >
        部分需要发送弹幕或私信的自动操作（如自动回复、上舰感谢）将无法执行。请前往【设置】- 【账号设置】页面登录。
      </NAlert>
    </div>

    <!-- Main Content Area -->
    <div class="content-container">
      <NLayout has-sider class="inner-layout">
        <NLayoutSider
          bordered
          width="200"
          content-style="padding: 12px 0;"
          :native-scrollbar="false"
        >
          <NMenu
            :value="currentMenuKey"
            :options="menuOptions"
            :indent="24"
            @update:value="handleMenuUpdate"
          />
        </NLayoutSider>
        
        <NLayoutContent content-style="padding: 24px; height: 100%;">
          <NScrollbar class="main-scrollbar">
            <transition name="fade-slide" mode="out-in">
              <!-- 编辑模式 -->
              <div v-if="editingActionId && currentEditingAction" :key="`edit-${editingActionId}`" class="edit-mode-container">
                <NFlex vertical :size="16">
                  <NFlex align="center">
                    <NButton secondary size="small" @click="backToOverview">
                      <template #icon>
                        <NIcon :component="Clock24Regular" style="transform: rotate(90deg)" />
                      </template>
                      返回列表
                    </NButton>
                    <NText strong style="font-size: 16px;">
                      编辑 {{ currentEditingAction.name }}
                    </NText>
                  </NFlex>
                  <div class="editor-wrapper">
                    <AutoActionEditor :action="currentEditingAction" />
                  </div>
                </NFlex>
              </div>

              <!-- 列表模式 / 其他功能页面 -->
              <div v-else :key="`view-${currentMenuKey}`" class="view-mode-container">
                <!-- 自动操作列表 -->
                <ActionList
                  v-if="Object.values(TriggerType).includes(currentMenuKey as TriggerType)"
                  :trigger-type="currentMenuKey as TriggerType"
                  :title="typeMap[currentMenuKey]"
                  @edit="handleEdit"
                  @add="handleAddAction"
                  @test="() => handleTestClick(currentMenuKey as TriggerType)"
                >
                  <template #header-content>
                    <!-- 定时发送专属设置 -->
                    <div v-if="currentMenuKey === TriggerType.SCHEDULED" style="margin-bottom: 20px;">
                      <GlobalScheduledSettings />
                      <div
                        v-if="enabledTriggerTypes && enabledTriggerTypes[TriggerType.SCHEDULED] && autoActionStore.globalSchedulingMode === 'sequential' && autoActionStore.nextScheduledAction"
                        class="next-action-display"
                      >
                        <NFlex align="center" justify="space-between">
                          <NText type="success">
                            <NIcon :component="Target24Filled" style="vertical-align: -0.15em; margin-right: 4px;" />
                            下一个执行:
                            <NTag type="info" size="small" round>
                              {{ autoActionStore.nextScheduledAction?.name || '未命名操作' }}
                            </NTag>
                          </NText>
                          <NButton text icon-placement="right" size="small" @click="openSetNextModal">
                            <template #icon>
                              <NIcon :component="Edit16Regular" />
                            </template>
                            手动指定
                          </NButton>
                        </NFlex>
                      </div>
                    </div>

                    <!-- 舰长专属提示 -->
                    <NAlert
                      v-if="currentMenuKey === TriggerType.GUARD && webFetcherStore.webfetcherType === 'openlive'"
                      type="warning"
                      title="功能限制提醒"
                      style="margin-bottom: 12px;"
                      :bordered="false"
                    >
                      当前连接模式 (OpenLive) 无法获取用户UID，因此无法执行【发送私信】操作。如需使用私信功能，请考虑切换至直连模式。
                    </NAlert>
                  </template>
                </ActionList>

                <!-- 签到设置 -->
                <CheckInSettings v-else-if="currentMenuKey === 'check-in-settings'" />

                <!-- 消息队列设置 -->
                <div v-else-if="currentMenuKey === 'queue-settings'">
                  <NCard title="全局消息队列设置" size="small" bordered>
                    <NFlex vertical :size="24">
                      <div class="setting-item">
                        <div class="label">
                          弹幕队列间隔
                        </div>
                        <div class="control">
                          <NInputNumber v-model:value="biliFunc.danmakuInterval" :min="100" :step="100" style="width: 150px">
                            <template #suffix>
                              ms
                            </template>
                          </NInputNumber>
                          <div class="desc">
                            两条弹幕之间的最小发送间隔，过短可能导致被B站吞弹幕。建议 1000ms 以上。
                          </div>
                        </div>
                      </div>
                      <NDivider style="margin: 0" />
                      <div class="setting-item">
                        <div class="label">
                          私信队列间隔
                        </div>
                        <div class="control">
                          <NInputNumber v-model:value="biliFunc.pmInterval" :min="1000" :step="500" style="width: 150px">
                            <template #suffix>
                              ms
                            </template>
                          </NInputNumber>
                          <div class="desc">
                            私信发送频率限制，建议保持默认或更高以避免封控。
                          </div>
                        </div>
                      </div>
                    </NFlex>
                  </NCard>
                </div>

                <!-- 执行历史 -->
                <ActionHistoryViewer v-else-if="currentMenuKey === 'action-history'" />

                <!-- 数据管理 -->
                <DataManager v-else-if="currentMenuKey === 'data-manager'" />
              </div>
            </transition>
          </NScrollbar>
        </NLayoutContent>
      </NLayout>
    </div>

    <!-- Modals -->
    <NModal
      v-model:show="showAddModal"
      preset="dialog"
      title="添加新的自动操作"
      positive-text="确认"
      negative-text="取消"
      @positive-click="addAutoAction"
    >
      <NFlex vertical>
        <div>请选择要添加的自动操作类型：</div>
        <NSelect v-model:value="selectedTriggerType" :options="triggerTypeOptions" />
      </NFlex>
    </NModal>

    <NModal
      v-model:show="showSetNextModal"
      preset="dialog"
      title="手动指定下一条 (顺序模式)"
      positive-text="确认指定"
      negative-text="取消"
      @positive-click="confirmSetNextAction"
    >
      <NFlex vertical>
        <NSelect
          v-model:value="targetNextActionId"
          :options="eligibleGlobalActions"
          placeholder="选择操作"
          filterable
          clearable
        />
        <NText type="info" :depth="3" style="font-size: 12px;">
          只会列出当前已启用、类型也已启用且使用全局定时器的操作。
        </NText>
      </NFlex>
    </NModal>

    <NModal
      v-model:show="showTestModal"
      preset="dialog"
      title="测试舰长私信"
      positive-text="确认测试"
      negative-text="取消"
      @positive-click="confirmTest"
    >
      <NFlex vertical>
        <div>请输入私信接收者的UID：</div>
        <BiliUserSelector v-model:value="testUid" placeholder="请输入B站用户UID" />
      </NFlex>
    </NModal>
  </NFlex>
</template>

<style scoped>
.full-height {
  height: calc(100vh - 64px); /* Adjust based on your layout header height */
  overflow: hidden;
}

.header-container {
  padding: 16px 24px 0;
  flex-shrink: 0;
}

.content-container {
  flex: 1;
  overflow: hidden;
  margin-top: 16px;
  border-top: 1px solid var(--n-divider-color);
}

.inner-layout {
  height: 100%;
  background: transparent;
}

.view-mode-container, .edit-mode-container {
  height: 100%;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  transition: background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.status-dot--active {
  background-color: var(--n-success-color);
  box-shadow: 0 0 4px var(--n-success-color);
}

.status-dot--inactive {
  background-color: var(--n-error-color);
  opacity: 0.6;
}

:deep(.n-menu-item-content) {
  padding-right: 8px !important;
}

.next-action-display {
  margin-top: 12px;
  padding: 8px 12px;
  background-color: var(--n-color-embedded);
  border-radius: var(--n-border-radius);
  font-size: 13px;
  border-left: 3px solid var(--n-primary-color);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item .label {
  font-weight: 500;
  font-size: 14px;
}

.setting-item .desc {
  font-size: 12px;
  color: var(--n-text-color-3);
  margin-top: 4px;
}

/* Transition Animations */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease-out;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>
