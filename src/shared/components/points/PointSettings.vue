<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import { SaveSetting, useAccount } from '@/api/account'
import type { Setting_Point } from '@/api/api-models'
import { EventDataTypes, SettingPointGiftAllowType } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'

const props = defineProps<{
  orgId?: number
  streamerId?: number | null
  sourceAnchorId?: string
}>()

const accountInfo = useAccount()
const toast = useToast()
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
const isLoading = ref(false)
const showAddGiftModal = ref(false)
const pendingGiftDeletion = ref<string>()
const addGiftModel = ref({ name: '', point: 1, nameError: '', pointError: '' })
const sourceOptions = [
  { label: '上舰', value: String(EventDataTypes.Guard) },
  { label: 'Superchat', value: String(EventDataTypes.SC) },
  { label: '礼物', value: String(EventDataTypes.Gift) },
]
const selectedSources = computed({
  get: () => setting.value.allowType.map(String),
  set: (values: string[]) => {
    setting.value.allowType = values.map(Number) as EventDataTypes[]
  },
})
const giftAllowOptions = [
  { label: '仅包含自定义列表中的礼物', value: SettingPointGiftAllowType.WhiteList },
  { label: '包含所有礼物', value: SettingPointGiftAllowType.All },
]
const dailyGiftOptions = [
  { label: '固定积分', value: false },
  { label: '按礼物价值比例', value: true },
]

const setting = computed<Setting_Point>({
  get: () => (props.orgId ? orgSetting.value : accountInfo.value?.settings.point || defaultSettingPoint),
  set: (value) => {
    if (props.orgId) orgSetting.value = value
    else if (accountInfo.value) accountInfo.value.settings.point = value
  },
})
const canEdit = computed(() => (props.orgId ? Boolean(props.streamerId) : Boolean(accountInfo.value?.settings)))

