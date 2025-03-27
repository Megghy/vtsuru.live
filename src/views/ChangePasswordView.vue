<script setup lang="ts">
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/data/constants'
import router from '@/router'
import { NButton, NCard, NInput, NLayoutContent, NSpace, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const password = ref('')
const password2 = ref('')
const message = useMessage()
const route = useRoute()
const key = computed(() => {
  return route.query.key
})
const isLoading = ref(false)

function changePassword() {
  if (password.value != password2.value) {
    message.error('两次密码不一致')
    return
  }
  isLoading.value = true
  QueryGetAPI(ACCOUNT_API_URL + 'verify/reset-password', {
    key: key.value,
    password: password.value,
  })
    .then((data) => {
      if (data.code == 200) {
        message.success('密码已修改')
        router.push({ name: 'manage-index' })
      } else {
        message.error(data.message)
      }
    })
    .catch((err) => {
      message.error('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <NLayoutContent style="height: 100vh; position: relative">
    <NCard
      style="max-width: 90%; width: 400px; top: 40%; margin: 0 auto"
      title="修改密码"
      embedded
    >
      <NSpace vertical>
        <NInput
          v-model:value="password"
          type="password"
          placeholder="新密码"
        />
        <NInput
          v-model:value="password2"
          type="password"
          placeholder="确认密码"
        />
        <NButton
          type="primary"
          :loading="isLoading"
          @click="changePassword"
        >
          修改密码
        </NButton>
      </NSpace>
    </NCard>
  </NLayoutContent>
</template>
