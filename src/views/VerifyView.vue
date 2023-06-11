<script setup lang="ts">
import { ACCOUNT } from '@/api/account'
import { AccountInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL, TURNSTILE_KEY } from '@/data/constants'
import router from '@/router'
import { NButton, NCard, NSpace, NSpin, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import VueTurnstile from 'vue-turnstile'

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
      router.push('index')
      message.success('成功激活账户: ' + ACCOUNT.value.name)
    }
  })
}
</script>

<template>
  <div style="display: flex; align-items: center; justify-content: center; height: 100%">
    <NCard embedded style="max-width: 500px">
      <template #header> 激活账户 </template>
      <NSpin :show="!token">
        <NSpace justify="center" align="center" vertical>
          <NButton @click="VerifyAccount" type="primary" size="large"> 进行账户激活 </NButton>
          <VueTurnstile :site-key="TURNSTILE_KEY" v-model="token" theme="auto" style="text-align: center" />
        </NSpace>
      </NSpin>
    </NCard>
  </div>
</template>
