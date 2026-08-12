<script setup lang="ts">
import { NCard, NCheckbox, NCheckboxGroup, NDivider, NFlex, NSpin, NTabPane, NTabs, useMessage } from 'naive-ui'
import { ref, watch } from 'vue'

import { SaveAccountSettings, SaveEnableFunctions, useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'

import BlackListPane from './BlackListPane.vue'

const accountInfo = useAccount()
const message = useMessage()

const isSaving = ref(false)

const selectedTab = useRouteQueryParam('setting', 'general', { transform: String })
watch(
  selectedTab,
  (v) => {
    if (v === 'index') selectedTab.value = 'general'
  },
  { immediate: true },
)

/** 保存功能启用状态 */
async function SaveComboGroupSetting(
  _value: (string | number)[],
  meta: { actionType: 'check' | 'uncheck'; value: string | number },
) {
  if (!accountInfo.value) return
  isSaving.value = true
  const fn = meta.value as FunctionTypes
  try {
    const response = await SaveEnableFunctions(accountInfo.value.settings.enableFunctions)
    if (response.code !== 200) {
      message.error('修改失败')
      // 按操作类型回滚：check 失败则移除，uncheck 失败则加回
      const list = accountInfo.value.settings.enableFunctions
      if (meta.actionType === 'check') {
        accountInfo.value.settings.enableFunctions = list.filter((f) => f !== fn)
      } else if (!list.includes(fn)) {
        list.push(fn)
      }
    }
  } catch (err) {
    message.error(`修改失败: ${err}`)
    const list = accountInfo.value.settings.enableFunctions
    if (meta.actionType === 'check') {
      accountInfo.value.settings.enableFunctions = list.filter((f) => f !== fn)
    } else if (!list.includes(fn)) {
      list.push(fn)
    }
  } finally {
    isSaving.value = false
  }
}

/** 保存账户设置 */
async function SaveComboSetting() {
  if (!accountInfo.value) return
  isSaving.value = true
  try {
    const response = await SaveAccountSettings()
    if (response.code === 200) message.success('已保存')
    else message.error('修改失败')
  } catch (err) {
    message.error(`修改失败: ${err}`)
  } finally {
    isSaving.value = false
  }
}
</script>

<template>
  <NCard
    title="设置"
    size="small"
    bordered
    :segmented="{ content: true }"
  >
    <NSpin :show="isSaving">
      <NTabs
        v-model:value="selectedTab"
        :default-value="$route.query.setting?.toString() ?? 'general'"
        type="line"
        animated
        size="small"
      >
        <!-- 常规设置标签页 -->
        <NTabPane
          tab="常规"
          name="general"
          display-directive="show:lazy"
        >
          <NDivider style="margin: 0"> 启用功能 </NDivider>
          <NCheckboxGroup
            v-model:value="accountInfo.settings.enableFunctions"
            @update:value="SaveComboGroupSetting"
          >
            <NFlex
              :size="8"
              style="flex-wrap: wrap"
            >
              <NCheckbox :value="FunctionTypes.SongList"> 歌单 </NCheckbox>
              <NCheckbox :value="FunctionTypes.QuestionBox"> 提问箱（棉花糖） </NCheckbox>
              <NCheckbox :value="FunctionTypes.Schedule"> 日程 </NCheckbox>
              <NCheckbox :value="FunctionTypes.LiveRequest"> 点播 </NCheckbox>
              <NCheckbox :value="FunctionTypes.Queue"> 排队 </NCheckbox>
              <NCheckbox :value="FunctionTypes.Point"> 积分和礼物 </NCheckbox>
              <NCheckbox :value="FunctionTypes.VideoCollect"> 视频征集 </NCheckbox>
              <NCheckbox :value="FunctionTypes.CheckInRanking"> 签到排行 </NCheckbox>
            </NFlex>
          </NCheckboxGroup>

          <NDivider> 通知 </NDivider>
          <NFlex>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQA"
              @update:checked="SaveComboSetting"
            >
              收到新提问时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.recieveQAReply"
              @update:checked="SaveComboSetting"
            >
              提问收到回复时发送邮件
            </NCheckbox>
            <NCheckbox
              v-model:checked="accountInfo.settings.sendEmail.receiveOrder"
              @update:checked="SaveComboSetting"
            >
              积分礼物有新用户兑换时发送邮件
            </NCheckbox>
          </NFlex>

          <NDivider> 提问箱 </NDivider>
          <NFlex>
            <NCheckbox
              v-model:checked="accountInfo.settings.questionBox.allowUnregistedUser"
              @update:checked="SaveComboSetting"
            >
              允许未注册用户提问
            </NCheckbox>
          </NFlex>
        </NTabPane>

        <!-- 黑名单标签页 -->
        <NTabPane
          tab="黑名单"
          name="blacklist"
          display-directive="show:lazy"
        >
          <BlackListPane />
        </NTabPane>
      </NTabs>
    </NSpin>
  </NCard>
</template>
