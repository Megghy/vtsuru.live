<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { postApiAccountVerifyResetPassword } from '@/api/generated/account/account'
import router from '@/app/router'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { Input } from '@/shared/ui/input'
import { toast } from '@/shared/utils'

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
  if (password.value !== password2.value) {
    toast.error('两次密码不一致')
    return
  }
  if (!key.value) {
    toast.error('链接无效：缺少 key')
    return
  }
  isLoading.value = true
  postApiAccountVerifyResetPassword({
    key: key.value,
    password: password.value,
  })
    .then((data) => {
      if (data.code === 200) {
        toast.success('密码已修改')
        router.push({ name: 'manage-index' })
      } else {
        toast.error(data.message || '修改失败')
      }
    })
    .catch((err) => {
      console.error(err)
      toast.error('发生错误')
    })
    .finally(() => {
      isLoading.value = false
    })
}
</script>

<template>
  <main class="web-center flex flex-col items-center justify-center min-h-[60vh] p-6">
    <div class="web-page web-page--md w-full max-w-sm">
      <Card>
        <CardHeader class="pb-4">
          <CardTitle class="text-lg">修改密码</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <Input v-model="password" type="password" placeholder="新密码" />
          <Input v-model="password2" type="password" placeholder="确认密码" />
          <Button class="w-full" :disabled="isLoading" @click="changePassword">
            {{ isLoading ? '提交中...' : '修改密码' }}
          </Button>
        </CardContent>
      </Card>
    </div>
  </main>
</template>
