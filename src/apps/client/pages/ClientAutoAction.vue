<script setup lang="ts">
import {
  ArrowLeft,
  Bot,
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  Gift,
  History,
  KeyRound,
  LayoutGrid,
  LogIn,
  MessageSquare,
  Mic,
  Music2,
  Pencil,
  PieChart,
  Plus,
  Radio,
  Receipt,
  RotateCcw,
  Settings,
  Shield,
  SquarePower,
  Star,
  Target,
  Timer,
  Trash2,
  Unplug,
  UserPlus,
  Users,
  UserCheck,
} from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import ActionHistoryViewer from '@/apps/client/components/autoaction/ActionHistoryViewer.vue'
import ActionList from '@/apps/client/components/autoaction/ActionList.vue'
import AutoActionEditor from '@/apps/client/components/autoaction/AutoActionEditor.vue'
import DataManager from '@/apps/client/components/autoaction/DataManager.vue'
import RuleTestDialog from '@/apps/client/components/autoaction/RuleTestDialog.vue'
import CheckInSettings from '@/apps/client/components/autoaction/settings/CheckInSettings.vue'
import GlobalScheduledSettings from '@/apps/client/components/autoaction/settings/GlobalScheduledSettings.vue'
import ClientPageHeader from '@/apps/client/components/ClientPageHeader.vue'
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliAccountManager } from '@/apps/client/store/useBiliAccountManager'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useBiliFunction } from '@/apps/client/store/useBiliFunction'
import BiliUserSelector from '@/components/common/BiliUserSelector.vue'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { FormField } from '@/shared/ui/form-field'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { useWebFetcher } from '@/store/useWebFetcher'

const autoActionStore = useAutoAction()
const accountStore = useAccount()
const biliCookieStore = useBiliCookie()
const accountManager = useBiliAccountManager()
const webFetcherStore = useWebFetcher()
const biliFunc = useBiliFunction()
const route = useRoute()
const router = useRouter()

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
      { label: '自动回复', key: TriggerType.DANMAKU, icon: MessageSquare },
      { label: '礼物感谢', key: TriggerType.GIFT, icon: Gift },
      { label: '上舰感谢', key: TriggerType.GUARD, icon: Shield },
      { label: '关注感谢', key: TriggerType.FOLLOW, icon: UserPlus },
      { label: '入场欢迎', key: TriggerType.ENTER, icon: LogIn },
      { label: '定时发送', key: TriggerType.SCHEDULED, icon: Timer },
      { label: 'SC感谢', key: TriggerType.SUPER_CHAT, icon: Star },
      { label: '积分兑换', key: TriggerType.POINT_REDEEM, icon: Receipt },
      { label: '收到点歌', key: TriggerType.SONG_REQUEST, icon: Music2 },
      { label: '开始演唱', key: TriggerType.SONG_START, icon: Mic },
      { label: '观众入队', key: TriggerType.QUEUE_JOIN, icon: UserCheck },
      { label: '新一队上车', key: TriggerType.QUEUE_NEXT_BATCH, icon: Users },
    ],
  },
  {
    label: '状态与告警',
    key: 'group-lifecycle',
    children: [
      { label: '开播触发', key: TriggerType.LIVE_START, icon: Radio },
      { label: '下播触发', key: TriggerType.LIVE_END, icon: SquarePower },
      { label: '弹幕断连', key: TriggerType.DANMAKU_DISCONNECTED, icon: Unplug },
      { label: 'Cookie 失效', key: TriggerType.COOKIE_INVALID, icon: KeyRound },
    ],
  },
  {
    label: '功能设置',
    key: 'group-settings',
    children: [
      { label: '发送账号路由', key: 'account-settings', icon: Bot },
      { label: '签到设置', key: 'check-in-settings', icon: LayoutGrid },
      { label: '消息队列', key: 'queue-settings', icon: Settings },
    ],
  },
  {
    label: '数据与记录',
    key: 'group-data',
    children: [
      { label: '执行历史', key: 'action-history', icon: History },
      { label: '数据管理', key: 'data-manager', icon: PieChart },
    ],
  },
]

