<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Copy,
  FlaskConical,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'

import type { AutoActionItem } from '@/apps/client/store/autoAction/types'
import { VTS_ACTION_TYPES } from '@/apps/client/store/autoAction/types'
import { ActionType, KeywordMatchType, Priority, TriggerType, useAutoAction } from '@/apps/client/store/useAutoAction'
import { useBiliCookie } from '@/apps/client/store/useBiliCookie'
import { useFilePicker } from '@/composables/useFilePicker'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/ui/dropdown-menu'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'

import TimerCountdown from './TimerCountdown.vue'

const showToast = toast

const props = defineProps<{
  triggerType: TriggerType
  title: string
}>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'add'): void
  (e: 'test'): void
  (e: 'test-action', action: AutoActionItem): void
}>()

const autoActionStore = useAutoAction()
const biliCookieStore = useBiliCookie()

const searchText = ref('')
const actionTypeFilter = ref<string>('all')

const enabledTriggerTypes = computed(() => autoActionStore.enabledTriggerTypes)

const orderedActions = computed(() =>
  (autoActionStore.autoActions as AutoActionItem[]).filter((a) => a.triggerType === props.triggerType),
)

const isFiltered = computed(() => Boolean(searchText.value.trim()) || actionTypeFilter.value !== 'all')

function matchesActionTypeCategory(actionType: ActionType, filter: string): boolean {
  if (filter === 'all') return true
  if (filter === 'vts') return VTS_ACTION_TYPES.has(actionType)
  return actionType === filter
}

