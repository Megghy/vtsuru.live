<script setup lang="ts">
import Add24Filled from '@vicons/fluent/es/Add24Filled'
import ArrowReset24Regular from '@vicons/fluent/es/ArrowReset24Regular'
import Delete24Regular from '@vicons/fluent/es/Delete24Regular'
import Info24Filled from '@vicons/fluent/es/Info24Filled'
import Save24Regular from '@vicons/fluent/es/Save24Regular'
import Search24Regular from '@vicons/fluent/es/Search24Regular'
import { computed, onMounted, ref, watch } from 'vue'

import { SaveEnableFunctions, SaveSetting, useAccount } from '@/api/account'
import type { SettingPoint } from '@/api/generated/model'
import { EventDataTypes, FunctionTypes, GiftPointType } from '@/api/generated/model'
import { getApiOrgOrgIdPointsSettingsDetail, postApiOrgOrgIdPointsSettingsUpdate } from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
import { Alert, AlertDescription } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { Separator } from '@/shared/ui/separator'
import { SettingRow } from '@/shared/ui/setting-row'
import { Spin } from '@/shared/ui/spin'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

const props = defineProps<{
  orgId?: number
  streamerId?: number | null
  sourceAnchorId?: string
}>()

const accountInfo = useAccount()

function createDefaultSettingPoint(): SettingPoint {
  return {
    allowType: [EventDataTypes.Guard],
    jianzhangPoint: 10,
    tiduPoint: 100,
    zongduPoint: 1000,
    giftPercentMap: {},
    scPointPercent: 0.1,
    giftPointPercent: 0.1,
    giftAllowType: GiftPointType.All,
    enableCheckIn: false,
    checkInKeyword: '签到',
    givePointsForCheckIn: false,
    baseCheckInPoints: 10,
    enableConsecutiveBonus: false,
    bonusPointsPerDay: 2,
    maxBonusPoints: 0,
    allowSelfCheckIn: false,
    requireAuth: false,
    shouldDiscontinueWhenSoldOut: false,
    enableDailyFirstDanmaku: false,
    dailyFirstDanmakuPoints: 5,
    enableDailyFirstGift: false,
    dailyFirstGiftPoints: 10,
    useDailyFirstGiftPercent: false,
    dailyFirstGiftPercent: 0.1,
    dailyFirstOnlyOnStreaming: false,
    checkInOnlyOnStreaming: false,
    seasonName: null,
    nextResetAt: null,
    defaultCarryOverRate: 0.2,
  }
}

function normalizeSettingPoint(raw?: Partial<SettingPoint> | null): SettingPoint {
  const base = createDefaultSettingPoint()
  return {
    ...base,
    ...raw,
    allowType: [...(raw?.allowType ?? base.allowType)],
    giftPercentMap: { ...raw?.giftPercentMap },
  }
}

const isInitialLoading = ref(false)
const isSaving = ref(false)
const draft = ref<SettingPoint>(createDefaultSettingPoint())
const receiveOrderEmailDraft = ref(false)
const savedSnapshot = ref('')

function buildSnapshot(point: SettingPoint, receiveOrderEmail: boolean) {
  return JSON.stringify({ point, receiveOrderEmail })
}

function syncDraftFromSource(sourcePoint?: Partial<SettingPoint> | null, receiveOrderEmail?: boolean) {
  const normalized = normalizeSettingPoint(sourcePoint)
  const emailFlag = Boolean(receiveOrderEmail)
  draft.value = normalized
  receiveOrderEmailDraft.value = emailFlag
  savedSnapshot.value = buildSnapshot(normalized, emailFlag)
}

const isDirty = computed(() => {
  if (!savedSnapshot.value) return false
  return buildSnapshot(draft.value, receiveOrderEmailDraft.value) !== savedSnapshot.value
})

useUnsavedChangesGuard(() => !props.orgId && isDirty.value, '积分规则有未保存的更改，离开后将会丢失，确定要离开吗？')

const canEdit = computed(() => {
  if (props.orgId) return Boolean(props.streamerId)
  return Boolean(accountInfo.value?.settings)
})

