<script setup lang="ts">
import type { Setting_Point } from '@/api/api-models'
import { Delete24Regular, Info24Filled } from '@vicons/fluent'
import {
  NAlert, NButton, NCard, NCheckbox, NCheckboxGroup, NDivider, NFlex, NForm, NFormItem, NIcon, NInput, NInputGroup, NInputGroupLabel, NInputNumber, NModal, NPopconfirm, NRadioButton, NRadioGroup, NSpin, NTag, NText, NTooltip, useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue'
import { SaveSetting, useAccount } from '@/api/account'
import { EventDataTypes, SettingPointGiftAllowType } from '@/api/api-models'
import { QueryGetAPI, QueryPostAPI, unwrapOk } from '@/api/query'
import { ORG_API_URL } from '@/shared/config'

const props = defineProps<{
  orgId?: number
  streamerId?: number | null
}>()
const accountInfo = useAccount()
const message = useMessage()

// 默认积分设置
const defaultSettingPoint: Setting_Point = {
  allowType: [EventDataTypes.Guard], // 默认只允许舰长积分
  jianzhangPoint: 10, // 舰长积分
  tiduPoint: 100, // 提督积分
  zongduPoint: 1000, // 总督积分
  giftPercentMap: {}, // 礼物积分映射表
  scPointPercent: 0.1, // SC积分比例 (10%)
  giftPointPercent: 0.1, // 礼物积分比例 (10%)
  giftAllowType: SettingPointGiftAllowType.All, // 默认允许所有礼物
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
      await QueryGetAPI<Setting_Point>(`${ORG_API_URL}${props.orgId}/points/settings/detail`, { streamerId: props.streamerId }),
      '加载积分规则失败',
    )
  } catch (err) {
    message.error(err instanceof Error ? err.message : `加载失败: ${err}`)
  } finally {
    isLoading.value = false
  }
}

