<script setup lang="ts">
import type { AccountInfo } from '@/api/api-models'
import { NButton, NCard, NLayoutContent, NSpace, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ACCOUNT } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'
import router from '@/router'

const message = useMessage()
const route = useRoute()

const isLoading = ref(false)

async function VerifyAccount() {
  isLoading.value = true
  await QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}verify`, {
    target: route.query.target,
  })
    .then((data) => {
      if (data.code == 200) {
        ACCOUNT.value = data.data
        message.success(`成功激活账户: ${ACCOUNT.value.name}`)
        router.push('/manage')
      } else {
        message.error(`激活失败: ${data.message}`)
      }
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <NLayoutContent style="height: 100vh">
    <div style="display: flex; align-items: center; justify-content: center; height: 100%">
      <NCard
        embedded
        style="max-width: 500px"
      >
        <template #header>
          激活账户
        </template>
        <NSpace
          justify="center"
          align="center"
          vertical
        >
          <NButton
            type="primary"
            size="large"
            :loading="isLoading"
            @click="VerifyAccount"
          >
            进行账户激活
          </NButton>
        </NSpace>
      </NCard>
    </div>
  </NLayoutContent>
</template>