async function loadOrgSetting() {
  if (!props.orgId || !props.streamerId) return
  isInitialLoading.value = true
  try {
    const detail = unwrapOk(
      (await getApiOrgOrgIdPointsSettingsDetail(props.orgId, {
        streamerId: props.streamerId,
      })) as any,
      '加载积分规则失败',
    ) as SettingPoint
    syncDraftFromSource(detail, false)
  } catch (err) {
    toast.error(err instanceof Error ? err.message : `加载失败: ${err}`)
  } finally {
    isInitialLoading.value = false
  }
}

function initOwnerDraft() {
  if (props.orgId || !accountInfo.value) return
  syncDraftFromSource(accountInfo.value.settings.point, accountInfo.value.settings.sendEmail?.receiveOrder ?? false)
}

onMounted(() => {
  if (props.orgId) {
    void loadOrgSetting()
  } else {
    initOwnerDraft()
  }
})

watch(
  () => [props.orgId, props.streamerId] as const,
  () => {
    if (props.orgId) {
      void loadOrgSetting()
    }
  },
)

watch(
  () => accountInfo.value?.id,
  () => {
    if (!props.orgId && !isDirty.value) {
      initOwnerDraft()
    }
  },
)

function resetDraft() {
  if (!savedSnapshot.value) return
  const parsed = JSON.parse(savedSnapshot.value) as { point: SettingPoint; receiveOrderEmail: boolean }
  draft.value = normalizeSettingPoint(parsed.point)
  receiveOrderEmailDraft.value = parsed.receiveOrderEmail
}

async function saveAllSettings() {
  if (!canEdit.value) return false
  const payload = normalizeSettingPoint(draft.value)

  if (props.orgId) {
    if (!props.streamerId) {
      toast.warning('请先选择主播')
      return false
    }
    isSaving.value = true
    try {
      unwrapOk(
        (await postApiOrgOrgIdPointsSettingsUpdate(props.orgId, payload as any, {
          streamerId: props.streamerId,
        })) as any,
        '保存失败',
      )
      syncDraftFromSource(payload, false)
      toast.success('积分规则已保存')
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `保存失败: ${err}`)
      return false
    } finally {
      isSaving.value = false
    }
  }

  if (!accountInfo.value) return false
  isSaving.value = true
  try {
    const savedObj = JSON.parse(savedSnapshot.value || '{}') as { point?: SettingPoint; receiveOrderEmail?: boolean }
    const pointChanged = JSON.stringify(payload) !== JSON.stringify(savedObj.point)
    const emailChanged = receiveOrderEmailDraft.value !== savedObj.receiveOrderEmail

    if (pointChanged) {
      await SaveSetting('Point', payload)
      accountInfo.value.settings.point = payload
    }
    if (emailChanged) {
      const nextSendEmail = {
        ...accountInfo.value.settings.sendEmail,
        receiveOrder: receiveOrderEmailDraft.value,
      }
      await SaveSetting('SendEmail', nextSendEmail)
      accountInfo.value.settings.sendEmail = nextSendEmail
    }
    syncDraftFromSource(payload, receiveOrderEmailDraft.value)
    toast.success('积分规则已保存')
    return true
  } catch (err) {
    toast.error(`保存失败: ${err instanceof Error ? err.message : String(err)}`)
    return false
  } finally {
    isSaving.value = false
  }
}

function toggleAllowType(type: EventDataTypes, checked: boolean) {
  const set = new Set(draft.value.allowType)
  if (checked) set.add(type)
  else set.delete(type)
  draft.value.allowType = Array.from(set)
}

// 签到连续奖励预览 (与后端 PointSystem.Operations.cs CalculateCheckInPoints 对齐)
function calcCheckInPoints(day: number) {
  const base = Number(draft.value.baseCheckInPoints ?? 0)
  if (!draft.value.enableConsecutiveBonus || day <= 1) return base
  const perDay = Number(draft.value.bonusPointsPerDay ?? 0)
  const cap = Number(draft.value.maxBonusPoints ?? 0)
  const bonus = Math.min(perDay * (day - 1), cap)
  return base + bonus
}

