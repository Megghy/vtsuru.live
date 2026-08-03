<script setup lang="ts">
const ArrowUp24Regular = 'i-lucide-circle'
const ArrowDown24Regular = 'i-lucide-circle'
const Edit16Regular = 'i-lucide-circle'
const Copy16Regular = 'i-lucide-circle'
const Delete16Regular = 'i-lucide-circle'
const MoreHorizontal24Regular = 'i-lucide-circle'
import { computed, h, nextTick, ref, resolveComponent } from 'vue'

import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { ActionType, TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'

import TimerCountdown from './TimerCountdown.vue'

const props = defineProps<{
  triggerType: TriggerType
  title: string
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'add'): void
  (e: 'test'): void
}>()

const autoActionStore = useAutoAction()
const toast = useToast()
const feedback = (color: 'success' | 'error' | 'warning' | 'info', title: string) => {
  toast.add({ title, color })
}
const biliCookieStore = useBiliCookie()

const searchText = ref('')
const deleteTarget = ref<AutoActionItem>()
const deleteOpen = computed({
  get: () => Boolean(deleteTarget.value),
  set: (open) => {
    if (!open) deleteTarget.value = undefined
  },
})

const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

// 该触发类型的全局真实顺序列表(不受搜索/排序影响), 用于排序按钮边界与移动判断
const orderedActions = computed(() =>
  (autoActionStore.autoActions as AutoActionItem[]).filter((a) => a.triggerType === props.triggerType),
)

// Filter actions for this type
const filteredActions = computed(() => {
  let list = [...orderedActions.value]

  if (searchText.value) {
    const lower = searchText.value.toLowerCase()
    list = list.filter(
      (a) => a.name.toLowerCase().includes(lower) || (a.description && a.description.toLowerCase().includes(lower)),
    )
  }

  // Sort: Enabled first
  return list.toSorted((a, b) => {
    if (a.enabled === b.enabled) return 0
    return a.enabled ? -1 : 1
  })
})

const typeEnabled = computed({
  get: () => enabledTriggerTypes.value[props.triggerType],
  set: (val) => autoActionStore.setTriggerTypeEnabled(props.triggerType, val),
})

function handleBatchEnable(enabled: boolean) {
  const actionsToUpdate = filteredActions.value
  actionsToUpdate.forEach((a) => {
    autoActionStore.toggleAutoAction(a.id, enabled)
  })
  feedback('success', `已${enabled ? '启用' : '禁用'} ${actionsToUpdate.length} 条操作`)
}

function getStatusTag(action: AutoActionItem) {
  const requiresLogin =
    action.actionType === ActionType.SEND_DANMAKU || action.actionType === ActionType.SEND_PRIVATE_MSG

  if (requiresLogin && !biliCookieStore.isCookieValid) {
    return { type: 'error' as const, text: '需登录', tooltip: '发送弹幕或私信需要登录B站账号' }
  }

  if (!enabledTriggerTypes.value[action.triggerType]) {
    return { type: 'warning' as const, text: '类型禁用', tooltip: `所有${props.title}类型的操作已禁用` }
  }

  if (!action.enabled) {
    return { type: 'default' as const, text: '已禁用', tooltip: '此操作已被手动禁用' }
  }

  if ([ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG, ActionType.EXECUTE_COMMAND].includes(action.actionType)) {
    if (!action.template || (typeof action.template === 'string' && action.template.trim() === '')) {
      return { type: 'warning' as const, text: '空模板', tooltip: '请设置有效的模板内容' }
    }
  }

  if (action.triggerConfig.onlyDuringLive && !autoActionStore.isLive) {
    return { type: 'warning' as const, text: '待机中', tooltip: '仅在直播时触发' }
  }

  if (action.triggerConfig.ignoreTianXuan && autoActionStore.isTianXuanActive) {
    return { type: 'warning' as const, text: '暂停中', tooltip: '天选时刻暂停触发' }
  }

  return { type: 'success' as const, text: '运行中', tooltip: '正常运行' }
}

