<script setup lang="ts">
import {
  Add16Regular,
  ArrowDown24Regular,
  ArrowUp24Regular,
  CheckmarkCircle16Regular,
  Copy16Regular,
  Delete16Regular,
  DismissCircle16Regular,
  Edit16Regular,
  MoreHorizontal24Regular,
  Search16Regular,
} from '@vicons/fluent'
import { computed, nextTick, ref } from 'vue'
import { toast } from 'vue-sonner'

// Fix vue-tsc type inference issue in template inline functions
const showToast = toast

import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { ActionType, TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

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
const biliCookieStore = useBiliCookie()

const searchText = ref('')

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
  showToast.success(`已${enabled ? '启用' : '禁用'} ${actionsToUpdate.length} 条操作`)
}

function getStatusBadge(action: AutoActionItem) {
  const requiresLogin =
    action.actionType === ActionType.SEND_DANMAKU || action.actionType === ActionType.SEND_PRIVATE_MSG

  if (requiresLogin && !biliCookieStore.isCookieValid) {
    return {
      class: 'border-destructive/40 text-destructive bg-destructive/10',
      text: '需登录',
      tooltip: '发送弹幕或私信需要登录B站账号',
    }
  }

  if (!enabledTriggerTypes.value[action.triggerType]) {
    return {
      class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
      text: '类型禁用',
      tooltip: `所有${props.title}类型的操作已禁用`,
    }
  }

  if (!action.enabled) {
    return { class: 'border-border text-muted-foreground bg-muted/40', text: '已禁用', tooltip: '此操作已被手动禁用' }
  }

  if ([ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG, ActionType.EXECUTE_COMMAND].includes(action.actionType)) {
    if (!action.template || (typeof action.template === 'string' && action.template.trim() === '')) {
      return {
        class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
        text: '空模板',
        tooltip: '请设置有效的模板内容',
      }
    }
  }

  if (action.triggerConfig.onlyDuringLive && !autoActionStore.isLive) {
    return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '待机中', tooltip: '仅在直播时触发' }
  }

  if (action.triggerConfig.ignoreTianXuan && autoActionStore.isTianXuanActive) {
    return { class: 'border-amber-500/40 text-amber-600 bg-amber-500/10', text: '暂停中', tooltip: '天选时刻暂停触发' }
  }

  return { class: 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10', text: '运行中', tooltip: '正常运行' }
}

function nextDuplicateName(sourceName: string) {
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
  showToast.success('已复制')
}

function deleteAction(action: AutoActionItem) {
  autoActionStore.removeAutoAction(action.id)
  showToast.success('已删除')
}

function exportActions() {
  const actionsToExport = filteredActions.value
  if (actionsToExport.length === 0) {
    showToast.warning('没有可导出的操作')
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
  showToast.success(`已导出 ${actionsToExport.length} 条操作`)
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
      showToast.success(`已导入 ${count} 条操作`)
    } catch (err) {
      showToast.error(`导入失败: ${(err as Error).message}`)
    }
  }
  input.click()
}

function toggleActionEnabled(row: AutoActionItem) {
  autoActionStore.toggleAutoAction(row.id, !row.enabled)
  showToast.success(`已${!row.enabled ? '启用' : '禁用'}: ${row.name}`)
}

function toggleActionOnlyLive(row: AutoActionItem) {
  row.triggerConfig.onlyDuringLive = !row.triggerConfig.onlyDuringLive
  showToast.success('已更新触发条件')
}
</script>