// 自定义礼物列表检索与增删
const giftSearchKeyword = ref('')
const showAddGiftModal = ref(false)
const addGiftModel = ref<{ name: string; point: number; nameError: string; pointError: string }>({
  name: '',
  point: 1,
  nameError: '',
  pointError: '',
})

const customGiftEntries = computed(() => {
  const keyword = giftSearchKeyword.value.trim().toLowerCase()
  const entries = Object.entries(draft.value.giftPercentMap ?? {})
  if (!keyword) return entries
  return entries.filter(([name]) => name.toLowerCase().includes(keyword))
})

async function addGift() {
  addGiftModel.value.nameError = ''
  addGiftModel.value.pointError = ''
  const trimmedName = addGiftModel.value.name.trim()

  if (!trimmedName) {
    addGiftModel.value.nameError = '请输入礼物名称'
    return
  }
  if (draft.value.giftPercentMap[trimmedName] !== undefined) {
    addGiftModel.value.nameError = '此礼物名称已存在'
    return
  }
  if (!addGiftModel.value.point || addGiftModel.value.point <= 0) {
    addGiftModel.value.pointError = '积分必须大于 0'
    return
  }

  draft.value.giftPercentMap[trimmedName] = addGiftModel.value.point
  const ok = await saveAllSettings()
  if (ok) {
    addGiftModel.value = { name: '', point: 1, nameError: '', pointError: '' }
    showAddGiftModal.value = false
  } else {
    delete draft.value.giftPercentMap[trimmedName]
  }
}

async function deleteGift(name: string) {
  const backup = draft.value.giftPercentMap[name]
  delete draft.value.giftPercentMap[name]
  const ok = await saveAllSettings()
  if (!ok) {
    draft.value.giftPercentMap[name] = backup
  }
}

function handleAddGiftKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !isSaving.value) {
    void addGift()
  }
}

const isCheckInRankingPublic = computed(() =>
  Boolean(accountInfo.value?.settings?.enableFunctions?.includes(FunctionTypes.CheckInRanking)),
)
const isSavingPublicRanking = ref(false)

