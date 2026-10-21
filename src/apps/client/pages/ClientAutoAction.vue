<script setup lang="ts">
import {
  AppGeneric24Regular,
  ArrowLeft24Filled,
  Bot24Regular,
  Chat24Regular,
  DataUsage24Regular,
  DoorArrowLeft24Regular,
  Edit16Regular,
  Gift24Regular,
  History24Regular,
  PersonAdd24Regular,
  Settings24Regular,
  Shield24Regular,
  Star24Regular,
  Target24Filled,
  Timer24Regular,
} from '@vicons/fluent'
import type { Component } from 'vue'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import ActionHistoryViewer from '@/apps/client/components/autoaction/ActionHistoryViewer.vue'
import ActionList from '@/apps/client/components/autoaction/ActionList.vue'
import AutoActionEditor from '@/apps/client/components/autoaction/AutoActionEditor.vue'
import DataManager from '@/apps/client/components/autoaction/DataManager.vue'
import CheckInSettings from '@/apps/client/components/autoaction/settings/CheckInSettings.vue'
import GlobalScheduledSettings from '@/apps/client/components/autoaction/settings/GlobalScheduledSettings.vue'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import BiliAccountManagerCard from '@/apps/client/components/settings/BiliAccountManagerCard.vue'
import { TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliAccountManager } from '@/apps/client/store/useBiliAccountManager'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useWebFetcher } from '@/store/useWebFetcher'

const autoActionStore = useAutoAction()
const accountStore = useAccount()
const biliCookieStore = useBiliCookie()
const accountManager = useBiliAccountManager()
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

interface MenuItem {
  label: string
  key: string
  icon: Component
}

interface MenuGroup {
  label: string
  key: string
  children: MenuItem[]
}

const menuGroups: MenuGroup[] = [
  {
    label: '自动操作',
    key: 'group-actions',
    children: [
      { label: '自动回复', key: TriggerType.DANMAKU, icon: Chat24Regular },
      { label: '礼物感谢', key: TriggerType.GIFT, icon: Gift24Regular },
      { label: '上舰感谢', key: TriggerType.GUARD, icon: Shield24Regular },
      { label: '关注感谢', key: TriggerType.FOLLOW, icon: PersonAdd24Regular },
      { label: '入场欢迎', key: TriggerType.ENTER, icon: DoorArrowLeft24Regular },
      { label: '定时发送', key: TriggerType.SCHEDULED, icon: Timer24Regular },
      { label: 'SC感谢', key: TriggerType.SUPER_CHAT, icon: Star24Regular },
    ],
  },
  {
    label: '功能设置',
    key: 'group-settings',
    children: [
      { label: '发弹幕账号 (多账号管理)', key: 'account-settings', icon: Bot24Regular },
      { label: '签到设置', key: 'check-in-settings', icon: AppGeneric24Regular },
      { label: '消息队列', key: 'queue-settings', icon: Settings24Regular },
    ],
  },
  {
    label: '数据与记录',
    key: 'group-data',
    children: [
      { label: '执行历史', key: 'action-history', icon: History24Regular },
      { label: '数据管理', key: 'data-manager', icon: DataUsage24Regular },
    ],
  },
]

function getMenuItemStatus(key: string) {
  const isTriggerType = Object.values(TriggerType).includes(key as TriggerType)
  const isCheckIn = key === 'check-in-settings'

  if (!isTriggerType && !isCheckIn) return { isEnabled: false, count: 0, isTriggerType: false }

  let isEnabled = false
  let count = 0

  if (isTriggerType) {
    const type = key as TriggerType
    isEnabled = autoActionStore.enabledTriggerTypes?.[type] ?? false
    count = autoActionStore.autoActions.filter((a) => a.triggerType === type && a.enabled).length
  } else if (isCheckIn) {
    isEnabled = accountStore.value?.settings?.point?.enableCheckIn ?? false
    count = isEnabled ? 1 : 0
  }

  return { isEnabled, count, isTriggerType }
}

const typeMap: Record<string, string> = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '上舰感谢',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC感谢',
}

const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

