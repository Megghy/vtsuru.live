<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { QueryGetAPI } from '@/api/query'
import router from '@/app/router'
import { ACCOUNT_API_URL } from '@/shared/config'
import { showErrorToast, showSuccessToast } from '@/shared/services/toast'

import '@/apps/web/styles/web-page.css'

const password = ref('')
const password2 = ref('')
const route = useRoute()
const key = computed(() => {
  const v = Array.isArray(route.query.key) ? route.query.key[0] : route.query.key
  return typeof v === 'string' ? v : ''
})
const isLoading = ref(false)

function changePassword() {
  if (password.value != password2.value) {
    showErrorToast('两次密码不一致')
    return
  }
  if (!key.value) {
    showErrorToast('链接无效：缺少 key')
    return
  }
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}verify/reset-password`, {
    key: key.value,
    password: password.value,
  })
    .then((data) => {
      if (data.code == 200) {
        showSuccessToast('密码已修改')
        router.push({ name: 'manage-index' })
      } else {
        showErrorToast(data.message)
      }
    })
    .catch((err) => {
      console.error(err)
      showErrorToast('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <main class="web-center">
    <div class="web-page web-page--md">
      <section class="password-form">
        <h1>修改密码</h1>
        <UInput
          v-model="password"
          type="password"
          placeholder="新密码"
        />
        <UInput
          v-model="password2"
          type="password"
          placeholder="确认密码"
        />
        <UButton
          block
          :loading="isLoading"
          @click="changePassword"
        >
          修改密码
        </UButton>
      </section>
    </div>
  </main>
</template>

<style scoped>
.password-form {
  display: flex;
  max-width: 380px;
  margin: 0 auto;
  flex-direction: column;
  gap: 12px;
}

.password-form h1 {
  margin: 0 0 4px;
  font-size: 20px;
}
</style>
