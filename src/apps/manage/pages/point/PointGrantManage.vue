<script setup lang="ts">
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Gift,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
} from 'lucide-vue-next'
import { computed, onMounted, ref, watch } from 'vue'

import type { ResponsePointGoodModel } from '@/api/client-types'
import { GoodsStatus, GoodsTypes, GuardLevel } from '@/api/generated/model'
import {
  deleteGrantRule,
  fetchGrantRules,
  fetchOwnerGrants,
  GrantLimitMode,
  type GrantRuleModel,
  GuardLevelMatchMode,
  GuardQuantityMode,
  type OwnerGrantListResponse,
  type OwnerGrantRecordModel,
  retryGrant,
  revokeGrant,
  RewardGrantSource,
  RewardGrantStatus,
  saveGrantRule,
  toggleGrantRule,
} from '@/api/point-grants'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Switch } from '@/shared/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/shared/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

import PointManualGrantDialog from './PointManualGrantDialog.vue'

const props = defineProps<{
  goodsList: ResponsePointGoodModel[]
}>()

const emit = defineEmits<{
  statsChange: [stats: { unclaimed: number; failed: number }]
  goodsStockChanged: []
}>()

const rules = ref<GrantRuleModel[]>([])
const loadingRules = ref(false)

const grantsData = ref<OwnerGrantListResponse>({
  items: [],
  total: 0,
  unclaimedCount: 0,
  claimedCount: 0,
  failedCount: 0,
})
const loadingGrants = ref(false)
const statusFilter = ref<string>('all')
const sourceFilter = ref<string>('all')
const keyword = ref('')
const currentPage = ref(1)
const pageSize = 30

const showManualDialog = ref(false)
const showRuleDialog = ref(false)
const savingRule = ref(false)
const actionLoadingId = ref<number | null>(null)

interface RuleFormState {
  id?: number
  name: string
  enabled: boolean
  guardLevel: GuardLevel
  guardMatchMode: GuardLevelMatchMode
  goodsId: string
  subItemId: string
  quantityMode: GuardQuantityMode
  quantity: number
  limitMode: GrantLimitMode
  expireDays: number
  remark: string
}

const selectableGoods = computed(() =>
  props.goodsList.filter((g) => g.status !== GoodsStatus.Removed),
)

const ruleForm = ref<RuleFormState>(createEmptyRuleForm())

const formSelectedGoods = computed(() =>
  selectableGoods.value.find((g) => String(g.id) === ruleForm.value.goodsId),
)
const formSubItems = computed(() => formSelectedGoods.value?.subItems ?? [])

watch(
  () => ruleForm.value.goodsId,
  () => {
    const subs = formSubItems.value
    if (subs.length === 0) {
      ruleForm.value.subItemId = ''
    } else if (!subs.some((s) => String(s.id) === ruleForm.value.subItemId)) {
      ruleForm.value.subItemId = String(subs[0].id)
    }
  },
)

function createEmptyRuleForm(): RuleFormState {
  const firstGoods = selectableGoods.value[0]
  const firstSub = firstGoods?.subItems?.[0]
  return {
    id: undefined,
    name: '',
    enabled: true,
    guardLevel: GuardLevel.Jianzhang,
    guardMatchMode: GuardLevelMatchMode.Exact,
    goodsId: firstGoods ? String(firstGoods.id) : '',
    subItemId: firstSub ? String(firstSub.id) : '',
    quantityMode: GuardQuantityMode.Fixed,
    quantity: 1,
    limitMode: GrantLimitMode.Unlimited,
    expireDays: 30,
    remark: '',
  }
}

function openCreateRule() {
  ruleForm.value = createEmptyRuleForm()
  showRuleDialog.value = true
}