const eligibleGlobalActions = computed(() => {
  if (!enabledTriggerTypes.value) return []
  return autoActionStore.autoActions
    .filter(
      (action) =>
        action.triggerType === TriggerType.SCHEDULED &&
        enabledTriggerTypes.value[TriggerType.SCHEDULED] &&
        action.enabled &&
        action.triggerConfig.useGlobalTimer &&
        (!action.triggerConfig.onlyDuringLive || autoActionStore.isLive) &&
        (!action.triggerConfig.ignoreTianXuan || !autoActionStore.isTianXuanActive),
    )
    .map((action) => ({
      label: action.name || '未命名操作',
      value: action.id,
    }))
})

const currentEditingAction = computed(() => {
  if (!editingActionId.value) return null
  return autoActionStore.autoActions.find((a) => a.id === editingActionId.value)
})

const activeRulesCount = computed(() => autoActionStore.autoActions.filter((a) => a.enabled).length)

function handleMenuUpdate(key: string) {
  currentMenuKey.value = key
  editingActionId.value = null
}

function handleAddAction() {
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
  toast.success('已添加新的自动操作')
}

function handleEdit(id: string) {
  editingActionId.value = id
}

function backToOverview() {
  editingActionId.value = null
}

function handleTestClick(type: TriggerType) {
  const requiresLogin = [TriggerType.DANMAKU, TriggerType.GUARD, TriggerType.SUPER_CHAT].includes(type)
  if (requiresLogin && !biliCookieStore.isCookieValid) {
    toast.error('此测试需要登录B站账号，请先前往设置页面登录')
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
      toast.error('无法发送私信测试，请先登录B站账号')
      showTestModal.value = false
      return
    }
    const uid = Number(testUid.value)
    if (!Number.isFinite(uid) || uid <= 0) {
      toast.error('请输入有效的UID')
      return
    }
    autoActionStore.triggerTestActionByType(currentTestType.value, uid)
  }
  showTestModal.value = false
}

function openSetNextModal() {
  targetNextActionId.value = autoActionStore.nextScheduledAction?.id ?? null
  showSetNextModal.value = true
}

