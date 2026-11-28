<script setup lang="ts">
import { format } from 'date-fns'
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CloudDownload,
  History,
  RotateCcw,
  ShieldAlert,
  Square,
  UploadCloud,
} from 'lucide-vue-next'
import { computed, reactive, ref } from 'vue'
import { toast } from 'vue-sonner'

import {
  type GuardReconcileEntry,
  type GuardReconcileResponse,
  reconcileGuardEvents,
  syncReconciledGuardEvents,
} from '@/api/guard-reconcile'
import {
  type FetchGuardStreamProgress,
  fetchAnchorGuardStream,
} from '@/apps/client/api/bili-guard-fans'
import { AVATAR_URL } from '@/shared/config'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { DateRangePicker } from '@/shared/ui/date-picker'
import { Empty } from '@/shared/ui/empty'
import { NumberField } from '@/shared/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { SimpleTooltip } from '@/shared/ui/tooltip'

const props = defineProps<{
  initialStartDate?: string
  initialEndDate?: string
}>()

const emit = defineEmits<{
  synced: [insertedCount: number]
}>()

function todayYmd(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

function defaultStartYmd(): string {
  const now = new Date()
  return format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
}

const startDate = ref(props.initialStartDate || defaultStartYmd())
const endDate = ref(props.initialEndDate || todayYmd())
const timeWindowSec = ref('120')
const activeResultTab = ref<'confirm' | 'missing' | 'matched'>('missing')

const fetching = ref(false)
const syncing = ref(false)
const progress = ref<FetchGuardStreamProgress | null>(null)
const result = ref<GuardReconcileResponse | null>(null)
let abortController: AbortController | null = null

// 主播对「疑似同一笔」条目的人工裁定：'same' 确认同一笔（跳过）| 'missing' 确为漏录（加入补录）
const confirmDecisions = reactive<Record<string, 'same' | 'missing'>>({})
// 待同步条目的勾选状态（key = streamKey）
const selectedKeys = reactive<Record<string, boolean>>({})
// 允许主播在同步前微调每条补录金额（key = streamKey）
const editablePrices = reactive<Record<string, number>>({})

const grantPoints = ref(false)
const grantRewards = ref(false)

function applyDatePreset(preset: '7d' | 'thisMonth' | 'lastMonth') {
  const now = new Date()
  if (preset === '7d') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)
    startDate.value = format(start, 'yyyy-MM-dd')
    endDate.value = format(now, 'yyyy-MM-dd')
    return
  }
  if (preset === 'lastMonth') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const end = new Date(now.getFullYear(), now.getMonth(), 0)
    startDate.value = format(start, 'yyyy-MM-dd')
    endDate.value = format(end, 'yyyy-MM-dd')
    return
  }
  startDate.value = format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd')
  endDate.value = format(now, 'yyyy-MM-dd')
}

const pendingConfirmList = computed(() =>
  (result.value?.needsConfirm ?? []).filter((entry) => !confirmDecisions[entry.streamItem.streamKey]),
)

const promotedMissingList = computed(() =>
  (result.value?.needsConfirm ?? []).filter((entry) => confirmDecisions[entry.streamItem.streamKey] === 'missing'),
)

const resolvedSameList = computed(() =>
  (result.value?.needsConfirm ?? []).filter((entry) => confirmDecisions[entry.streamItem.streamKey] === 'same'),
)

const syncableMissingList = computed<Array<GuardReconcileEntry & { fromConfirm: boolean }>>(() => {
  const direct = (result.value?.missing ?? []).map((entry) => ({ ...entry, fromConfirm: false }))
  const promoted = promotedMissingList.value.map((entry) => ({ ...entry, fromConfirm: true }))
  return [...promoted, ...direct].toSorted((a, b) => b.streamItem.time - a.streamItem.time)
})

const selectedSyncEntries = computed(() =>
  syncableMissingList.value.filter((entry) => selectedKeys[entry.streamItem.streamKey]),
)

