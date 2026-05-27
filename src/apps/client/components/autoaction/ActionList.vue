<script setup lang="ts">
import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { ArrowDown24Regular, ArrowUp24Regular, Edit16Regular, Add16Regular, Copy16Regular, Delete16Regular, MoreHorizontal24Regular, Search16Regular, CheckmarkCircle16Regular, DismissCircle16Regular } from '@vicons/fluent'
import type { DataTableColumns } from 'naive-ui'
import {
  NButton, NDataTable, NDropdown, NEmpty, NFlex, NIcon, NTag, NText, NTooltip, useMessage,
  NSwitch, NInput, useDialog
} from 'naive-ui'
import { computed, h, nextTick, ref } from 'vue'
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
const message = useMessage()
const dialog = useDialog()
const biliCookieStore = useBiliCookie()

const searchText = ref('')

const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

// Filter actions for this type
const filteredActions = computed(() => {
  let list = (autoActionStore.autoActions as AutoActionItem[]).filter(a => a.triggerType === props.triggerType)
  
  if (searchText.value) {
    const lower = searchText.value.toLowerCase()
    list = list.filter(a => 
      a.name.toLowerCase().includes(lower) || 
      (a.description && a.description.toLowerCase().includes(lower))
    )
  }

  // Sort: Enabled first
  return list.sort((a, b) => {
    if (a.enabled === b.enabled) return 0
    return a.enabled ? -1 : 1
  })
})

const typeEnabled = computed({
  get: () => enabledTriggerTypes.value[props.triggerType],
  set: (val) => autoActionStore.setTriggerTypeEnabled(props.triggerType, val)
})

function handleBatchEnable(enabled: boolean) {
  const actionsToUpdate = filteredActions.value
  actionsToUpdate.forEach(a => {
    autoActionStore.toggleAutoAction(a.id, enabled)
  })
  message.success(`已${enabled ? '启用' : '禁用'} ${actionsToUpdate.length} 条操作`)
}

function getStatusTag(action: AutoActionItem) {
  const requiresLogin = action.actionType === ActionType.SEND_DANMAKU || action.actionType === ActionType.SEND_PRIVATE_MSG
  
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

const columns = computed<DataTableColumns<AutoActionItem>>(() => {
  const base: DataTableColumns<AutoActionItem> = [
    {
      title: '名称',
      key: 'name',
      render: (row: any) => {
        return h('div', { class: 'action-name-cell' }, [
          h(NText, { strong: true }, { default: () => row.name || '未命名操作' }),
          row.description ? h(NText, { depth: 3, size: 'small', style: 'display: block; font-size: 12px;' }, { default: () => row.description }) : null
        ])
      }
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      align: 'center',
      render: (row: any) => {
        const status = getStatusTag(row)
        return h(NDropdown, {
          trigger: 'click',
          options: [
            {
              label: row.enabled ? '禁用' : '启用',
              key: 'toggle',
              props: {
                onClick: () => {
                  autoActionStore.toggleAutoAction(row.id, !row.enabled)
                  message.success(`已${!row.enabled ? '启用' : '禁用'}: ${row.name}`)
                }
              }
            },
            {
              label: row.triggerConfig.onlyDuringLive ? '取消"仅直播"' : '设为"仅直播"',
              key: 'live',
              props: {
                onClick: () => {
                  row.triggerConfig.onlyDuringLive = !row.triggerConfig.onlyDuringLive
                  message.success('已更新触发条件')
                }
              }
            }
          ]
        }, {
          default: () => h(NTooltip, { trigger: 'hover' }, {
            trigger: () => h(NTag, { type: status.type, size: 'small', round: true, style: 'cursor: pointer' }, { default: () => status.text }),
            default: () => status.tooltip
          })
        })
      }
    }
  ]

  if (props.triggerType === TriggerType.SCHEDULED) {
    base.push({
      title: '下次触发',
      key: 'timer',
      width: 120,
      align: 'center',
      render: (row: any) => {
         if (!typeEnabled.value || !row.enabled) return h(NText, { depth: 3 }, { default: () => '-' })
         return h(TimerCountdown, { actionId: row.id })
      }
    })
  }

  base.push({
    title: '操作',
    key: 'actions',
    width: 140,
    align: 'right',
    render: (row: any) => {
      const index = filteredActions.value.findIndex(a => a.id === row.id)
      const buttons = []
      
      // Move buttons for Scheduled
      if (props.triggerType === TriggerType.SCHEDULED) {
         buttons.push(
           h(NButton, { 
             size: 'tiny', 
             tertiary: true, 
             circle: true, 
             disabled: index === 0, 
             onClick: () => autoActionStore.moveAction(row.id, 'up') 
           }, { icon: () => h(NIcon, { component: ArrowUp24Regular }) }),
           h(NButton, { 
             size: 'tiny', 
             tertiary: true, 
             circle: true, 
             disabled: index === filteredActions.value.length - 1, 
             onClick: () => autoActionStore.moveAction(row.id, 'down') 
           }, { icon: () => h(NIcon, { component: ArrowDown24Regular }) })
         )
      }

      buttons.push(
        h(NButton, { 
          size: 'small', 
          secondary: true, 
          type: 'primary', 
          onClick: () => emit('edit', row.id) 
        }, { icon: () => h(NIcon, { component: Edit16Regular }), default: () => '编辑' }),
        h(NDropdown, {
          trigger: 'hover',
          options: [
            { label: '复制', key: 'duplicate', icon: () => h(NIcon, { component: Copy16Regular }) },
            { label: '删除', key: 'delete', icon: () => h(NIcon, { component: Delete16Regular }) }
          ],
          onSelect: (key) => {
            if (key === 'duplicate') duplicateAction(row)
            if (key === 'delete') deleteAction(row)
          }
        }, {
          default: () => h(NButton, { size: 'small', quaternary: true, circle: true }, { icon: () => h(NIcon, { component: MoreHorizontal24Regular }) })
        })
      )
      
      return h(NFlex, { size: 4, align: 'center', justify: 'end' }, { default: () => buttons })
    }
  })

  return base
})

function duplicateAction(action: AutoActionItem) {
  const newActionData = JSON.parse(JSON.stringify(action))
  const newActionId = `auto-action-${Date.now()}`
  newActionData.id = newActionId
  newActionData.name += ' (复制)'
  autoActionStore.autoActions.push(newActionData)
  
  if (newActionData.triggerType === TriggerType.SCHEDULED) {
    nextTick(() => {
      const added = autoActionStore.autoActions.find(a => a.id === newActionId)
      if (added) {
        if (added.triggerConfig.useGlobalTimer) autoActionStore.restartGlobalTimer()
        else autoActionStore.startIndividualTimer(added)
      }
    })
  }
  message.success('已复制')
}

function deleteAction(action: AutoActionItem) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除操作「${action.name || '未命名操作'}」吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      autoActionStore.removeAutoAction(action.id)
      message.success('已删除')
    },
  })
}

