<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NDivider, NForm, NSwitch, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRequest } from 'vue-request'
import { FunctionTypes } from '@/api/api-models'
import { QueryPostAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'

const account = useAccount()
const message = useMessage()

function UpdateEnableFunction(func: FunctionTypes, enable: boolean) {
  if (account.value) {
    if (enable) {
      //从account.value?.settings.enableFunctions中移除指定的func
      account.value.settings.enableFunctions = account.value?.settings.enableFunctions.filter((f) => f != func)
    } else {
      account.value.settings.enableFunctions.push(func)
    }
  }
}
async function SaveSetting() {
  const data = await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', {
    setting: JSON.stringify(account.value?.settings),
  })
  if (data.code == 200) {
    message.success('保存成功')
  }
}
</script>

<template>
  <NCard v-if="account">
    <NDivider> 启用功能 </NDivider>
    <NCheckboxGroup v-model:value="account.settings.enableFunctions">
      <NCheckbox :value="FunctionTypes.SongList"> 歌单 </NCheckbox>
      <NCheckbox :value="FunctionTypes.QuestionBox"> 提问箱(棉花糖 </NCheckbox>
    </NCheckboxGroup>
    <NDivider />
    <NButton @click="SaveSetting"> 保存 </NButton>
  </NCard>
</template>
