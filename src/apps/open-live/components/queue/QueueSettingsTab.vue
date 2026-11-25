<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

import { useAccount } from '@/api/account'
import type { SettingQueue } from '@/api/generated/model'
import { KeywordMatchType, QueueGiftFilterType, QueueSortType } from '@/api/generated/model'
import StickyDraftSaveBar from '@/apps/open-live/components/shared/StickyDraftSaveBar.vue'
import { createDefaultQueueSetting, useQueue } from '@/composables/useQueue'
import { useUnsavedChangesGuard } from '@/shared/composables/useUnsavedChangesGuard'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Checkbox } from '@/shared/ui/checkbox'
import { FormField } from '@/shared/ui/form-field'
import { Input } from '@/shared/ui/input'
import { NumberField } from '@/shared/ui/number-field'
import { SettingRow } from '@/shared/ui/setting-row'
import { Switch } from '@/shared/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group'

const store = useQueue()
const accountInfo = useAccount()

function normalizeQueueSetting(raw?: Partial<SettingQueue> | null): SettingQueue {
  const base = createDefaultQueueSetting()
  return {
    ...base,
    ...raw,
    giftNames: [...(raw?.giftNames ?? base.giftNames ?? [])],
  }
}

const draft = ref<SettingQueue>(createDefaultQueueSetting())
const savedSnapshot = ref('')
const giftNamesInput = ref('')

const canEdit = computed(() => store.configCanEdit)

function syncDraftFromSource(raw?: Partial<SettingQueue> | null) {
  const normalized = normalizeQueueSetting(raw)
  draft.value = normalized
  giftNamesInput.value = (normalized.giftNames ?? []).join(', ')
  savedSnapshot.value = JSON.stringify(normalized)
}

watch(giftNamesInput, (val) => {
  draft.value.giftNames = val
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
})

const isDirty = computed(() => {
  if (!canEdit.value || !savedSnapshot.value) return false
  return JSON.stringify(draft.value) !== savedSnapshot.value
})

useUnsavedChangesGuard(() => isDirty.value, '排队规则存在未保存的更改，离开后将会丢失，确定要离开吗？')

function initDraft() {
  if (canEdit.value && accountInfo.value?.settings?.queue) {
    syncDraftFromSource(accountInfo.value.settings.queue)
  } else {
    syncDraftFromSource(store.settings)
  }
}

onMounted(() => {
  initDraft()
})

watch(
  [() => accountInfo.value?.id, () => store.settings],
  () => {
    if (!isDirty.value) {
      initDraft()
    }
  },
  { deep: true },
)

function resetDraft() {
  if (!savedSnapshot.value) return
  syncDraftFromSource(JSON.parse(savedSnapshot.value) as SettingQueue)
  toast.info('已还原未保存的更改')
}

async function saveAllSettings() {
  const payload = normalizeQueueSetting(draft.value)
  const ok = await store.saveSettings(payload)
  if (ok) {
    syncDraftFromSource(payload)
  }
}

const sortOptions = [
  { label: '按时间', value: String(QueueSortType.TimeFirst) },
  { label: '按付费', value: String(QueueSortType.PaymentFist) },
  { label: '按舰长', value: String(QueueSortType.GuardFirst) },
  { label: '按粉丝牌', value: String(QueueSortType.FansMedalFirst) },
]
</script>

