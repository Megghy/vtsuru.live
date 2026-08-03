<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { ACCOUNT } from '@/api/account'
import type { AccountInfo } from '@/api/api-models'
import { QueryGetAPI } from '@/api/query'
import router from '@/app/router'
import { ACCOUNT_API_URL } from '@/shared/config'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

import '@/apps/web/styles/web-page.css'

const route = useRoute()
const target = computed(() => {
  const v = Array.isArray(route.query.target) ? route.query.target[0] : route.query.target
  return typeof v === 'string' ? v : ''
})

const isLoading = ref(false)

async function VerifyAccount() {
  if (!target.value) {
    showErrorToast('链接无效：缺少 target')
    return
  }
  isLoading.value = true
  await QueryGetAPI<AccountInfo>(`${ACCOUNT_API_URL}verify`, {
    target: target.value,
  })
    .then((data) => {
      if (data.code == 200) {
        ACCOUNT.value = data.data
        showSuccessToast(`成功激活账户: ${ACCOUNT.value.name}`)
        router.push('/manage')
      } else {
        showErrorToast(`激活失败: ${data.message}`)
      }
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <main class="web-center">
    <div class="web-page web-page--md">
      <section class="auth-action">
        <h1>激活账户</h1>
        <UButton
          :loading="isLoading"
          @click="VerifyAccount"
        >
          进行账户激活
        </UButton>
      </section>
    </div>
  </main>
</template>

<style scoped>
.auth-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.auth-action h1 {
  margin: 0;
  font-size: 20px;
}
</style>
