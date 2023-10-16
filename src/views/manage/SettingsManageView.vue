<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NButton, NCard, NCheckbox, NCheckboxGroup, NDivider, NForm, NSpace, NSwitch, useMessage } from 'naive-ui'
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
async function SaveComboGroupSetting(value: (string | number)[], meta: { actionType: 'check' | 'uncheck'; value: string | number }) {
  if (account.value) {
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', account.value?.settings)
      .then((data) => {
        if (data.code == 200) {
          //message.success('保存成功')
        } else {
          message.error('修改失败')
          if (account.value) {
            account.value.settings.enableFunctions = account.value.settings.enableFunctions.filter((f) => f != (meta.value as FunctionTypes))
          }
        }
      })
      .catch((err) => {
        console.error(err)
        message.error('修改失败')
      })
  }
}
async function SaveComboSetting(value :boolean) {
  if (account.value) {
    //UpdateEnableFunction(meta.value as FunctionTypes, meta.actionType == 'check')
    await QueryPostAPI(ACCOUNT_API_URL + 'update-setting', account.value?.settings)
      .then((data) => {
        if (data.code == 200) {
          //message.success('保存成功')
        } else {
          message.error('修改失败')
        }
      })
      .catch((err) => {
        console.error(err)
        message.error('修改失败')
      })
  }
}
</script>

<template>
  <NCard v-if="account" title="设置">
    <NDivider style="margin: 0"> 启用功能 </NDivider>
    <NCheckboxGroup v-model:value="account.settings.enableFunctions" @update:value="SaveComboGroupSetting">
      <NCheckbox :value="FunctionTypes.SongList"> 歌单 </NCheckbox>
      <NCheckbox :value="FunctionTypes.QuestionBox"> 提问箱(棉花糖 </NCheckbox>
    </NCheckboxGroup>
    <NDivider > 通知 </NDivider>
    <NSpace>
      <NCheckbox v-model:checked="account.settings.sendEmail.recieveQA" @update:checked="SaveComboSetting"> 收到新提问时发送邮件 </NCheckbox>
      <NCheckbox v-model:checked="account.settings.sendEmail.recieveQAReply" @update:checked="SaveComboSetting"> 提问收到回复时发送邮件 </NCheckbox>
    </NSpace>
    <NDivider> 提问箱 </NDivider>
    <NSpace>
      <NCheckbox v-model:checked="account.settings.questionBox.allowUnregistedUser" @update:checked="SaveComboSetting"> 允许未注册用户提问 </NCheckbox>
    </NSpace>
  </NCard>
</template>