const allMissingSelected = computed(
  () => syncableMissingList.value.length > 0 && selectedSyncEntries.value.length === syncableMissingList.value.length,
)

const totalStreamCount = computed(() => {
  if (!result.value) return 0
  return result.value.matched.length + result.value.needsConfirm.length + result.value.missing.length
})

const progressLabel = computed(() => {
  const p = progress.value
  if (!p) return '正在准备拉取...'
  const waitText = p.waitingReady ? '（B 站后台生成数据中，自动轮询等待）' : ''
  const pageText = p.totalPage > 0 ? ` 第 ${p.page}/${p.totalPage} 页` : ''
  return `拉取 ${p.monthLabel} (${p.monthIndex}/${p.monthTotal})${pageText} · 已获取 ${p.fetchedCount} 条${waitText}`
})

function resetDecisionsAndSelections(res: GuardReconcileResponse) {
  for (const key of Object.keys(confirmDecisions)) delete confirmDecisions[key]
  for (const key of Object.keys(selectedKeys)) delete selectedKeys[key]
  for (const key of Object.keys(editablePrices)) delete editablePrices[key]

  for (const entry of [...res.missing, ...res.needsConfirm]) {
    editablePrices[entry.streamItem.streamKey] = entry.streamItem.price
  }
  for (const entry of res.missing) {
    selectedKeys[entry.streamItem.streamKey] = true
  }

  if (res.needsConfirm.length > 0) {
    activeResultTab.value = 'confirm'
  } else if (res.missing.length > 0) {
    activeResultTab.value = 'missing'
  } else {
    activeResultTab.value = 'matched'
  }
}

async function runReconcile() {
  if (!startDate.value || !endDate.value) {
    toast.warning('请先选择对账日期范围')
    return
  }

  const startMs = new Date(`${startDate.value}T00:00:00+08:00`).getTime()
  const endMs = new Date(`${endDate.value}T23:59:59+08:00`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    toast.warning('开始日期不能晚于结束日期')
    return
  }

  abortController?.abort()
  abortController = new AbortController()
  fetching.value = true
  progress.value = null

  try {
    const streamItems = await fetchAnchorGuardStream({
      startDate: startDate.value,
      endDate: endDate.value,
      signal: abortController.signal,
      onProgress: (p) => {
        progress.value = p
      },
    })

    const reconcileRes = await reconcileGuardEvents({
      start: startMs,
      end: endMs,
      timeWindowSeconds: Number(timeWindowSec.value) || 120,
      items: streamItems.map((item) => ({
        streamKey: item.streamKey,
        uid: item.uid,
        uname: item.uname,
        face: item.face,
        guardLevel: item.guardLevel,
        msg: item.msg,
        time: item.time,
        num: item.num,
        price: item.price,
        hamster: item.hamster,
      })),
    })

    result.value = reconcileRes
    resetDecisionsAndSelections(reconcileRes)

    if (streamItems.length === 0) {
      toast.info('所选日期范围内 B 站主播后台无大航海流水')
    } else if (reconcileRes.missing.length === 0 && reconcileRes.needsConfirm.length === 0) {
      toast.success(`核对完成：${streamItems.length} 条大航海流水已全部记录在库`)
    } else {
      toast.success(
        `核对完成：缺失 ${reconcileRes.missing.length} 条，疑似改名待确认 ${reconcileRes.needsConfirm.length} 条`,
      )
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      toast.info('已取消拉取')
      return
    }
    toast.error('拉取或对账失败', {
      description: err instanceof Error ? err.message : String(err),
    })
  } finally {
    fetching.value = false
    progress.value = null
    abortController = null
  }
}

function cancelFetch() {
  abortController?.abort()
}

function decideConfirmItem(streamKey: string, decision: 'same' | 'missing') {
  confirmDecisions[streamKey] = decision
  if (decision === 'missing') {
    selectedKeys[streamKey] = true
  } else {
    selectedKeys[streamKey] = false
  }
}

