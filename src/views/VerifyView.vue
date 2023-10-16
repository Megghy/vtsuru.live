<script setup lang="ts">
import { ACCOUNT, useAccount } from '@/api/account'
import { AccountInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL, TURNSTILE_KEY } from '@/data/constants'
import router from '@/router'
import { NAlert, NButton, NCard, NSpace, NSpin, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'

const accountInfo = useAccount()

const message = useMessage()
const token = ref('')
const route = useRoute()

async function VerifyAccount() {
  await QueryGetAPI<AccountInfo>(
    ACCOUNT_API_URL + 'verify',
    {
      target: route.query.target,
    },
    [['Turnstile', token.value]]
  ).then((data) => {
    if (data.code == 200) {
      ACCOUNT.value = data.data
      message.success('成功激活账户: ' + ACCOUNT.value.name)
      router.push('/manage')
    }
    else {
      message.error('激活失败: ' + data.message)
    }
  })
}
</script>

<template>
  <div style="display: flex; align-items: center; justify-content: center; height: 100%">
    <NCard v-if="accountInfo?.isEmailVerified != true" embedded style="max-width: 500px">
      <template #header> 激活账户 </template>
      <NSpin :show="!token">
        <NSpace justify="center" align="center" vertical>
          <NButton @click="VerifyAccount" type="primary" size="large"> 进行账户激活 </NButton>
          <VueTurnstile :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
        </NSpace>
      </NSpin>
    </NCard>
    <NAlert v-else type="error">
      此账户已完成验证
    </NAlert>
  </div>
</template>
