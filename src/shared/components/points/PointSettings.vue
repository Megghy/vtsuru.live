<script setup lang="ts">
import { Delete24Regular, Info24Filled } from '@vicons/fluent'
import { computed, onMounted, ref, watch } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { Setting_Point } from '@/api/api-models'
import { EventDataTypes, SettingPointGiftAllowType } from '@/api/api-models'
import {
  getApiOrgOrgIdPointsSettingsDetail,
  postApiOrgOrgIdPointsSettingsUpdate,
} from '@/api/generated/org/org'
import { unwrapOk } from '@/api/query'
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/ui/dialog'
import { Empty } from '@/shared/ui/empty'
import { Input } from '@/shared/ui/input'
import NInputNumber from '@/shared/ui/NInputNumber.vue'
import { Popconfirm } from '@/shared/ui/popconfirm'
import { RadioGroup, RadioGroupItem } from '@/shared/ui/radio-group'
import { Separator } from '@/shared/ui/separator'
import { Spin } from '@/shared/ui/spin'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/shared/ui/tooltip'
import { toast } from '@/shared/utils'

const props = defineProps<{
  orgId?: number
  streamerId?: number | null
  sourceAnchorId?: string
}>()
const accountInfo = useAccount()

// 默认积分设置
const defaultSettingPoint: Setting_Point = {
  allowType: [EventDataTypes.Guard],
  jianzhangPoint: 10,
  tiduPoint: 100,
  zongduPoint: 1000,
  giftPercentMap: {},
  scPointPercent: 0.1,
  giftPointPercent: 0.1,
  giftAllowType: SettingPointGiftAllowType.All,
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
}

const orgSetting = ref<Setting_Point>(defaultSettingPoint)