async function loadOrgSetting() {
  if (!props.orgId || !props.streamerId) return
  isLoading.value = true
  try {
    orgSetting.value = unwrapOk(
      await QueryGetAPI<Setting_Point>(`${ORG_API_URL}${props.orgId}/points/settings/detail`, {
        streamerId: props.streamerId,
      }),
      '加载积分规则失败',
    )
  } catch (error) {
    toast.add({ title: error instanceof Error ? error.message : `加载失败: ${error}`, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

async function updateSettings() {
  if (props.orgId) {
    if (!props.streamerId) {
      toast.add({ title: '请先选择主播', color: 'warning' })
      return false
    }
    isLoading.value = true
    setting.value.giftPercentMap ??= {}
    try {
      unwrapOk(
        await QueryPostAPI<number>(
          `${ORG_API_URL}${props.orgId}/points/settings/update?streamerId=${props.streamerId}`,
          setting.value,
        ),
        '保存失败',
      )
      toast.add({ title: '已保存', color: 'success' })
      await loadOrgSetting()
      return true
    } catch (error) {
      toast.add({ title: error instanceof Error ? error.message : `保存失败: ${error}`, color: 'error' })
    } finally {
      isLoading.value = false
    }
    return false
  }
  if (!accountInfo.value) return false
  isLoading.value = true
  setting.value.giftPercentMap ??= {}
  try {
    const result = await SaveSetting('Point', setting.value)
    if (!result) throw new Error('服务未返回保存结果')
    toast.add({ title: '已保存', color: 'success' })
    return true
  } catch (error) {
    toast.add({ title: error instanceof Error ? `保存失败: ${error.message}` : `保存失败: ${error}`, color: 'error' })
    return false
  } finally {
    isLoading.value = false
  }
}

async function saveEmailSetting() {
  if (props.orgId || !accountInfo.value) return
  isLoading.value = true
  try {
    const result = await SaveSetting('SendEmail', accountInfo.value.settings.sendEmail)
    if (!result) throw new Error('服务未返回保存结果')
    toast.add({ title: '已保存', color: 'success' })
  } catch (error) {
    toast.add({ title: error instanceof Error ? `保存失败: ${error.message}` : `保存失败: ${error}`, color: 'error' })
  } finally {
    isLoading.value = false
  }
}

function numberValue(value: string | number) {
  return Number(value) || 0
}

async function addGift() {
  addGiftModel.value.nameError = ''
  addGiftModel.value.pointError = ''
  const name = addGiftModel.value.name.trim()
  if (!name) addGiftModel.value.nameError = '请输入礼物名称'
  else if (setting.value.giftPercentMap[name] !== undefined) addGiftModel.value.nameError = '此礼物名称已存在'
  if (!addGiftModel.value.point) addGiftModel.value.pointError = '请输入积分数量'
  else if (addGiftModel.value.point <= 0) addGiftModel.value.pointError = '积分必须大于 0'
  else if (addGiftModel.value.point > 2147483647) addGiftModel.value.pointError = '积分不能超过 2147483647'
  if (addGiftModel.value.nameError || addGiftModel.value.pointError) return
  setting.value.giftPercentMap[name] = addGiftModel.value.point
  if (await updateSettings()) {
    addGiftModel.value = { name: '', point: 1, nameError: '', pointError: '' }
    showAddGiftModal.value = false
  } else {
    delete setting.value.giftPercentMap[name]
  }
}

async function deleteGift(name: string) {
  const point = setting.value.giftPercentMap[name]
  delete setting.value.giftPercentMap[name]
  if (await updateSettings()) pendingGiftDeletion.value = undefined
  else setting.value.giftPercentMap[name] = point
}

onMounted(() => props.orgId && loadOrgSetting())
watch(
  () => [props.orgId, props.streamerId] as const,
  () => props.orgId && loadOrgSetting(),
)
</script>

<template>
  <div class="point-settings">
    <UAlert
      v-if="!orgId && !accountInfo.eventFetcherState.online"
      color="warning"
      icon="i-lucide-triangle-alert"
      title="EventFetcher 未部署"
    >
      <template #description
        >由于尚未部署
        <a
          href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
          target="_blank"
          >VtsuruEventFetcher</a
        >，以下互动积分选项不会生效。</template
      >
    </UAlert>
    <UAlert
      color="info"
      icon="i-lucide-info"
      title="积分精度"
      ><template #description>积分最多保留两位小数，并按四舍五入处理。</template></UAlert
    >

    <div
      v-if="isLoading && orgId"
      class="settings-loading"
    >
      <UIcon name="i-lucide-loader-circle" />
    </div>
    <template v-else>
      <UCard
        title="通用设置"
        variant="outline"
      >
        <div class="settings-stack">
          <UCheckbox
            v-if="!orgId"
            v-model="accountInfo.settings.sendEmail.receiveOrder"
            :disabled="!canEdit"
            @update:model-value="saveEmailSetting"
            >积分礼物有新用户兑换时发送邮件</UCheckbox
          >
          <UCheckbox
            v-model="setting.shouldDiscontinueWhenSoldOut"
            :disabled="!canEdit"
            @update:model-value="updateSettings"
            >礼物售罄时自动下架</UCheckbox
          >
          <UCheckbox
            v-model="setting.requireAuth"
            :disabled="!canEdit"
            @update:model-value="updateSettings"
            >仅允许已认证用户兑换礼物</UCheckbox
          >
        </div>
      </UCard>

      <UCard
        title="签到配置"
        variant="outline"
      >
        <div class="settings-stack">
          <UCheckbox
            v-model="setting.enableCheckIn"
            :disabled="!canEdit"
            @update:model-value="updateSettings"
            >启用签到功能</UCheckbox
          >
          <template v-if="setting.enableCheckIn">
            <USeparator /><UFormField label="签到关键词"
              ><UInput
                v-model="setting.checkInKeyword"
                :disabled="!canEdit"
                placeholder="默认：签到"
                @change="updateSettings"
            /></UFormField>
            <div class="setting-options">
              <UCheckbox
                v-model="setting.checkInOnlyOnStreaming"
                :disabled="!canEdit"
                @update:model-value="updateSettings"
                >仅开播时允许签到</UCheckbox
              ><UCheckbox
                v-model="setting.allowSelfCheckIn"
                :disabled="!canEdit"
                @update:model-value="updateSettings"
                >允许主播自己签到</UCheckbox
              >
            </div>
            <USeparator /><UCheckbox
              v-model="setting.givePointsForCheckIn"
              :disabled="!canEdit"
              @update:model-value="updateSettings"
              >签到奖励积分</UCheckbox
            >
            <template v-if="setting.givePointsForCheckIn">
              <div class="setting-input-grid">
                <UFormField label="基础积分"
                  ><UInput
                    :model-value="setting.baseCheckInPoints"
                    type="number"
                    min="0"
                    :disabled="!canEdit"
                    @update:model-value="setting.baseCheckInPoints = numberValue($event)"
                    @blur="updateSettings"
                /></UFormField>
              </div>
              <UCheckbox
                v-model="setting.enableConsecutiveBonus"
                :disabled="!canEdit"
                @update:model-value="updateSettings"
                >启用连续签到奖励</UCheckbox
              >
              <template v-if="setting.enableConsecutiveBonus"
                ><div class="setting-input-grid">
                  <UFormField label="每日递增"
                    ><UInput
                      :model-value="setting.bonusPointsPerDay"
                      type="number"
                      min="0"
                      :disabled="!canEdit"
                      @update:model-value="setting.bonusPointsPerDay = numberValue($event)"
                      @blur="updateSettings" /></UFormField
                  ><UFormField label="最大奖励"
                    ><UInput
                      :model-value="setting.maxBonusPoints"
                      type="number"
                      min="0"
                      :disabled="!canEdit"
                      @update:model-value="setting.maxBonusPoints = numberValue($event)"
                      @blur="updateSettings"
                  /></UFormField>
                </div>
                <span class="settings-hint"
                  >例如基础 10 分、递增 2 分、最大 20 分：第一天 10 分，第二天 12 分，直到 20 分封顶。</span
                ></template
              >
            </template>
          </template>
        </div>
      </UCard>

      <UCard
        :id="sourceAnchorId"
        title="积分来源"
        variant="outline"
        ><UCheckboxGroup
          v-model="selectedSources"
          :items="sourceOptions"
          :disabled="!canEdit"
          @update:model-value="updateSettings"
      /></UCard>

      <UCard
        v-if="setting.allowType.includes(EventDataTypes.Guard)"
        title="上舰积分配置"
        variant="outline"
        ><div class="settings-stack">
          <span class="settings-hint">配置不同等级舰长获得的固定积分。</span>
          <div class="setting-input-grid">
            <UFormField label="舰长"
              ><UInput
                :model-value="setting.jianzhangPoint"
                type="number"
                min="0"
                :disabled="!canEdit"
                @update:model-value="setting.jianzhangPoint = numberValue($event)"
                @blur="updateSettings" /></UFormField
            ><UFormField label="提督"
              ><UInput
                :model-value="setting.tiduPoint"
                type="number"
                min="0"
                :disabled="!canEdit"
                @update:model-value="setting.tiduPoint = numberValue($event)"
                @blur="updateSettings" /></UFormField
            ><UFormField label="总督"
              ><UInput
                :model-value="setting.zongduPoint"
                type="number"
                min="0"
                :disabled="!canEdit"
                @update:model-value="setting.zongduPoint = numberValue($event)"
                @blur="updateSettings"
            /></UFormField>
          </div></div
      ></UCard>

      <UCard
        v-if="setting.allowType.includes(EventDataTypes.SC)"
        title="Superchat 积分配置"
        variant="outline"
        ><UFormField label="SC 转换倍率"
          ><UInput
            :model-value="setting.scPointPercent"
            type="number"
            min="0"
            max="1"
            step="0.01"
            :disabled="!canEdit"
            @update:model-value="setting.scPointPercent = numberValue($event)"
            @blur="updateSettings"
        /></UFormField>
        <p class="settings-hint">将 SC 价格以指定比例转换为积分；例如 0.5 时，30 元 SC 获得 15 积分。</p></UCard
      >

      <UCard
        title="每日首次互动奖励"
        variant="outline"
        ><div class="settings-stack">
          <UCheckbox
            v-model="setting.dailyFirstOnlyOnStreaming"
            :disabled="!canEdit"
            @update:model-value="updateSettings"
            >仅开播时生效</UCheckbox
          ><UAlert
            color="info"
            title="奖励规则"
            ><template #description
              >每日首次发送弹幕或礼物时可获得额外积分，每个用户每天只会获得一次。</template
            ></UAlert
          >
          <div class="setting-section">
            <UCheckbox
              v-model="setting.enableDailyFirstDanmaku"
              :disabled="!canEdit"
              @update:model-value="updateSettings"
              >每日首次弹幕奖励</UCheckbox
            ><UFormField
              v-if="setting.enableDailyFirstDanmaku"
              label="奖励积分"
              ><UInput
                :model-value="setting.dailyFirstDanmakuPoints"
                type="number"
                min="0"
                :disabled="!canEdit"
                @update:model-value="setting.dailyFirstDanmakuPoints = numberValue($event)"
                @blur="updateSettings"
            /></UFormField>
          </div>
          <USeparator />
          <div class="setting-section">
            <UCheckbox
              v-model="setting.enableDailyFirstGift"
              :disabled="!canEdit"
              @update:model-value="updateSettings"
              >每日首次礼物奖励</UCheckbox
            ><template v-if="setting.enableDailyFirstGift"
              ><URadioGroup
                v-model="setting.useDailyFirstGiftPercent"
                :items="dailyGiftOptions"
                orientation="horizontal"
                :disabled="!canEdit"
                @update:model-value="updateSettings"
              /><UFormField :label="setting.useDailyFirstGiftPercent ? '价值比例' : '奖励积分'"
                ><UInput
                  :model-value="
                    setting.useDailyFirstGiftPercent ? setting.dailyFirstGiftPercent : setting.dailyFirstGiftPoints
                  "
                  type="number"
                  min="0"
                  :max="setting.useDailyFirstGiftPercent ? 1 : undefined"
                  :step="setting.useDailyFirstGiftPercent ? 0.01 : 1"
                  :disabled="!canEdit"
                  @update:model-value="
                    setting.useDailyFirstGiftPercent
                      ? (setting.dailyFirstGiftPercent = numberValue($event))
                      : (setting.dailyFirstGiftPoints = numberValue($event))
                  "
                  @blur="updateSettings" /></UFormField
              ><span class="settings-hint"
                >按比例时，例如 0.1 表示送 10 元礼物获得 1 积分；免费礼物不奖励积分。</span
              ></template
            >
          </div>
        </div></UCard
      >

      <UCard
        v-if="setting.allowType.includes(EventDataTypes.Gift)"
        title="礼物积分配置"
        variant="outline"
        ><div class="settings-stack">
          <URadioGroup
            v-model="setting.giftAllowType"
            :items="giftAllowOptions"
            :disabled="!canEdit"
            @update:model-value="updateSettings"
          /><UFormField
            v-if="setting.giftAllowType === SettingPointGiftAllowType.All"
            label="礼物转换倍率"
            ><UInput
              :model-value="setting.giftPointPercent"
              type="number"
              min="0"
              max="1"
              step="0.01"
              :disabled="!canEdit"
              @update:model-value="setting.giftPointPercent = numberValue($event)"
              @blur="updateSettings"
          /></UFormField>
          <p
            v-if="setting.giftAllowType === SettingPointGiftAllowType.All"
            class="settings-hint"
          >
            例如 0.5 时，价值 10 元的礼物获得 5 积分。
          </p>
          <USeparator />
          <div class="gift-list-header">
            <strong>自定义礼物列表</strong
            ><UBadge
              v-if="Object.keys(setting.giftPercentMap).length"
              size="sm"
              color="info"
              :label="String(Object.keys(setting.giftPercentMap).length)"
            /><UButton
              color="primary"
              size="sm"
              icon="i-lucide-plus"
              :disabled="!canEdit"
              @click="showAddGiftModal = true"
              >添加礼物</UButton
            >
          </div>
          <div
            v-if="!Object.keys(setting.giftPercentMap).length"
            class="gift-empty"
          >
            <UIcon name="i-lucide-gift" /><span>暂无自定义礼物</span>
          </div>
          <div
            v-else
            class="gift-grid"
          >
            <div
              v-for="[name, point] in Object.entries(setting.giftPercentMap)"
              :key="name"
              class="gift-item-card"
            >
              <div>
                <strong>{{ name }}</strong
                ><span>固定赠送 {{ point }} 积分</span>
              </div>
              <div class="gift-item-actions">
                <UInput
                  :model-value="point"
                  type="number"
                  min="0"
                  :disabled="!canEdit"
                  @update:model-value="setting.giftPercentMap[name] = numberValue($event)"
                  @blur="updateSettings"
                /><UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  :disabled="!canEdit"
                  :aria-label="`删除 ${name}`"
                  @click="pendingGiftDeletion = name"
                />
              </div>
            </div>
          </div></div
      ></UCard>
    </template>

    <UModal
      v-model:open="showAddGiftModal"
      title="添加礼物"
      :dismissible="!isLoading"
      ><template #body
        ><div class="modal-stack">
          <UAlert
            color="info"
            title="积分规则"
            ><template #description>这里的积分是该礼物直接对应的积分数量，不是兑换比例。</template></UAlert
          ><UFormField
            label="礼物名称"
            required
            :error="addGiftModel.nameError"
            ><UInput
              v-model="addGiftModel.name"
              autofocus
              placeholder="请输入礼物名称"
              @keydown.enter.prevent="addGift" /></UFormField
          ><UFormField
            label="给予积分"
            required
            :error="addGiftModel.pointError"
            ><UInput
              v-model="addGiftModel.point"
              type="number"
              min="1"
              @keydown.enter.prevent="addGift"
          /></UFormField></div></template
      ><template #footer
        ><div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="showAddGiftModal = false"
            >取消</UButton
          ><UButton
            color="primary"
            :loading="isLoading"
            @click="addGift"
            >确定</UButton
          >
        </div></template
      ></UModal
    >
    <UModal
      v-if="pendingGiftDeletion"
      :open="Boolean(pendingGiftDeletion)"
      title="删除礼物配置"
      @update:open="!$event && (pendingGiftDeletion = undefined)"
      ><template #body
        ><p>确定删除「{{ pendingGiftDeletion }}」的积分配置吗？</p></template
      ><template #footer
        ><div class="modal-actions">
          <UButton
            color="neutral"
            variant="ghost"
            @click="pendingGiftDeletion = undefined"
            >取消</UButton
          ><UButton
            color="error"
            :loading="isLoading"
            @click="deleteGift(pendingGiftDeletion!)"
            >确认删除</UButton
          >
        </div></template
      ></UModal
    >
  </div>
</template>

<style scoped>
.point-settings {
  display: grid;
  gap: 16px;
}
.settings-loading {
  display: grid;
  min-height: 280px;
  place-content: center;
  color: var(--vtsuru-fg-muted);
}
.settings-loading :first-child {
  font-size: 28px;
  animation: spin 0.8s linear infinite;
}
.settings-stack,
.setting-section,
.modal-stack {
  display: grid;
  gap: 14px;
}
.setting-options {
  display: flex;
  flex-wrap: wrap;
  gap: 18px;
}
.setting-input-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  max-width: 680px;
}
.settings-hint {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
  line-height: 1.6;
}
.gift-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gift-list-header > :last-child {
  margin-left: auto;
}
.gift-empty {
  display: grid;
  min-height: 120px;
  place-content: center;
  gap: 8px;
  color: var(--vtsuru-fg-muted);
  text-align: center;
}
.gift-empty :first-child {
  font-size: 24px;
}
.gift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.gift-item-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--vtsuru-border);
  border-radius: var(--vtsuru-radius);
  background: var(--vtsuru-bg-muted);
}
.gift-item-card > div:first-child {
  display: grid;
  min-width: 0;
  gap: 4px;
}
.gift-item-card strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.gift-item-card span {
  color: var(--vtsuru-fg-muted);
  font-size: 12px;
}
.gift-item-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 150px;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 640px) {
  .setting-options {
    display: grid;
    gap: 10px;
  }
  .gift-item-card {
    align-items: flex-start;
    flex-direction: column;
  }
  .gift-item-actions {
    width: 100%;
  }
  .gift-item-actions :deep(input) {
    width: 100%;
  }
}
</style>
