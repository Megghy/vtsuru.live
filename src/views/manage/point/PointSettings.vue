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
const defaultSettingPoint: Setting_Point = {
  allowType: [EventDataTypes.Guard],
  jianzhangPoint: 10,
  tiduPoint: 100,
  zongduPoint: 1000,
  giftPercentMap: {}, // Empty object for an empty map
  scPointPercent: 0.1,
  giftPointPercent: 0.1,
  giftAllowType: SettingPointGiftAllowType.All,
}
const setting = computed({
  get: () => {
    if (accountInfo.value) {
      return accountInfo.value.settings.point
    }
    return defaultSettingPoint
  },
  set: (value) => {
    if (accountInfo.value) {
      accountInfo.value.settings.point = value
    }
  },
})
const addGiftModel = ref<{ name: string; point: number }>({ name: '', point: 1 })

const canEdit = computed(() => {
  return accountInfo.value && accountInfo.value.settings
})
const isLoading = ref(false)
const showAddGiftModal = ref(false)

async function updateSettings() {
  if (accountInfo.value) {
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
  } else {
    message.success('完成')
  }
  return false
}
async function addGift() {
  if (!addGiftModel.value.name) {
    message.error('请输入礼物名称')
    return
  }
  if (addGiftModel.value.point > 2147483647) {
    //不能超过int
    message.error('积分不能超过2147483647')
  }
  setting.value.giftPercentMap[addGiftModel.value.name] = addGiftModel.value.point
  updateGift()
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
</script>

<template>
  <NAlert v-if="!accountInfo.eventFetcherState.online" type="warning">
    由于你尚未部署
    <NButton text type="primary" tag="a" href="https://www.wolai.com/fje5wLtcrDoZcb9rk2zrFs" target="_blank">
      VtsuruEventFetcher
    </NButton>
    , 以下选项设置了也没用
  </NAlert>
  <br />
  <NAlert type="info"> 积分总是最多保留两位小数, 四舍五入 </NAlert>
  <NDivider> 常用 </NDivider>
  <NSpin :show="isLoading">
    <NFlex vertical>
      <NFlex>
        允许的积分来源
        <NCheckboxGroup v-model:value="setting.allowType" @update:value="updateSettings" :disabled="!canEdit">
          <NCheckbox :value="EventDataTypes.Guard"> 上舰 </NCheckbox>
          <NCheckbox :value="EventDataTypes.SC"> Superchat </NCheckbox>
          <NCheckbox :value="EventDataTypes.Gift"> 礼物 </NCheckbox>
        </NCheckboxGroup>
      </NFlex>
      <template v-if="setting.allowType.includes(EventDataTypes.Guard)">
        <NDivider>上舰设置</NDivider>
        <NFlex align="center">
          上舰所给予的积分
          <NFlex>
            <NInputGroup style="width: 230px" :disabled="!canEdit">
              <NInputGroupLabel> 舰长 </NInputGroupLabel>
              <NInputNumber v-model:value="setting.jianzhangPoint" :disabled="!canEdit" min="0" />
              <NButton @click="updateSettings" type="info" :disabled="!canEdit">确定</NButton>
            </NInputGroup>
            <NInputGroup style="width: 230px" :disabled="!canEdit">
              <NInputGroupLabel> 提督 </NInputGroupLabel>
              <NInputNumber v-model:value="setting.tiduPoint" :disabled="!canEdit" min="0" />
              <NButton @click="updateSettings" type="info" :disabled="!canEdit">确定</NButton>
            </NInputGroup>
            <NInputGroup style="width: 230px" :disabled="!canEdit">
              <NInputGroupLabel> 总督 </NInputGroupLabel>
              <NInputNumber v-model:value="setting.zongduPoint" :disabled="!canEdit" min="0" />
              <NButton @click="updateSettings" type="info" :disabled="!canEdit">确定</NButton>
            </NInputGroup>
          </NFlex>
        </NFlex>
      </template>
      <template v-if="setting.allowType.includes(EventDataTypes.SC)">
        <NDivider>SC设置</NDivider>
        <NFlex>
          <NInputGroup style="width: 280px" :disabled="!canEdit">
            <NInputGroupLabel> SC转换倍率 </NInputGroupLabel>
            <NInputNumber v-model:value="setting.scPointPercent" :disabled="!canEdit" min="0" step="0.01" max="1" />
            <NButton @click="updateSettings" type="info" :disabled="!canEdit">确定
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
      <template v-if="setting.allowType.includes(EventDataTypes.Gift)">
        <NDivider>礼物设置</NDivider>
        <NFlex vertical>
          <NRadioGroup v-model:value="setting.giftAllowType" @update:value="updateSettings">
            <NRadioButton :value="SettingPointGiftAllowType.WhiteList"> 只包含下方的礼物 </NRadioButton>
            <NRadioButton :value="SettingPointGiftAllowType.All"> 包含所有礼物 </NRadioButton>
          </NRadioGroup>
          <template v-if="setting.giftAllowType === SettingPointGiftAllowType.All">
            <NInputGroup style="width: 280px" :disabled="!canEdit">
              <NInputGroupLabel> 礼物转换倍率 </NInputGroupLabel>
              <NInputNumber v-model:value="setting.giftPointPercent" :disabled="!canEdit" min="0" step="0.01" max="1" />
              <NButton @click="updateSettings" type="info" :disabled="!canEdit">
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
          <NCard>
            <NFlex vertical>
              <NButton @click="showAddGiftModal = true" type="primary" :disabled="!canEdit" style="max-width: 200px">
                添加礼物
              </NButton>
              <NList bordered>
                <NListItem v-for="item in Object.entries(setting.giftPercentMap)" :key="item[0]">
                  <NFlex align="center">
                    <NTag :bordered="false" size="small" type="success"> {{ item[0] }} </NTag>
                    <NInputGroup style="width: 200px" :disabled="!canEdit">
                      <NInputNumber :value="setting.giftPercentMap[item[0]]"
                        @update:value="(v) => (setting.giftPercentMap[item[0]] = v ?? 0)" :disabled="!canEdit"
                        min="0" />
                      <NButton @click="updateSettings" type="info" :disabled="!canEdit">确定</NButton>
                    </NInputGroup>
                    <NPopconfirm @positive-click="deleteGift(item[0])">
                      <template #trigger>
                        <NButton type="error" text :disabled="!canEdit">
                          <template #icon>
                            <NIcon :component="Delete24Regular" />
                          </template>
                        </NButton>
                      </template>
                      确定要删除这个礼物吗?
                    </NPopconfirm>
                  </NFlex>
                </NListItem>
              </NList>
            </NFlex>
          </NCard>
        </NFlex>
        <NModal v-model:show="showAddGiftModal" preset="card" title="添加礼物" style="max-width: 400px">
          <NFlex align="center" vertical>
            <NAlert title="注意" type="warning"> 这里填写的积分是指这个礼物直接对应多少积分, 而不是兑换比例 </NAlert>
            <NInputGroup>
              <NInputGroupLabel> 礼物名称 </NInputGroupLabel>
              <NInput v-model:value="addGiftModel.name" placeholder="礼物名称" />
            </NInputGroup>
            <NInputGroup>
              <NInputGroupLabel> 给予积分 </NInputGroupLabel>
              <NInputNumber v-model:value="addGiftModel.point" placeholder="积分数量" min="0" />
            </NInputGroup>
            <NButton @click="addGift" type="info" :loading="isLoading">确定</NButton>
          </NFlex>
        </NModal>
      </template>
    </NFlex>
  </NSpin>
</template>