async function loadOrgSetting() {
  if (!props.orgId || !props.streamerId) return
  isLoading.value = true
  try {
    orgSetting.value = unwrapOk(
      (await getApiOrgOrgIdPointsSettingsDetail(props.orgId, {
        streamerId: props.streamerId,
      })) as any,
      '加载积分规则失败',
    )
  } catch (err) {
    toast.error(err instanceof Error ? err.message : `加载失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

const setting = computed({
  get: () => {
    if (props.orgId) return orgSetting.value
    if (accountInfo.value) return accountInfo.value.settings.point || defaultSettingPoint
    return defaultSettingPoint
  },
  set: (value) => {
    if (props.orgId) {
      orgSetting.value = value
      return
    }
    if (accountInfo.value) {
      accountInfo.value.settings.point = value
    }
  },
})

const addGiftModel = ref<{ name: string; point: number; nameError: string; pointError: string }>({
  name: '',
  point: 1,
  nameError: '',
  pointError: '',
})

const canEdit = computed(() => {
  if (props.orgId) return !!props.streamerId
  return !!accountInfo.value?.settings
})

const isLoading = ref(false)
const showAddGiftModal = ref(false)

async function updateSettings() {
  if (props.orgId) {
    if (!props.streamerId) {
      toast.warning('请先选择主播')
      return false
    }
    isLoading.value = true
    setting.value.giftPercentMap ??= {}
    try {
      unwrapOk(
        (await postApiOrgOrgIdPointsSettingsUpdate(
          props.orgId,
          setting.value as any,
          { streamerId: props.streamerId },
        )) as any,
        '保存失败',
      )
      toast.success('已保存')
      await loadOrgSetting()
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `保存失败: ${err}`)
    } finally {
      isLoading.value = false
    }
    return false
  }
  if (!accountInfo.value) {
    toast.success('完成')
    return false
  }

  isLoading.value = true
  setting.value.giftPercentMap ??= {}

  try {
    const msg = await SaveSetting('Point', setting.value)
    if (msg) {
      toast.success('已保存')
      return true
    } else {
      toast.error(`保存失败: ${msg}`)
    }
  } catch (err) {
    toast.error(`保存失败: ${err}`)
  } finally {
    isLoading.value = false
  }

  return false
}

async function addGift() {
  addGiftModel.value.nameError = ''
  addGiftModel.value.pointError = ''

  let hasError = false
  if (!addGiftModel.value.name.trim()) {
    addGiftModel.value.nameError = '请输入礼物名称'
    hasError = true
  } else if (setting.value.giftPercentMap[addGiftModel.value.name] !== undefined) {
    addGiftModel.value.nameError = '此礼物名称已存在'
    hasError = true
  }

  if (!addGiftModel.value.point || addGiftModel.value.point <= 0) {
    addGiftModel.value.pointError = '积分必须大于0'
    hasError = true
  }

  if (hasError) return

  setting.value.giftPercentMap[addGiftModel.value.name] = addGiftModel.value.point
  isLoading.value = true

  try {
    const success = await updateGift()
    if (success) {
      addGiftModel.value = { name: '', point: 1, nameError: '', pointError: '' }
      showAddGiftModal.value = false
      toast.success('礼物添加成功')
    }
  } catch (error) {
    toast.error('添加礼物失败，请重试')
  } finally {
    isLoading.value = false
  }
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !isLoading.value) {
    addGift()
  }
}

async function deleteGift(name: string) {
  const oldValue = setting.value.giftPercentMap[name]
  delete setting.value.giftPercentMap[name]
  if (!(await updateGift())) {
    setting.value.giftPercentMap[name] = oldValue
  }
}

async function updateGift() {
  return await updateSettings()
}

async function SaveComboSetting() {
  if (props.orgId || !accountInfo.value) return false
  isLoading.value = true
  try {
    const msg = await SaveSetting('SendEmail', accountInfo.value.settings.sendEmail)
    if (msg) {
      toast.success('已保存')
      return true
    } else {
      toast.error(`保存失败: ${msg}`)
    }
  } catch (err) {
    toast.error(`修改失败: ${err}`)
  } finally {
    isLoading.value = false
  }
  return false
}

function toggleAllowType(type: EventDataTypes, checked: boolean) {
  const set = new Set(setting.value.allowType)
  if (checked) set.add(type)
  else set.delete(type)
  setting.value.allowType = Array.from(set)
  updateSettings()
}

onMounted(() => {
  if (props.orgId) loadOrgSetting()
})

watch(
  () => [props.orgId, props.streamerId] as const,
  () => {
    if (props.orgId) loadOrgSetting()
  },
)
</script>

<template>
  <TooltipProvider>
    <div class="space-y-4">
      <Alert
        v-if="!orgId && !accountInfo.eventFetcherState.online"
        class="bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs"
      >
        <AlertDescription class="text-xs">
          由于你尚未部署
          <a
            href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
            target="_blank"
            class="text-primary underline font-medium"
          >
            VtsuruEventFetcher
          </a>
          ，以下选项设置了也没用
        </AlertDescription>
      </Alert>

      <Alert class="text-xs bg-muted/40 border-border/80">
        <AlertDescription class="text-xs text-muted-foreground">
          积分总是最多保留两位小数，四舍五入。
        </AlertDescription>
      </Alert>

      <div v-if="isLoading" class="py-12 flex justify-center">
        <Spin />
      </div>

      <div v-else class="space-y-4">
        <!-- 通用设置 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">通用设置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-2.5 text-xs">
            <label
              v-if="!orgId"
              class="flex items-center gap-2 cursor-pointer"
            >
              <Checkbox
                v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
                :disabled="!canEdit"
                @update:checked="SaveComboSetting"
              />
              <span class="text-foreground">积分礼物有新用户兑换时发送邮件通知</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox
                v-model:checked="setting.shouldDiscontinueWhenSoldOut"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              />
              <span class="text-foreground">礼物售罄时自动下架</span>
            </label>

            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox
                v-model:checked="setting.requireAuth"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              />
              <span class="text-foreground">仅允许已认证用户兑换礼物</span>
            </label>
          </CardContent>
        </Card>

        <!-- 签到配置 -->
        <Card>
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">签到配置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-3 text-xs">
            <label class="flex items-center gap-2 cursor-pointer">
              <Checkbox
                v-model:checked="setting.enableCheckIn"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              />
              <span class="text-foreground font-medium">启用签到功能</span>
            </label>

            <template v-if="setting.enableCheckIn">
              <Separator />

              <div class="flex items-center gap-2 max-w-sm">
                <span class="text-muted-foreground shrink-0 w-20">签到关键词:</span>
                <Input
                  v-model="setting.checkInKeyword"
                  :disabled="!canEdit"
                  placeholder="默认: 签到"
                  class="h-8 text-xs flex-1"
                  @change="updateSettings"
                />
              </div>

              <div class="flex items-center gap-4 flex-wrap">
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    v-model:checked="setting.checkInOnlyOnStreaming"
                    :disabled="!canEdit"
                    @update:checked="updateSettings"
                  />
                  <span>仅开播时允许签到</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    v-model:checked="setting.allowSelfCheckIn"
                    :disabled="!canEdit"
                    @update:checked="updateSettings"
                  />
                  <span>允许主播自己签到</span>
                </label>
              </div>

              <Separator />

              <label class="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  v-model:checked="setting.givePointsForCheckIn"
                  :disabled="!canEdit"
                  @update:checked="updateSettings"
                />
                <span class="text-foreground font-medium">签到奖励积分</span>
              </label>

              <template v-if="setting.givePointsForCheckIn">
                <div class="flex items-center gap-2 max-w-xs">
                  <span class="text-muted-foreground shrink-0 w-20">基础积分:</span>
                  <NInputNumber
                    v-model:value="setting.baseCheckInPoints"
                    :disabled="!canEdit"
                    :min="0"
                    size="small"
                    class="w-24"
                    @blur="updateSettings"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-8 text-xs"
                    :disabled="!canEdit"
                    @click="updateSettings"
                  >
                    保存
                  </Button>
                </div>

                <label class="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    v-model:checked="setting.enableConsecutiveBonus"
                    :disabled="!canEdit"
                    @update:checked="updateSettings"
                  />
                  <span class="text-foreground">启用连续签到奖励</span>
                </label>

                <div
                  v-if="setting.enableConsecutiveBonus"
                  class="space-y-2 p-2.5 rounded-lg bg-muted/20 border border-border/60"
                >
                  <div class="flex items-center gap-4 flex-wrap">
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground text-[11px]">每日递增:</span>
                      <NInputNumber
                        v-model:value="setting.bonusPointsPerDay"
                        :disabled="!canEdit"
                        :min="0"
                        size="small"
                        class="w-20"
                        @blur="updateSettings"
                      />
                    </div>
                    <div class="flex items-center gap-2">
                      <span class="text-muted-foreground text-[11px]">最大奖励:</span>
                      <NInputNumber
                        v-model:value="setting.maxBonusPoints"
                        :disabled="!canEdit"
                        :min="0"
                        size="small"
                        class="w-20"
                        @blur="updateSettings"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      class="h-7 text-xs"
                      :disabled="!canEdit"
                      @click="updateSettings"
                    >
                      保存
                    </Button>
                  </div>
                  <span class="text-muted-foreground text-[11px] block">
                    例如：基础10分，递增2分，最大20分。第一天10，第二天12，第三天14...直到20分封顶。
                  </span>
                </div>
              </template>
            </template>
          </CardContent>
        </Card>

        <!-- 积分来源 -->
        <Card :id="props.sourceAnchorId">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">积分来源</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 text-xs flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="setting.allowType.includes(EventDataTypes.Guard)"
                :disabled="!canEdit"
                @update:checked="toggleAllowType(EventDataTypes.Guard, $event)"
              />
              <span>上舰</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="setting.allowType.includes(EventDataTypes.SC)"
                :disabled="!canEdit"
                @update:checked="toggleAllowType(EventDataTypes.SC, $event)"
              />
              <span>Superchat</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                :checked="setting.allowType.includes(EventDataTypes.Gift)"
                :disabled="!canEdit"
                @update:checked="toggleAllowType(EventDataTypes.Gift, $event)"
              />
              <span>礼物</span>
            </label>
          </CardContent>
        </Card>

        <!-- 上舰积分配置 -->
        <Card v-if="setting.allowType.includes(EventDataTypes.Guard)">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">上舰积分配置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-3 text-xs">
            <span class="text-muted-foreground text-[11px]">配置不同等级舰长获得的固定积分：</span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="flex items-center gap-2 p-2 rounded border border-border/80">
                <span class="text-muted-foreground w-12 text-xs">舰长:</span>
                <NInputNumber
                  v-model:value="setting.jianzhangPoint"
                  :disabled="!canEdit"
                  :min="0"
                  size="small"
                  class="flex-1"
                />
              </div>
              <div class="flex items-center gap-2 p-2 rounded border border-border/80">
                <span class="text-muted-foreground w-12 text-xs">提督:</span>
                <NInputNumber
                  v-model:value="setting.tiduPoint"
                  :disabled="!canEdit"
                  :min="0"
                  size="small"
                  class="flex-1"
                />
              </div>
              <div class="flex items-center gap-2 p-2 rounded border border-border/80">
                <span class="text-muted-foreground w-12 text-xs">总督:</span>
                <NInputNumber
                  v-model:value="setting.zongduPoint"
                  :disabled="!canEdit"
                  :min="0"
                  size="small"
                  class="flex-1"
                />
              </div>
            </div>
            <div class="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                class="text-xs"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>

        <!-- Superchat 积分配置 -->
        <Card v-if="setting.allowType.includes(EventDataTypes.SC)">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">Superchat 积分配置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-2 text-xs">
            <div class="flex items-center gap-2 max-w-sm">
              <span class="text-muted-foreground w-24 shrink-0">SC 转换倍率:</span>
              <NInputNumber
                v-model:value="setting.scPointPercent"
                :disabled="!canEdit"
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
                class="w-24"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </Button>
              <Tooltip>
                <TooltipTrigger as-child>
                  <Button
                    variant="ghost"
                    size="icon"
                    class="size-7 text-muted-foreground"
                  >
                    <component :is="Info24Filled" class="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  将SC的价格以指定比例转换为积分，如0.5则30元的SC获得15积分
                </TooltipContent>
              </Tooltip>
            </div>
          </CardContent>
        </Card>

        <!-- 每日首次互动奖励 -->
        <Card>
          <CardHeader class="p-3.5 pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle class="text-xs font-semibold">每日首次互动奖励</CardTitle>
            <label class="flex items-center gap-1.5 cursor-pointer text-xs">
              <Checkbox
                v-model:checked="setting.dailyFirstOnlyOnStreaming"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              />
              <span>仅开播时生效</span>
            </label>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-3 text-xs">
            <Alert class="text-xs bg-muted/40 border-border/80">
              <AlertDescription class="text-xs text-muted-foreground">
                每日首次发送弹幕或礼物时可以给予额外积分，每个用户每天只能获得一次。
              </AlertDescription>
            </Alert>

            <div class="space-y-2">
              <label class="flex items-center gap-1.5 cursor-pointer font-medium">
                <Checkbox
                  v-model:checked="setting.enableDailyFirstDanmaku"
                  :disabled="!canEdit"
                  @update:checked="updateSettings"
                />
                <span>每日首次弹幕奖励</span>
              </label>
              <div
                v-if="setting.enableDailyFirstDanmaku"
                class="pl-6 flex items-center gap-2"
              >
                <span class="text-muted-foreground text-[11px]">奖励积分:</span>
                <NInputNumber
                  v-model:value="setting.dailyFirstDanmakuPoints"
                  :disabled="!canEdit"
                  :min="0"
                  size="small"
                  class="w-24"
                  @blur="updateSettings"
                />
                <Button
                  variant="outline"
                  size="sm"
                  class="h-7 text-xs"
                  :disabled="!canEdit"
                  @click="updateSettings"
                >
                  保存
                </Button>
              </div>
            </div>

            <Separator />

            <div class="space-y-2">
              <label class="flex items-center gap-1.5 cursor-pointer font-medium">
                <Checkbox
                  v-model:checked="setting.enableDailyFirstGift"
                  :disabled="!canEdit"
                  @update:checked="updateSettings"
                />
                <span>每日首次礼物奖励</span>
              </label>
              <div
                v-if="setting.enableDailyFirstGift"
                class="pl-6 space-y-2"
              >
                <div class="flex items-center gap-3">
                  <label class="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="radio"
                      :checked="!setting.useDailyFirstGiftPercent"
                      @change="setting.useDailyFirstGiftPercent = false; updateSettings()"
                    />
                    <span>固定积分</span>
                  </label>
                  <label class="flex items-center gap-1 cursor-pointer text-xs">
                    <input
                      type="radio"
                      :checked="setting.useDailyFirstGiftPercent"
                      @change="setting.useDailyFirstGiftPercent = true; updateSettings()"
                    />
                    <span>按礼物价值比例</span>
                  </label>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-muted-foreground text-[11px]">
                    {{ setting.useDailyFirstGiftPercent ? '价值比例:' : '奖励积分:' }}
                  </span>
                  <NInputNumber
                    v-if="!setting.useDailyFirstGiftPercent"
                    v-model:value="setting.dailyFirstGiftPoints"
                    :disabled="!canEdit"
                    :min="0"
                    size="small"
                    class="w-24"
                    @blur="updateSettings"
                  />
                  <NInputNumber
                    v-else
                    v-model:value="setting.dailyFirstGiftPercent"
                    :disabled="!canEdit"
                    :min="0"
                    :max="1"
                    :step="0.01"
                    size="small"
                    class="w-24"
                    @blur="updateSettings"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    class="h-7 text-xs"
                    :disabled="!canEdit"
                    @click="updateSettings"
                  >
                    保存
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <!-- 礼物积分配置 -->
        <Card v-if="setting.allowType.includes(EventDataTypes.Gift)">
          <CardHeader class="p-3.5 pb-2">
            <CardTitle class="text-xs font-semibold">礼物积分配置</CardTitle>
          </CardHeader>
          <CardContent class="p-3.5 pt-0 space-y-3 text-xs">
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="radio"
                  :checked="setting.giftAllowType === SettingPointGiftAllowType.WhiteList"
                  @change="setting.giftAllowType = SettingPointGiftAllowType.WhiteList; updateSettings()"
                />
                <span>仅包含自定义列表中的礼物</span>
              </label>
              <label class="flex items-center gap-1 cursor-pointer text-xs">
                <input
                  type="radio"
                  :checked="setting.giftAllowType === SettingPointGiftAllowType.All"
                  @change="setting.giftAllowType = SettingPointGiftAllowType.All; updateSettings()"
                />
                <span>包含所有礼物</span>
              </label>
            </div>

            <div
              v-if="setting.giftAllowType === SettingPointGiftAllowType.All"
              class="flex items-center gap-2 max-w-sm pt-1"
            >
              <span class="text-muted-foreground w-24 shrink-0">礼物转换倍率:</span>
              <NInputNumber
                v-model:value="setting.giftPointPercent"
                :disabled="!canEdit"
                :min="0"
                :max="1"
                :step="0.01"
                size="small"
                class="w-24"
              />
              <Button
                variant="outline"
                size="sm"
                class="h-8 text-xs"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </Button>
            </div>

            <Separator />

            <!-- 自定义礼物列表 -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-1.5 font-medium text-foreground">
                  <span>自定义礼物列表</span>
                  <Badge
                    v-if="Object.keys(setting.giftPercentMap).length > 0"
                    variant="secondary"
                    class="text-[10px] h-4.5 px-1.5 font-normal"
                  >
                    {{ Object.keys(setting.giftPercentMap).length }}
                  </Badge>
                </div>
                <Button
                  size="sm"
                  class="h-7 text-xs"
                  :disabled="!canEdit"
                  @click="showAddGiftModal = true"
                >
                  添加礼物
                </Button>
              </div>

              <Empty
                v-if="!Object.keys(setting.giftPercentMap).length"
                description="暂无自定义礼物"
                class="py-6"
              />

              <div
                v-else
                class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2"
              >
                <div
                  v-for="item in Object.entries(setting.giftPercentMap)"
                  :key="item[0]"
                  class="p-2.5 rounded-lg border border-border/80 bg-background flex items-center justify-between gap-2"
                >
                  <div class="min-w-0 flex flex-col gap-0.5">
                    <strong class="text-foreground truncate text-xs">{{ item[0] }}</strong>
                    <span class="text-muted-foreground text-[11px]">
                      固定赠送 {{ setting.giftPercentMap[item[0]] }} 积分
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5 shrink-0">
                    <NInputNumber
                      :value="setting.giftPercentMap[item[0]]"
                      :disabled="!canEdit"
                      :min="0"
                      size="small"
                      class="w-20"
                      @update:value="(v) => (setting.giftPercentMap[item[0]] = v ? v : 0)"
                      @blur="updateSettings"
                    />
                    <Popconfirm
                      title="确定要删除这个礼物配置吗?"
                      positive-text="删除"
                      negative-text="取消"
                      @positive-click="deleteGift(item[0])"
                    >
                      <template #trigger>
                        <Button
                          variant="ghost"
                          size="icon"
                          class="size-7 text-destructive hover:bg-destructive/10"
                          :disabled="!canEdit"
                        >
                          <component :is="Delete24Regular" class="size-3.5" />
                        </Button>
                      </template>
                      确定要删除这个礼物配置吗?
                    </Popconfirm>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 添加礼物弹窗 -->
      <Dialog v-model:open="showAddGiftModal">
        <DialogContent class="sm:max-w-md p-4 space-y-3">
          <DialogHeader class="pb-2 border-b border-border/60">
            <DialogTitle class="text-sm font-semibold">添加礼物</DialogTitle>
          </DialogHeader>

          <Alert class="text-xs bg-muted/40 border-border/80">
            <AlertDescription class="text-xs text-muted-foreground">
              这里填写的积分是指这个礼物直接对应多少积分，而不是兑换比例。
            </AlertDescription>
          </Alert>

          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="font-medium text-foreground">礼物名称 *</label>
              <Input
                v-model="addGiftModel.name"
                placeholder="请输入礼物名称"
                class="h-8 text-xs"
                @keydown="handleKeyDown"
              />
              <span v-if="addGiftModel.nameError" class="text-destructive text-[11px] block">
                {{ addGiftModel.nameError }}
              </span>
            </div>

            <div class="space-y-1">
              <label class="font-medium text-foreground">给予积分 *</label>
              <NInputNumber
                v-model:value="addGiftModel.point"
                placeholder="请输入积分数量"
                :min="1"
                size="small"
                class="w-full"
                @keydown="handleKeyDown"
              />
              <span v-if="addGiftModel.pointError" class="text-destructive text-[11px] block">
                {{ addGiftModel.pointError }}
              </span>
            </div>
          </div>

          <DialogFooter class="pt-2 border-t border-border/60">
            <Button
              variant="outline"
              size="sm"
              class="text-xs"
              @click="showAddGiftModal = false"
            >
              取消
            </Button>
            <Button
              size="sm"
              class="text-xs"
              :disabled="!addGiftModel.name || !addGiftModel.point || addGiftModel.point <= 0 || isLoading"
              @click="addGift"
            >
              确定
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  </TooltipProvider>
</template>