function undoConfirmDecision(streamKey: string) {
  delete confirmDecisions[streamKey]
  selectedKeys[streamKey] = false
}

function toggleSelectAllMissing(checked: boolean) {
  for (const entry of syncableMissingList.value) {
    selectedKeys[entry.streamItem.streamKey] = checked
  }
}

async function handleSyncSelected() {
  const targets = selectedSyncEntries.value
  if (targets.length === 0 || syncing.value) return

  syncing.value = true
  try {
    const res = await syncReconciledGuardEvents({
      items: targets.map((entry) => ({
        uid: entry.streamItem.uid,
        uname: entry.streamItem.uname,
        msg: entry.streamItem.msg,
        time: entry.streamItem.time,
        num: entry.streamItem.num,
        price: editablePrices[entry.streamItem.streamKey] ?? entry.streamItem.price,
      })),
      grantPoints: grantPoints.value,
      grantRewards: grantRewards.value,
    })

    const extras: string[] = []
    if (res.skippedCount > 0) extras.push(`跳过重复 ${res.skippedCount} 条`)
    if (res.guardMembersRefreshedCount > 0) extras.push(`更新在舰 ${res.guardMembersRefreshedCount} 人`)
    if (res.pointsGrantedCount > 0) extras.push(`补发积分 ${res.pointsGrantedCount} 笔`)
    if (res.rewardsGrantedCount > 0) extras.push(`发放权益 ${res.rewardsGrantedCount} 份`)

    toast.success(`已同步 ${res.insertedCount} 条舰长事件`, {
      description: extras.length > 0 ? extras.join(' · ') : undefined,
    })

    emit('synced', res.insertedCount)
    // 重新对账刷新状态
    await runReconcile()
  } catch (err) {
    toast.error('同步舰长事件失败', {
      description: err instanceof Error ? err.message : String(err),
    })
  } finally {
    syncing.value = false
  }
}

function formatTime(ms: number): string {
  return format(ms, 'yyyy-MM-dd HH:mm:ss')
}

function formatDiff(sec: number | null): string {
  if (sec === null) return ''
  if (sec === 0) return '时间一致'
  const sign = sec > 0 ? '+' : '-'
  const abs = Math.abs(sec)
  return abs >= 60 ? `${sign}${Math.floor(abs / 60)}分${abs % 60}秒` : `${sign}${abs}秒`
}

function matchReasonLabel(reason: string): string {
  switch (reason) {
    case 'uid':
      return 'UID 一致'
    case 'auth_openid':
      return '认证账号对齐'
    case 'uname_time':
      return '昵称与时间一致'
    default:
      return '已匹配'
  }
}

function guardBadgeVariant(msg: string): 'destructive' | 'default' | 'secondary' {
  if (msg === '总督') return 'destructive'
  if (msg === '提督') return 'default'
  return 'secondary'
}
</script>