function openEditRule(rule: GrantRuleModel) {
  ruleForm.value = {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    guardLevel: rule.guardLevel,
    guardMatchMode: rule.guardMatchMode,
    goodsId: String(rule.goodsId),
    subItemId: rule.subItemId ? String(rule.subItemId) : '',
    quantityMode: rule.quantityMode,
    quantity: rule.quantity,
    limitMode: rule.limitMode,
    expireDays: rule.expireDays ?? 0,
    remark: rule.remark ?? '',
  }
  showRuleDialog.value = true
}

async function loadRules() {
  loadingRules.value = true
  try {
    rules.value = await fetchGrantRules()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取自动发放规则失败')
  } finally {
    loadingRules.value = false
  }
}

async function loadGrants(resetPage = false) {
  if (resetPage) currentPage.value = 1
  loadingGrants.value = true
  try {
    const data = await fetchOwnerGrants({
      status: statusFilter.value === 'all' ? undefined : (Number(statusFilter.value) as RewardGrantStatus),
      source: sourceFilter.value === 'all' ? undefined : (Number(sourceFilter.value) as RewardGrantSource),
      keyword: keyword.value.trim() || undefined,
      page: currentPage.value,
      pageSize,
    })
    grantsData.value = data
    emit('statsChange', { unclaimed: data.unclaimedCount, failed: data.failedCount })
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '获取发放记录失败')
  } finally {
    loadingGrants.value = false
  }
}

async function refreshAll() {
  await Promise.all([loadRules(), loadGrants()])
}

async function handleSaveRule() {
  if (!ruleForm.value.goodsId) {
    toast.error('请选择关联的积分礼物')
    return
  }
  if (formSubItems.value.length > 0 && !ruleForm.value.subItemId) {
    toast.error('该礼物包含多个款式，请选择具体发放款式')
    return
  }

  savingRule.value = true
  try {
    await saveGrantRule({
      id: ruleForm.value.id,
      name: ruleForm.value.name.trim() || undefined,
      enabled: ruleForm.value.enabled,
      guardLevel: ruleForm.value.guardLevel,
      guardMatchMode: ruleForm.value.guardMatchMode,
      goodsId: Number(ruleForm.value.goodsId),
      subItemId: formSubItems.value.length > 0 ? Number(ruleForm.value.subItemId) : null,
      quantityMode: ruleForm.value.quantityMode,
      quantity: ruleForm.value.quantity || 1,
      limitMode: ruleForm.value.limitMode,
      expireDays: ruleForm.value.expireDays > 0 ? ruleForm.value.expireDays : null,
      remark: ruleForm.value.remark.trim() || undefined,
    })
    toast.success(ruleForm.value.id ? '已更新自动发放规则' : '已创建自动发放规则')
    showRuleDialog.value = false
    await loadRules()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '保存规则失败')
  } finally {
    savingRule.value = false
  }
}

async function handleToggleRule(rule: GrantRuleModel, enabled: boolean) {
  try {
    await toggleGrantRule(rule.id, enabled)
    rule.enabled = enabled
    toast.success(enabled ? '已启用该发放规则' : '已停用该发放规则')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '切换规则状态失败')
  }
}

async function handleDeleteRule(rule: GrantRuleModel) {
  try {
    await deleteGrantRule(rule.id)
    toast.success('已删除发放规则')
    await loadRules()
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '删除规则失败')
  }
}

async function handleRevokeGrant(record: OwnerGrantRecordModel) {
  actionLoadingId.value = record.id
  try {
    await revokeGrant(record.id)
    toast.success('已撤回该发放记录并归还库存')
    await loadGrants()
    emit('goodsStockChanged')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '撤回失败')
  } finally {
    actionLoadingId.value = null
  }
}

async function handleRetryGrant(record: OwnerGrantRecordModel) {
  actionLoadingId.value = record.id
  try {
    await retryGrant(record.id)
    toast.success('已重新发放至观众待领取列表')
    await loadGrants()
    emit('goodsStockChanged')
  } catch (err) {
    toast.error(err instanceof Error ? err.message : '重试发放失败')
  } finally {
    actionLoadingId.value = null
  }
}

