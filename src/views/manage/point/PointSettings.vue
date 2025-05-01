<script setup lang="ts">
import { SaveSetting, useAccount } from '@/api/account'
import { EventDataTypes, SettingPointGiftAllowType, Setting_Point } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { POINT_API_URL } from '@/data/constants'
import { Delete24Regular, Info24Filled } from '@vicons/fluent'
import {
  NAlert,
  NButton,
  NCard,
  NCheckbox,
  NCheckboxGroup,
  NDivider,
  NFlex,
  NForm,
  NFormItem,
  NIcon,
  NInput,
  NInputGroup,
  NInputGroupLabel,
  NInputNumber,
  NList,
  NListItem,
  NModal,
  NPopconfirm,
  NRadioButton,
  NRadioGroup,
  NSpin,
  NTag,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { computed, ref } from 'vue'

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
  allowCheckInRanking: false
}

// 响应式设置对象
const setting = computed({
  get: () => {
    if (accountInfo.value) {
      return accountInfo.value.settings.point || defaultSettingPoint
    }
    return defaultSettingPoint
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.point = value
    }
  },
})

// 添加礼物表单模型
const addGiftModel = ref<{ name: string; point: number; nameError: string; pointError: string }>({
  name: '',
  point: 1,
  nameError: '',
  pointError: ''
})

// 是否可以编辑设置
const canEdit = computed(() => {
  return accountInfo.value && accountInfo.value.settings
})

const isLoading = ref(false)
const showAddGiftModal = ref(false)

// 更新积分设置
async function updateSettings() {
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
      message.error('保存失败: ' + msg)
    }
  } catch (err) {
    message.error('保存失败: ' + err)
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
  if (!accountInfo.value) return false

  isLoading.value = true
  try {
    const msg = await SaveSetting('SendEmail', accountInfo.value.settings.sendEmail)
    if (msg) {
      message.success('已保存')
      return true
    } else {
      message.error('保存失败: ' + msg)
    }
  } catch (err) {
    message.error('修改失败: ' + err)
  } finally {
    isLoading.value = false
  }
  return false
}
</script>

