<script setup lang="ts">
import { useAccount } from '@/api/account'
import { NAlert, NButton, NCard, NDivider, NPopconfirm, NSpace, NTag, NText, NThing, NTime } from 'naive-ui'
import SettingsManageView from './SettingsManageView.vue'
import { useLocalStorage } from '@vueuse/core'

const accountInfo = useAccount()
const cookie = useLocalStorage('JWT_Token', '')

function logout() {
  cookie.value = undefined
  window.location.reload()
}
</script>

<template>
  <NSpace justify="center" align="center" vertical style="width: 100%">
    <NCard embedded style="max-width: 90%; width: 800px">
      <NSpace align="center" justify="center" vertical>
        <NText style="font-size: 3rem">
          {{ accountInfo?.name }}
        </NText>
        <NText style="color: gray">
          于
          <NTime :time="accountInfo?.createAt" />
          注册
        </NText>
      </NSpace>

      <NDivider />
      <NAlert>
        邮箱:
        <NTag v-if="accountInfo?.isEmailVerified" type="success"> 已认证 | {{ accountInfo?.bindEmail }} </NTag>
        <template v-else>
          <NTag type="error" size="small"> 未认证 </NTag>
        </template>
      </NAlert>
      <NAlert>
        Bilibili 账户:
        <NTag v-if="accountInfo?.isBiliVerified" type="success"> 已认证 | {{ accountInfo?.biliId }} </NTag>
        <template v-else>
          <NTag type="error" size="small"> 未认证 </NTag>
          <NDivider vertical />
          <NButton size="small" @click="$router.push({ name: 'manage-biliVerify' })" type="info"> 前往认证 </NButton>
        </template>
      </NAlert>
      <NDivider />
      <NSpace justify="center">
        <NPopconfirm @positive-click="logout">
          <template #trigger>
            <NButton type="warning"> 登出 </NButton>
          </template>
          确定登出?
        </NPopconfirm>
      </NSpace>
    </NCard>
  </NSpace>
  <div>
    <NDivider />
    <SettingsManageView />
  </div>
</template>