function confirmSetNextAction() {
  if (targetNextActionId.value) {
    autoActionStore.setNextGlobalAction(targetNextActionId.value)
    toast.success('已指定下一条执行的操作')
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
  <div class="auto-action-page flex flex-col gap-3.5">
    <!-- 标准管理页标头 -->
    <ClientPageHeader
      title="自动操作"
      description="管理自动回复、礼物感谢、入场欢迎、定时发送等自动化规则"
    >
      <template #actions>
        <div class="flex items-center gap-2.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  variant="outline"
                  class="cursor-pointer text-xs h-6 px-2 gap-1.5"
                  :class="biliFunc.activeDanmakuAccountType === 'bot' ? 'border-sky-500/40 text-sky-600 bg-sky-500/10' : ''"
                  @click="currentMenuKey = 'account-settings'"
                >
                  <component
                    :is="biliFunc.activeDanmakuAccountType === 'bot' ? Bot24Regular : PersonAdd24Regular"
                    class="size-3.5"
                  />
                  <span>
                    {{
                      `发弹幕: ${accountManager.danmakuAccount?.name || '未设置'}${
                        accountManager.danmakuAccount?.alias ? ` (${accountManager.danmakuAccount?.alias})` : ''
                      }`
                    }}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent class="text-xs">
                点击管理 B 站账号池，自由选择发弹幕账号（支持添加多个账号随时切换）
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Badge
            variant="secondary"
            class="text-xs h-6 px-2"
            :class="activeRulesCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''"
          >
            {{ `${activeRulesCount} 条规则已启用` }}
          </Badge>
        </div>
      </template>
    </ClientPageHeader>

    <Alert
      v-if="!biliCookieStore.isCookieValid"
      class="py-2.5 px-3 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
    >
      <AlertTitle class="text-xs font-semibold">B站账号凭据未就绪</AlertTitle>
      <AlertDescription class="text-xs mt-0.5">
        部分需要发送弹幕或私信的操作（如自动回复、上舰感谢）将无法执行。请前往【设置】完成登录。
      </AlertDescription>
    </Alert>

    <!-- 双栏工作台卡片 -->
    <Card class="border bg-card auto-action-workbench overflow-hidden">
      <div class="flex min-h-[560px]">
        <!-- 左侧二级菜单 -->
        <div class="w-52 border-r bg-muted/10 p-2.5 flex flex-col gap-4 shrink-0">
          <div
            v-for="group in menuGroups"
            :key="group.key"
            class="space-y-1"
          >
            <span class="text-[11px] font-semibold text-muted-foreground px-2 tracking-wider">
              {{ group.label }}
            </span>
            <div class="space-y-0.5">
              <button
                v-for="item in group.children"
                :key="item.key"
                type="button"
                class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors text-left"
                :class="currentMenuKey === item.key ? 'bg-primary text-primary-foreground font-medium shadow-sm' : 'text-foreground hover:bg-muted'"
                @click="handleMenuUpdate(item.key)"
              >
                <div class="flex items-center gap-2 truncate">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span class="truncate">{{ item.label }}</span>
                </div>

                <div
                  v-if="getMenuItemStatus(item.key).isTriggerType || item.key === 'check-in-settings'"
                  class="flex items-center gap-1.5 shrink-0 pl-1"
                >
                  <span
                    v-if="getMenuItemStatus(item.key).count > 0 && getMenuItemStatus(item.key).isTriggerType"
                    class="text-[10px] px-1 rounded font-semibold"
                    :class="currentMenuKey === item.key ? 'bg-primary-foreground text-primary' : 'bg-muted text-muted-foreground'"
                  >
                    {{ getMenuItemStatus(item.key).count }}
                  </span>
                  <div
                    class="size-1.5 rounded-full"
                    :class="getMenuItemStatus(item.key).isEnabled ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-muted-foreground/40'"
                  />
                </div>
              </button>
            </div>
          </div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="flex-1 p-4 overflow-y-auto max-h-[780px]">
          <!-- 编辑模式 -->
          <div
            v-if="editingActionId && currentEditingAction"
            class="space-y-3.5 max-w-4xl mx-auto"
          >
            <div class="flex items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                class="h-8 text-xs gap-1.5"
                @click="backToOverview"
              >
                <ArrowLeft24Filled class="size-3.5" />
                返回列表
              </Button>
              <span class="font-semibold text-sm text-foreground">
                编辑 {{ currentEditingAction.name }}
              </span>
            </div>

            <AutoActionEditor :action="currentEditingAction" />
          </div>

          <!-- 列表模式 / 功能页面 -->
          <div
            v-else
            class="h-full"
          >
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
                <div
                  v-if="currentMenuKey === TriggerType.SCHEDULED"
                  class="mb-3.5 space-y-2.5"
                >
                  <GlobalScheduledSettings />
                  <div
                    v-if="
                      enabledTriggerTypes &&
                      enabledTriggerTypes[TriggerType.SCHEDULED] &&
                      autoActionStore.globalSchedulingMode === 'sequential' &&
                      autoActionStore.nextScheduledAction
                    "
                    class="next-action-display flex items-center justify-between p-2.5 rounded-md border border-l-4 border-l-primary bg-card"
                  >
                    <div class="flex items-center gap-2 text-xs text-foreground">
                      <Target24Filled class="size-4 text-primary" />
                      <span>下一个执行:</span>
                      <Badge
                        variant="secondary"
                        class="text-xs h-5 px-1.5"
                      >
                        {{ autoActionStore.nextScheduledAction?.name || '未命名操作' }}
                      </Badge>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 text-xs gap-1 text-primary hover:text-primary"
                      @click="openSetNextModal"
                    >
                      <Edit16Regular class="size-3" />
                      手动指定
                    </Button>
                  </div>
                </div>

                <!-- 舰长专属提示 -->
                <Alert
                  v-if="currentMenuKey === TriggerType.GUARD && webFetcherStore.webfetcherType === 'openlive'"
                  class="py-2.5 px-3 mb-3 border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                >
                  <AlertTitle class="text-xs font-semibold">功能限制提醒</AlertTitle>
                  <AlertDescription class="text-xs mt-0.5">
                    当前连接模式 (OpenLive) 无法获取用户 UID，因此无法执行【发送私信】操作。如需使用私信功能，请切换至直连模式。
                  </AlertDescription>
                </Alert>
              </template>
            </ActionList>

            <!-- 多账号管理设置 -->
            <BiliAccountManagerCard v-else-if="currentMenuKey === 'account-settings'" />

            <!-- 签到设置 -->
            <CheckInSettings v-else-if="currentMenuKey === 'check-in-settings'" />

            <!-- 消息队列设置 -->
            <div
              v-else-if="currentMenuKey === 'queue-settings'"
              class="space-y-4"
            >
              <Card class="border bg-card">
                <CardHeader class="p-3 pb-2 border-b">
                  <CardTitle class="text-sm font-semibold">全局消息队列频率</CardTitle>
                </CardHeader>
                <CardContent class="p-3 space-y-3">
                  <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
                    <div>
                      <span class="text-xs font-medium text-foreground block">弹幕队列最小间隔</span>
                      <span class="text-[11px] text-muted-foreground block mt-0.5">
                        两条弹幕之间的最小发送间隔，过短可能导致被B站吞弹幕。建议 1000ms 以上。
                      </span>
                    </div>
                    <NInputNumber
                      :value="biliFunc.danmakuInterval"
                      :min="100"
                      :step="100"
                      size="small"
                      class="w-32"
                      @update:value="biliFunc.setDanmakuInterval($event || 1000)"
                    />
                  </div>

                  <div class="flex items-center justify-between p-2.5 rounded border bg-muted/20">
                    <div>
                      <span class="text-xs font-medium text-foreground block">私信队列最小间隔</span>
                      <span class="text-[11px] text-muted-foreground block mt-0.5">
                        私信发送频率限制，建议保持默认 1000ms 或更高以避免触发 B 站频控。
                      </span>
                    </div>
                    <NInputNumber
                      :value="biliFunc.pmInterval"
                      :min="1000"
                      :step="500"
                      size="small"
                      class="w-32"
                      @update:value="biliFunc.setPmInterval($event || 1000)"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <!-- 执行历史 -->
            <ActionHistoryViewer v-else-if="currentMenuKey === 'action-history'" />

            <!-- 数据管理 -->
            <DataManager v-else-if="currentMenuKey === 'data-manager'" />
          </div>
        </div>
      </div>
    </Card>

    <!-- 弹窗部分 -->
    <!-- 添加新自动操作 -->
    <Dialog v-model:open="showAddModal">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">添加新的自动操作</DialogTitle>
        </DialogHeader>
        <div class="space-y-3 pt-2">
          <span class="text-xs text-muted-foreground block">请选择要添加的自动操作类型：</span>
          <Select v-model="selectedTriggerType">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in triggerTypeOptions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter class="pt-3">
          <Button
            size="sm"
            variant="secondary"
            class="h-8 text-xs"
            @click="showAddModal = false"
          >
            取消
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs"
            @click="addAutoAction"
          >
            确认
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 手动指定下一条 (顺序模式) -->
    <Dialog v-model:open="showSetNextModal">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">手动指定下一条 (顺序模式)</DialogTitle>
        </DialogHeader>
        <div class="space-y-2 pt-2">
          <Select v-model="targetNextActionId">
            <SelectTrigger class="h-8 text-xs w-full">
              <SelectValue placeholder="选择操作" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in eligibleGlobalActions"
                :key="opt.value"
                :value="opt.value"
                class="text-xs"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <span class="text-[11px] text-muted-foreground block">
            只会列出当前已启用、类型也已启用且使用全局定时器的操作。
          </span>
        </div>
        <DialogFooter class="pt-3">
          <Button
            size="sm"
            variant="secondary"
            class="h-8 text-xs"
            @click="showSetNextModal = false"
          >
            取消
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs"
            @click="confirmSetNextAction"
          >
            确认指定
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 测试舰长私信 -->
    <Dialog v-model:open="showTestModal">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">测试舰长私信</DialogTitle>
        </DialogHeader>
        <div class="space-y-2 pt-2">
          <span class="text-xs text-muted-foreground block">请输入私信接收者的UID：</span>
          <BiliUserSelector
            v-model:value="testUid"
            placeholder="请输入B站用户UID"
          />
        </div>
        <DialogFooter class="pt-3">
          <Button
            size="sm"
            variant="secondary"
            class="h-8 text-xs"
            @click="showTestModal = false"
          >
            取消
          </Button>
          <Button
            size="sm"
            class="h-8 text-xs"
            @click="confirmTest"
          >
            确认测试
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