function exportActions() {
  const actionsToExport = filteredActions.value
  if (actionsToExport.length === 0) {
    message.warning('没有可导出的操作')
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
  message.success(`已导出 ${actionsToExport.length} 条操作`)
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
      message.success(`已导入 ${count} 条操作`)
    } catch (err) {
      message.error(`导入失败: ${(err as Error).message}`)
    }
  }
  input.click()
}
</script>

<template>
  <div class="action-list">
    <div class="action-list-header">
      <NFlex justify="space-between" align="center">
        <NFlex align="center" :size="16">
          <NFlex align="center">
            <NSwitch v-model:value="typeEnabled" size="small">
              <template #checked>
                已启用
              </template>
              <template #unchecked>
                已禁用
              </template>
            </NSwitch>
            <NText :depth="typeEnabled ? 1 : 3" strong>
              {{ typeEnabled ? '已启用' : '已禁用' }}{{ title }}
            </NText>
          </NFlex>
          
          <div v-if="filteredActions.length > 0" class="batch-actions">
            <NButton size="tiny" quaternary @click="handleBatchEnable(true)">
              <template #icon>
                <NIcon :component="CheckmarkCircle16Regular" />
              </template>
              全部启用
            </NButton>
            <NButton size="tiny" quaternary @click="handleBatchEnable(false)">
              <template #icon>
                <NIcon :component="DismissCircle16Regular" />
              </template>
              全部禁用
            </NButton>
          </div>
        </NFlex>
        
        <NFlex align="center">
          <NInput 
            v-model:value="searchText" 
            placeholder="搜索操作..." 
            size="small" 
            style="width: 180px"
            clearable
          >
            <template #prefix>
              <NIcon :component="Search16Regular" />
            </template>
          </NInput>
          <slot name="extra-actions" />
          <NDropdown
            trigger="hover"
            :options="[
              { label: '导出配置', key: 'export' },
              { label: '导入配置', key: 'import' },
            ]"
            @select="(key: string) => key === 'export' ? exportActions() : importActions()"
          >
            <NButton size="small" quaternary>
              <template #icon>
                <NIcon :component="MoreHorizontal24Regular" />
              </template>
            </NButton>
          </NDropdown>
          <NButton size="small" secondary type="warning" @click="$emit('test')">
            测试
          </NButton>
          <NButton size="small" type="primary" @click="$emit('add')">
            <template #icon>
              <NIcon :component="Add16Regular" />
            </template>
            添加{{ title }}
          </NButton>
        </NFlex>
      </NFlex>
    </div>

    <slot name="header-content" />

    <div class="action-list-content">
      <transition name="fade" mode="out-in">
        <NEmpty v-if="filteredActions.length === 0" :description="searchText ? '没有匹配的搜索结果' : '暂无操作'" style="margin-top: 60px">
          <template #extra>
            <NButton v-if="!searchText" type="primary" dashed @click="$emit('add')">
              创建第一个{{ title }}
            </NButton>
            <NButton v-else quaternary @click="searchText = ''">
              重置搜索
            </NButton>
          </template>
        </NEmpty>
        
        <NDataTable
          v-else
          :key="triggerType"
          :columns="columns"
          :data="filteredActions"
          :row-key="row => row.id"
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
</template>

<style scoped>
.action-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.action-list-header {
  padding: 12px 16px;
  background-color: var(--n-color-embedded);
  border-radius: var(--n-border-radius);
  margin-bottom: 12px;
}

.action-table :deep(.n-data-table-td) {
  padding: 10px 8px;
}

.action-table :deep(.n-data-table-tr:hover) {
  background-color: var(--n-color-hover);
}

.action-name-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.batch-actions {
  display: flex;
  gap: 4px;
  border-left: 1px solid var(--n-divider-color);
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