const validMenuKeys = new Set(menuGroups.flatMap((g) => g.children.map((c) => c.key)))

// 状态管理（与 URL query 双向同步）
const initialTab =
  typeof route.query.tab === 'string' && validMenuKeys.has(route.query.tab) ? route.query.tab : TriggerType.GIFT
const currentMenuKey = ref<string>(initialTab)
const editingActionId = ref<string | null>(typeof route.query.edit === 'string' ? route.query.edit : null)

watch(
  () => [route.query.tab, route.query.edit],
  ([tab, edit]) => {
    if (route.name !== 'client-auto-action-manage') return
    if (typeof tab === 'string' && validMenuKeys.has(tab) && currentMenuKey.value !== tab) {
      currentMenuKey.value = tab
    }
    const nextEdit = typeof edit === 'string' ? edit : null
    if (editingActionId.value !== nextEdit) {
      editingActionId.value = nextEdit
    }
  },
)

watch(
  [currentMenuKey, editingActionId],
  ([tab, edit]) => {
    if (route.name !== 'client-auto-action-manage') return
    const nextQuery: Record<string, string> = { tab }
    if (edit) nextQuery.edit = edit
    if (route.query.tab !== nextQuery.tab || (route.query.edit ?? undefined) !== nextQuery.edit) {
      void router.replace({ query: nextQuery })
    }
  },
  { flush: 'post' },
)

// 编辑态打开快照（用于“还原本次修改”）
const editingSnapshot = ref<string | null>(null)

const currentEditingAction = computed(() => {
  if (!editingActionId.value) return null
  return autoActionStore.autoActions.find((a) => a.id === editingActionId.value) ?? null
})

watch(
  editingActionId,
  (id) => {
    if (!id) {
      editingSnapshot.value = null
      return
    }
    const target = autoActionStore.autoActions.find((a) => a.id === id)
    editingSnapshot.value = target ? JSON.stringify(target) : null
  },
  { immediate: true },
)

const hasUnsavedChanges = computed(() => {
  if (!currentEditingAction.value || !editingSnapshot.value) return false
  return JSON.stringify(currentEditingAction.value) !== editingSnapshot.value
})

function revertEditingChanges() {
  if (!currentEditingAction.value || !editingSnapshot.value) return
  const restored = JSON.parse(editingSnapshot.value) as AutoActionItem
  Object.assign(currentEditingAction.value, restored)
  autoActionStore.syncScheduledTimers()
  toast.success('已还原本次编辑的所有修改')
}

function duplicateEditingAction() {
  if (!currentEditingAction.value) return
  const cloned = autoActionStore.duplicateAutoAction(currentEditingAction.value.id)
  if (cloned) {
    editingActionId.value = cloned.id
    toast.success(`已复制规则「${cloned.name}」并切换至编辑`)
  }
}

function deleteEditingAction() {
  if (!currentEditingAction.value) return
  const name = currentEditingAction.value.name || '未命名规则'
  autoActionStore.removeAutoAction(currentEditingAction.value.id)
  editingActionId.value = null
  toast.success(`已删除规则「${name}」`)
}

// 弹窗状态
const showAddModal = ref(false)
const selectedTriggerType = ref<TriggerType>(TriggerType.GIFT)
const showSetNextModal = ref(false)
const targetNextActionId = ref<string | null>(null)
const showTestModal = ref(false)
const testUid = ref<number | undefined>(10004)
const currentTestType = ref<TriggerType | null>(null)

// 单条规则沙盒测试弹窗
const showRuleTestDialog = ref(false)
const ruleTestTarget = ref<AutoActionItem | null>(null)

function openRuleTest(action: AutoActionItem) {
  ruleTestTarget.value = action
  showRuleTestDialog.value = true
}