function handleManualGranted() {
  void loadGrants(true)
  emit('goodsStockChanged')
}

function guardLevelName(level: GuardLevel) {
  if (level === GuardLevel.Zongdu) return '总督'
  if (level === GuardLevel.Tidu) return '提督'
  if (level === GuardLevel.Jianzhang) return '舰长'
  return '未知'
}

function goodsTypeName(type: GoodsTypes) {
  if (type === GoodsTypes.Physical) return '实物'
  if (type === GoodsTypes.Service) return '服务'
  return '虚拟'
}

function limitModeText(mode: GrantLimitMode) {
  if (mode === GrantLimitMode.OncePerMonth) return '每自然月限 1 次'
  if (mode === GrantLimitMode.OnceForever) return '终生限 1 次'
  return '每次上舰都发'
}

function statusMeta(status: RewardGrantStatus) {
  switch (status) {
    case RewardGrantStatus.Unclaimed:
      return { label: '待领取', variant: 'warning' as const }
    case RewardGrantStatus.Claimed:
      return { label: '已领取', variant: 'success' as const }
    case RewardGrantStatus.Expired:
      return { label: '已过期', variant: 'secondary' as const }
    case RewardGrantStatus.Revoked:
      return { label: '已撤回', variant: 'outline' as const }
    case RewardGrantStatus.Failed:
      return { label: '发放失败', variant: 'destructive' as const }
  }
}

