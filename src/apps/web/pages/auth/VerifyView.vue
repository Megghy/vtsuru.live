<script setup lang="ts">
import type { AccountInfo } from '@/api/api-models'
import { NButton, NCard, NLayoutContent, NSpace, useMessage } from 'naive-ui'
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { ACCOUNT } from '@/api/account'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'
import router from '@/app/router'
import '@/apps/web/styles/web-page.css'

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
  <NLayoutContent class="web-center">
    <div class="web-page web-page--md">
      <NCard size="small" bordered>
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
            size="medium"
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
