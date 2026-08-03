<script setup lang="ts">
import { computed, ref } from 'vue'

import { SaveAccountSettings, SaveEnableFunctions, useAccount } from '@/api/account'
import { FunctionTypes } from '@/api/api-models'
import { useRouteQueryParam } from '@/composables/useRouteQueryParam'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

import BlackListPane from './BlackListPane.vue'

const account = useAccount()
const saving = ref(false)
const tab = useRouteQueryParam('setting', 'general', { transform: String })
const enabledFunctions = computed({
  get: () => account.value.settings.enableFunctions.map(String),
  set: (values: string[]) => {
    account.value.settings.enableFunctions = values.map(Number) as FunctionTypes[]
  },
})
const functionItems = [
  { label: '歌单', value: String(FunctionTypes.SongList) },
  { label: '提问箱（棉花糖）', value: String(FunctionTypes.QuestionBox) },
  { label: '日程', value: String(FunctionTypes.Schedule) },
  { label: '点歌', value: String(FunctionTypes.LiveRequest) },
  { label: '排队', value: String(FunctionTypes.Queue) },
  { label: '签到排行', value: String(FunctionTypes.CheckInRanking) },
]

async function saveFunctions() {
  saving.value = true
  try {
    const response = await SaveEnableFunctions(account.value.settings.enableFunctions)
    if (response.code !== 200) throw new Error(response.message)
    showSuccessToast('已保存')
  } catch (error) {
    showErrorToast(`修改失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    saving.value = false
  }
}

async function saveSettings() {
  saving.value = true
  try {
    const response = await SaveAccountSettings()
    if (response.code !== 200) throw new Error(response.message)
    showSuccessToast('已保存')
  } catch (error) {
    showErrorToast(`修改失败：${error instanceof Error ? error.message : String(error)}`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard
    title="设置"
    description="管理功能、通知与访问控制。"
  >
    <UTabs
      v-model="tab"
      :items="[
        { label: '常规', value: 'general', icon: 'i-lucide-settings-2' },
        { label: '黑名单', value: 'blacklist', icon: 'i-lucide-ban' },
      ]"
    >
      <template #content="{ item }">
        <div
          v-if="item.value === 'general'"
          class="settings-content"
          :aria-busy="saving"
        >
          <USeparator label="启用功能" />
          <UCheckboxGroup
            v-model="enabledFunctions"
            :items="functionItems"
            @update:model-value="saveFunctions"
          />
          <USeparator label="通知" />
          <div class="settings-options">
            <UCheckbox
              v-model="account.settings.sendEmail.recieveQA"
              label="收到新提问时发送邮件"
              @update:model-value="saveSettings"
            />
            <UCheckbox
              v-model="account.settings.sendEmail.recieveQAReply"
              label="提问收到回复时发送邮件"
              @update:model-value="saveSettings"
            />
            <UCheckbox
              v-model="account.settings.sendEmail.receiveOrder"
              label="积分礼物有新用户兑换时发送邮件"
              @update:model-value="saveSettings"
            />
          </div>
          <USeparator label="提问箱" />
          <UCheckbox
            v-model="account.settings.questionBox.allowUnregistedUser"
            label="允许未注册用户提问"
            @update:model-value="saveSettings"
          />
        </div>
        <BlackListPane v-else />
      </template>
    </UTabs>
  </UCard>
</template>

<style scoped>
.settings-content,
.settings-options {
  display: grid;
  gap: 14px;
}
</style>