<template>
  <div class="space-y-3">
    <Card>
      <CardHeader class="p-3 border-b space-y-2.5">
        <div class="flex-between flex-wrap gap-2">
          <div>
            <CardTitle class="text-xs font-semibold flex items-center gap-1.5">
              <ArrowRightLeft class="size-3.5 text-brand" />
              主播后台大航海流水对账与补录
            </CardTitle>
            <CardDescription class="text-[11px]">
              直连 B 站主播中心收礼流水，逐笔核对站内舰长事件；若遇改名且时间相近将单独列出供手动确认
            </CardDescription>
          </div>
          <div class="flex items-center gap-1.5">
            <Button
              v-if="fetching"
              variant="destructive"
              size="xs"
              @click="cancelFetch"
            >
              <Square class="size-3 mr-1" />
              取消拉取
            </Button>
            <Button
              v-else
              size="xs"
              :disabled="syncing"
              @click="runReconcile"
            >
              <CloudDownload class="size-3.5 mr-1" />
              拉取并对账
            </Button>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <ToggleGroup type="single">
            <ToggleGroupItem
              value="7d"
              @click="applyDatePreset('7d')"
            >
              近 7 天
            </ToggleGroupItem>
            <ToggleGroupItem
              value="thisMonth"
              @click="applyDatePreset('thisMonth')"
            >
              本月
            </ToggleGroupItem>
            <ToggleGroupItem
              value="lastMonth"
              @click="applyDatePreset('lastMonth')"
            >
              上月
            </ToggleGroupItem>
          </ToggleGroup>

          <DateRangePicker
            v-model:start="startDate"
            v-model:end="endDate"
            size="sm"
          />

          <div class="flex items-center gap-1.5">
            <span class="text-[11px] text-muted-foreground shrink-0">时间容差</span>
            <Select v-model="timeWindowSec">
              <SelectTrigger class="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="60">±60 秒</SelectItem>
                <SelectItem value="120">±2 分钟</SelectItem>
                <SelectItem value="300">±5 分钟</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent class="p-3 space-y-3">
        <!-- 拉取进度 -->
        <div
          v-if="fetching"
          class="flex items-center gap-2.5 rounded-md border border-border bg-muted/20 px-3 py-3 text-xs text-muted-foreground"
        >
          <Spin size="small" />
          <span class="tabular-nums">{{ progressLabel }}</span>
        </div>

        <!-- 尚未对账的空态 -->
        <Empty
          v-else-if="!result"
          description="选择日期范围后点击「拉取并对账」，自动比对 B 站主播后台流水与站内舰长事件"
        />

        <template v-else>
          <!-- 汇总指标条 -->
          <div class="flex items-center gap-2 flex-wrap text-xs">
            <Badge
              variant="outline"
              class="tabular-nums"
            >
              B 站后台流水 {{ totalStreamCount }} 笔
            </Badge>
            <Badge
              variant="outline"
              class="tabular-nums"
            >
              站内已有 {{ result.existingCount }} 笔
            </Badge>
            <Badge
              v-if="pendingConfirmList.length > 0"
              variant="destructive"
              class="tabular-nums"
            >
              待确认（改名/时间相近） {{ pendingConfirmList.length }} 笔
            </Badge>
            <Badge
              :variant="syncableMissingList.length > 0 ? 'default' : 'secondary'"
              class="tabular-nums"
            >
              待同步缺失 {{ syncableMissingList.length }} 笔
            </Badge>
            <Badge
              variant="secondary"
              class="tabular-nums"
            >
              已匹配 {{ result.matched.length + resolvedSameList.length }} 笔
            </Badge>
          </div>

          <Alert v-if="pendingConfirmList.length > 0">
            <AlertDescription class="text-xs">
              检测到 {{ pendingConfirmList.length }} 笔时间几乎一致、等级数量相同但昵称不同的记录（通常由开放平台模式或粉丝改名引起），请先在「疑似改名待确认」中核对。
            </AlertDescription>
          </Alert>

          <Tabs
            v-model="activeResultTab"
            class="w-full"
          >
            <TabsList class="inline-flex flex-wrap h-auto gap-1">
              <TabsTrigger
                value="confirm"
                class="gap-1.5"
              >
                <ShieldAlert class="size-3.5" />
                疑似改名待确认
                <Badge
                  v-if="pendingConfirmList.length > 0"
                  variant="destructive"
                  class="px-1.5 py-0 text-[10px] tabular-nums"
                >
                  {{ pendingConfirmList.length }}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="missing"
                class="gap-1.5"
              >
                <AlertTriangle class="size-3.5" />
                确认缺失 / 待同步
                <Badge
                  v-if="syncableMissingList.length > 0"
                  variant="default"
                  class="px-1.5 py-0 text-[10px] tabular-nums"
                >
                  {{ syncableMissingList.length }}
                </Badge>
              </TabsTrigger>
              <TabsTrigger
                value="matched"
                class="gap-1.5"
              >
                <CheckCircle2 class="size-3.5" />
                已匹配
                <Badge
                  variant="secondary"
                  class="px-1.5 py-0 text-[10px] tabular-nums"
                >
                  {{ result.matched.length + resolvedSameList.length }}
                </Badge>
              </TabsTrigger>
            </TabsList>

            <!-- Tab 1: 疑似改名待确认 -->
            <TabsContent
              value="confirm"
              class="pt-3 space-y-2"
            >
              <Empty
                v-if="pendingConfirmList.length === 0"
                description="没有待人工确认的改名或时间相近记录"
              />
              <div
                v-else
                class="space-y-2 max-h-[420px] overflow-y-auto scrollbar-thin pr-0.5"
              >
                <div
                  v-for="entry in pendingConfirmList"
                  :key="entry.streamItem.streamKey"
                  class="rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5 space-y-2"
                >
                  <div class="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 items-center">
                    <!-- 左侧：B 站后台记录 -->
                    <div class="rounded-md border border-border bg-card p-2 min-w-0">
                      <div class="text-[11px] text-muted-foreground mb-1">B 站主播后台流水</div>
                      <div class="flex items-center gap-2 min-w-0">
                        <img
                          :src="entry.streamItem.face || AVATAR_URL + entry.streamItem.uid"
                          referrerpolicy="no-referrer"
                          class="size-7 rounded-full object-cover shrink-0 border border-border"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="text-xs font-medium truncate flex items-center gap-1.5">
                            <span class="truncate">{{ entry.streamItem.uname }}</span>
                            <Badge
                              :variant="guardBadgeVariant(entry.streamItem.msg)"
                              class="text-[10px] px-1 py-0 shrink-0"
                            >
                              {{ entry.streamItem.msg }} ×{{ entry.streamItem.num }}
                            </Badge>
                          </div>
                          <div class="text-[11px] text-muted-foreground tabular-nums">
                            UID {{ entry.streamItem.uid }} · {{ formatTime(entry.streamItem.time) }} · 估 ¥{{ entry.streamItem.price }}
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- 中间：差异标注 -->
                    <div class="flex flex-row md:flex-col items-center justify-center gap-1 px-1">
                      <Badge
                        variant="outline"
                        class="text-[10px] tabular-nums whitespace-nowrap"
                      >
                        {{ formatDiff(entry.timeDiffSeconds) }}
                      </Badge>
                      <span class="text-[10px] text-muted-foreground whitespace-nowrap">昵称不同</span>
                    </div>

                    <!-- 右侧：站内已有记录 -->
                    <div
                      v-if="entry.matchedEvent"
                      class="rounded-md border border-border bg-card p-2 min-w-0"
                    >
                      <div class="text-[11px] text-muted-foreground mb-1">站内已有舰长事件</div>
                      <div class="flex items-center gap-2 min-w-0">
                        <img
                          v-if="entry.matchedEvent.uface || entry.matchedEvent.uid"
                          :src="entry.matchedEvent.uid ? AVATAR_URL + entry.matchedEvent.uid : entry.matchedEvent.uface"
                          referrerpolicy="no-referrer"
                          class="size-7 rounded-full object-cover shrink-0 border border-border"
                        />
                        <div class="min-w-0 flex-1">
                          <div class="text-xs font-medium truncate flex items-center gap-1.5">
                            <span class="truncate">{{ entry.matchedEvent.uname }}</span>
                            <Badge
                              :variant="guardBadgeVariant(entry.matchedEvent.msg || '舰长')"
                              class="text-[10px] px-1 py-0 shrink-0"
                            >
                              {{ entry.matchedEvent.msg }} ×{{ entry.matchedEvent.num || 1 }}
                            </Badge>
                          </div>
                          <div class="text-[11px] text-muted-foreground tabular-nums truncate">
                            {{ entry.matchedEvent.uid ? `UID ${entry.matchedEvent.uid}` : `OpenID` }} ·
                            {{ formatTime(entry.matchedEvent.time) }} · ¥{{ entry.matchedEvent.price }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-end gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      @click="decideConfirmItem(entry.streamItem.streamKey, 'same')"
                    >
                      <CheckCircle2 class="size-3.5 mr-1" />
                      确认同一笔（跳过）
                    </Button>
                    <Button
                      size="xs"
                      @click="decideConfirmItem(entry.streamItem.streamKey, 'missing')"
                    >
                      <UploadCloud class="size-3.5 mr-1" />
                      确为漏录（加入补录）
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <!-- Tab 2: 确认缺失 / 待同步 -->
            <TabsContent
              value="missing"
              class="pt-3 space-y-3"
            >
              <Empty
                v-if="syncableMissingList.length === 0"
                description="当前没有待同步的缺失舰长记录"
              />
              <template v-else>
                <div class="flex-between flex-wrap gap-2">
                  <label class="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                    <Checkbox
                      :checked="allMissingSelected"
                      @update:checked="toggleSelectAllMissing"
                    />
                    <span>全选（已选 {{ selectedSyncEntries.length }} / {{ syncableMissingList.length }} 条）</span>
                  </label>
                  <span class="text-[11px] text-muted-foreground">
                    金额按金仓鼠收益默认折算，同步前可单条微调
                  </span>
                </div>

                <div class="space-y-1.5 max-h-[340px] overflow-y-auto scrollbar-thin pr-0.5">
                  <div
                    v-for="entry in syncableMissingList"
                    :key="entry.streamItem.streamKey"
                    class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
                  >
                    <div class="flex items-center gap-2 min-w-0 flex-1">
                      <Checkbox
                        :checked="Boolean(selectedKeys[entry.streamItem.streamKey])"
                        @update:checked="(val) => (selectedKeys[entry.streamItem.streamKey] = val)"
                      />
                      <img
                        :src="entry.streamItem.face || AVATAR_URL + entry.streamItem.uid"
                        referrerpolicy="no-referrer"
                        class="size-7 rounded-full object-cover shrink-0 border border-border"
                      />
                      <div class="min-w-0">
                        <div class="text-xs font-medium truncate flex items-center gap-1.5">
                          <span class="truncate">{{ entry.streamItem.uname }}</span>
                          <Badge
                            :variant="guardBadgeVariant(entry.streamItem.msg)"
                            class="text-[10px] px-1 py-0 shrink-0"
                          >
                            {{ entry.streamItem.msg }} ×{{ entry.streamItem.num }}
                          </Badge>
                          <Badge
                            v-if="entry.fromConfirm"
                            variant="outline"
                            class="text-[10px] px-1 py-0 shrink-0"
                          >
                            已确认漏录
                          </Badge>
                        </div>
                        <div class="text-[11px] text-muted-foreground tabular-nums">
                          UID {{ entry.streamItem.uid }} · {{ formatTime(entry.streamItem.time) }} · 金仓鼠 {{ entry.streamItem.hamster }}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-1.5 shrink-0">
                      <span class="text-[11px] text-muted-foreground">¥</span>
                      <NumberField
                        v-model="editablePrices[entry.streamItem.streamKey]"
                        :min="0"
                        :step="1"
                        :show-buttons="false"
                        class="w-20"
                      />
                      <SimpleTooltip
                        v-if="entry.fromConfirm"
                        content="撤回至待确认列表"
                      >
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="撤回至待确认列表"
                          @click="undoConfirmDecision(entry.streamItem.streamKey)"
                        >
                          <RotateCcw class="size-3.5" />
                        </Button>
                      </SimpleTooltip>
                    </div>
                  </div>
                </div>

                <!-- 同步联动开关 -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <SettingRow
                    v-model="grantPoints"
                    variant="compact"
                    type="switch"
                    title="同步补发上舰积分"
                    description="按积分设置中的舰长/提督/总督分值补发（自动幂等防重）"
                  />
                  <SettingRow
                    v-model="grantRewards"
                    variant="compact"
                    type="switch"
                    title="同步触发上舰自动发放权益"
                    description="按已启用的上舰发放规则补发商品权益（受规则频次与幂等保护）"
                  />
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <Button
                    :disabled="selectedSyncEntries.length === 0 || syncing"
                    :loading="syncing"
                    @click="handleSyncSelected"
                  >
                    <UploadCloud class="size-3.5 mr-1" />
                    同步所选 {{ selectedSyncEntries.length }} 条到舰长事件列表
                  </Button>
                </div>
              </template>
            </TabsContent>

            <!-- Tab 3: 已匹配 -->
            <TabsContent
              value="matched"
              class="pt-3 space-y-2"
            >
              <Empty
                v-if="result.matched.length === 0 && resolvedSameList.length === 0"
                description="暂无已匹配记录"
              />
              <div
                v-else
                class="space-y-1.5 max-h-[380px] overflow-y-auto scrollbar-thin pr-0.5"
              >
                <div
                  v-for="entry in resolvedSameList"
                  :key="`same_${entry.streamItem.streamKey}`"
                  class="flex-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
                >
                  <div class="min-w-0">
                    <div class="text-xs font-medium truncate flex items-center gap-1.5">
                      <span>{{ entry.streamItem.uname }}</span>
                      <Badge
                        :variant="guardBadgeVariant(entry.streamItem.msg)"
                        class="text-[10px] px-1 py-0"
                      >
                        {{ entry.streamItem.msg }} ×{{ entry.streamItem.num }}
                      </Badge>
                      <Badge
                        variant="outline"
                        class="text-[10px] px-1 py-0"
                      >
                        人工确认同一笔
                      </Badge>
                    </div>
                    <div class="text-[11px] text-muted-foreground tabular-nums">
                      UID {{ entry.streamItem.uid }} · {{ formatTime(entry.streamItem.time) }}
                      <template v-if="entry.matchedEvent">
                        · 对应站内「{{ entry.matchedEvent.uname }}」({{ formatDiff(entry.timeDiffSeconds) }})
                      </template>
                    </div>
                  </div>
                  <SimpleTooltip content="撤回确认">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="撤回确认"
                      @click="undoConfirmDecision(entry.streamItem.streamKey)"
                    >
                      <RotateCcw class="size-3.5" />
                    </Button>
                  </SimpleTooltip>
                </div>

                <div
                  v-for="entry in result.matched"
                  :key="entry.streamItem.streamKey"
                  class="flex-between gap-2 rounded-md border border-border bg-muted/10 px-2.5 py-1.5"
                >
                  <div class="min-w-0">
                    <div class="text-xs font-medium truncate flex items-center gap-1.5">
                      <span>{{ entry.streamItem.uname }}</span>
                      <Badge
                        :variant="guardBadgeVariant(entry.streamItem.msg)"
                        class="text-[10px] px-1 py-0"
                      >
                        {{ entry.streamItem.msg }} ×{{ entry.streamItem.num }}
                      </Badge>
                      <Badge
                        variant="secondary"
                        class="text-[10px] px-1 py-0"
                      >
                        {{ matchReasonLabel(entry.matchReason) }}
                      </Badge>
                    </div>
                    <div class="text-[11px] text-muted-foreground tabular-nums">
                      UID {{ entry.streamItem.uid }} · {{ formatTime(entry.streamItem.time) }} · 估 ¥{{ entry.streamItem.price }}
                      <template v-if="entry.timeDiffSeconds !== null">
                        · {{ formatDiff(entry.timeDiffSeconds) }}
                      </template>
                    </div>
                  </div>
                  <History class="size-3.5 text-muted-foreground shrink-0" />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