async function toggleCheckInRankingPublic(enabled: boolean) {
  if (!accountInfo.value?.settings || props.orgId || isSavingPublicRanking.value) return
  isSavingPublicRanking.value = true
  try {
    const current = accountInfo.value.settings.enableFunctions ?? []
    const next = enabled
      ? Array.from(new Set([...current, FunctionTypes.CheckInRanking]))
      : current.filter((f) => f !== FunctionTypes.CheckInRanking)
    const res = await SaveEnableFunctions(next)
    if (res.code !== 200) {
      toast.error(res.message || '切换失败')
      return
    }
    accountInfo.value.settings.enableFunctions = next
    toast.success(enabled ? '已开启公开签到排行榜' : '已关闭公开签到排行榜')
  } catch (err) {
    toast.error(`切换失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    isSavingPublicRanking.value = false
  }
}

const defaultCarryOverPercent = computed({
  get: () => Math.round((draft.value.defaultCarryOverRate ?? 0.2) * 100),
  set: (v: number) => {
    const clamped = Math.max(0, Math.min(100, Number(v || 0)))
    draft.value.defaultCarryOverRate = Number((clamped / 100).toFixed(4))
  },
})

const nextSeasonDateInput = computed({
  get: () => {
    const ts = draft.value.nextResetAt
    if (!ts || ts <= 0) return ''
    const d = new Date(ts)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  },
  set: (v: string) => {
    draft.value.nextResetAt = v ? new Date(`${v}T00:00:00`).getTime() : null
  },
})
</script>

<template>
  <TooltipProvider>
    <div class="space-y-4">
      <div
        v-if="isInitialLoading"
        class="py-16 flex-center"
      >
        <Spin />
      </div>

      <template v-else>
        <!-- 粘性未保存提示栏 -->
        <div
          v-if="isDirty"
          class="sticky top-2 z-20 flex-between gap-3 flex-wrap rounded-lg border border-amber-500/40 bg-background/95 backdrop-blur-md px-3.5 py-2.5 shadow-sm"
        >
          <div class="flex items-center gap-2 text-xs">
            <span class="size-2 rounded-full bg-amber-500 shrink-0" />
            <span class="font-medium text-foreground">积分规则有未保存的更改</span>
            <span class="text-muted-foreground hidden sm:inline">积分计算结果最多保留两位小数，四舍五入</span>
          </div>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              :disabled="isSaving"
              @click="resetDraft"
            >
              <ArrowReset24Regular class="size-3.5 mr-1" />
              还原更改
            </Button>
            <Button
              :loading="isSaving"
              :disabled="!canEdit"
              @click="saveAllSettings"
            >
              <Save24Regular class="size-3.5 mr-1" />
              保存设置
            </Button>
          </div>
        </div>

        <Alert
          v-else
          size="sm"
          class="bg-muted/40 border-border/80"
        >
          <AlertDescription class="text-muted-foreground">
            所有规则修改后统一点击「保存设置」生效；积分计算最多保留两位小数（四舍五入）。
          </AlertDescription>
        </Alert>

        <!-- 通用与兑换限制 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">通用与兑换设置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-1 space-y-2">
            <SettingRow
              v-if="!orgId"
              type="switch"
              variant="card"
              title="新兑换邮件提醒"
              description="当有观众成功兑换积分礼物时发送邮件通知"
              :disabled="!canEdit"
              v-model="receiveOrderEmailDraft"
            />
            <SettingRow
              type="switch"
              variant="card"
              title="礼物售罄自动下架"
              description="库存（含全部款式库存）归零后自动将礼物设为已下架"
              :disabled="!canEdit"
              v-model="draft.shouldDiscontinueWhenSoldOut"
            />
            <SettingRow
              type="switch"
              variant="card"
              title="仅允许已认证用户签到"
              description="开启后观众需先完成 B站账号认证，弹幕签到才会生效"
              :disabled="!canEdit"
              v-model="draft.requireAuth"
            />
          </CardContent>
        </Card>

        <!-- 积分来源与倍率 -->
        <Card :id="props.sourceAnchorId">
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle class="text-xs font-semibold">积分来源与转换倍率</CardTitle>
            <div class="flex items-center gap-3 text-xs">
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  :checked="draft.allowType.includes(EventDataTypes.Guard)"
                  :disabled="!canEdit"
                  @update:checked="toggleAllowType(EventDataTypes.Guard, $event)"
                />
                <span>上舰</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  :checked="draft.allowType.includes(EventDataTypes.SC)"
                  :disabled="!canEdit"
                  @update:checked="toggleAllowType(EventDataTypes.SC, $event)"
                />
                <span>Superchat</span>
              </label>
              <label class="flex items-center gap-1.5 cursor-pointer">
                <Checkbox
                  :checked="draft.allowType.includes(EventDataTypes.Gift)"
                  :disabled="!canEdit"
                  @update:checked="toggleAllowType(EventDataTypes.Gift, $event)"
                />
                <span>礼物</span>
              </label>
            </div>
          </CardHeader>

          <CardContent class="p-3.5 pt-2 space-y-4 text-xs">
            <Empty
              v-if="draft.allowType.length === 0"
              description="当前未勾选任何付费事件来源，仅可通过签到、每日首互动或手动发放获取积分"
              class="py-4"
            />

            <!-- 上舰积分配置 -->
            <div
              v-if="draft.allowType.includes(EventDataTypes.Guard)"
              class="space-y-2 rounded-lg border border-border/70 p-3 bg-muted/20"
            >
              <span class="font-medium text-foreground block">上舰固定积分</span>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div class="flex items-center gap-2 p-2 rounded-md border border-border/70 bg-background">
                  <span class="text-muted-foreground w-10 shrink-0">舰长</span>
                  <NumberField
                    v-model="draft.jianzhangPoint"
                    :disabled="!canEdit"
                    :min="0"
                    class="flex-1"
                  />
                </div>
                <div class="flex items-center gap-2 p-2 rounded-md border border-border/70 bg-background">
                  <span class="text-muted-foreground w-10 shrink-0">提督</span>
                  <NumberField
                    v-model="draft.tiduPoint"
                    :disabled="!canEdit"
                    :min="0"
                    class="flex-1"
                  />
                </div>
                <div class="flex items-center gap-2 p-2 rounded-md border border-border/70 bg-background">
                  <span class="text-muted-foreground w-10 shrink-0">总督</span>
                  <NumberField
                    v-model="draft.zongduPoint"
                    :disabled="!canEdit"
                    :min="0"
                    class="flex-1"
                  />
                </div>
              </div>
            </div>

            <!-- SC 积分配置 -->
            <SettingRow
              v-if="draft.allowType.includes(EventDataTypes.SC)"
              type="number"
              variant="card"
              title="Superchat 转换倍率"
              :description="`例：30 元 SC 可获得 ${Number((30 * (draft.scPointPercent ?? 0)).toFixed(2))} 积分`"
              hint="将 SC 金额按指定比例转换为积分（0 ~ 1）"
              :min="0"
              :max="1"
              :step="0.01"
              :disabled="!canEdit"
              control-class="w-28"
              v-model="draft.scPointPercent"
            />

            <!-- 礼物积分配置 -->
            <div
              v-if="draft.allowType.includes(EventDataTypes.Gift)"
              class="space-y-3 rounded-lg border border-border/70 p-3 bg-muted/20"
            >
              <div class="flex-between flex-wrap gap-2">
                <span class="font-medium text-foreground">礼物积分策略</span>
                <ToggleGroup
                  type="single"
                  :model-value="String(draft.giftAllowType)"
                  @update:model-value="(val) => val && (draft.giftAllowType = Number(val) as GiftPointType)"
                >
                  <ToggleGroupItem :value="String(GiftPointType.All)">包含所有礼物</ToggleGroupItem>
                  <ToggleGroupItem :value="String(GiftPointType.WhiteList)">仅自定义白名单</ToggleGroupItem>
                </ToggleGroup>
              </div>

              <SettingRow
                v-if="draft.giftAllowType === GiftPointType.All"
                type="number"
                variant="compact"
                title="默认礼物转换倍率"
                :description="`未命中下方自定义列表的付费礼物按此比例计算（10 元礼物得 ${Number((10 * (draft.giftPointPercent ?? 0)).toFixed(2))} 分）`"
                :min="0"
                :max="1"
                :step="0.01"
                :disabled="!canEdit"
                control-class="w-28"
                v-model="draft.giftPointPercent"
              />

              <Separator />

              <!-- 自定义礼物列表 -->
              <div class="space-y-2.5">
                <div class="flex-between flex-wrap gap-2">
                  <div class="flex items-center gap-1.5 font-medium text-foreground">
                    <span>自定义礼物固定积分</span>
                    <Badge
                      v-if="Object.keys(draft.giftPercentMap).length > 0"
                      variant="secondary"
                      size="xs"
                    >
                      {{ Object.keys(draft.giftPercentMap).length }}
                    </Badge>
                  </div>

                  <div class="flex items-center gap-2">
                    <div
                      v-if="Object.keys(draft.giftPercentMap).length > 5"
                      class="relative w-44"
                    >
                      <Search24Regular class="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
                      <Input
                        v-model="giftSearchKeyword"
                        placeholder="筛选礼物名称"
                        class="pl-8"
                      />
                    </div>
                    <Button
                      variant="outline"
                      :disabled="!canEdit"
                      @click="showAddGiftModal = true"
                    >
                      <Add24Filled class="size-3.5 mr-1" />
                      添加礼物
                    </Button>
                  </div>
                </div>

                <Empty
                  v-if="customGiftEntries.length === 0"
                  :description="giftSearchKeyword ? '没有匹配的自定义礼物' : '暂无自定义礼物'"
                  class="py-5"
                />

                <div
                  v-else
                  class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                >
                  <SettingRow
                    v-for="[giftName] in customGiftEntries"
                    :key="giftName"
                    :title="giftName"
                    :description="`固定 ${draft.giftPercentMap[giftName]} 积分`"
                    class="bg-background"
                  >
                    <div class="flex items-center gap-1.5 shrink-0">
                      <NumberField
                        :model-value="draft.giftPercentMap[giftName]"
                        :disabled="!canEdit"
                        :min="0"
                        class="w-20"
                        @update:model-value="(v) => (draft.giftPercentMap[giftName] = v ?? 0)"
                      />
                      <Popconfirm
                        title="确定要删除这个礼物配置吗?"
                        positive-text="删除"
                        negative-text="取消"
                        @positive-click="deleteGift(giftName)"
                      >
                        <template #trigger>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            class="text-destructive hover:bg-destructive/10"
                            :disabled="!canEdit || isSaving"
                          >
                            <Delete24Regular class="size-3.5" />
                          </Button>
                        </template>
                        确定要删除「{{ giftName }}」的积分配置吗?
                      </Popconfirm>
                    </div>
                  </SettingRow>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 签到配置 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">弹幕签到配置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-1 space-y-2.5 text-xs">
            <SettingRow
              type="switch"
              variant="card"
              title="启用签到功能"
              description="观众在直播间发送指定关键词即可完成每日签到"
              :disabled="!canEdit"
              v-model="draft.enableCheckIn"
            />

            <template v-if="draft.enableCheckIn">
              <div class="rounded-lg border border-border/70 p-3 bg-muted/20 space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  <FormField
                    label="签到关键词"
                    v-model="draft.checkInKeyword"
                    placeholder="默认: 签到"
                    :disabled="!canEdit"
                  />
                  <div class="flex items-center gap-4 flex-wrap pt-4 sm:pt-5">
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        v-model:checked="draft.checkInOnlyOnStreaming"
                        :disabled="!canEdit"
                      />
                      <span>仅开播时允许签到</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        v-model:checked="draft.allowSelfCheckIn"
                        :disabled="!canEdit"
                      />
                      <span>允许主播自己签到</span>
                    </label>
                  </div>
                </div>

                <Separator />

                <SettingRow
                  type="switch"
                  variant="none"
                  title="签到奖励积分"
                  description="开启后观众签到时自动发放积分"
                  :disabled="!canEdit"
                  v-model="draft.givePointsForCheckIn"
                />

                <div
                  v-if="draft.givePointsForCheckIn"
                  class="space-y-3 pt-1"
                >
                  <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField label="基础积分">
                      <NumberField
                        v-model="draft.baseCheckInPoints"
                        :disabled="!canEdit"
                        :min="0"
                      />
                    </FormField>
                    <FormField
                      v-if="draft.enableConsecutiveBonus"
                      label="每日递增"
                    >
                      <NumberField
                        v-model="draft.bonusPointsPerDay"
                        :disabled="!canEdit"
                        :min="0"
                      />
                    </FormField>
                    <FormField
                      v-if="draft.enableConsecutiveBonus"
                      label="额外奖励封顶"
                    >
                      <NumberField
                        v-model="draft.maxBonusPoints"
                        :disabled="!canEdit"
                        :min="0"
                      />
                    </FormField>
                  </div>

                  <div class="flex-between flex-wrap gap-2">
                    <label class="flex items-center gap-1.5 cursor-pointer">
                      <Checkbox
                        v-model:checked="draft.enableConsecutiveBonus"
                        :disabled="!canEdit"
                      />
                      <span>启用连续签到递增奖励</span>
                    </label>

                    <div class="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                      <span>预览:</span>
                      <Badge
                        variant="outline"
                        size="xs"
                      >
                        D1 {{ calcCheckInPoints(1) }}
                      </Badge>
                      <Badge
                        variant="outline"
                        size="xs"
                      >
                        D3 {{ calcCheckInPoints(3) }}
                      </Badge>
                      <Badge
                        variant="outline"
                        size="xs"
                      >
                        D7 {{ calcCheckInPoints(7) }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <SettingRow
              v-if="!orgId"
              type="switch"
              variant="card"
              title="公开签到排行榜"
              description="开启后观众可在展示页查看今日及连续签到排行榜"
              :model-value="isCheckInRankingPublic"
              @update:model-value="toggleCheckInRankingPublic"
            />
          </CardContent>
        </Card>

        <!-- 赛季与结转规则 -->
        <Card v-if="!orgId">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">赛季周期与积分结转</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-1 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <FormField
              label="当前赛季名称"
              extra="将在结算日志与提示中展示"
            >
              <Input
                :model-value="draft.seasonName ?? ''"
                placeholder="例如: 2026 S1"
                maxlength="64"
                :disabled="!canEdit"
                @update:model-value="draft.seasonName = $event ? String($event) : null"
              />
            </FormField>

            <FormField
              label="默认结转比例 (%)"
              extra="赛季结算时默认保留的积分百分比"
            >
              <NumberField
                v-model="defaultCarryOverPercent"
                :min="0"
                :max="100"
                :disabled="!canEdit"
              />
            </FormField>

            <FormField
              label="计划结算日期"
              extra="可选，仅作计划提醒与展示"
            >
              <Input
                v-model="nextSeasonDateInput"
                type="date"
                :disabled="!canEdit"
              />
            </FormField>
          </CardContent>
        </Card>

        <!-- 跨模块积分消费联动场景 -->
        <Card v-if="!orgId">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">积分消费与跨模块联动</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div class="rounded-lg border border-border/70 p-3 bg-muted/20 flex flex-col justify-between gap-2">
              <div>
                <div class="font-semibold text-foreground">点歌消耗与插队</div>
                <p class="text-[11px] text-muted-foreground mt-0.5 mb-0">
                  支持弹幕点歌扣积分及消费积分插队优先演唱（PointPriorityCost）。
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                as="a"
                href="/manage/music-request"
              >
                前往点歌设置
              </Button>
            </div>

            <div class="rounded-lg border border-border/70 p-3 bg-muted/20 flex flex-col justify-between gap-2">
              <div>
                <div class="font-semibold text-foreground">排队入列与插队</div>
                <p class="text-[11px] text-muted-foreground mt-0.5 mb-0">配置观众消耗积分加入互动队列或优先插队。</p>
              </div>
              <Button
                variant="outline"
                size="xs"
                as="a"
                href="/manage/queue"
              >
                前往排队设置
              </Button>
            </div>

            <div class="rounded-lg border border-border/70 p-3 bg-muted/20 flex flex-col justify-between gap-2">
              <div>
                <div class="font-semibold text-foreground">弹幕抽奖积分报名</div>
                <p class="text-[11px] text-muted-foreground mt-0.5 mb-0">
                  可在直播抽奖中设置弹幕参与扣除指定积分，提高奖池含金量。
                </p>
              </div>
              <Button
                variant="outline"
                size="xs"
                as="a"
                href="/manage/lottery"
              >
                前往抽奖配置
              </Button>
            </div>

            <div class="rounded-lg border border-border/70 p-3 bg-muted/20 flex flex-col justify-between gap-2">
              <div>
                <div class="font-semibold text-foreground">兑换播报与客户端联动</div>
                <p class="text-[11px] text-muted-foreground mt-0.5 mb-0">
                  观众兑换任意礼物后会自动广播实时兑换事件，可在桌面客户端「自动操作」配置语音播报或按键触发。
                </p>
              </div>
              <Badge
                variant="secondary"
                size="xs"
                class="w-fit"
              >
                事件已内置启用
              </Badge>
            </div>
          </CardContent>
        </Card>

        <!-- 每日首次互动奖励 -->
        <Card>
          <CardHeader class="p-3.5 pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle class="text-xs font-semibold">每日首次互动奖励</CardTitle>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox
                v-model:checked="draft.dailyFirstOnlyOnStreaming"
                :disabled="!canEdit"
              />
              <span>仅开播时生效</span>
            </label>
          </CardHeader>
          <CardContent class="p-3.5 pt-1 space-y-2.5 text-xs">
            <SettingRow
              type="switch"
              variant="card"
              title="每日首次弹幕奖励"
              description="每位观众每天首次发送弹幕给予固定积分"
              :disabled="!canEdit"
              v-model="draft.enableDailyFirstDanmaku"
            />
            <div
              v-if="draft.enableDailyFirstDanmaku"
              class="pl-3 border-l-2 border-primary/30"
            >
              <FormField
                label="首条弹幕奖励积分"
                class="max-w-xs"
              >
                <NumberField
                  v-model="draft.dailyFirstDanmakuPoints"
                  :disabled="!canEdit"
                  :min="0"
                />
              </FormField>
            </div>

            <SettingRow
              type="switch"
              variant="card"
              title="每日首次礼物奖励"
              description="每位观众每天首次送出礼物给予额外积分"
              :disabled="!canEdit"
              v-model="draft.enableDailyFirstGift"
            />
            <div
              v-if="draft.enableDailyFirstGift"
              class="pl-3 border-l-2 border-primary/30 space-y-2.5"
            >
              <ToggleGroup
                type="single"
                :model-value="draft.useDailyFirstGiftPercent ? 'percent' : 'fixed'"
                @update:model-value="(val) => val && (draft.useDailyFirstGiftPercent = val === 'percent')"
              >
                <ToggleGroupItem value="fixed">固定积分</ToggleGroupItem>
                <ToggleGroupItem value="percent">按礼物价值比例</ToggleGroupItem>
              </ToggleGroup>

              <FormField
                :label="draft.useDailyFirstGiftPercent ? '首礼价值比例 (0 ~ 1)' : '首礼奖励积分'"
                class="max-w-xs"
              >
                <NumberField
                  v-if="!draft.useDailyFirstGiftPercent"
                  v-model="draft.dailyFirstGiftPoints"
                  :disabled="!canEdit"
                  :min="0"
                />
                <NumberField
                  v-else
                  v-model="draft.dailyFirstGiftPercent"
                  :disabled="!canEdit"
                  :min="0"
                  :max="1"
                  :step="0.01"
                />
              </FormField>
            </div>
          </CardContent>
        </Card>

        <!-- 底部常驻操作行 -->
        <div class="flex items-center justify-end gap-2 pt-1">
          <Button
            v-if="isDirty"
            variant="outline"
            :disabled="isSaving"
            @click="resetDraft"
          >
            还原更改
          </Button>
          <Button
            :loading="isSaving"
            :disabled="!canEdit || !isDirty"
            @click="saveAllSettings"
          >
            <Save24Regular class="size-3.5 mr-1" />
            {{ isDirty ? '保存设置' : '已是最新' }}
          </Button>
        </div>
      </template>

      <!-- 添加自定义礼物弹窗 -->
      <Dialog v-model:open="showAddGiftModal">
        <DialogContent class="sm:max-w-md p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm flex items-center gap-1.5">
              <span>添加自定义礼物</span>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Info24Filled class="size-3.5 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>此处填写的是收到该礼物时直接赠送的固定积分，而非比例。</TooltipContent>
              </Tooltip>
            </DialogTitle>
          </DialogHeader>

          <div class="space-y-3 text-xs">
            <FormField
              label="礼物名称"
              required
              :error="addGiftModel.nameError"
            >
              <Input
                v-model="addGiftModel.name"
                placeholder="请输入礼物名称（如：小花花）"
                @keydown="handleAddGiftKeyDown"
              />
            </FormField>

            <FormField
              label="给予积分"
              required
              :error="addGiftModel.pointError"
            >
              <NumberField
                v-model="addGiftModel.point"
                placeholder="请输入积分数量"
                :min="1"
                class="w-full"
                @keydown="handleAddGiftKeyDown"
              />
            </FormField>
          </div>

          <DialogFooter class="pt-2 border-t border-border/60">
            <Button
              variant="outline"
              @click="showAddGiftModal = false"
            >
              取消
            </Button>
            <Button
              :loading="isSaving"
              :disabled="!addGiftModel.name || !addGiftModel.point || addGiftModel.point <= 0"
              @click="addGift"
            >
              确定并保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
</template>