<template>
  <div class="action-list flex flex-col h-full">
    <div class="action-list-header flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-4 flex-wrap">
        <div class="flex items-center gap-2 cursor-pointer select-none">
          <Switch v-model:checked="typeEnabled" />
          <span
            class="text-xs font-semibold"
            :class="typeEnabled ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ typeEnabled ? '已启用' : '已禁用' }}{{ title }}
          </span>
        </div>

        <div
          v-if="filteredActions.length > 0"
          class="batch-actions flex items-center gap-1.5"
        >
          <Button
            size="xs"
            variant="ghost"
            class="h-6 text-[11px] gap-1"
            @click="handleBatchEnable(true)"
          >
            <CheckmarkCircle16Regular class="size-3" />
            全部启用
          </Button>
          <Button
            size="xs"
            variant="ghost"
            class="h-6 text-[11px] gap-1"
            @click="handleBatchEnable(false)"
          >
            <DismissCircle16Regular class="size-3" />
            全部禁用
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-[180px]">
          <Search16Regular class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            v-model="searchText"
            placeholder="搜索操作..."
            class="pl-8 pr-2"
          />
        </div>

        <slot name="extra-actions" />

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              class="w-8 p-0"
            >
              <MoreHorizontal24Regular class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              class="text-xs"
              @select="exportActions"
            >
              导出配置
            </DropdownMenuItem>
            <DropdownMenuItem
              class="text-xs"
              @select="importActions"
            >
              导入配置
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="secondary"
          class="text-amber-600 dark:text-amber-400"
          @click="$emit('test')"
        >
          测试
        </Button>

        <Button
          class="gap-1.5"
          @click="$emit('add')"
        >
          <Add16Regular class="size-3.5" />
          添加{{ title }}
        </Button>
      </div>
    </div>

    <slot name="header-content" />

    <div class="action-list-content flex-1 pt-3">
      <div
        v-if="filteredActions.length === 0"
        class="py-12 flex flex-col items-center justify-center"
      >
        <Empty :description="searchText ? '没有匹配的搜索结果' : '暂无操作'">
          <div class="mt-3">
            <Button
              v-if="!searchText"
              @click="$emit('add')"
            >
              创建第一个{{ title }}
            </Button>
            <Button
              v-else
              variant="secondary"
              @click="searchText = ''"
            >
              重置搜索
            </Button>
          </div>
        </Empty>
      </div>

      <div
        v-else
        class="border rounded-md overflow-hidden bg-card"
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="text-xs">名称</TableHead>
              <TableHead class="text-xs text-center w-[100px]">状态</TableHead>
              <TableHead
                v-if="triggerType === TriggerType.SCHEDULED"
                class="text-xs text-center w-[120px]"
              >
                下次触发
              </TableHead>
              <TableHead class="text-xs text-right w-[160px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredActions"
              :key="row.id"
            >
              <TableCell class="text-xs">
                <div class="flex flex-col gap-0.5">
                  <span class="font-medium text-foreground">{{ row.name || '未命名操作' }}</span>
                  <span
                    v-if="row.description"
                    class="text-[11px] text-muted-foreground"
                  >
                    {{ row.description }}
                  </span>
                </div>
              </TableCell>

              <TableCell class="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Badge
                              variant="outline"
                              class="text-[10px] h-5 px-2 cursor-pointer"
                              :class="getStatusBadge(row).class"
                            >
                              {{ getStatusBadge(row).text }}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>{{ getStatusBadge(row).tooltip }}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    <DropdownMenuItem
                      class="text-xs"
                      @select="toggleActionEnabled(row)"
                    >
                      {{ row.enabled ? '禁用' : '启用' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      class="text-xs"
                      @select="toggleActionOnlyLive(row)"
                    >
                      {{ row.triggerConfig.onlyDuringLive ? '取消"仅直播"' : '设为"仅直播"' }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>

              <TableCell
                v-if="triggerType === TriggerType.SCHEDULED"
                class="text-center text-xs"
              >
                <template v-if="!typeEnabled || !row.enabled">-</template>
                <TimerCountdown
                  v-else
                  :action-id="row.id"
                />
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1.5">
                  <!-- 上下移动排序 (仅定时) -->
                  <template v-if="triggerType === TriggerType.SCHEDULED">
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 w-6 p-0"
                      :disabled="orderedActions.findIndex((a) => a.id === row.id) === 0"
                      @click="autoActionStore.moveAction(row.id, 'up')"
                    >
                      <ArrowUp24Regular class="size-3.5" />
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="h-6 w-6 p-0"
                      :disabled="orderedActions.findIndex((a) => a.id === row.id) === orderedActions.length - 1"
                      @click="autoActionStore.moveAction(row.id, 'down')"
                    >
                      <ArrowDown24Regular class="size-3.5" />
                    </Button>
                  </template>

                  <Button
                    size="xs"
                    variant="secondary"
                    class="gap-1"
                    @click="$emit('edit', row.id)"
                  >
                    <Edit16Regular class="size-3" />
                    编辑
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button
                        size="xs"
                        variant="ghost"
                        class="w-7 p-0"
                      >
                        <MoreHorizontal24Regular class="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        class="text-xs gap-1.5"
                        @select="duplicateAction(row)"
                      >
                        <Copy16Regular class="size-3.5" />
                        复制
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        class="text-xs gap-1.5 text-destructive focus:text-destructive"
                        @select="deleteAction(row)"
                      >
                        <Delete16Regular class="size-3.5" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.action-list {
  height: 100%;
}

.action-list-header {
  padding: 10px 14px;
  background-color: var(--muted, var(--muted));
  border-radius: var(--radius);
  border: 1px solid var(--border);
}

.batch-actions {
  border-left: 1px solid var(--border);
  padding-left: 12px;
}
</style>