<template>
  <div class="flex flex-col gap-3.5">
    <StickyDraftSaveBar
      v-if="canEdit"
      :is-dirty="isDirty"
      :is-saving="store.isLoading"
      :can-edit="canEdit"
      dirty-title="排队规则存在未保存的更改"
      dirty-hint="修改关键词、礼物规则、排序或冷却后，点击「保存设置」统一生效"
      clean-hint="所有排队配置均统一在顶部确认保存，不会误触弹窗轰炸。"
      @reset="resetDraft"
      @save="saveAllSettings"
    />

    <!-- 组队开黑与消队流转 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">组队开黑与场次流转</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <FormField
            label="每车 / 每队坑位数（1 为单人模式，2~20 为组队模式）"
            description="例如英雄联盟五排（主播+4名观众）可设为 4，支持一键整队上车与换人补位"
          >
            <div class="flex items-center gap-2">
              <NumberField
                v-model="draft.teamSize"
                :min="1"
                :max="20"
                :disabled="!canEdit"
                class="w-28 shrink-0"
                @update:model-value="(v) => (draft.teamSize = Math.max(1, Math.min(20, v ?? 1)))"
              />
              <ToggleGroup
                type="single"
                size="xs"
                :model-value="[1, 2, 3, 4, 5].includes(draft.teamSize ?? 1) ? String(draft.teamSize ?? 1) : ''"
                :disabled="!canEdit"
                @update:model-value="(val) => val && (draft.teamSize = Number(val))"
              >
                <ToggleGroupItem value="1">1</ToggleGroupItem>
                <ToggleGroupItem value="2">2</ToggleGroupItem>
                <ToggleGroupItem value="3">3</ToggleGroupItem>
                <ToggleGroupItem value="4">4</ToggleGroupItem>
                <ToggleGroupItem value="5">5</ToggleGroupItem>
              </ToggleGroup>
            </div>
          </FormField>

          <FormField
            label="弹幕自助退队关键词（留空禁用）"
            description="等待中的观众发送该指令可自动撤回排队并退还积分"
          >
            <Input
              v-model="draft.leaveKeyword"
              placeholder="例如：退队"
              :disabled="!canEdit"
            />
          </FormField>

          <FormField
            label="单场直播每人最多上车次数（0 为不限）"
            description="仅统计本场直播中已完成或进行中的记录，取消不计入"
          >
            <NumberField
              v-model="draft.maxJoinPerLive"
              :min="0"
              :max="50"
              :disabled="!canEdit"
              @update:model-value="(v) => (draft.maxJoinPerLive = Math.max(0, v ?? 0))"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.preventSameLiveRepeat"
            type="switch"
            variant="card"
            title="本场直播内防重复上车"
            description="开启后，本场直播已完成过一次排队的观众不可再次加入，避免长期霸位"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.autoClearOnLiveStart"
            type="switch"
            variant="card"
            title="开播时自动清空上次遗留队列"
            description="检测到直播间开播时自动取消上一场未处理的排队记录"
            :disabled="!canEdit"
          />
        </div>
      </CardContent>
    </Card>

    <!-- 加入规则与权限 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">加入关键词、资格与默认排序</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <FormField label="弹幕触发关键词（留空禁用弹幕加入）">
            <Input
              v-model="draft.keyword"
              placeholder="例如：排队"
              :disabled="!canEdit"
            />
          </FormField>

          <FormField
            label="匹配方式"
            description="前缀匹配自动将关键词后的文本存为游戏 ID / 备注（如：排队 艾欧尼亚#1234）"
          >
            <ToggleGroup
              type="single"
              :model-value="String(draft.matchType)"
              :disabled="!canEdit"
              @update:model-value="(val) => val && (draft.matchType = Number(val) as KeywordMatchType)"
            >
              <ToggleGroupItem :value="String(KeywordMatchType.Full)">完全匹配</ToggleGroupItem>
              <ToggleGroupItem :value="String(KeywordMatchType.Prefix)">前缀匹配</ToggleGroupItem>
              <ToggleGroupItem :value="String(KeywordMatchType.Contains)">包含</ToggleGroupItem>
              <ToggleGroupItem :value="String(KeywordMatchType.Regex)">正则</ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <FormField label="最大队列长度 (0 为不限)">
            <NumberField
              v-model="draft.queueMaxSize"
              :min="0"
              :max="1000"
              :disabled="!canEdit"
            />
          </FormField>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.enableOnStreaming"
            type="switch"
            variant="card"
            title="仅在直播时允许加入"
            description="未开播时拒绝新增排队请求"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.allowFromWeb"
            type="switch"
            variant="card"
            title="允许观众从公开排队页自助加入"
            description="开放个人主页 /@ID/queue 页面，支持观众登录 B 站网页排队与插队"
            :disabled="!canEdit"
          />
        </div>

        <!-- 默认排序策略 -->
        <div class="rounded-lg border border-border/70 bg-muted/20 p-3 flex-between gap-3 flex-wrap text-xs">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-medium text-foreground">默认排序规则:</span>
            <ToggleGroup
              type="single"
              size="xs"
              :model-value="String(draft.sortType)"
              :disabled="!canEdit"
              @update:model-value="(val) => val && (draft.sortType = Number(val) as QueueSortType)"
            >
              <ToggleGroupItem
                v-for="opt in sortOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <label class="flex items-center gap-1.5 cursor-pointer select-none">
            <Checkbox
              v-model:checked="draft.isReverse"
              :disabled="!canEdit"
            />
            <span>队列倒序展示</span>
          </label>
        </div>

        <SettingRow
          v-model="draft.allowAllDanmaku"
          type="switch"
          variant="card"
          title="允许所有用户通过弹幕加入"
          description="关闭后需佩戴主播粉丝牌，并可叠加最低等级或大航海要求"
          :disabled="!canEdit"
        />

        <div
          v-if="!draft.allowAllDanmaku"
          class="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3 text-xs"
        >
          <div class="flex items-center gap-4 flex-wrap">
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needJianzhang"
                :disabled="!canEdit"
              />
              <span>需要舰长</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needTidu"
                :disabled="!canEdit"
              />
              <span>需要提督</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer">
              <Checkbox
                v-model:checked="draft.needZongdu"
                :disabled="!canEdit"
              />
              <span>需要总督</span>
            </label>
          </div>

          <FormField
            label="最低粉丝牌等级 (需佩戴粉丝牌)"
            class="max-w-xs"
          >
            <NumberField
              v-model="draft.fanMedalMinLevel"
              :min="0"
              :max="40"
              :disabled="!canEdit"
              @update:model-value="(v) => (draft.fanMedalMinLevel = v ?? 0)"
            />
          </FormField>
        </div>
      </CardContent>
    </Card>

    <!-- 礼物加入与付费累加 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">礼物排队与付费叠加规则</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <SettingRow
          v-model="draft.allowGift"
          type="switch"
          variant="card"
          title="允许通过发送指定礼物加入队列"
          description="支持指定礼物名称、最低价值及赠送后自动/指令加入"
          :disabled="!canEdit"
        />

        <div
          v-if="draft.allowGift"
          class="rounded-lg border border-border/70 bg-muted/20 p-3 space-y-3"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="最低礼物价值 (元)">
              <NumberField
                v-model="draft.minGiftPrice"
                :min="0"
                :step="0.1"
                :disabled="!canEdit"
              />
            </FormField>

            <FormField label="指定礼物名称 (逗号分隔，留空不限)">
              <Input
                v-model="giftNamesInput"
                placeholder="例如：小心心, 小花花"
                :disabled="!canEdit"
              />
            </FormField>
          </div>

          <FormField label="条件匹配关系">
            <ToggleGroup
              type="single"
              :model-value="String(draft.giftFilterType)"
              :disabled="!canEdit"
              @update:model-value="(val) => val && (draft.giftFilterType = Number(val) as QueueGiftFilterType)"
            >
              <ToggleGroupItem :value="String(QueueGiftFilterType.Or)">满足名称或价值之一</ToggleGroupItem>
              <ToggleGroupItem :value="String(QueueGiftFilterType.And)">同时满足名称与价值</ToggleGroupItem>
            </ToggleGroup>
          </FormField>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <SettingRow
              v-model="draft.sendGiftDirectJoin"
              type="switch"
              variant="card"
              title="送礼后直接自动入队"
              description="关闭后用户送礼后还需发送排队关键词才会入队"
              :disabled="!canEdit"
            />
            <SettingRow
              v-model="draft.sendGiftIgnoreLimit"
              type="switch"
              variant="card"
              title="礼物排队忽略门槛限制"
              description="无视粉丝牌、大航海限制（仍遵守冷却与队列上限）"
              :disabled="!canEdit"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <SettingRow
            v-model="draft.allowIncreasePaymentBySendGift"
            type="switch"
            variant="card"
            title="允许送礼累计队列付费金额"
            description="在队列中的观众继续送礼时自动累加金额，用于「按付费排序」"
            :disabled="!canEdit"
          />
          <SettingRow
            v-if="draft.allowIncreasePaymentBySendGift"
            v-model="draft.allowIncreaseByAnyPayment"
            type="switch"
            variant="card"
            title="任意付费礼物均可累加金额"
            description="关闭时仅符合上述条件清单的礼物才计入累计金额"
            :disabled="!canEdit"
          />
        </div>

        <div class="pt-2 border-t border-border/60 space-y-2.5">
          <SettingRow
            v-model="draft.allowSC"
            type="switch"
            variant="card"
            title="允许通过醒目留言 (SC) 直接排队"
            description="发送达到金额门槛的 SC 自动加入队列，并提取 SC 正文作为备注 / 游戏 ID"
            :disabled="!canEdit"
          />

          <div
            v-if="draft.allowSC"
            class="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-border/70 bg-muted/20 p-3 items-center"
          >
            <FormField label="SC 最低金额 (元，0 为不限)">
              <NumberField
                v-model="draft.minSCPrice"
                :min="0"
                :step="1"
                :disabled="!canEdit"
                @update:model-value="(v) => (draft.minSCPrice = Math.max(0, v ?? 0))"
              />
            </FormField>
            <SettingRow
              v-model="draft.scIgnoreLimit"
              type="switch"
              variant="card"
              title="SC 排队忽略粉丝牌与大航海门槛"
              :disabled="!canEdit"
            />
          </div>
        </div>
      </CardContent>
    </Card>

    <!-- 冷却时间 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">冷却时间（秒）</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <SettingRow
          v-model="draft.enableCooldown"
          type="switch"
          variant="card"
          title="启用排队冷却限制"
          description="同一观众在冷却窗口期内无法重复加入队列"
          :disabled="!canEdit"
        />

        <div
          v-if="draft.enableCooldown"
          class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1"
        >
          <FormField label="普通观众 (秒)">
            <NumberField
              v-model="draft.cooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="舰长 (秒)">
            <NumberField
              v-model="draft.jianzhangCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="提督 (秒)">
            <NumberField
              v-model="draft.tiduCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
          <FormField label="总督 (秒)">
            <NumberField
              v-model="draft.zongduCooldownSecond"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>
        </div>
      </CardContent>
    </Card>

    <!-- OBS 展示与积分联动 -->
    <Card>
      <CardHeader class="p-3.5 pb-2">
        <CardTitle class="text-sm font-semibold">OBS 展示与积分排队/插队</CardTitle>
      </CardHeader>
      <CardContent class="p-3.5 pt-2 space-y-3">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <SettingRow
            v-model="draft.showRequireInfo"
            type="switch"
            variant="card"
            title="OBS 显示底部排队条件"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showPayment"
            type="switch"
            variant="card"
            title="显示付费/礼物金额"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showFanMadelInfo"
            type="switch"
            variant="card"
            title="显示观众粉丝牌"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.showContent"
            type="switch"
            variant="card"
            title="OBS 显示观众备注 / 游戏 ID"
            :disabled="!canEdit"
          />
          <SettingRow
            v-model="draft.hideWhenEmpty"
            type="switch"
            variant="card"
            title="OBS 队列为空时自动隐藏"
            description="无正在进行且无等待观众时自动隐身，避免遮挡画面"
            :disabled="!canEdit"
          />
        </div>

        <div class="pt-2 border-t border-border/60 space-y-2.5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <SettingRow
              v-model="draft.enablePointJoin"
              type="switch"
              variant="card"
              title="启用积分排队（弹幕与网页生效）"
              description="开启后观众排队将扣除指定积分"
              :disabled="!canEdit"
            />
            <SettingRow
              v-if="draft.enablePointJoin"
              v-model="draft.pointIgnoreLimit"
              type="switch"
              variant="card"
              title="积分排队忽略门槛与冷却"
              :disabled="!canEdit"
            />
          </div>

          <FormField
            v-if="draft.enablePointJoin"
            label="每次排队消耗积分"
            class="max-w-xs"
          >
            <NumberField
              v-model="draft.pointJoinCost"
              :min="0"
              :disabled="!canEdit"
            />
          </FormField>

          <SettingRow
            v-model="draft.allowPointPriority"
            type="switch"
            variant="card"
            title="允许观众使用积分插队"
            description="观众在队列中发送插队关键词或在公开排队页点击插队即可提升顺位"
            :disabled="!canEdit"
          />

          <div
            v-if="draft.allowPointPriority"
            class="grid grid-cols-1 md:grid-cols-2 gap-3"
          >
            <FormField label="弹幕插队触发关键词">
              <Input
                v-model="draft.pointPriorityKeyword"
                placeholder="例如：插队"
                :disabled="!canEdit"
              />
            </FormField>
            <FormField label="每次插队消耗积分">
              <NumberField
                v-model="draft.pointPriorityCost"
                :min="0"
                :disabled="!canEdit"
              />
            </FormField>
          </div>
        </div>

        <div class="pt-2 border-t border-border/60">
          <SettingRow
            variant="compact"
            title="自动关闭排队失败提醒通知"
            description="仅保存在当前浏览器本地，3 秒后自动收起"
          >
            <Switch v-model:checked="store.isWarnMessageAutoClose" />
          </SettingRow>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