const columns = computed<any[]>(() => {
  const base: any[] = [
    {
      title: '名称',
      key: 'name',
      render: (row: any) => {
        return h('div', { class: 'action-name-cell' }, [
          h('span', { strong: true }, { default: () => row.name || '未命名操作' }),
          row.description
            ? h(
                'span',
                { depth: 3, size: 'small', style: 'display: block; font-size: 12px;' },
                { default: () => row.description },
              )
            : null,
        ])
      },
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      align: 'center',
      render: (row: any) => {
        const status = getStatusTag(row)
        return h(
          resolveComponent('UDropdownMenu'),
          {
            trigger: 'click',
            options: [
              {
                label: row.enabled ? '禁用' : '启用',
                key: 'toggle',
                props: {
                  onClick: () => {
                    autoActionStore.toggleAutoAction(row.id, !row.enabled)
                    feedback('success', `已${!row.enabled ? '启用' : '禁用'}: ${row.name}`)
                  },
                },
              },
              {
                label: row.triggerConfig.onlyDuringLive ? '取消"仅直播"' : '设为"仅直播"',
                key: 'live',
                props: {
                  onClick: () => {
                    row.triggerConfig.onlyDuringLive = !row.triggerConfig.onlyDuringLive
                    feedback('success', '已更新触发条件')
                  },
                },
              },
            ],
          },
          {
            default: () =>
              h(
                resolveComponent('UTooltip'),
                { trigger: 'hover' },
                {
                  trigger: () =>
                    h(
                      resolveComponent('UBadge'),
                      { type: status.type, size: 'small', round: true, style: 'cursor: pointer' },
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

  if (props.triggerType === TriggerType.SCHEDULED) {
    base.push({
      title: '下次触发',
      key: 'timer',
      width: 120,
      align: 'center',
      render: (row: any) => {
        if (!typeEnabled.value || !row.enabled) return h('span', { depth: 3 }, { default: () => '-' })
        return h(TimerCountdown, { actionId: row.id })
      },
    })
  }

  base.push({
    title: '操作',
    key: 'actions',
    width: 140,
    align: 'right',
    render: (row: any) => {
      const index = orderedActions.value.findIndex((a) => a.id === row.id)
      const buttons = []

      // Move buttons for Scheduled
      if (props.triggerType === TriggerType.SCHEDULED) {
        buttons.push(
          h(
            resolveComponent('UButton'),
            {
              size: 'tiny',
              tertiary: true,
              circle: true,
              disabled: index === 0,
              onClick: () => autoActionStore.moveAction(row.id, 'up'),
            },
            { icon: () => h(resolveComponent('UIcon'), { component: ArrowUp24Regular }) },
          ),
          h(
            resolveComponent('UButton'),
            {
              size: 'tiny',
              tertiary: true,
              circle: true,
              disabled: index === orderedActions.value.length - 1,
              onClick: () => autoActionStore.moveAction(row.id, 'down'),
            },
            { icon: () => h(resolveComponent('UIcon'), { component: ArrowDown24Regular }) },
          ),
        )
      }

      buttons.push(
        h(
          resolveComponent('UButton'),
          {
            size: 'small',
            secondary: true,
            type: 'primary',
            onClick: () => emit('edit', row.id),
          },
          { icon: () => h(resolveComponent('UIcon'), { component: Edit16Regular }), default: () => '编辑' },
        ),
        h(
          resolveComponent('UDropdownMenu'),
          {
            trigger: 'hover',
            options: [
              {
                label: '复制',
                key: 'duplicate',
                icon: () => h(resolveComponent('UIcon'), { component: Copy16Regular }),
              },
              {
                label: '删除',
                key: 'delete',
                icon: () => h(resolveComponent('UIcon'), { component: Delete16Regular }),
              },
            ],
            onSelect: (key) => {
              if (key === 'duplicate') duplicateAction(row)
              if (key === 'delete') deleteAction(row)
            },
          },
          {
            default: () =>
              h(
                resolveComponent('UButton'),
                { size: 'small', quaternary: true, circle: true },
                { icon: () => h(resolveComponent('UIcon'), { component: MoreHorizontal24Regular }) },
              ),
          },
        ),
      )

      return h('div', { size: 4, align: 'center', justify: 'end' }, { default: () => buttons })
    },
  })

  return base
})

// 智能生成克隆名称: "X" -> "X (复制)" -> "X (复制 2)" -> "X (复制 3)"
function nextDuplicateName(sourceName: string) {
  // 剥离已有的 "(复制)" / "(复制 N)" 后缀, 得到基础名
  const baseName = sourceName.replace(/\s*\(复制(?:\s*\d+)?\)$/, '').trim()
  const escaped = baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`^${escaped}\\s*\\(复制(?:\\s*(\\d+))?\\)$`)

  let maxN = 0
  let hasCopy = false
  for (const a of autoActionStore.autoActions as AutoActionItem[]) {
    const m = a.name?.match(re)
    if (m) {
      hasCopy = true
      maxN = Math.max(maxN, m[1] ? Number(m[1]) : 1)
    }
  }
  if (!hasCopy) return `${baseName} (复制)`
  return `${baseName} (复制 ${maxN + 1})`
}

function duplicateAction(action: AutoActionItem) {
  const newActionData = JSON.parse(JSON.stringify(action))
  const newActionId = `auto-action-${Date.now()}`
  newActionData.id = newActionId
  newActionData.name = nextDuplicateName(action.name || '未命名操作')
  autoActionStore.autoActions.push(newActionData)

  if (newActionData.triggerType === TriggerType.SCHEDULED) {
    nextTick(() => {
      const added = autoActionStore.autoActions.find((a) => a.id === newActionId)
      if (added) {
        if (added.triggerConfig.useGlobalTimer) autoActionStore.restartGlobalTimer()
        else autoActionStore.startIndividualTimer(added)
      }
    })
  }
  feedback('success', '已复制')
}

function deleteAction(action: AutoActionItem) {
  deleteTarget.value = action
}

function confirmDelete() {
  if (!deleteTarget.value) return
  autoActionStore.removeAutoAction(deleteTarget.value.id)
  deleteTarget.value = undefined
  feedback('success', '已删除')
}

function exportActions() {
  const actionsToExport = filteredActions.value
  if (actionsToExport.length === 0) {
    feedback('warning', '没有可导出的操作')
    return
  }
  const data = JSON.stringify(actionsToExport, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `autoaction-${props.triggerType}-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
  feedback('success', `已导出 ${actionsToExport.length} 条操作`)
}

function importActions() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const imported = JSON.parse(text) as AutoActionItem[]
      if (!Array.isArray(imported)) throw new Error('无效的配置格式')
      let count = 0
      for (const item of imported) {
        if (item.triggerType !== props.triggerType) continue
        item.id = `auto-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        autoActionStore.autoActions.push(item)
        count++
      }
      feedback('success', `已导入 ${count} 条操作`)
    } catch (err) {
      feedback('error', `导入失败: ${(err as Error).message}`)
    }
  }
  input.click()
}
</script>

<template>
  <div class="action-list">
    <div class="action-list-header">
      <div
        justify="space-between"
        align="center"
      >
        <div
          align="center"
          :size="16"
        >
          <div align="center">
            <USwitch
              v-model="typeEnabled"
              size="small"
            >
              <template v-if="false"> 已启用 </template>
              <template v-if="false"> 已禁用 </template>
            </USwitch>
            <span
              :depth="typeEnabled ? 1 : 3"
              strong
            >
              {{ typeEnabled ? '已启用' : '已禁用' }}{{ title }}
            </span>
          </div>

          <div
            v-if="filteredActions.length > 0"
            class="batch-actions"
          >
            <UButton
              size="tiny"
              variant="ghost"
              @click="handleBatchEnable(true)"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              全部启用
            </UButton>
            <UButton
              size="tiny"
              variant="ghost"
              @click="handleBatchEnable(false)"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
              全部禁用
            </UButton>
          </div>
        </div>

        <div align="center">
          <UInput
            v-model="searchText"
            placeholder="搜索操作..."
            size="small"
            style="width: 180px"
            clearable
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
          </UInput>
          <slot name="extra-actions" />
          <UDropdownMenu
            trigger="hover"
            :items="[
              { label: '导出配置', key: 'export' },
              { label: '导入配置', key: 'import' },
            ]"
            @select="(key: string) => (key === 'export' ? exportActions() : importActions())"
          >
            <UButton
              size="small"
              variant="ghost"
            >
              <template #leading>
                <UIcon name="i-lucide-circle" />
              </template>
            </UButton>
          </UDropdownMenu>
          <UButton
            size="small"
            variant="soft"
            color="warning"
            @click="$emit('test')"
          >
            测试
          </UButton>
          <UButton
            size="small"
            color="primary"
            @click="$emit('add')"
          >
            <template #leading>
              <UIcon name="i-lucide-circle" />
            </template>
            添加{{ title }}
          </UButton>
        </div>
      </div>
    </div>

    <slot name="header-content" />

    <div class="action-list-content">
      <transition
        name="fade"
        mode="out-in"
      >
        <UEmpty
          v-if="filteredActions.length === 0"
          :description="searchText ? '没有匹配的搜索结果' : '暂无操作'"
          style="margin-top: 60px"
        >
          <template #extra>
            <UButton
              v-if="!searchText"
              color="primary"
              dashed
              @click="$emit('add')"
            >
              创建第一个{{ title }}
            </UButton>
            <UButton
              v-else
              variant="ghost"
              @click="searchText = ''"
            >
              重置搜索
            </UButton>
          </template>
        </UEmpty>

        <UTable
          v-else
          :key="triggerType"
          :columns="columns"
          :data="filteredActions"
          :row-key="(row) => row.id"
          :bordered="false"
          :virtual-scroll="filteredActions.length > 20"
          :max-height="filteredActions.length > 20 ? 600 : undefined"
          class="action-table"
          size="small"
          striped
        />
      </transition>
    </div>
  </div>
  <UModal
    v-model:open="deleteOpen"
    title="确认删除"
  >
    <template #body> 确定要删除操作「{{ deleteTarget?.name || '未命名操作' }}」吗？此操作不可撤销。 </template>
    <template #footer>
      <UButton
        color="neutral"
        variant="outline"
        @click="deleteOpen = false"
        >取消</UButton
      >
      <UButton
        color="error"
        @click="confirmDelete"
        >删除</UButton
      >
    </template>
  </UModal>
</template>

<style scoped>
.action-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-list-header {
  padding: 12px 16px;
  background-color: var(--vtsuru-bg-inset);
  border-radius: var(--vtsuru-radius);
  margin-bottom: 12px;
}

.action-table :deep(.u-data-table-td) {
  padding: 10px 8px;
}

.action-table :deep(.u-data-table-tr:hover) {
  background-color: var(--vtsuru-bg-muted);
}

.action-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-actions {
  display: flex;
  gap: 4px;
  border-left: 1px solid var(--vtsuru-border);
  padding-left: 12px;
  margin-left: 4px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
