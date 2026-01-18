<script setup lang="ts">
import { NButton, NCard, NInput, NLayoutContent, NFlex, useMessage } from 'naive-ui';
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { QueryGetAPI } from '@/api/query'
import { ACCOUNT_API_URL } from '@/shared/config'
import router from '@/app/router'
import '@/apps/web/styles/web-page.css'

const password = ref('')
const password2 = ref('')
const message = useMessage()
const route = useRoute()
const key = computed(() => {
  const v = Array.isArray(route.query.key) ? route.query.key[0] : route.query.key
  return typeof v === 'string' ? v : ''
})
const isLoading = ref(false)

function changePassword() {
  if (password.value != password2.value) {
    message.error('两次密码不一致')
    return
  }
  if (!key.value) {
    message.error('链接无效：缺少 key')
    return
  }
  isLoading.value = true
  QueryGetAPI(`${ACCOUNT_API_URL}verify/reset-password`, {
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
      console.error(err)
      message.error('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <NLayoutContent class="web-center">
    <div class="web-page web-page--md">
      <NCard title="修改密码" size="small" bordered>
        <NFlex vertical>
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
        </NFlex>
      </NCard>
    </div>
  </NLayoutContent>
</template>