function formatDateTime(ts?: number | null) {
  if (!ts) return '-'
  const d = new Date(ts)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

const totalPages = computed(() => Math.max(1, Math.ceil(grantsData.value.total / pageSize)))

watch([statusFilter, sourceFilter], () => {
  void loadGrants(true)
})

onMounted(() => {
  void refreshAll()
})
</script>

<template>
  <div class="space-y-4">
    <!-- 顶部概览与操作栏 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="p-3 rounded-lg border border-border/80 bg-card flex-between">
        <div>
          <p class="text-[11px] text-muted-foreground">待观众领取</p>
          <p class="text-lg font-semibold text-foreground tabular-nums mt-0.5">{{ grantsData.unclaimedCount }}</p>
        </div>
        <div class="size-8 rounded-md bg-amber-500/10 text-amber-600 flex-center">
          <Clock class="size-4" />
        </div>
      </div>

      <div class="p-3 rounded-lg border border-border/80 bg-card flex-between">
        <div>
          <p class="text-[11px] text-muted-foreground">已领取转订单</p>
          <p class="text-lg font-semibold text-foreground tabular-nums mt-0.5">{{ grantsData.claimedCount }}</p>
        </div>
        <div class="size-8 rounded-md bg-emerald-500/10 text-emerald-600 flex-center">
          <CheckCircle2 class="size-4" />
        </div>
      </div>

      <div class="p-3 rounded-lg border border-border/80 bg-card flex-between">
        <div>
          <p class="text-[11px] text-muted-foreground">发放失败（待补发）</p>
          <p class="text-lg font-semibold text-foreground tabular-nums mt-0.5">{{ grantsData.failedCount }}</p>
        </div>
        <div class="size-8 rounded-md bg-destructive/10 text-destructive flex-center">
          <AlertCircle class="size-4" />
        </div>
      </div>
    </div>

    <!-- 区 1：上舰自动发放规则 -->
    <Card>
      <CardHeader class="py-3 px-4 flex-between flex-row space-y-0 border-b border-border/60">
        <div class="space-y-0.5">
          <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
            <Gift class="size-3.5 text-brand" />
            上舰自动发放规则
          </CardTitle>
          <p class="text-[11px] text-muted-foreground">
            观众上舰时自动按规则锁定库存并下发至其待领取列表；未认证观众认证 B 站账号后自动认领。
          </p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            @click="showManualDialog = true"
          >
            <Send class="size-3.5 mr-1" />
            手动定向发放
          </Button>
          <Button @click="openCreateRule">
            <Plus class="size-3.5 mr-1" />
            新建规则
          </Button>
        </div>
      </CardHeader>

      <CardContent class="p-4">
        <Spin :show="loadingRules">
          <Empty
            v-if="rules.length === 0"
            description="暂未配置上舰自动发放规则，可点击右上角新建规则或使用手动定向发放"
          />

          <div
            v-else
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <div
              v-for="rule in rules"
              :key="rule.id"
              class="p-3 rounded-lg border border-border/80 bg-muted/15 flex flex-col gap-2.5"
              :class="{ 'opacity-60': !rule.enabled }"
            >
              <div class="flex-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <Badge
                    variant="secondary"
                    size="xs"
                  >
                    {{ guardLevelName(rule.guardLevel) }}{{ rule.guardMatchMode === GuardLevelMatchMode.AtLeast ? '及以上' : '' }}
                  </Badge>
                  <span class="text-xs font-semibold text-foreground truncate">{{ rule.name }}</span>
                </div>
                <Switch
                  :checked="rule.enabled"
                  @update:checked="(v) => handleToggleRule(rule, Boolean(v))"
                />
              </div>

              <div class="text-xs text-muted-foreground space-y-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-foreground font-medium">
                    {{ rule.goodsName }}<template v-if="rule.subItemName"> · {{ rule.subItemName }}</template>
                  </span>
                  <Badge
                    variant="outline"
                    size="xs"
                  >
                    {{ goodsTypeName(rule.goodsType) }}
                  </Badge>
                  <Badge
                    v-if="rule.goodsStatus !== GoodsStatus.Normal"
                    variant="destructive"
                    size="xs"
                  >
                    已下架/不可用
                  </Badge>
                  <span class="text-[11px] tabular-nums">
                    库存：{{ rule.remainingStock == null ? '不限' : rule.remainingStock }}
                  </span>
                </div>

                <div class="flex items-center gap-2 flex-wrap text-[11px]">
                  <span>
                    {{
                      rule.quantityMode === GuardQuantityMode.PerMonth
                        ? `按月发放（每月 ×${rule.quantity}）`
                        : `固定发放 ×${rule.quantity}`
                    }}
                  </span>
                  <span>·</span>
                  <span>{{ limitModeText(rule.limitMode) }}</span>
                  <span>·</span>
                  <span>{{ rule.expireDays ? `${rule.expireDays} 天内有效` : '永不过期' }}</span>
                </div>

                <p
                  v-if="rule.remark"
                  class="text-[11px] truncate"
                >
                  留言：{{ rule.remark }}
                </p>
              </div>

              <div class="flex items-center justify-end gap-1.5 pt-1 border-t border-border/50">
                <Button
                  variant="ghost"
                  size="xs"
                  @click="openEditRule(rule)"
                >
                  <Edit3 class="size-3 mr-1" />
                  编辑
                </Button>
                <Popconfirm
                  title="确认删除该自动发放规则？不影响已发出的历史记录。"
                  @confirm="handleDeleteRule(rule)"
                >
                  <template #trigger>
                    <Button
                      variant="ghost"
                      size="xs"
                      class="text-destructive hover:text-destructive"
                    >
                      <Trash2 class="size-3 mr-1" />
                      删除
                    </Button>
                  </template>
                </Popconfirm>
              </div>
            </div>
          </div>
        </Spin>
      </CardContent>
    </Card>

    <!-- 区 2：发放记录 -->
    <Card>
      <CardHeader class="py-3 px-4 flex-between flex-row flex-wrap gap-2 space-y-0 border-b border-border/60">
        <CardTitle class="text-xs font-semibold">发放记录</CardTitle>

        <div class="flex items-center gap-2 flex-wrap">
          <div class="relative w-44">
            <Search class="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              v-model="keyword"
              placeholder="搜索昵称 / UID / 备注"
              class="pl-8"
              @keyup.enter="loadGrants(true)"
            />
          </div>

          <Select v-model="statusFilter">
            <SelectTrigger class="w-28">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem :value="String(RewardGrantStatus.Unclaimed)">待领取</SelectItem>
              <SelectItem :value="String(RewardGrantStatus.Claimed)">已领取</SelectItem>
              <SelectItem :value="String(RewardGrantStatus.Failed)">发放失败</SelectItem>
              <SelectItem :value="String(RewardGrantStatus.Expired)">已过期</SelectItem>
              <SelectItem :value="String(RewardGrantStatus.Revoked)">已撤回</SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="sourceFilter">
            <SelectTrigger class="w-28">
              <SelectValue placeholder="来源" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部来源</SelectItem>
              <SelectItem :value="String(RewardGrantSource.GuardAuto)">上舰自动</SelectItem>
              <SelectItem :value="String(RewardGrantSource.Manual)">手动发放</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="icon-sm"
            :disabled="loadingGrants"
            aria-label="刷新发放记录"
            @click="loadGrants()"
          >
            <RefreshCw
              class="size-3.5"
              :class="{ 'animate-spin': loadingGrants }"
            />
          </Button>
        </div>
      </CardHeader>

      <CardContent class="p-0">
        <Spin :show="loadingGrants">
          <div
            v-if="grantsData.items.length === 0"
            class="py-12"
          >
            <Empty description="暂无符合条件的发放记录" />
          </div>

          <div
            v-else
            class="overflow-x-auto"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>接收观众</TableHead>
                  <TableHead>发放礼物</TableHead>
                  <TableHead>来源</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>发放 / 过期时间</TableHead>
                  <TableHead class="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow
                  v-for="row in grantsData.items"
                  :key="row.id"
                >
                  <TableCell>
                    <div class="flex flex-col gap-0.5 min-w-32">
                      <div class="flex items-center gap-1.5">
                        <span class="text-xs font-medium text-foreground">{{ row.receiverName }}</span>
                        <SimpleTooltip
                          v-if="row.isAuthed"
                          content="已完成 B 站认证，可直接在其账号内领取"
                        >
                          <ShieldCheck class="size-3.5 text-emerald-600 shrink-0" />
                        </SimpleTooltip>
                      </div>
                      <span class="text-[11px] text-muted-foreground font-mono">
                        {{ row.uId ? `UID ${row.uId}` : '等待认证绑定' }}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <div class="flex flex-col gap-0.5 min-w-40">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="text-xs font-medium text-foreground">
                          {{ row.goodsName }}<template v-if="row.subItemName"> · {{ row.subItemName }}</template>
                        </span>
                        <Badge
                          variant="secondary"
                          size="xs"
                          class="tabular-nums"
                        >
                          ×{{ row.quantity }}
                        </Badge>
                      </div>
                      <p
                        v-if="row.remark"
                        class="text-[11px] text-muted-foreground line-clamp-1"
                      >
                        {{ row.remark }}
                      </p>
                      <p
                        v-if="row.failReason"
                        class="text-[11px] text-destructive"
                      >
                        {{ row.failReason }}
                      </p>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="outline"
                      size="xs"
                    >
                      {{ row.source === RewardGrantSource.GuardAuto ? '上舰自动' : '手动发放' }}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div class="flex flex-col gap-0.5 items-start">
                      <Badge
                        :variant="statusMeta(row.status).variant"
                        size="xs"
                      >
                        {{ statusMeta(row.status).label }}
                      </Badge>
                      <span
                        v-if="row.orderId"
                        class="text-[11px] text-muted-foreground font-mono"
                      >
                        订单 #{{ row.orderId }}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell class="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                    <div>发：{{ formatDateTime(row.createAt) }}</div>
                    <div v-if="row.claimedAt">领：{{ formatDateTime(row.claimedAt) }}</div>
                    <div v-else-if="row.expireAt">止：{{ formatDateTime(row.expireAt) }}</div>
                    <div v-else>止：永不过期</div>
                  </TableCell>

                  <TableCell class="text-right whitespace-nowrap">
                    <Popconfirm
                      v-if="row.status === RewardGrantStatus.Unclaimed"
                      title="撤回后观众将无法领取，已占用库存会自动归还，确认撤回？"
                      @confirm="handleRevokeGrant(row)"
                    >
                      <template #trigger>
                        <Button
                          variant="ghost"
                          size="xs"
                          :disabled="actionLoadingId === row.id"
                        >
                          <Undo2 class="size-3 mr-1" />
                          撤回
                        </Button>
                      </template>
                    </Popconfirm>

                    <Button
                      v-else-if="row.status === RewardGrantStatus.Failed"
                      variant="outline"
                      size="xs"
                      :disabled="actionLoadingId === row.id"
                      @click="handleRetryGrant(row)"
                    >
                      <RotateCcw class="size-3 mr-1" />
                      重试发放
                    </Button>

                    <span
                      v-else
                      class="text-[11px] text-muted-foreground"
                    >
                      —
                    </span>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          <div
            v-if="grantsData.total > pageSize"
            class="flex-between px-4 py-2.5 border-t border-border/60 text-xs text-muted-foreground"
          >
            <span class="tabular-nums">共 {{ grantsData.total }} 条记录</span>
            <div class="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                :disabled="currentPage <= 1"
                @click="(currentPage -= 1), loadGrants()"
              >
                上一页
              </Button>
              <span class="tabular-nums">{{ currentPage }} / {{ totalPages }}</span>
              <Button
                variant="outline"
                size="xs"
                :disabled="currentPage >= totalPages"
                @click="(currentPage += 1), loadGrants()"
              >
                下一页
              </Button>
            </div>
          </div>
        </Spin>
      </CardContent>
    </Card>

    <!-- 新建 / 编辑规则弹窗 -->
    <Dialog v-model:open="showRuleDialog">
      <DialogContent class="sm:max-w-lg max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle class="text-sm font-semibold">
            {{ ruleForm.id ? '编辑上舰自动发放规则' : '新建上舰自动发放规则' }}
          </DialogTitle>
          <DialogDescription class="text-xs text-muted-foreground">
            设置观众上舰后自动发放到其待领取信箱的积分礼物与多月策略。
          </DialogDescription>
        </DialogHeader>

        <div class="flex-1 min-h-0 overflow-y-auto scrollbar-thin pr-1 space-y-3.5">
          <FormField
            label="规则名称"
            description="留空将根据舰长等级和礼物名称自动生成"
          >
            <Input
              v-model="ruleForm.name"
              maxlength="120"
              placeholder="例如：月度舰长礼自动发放"
            />
          </FormField>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="触发大航海等级"
              required
            >
              <ToggleGroup
                type="single"
                class="w-full grid grid-cols-3"
                :model-value="String(ruleForm.guardLevel)"
                @update:model-value="(v) => v && (ruleForm.guardLevel = Number(v) as GuardLevel)"
              >
                <ToggleGroupItem :value="String(GuardLevel.Jianzhang)">舰长</ToggleGroupItem>
                <ToggleGroupItem :value="String(GuardLevel.Tidu)">提督</ToggleGroupItem>
                <ToggleGroupItem :value="String(GuardLevel.Zongdu)">总督</ToggleGroupItem>
              </ToggleGroup>
            </FormField>

            <FormField
              label="等级匹配方式"
              required
            >
              <ToggleGroup
                type="single"
                class="w-full grid grid-cols-2"
                :model-value="String(ruleForm.guardMatchMode)"
                @update:model-value="(v) => v !== undefined && (ruleForm.guardMatchMode = Number(v) as GuardLevelMatchMode)"
              >
                <ToggleGroupItem :value="String(GuardLevelMatchMode.Exact)">仅该等级</ToggleGroupItem>
                <ToggleGroupItem :value="String(GuardLevelMatchMode.AtLeast)">该等级及以上</ToggleGroupItem>
              </ToggleGroup>
            </FormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="关联积分礼物"
              required
            >
              <Select v-model="ruleForm.goodsId">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择积分礼物" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="item in selectableGoods"
                    :key="item.id"
                    :value="String(item.id)"
                  >
                    [{{ goodsTypeName(item.type) }}] {{ item.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              v-if="formSubItems.length > 0"
              label="发放款式"
              required
            >
              <Select v-model="ruleForm.subItemId">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择款式" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="sub in formSubItems"
                    :key="sub.id"
                    :value="String(sub.id)"
                  >
                    {{ sub.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              label="多月连开发放策略"
              description="当观众一次开通多月大航海时的发放份数规则"
            >
              <ToggleGroup
                type="single"
                class="w-full grid grid-cols-2"
                :model-value="String(ruleForm.quantityMode)"
                @update:model-value="(v) => v !== undefined && (ruleForm.quantityMode = Number(v) as GuardQuantityMode)"
              >
                <ToggleGroupItem :value="String(GuardQuantityMode.Fixed)">按次固定发</ToggleGroupItem>
                <ToggleGroupItem :value="String(GuardQuantityMode.PerMonth)">按月数翻倍</ToggleGroupItem>
              </ToggleGroup>
            </FormField>

            <FormField
              :label="ruleForm.quantityMode === GuardQuantityMode.PerMonth ? '每月发放份数' : '单次发放份数'"
              required
            >
              <NumberField
                :model-value="ruleForm.quantity"
                :min="1"
                :max="99"
                @update:model-value="ruleForm.quantity = $event ?? 1"
              />
            </FormField>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="同一观众限领频次">
              <ToggleGroup
                type="single"
                class="w-full grid grid-cols-3"
                :model-value="String(ruleForm.limitMode)"
                @update:model-value="(v) => v !== undefined && (ruleForm.limitMode = Number(v) as GrantLimitMode)"
              >
                <ToggleGroupItem :value="String(GrantLimitMode.Unlimited)">每次都发</ToggleGroupItem>
                <ToggleGroupItem :value="String(GrantLimitMode.OncePerMonth)">每月 1 次</ToggleGroupItem>
                <ToggleGroupItem :value="String(GrantLimitMode.OnceForever)">终生 1 次</ToggleGroupItem>
              </ToggleGroup>
            </FormField>

            <FormField
              label="领取有效期 (天)"
              description="填 0 为永不过期，超时未领自动退还库存"
            >
              <NumberField
                :model-value="ruleForm.expireDays"
                :min="0"
                :max="3650"
                @update:model-value="ruleForm.expireDays = $event ?? 0"
              />
            </FormField>
          </div>

          <FormField label="附带留言（可选）">
            <Input
              v-model="ruleForm.remark"
              maxlength="300"
              placeholder="留空默认提示「开通 X 个月舰长自动发放」"
            />
          </FormField>

          <SettingRow
            v-model="ruleForm.enabled"
            type="switch"
            variant="compact"
            title="保存后立即启用规则"
          />
        </div>

        <DialogFooter class="pt-2 border-t border-border/60">
          <Button
            variant="outline"
            @click="showRuleDialog = false"
          >
            取消
          </Button>
          <Button
            :disabled="savingRule || !ruleForm.goodsId"
            @click="handleSaveRule"
          >
            {{ savingRule ? '保存中...' : '保存规则' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- 手动定向发放弹窗 -->
    <PointManualGrantDialog
      v-model:open="showManualDialog"
      :goods-list="goodsList"
      @granted="handleManualGranted"
    />
  </div>
</template>