const filteredActions = computed(() => {
  let list = [...orderedActions.value]

  if (actionTypeFilter.value !== 'all') {
    list = list.filter((a) => matchesActionTypeCategory(a.actionType, actionTypeFilter.value))
  }

  if (searchText.value.trim()) {
    const lower = searchText.value.trim().toLowerCase()
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(lower) ||
        (a.description && a.description.toLowerCase().includes(lower)) ||
        (a.template && a.template.toLowerCase().includes(lower)),
    )
  }

  // 定时任务保留真实执行顺序以便上下排序直觉一致；其他类型启用项排前
  if (props.triggerType === TriggerType.SCHEDULED) {
    return list
  }

  return list.toSorted((a, b) => {
    if (a.enabled === b.enabled) return Number(a.priority ?? Priority.NORMAL) - Number(b.priority ?? Priority.NORMAL)
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
  showToast.success(`已${enabled ? '启用' : '禁用'} ${actionsToUpdate.length} 条规则`)
}

function getActionTypeMeta(actionType: ActionType): { label: string; class: string } {
  switch (actionType) {
    case ActionType.SEND_DANMAKU:
      return { label: '发弹幕', class: 'border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10' }
    case ActionType.SEND_PRIVATE_MSG:
      return { label: '发私信', class: 'border-violet-500/40 text-violet-600 dark:text-violet-400 bg-violet-500/10' }
    case ActionType.PLAY_AUDIO:
      return { label: '音效', class: 'border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10' }
    case ActionType.PNGTUBER_EXPRESSION:
      return { label: 'PNGtuber', class: 'border-pink-500/40 text-pink-600 dark:text-pink-400 bg-pink-500/10' }
    default:
      if (VTS_ACTION_TYPES.has(actionType)) {
        return { label: 'VTS', class: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' }
      }
      return { label: '其他', class: '' }
  }
}

function getTriggerSummary(action: AutoActionItem): string {
  const cfg = action.triggerConfig
  const parts: string[] = []

  switch (action.triggerType) {
    case TriggerType.DANMAKU: {
      const kws = cfg.keywords?.filter(Boolean) ?? []
      const modeText =
        cfg.keywordMatchType === KeywordMatchType.Regex
          ? '正则'
          : cfg.keywordMatchType === KeywordMatchType.Full
            ? '完全匹配'
            : '包含'
      if (kws.length > 0) {
        const preview = kws.slice(0, 3).join('、')
        parts.push(`${modeText}: ${preview}${kws.length > 3 ? ` +${kws.length - 3}` : ''}`)
      } else {
        parts.push('未设置关键词（不会触发）')
      }
      if (cfg.blockwords?.length) parts.push(`屏蔽 ${cfg.blockwords.length} 词`)
      break
    }
    case TriggerType.GIFT: {
      if (cfg.filterMode === 'free') parts.push('过滤免费礼物')
      else if (cfg.filterMode === 'blacklist') parts.push(`黑名单 (${cfg.filterGiftNames?.length ?? 0})`)
      else if (cfg.filterMode === 'whitelist') parts.push(`白名单 (${cfg.filterGiftNames?.length ?? 0})`)
      else if (cfg.filterMode === 'value') parts.push(`≥ ¥${cfg.minValue ?? 0}`)
      else parts.push('全部礼物')
      break
    }
    case TriggerType.ENTER: {
      if (cfg.filterMode === 'guard') parts.push('仅大航海')
      else if (cfg.filterMode === 'medal') parts.push(`勋章 ≥ ${cfg.enterMedalMinLevel ?? 0} 级`)
      else if (cfg.filterMode === 'blacklist') parts.push(`排除 ${cfg.filterGiftNames?.length ?? 0} 人`)
      else if (cfg.filterMode === 'whitelist') parts.push(`仅白名单 (${cfg.filterGiftNames?.length ?? 0} 人)`)
      else parts.push('所有入场观众')
      if (cfg.preventRepeat) parts.push('防重复')
      break
    }
    case TriggerType.GUARD: {
      if (cfg.guardLevels?.length) {
        const map: Record<number, string> = { 1: '总督', 2: '提督', 3: '舰长' }
        parts.push(cfg.guardLevels.map((l) => map[l] || String(l)).join('/'))
      } else {
        parts.push('全部大航海等级')
      }
      if (cfg.preventRepeat) parts.push('防重复')
      const codeTotal = cfg.giftCodes?.reduce((sum, g) => sum + g.codes.length, 0) ?? 0
      if (codeTotal > 0) parts.push(`余码 ${codeTotal}`)
      break
    }
    case TriggerType.FOLLOW:
      parts.push(cfg.preventRepeat ? '关注即触发 · 防重复' : '关注即触发')
      break
    case TriggerType.SUPER_CHAT: {
      if (cfg.scFilterMode === 'price') {
        const min = cfg.scMinPrice ?? 0
        const max = cfg.scMaxPrice
        parts.push(max ? `¥${min} ~ ¥${max}` : `≥ ¥${min}`)
      } else {
        parts.push('全部 SC')
      }
      if (cfg.preventRepeat) parts.push('防重复')
      break
    }
    case TriggerType.SCHEDULED: {
      if (cfg.useGlobalTimer) {
        parts.push('全局定时器')
      } else {
        parts.push(`独立 每 ${cfg.intervalSeconds || 300}s`)
        parts.push(cfg.schedulingMode === 'sequential' ? '顺序行' : '随机行')
      }
      break
    }
    case TriggerType.POINT_REDEEM: {
      if (cfg.pointIncludeFree === false) parts.push('仅付费积分')
      if (cfg.pointGoodsIds?.length) parts.push(`商品ID: ${cfg.pointGoodsIds.join(',')}`)
      if (cfg.pointGoodsNameKeywords?.length) parts.push(`关键词: ${cfg.pointGoodsNameKeywords.slice(0, 2).join('、')}`)
      if (parts.length === 0) parts.push('全部积分商品')
      break
    }
  }

  if (cfg.onlyDuringLive) parts.push('仅开播')
  if (action.logicalExpression?.trim()) parts.push('含表达式')

  return parts.join(' · ')
}

function getStatusBadge(action: AutoActionItem) {
  const requiresLogin =
    action.actionType === ActionType.SEND_DANMAKU || action.actionType === ActionType.SEND_PRIVATE_MSG

  if (requiresLogin && !biliCookieStore.isCookieValid) {
    return {
      class: 'border-destructive/40 text-destructive bg-destructive/10',
      text: '需登录',
      tooltip: '发送弹幕或私信需要登录 B 站账号',
    }
  }

  if (!enabledTriggerTypes.value[action.triggerType]) {
    return {
      class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
      text: '类型禁用',
      tooltip: `所有${props.title}类型的规则已被总开关禁用`,
    }
  }

  if (!action.enabled) {
    return { class: 'border-border text-muted-foreground bg-muted/40', text: '已禁用', tooltip: '此规则已被手动禁用' }
  }

  if ([ActionType.SEND_DANMAKU, ActionType.SEND_PRIVATE_MSG].includes(action.actionType)) {
    if (!action.template || (typeof action.template === 'string' && action.template.trim() === '')) {
      return {
        class: 'border-amber-500/40 text-amber-600 bg-amber-500/10',
        text: '空模板',
        tooltip: '请设置有效的消息模板内容',
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

function duplicateAction(action: AutoActionItem) {
  const cloned = autoActionStore.duplicateAutoAction(action.id)
  if (cloned) {
    showToast.success(`已复制规则「${cloned.name}」（默认禁用，请按需启用）`)
  }
}

function deleteAction(action: AutoActionItem) {
  autoActionStore.removeAutoAction(action.id)
  showToast.success(`已删除「${action.name || '未命名规则'}」`)
}

function exportActions() {
  const actionsToExport = filteredActions.value
  if (actionsToExport.length === 0) {
    showToast.warning('没有可导出的规则')
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
  showToast.success(`已导出 ${actionsToExport.length} 条规则`)
}

const { open: openActionsImport } = useFilePicker({
  accept: '.json',
  onSelect: async ([file]) => {
    try {
      const text = await file.text()
      const imported = JSON.parse(text) as AutoActionItem[]
      if (!Array.isArray(imported)) throw new Error('无效的 JSON 数组格式')
      let count = 0
      for (const item of imported) {
        if (!item || item.triggerType !== props.triggerType) continue
        const normalized: AutoActionItem = {
          ...item,
          id: `auto-action-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          priority: Number(item.priority ?? Priority.NORMAL) as Priority,
          triggerConfig: { ...(item.triggerConfig || {}) },
          actionConfig: { ...(item.actionConfig || {}) },
        }
        autoActionStore.autoActions.push(normalized)
        count++
      }
      if (count === 0) {
        showToast.warning(`未导入任何规则：文件中没有属于「${props.title}」的配置`)
        return
      }
      autoActionStore.syncScheduledTimers()
      showToast.success(`已导入 ${count} 条规则`)
    } catch (err) {
      showToast.error(`导入失败: ${(err as Error).message}`)
    }
  },
})

function importActions() {
  openActionsImport()
}

function toggleActionEnabled(row: AutoActionItem) {
  const next = !row.enabled
  autoActionStore.toggleAutoAction(row.id, next)
  showToast.success(`已${next ? '启用' : '禁用'}: ${row.name}`)
}

function toggleActionOnlyLive(row: AutoActionItem) {
  row.triggerConfig.onlyDuringLive = !row.triggerConfig.onlyDuringLive
  showToast.success('已更新触发条件')
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="py-2.5 px-3 bg-muted/50 rounded-md border border-border flex-between gap-2.5 flex-wrap">
      <div class="flex items-center gap-3 flex-wrap">
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <Switch v-model:checked="typeEnabled" />
          <span
            class="text-xs font-semibold"
            :class="typeEnabled ? 'text-foreground' : 'text-muted-foreground'"
          >
            {{ typeEnabled ? '已启用' : '已禁用' }}{{ title }}
          </span>
        </label>

        <div
          v-if="filteredActions.length > 0"
          class="border-l border-border pl-2.5 flex items-center gap-1"
        >
          <Button
            size="xs"
            variant="ghost"
            class="gap-1"
            @click="handleBatchEnable(true)"
          >
            <CheckCircle2 class="size-3.5" />
            全启
          </Button>
          <Button
            size="xs"
            variant="ghost"
            class="gap-1"
            @click="handleBatchEnable(false)"
          >
            <XCircle class="size-3.5" />
            全禁
          </Button>
        </div>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <div class="relative w-40">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchText"
            placeholder="搜索名称/模板..."
            class="pl-8 pr-2"
          />
        </div>

        <div class="w-28">
          <Select v-model="actionTypeFilter">
            <SelectTrigger class="w-full">
              <SelectValue placeholder="动作类型" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部动作</SelectItem>
              <SelectItem :value="ActionType.SEND_DANMAKU">发送弹幕</SelectItem>
              <SelectItem :value="ActionType.SEND_PRIVATE_MSG">发送私信</SelectItem>
              <SelectItem :value="ActionType.PLAY_AUDIO">播放音效</SelectItem>
              <SelectItem :value="ActionType.PNGTUBER_EXPRESSION">PNGtuber</SelectItem>
              <SelectItem value="vts">VTS 联动</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <slot name="extra-actions" />

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="outline"
              size="icon-sm"
              title="导入 / 导出"
            >
              <MoreHorizontal class="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem @select="exportActions">导出当前分类配置</DropdownMenuItem>
            <DropdownMenuItem @select="importActions">导入配置 JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="secondary"
          class="gap-1.5 text-amber-600 dark:text-amber-400"
          @click="emit('test')"
        >
          <FlaskConical class="size-3.5" />
          批量测试
        </Button>

        <Button
          class="gap-1.5"
          @click="emit('add')"
        >
          <Plus class="size-3.5" />
          添加{{ title }}
        </Button>
      </div>
    </div>

    <slot name="header-content" />

    <div class="action-list-content flex-1 pt-3">
      <div
        v-if="filteredActions.length === 0"
        class="py-12 flex-col-center"
      >
        <Empty :description="isFiltered ? '没有符合筛选条件的规则' : `暂无${title}规则`">
          <div class="mt-3">
            <Button
              v-if="!isFiltered"
              @click="emit('add')"
            >
              创建第一条{{ title }}规则
            </Button>
            <Button
              v-else
              variant="secondary"
              @click="
                () => {
                  searchText = ''
                  actionTypeFilter = 'all'
                }
              "
            >
              重置筛选
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
              <TableHead>规则名称与触发条件</TableHead>
              <TableHead class="text-center w-24">动作</TableHead>
              <TableHead class="text-center w-24">状态</TableHead>
              <TableHead
                v-if="triggerType === TriggerType.SCHEDULED"
                class="text-center w-28"
              >
                下次触发
              </TableHead>
              <TableHead class="text-right w-48">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="row in filteredActions"
              :key="row.id"
            >
              <TableCell>
                <div class="flex flex-col gap-0.5 min-w-0">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span
                      class="font-medium text-xs text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                      @click="emit('edit', row.id)"
                    >
                      {{ row.name || '未命名规则' }}
                    </span>
                    <span
                      v-if="row.description"
                      class="text-[11px] text-muted-foreground truncate"
                    >
                      — {{ row.description }}
                    </span>
                  </div>
                  <span class="text-[11px] text-muted-foreground truncate">
                    {{ getTriggerSummary(row) }}
                  </span>
                </div>
              </TableCell>

              <TableCell class="text-center">
                <Badge
                  variant="outline"
                  size="xs"
                  :class="getActionTypeMeta(row.actionType).class"
                >
                  {{ getActionTypeMeta(row.actionType).label }}
                </Badge>
              </TableCell>

              <TableCell class="text-center">
                <DropdownMenu>
                  <DropdownMenuTrigger as-child>
                    <div class="inline-flex">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger as-child>
                            <Badge
                              variant="outline"
                              size="xs"
                              class="cursor-pointer"
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
                    <DropdownMenuItem @select="toggleActionEnabled(row)">
                      {{ row.enabled ? '禁用此规则' : '启用此规则' }}
                    </DropdownMenuItem>
                    <DropdownMenuItem @select="toggleActionOnlyLive(row)">
                      {{ row.triggerConfig.onlyDuringLive ? '取消「仅开播触发」' : '设为「仅开播触发」' }}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>

              <TableCell
                v-if="triggerType === TriggerType.SCHEDULED"
                class="text-center tabular-nums"
              >
                <template v-if="!typeEnabled || !row.enabled">-</template>
                <TimerCountdown
                  v-else
                  :action-id="row.id"
                />
              </TableCell>

              <TableCell class="text-right">
                <div class="flex items-center justify-end gap-1">
                  <!-- 上下移动排序 (仅定时，筛选时禁用防错位) -->
                  <template v-if="triggerType === TriggerType.SCHEDULED">
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="上移"
                      :disabled="isFiltered || orderedActions.findIndex((a) => a.id === row.id) === 0"
                      @click="autoActionStore.moveAction(row.id, 'up')"
                    >
                      <ArrowUp class="size-3.5" />
                    </Button>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="下移"
                      :disabled="isFiltered || orderedActions.findIndex((a) => a.id === row.id) === orderedActions.length - 1"
                      @click="autoActionStore.moveAction(row.id, 'down')"
                    >
                      <ArrowDown class="size-3.5" />
                    </Button>
                  </template>

                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="单条沙盒测试"
                    @click="emit('test-action', row)"
                  >
                    <FlaskConical class="size-3.5 text-amber-600 dark:text-amber-400" />
                  </Button>

                  <Button
                    size="xs"
                    variant="secondary"
                    class="gap-1"
                    @click="emit('edit', row.id)"
                  >
                    <Pencil class="size-3.5" />
                    编辑
                  </Button>

                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="复制规则"
                    @click="duplicateAction(row)"
                  >
                    <Copy class="size-3.5" />
                  </Button>

                  <Popconfirm
                    :title="`确定删除规则「${row.name || '未命名规则'}」吗？`"
                    @confirm="deleteAction(row)"
                  >
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      title="删除规则"
                      class="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 class="size-3.5" />
                    </Button>
                  </Popconfirm>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