function getMenuItemStatus(key: string) {
  const isTriggerType = Object.values(TriggerType).includes(key as TriggerType)
  const isCheckIn = key === 'check-in-settings'

  if (!isTriggerType && !isCheckIn) return { isEnabled: false, count: 0, isTriggerType: false }

  if (isTriggerType) {
    const type = key as TriggerType
    const isEnabled = autoActionStore.enabledTriggerTypes?.[type] ?? false
    const count = autoActionStore.autoActions.filter((a) => a.triggerType === type && a.enabled).length
    return { isEnabled, count, isTriggerType: true }
  }

  const isEnabled = accountStore.value?.settings?.point?.enableCheckIn ?? false
  return { isEnabled, count: isEnabled ? 1 : 0, isTriggerType: false }
}

const typeMap: Record<string, string> = {
  [TriggerType.DANMAKU]: '自动回复',
  [TriggerType.GIFT]: '礼物感谢',
  [TriggerType.GUARD]: '上舰感谢',
  [TriggerType.FOLLOW]: '关注感谢',
  [TriggerType.ENTER]: '入场欢迎',
  [TriggerType.SCHEDULED]: '定时发送',
  [TriggerType.SUPER_CHAT]: 'SC感谢',
  [TriggerType.POINT_REDEEM]: '积分兑换',
  [TriggerType.SONG_REQUEST]: '收到点歌',
  [TriggerType.SONG_START]: '开始演唱',
  [TriggerType.QUEUE_JOIN]: '观众入队',
  [TriggerType.QUEUE_NEXT_BATCH]: '新一队上车',
  [TriggerType.LIVE_START]: '开播触发',
  [TriggerType.LIVE_END]: '下播触发',
  [TriggerType.DANMAKU_DISCONNECTED]: '弹幕断连',
  [TriggerType.COOKIE_INVALID]: 'Cookie 失效',
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

// 仅统计「规则本身已启用且所属分类总开关也开启」的真正生效规则数
const effectiveActiveRulesCount = computed(
  () =>
    autoActionStore.autoActions.filter((a) => a.enabled && autoActionStore.enabledTriggerTypes?.[a.triggerType]).length,
)
const totalEnabledRulesCount = computed(() => autoActionStore.autoActions.filter((a) => a.enabled).length)

function handleMenuUpdate(key: string) {
  currentMenuKey.value = key
  editingActionId.value = null
}

function openQuickAddModal() {
  if (Object.values(TriggerType).includes(currentMenuKey.value as TriggerType)) {
    selectedTriggerType.value = currentMenuKey.value as TriggerType
  }
  showAddModal.value = true
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
  toast.success('已创建新规则')
}

function handleEdit(id: string) {
  editingActionId.value = id
}

function backToOverview() {
  editingActionId.value = null
}

function handleTestClick(type: TriggerType) {
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
    const uid = Number(testUid.value)
    if (!Number.isFinite(uid) || uid <= 0) {
      toast.error('请输入有效的 UID')
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
    toast.success('已指定下一条执行的定时规则')
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
  { label: '积分兑换', value: TriggerType.POINT_REDEEM },
  { label: '收到点歌', value: TriggerType.SONG_REQUEST },
  { label: '开始演唱', value: TriggerType.SONG_START },
  { label: '观众入队', value: TriggerType.QUEUE_JOIN },
  { label: '新一队上车', value: TriggerType.QUEUE_NEXT_BATCH },
  { label: '开播触发', value: TriggerType.LIVE_START },
  { label: '下播触发', value: TriggerType.LIVE_END },
  { label: '弹幕断连', value: TriggerType.DANMAKU_DISCONNECTED },
  { label: 'Cookie 失效', value: TriggerType.COOKIE_INVALID },
]

async function handleDanmakuAccountChange(value: string) {
  await accountManager.setDanmakuAccount(value)
  toast.success('已切换自动操作发弹幕/私信账号')
}

async function handleFallbackChange(value: boolean) {
  await accountManager.setFallbackToMain(value)
}
</script>

<template>
  <div class="auto-action-page flex flex-col gap-3 flex-1 min-h-0">
    <!-- 标准管理页标头 -->
    <ClientPageHeader
      title="自动操作"
      description="管理自动回复、礼物感谢、入场欢迎、定时发送、音效与 VTS/PNGtuber 联动规则"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  variant="outline"
                  class="cursor-pointer gap-1.5"
                  :class="
                    biliFunc.activeDanmakuAccountType === 'bot'
                      ? 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10'
                      : ''
                  "
                  @click="handleMenuUpdate('account-settings')"
                >
                  <component
                    :is="biliFunc.activeDanmakuAccountType === 'bot' ? Bot : UserPlus"
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
              <TooltipContent>点击快速切换自动操作发弹幕/私信所使用的 B 站账号</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger as-child>
                <Badge
                  variant="secondary"
                  class="tabular-nums"
                  :class="
                    effectiveActiveRulesCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : ''
                  "
                >
                  {{ `${effectiveActiveRulesCount} 条生效中` }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                当前共有 {{ effectiveActiveRulesCount }} 条规则处于生效状态（共
                {{ totalEnabledRulesCount }} 条规则开启，部分可能受分类总开关关闭影响）
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            class="gap-1.5"
            @click="openQuickAddModal"
          >
            <Plus class="size-3.5" />
            新建规则
          </Button>
        </div>
      </template>
    </ClientPageHeader>

    <Alert
      size="sm"
      variant="warning"
      v-if="!biliCookieStore.isCookieValid"
      class="shrink-0"
    >
      <div class="flex items-center justify-between w-full">
        <div>
          <AlertTitle>B站账号凭据未就绪</AlertTitle>
          <AlertDescription class="mt-0.5">
            发弹幕或私信类规则暂无法发送；本地音效、PNGtuber 与 VTS 联动规则不受影响。
          </AlertDescription>
        </div>
        <Button
          variant="outline"
          size="xs"
          class="shrink-0 ml-3"
          @click="router.push({ name: 'client-account-manage' })"
        >
          前往账号池
        </Button>
      </div>
    </Alert>

    <!-- 双栏全高工作台 -->
    <Card class="auto-action-workbench flex-1 min-h-0 overflow-hidden flex flex-col">
      <div class="flex flex-1 min-h-0">
        <!-- 左侧二级菜单 -->
        <div class="w-48 border-r bg-muted/10 p-2 flex flex-col gap-3.5 shrink-0 overflow-y-auto scrollbar-thin">
          <div
            v-for="group in menuGroups"
            :key="group.key"
            class="space-y-1"
          >
            <span class="text-[11px] font-semibold text-muted-foreground px-2 tracking-wider">
              {{ group.label }}
            </span>
            <div class="space-y-0.5">
              <Button
                v-for="item in group.children"
                :key="item.key"
                :variant="currentMenuKey === item.key ? 'default' : 'ghost'"
                class="w-full justify-between px-2.5"
                @click="handleMenuUpdate(item.key)"
              >
                <div class="flex items-center gap-2 truncate">
                  <component
                    :is="item.icon"
                    class="size-4 shrink-0"
                  />
                  <span class="truncate">{{ item.label }}</span>
                </div>

                <TooltipProvider v-if="getMenuItemStatus(item.key).isTriggerType || item.key === 'check-in-settings'">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <div class="flex items-center gap-1.5 shrink-0 pl-1">
                        <span
                          v-if="getMenuItemStatus(item.key).count > 0 && getMenuItemStatus(item.key).isTriggerType"
                          class="text-[10px] px-1 rounded font-semibold tabular-nums"
                          :class="[
                            currentMenuKey === item.key
                              ? 'bg-primary-foreground text-primary'
                              : 'bg-muted text-muted-foreground',
                            !getMenuItemStatus(item.key).isEnabled ? 'opacity-50 line-through' : '',
                          ]"
                        >
                          {{ getMenuItemStatus(item.key).count }}
                        </span>
                        <div
                          class="size-1.5 rounded-full"
                          :class="
                            getMenuItemStatus(item.key).isEnabled
                              ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]'
                              : 'bg-muted-foreground/40'
                          "
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      {{
                        getMenuItemStatus(item.key).isEnabled
                          ? `总开关已开启（${getMenuItemStatus(item.key).count} 条已启用）`
                          : '总开关已关闭（该分类规则暂不触发）'
                      }}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Button>
            </div>
          </div>
        </div>

        <!-- 右侧独立滚动内容区 -->
        <div class="flex-1 min-w-0 p-4 overflow-y-auto scrollbar-thin">
          <!-- 编辑模式 -->
          <div
            v-if="editingActionId && currentEditingAction"
            class="space-y-3.5 max-w-4xl mx-auto pb-4"
          >
            <div
              class="flex-between gap-3 flex-wrap pb-2.5 border-b sticky top-0 bg-card/95 backdrop-blur z-10 -mx-1 px-1 pt-0.5"
            >
              <div class="flex items-center gap-2.5 min-w-0">
                <Button
                  variant="secondary"
                  class="gap-1.5 shrink-0"
                  @click="backToOverview"
                >
                  <ArrowLeft class="size-3.5" />
                  返回列表
                </Button>
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-semibold text-sm text-foreground truncate">
                    {{ currentEditingAction.name || '未命名规则' }}
                  </span>
                  <Badge
                    variant="outline"
                    size="xs"
                    class="gap-1 text-muted-foreground shrink-0"
                  >
                    <Check class="size-3 text-emerald-500" />
                    {{ hasUnsavedChanges ? '已自动保存修改' : '实时自动保存' }}
                  </Badge>
                </div>
              </div>

              <div class="flex items-center gap-1.5 flex-wrap">
                <Button
                  v-if="hasUnsavedChanges"
                  variant="ghost"
                  size="xs"
                  class="gap-1"
                  @click="revertEditingChanges"
                >
                  <RotateCcw class="size-3.5" />
                  还原修改
                </Button>

                <Button
                  variant="secondary"
                  size="xs"
                  class="gap-1 text-amber-600 dark:text-amber-400"
                  @click="openRuleTest(currentEditingAction)"
                >
                  <FlaskConical class="size-3.5" />
                  测试此规则
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  class="gap-1"
                  @click="duplicateEditingAction"
                >
                  <Copy class="size-3.5" />
                  复制
                </Button>

                <Popconfirm
                  :title="`确定删除规则「${currentEditingAction.name || '未命名规则'}」吗？`"
                  @confirm="deleteEditingAction"
                >
                  <Button
                    variant="ghost"
                    size="xs"
                    class="gap-1 text-destructive hover:text-destructive"
                  >
                    <Trash2 class="size-3.5" />
                    删除
                  </Button>
                </Popconfirm>
              </div>
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
              @test-action="openRuleTest"
            >
              <template #header-content>
                <!-- 定时发送专属设置 -->
                <div
                  v-if="currentMenuKey === TriggerType.SCHEDULED"
                  class="mt-3 space-y-2.5"
                >
                  <GlobalScheduledSettings />
                  <div
                    v-if="
                      enabledTriggerTypes &&
                      enabledTriggerTypes[TriggerType.SCHEDULED] &&
                      autoActionStore.globalSchedulingMode === 'sequential' &&
                      autoActionStore.nextScheduledAction
                    "
                    class="next-action-display flex-between p-2.5 rounded-md border border-l-4 border-l-primary bg-card"
                  >
                    <div class="flex items-center gap-2 text-xs text-foreground">
                      <Target class="size-4 text-primary" />
                      <span>下一个执行:</span>
                      <Badge
                        variant="secondary"
                        size="sm"
                      >
                        {{ autoActionStore.nextScheduledAction?.name || '未命名操作' }}
                      </Badge>
                    </div>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="gap-1 text-primary hover:text-primary"
                      @click="openSetNextModal"
                    >
                      <Pencil class="size-3.5" />
                      手动指定
                    </Button>
                  </div>
                </div>

                <!-- 舰长专属提示 -->
                <Alert
                  size="sm"
                  variant="warning"
                  v-if="currentMenuKey === TriggerType.GUARD && webFetcherStore.webfetcherType === 'openlive'"
                  class="mt-3"
                >
                  <AlertTitle>功能限制提醒</AlertTitle>
                  <AlertDescription class="mt-0.5">
                    当前连接模式 (OpenLive) 无法获取用户
                    UID，因此无法执行【发送私信】操作。如需使用私信功能，请切换至直连模式。
                  </AlertDescription>
                </Alert>
              </template>
            </ActionList>

            <!-- 发送账号路由快捷卡片（不再重复嵌入整页多账号管理器） -->
            <div
              v-else-if="currentMenuKey === 'account-settings'"
              class="space-y-4 max-w-2xl"
            >
              <Card>
                <CardHeader class="p-3.5 border-b flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle class="text-xs font-semibold">自动操作发送账号路由</CardTitle>
                    <CardDescription class="text-[11px] mt-0.5">
                      决定自动回复、礼物感谢、上舰私信与定时弹幕使用账号池中的哪一个 B 站账号发送。
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="xs"
                    class="gap-1.5 shrink-0"
                    @click="router.push({ name: 'client-account-manage' })"
                  >
                    <ExternalLink class="size-3.5" />
                    管理账号池
                  </Button>
                </CardHeader>
                <CardContent class="p-3.5 space-y-3">
                  <Alert
                    v-if="accountManager.accounts.length === 0"
                    size="sm"
                    variant="warning"
                  >
                    <AlertTitle>尚未添加任何 B 站账号</AlertTitle>
                    <AlertDescription class="mt-0.5">
                      请前往【账号与凭据】添加主账号或房管小号后，再回到此处指定发送路由。
                    </AlertDescription>
                  </Alert>

                  <template v-else>
                    <SettingRow
                      variant="compact"
                      title="当前主账号（直播管理 / 房管）"
                      :description="
                        accountManager.mainAccount
                          ? `UID ${accountManager.mainAccount.mid}${accountManager.mainAccount.alias ? ` · ${accountManager.mainAccount.alias}` : ''}`
                          : '未指定'
                      "
                    >
                      <Badge
                        variant="outline"
                        size="xs"
                        :class="
                          accountManager.mainAccount?.isValid
                            ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                            : 'border-destructive/40 text-destructive bg-destructive/10'
                        "
                      >
                        {{ accountManager.mainAccount?.name || '未设置' }}
                        ({{ accountManager.mainAccount?.isValid ? '有效' : '失效' }})
                      </Badge>
                    </SettingRow>

                    <SettingRow
                      variant="compact"
                      title="自动发弹幕 / 私信账号"
                      description="可指定专用机器人小号发言，避免占用主播本人账号频率。"
                    >
                      <div class="w-56">
                        <Select
                          :model-value="accountManager.routing.danmakuAccountId || 'main'"
                          @update:model-value="handleDanmakuAccountChange(String($event))"
                        >
                          <SelectTrigger class="w-full">
                            <SelectValue placeholder="选择发送账号" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main">
                              跟随主账号 ({{ accountManager.mainAccount?.name || '未设置' }})
                            </SelectItem>
                            <SelectItem
                              v-for="acc in accountManager.accounts"
                              :key="acc.id"
                              :value="acc.id"
                            >
                              {{ acc.name }}{{ acc.alias ? ` (${acc.alias})` : '' }}{{ acc.isValid ? '' : ' [已失效]' }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </SettingRow>

                    <SettingRow
                      variant="compact"
                      title="小号失效时自动回退主账号"
                      description="当指定的发弹幕小号 Cookie 过期时，自动使用主账号继续发送，防止自动化中断。"
                    >
                      <Switch
                        :checked="accountManager.routing.fallbackToMain"
                        @update:checked="handleFallbackChange"
                      />
                    </SettingRow>
                  </template>
                </CardContent>
              </Card>
            </div>

            <!-- 签到设置 -->
            <CheckInSettings v-else-if="currentMenuKey === 'check-in-settings'" />

            <!-- 消息队列设置 -->
            <div
              v-else-if="currentMenuKey === 'queue-settings'"
              class="space-y-4 max-w-2xl"
            >
              <Card>
                <CardHeader class="p-3 border-b">
                  <CardTitle class="text-xs font-semibold">全局消息队列频率</CardTitle>
                </CardHeader>
                <CardContent class="p-3 space-y-3">
                  <SettingRow
                    variant="compact"
                    title="弹幕队列最小间隔 (ms)"
                    description="两条弹幕之间的最小发送间隔，过短可能导致被 B 站吞弹幕。建议 1000ms 以上。"
                  >
                    <NumberField
                      :model-value="biliFunc.danmakuInterval"
                      :min="100"
                      :step="100"
                      class="w-32"
                      @update:model-value="biliFunc.setDanmakuInterval($event || 1000)"
                    />
                  </SettingRow>

                  <SettingRow
                    variant="compact"
                    title="私信队列最小间隔 (ms)"
                    description="私信发送频率限制，建议保持默认 1000ms 或更高以避免触发 B 站频控。"
                  >
                    <NumberField
                      :model-value="biliFunc.pmInterval"
                      :min="1000"
                      :step="500"
                      class="w-32"
                      @update:model-value="biliFunc.setPmInterval($event || 1000)"
                    />
                  </SettingRow>
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

    <!-- 弹窗：新建规则 -->
    <Dialog v-model:open="showAddModal">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-sm">新建自动操作规则</DialogTitle>
        </DialogHeader>
        <FormField
          label="触发类型"
          class="pt-2"
        >
          <Select v-model="selectedTriggerType">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in triggerTypeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter class="pt-3">
          <Button
            variant="secondary"
            @click="showAddModal = false"
          >
            取消
          </Button>
          <Button @click="addAutoAction"> 创建并编辑 </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 弹窗：手动指定下一条 (顺序模式) -->
    <Dialog v-model:open="showSetNextModal">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle class="text-sm">手动指定下一条 (顺序模式)</DialogTitle>
        </DialogHeader>
        <FormField
          label="目标规则"
          description="仅列出当前已启用、类型也已启用且使用全局定时器的规则。"
          class="pt-2"
        >
          <Select v-model="targetNextActionId">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="选择规则" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="opt in eligibleGlobalActions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        <DialogFooter class="pt-3">
          <Button
            variant="secondary"
            @click="showSetNextModal = false"
          >
            取消
          </Button>
          <Button @click="confirmSetNextAction"> 确认指定 </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 弹窗：批量测试上舰感谢 -->
    <Dialog v-model:open="showTestModal">
      <DialogContent class="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle class="text-sm">批量测试上舰感谢</DialogTitle>
        </DialogHeader>
        <FormField
          label="测试接收者 UID"
          description="将向上舰分类下所有已启用规则广播一次模拟上舰事件。"
          class="pt-2"
        >
          <BiliUserSelector
            v-model:value="testUid"
            placeholder="请输入 B 站用户 UID"
          />
        </FormField>
        <DialogFooter class="pt-3">
          <Button
            variant="secondary"
            @click="showTestModal = false"
          >
            取消
          </Button>
          <Button @click="confirmTest"> 确认测试 </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 弹窗：单条规则沙盒测试 -->
    <RuleTestDialog
      v-model:open="showRuleTestDialog"
      :action="ruleTestTarget"
    />
  </div>
</template>