// 响应式设置对象（owner/org 两种模式）
const setting = computed({
  get: () => {
    if (props.orgId) {
      return orgSetting.value
    }
    if (accountInfo.value) {
      return accountInfo.value.settings.point || defaultSettingPoint
    }
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

// 添加礼物表单模型
const addGiftModel = ref<{ name: string, point: number, nameError: string, pointError: string }>({
  name: '',
  point: 1,
  nameError: '',
  pointError: '',
})

// 是否可以编辑设置
const canEdit = computed(() => {
  if (props.orgId) return !!props.streamerId
  return accountInfo.value && accountInfo.value.settings
})

const isLoading = ref(false)
const showAddGiftModal = ref(false)

// 更新积分设置
async function updateSettings() {
  if (props.orgId) {
    if (!props.streamerId) {
      message.warning('请先选择主播')
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
      message.success('已保存')
      await loadOrgSetting()
      return true
    } catch (err) {
      message.error(err instanceof Error ? err.message : `保存失败: ${err}`)
    } finally {
      isLoading.value = false
    }
    return false
  }
  if (!accountInfo.value) {
    message.success('完成')
    return false
  }

  isLoading.value = true
  setting.value.giftPercentMap ??= {}

  try {
    const msg = await SaveSetting('Point', setting.value)
    if (msg) {
      message.success('已保存')
      return true
    } else {
      message.error(`保存失败: ${msg}`)
    }
  } catch (err) {
    message.error(`保存失败: ${err}`)
    console.error(err)
  } finally {
    isLoading.value = false
  }

  return false
}

// 添加礼物积分规则
async function addGift() {
  // 重置错误信息
  addGiftModel.value.nameError = ''
  addGiftModel.value.pointError = ''

  // 表单验证
  let hasError = false

  if (!addGiftModel.value.name.trim()) {
    addGiftModel.value.nameError = '请输入礼物名称'
    hasError = true
  } else if (setting.value.giftPercentMap[addGiftModel.value.name] !== undefined) {
    addGiftModel.value.nameError = '此礼物名称已存在'
    hasError = true
  }

  if (!addGiftModel.value.point) {
    addGiftModel.value.pointError = '请输入积分数量'
    hasError = true
  } else if (addGiftModel.value.point <= 0) {
    addGiftModel.value.pointError = '积分必须大于0'
    hasError = true
  } else if (addGiftModel.value.point > 2147483647) {
    addGiftModel.value.pointError = '积分不能超过2147483647'
    hasError = true
  }

  if (hasError) {
    return
  }

  // 添加礼物积分规则
  setting.value.giftPercentMap[addGiftModel.value.name] = addGiftModel.value.point
  isLoading.value = true

  try {
    const success = await updateGift()
    // 添加成功后清空表单
    if (success) {
      addGiftModel.value = { name: '', point: 1, nameError: '', pointError: '' }
      showAddGiftModal.value = false
      message.success('礼物添加成功')
    }
  } catch (error) {
    console.error('添加礼物失败:', error)
    message.error('添加礼物失败，请重试')
  } finally {
    isLoading.value = false
  }
}

// 处理键盘按下事件
function handleKeyDown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !isLoading.value) {
    addGift()
  }
}

// 删除礼物积分规则
async function deleteGift(name: string) {
  const oldValue = setting.value.giftPercentMap[name]
  delete setting.value.giftPercentMap[name]

  if (!(await updateGift())) {
    // 如果更新失败，恢复原值
    setting.value.giftPercentMap[name] = oldValue
  }
}

// 更新礼物积分规则
async function updateGift() {
  return await updateSettings()
}

// 更新账户通知设置
async function SaveComboSetting() {
  if (props.orgId) return false
  if (!accountInfo.value) return false

  isLoading.value = true
  try {
    const msg = await SaveSetting('SendEmail', accountInfo.value.settings.sendEmail)
    if (msg) {
      message.success('已保存')
      return true
    } else {
      message.error(`保存失败: ${msg}`)
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
  } finally {
    isLoading.value = false
  }
  return false
}

onMounted(() => {
  if (props.orgId) {
    loadOrgSetting()
  }
})

watch(
  () => [props.orgId, props.streamerId] as const,
  () => {
    if (props.orgId) {
      loadOrgSetting()
    }
  }
)
</script>

<template>
  <!-- EventFetcher 部署提示 -->
  <NAlert
    v-if="!orgId && !accountInfo.eventFetcherState.online"
    type="warning"
    class="alert-margin"
    :bordered="false"
  >
    由于你尚未部署
    <NButton
      text
      type="primary"
      tag="a"
      href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs"
      target="_blank"
    >
      VtsuruEventFetcher
    </NButton>
    , 以下选项设置了也没用
  </NAlert>

  <!-- 积分精度提示 -->
  <NAlert
    type="info"
    class="alert-margin"
    :bordered="false"
  >
    积分总是最多保留两位小数, 四舍五入
  </NAlert>

  <NSpin :show="isLoading">
    <NFlex
      vertical
      :gap="16"
    >
      <!-- 通用设置 -->
      <NCard
        title="通用设置"
        size="small"
      >
        <NFlex
          vertical
          :gap="12"
        >
          <NFlex
            v-if="!orgId"
            align="center"
            :gap="12"
          >
            <span class="setting-label">通知:</span>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
              :disabled="!canEdit"
              @update:checked="SaveComboSetting"
            >
              积分礼物有新用户兑换时发送邮件
            </NCheckbox>
          </NFlex>

          <NFlex
            align="center"
            :gap="12"
          >
            <span class="setting-label">库存:</span>
            <NCheckbox
              v-model:checked="setting.shouldDiscontinueWhenSoldOut"
              :disabled="!canEdit"
              @update:checked="updateSettings"
            >
              礼物售罄时自动下架
            </NCheckbox>
          </NFlex>

          <NFlex
            align="center"
            :gap="12"
          >
            <span class="setting-label">兑换:</span>
            <NCheckbox
              v-model:checked="setting.requireAuth"
              :disabled="!canEdit"
              @update:checked="updateSettings"
            >
              仅允许已认证用户兑换礼物
            </NCheckbox>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- 签到设置 -->
      <NCard
        title="签到配置"
        size="small"
      >
        <NFlex
          vertical
          :gap="16"
        >
          <NCheckbox
            v-model:checked="setting.enableCheckIn"
            :disabled="!canEdit"
            @update:checked="updateSettings"
          >
            启用签到功能
          </NCheckbox>

          <template v-if="setting.enableCheckIn">
            <NDivider style="margin: 0" />

            <div class="setting-row">
              <NInputGroup
                class="input-group"
                :disabled="!canEdit"
              >
                <NInputGroupLabel> 签到关键词 </NInputGroupLabel>
                <NInput
                  v-model:value="setting.checkInKeyword"
                  :disabled="!canEdit"
                  placeholder="默认: 签到"
                  @change="updateSettings"
                />
              </NInputGroup>
            </div>

            <NFlex :gap="24">
              <NCheckbox
                v-model:checked="setting.checkInOnlyOnStreaming"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              >
                仅开播时允许签到
              </NCheckbox>
              <NCheckbox
                v-model:checked="setting.allowSelfCheckIn"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              >
                允许主播自己签到
              </NCheckbox>
            </NFlex>

            <NDivider style="margin: 0" />

            <NCheckbox
              v-model:checked="setting.givePointsForCheckIn"
              :disabled="!canEdit"
              @update:checked="updateSettings"
            >
              签到奖励积分
            </NCheckbox>

            <template v-if="setting.givePointsForCheckIn">
              <div class="setting-row">
                <NInputGroup
                  class="input-group"
                  :disabled="!canEdit"
                >
                  <NInputGroupLabel> 基础积分 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="setting.baseCheckInPoints"
                    :disabled="!canEdit"
                    min="0"
                    :show-button="false"
                    @blur="updateSettings"
                  />
                  <NButton
                    type="primary"
                    ghost
                    :disabled="!canEdit"
                    @click="updateSettings"
                  >
                    保存
                  </NButton>
                </NInputGroup>
              </div>

              <NCheckbox
                v-model:checked="setting.enableConsecutiveBonus"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              >
                启用连续签到奖励
              </NCheckbox>

              <template v-if="setting.enableConsecutiveBonus">
                <NFlex :gap="16">
                  <NInputGroup
                    class="input-group"
                    :disabled="!canEdit"
                  >
                    <NInputGroupLabel> 每日递增 </NInputGroupLabel>
                    <NInputNumber
                      v-model:value="setting.bonusPointsPerDay"
                      :disabled="!canEdit"
                      min="0"
                      :show-button="false"
                      @blur="updateSettings"
                    />
                    <NButton
                      type="primary"
                      ghost
                      :disabled="!canEdit"
                      @click="updateSettings"
                    >
                      保存
                    </NButton>
                  </NInputGroup>

                  <NInputGroup
                    class="input-group"
                    :disabled="!canEdit"
                  >
                    <NInputGroupLabel> 最大奖励 </NInputGroupLabel>
                    <NInputNumber
                      v-model:value="setting.maxBonusPoints"
                      :disabled="!canEdit"
                      min="0"
                      :show-button="false"
                      @blur="updateSettings"
                    />
                    <NButton
                      type="primary"
                      ghost
                      :disabled="!canEdit"
                      @click="updateSettings"
                    >
                      保存
                    </NButton>
                  </NInputGroup>
                </NFlex>
                <NText
                  depth="3"
                  style="font-size: 12px"
                >
                  例如：基础10分，递增2分，最大20分。第一天10，第二天12，第三天14...直到20分封顶。
                </NText>
              </template>
            </template>
          </template>
        </NFlex>
      </NCard>

      <!-- 积分来源 -->
      <NCard
        title="积分来源"
        size="small"
      >
        <NFlex
          align="center"
          :gap="12"
        >
          <span class="setting-label">启用来源:</span>
          <NCheckboxGroup
            v-model:value="setting.allowType"
            :disabled="!canEdit"
            @update:value="updateSettings"
          >
            <NCheckbox :value="EventDataTypes.Guard">
              上舰
            </NCheckbox>
            <NCheckbox :value="EventDataTypes.SC">
              Superchat
            </NCheckbox>
            <NCheckbox :value="EventDataTypes.Gift">
              礼物
            </NCheckbox>
          </NCheckboxGroup>
        </NFlex>
      </NCard>

      <!-- 舰长设置区域 -->
      <NCard
        v-if="setting.allowType.includes(EventDataTypes.Guard)"
        title="上舰积分配置"
        size="small"
      >
        <NFlex
          vertical
          :gap="12"
        >
          <NText depth="3">
            配置不同等级舰长获得的固定积分
          </NText>
          <NFlex
            :wrap="true"
            :gap="16"
          >
            <NInputGroup
              class="input-group"
              :disabled="!canEdit"
            >
              <NInputGroupLabel> 舰长 </NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.jianzhangPoint"
                :disabled="!canEdit"
                min="0"
                :show-button="false"
              />
              <NButton
                type="primary"
                ghost
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>

            <NInputGroup
              class="input-group"
              :disabled="!canEdit"
            >
              <NInputGroupLabel> 提督 </NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.tiduPoint"
                :disabled="!canEdit"
                min="0"
                :show-button="false"
              />
              <NButton
                type="primary"
                ghost
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>

            <NInputGroup
              class="input-group"
              :disabled="!canEdit"
            >
              <NInputGroupLabel> 总督 </NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.zongduPoint"
                :disabled="!canEdit"
                min="0"
                :show-button="false"
              />
              <NButton
                type="primary"
                ghost
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
            </NInputGroup>
          </NFlex>
        </NFlex>
      </NCard>

      <!-- SC设置区域 -->
      <NCard
        v-if="setting.allowType.includes(EventDataTypes.SC)"
        title="Superchat 积分配置"
        size="small"
      >
        <NInputGroup
          class="input-group-wide"
          :disabled="!canEdit"
        >
          <NInputGroupLabel> SC转换倍率 </NInputGroupLabel>
          <NInputNumber
            v-model:value="setting.scPointPercent"
            :disabled="!canEdit"
            min="0"
            step="0.01"
            max="1"
            :show-button="false"
          />
          <NButton
            type="primary"
            ghost
            :disabled="!canEdit"
            @click="updateSettings"
          >
            保存
          </NButton>
          <NTooltip trigger="hover">
            <template #trigger>
              <NButton
                quaternary
                circle
              >
                <template #icon>
                  <NIcon :component="Info24Filled" />
                </template>
              </NButton>
            </template>
            将SC的价格以指定比例转换为积分, 如这里是0.5, 则一个30块的sc获得的积分为 30 * 0.5 = 15
          </NTooltip>
        </NInputGroup>
      </NCard>

      <!-- 每日首次互动奖励设置 -->
      <NCard
        title="每日首次互动奖励"
        size="small"
      >
        <template #header-extra>
          <NFlex align="center">
            <NCheckbox
              v-model:checked="setting.dailyFirstOnlyOnStreaming"
              :disabled="!canEdit"
              @update:checked="updateSettings"
            >
              仅开播时生效
            </NCheckbox>
          </NFlex>
        </template>
        <NAlert
          type="info"
          :bordered="false"
          style="margin-bottom: 16px"
        >
          每日首次发送弹幕或礼物时可以给予额外积分，每个用户每天只能获得一次。
        </NAlert>

        <NFlex
          vertical
          :gap="20"
        >
          <!-- 每日首次弹幕奖励 -->
          <div class="setting-row-group">
            <NFlex align="center" style="margin-bottom: 12px">
              <NCheckbox
                v-model:checked="setting.enableDailyFirstDanmaku"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              >
                <span style="font-weight: 500">每日首次弹幕奖励</span>
              </NCheckbox>
            </NFlex>

            <NFlex v-if="setting.enableDailyFirstDanmaku" style="padding-left: 28px">
              <NInputGroup
                class="input-group-wide"
                :disabled="!canEdit"
              >
                <NInputGroupLabel> 奖励积分 </NInputGroupLabel>
                <NInputNumber
                  v-model:value="setting.dailyFirstDanmakuPoints"
                  :disabled="!canEdit"
                  min="0"
                  :show-button="false"
                  @blur="updateSettings"
                />
                <NButton
                  type="primary"
                  ghost
                  :disabled="!canEdit"
                  @click="updateSettings"
                >
                  保存
                </NButton>
              </NInputGroup>
            </NFlex>
          </div>

          <NDivider style="margin: 0" />

          <!-- 每日首次礼物奖励 -->
          <div class="setting-row-group">
            <NFlex align="center" style="margin-bottom: 12px">
              <NCheckbox
                v-model:checked="setting.enableDailyFirstGift"
                :disabled="!canEdit"
                @update:checked="updateSettings"
              >
                <span style="font-weight: 500">每日首次礼物奖励</span>
              </NCheckbox>
            </NFlex>

            <NFlex
              v-if="setting.enableDailyFirstGift"
              vertical
              :gap="12"
              style="padding-left: 28px"
            >
              <NRadioGroup
                v-model:value="setting.useDailyFirstGiftPercent"
                size="small"
                @update:value="updateSettings"
              >
                <NRadioButton :value="false">
                  固定积分
                </NRadioButton>
                <NRadioButton :value="true">
                  按礼物价值比例
                </NRadioButton>
              </NRadioGroup>

              <NFlex>
                <NInputGroup
                  v-if="!setting.useDailyFirstGiftPercent"
                  class="input-group-wide"
                  :disabled="!canEdit"
                >
                  <NInputGroupLabel> 奖励积分 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="setting.dailyFirstGiftPoints"
                    :disabled="!canEdit"
                    min="0"
                    :show-button="false"
                    @blur="updateSettings"
                  />
                  <NButton
                    type="primary"
                    ghost
                    :disabled="!canEdit"
                    @click="updateSettings"
                  >
                    保存
                  </NButton>
                </NInputGroup>

                <NInputGroup
                  v-else
                  class="input-group-wide"
                  :disabled="!canEdit"
                >
                  <NInputGroupLabel> 价值比例 </NInputGroupLabel>
                  <NInputNumber
                    v-model:value="setting.dailyFirstGiftPercent"
                    :disabled="!canEdit"
                    min="0"
                    step="0.01"
                    max="1"
                    :show-button="false"
                    @blur="updateSettings"
                  />
                  <NButton
                    type="primary"
                    ghost
                    :disabled="!canEdit"
                    @click="updateSettings"
                  >
                    保存
                  </NButton>
                  <NTooltip trigger="hover">
                    <template #trigger>
                      <NButton
                        quaternary
                        circle
                        size="small"
                      >
                        <template #icon>
                          <NIcon :component="Info24Filled" />
                        </template>
                      </NButton>
                    </template>
                    例如设置0.1，送10元礼物获得1积分。免费礼物不给予积分。
                  </NTooltip>
                </NInputGroup>
              </NFlex>
            </NFlex>
          </div>
        </NFlex>
      </NCard>

      <!-- 礼物设置区域 -->
      <NCard
        v-if="setting.allowType.includes(EventDataTypes.Gift)"
        title="礼物积分配置"
        size="small"
      >
        <NFlex
          vertical
          :gap="16"
        >
          <!-- 礼物类型选择 -->
          <NRadioGroup
            v-model:value="setting.giftAllowType"
            @update:value="updateSettings"
          >
            <NRadioButton :value="SettingPointGiftAllowType.WhiteList">
              仅包含自定义列表中的礼物
            </NRadioButton>
            <NRadioButton :value="SettingPointGiftAllowType.All">
              包含所有礼物
            </NRadioButton>
          </NRadioGroup>

          <!-- 所有礼物转换比例 -->
          <template v-if="setting.giftAllowType === SettingPointGiftAllowType.All">
            <NInputGroup
              class="input-group-wide"
              :disabled="!canEdit"
            >
              <NInputGroupLabel> 礼物转换倍率 </NInputGroupLabel>
              <NInputNumber
                v-model:value="setting.giftPointPercent"
                :disabled="!canEdit"
                min="0"
                step="0.01"
                max="1"
                :show-button="false"
              />
              <NButton
                type="primary"
                ghost
                :disabled="!canEdit"
                @click="updateSettings"
              >
                保存
              </NButton>
              <NTooltip trigger="hover">
                <template #trigger>
                  <NButton
                    quaternary
                    circle
                  >
                    <template #icon>
                      <NIcon :component="Info24Filled" />
                    </template>
                  </NButton>
                </template>
                将礼物的价格以指定比例转换为积分, 如这里是0.5, 则一个10块的礼物获得的积分为 10 * 0.5 = 5
              </NTooltip>
            </NInputGroup>
          </template>

          <NDivider style="margin: 0" />

          <!-- 礼物列表 -->
          <div class="gift-list-section">
            <NFlex
              justify="space-between"
              align="center"
              style="margin-bottom: 16px"
            >
              <div class="section-title">
                自定义礼物列表
                <NTag
                  v-if="Object.keys(setting.giftPercentMap).length > 0"
                  :bordered="false"
                  size="small"
                  type="info"
                  style="margin-left: 8px"
                >
                  {{ Object.keys(setting.giftPercentMap).length }}
                </NTag>
              </div>
              <NButton
                type="primary"
                :disabled="!canEdit"
                size="small"
                @click="showAddGiftModal = true"
              >
                添加礼物
              </NButton>
            </NFlex>

            <NEmpty
              v-if="!Object.keys(setting.giftPercentMap).length"
              description="暂无自定义礼物"
              style="margin: 24px 0"
            />

            <div
              v-else
              class="gift-grid"
            >
              <div
                v-for="item in Object.entries(setting.giftPercentMap)"
                :key="item[0]"
                class="gift-item-card"
              >
                <NFlex
                  align="center"
                  justify="space-between"
                  :wrap="false"
                >
                  <NFlex
                    vertical
                    :gap="4"
                    style="flex: 1; overflow: hidden"
                  >
                    <div class="gift-name">
                      {{ item[0] }}
                    </div>
                    <NText depth="3" style="font-size: 12px">
                      固定赠送 {{ setting.giftPercentMap[item[0]] }} 积分
                    </NText>
                  </NFlex>

                  <NFlex align="center" :gap="8">
                    <NInputNumber
                      :value="setting.giftPercentMap[item[0]]"
                      :disabled="!canEdit"
                      min="0"
                      size="small"
                      placeholder="积分"
                      :show-button="false"
                      style="width: 80px"
                      @update:value="(v) => (setting.giftPercentMap[item[0]] = v ? v : 0)"
                      @blur="updateSettings"
                    />
                    <NPopconfirm @positive-click="deleteGift(item[0])">
                      <template #trigger>
                        <NButton
                          type="error"
                          size="small"
                          quaternary
                          circle
                          :disabled="!canEdit"
                        >
                          <template #icon>
                            <NIcon :component="Delete24Regular" />
                          </template>
                        </NButton>
                      </template>
                      确定要删除这个礼物配置吗?
                    </NPopconfirm>
                  </NFlex>
                </NFlex>
              </div>
            </div>
          </div>
        </NFlex>

        <!-- 添加礼物弹窗 -->
        <NModal
          v-model:show="showAddGiftModal"
          preset="card"
          title="添加礼物"
          style="max-width: 480px"
          :mask-closable="false"
        >
          <NForm>
            <NAlert
              title="注意"
              type="info"
              :bordered="false"
              closable
              style="margin-bottom: 16px"
            >
              <template #icon>
                <NIcon :component="Info24Filled" />
              </template>
              这里填写的积分是指这个礼物直接对应多少积分，而不是兑换比例
            </NAlert>

            <NFormItem
              label="礼物名称"
              :validation-status="addGiftModel.nameError ? 'error' : undefined"
              :feedback="addGiftModel.nameError"
              required
            >
              <NInput
                v-model:value="addGiftModel.name"
                placeholder="请输入礼物名称"
                clearable
                autofocus
                @keydown="handleKeyDown"
              />
            </NFormItem>

            <NFormItem
              label="给予积分"
              :validation-status="addGiftModel.pointError ? 'error' : undefined"
              :feedback="addGiftModel.pointError"
              required
            >
              <NInputNumber
                v-model:value="addGiftModel.point"
                placeholder="请输入积分数量"
                min="1"
                clearable
                style="width: 100%"
                @keydown="handleKeyDown"
              />
            </NFormItem>

            <NFlex
              justify="end"
              :gap="12"
              style="margin-top: 24px"
            >
              <NButton
                @click="showAddGiftModal = false"
              >
                取消
              </NButton>
              <NButton
                type="primary"
                :loading="isLoading"
                :disabled="!addGiftModel.name || !addGiftModel.point || addGiftModel.point <= 0"
                @click="addGift"
              >
                确定
              </NButton>
            </NFlex>
          </NForm>
        </NModal>
      </NCard>
    </NFlex>
  </NSpin>
</template>

<style scoped>
.alert-margin {
  margin-bottom: 12px;
}

.setting-label {
  width: 48px;
  font-weight: 500;
  color: var(--n-text-color-3);
}

.setting-row-group {
  display: flex;
  flex-direction: column;
}

.input-group {
  width: 230px;
  max-width: 100%;
}

.input-group-wide {
  width: 320px;
  max-width: 100%;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin: 4px 0;
  display: flex;
  align-items: center;
}

.gift-card {
  width: 100%;
  margin-top: 8px;
}

.gift-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.gift-item-card {
  padding: 12px;
  border: 1px solid var(--n-border-color);
  border-radius: var(--n-border-radius);
  background-color: var(--n-card-color);
  transition: all 0.3s var(--n-bezier);
}

.gift-item-card:hover {
  background-color: var(--n-color-embedded);
  border-color: var(--n-primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.gift-name {
  font-weight: 500;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.modal-input {
  width: 100%;
  margin-bottom: 8px;
}

.error-text {
  color: var(--n-error-color);
  font-size: 12px;
  margin-top: -6px;
  margin-bottom: 8px;
}

/* 响应式布局优化 */
@media (max-width: 768px) {
  .input-group, .input-group-wide {
    width: 100%;
    margin-bottom: 8px;
  }

  .stat-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .gift-item {
    padding: 10px;
  }

  .section-title {
    font-size: 14px;
  }
}
</style>