<template>
  <!-- EventFetcher 部署提示 -->
  <NAlert
    v-if="!accountInfo.eventFetcherState.online"
    type="warning"
    class="alert-margin"
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
  >
    积分总是最多保留两位小数, 四舍五入
  </NAlert>

  <NDivider> 常用 </NDivider>

  <NSpin :show="isLoading">
    <NFlex
      vertical
      :gap="12"
    >
      <!-- 通知设置 -->
      <NFlex
        align="center"
        :gap="12"
      >
        <span>通知设置:</span>
        <NCheckbox
          v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
          :disabled="!canEdit"
          @update:checked="SaveComboSetting"
        >
          积分礼物有新用户兑换时发送邮件
        </NCheckbox>
      </NFlex>

      <!-- 积分来源设置 -->
      <NFlex
        align="center"
        :gap="12"
      >
        <span>允许的积分来源:</span>
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

      <!-- 舰长设置区域 -->
      <template v-if="setting.allowType.includes(EventDataTypes.Guard)">
        <NDivider>上舰设置</NDivider>
        <NFlex
          align="center"
          vertical
          :gap="10"
          class="settings-section"
        >
          <span>上舰所给予的积分:</span>
          <NFlex
            :wrap="true"
            :gap="8"
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
              />
              <NButton
                type="info"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                确定
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
              />
              <NButton
                type="info"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                确定
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
              />
              <NButton
                type="info"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                确定
              </NButton>
            </NInputGroup>
          </NFlex>
        </NFlex>
      </template>

      <!-- SC设置区域 -->
      <template v-if="setting.allowType.includes(EventDataTypes.SC)">
        <NDivider>SC设置</NDivider>
        <NFlex
          :gap="12"
          class="settings-section"
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
            />
            <NButton
              type="info"
              :disabled="!canEdit"
              @click="updateSettings"
            >
              确定
              <NTooltip>
                <template #trigger>
                  <NIcon :component="Info24Filled" />
                </template>
                将SC的价格以指定比例转换为积分, 如这里是0.5, 则一个30块的sc获得的积分为 30 * 0.5 = 15
              </NTooltip>
            </NButton>
          </NInputGroup>
        </NFlex>
      </template>

      <!-- 礼物设置区域 -->
      <template v-if="setting.allowType.includes(EventDataTypes.Gift)">
        <NDivider>礼物设置</NDivider>
        <NFlex
          vertical
          :gap="12"
          class="settings-section"
        >
          <!-- 礼物类型选择 -->
          <NRadioGroup
            v-model:value="setting.giftAllowType"
            @update:value="updateSettings"
          >
            <NRadioButton :value="SettingPointGiftAllowType.WhiteList">
              只包含下方的礼物
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
              />
              <NButton
                type="info"
                :disabled="!canEdit"
                @click="updateSettings"
              >
                确定
                <NTooltip>
                  <template #trigger>
                    <NIcon :component="Info24Filled" />
                  </template>
                  将礼物的价格以指定比例转换为积分, 如这里是0.5, 则一个10块的礼物获得的积分为 10 * 0.5 = 5
                </NTooltip>
              </NButton>
            </NInputGroup>
          </template>

          <!-- 礼物列表 -->
          <NCard class="gift-card">
            <NFlex
              vertical
              :gap="12"
            >
              <NFlex
                justify="space-between"
                align="center"
              >
                <span class="section-title">自定义礼物列表</span>
                <NButton
                  type="primary"
                  :disabled="!canEdit"
                  class="add-gift-button"
                  @click="showAddGiftModal = true"
                >
                  添加礼物
                </NButton>
              </NFlex>

              <NList bordered>
                <NEmpty
                  v-if="!Object.keys(setting.giftPercentMap).length"
                  description="暂无自定义礼物"
                />

                <NListItem
                  v-for="item in Object.entries(setting.giftPercentMap)"
                  :key="item[0]"
                >
                  <NFlex
                    align="center"
                    justify="space-between"
                    style="width: 100%"
                  >
                    <NFlex
                      align="center"
                      :gap="8"
                    >
                      <NTag
                        :bordered="false"
                        size="medium"
                        type="success"
                      >
                        {{ item[0] }}
                      </NTag>
                    </NFlex>

                    <NFlex
                      align="center"
                      :gap="12"
                    >
                      <NInputGroup
                        style="width: 180px"
                        :disabled="!canEdit"
                      >
                        <NInputNumber
                          :value="setting.giftPercentMap[item[0]]"
                          :disabled="!canEdit"
                          min="0"
                          @update:value="(v) => (setting.giftPercentMap[item[0]] = v ? v : 0)"
                        />
                        <NButton
                          type="info"
                          size="small"
                          :disabled="!canEdit"
                          @click="updateSettings"
                        >
                          更新
                        </NButton>
                      </NInputGroup>
                      <NPopconfirm @positive-click="deleteGift(item[0])">
                        <template #trigger>
                          <NButton
                            type="error"
                            size="small"
                            :disabled="!canEdit"
                          >
                            <template #icon>
                              <NIcon :component="Delete24Regular" />
                            </template>
                            删除
                          </NButton>
                        </template>
                        确定要删除这个礼物吗?
                      </NPopconfirm>
                    </NFlex>
                  </NFlex>
                </NListItem>
              </NList>
            </NFlex>
          </NCard>
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
              type="warning"
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
      </template>
    </NFlex>
  </NSpin>
</template>

<style scoped>
.alert-margin {
  margin-bottom: 12px;
}

.settings-section {
  margin: 8px 0;
}

.input-group {
  width: 230px;
  max-width: 100%;
}

.input-group-wide {
  width: 280px;
  max-width: 100%;
}

.section-title {
  font-size: 16px;
  font-weight: 500;
  margin: 4px 0;
}

.gift-card {
  width: 100%;
  margin-top: 8px;
}

.add-gift-button {
  max-width: 120px;
}

.modal-input {
  width: 100%;
  margin-bottom: 8px;
}

.error-text {
  color: var(--error-color, #d03050);
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
}
</style>
